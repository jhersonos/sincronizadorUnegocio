import axios from 'axios';
import { hubdbConfig } from '../config/hubdb.js';
import mysql from 'mysql2/promise';
import { databaseConfig } from '../config/database.js';
import { getBaseProgramaQuery } from './databaseController.js';

// Pool de conexión para MySQL (reutilizable)
let pool;

const getPool = () => {
  if (!pool) {
    pool = mysql.createPool(databaseConfig.getConnectionConfig());
  }
  return pool;
};

// Helpers para construir hs_path y rutas, replicando la lógica de unegocio-cebra
const generateTitlePath = (programa, codDiploma) => {
  // Solo queremos usar el título (programa) como hs_path,
  // sin concatenar el código del diploma.
  if (programa) {
    return String(programa).trim().replace(/ /g, '-');
  }

  // Fallback: si no hay programa, usar el código sin puntos
  if (codDiploma) {
    return String(codDiploma).replace(/\./g, '-');
  }

  return '';
};

const generateRutas = (codDiploma, titlePath) => {
  const cod = String(codDiploma || '').trim();

  return {
    ruta_de_pagina_completa: `https://web.unegocios.uchile.cl/${titlePath}`,
    ruta_de_pagina_informacion: `https://web.unegocios.uchile.cl/solo-informacion-${cod}`,
    ruta_de_pagina_postulacion: `https://web.unegocios.uchile.cl/postulacion-${cod}`,
  };
};

// Opciones de área de conocimiento (tomadas de data.json de unegocio-cebra)
// Se usan para convertir el texto de BD en el MAP que espera HubDB.
const AREA_CONOCIMIENTO_OPTIONS = [
  { id: '1', name: 'Estrategia y Gestión de Negocios' },
  { id: '2', name: 'Marketing y Ventas' },
  { id: '3', name: 'Finanzas e Inversiones' },
  { id: '4', name: 'Innovación y Emprendimiento' },
  { id: '5', name: 'Operaciones y Logistica' },
  { id: '6', name: 'Personas y Equipos' },
  { id: '7', name: 'Gestión de Instituciones de Salud' },
  { id: '8', name: 'Operaciones y Logística' },
  { id: '9', name: 'Estrategia y Gestión' },
  { id: '10', name: 'Dirección de Personas y Equipos' },
  { id: '11', name: 'Finanzas' },
  { id: '12', name: 'Innovación, Emprendimiento y Tecnología' },
];

// Opciones de modalidad_programa (desde configuración de HubDB / data.json)
// Importante: los IDs deben corresponder a los IDs reales de las opciones
// en la columna "modalidad_programa" de la tabla HubDB.
const MODALIDAD_PROGRAMA_OPTIONS = [
  { id: '2', name: 'Virtual',     label: 'Virtual con docente en vivo' },
  { id: '3', name: 'Presencial',  label: 'Presencial' },
  { id: '4', name: 'Mixto',       label: 'Mixto' },
  { id: '5', name: 'NA',          label: 'NA' },
  { id: '7', name: 'B-Learning',  label: 'B-Learning' },
  { id: '8', name: 'Sence',       label: 'Sence' },
];

// Opciones de tipo_programa (desde data.json)
const TIPO_PROGRAMA_OPTIONS = [
  { id: '6', name: 'Cursos',    label: 'Cursos' },
  { id: '7', name: 'Diplomas',  label: 'Diplomas' },
  { id: '8', name: 'Talleres',  label: 'Talleres' },
  { id: '9', name: 'Programas', label: 'Programas' },
];

// Opciones de nivel (desde data.json)
const NIVEL_OPTIONS = [
  { id: '1', name: 'Inicial',    label: 'Inicial' },
  { id: '2', name: 'Avanzado',   label: 'Avanzado' },
  { id: '3', name: 'Intermedio', label: 'Intermedio' },
  { id: '4', name: 'Experto',    label: 'Experto' },
];

