import mysql from 'mysql2/promise';
import { databaseConfig } from '../config/database.js';
import { getHubDBRowsData } from '../services/hubdbRows.js';

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

// Mapeo: nombre lógico de columna (vista programa) → { table, column } para UPDATE HubDB → BD
// "name" / "hs_name" de HubDB no existe en MySQL; se escribe en DIPLOMADO (programa).
const DB_FIELD_TO_TABLE_COLUMN = {
  cod_diploma: { table: 'diplomados', column: 'cod_diploma' },
  programa: { table: 'diplomados', column: 'DIPLOMADO' },
  name: { table: 'diplomados', column: 'DIPLOMADO' },
  hs_name: { table: 'diplomados', column: 'DIPLOMADO' },
  fecha_inicio: { table: 'diplomados', column: 'fecha_inicio' },
  fecha_termino: { table: 'diplomados', column: 'fecha_termino' },
  valor_diplomado: { table: 'diplomados', column: 'valor_diplomado' },
  moneda: { table: 'diplomados', column: 'moneda' },
  area_conocimiento: { table: 'diplomados', column: 'area_conocimiento' },
  horario_web: { table: 'diplomados', column: 'horario_web' },
  lnk_pdf: { table: 'diplomados', column: 'lnk_pdf' },
  modalidad_programa: { table: 'diplomados', column: 'modalidad_programa' },
  tipo_programa: { table: 'diplomados', column: 'tipo_programa' },
  nivel: { table: 'diplomados', column: 'nivel' },
  ceco: { table: 'diplomados', column: 'Cod_interno' },
  descripcion: { table: 'diplomas_descripcion', column: 'descripcion' },
  objetivos: { table: 'diplomas_descripcion', column: 'objetivos' },
  consideraciones: { table: 'diplomas_descripcion', column: 'consideraciones' },
  imagen_destacada: { table: 'diplomas_descripcion', column: 'imagen_destacada' },
  icono: { table: 'diplomas_descripcion', column: 'icono' },
  carrito: { table: 'diplomas_descripcion', column: 'carrito' },
};

// Columnas permitidas en UPDATE (según DESCRIBE). Solo estas se envían a MySQL.
// "name" y "path" son de HubDB (hs_name, hs_path) y NO existen en diplomados/diplomas_descripcion.
const ALLOWED_DIPLOMADOS_COLUMNS = [
  'cod_diploma', 'DIPLOMADO', 'fecha_inicio', 'fecha_termino', 'valor_diplomado',
  'moneda', 'area_conocimiento', 'horario_web', 'lnk_pdf', 'modalidad_programa',
  'tipo_programa', 'nivel', 'Cod_interno',
];
const ALLOWED_DIPLOMAS_DESCRIPCION_COLUMNS = [
  'descripcion', 'objetivos', 'consideraciones', 'imagen_destacada', 'icono', 'carrito',
];
// Nunca enviar estas a MySQL (solo existen en HubDB).
const BLOCKLIST_COLUMNS = new Set(['name', 'path', 'id', 'hs_name', 'hs_path', 'hs_id', 'Name', 'Path', 'Id']);

// Campos de HubDB que son de tipo opción (MAP) y que en la BD se almacenan como texto.
const HUBDB_OPTION_FIELDS = new Set([
  'area_conocimiento',
  'modalidad_programa',
  'tipo_programa',
  'nivel',
]);

/**
 * Normaliza un valor proveniente de HubDB para guardarlo en MySQL.
 * - Convierte opciones MAP ({ id, name, label, ... }) a su nombre/label.
 * - Convierte arrays de opciones a lista separada por comas (nombres).
 * - Convierte timestamps numéricos de fecha a 'YYYY-MM-DD' cuando aplica.
 * - Evita pasar objetos crudos al driver de MySQL (que provocarían
 *   expansión en múltiples columnas como `id` = ..., `name` = ..., etc.).
 */
function normalizeHubdbValueForDb(fieldName, value) {
  if (value === null || value === undefined) return value;

  // Fechas: HubDB suele entregar timestamps numéricos.
  if ((fieldName === 'fecha_inicio' || fieldName === 'fecha_termino') && typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    }
    return null;
  }

  // Campos de tipo opción MAP: guardamos el name/label en la BD (VARCHAR).
  if (HUBDB_OPTION_FIELDS.has(fieldName)) {
    if (Array.isArray(value)) {
      const names = value
        .map((v) => {
          if (v && typeof v === 'object') return v.name ?? v.label ?? null;
          if (v === null || v === undefined) return null;
          return String(v);
        })
        .filter((v) => v && String(v).trim() !== '');
      return names.length > 0 ? names.join(', ') : null;
    }
    if (value && typeof value === 'object') {
      return value.name ?? value.label ?? null;
    }
  }

  // Cualquier otro objeto: serializar a JSON como último recurso.
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return null;
    }
  }

  return value;
}

/**
 * Sincroniza desde HubDB hacia la BD.
 * Recibe: mappings, codDiplomaList. Las filas de HubDB se obtienen en servidor (óptimo para producción).
 */
