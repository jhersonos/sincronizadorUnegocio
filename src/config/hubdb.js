/**
 * Configuración de HubDB
 * Gestiona la conexión y configuración con HubSpot HubDB
 * 
 * NOTA: Usa getters para leer las variables en tiempo de ejecución,
 * no en tiempo de importación, para asegurar que dotenv ya las haya cargado
 */

export const hubdbConfig = {
  get apiToken() {
    return process.env.HUBSPOT_API_TOKEN?.trim() || null;
  },
  
  get portalId() {
    return process.env.HUBSPOT_PORTAL_ID?.trim() || null;
  },
  
  get tableId() {
    return process.env.HUBDB_TABLE_ID?.trim() || null;
  },
  
  get directorTableId() {
    return process.env.HUBDB_DIRECTOR_ID?.trim() || null;
  },
  
  baseUrl: 'https://api.hubapi.com',
  
  /**
   * Valida que la configuración esté completa
   */
  validate() {
    const missing = [];
    
    if (!this.apiToken) missing.push('HUBSPOT_API_TOKEN');
    if (!this.portalId) missing.push('HUBSPOT_PORTAL_ID');
    if (!this.tableId) missing.push('HUBDB_TABLE_ID');
    
    if (missing.length > 0) {
      throw new Error(
        `Configuración incompleta. Faltan las siguientes variables de entorno: ${missing.join(', ')}`
      );
    }
    
    return true;
  },
  
  /**
   * Obtiene los headers para las peticiones a la API
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiToken}`
    };
  }
};

