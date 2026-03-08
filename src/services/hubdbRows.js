/**
 * Servicio para obtener filas de HubDB (draft).
 * Usado por la API GET /hubdb/rows y por sync-from-hubdb sin duplicar lógica
 * ni enviar payloads grandes desde el cliente.
 */
import axios from 'axios';
import { hubdbConfig } from '../config/hubdb.js';

/**
 * Obtiene todas las filas de la tabla HubDB (versión draft).
 * @returns {Promise<Array>} Filas con id, path, name y values aplanados
 * @throws Si la configuración es inválida o la petición falla
 */
export async function getHubDBRowsData() {
  hubdbConfig.validate();
  const url = `${hubdbConfig.baseUrl}/cms/v3/hubdb/tables/${hubdbConfig.tableId}/rows/draft`;
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
