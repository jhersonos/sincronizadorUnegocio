/**
 * Servicio para obtener filas de HubDB (draft).
 * Usado por la API GET /hubdb/rows y por sync-from-hubdb sin duplicar lógica
 * ni enviar payloads grandes desde el cliente.
 */
import axios from 'axios';
import { hubdbConfig } from '../config/hubdb.js';
import mysql from 'mysql2/promise';
import { databaseConfig } from '../config/database.js';

let pool;
const getPool = () => {
  if (!pool) {
    pool = mysql.createPool(databaseConfig.getConnectionConfig());
  }
  return pool;
};

// Helper: obtiene el ID de tabla efectivo (desde BD o config/env)
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

/**
 * Obtiene todas las filas de la tabla HubDB (versión draft).
 * @returns {Promise<Array>} Filas con id, path, name y values aplanados
 * @throws Si la configuración es inválida o la petición falla
 */
export async function getHubDBRowsData() {
  hubdbConfig.validate();
  const effectiveTableId = await getEffectiveHubdbTableId();
  const url = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${effectiveTableId}/rows/draft`;
  const response = await axios.get(url, {
    headers: hubdbConfig.getHeaders(),
    params: { limit: 10000 },
  });
  const results = response.data.results || [];
  return results.map((row) => ({
    id: row.id,
    path: row.path,
    name: row.name,
    ...(row.values || {}),
  }));
}
