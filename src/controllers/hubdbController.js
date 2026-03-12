import axios from 'axios';
import { hubdbConfig } from '../config/hubdb.js';
import { getHubDBRowsData } from '../services/hubdbRows.js';
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

// Lee el ID efectivo de tabla HubDB desde BD (tabla sync_config) o, si no existe, desde la config/env.
const getEffectiveHubdbTableId = async () => {
  const fallback = hubdbConfig.tableId;
  try {
    databaseConfig.validate();
  } catch {
    return fallback;
  }
  try {
    const p = getPool();
    const [rows] = await p.query(
      'SELECT hubdb_table_id FROM sync_config ORDER BY id DESC LIMIT 1'
    );
    if (rows && rows.length > 0 && rows[0].hubdb_table_id) {
      return rows[0].hubdb_table_id;
    }
  } catch (e) {
    // Si la tabla no existe o hay error, usar fallback
  }
  return fallback;
};

// Devuelve el ID de la tabla HubDB de directores/académicos (desde .env).
const getDirectorTableId = () => {
  const directorId = hubdbConfig.directorTableId;
  if (!directorId) {
    throw new Error(
      'HUBDB_DIRECTOR_ID no está configurado. Añade esta variable de entorno con el ID de la tabla de directores.'
    );
  }
  return directorId;
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
    
    const tableId = await getEffectiveHubdbTableId();
    const url = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${tableId}`;
    
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
 * Obtiene las filas de la tabla HubDB (versión draft)
 * Para usar en la vista HubDB → BD (cargar datos desde HubDB).
 */
export const getHubDBRows = async (req, res) => {
  try {
    const rows = await getHubDBRowsData();
    res.json({
      success: true,
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    if (error.message && error.message.includes('Configuración')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    console.error('Error al obtener filas de HubDB:', error.message);
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data?.message || 'Error al conectar con HubDB',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor',
    });
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
    
    const tableId = await getEffectiveHubdbTableId();
    const url = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${tableId}`;
    
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

    // 2) Obtener filas de HubDB (draft) para hacer match por cod_diploma.
    // Usamos /rows/draft para que las filas recién creadas por este sync también se encuentren.
    const effectiveTableId = await getEffectiveHubdbTableId();
    const hubdbUrl = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${effectiveTableId}/rows/draft`;

    const hubdbResponse = await axios.get(hubdbUrl, {
      headers: hubdbConfig.getHeaders(),
      params: {
        limit: 10000, // suficiente para la mayoría de casos
      },
    });

    const hubdbRows = hubdbResponse.data.results || [];

    const hubdbByCodDiploma = {};
    const hubdbByPath = {};
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
      // Índice por path para evitar 409 DUPLICATE_PATH: si creamos con un path que ya existe, actualizamos esa fila
      const p = row.path;
      if (p !== undefined && p !== null && String(p).trim() !== '') {
        hubdbByPath[String(p).trim()] = row;
      }
    });

    // 3) Para cada cod_diploma: actualizar fila existente en HubDB o crear una nueva si no existe
    let updatedCount = 0;
    let createdCount = 0;
    let notFoundCount = 0;
    const errors = [];

    // Helper: construye el objeto values (campos mapeados + rutas) para una fila
    const buildValuesForRow = (dbRow, codDiploma) => {
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

      // hs_path y rutas completas se calculan a partir de programa y cod_diploma
      const programa = dbRow.programa;
      const titlePath = generateTitlePath(programa, codDiploma);
      const rutas = generateRutas(codDiploma, titlePath);
      const name = programa || String(codDiploma);

      // Siempre enviar "programa" a HubDB con el valor de la BD (DIPLOMADO), aunque no esté en el mapeo
      if (programa !== undefined && programa !== null) {
        valuesToUpdate.programa = String(programa).trim();
      }

      return { valuesToUpdate, titlePath, rutas, name };
    };

    for (const codDiploma of codDiplomaList) {
      const dbRow = dbByCodDiploma[String(codDiploma)];

      if (!dbRow) {
        notFoundCount += 1;
        continue;
      }

      const hubdbRow = hubdbByCodDiploma[String(codDiploma)];
      const { valuesToUpdate, titlePath, rutas, name } = buildValuesForRow(dbRow, codDiploma);

      const reportError = (err, action) => {
        console.error(`Error al ${action} fila HubDB para cod_diploma=${codDiploma}:`, err.message);
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
      };

      if (hubdbRow) {
        // Actualizar fila existente (PATCH). name (hs_name) = mismo valor que programa.
        try {
          const updateUrl = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${effectiveTableId}/rows/${hubdbRow.id}/draft`;
          const payload = {
            childTableId: hubdbRow.childTableId,
            displayIndex: hubdbRow.displayIndex,
            name: name,
            path: titlePath || hubdbRow.path,
            values: { ...valuesToUpdate, ...rutas },
          };
          await axios.patch(updateUrl, payload, { headers: hubdbConfig.getHeaders() });
          updatedCount += 1;
        } catch (err) {
          reportError(err, 'actualizar');
        }
      } else {
        // No hay fila con este cod_diploma. Comprobar si ya existe una fila con el mismo path (evitar 409 DUPLICATE_PATH)
        const existingByPath = titlePath ? hubdbByPath[String(titlePath).trim()] : null;

        if (existingByPath) {
          // Actualizar la fila existente que tiene ese path (así no intentamos crear duplicado)
          try {
            const updateUrl = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${effectiveTableId}/rows/${existingByPath.id}/draft`;
            const payload = {
              childTableId: existingByPath.childTableId ?? 0,
              displayIndex: existingByPath.displayIndex ?? 0,
              name,
              path: titlePath || existingByPath.path,
              values: {
                cod_diploma: codDiploma,
                ...valuesToUpdate,
                ...rutas,
              },
            };
            await axios.patch(updateUrl, payload, { headers: hubdbConfig.getHeaders() });
            updatedCount += 1;
          } catch (err) {
            reportError(err, 'actualizar por path');
          }
        } else {
          // Crear nueva fila en HubDB (POST)
          try {
            const createUrl = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${effectiveTableId}/rows`;
            const payload = {
              path: titlePath || String(codDiploma).replace(/\./g, '-'),
              name,
              childTableId: 0,
              displayIndex: 0,
              values: {
                cod_diploma: codDiploma,
                ...valuesToUpdate,
                ...rutas,
              },
            };
            await axios.post(createUrl, payload, { headers: hubdbConfig.getHeaders() });
            createdCount += 1;
          } catch (err) {
            // Si HubDB devuelve 409 DUPLICATE_PATH, recuperar: actualizar la fila indicada en el error
            const is409Path = err.response?.status === 409 &&
              err.response?.data?.subCategory === 'TableRowValidationError.DUPLICATE_PATH';
            const rowId = err.response?.data?.context?.row_id?.[0];

            if (is409Path && rowId) {
              try {
                const rowIdStr = String(rowId);
                const existingRow = hubdbRows.find((r) => String(r.id) === rowIdStr);
                const updateUrl = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${effectiveTableId}/rows/${rowIdStr}/draft`;
                const patchPayload = {
                  childTableId: existingRow?.childTableId ?? 0,
                  displayIndex: existingRow?.displayIndex ?? 0,
                  name,
                  path: titlePath || existingRow?.path || String(codDiploma).replace(/\./g, '-'),
                  values: {
                    cod_diploma: codDiploma,
                    ...valuesToUpdate,
                    ...rutas,
                  },
                };
                await axios.patch(updateUrl, patchPayload, { headers: hubdbConfig.getHeaders() });
                updatedCount += 1;
              } catch (patchErr) {
                reportError(patchErr, 'actualizar tras 409');
              }
            } else {
              reportError(err, 'crear');
            }
          }
        }
      }
    }

    // Publicar la tabla (draft → live) para que los cambios y filas nuevas queden visibles
    let published = false;
    if (updatedCount > 0 || createdCount > 0) {
      try {
        const publishUrl = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${effectiveTableId}/draft/publish`;
        await axios.post(publishUrl, {}, { headers: hubdbConfig.getHeaders() });
        published = true;
      } catch (publishErr) {
        console.error('Error al publicar tabla HubDB (draft → live):', publishErr.message);
        if (publishErr.response) {
          console.error('Estado:', publishErr.response.status, JSON.stringify(publishErr.response.data, null, 2));
        }
        errors.push({
          codDiploma: null,
          message: `Publicación de tabla: ${publishErr.message}`,
          status: publishErr.response?.status,
          hubspot: publishErr.response?.data,
        });
      }
    }

    return res.json({
      success: true,
      updatedCount,
      createdCount,
      notFoundCount,
      published,
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

/**
 * Controladores específicos para la tabla HubDB de directores/académicos
 */

export const getHubDBDirectorTableInfo = async (req, res) => {
  try {
    const apiToken = hubdbConfig.apiToken;
    if (!apiToken) {
      return res.status(400).json({
        success: false,
        error: 'HUBSPOT_API_TOKEN no está configurado',
      });
    }

    const tableId = getDirectorTableId();
    const url = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${tableId}`;

    const response = await axios.get(url, {
      headers: hubdbConfig.getHeaders(),
    });

    res.json({
      success: true,
      data: {
        id: response.data.id,
        name: response.data.name,
        label: response.data.label,
        columnsCount: response.data.columns?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error al obtener información de la tabla de directores:', error.message);
    if (error.response) {
      res.status(error.response.status).json({
        success: false,
        error: error.response.data?.message || 'Error al conectar con HubDB',
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor',
      });
    }
  }
};

export const getHubDBDirectorFields = async (req, res) => {
  try {
    const apiToken = hubdbConfig.apiToken;
    if (!apiToken) {
      return res.status(400).json({
        success: false,
        error: 'HUBSPOT_API_TOKEN no está configurado',
      });
    }

    const tableId = getDirectorTableId();
    const url = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${tableId}`;

    console.log(`🔗 Consultando HubDB directores: ${url}`);

    const response = await axios.get(url, {
      headers: hubdbConfig.getHeaders(),
    });

    const fields = response.data.columns || [];

    const formattedFields = fields.map((field) => ({
      id: field.id,
      name: field.name,
      label: field.label || field.name,
      type: field.type,
      required: field.required || false,
    }));

    res.json({
      success: true,
      data: formattedFields,
      count: formattedFields.length,
    });
  } catch (error) {
    console.error('Error al obtener campos de la tabla de directores:', error.message);
    if (error.response) {
      res.status(error.response.status).json({
        success: false,
        error: error.response.data?.message || 'Error al conectar con HubDB',
        details: error.response.data,
      });
    } else if (error.request) {
      res.status(503).json({
        success: false,
        error: 'No se pudo conectar con la API de HubSpot',
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor',
      });
    }
  }
};

export const getHubDBDirectorRows = async (req, res) => {
  try {
    const apiToken = hubdbConfig.apiToken;
    if (!apiToken) {
      return res.status(400).json({
        success: false,
        error: 'HUBSPOT_API_TOKEN no está configurado',
      });
    }

    const tableId = getDirectorTableId();
    const url = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${tableId}/rows/draft`;

    const response = await axios.get(url, {
      headers: hubdbConfig.getHeaders(),
      params: { limit: 10000 },
    });

    const results = response.data.results || [];
    const rows = results.map((row) => ({
      id: row.id,
      path: row.path,
      name: row.name,
      ...(row.values || {}),
    }));

    res.json({
      success: true,
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error('Error al obtener filas de la tabla de directores:', error.message);
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data?.message || 'Error al conectar con HubDB',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor',
    });
  }
};