const mapAreaConocimientoToOption = (rawValue) => {
  if (!rawValue) return null;

  const normalized = String(rawValue)
    .replace(/[\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const match = AREA_CONOCIMIENTO_OPTIONS.find((opt) => {
    const optNorm = opt.name.toLowerCase();
    return optNorm === normalized;
  });

  if (!match) {
    return null;
  }

  return {
    id: match.id,
    name: match.name,
    type: 'option',
  };
};

const normalizeString = (value) =>
  String(value || '')
    .replace(/[\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const mapModalidadProgramaToOption = (rawValue) => {
  if (!rawValue) return null;

  const normalized = normalizeString(rawValue);

  const match = MODALIDAD_PROGRAMA_OPTIONS.find((opt) => {
    return (
      opt.name.toLowerCase() === normalized ||
      (opt.label && opt.label.toLowerCase() === normalized)
    );
  });

  if (!match) return null;

  return {
    id: match.id,
    name: match.name,
    label: match.label,
    type: 'option',
  };
};

const mapTipoProgramaToOption = (rawValue) => {
  if (!rawValue) return null;

  const normalized = normalizeString(rawValue);

  const match = TIPO_PROGRAMA_OPTIONS.find((opt) => {
    return (
      opt.name.toLowerCase() === normalized ||
      (opt.label && opt.label.toLowerCase() === normalized)
    );
  });

  if (!match) return null;

  return {
    id: match.id,
    name: match.name,
    label: match.label,
    type: 'option',
  };
};

const mapNivelToOption = (rawValue) => {
  if (!rawValue) return null;

  const normalized = normalizeString(rawValue);

  const match = NIVEL_OPTIONS.find((opt) => {
    return (
      opt.name.toLowerCase() === normalized ||
      (opt.label && opt.label.toLowerCase() === normalized)
    );
  });

  if (!match) return null;

  return {
    id: match.id,
    name: match.name,
    label: match.label,
    type: 'option',
  };
};

// Helper para convertir fechas de MySQL a timestamp numérico (ms desde epoch),
// que es lo que espera HubDB para campos de fecha definidos como numéricos.
const toUnixTimestamp = (value) => {
  if (!value) return null;

  // Si ya es número, lo dejamos tal cual
  if (typeof value === 'number') {
    return value;
  }

  // MySQL suele devolver Date o string 'YYYY-MM-DD'
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();

  return Number.isNaN(time) ? null : time;
};

/**
 * Obtiene los campos de una tabla de HubDB
 * @returns {Promise<Array>} Array de campos de la tabla
 */
export const getHubDBFields = async (req, res) => {
  try {
    // Validar configuración
    try {
      hubdbConfig.validate();
    } catch (validationError) {
      // Error de validación - mostrar información detallada
      console.error('Error de validación:', validationError.message);
      console.error('Variables de entorno actuales:');
      console.error(`  HUBSPOT_API_TOKEN: ${process.env.HUBSPOT_API_TOKEN ? 'definida' : 'NO definida'}`);
      console.error(`  HUBSPOT_PORTAL_ID: ${process.env.HUBSPOT_PORTAL_ID ? 'definida' : 'NO definida'}`);
      console.error(`  HUBDB_TABLE_ID: ${process.env.HUBDB_TABLE_ID ? 'definida' : 'NO definida'}`);
      
      return res.status(400).json({
        success: false,
        error: validationError.message,
        hint: 'Ejecuta "npm run debug-env" para diagnosticar el problema'
      });
    }
    
    const url = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${hubdbConfig.tableId}`;
    
    console.log(`🔗 Consultando HubDB: ${url}`);
    
    const response = await axios.get(url, {
      headers: hubdbConfig.getHeaders()
    });
    
    // Extraer los campos de la tabla
    const fields = response.data.columns || [];
    
    // Formatear los campos para el frontend
    const formattedFields = fields.map(field => ({
      id: field.id,
      name: field.name,
      label: field.label || field.name,
      type: field.type,
      required: field.required || false
    }));
    
    res.json({
      success: true,
      data: formattedFields,
      count: formattedFields.length
    });
    
  } catch (error) {
    console.error('Error al obtener campos de HubDB:', error.message);
    
    // Manejo de errores específicos
    if (error.response) {
      res.status(error.response.status).json({
        success: false,
        error: error.response.data?.message || 'Error al conectar con HubDB',
        details: error.response.data
      });
    } else if (error.request) {
      res.status(503).json({
        success: false,
        error: 'No se pudo conectar con la API de HubSpot'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor'
      });
    }
  }
};

/**
 * Obtiene información de la tabla de HubDB
 */
export const getHubDBTableInfo = async (req, res) => {
  try {
    try {
      hubdbConfig.validate();
    } catch (validationError) {
      console.error('Error de validación:', validationError.message);
      return res.status(400).json({
        success: false,
        error: validationError.message,
        hint: 'Ejecuta "npm run debug-env" para diagnosticar el problema'
      });
    }
    
    const url = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${hubdbConfig.tableId}`;
    
    const response = await axios.get(url, {
      headers: hubdbConfig.getHeaders()
    });
    
    res.json({
      success: true,
      data: {
        id: response.data.id,
        name: response.data.name,
        label: response.data.label,
        columnsCount: response.data.columns?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Error al obtener información de la tabla:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        success: false,
        error: error.response.data?.message || 'Error al conectar con HubDB'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor'
      });
    }
  }
};

/**
 * Sincroniza HubDB usando como clave cod_diploma (en BD y HubDB)
 * Recibe:
 *  - mappings: [{ hubdbField: {name}, databaseField: {name} }]
 *  - codDiplomaList: [ 'CPD.26.1.B1', 'CPD.26.2.B1', ... ]
 */
export const syncHubDB = async (req, res) => {
  try {
    // Validar configuración de HubDB
    try {
      hubdbConfig.validate();
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.message,
      });
    }

    // Validar configuración de base de datos
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

    if (
      !codDiplomaList ||
      !Array.isArray(codDiplomaList) ||
      codDiplomaList.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: 'No se recibió ninguna lista de códigos de diploma para sincronizar',
      });
    }

    const activeMappings = mappings.filter(
      (m) => m.enabled && m.hubdbField && m.databaseField
    );

    if (activeMappings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay mapeos activos para sincronizar',
      });
    }

    const pool = getPool();

    // 1) Obtener los datos de BD para los cod_diploma seleccionados
    // Usamos la misma query base de programa que en databaseController,
    // para asegurar que las columnas disponibles sean consistentes.
    const dbColumnsSet = new Set(
      activeMappings.map((m) => m.databaseField.name)
    );
    // Siempre necesitamos cod_diploma para la clave
    dbColumnsSet.add('cod_diploma');
    // Y programa para poder construir hs_path y las rutas de página
    dbColumnsSet.add('programa');

    const dbColumns = Array.from(dbColumnsSet).map(
      (col) => `\`${col}\``
    );

    const placeholders = codDiplomaList.map(() => '?').join(', ');
    const query = `
      SELECT ${dbColumns.join(', ')}
      FROM (
        ${getBaseProgramaQuery()}
      ) AS programa
      WHERE cod_diploma IN (${placeholders})
    `;

    console.log('🔄 Consulta de datos para sincronización HubDB:', query);

    const [dbRows] = await pool.query(query, codDiplomaList);

    const dbByCodDiploma = {};
    dbRows.forEach((row) => {
      const key =
        row.cod_diploma ??
        row.COD_DIPLOMA ??
        row.codDiploma ??
        String(row.cod_diploma || '');
      if (key !== undefined && key !== null && key !== '') {
        dbByCodDiploma[String(key)] = row;
      }
    });

    // 2) Obtener todas las filas de HubDB para poder hacer match por cod_diploma
    const hubdbUrl = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${hubdbConfig.tableId}/rows`;

    const hubdbResponse = await axios.get(hubdbUrl, {
      headers: hubdbConfig.getHeaders(),
      params: {
        limit: 10000, // suficiente para la mayoría de casos
      },
    });

    const hubdbRows = hubdbResponse.data.results || [];

    const hubdbByCodDiploma = {};
    hubdbRows.forEach((row) => {
      // En v3, los valores de columnas vienen en "values"
      const values = row.values || {};
      const codDiploma =
        values.cod_diploma ??
        values.COD_DIPLOMA ??
        values.codDiploma;

      if (codDiploma !== undefined && codDiploma !== null && codDiploma !== '') {
        hubdbByCodDiploma[String(codDiploma)] = row;
      }
    });

    // 3) Para cada cod_diploma, buscar la fila en HubDB por cod_diploma
    let updatedCount = 0;
    let notFoundCount = 0;
    const errors = [];

    for (const codDiploma of codDiplomaList) {
      const dbRow = dbByCodDiploma[String(codDiploma)];

      if (!dbRow) {
        notFoundCount += 1;
        continue;
      }

      const hubdbRow = hubdbByCodDiploma[String(codDiploma)];

      if (!hubdbRow) {
        notFoundCount += 1;
        continue;
      }

      // Construir el payload de actualización para HubDB
      const valuesToUpdate = {};
      activeMappings.forEach((m) => {
        const hubdbFieldName = m.hubdbField.name;
        const dbFieldName = m.databaseField.name;
        const rawValue = dbRow[dbFieldName];

        // Campos de fecha en HubDB están definidos como numéricos (timestamp)
        if (hubdbFieldName === 'fecha_inicio' || hubdbFieldName === 'fecha_termino') {
          valuesToUpdate[hubdbFieldName] = toUnixTimestamp(rawValue);
          return;
        }

        // area_conocimiento es un SELECT que espera un MAP (option),
        // no un string plano. Lo convertimos usando el catálogo conocido.
        if (hubdbFieldName === 'area_conocimiento') {
          const optionMap = mapAreaConocimientoToOption(rawValue);
          if (optionMap) {
            valuesToUpdate[hubdbFieldName] = optionMap;
          }
          // Si no hay match, no enviamos nada para no romper la fila.
          return;
        }

        // modalidad_programa también es un SELECT que espera MAP
        if (hubdbFieldName === 'modalidad_programa') {
          const optionMap = mapModalidadProgramaToOption(rawValue);
          if (optionMap) {
            valuesToUpdate[hubdbFieldName] = optionMap;
          }
          return;
        }

        // tipo_programa (SELECT → MAP)
        if (hubdbFieldName === 'tipo_programa') {
          const optionMap = mapTipoProgramaToOption(rawValue);
          if (optionMap) {
            valuesToUpdate[hubdbFieldName] = optionMap;
          }
          return;
        }

        // nivel (SELECT → MAP)
        if (hubdbFieldName === 'nivel') {
          const optionMap = mapNivelToOption(rawValue);
          if (optionMap) {
            valuesToUpdate[hubdbFieldName] = optionMap;
          }
          return;
        }

        // Para el campo "programa" (texto), nos aseguramos de enviar siempre
        // el valor proveniente de la vista de programa (alias de DIPLOMADO),
        // evitando inconsistencias de mapeo.
        if (hubdbFieldName === 'programa') {
          valuesToUpdate[hubdbFieldName] = dbRow.programa ?? rawValue;
          return;
        }

        // Resto de campos, se envían tal cual
        valuesToUpdate[hubdbFieldName] = rawValue;
      });

      // hs_path y rutas completas se calculan a partir de programa y cod_diploma,
      // siguiendo la lógica del servicio unegocio-cebra.
      const programa = dbRow.programa;
      const titlePath = generateTitlePath(programa, codDiploma);
      const rutas = generateRutas(codDiploma, titlePath);

      try {
        // Según la documentación de HubDB v3, las actualizaciones se hacen sobre la versión draft
        // usando el endpoint /rows/{rowId}/draft
        const updateUrl = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${hubdbConfig.tableId}/rows/${hubdbRow.id}/draft`;

        // Para evitar problemas con campos "required" en el esquema de la API,
        // enviamos también los metadatos básicos actuales de la fila.
        // Además, actualizamos hs_path (path) y las rutas de página.
        const payload = {
          childTableId: hubdbRow.childTableId,
          displayIndex: hubdbRow.displayIndex,
          name: hubdbRow.name,
          path: titlePath || hubdbRow.path,
          values: {
            ...valuesToUpdate,
            ...rutas,
          },
        };

        await axios.patch(updateUrl, payload, {
          headers: hubdbConfig.getHeaders(),
        });

        updatedCount += 1;
      } catch (err) {
        // Log detallado del error de HubSpot
        console.error(
          `Error al actualizar fila HubDB para cod_diploma=${codDiploma}:`,
          err.message
        );
        if (err.response) {
          console.error('Estado HubSpot:', err.response.status);
          console.error('Respuesta HubSpot:', JSON.stringify(err.response.data, null, 2));
        }

        errors.push({
          codDiploma,
          message: err.message,
          status: err.response?.status,
          hubspot: err.response?.data,
        });
      }
    }

    return res.json({
      success: true,
      updatedCount,
      notFoundCount,
      errors,
      totalRequested: codDiplomaList.length,
    });
  } catch (error) {
    console.error('Error general en sincronización de HubDB:', error.message);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        'Error interno durante la sincronización de datos con HubDB',
    });
  }
};