export const syncFromHubDB = async (req, res) => {
  try {
    databaseConfig.validate();
  } catch (validationError) {
    return res.status(400).json({
      success: false,
      error: validationError.message,
    });
  }

  const { mappings, codDiplomaList } = req.body;

  if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No se recibieron mapeos para sincronizar',
    });
  }
  if (!codDiplomaList || !Array.isArray(codDiplomaList) || codDiplomaList.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No se recibió lista de códigos de diploma',
    });
  }

  const activeMappings = mappings.filter(
    (m) => m.enabled && m.hubdbField && m.databaseField
  );
  if (activeMappings.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No hay mapeos activos',
    });
  }

  // DEBUG: ver qué mapeos llegan (quitar en producción si molesta)
  console.log('[sync-from-hubdb] Mapeos activos:', activeMappings.length);
  activeMappings.slice(0, 5).forEach((m, i) => {
    console.log(`  [${i}] HubDB "${m.hubdbField?.name}" → BD "${m.databaseField?.name}"`);
  });

  const pool = getPool();

  let hubdbRows;
  try {
    hubdbRows = await getHubDBRowsData();
  } catch (err) {
    console.error('Error al obtener filas de HubDB en sync-from-hubdb:', err.message);
    return res.status(502).json({
      success: false,
      error: 'No se pudo obtener datos de HubDB. Revisa HUBSPOT_API_TOKEN y HUBDB_TABLE_ID.',
    });
  }

  const hubdbByCodDiploma = {};
  hubdbRows.forEach((row) => {
    const cod = row.cod_diploma ?? row.COD_DIPLOMA ?? row.codDiploma;
    if (cod != null && String(cod).trim() !== '') {
      hubdbByCodDiploma[String(cod)] = row;
    }
  });

  let updatedCount = 0;
  const errors = [];

  for (const codDiploma of codDiplomaList) {
    const hubdbRow = hubdbByCodDiploma[String(codDiploma)];
    if (!hubdbRow) continue;

    const byTable = {};
    activeMappings.forEach((m) => {
      const dbFieldName = m.databaseField?.name;
      if (!dbFieldName) return;
      const target = DB_FIELD_TO_TABLE_COLUMN[dbFieldName];
      if (!target) return;
      // Nunca usar "name"/"path"/"id" como columna en MySQL (solo existen en HubDB)
      let col = BLOCKLIST_COLUMNS.has(target.column)
        ? (target.table === 'diplomados' ? 'DIPLOMADO' : target.column)
        : target.column;
      if (col === 'name' || col === 'path' || col === 'id') {
        col = target.table === 'diplomados' ? 'DIPLOMADO' : col;
      }
      const rawHubdbValue = hubdbRow[m.hubdbField?.name];
      const hubdbValue = normalizeHubdbValueForDb(m.hubdbField?.name, rawHubdbValue);
      if (!byTable[target.table]) byTable[target.table] = {};
      byTable[target.table][col] = hubdbValue;
    });

    try {
      if (byTable.diplomados && Object.keys(byTable.diplomados).length > 0) {
        const allowed = {};
        for (const col of ALLOWED_DIPLOMADOS_COLUMNS) {
          if (byTable.diplomados[col] !== undefined && !BLOCKLIST_COLUMNS.has(col)) {
            allowed[col] = byTable.diplomados[col];
          }
        }
        // Solo columnas permitidas; nunca incluir name/path/id (no existen en MySQL)
        const keys = Object.keys(allowed).filter(
          (k) => !BLOCKLIST_COLUMNS.has(k) && k !== 'name' && k !== 'path' && k !== 'id'
        );
        if (keys.length > 0) {
          const setClause = keys.map((col) => `\`${col}\` = ?`).join(', ');
          if (updatedCount === 0) {
            console.log('[sync-from-hubdb] Primer UPDATE diplomados - byTable keys:', Object.keys(byTable.diplomados));
            console.log('[sync-from-hubdb] SET clause:', setClause);
          }
          const values = keys.map((k) => allowed[k]);
          values.push(codDiploma);
          await pool.query(
            `UPDATE diplomados SET ${setClause} WHERE cod_diploma = ?`,
            values
          );
          updatedCount += 1;
        }
      }
      if (byTable.diplomas_descripcion && Object.keys(byTable.diplomas_descripcion).length > 0) {
        const allowed = {};
        for (const col of ALLOWED_DIPLOMAS_DESCRIPCION_COLUMNS) {
          if (byTable.diplomas_descripcion[col] !== undefined && !BLOCKLIST_COLUMNS.has(col)) {
            allowed[col] = byTable.diplomas_descripcion[col];
          }
        }
        const keys = Object.keys(allowed).filter(
          (k) => !BLOCKLIST_COLUMNS.has(k) && k !== 'name' && k !== 'path' && k !== 'id'
        );
        if (keys.length > 0) {
          const setClause = keys.map((col) => `\`${col}\` = ?`).join(', ');
          if (updatedCount <= 1) {
            console.log('[sync-from-hubdb] UPDATE diplomas_descripcion - byTable keys:', Object.keys(byTable.diplomas_descripcion));
            console.log('[sync-from-hubdb] SET clause:', setClause);
          }
          const values = keys.map((k) => allowed[k]);
          values.push(codDiploma);
          await pool.query(
            `UPDATE diplomas_descripcion SET ${setClause} WHERE cod_diploma = ?`,
            values
          );
        }
      }
    } catch (err) {
      console.error(`Error al actualizar BD para cod_diploma=${codDiploma}:`, err.message);
      if (err && err.sql) {
        console.error('SQL que falló:', err.sql);
      }
      errors.push({ codDiploma, message: err.message });
    }
  }

  return res.json({
    success: true,
    updatedCount,
    errors,
    totalRequested: codDiplomaList.length,
  });
};

