import mysql from 'mysql2/promise';
import { databaseConfig } from '../config/database.js';

// Crear un pool de conexiones reutilizable
let pool;

const getPool = () => {
  if (!pool) {
    pool = mysql.createPool(databaseConfig.getConnectionConfig());
  }
  return pool;
};

/**
 * Query base que replica (simplificada) la estructura de data_programa.php:
 * una fila por programa/diplomado con las columnas que luego se mapean a HubDB.
 *
 * IMPORTANTE: todas las columnas que queramos exponer/mapejar deben estar
 * seleccionadas aquí con el mismo nombre que verá el frontend.
 *
 * Se exporta para poder reutilizarla desde otros controladores (por ejemplo,
 * para leer datos consistentes en la sincronización hacia HubDB).
 */
export const getBaseProgramaQuery = () => `
  SELECT 
    d.ID_DIPLOMA,
    d.cod_diploma,
    d.DIPLOMADO        AS programa,
    d.fecha_inicio,
    d.fecha_termino,
    d.valor_diplomado,
    d.moneda,
    d.area_conocimiento,
    d.horario_web,
    d.lnk_pdf,
    d.modalidad_programa,
    d.tipo_programa,
    dd.descripcion,
    dd.objetivos,
    dd.consideraciones,
    dd.imagen_destacada,
    dd.icono,
    dd.carrito,
    d.nivel,
    d.Cod_interno      AS ceco,
    CONCAT_WS(' ', u.Nombre, u.Apellido) AS nombre_ejecutiva,
    u.cargo      AS cargo_ejecutiva,
    u.email      AS email_ejecutiva,
    u.telefono   AS telefono_ejecutiva,
    u.movil      AS movil_ejecutiva,
    u.direccion  AS direccion_ejecutiva
  FROM 
    diplomados d
    LEFT JOIN diplomas_descripcion dd 
      ON dd.cod_diploma = d.cod_diploma
    LEFT JOIN usuarios_int u 
      ON u.usr = d.usr_cordinador_ad
`;

/**
 * Obtiene los campos (columnas) a partir del SELECT completo
 * del programa (equivalente al data_programa.php), exponiendo
 * las columnas disponibles para mapeo a HubDB.
 */
export const getDatabaseFields = async (req, res) => {
  try {
    // Validar configuración básica (host, user, pass, database)
    try {
      databaseConfig.validate();
    } catch (validationError) {
      console.error('Error de configuración de MySQL:', validationError.message);
      return res.status(400).json({
        success: false,
        error: validationError.message,
        hint:
          'Revisa las variables MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD y MYSQL_DATABASE en tu .env',
      });
    }

    const pool = getPool();

    // Usamos la query base como subconsulta y solo pedimos metadatos
    const metaQuery = `
      SELECT * 
      FROM (
        ${getBaseProgramaQuery()}
      ) AS programa
      WHERE 1 = 0
      LIMIT 0
    `;

    // mysql2 devuelve [rows, fields] – nos interesan sólo los metadatos
    const [rows, fieldsInfo] = await pool.query(metaQuery);

    const fields = (fieldsInfo || []).map((f, index) => ({
      name: f.name,
      label: f.name,
      type: 'mixed',
      nullable: true,
      isPrimaryKey: false,
      hasDefault: false,
      defaultValue: null,
      extra: null,
      position: index + 1,
    }));

    return res.json({
      success: true,
      data: fields,
      count: fields.length,
      source: 'programa_base_query',
    });
  } catch (error) {
    console.error('Error al obtener campos de la base de datos (query diplomados):', error.message);

    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al consultar la base de datos',
    });
  }
};

/**
 * Obtiene una vista previa de los datos basada en los mapeos seleccionados
 * Recibe un array de mapeos: [{ hubdbField: {id, name, label}, databaseField: {name} }]
 */
export const getPreviewData = async (req, res) => {
  try {
    // Validar configuración
    try {
      databaseConfig.validate();
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.message,
      });
    }

    const { mappings } = req.body;

    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'No hay mapeos seleccionados',
      });
    }

    // Filtrar solo los mapeos activos (con checkbox marcado y campo seleccionado)
    const activeMappings = mappings.filter(
      (m) => m.enabled && m.hubdbField && m.databaseField
    );

    if (activeMappings.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'No hay mapeos activos',
      });
    }

    const pool = getPool();

    // Construir el SELECT dinámico sobre la query base de programa
    // Seleccionamos las columnas de BD y las alias con el nombre del campo de HubDB
    const selectColumns = activeMappings
      .map((m) => {
        const dbField = m.databaseField.name;
        const hubdbLabel = m.hubdbField.label || m.hubdbField.name;
        // Escapar nombres de columnas con backticks
        return `\`${dbField}\` AS \`${hubdbLabel}\``;
      })
      .join(', ');

    const query = `
      SELECT ${selectColumns}
      FROM (
        ${getBaseProgramaQuery()}
      ) AS programa
      LIMIT 20
    `;

    console.log('🔍 Consulta de vista previa:', query);

    const [rows] = await pool.query(query);

    // Formatear los resultados
    const formattedRows = rows.map((row) => {
      const formatted = {};
      activeMappings.forEach((m) => {
        const hubdbLabel = m.hubdbField.label || m.hubdbField.name;
        const dbField = m.databaseField.name;
        formatted[hubdbLabel] = row[hubdbLabel] ?? row[dbField] ?? null;
      });
      return formatted;
    });

    return res.json({
      success: true,
      data: formattedRows,
      count: formattedRows.length,
      totalColumns: activeMappings.length,
      query: query, // Para debugging
    });
  } catch (error) {
    console.error('Error al obtener vista previa:', error.message);

    return res.status(500).json({
      success: false,
      error: error.message || 'Error al ejecutar la consulta de vista previa',
      details: error.code,
    });
  }
};

/**
 * Obtiene todos los registros de la tabla de base de datos
 * necesarios para la sincronización, según los mapeos activos.
 *
 * Devuelve las columnas de base de datos seleccionadas en los mapeos
 * más la columna cod_diploma (para poder hacer match con HubDB).
 */
export const getSyncData = async (req, res) => {
  try {
    // Validar configuración
    try {
      databaseConfig.validate();
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.message,
      });
    }

    const { mappings } = req.body;

    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'No hay mapeos seleccionados',
      });
    }

    const activeMappings = mappings.filter(
      (m) => m.enabled && m.hubdbField && m.databaseField
    );

    if (activeMappings.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'No hay mapeos activos',
      });
    }

    const pool = getPool();

    // Construir lista de columnas de BD, incluyendo siempre cod_diploma
    const dbColumnsSet = new Set(
      activeMappings.map((m) => m.databaseField.name)
    );
    dbColumnsSet.add('cod_diploma'); // columna usada como clave de sincronización

    const dbColumns = Array.from(dbColumnsSet).map(
      (col) => `\`${col}\``
    );

    const query = `
      SELECT ${dbColumns.join(', ')}
      FROM (
        ${getBaseProgramaQuery()}
      ) AS programa
    `;

    console.log('🔍 Consulta de datos para sincronización:', query);

    const [rows] = await pool.query(query);

    return res.json({
      success: true,
      data: rows,
      count: rows.length,
      totalColumns: dbColumns.length,
      table: databaseConfig.table,
    });
  } catch (error) {
    console.error('Error al obtener datos para sincronización:', error.message);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        'Error al obtener los datos de la base de datos para sincronización',
      details: error.code,
    });
  }
};

