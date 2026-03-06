/**
 * Configuración de Base de Datos MySQL
 * Gestiona la conexión y configuración con MySQL.
 *
 * IMPORTANTE:
 * Usamos getters para leer las variables de entorno en tiempo de ejecución
 * (después de que dotenv haya cargado .env) y evitar quedarnos con valores
 * undefined del momento de la importación del módulo.
 */

export const databaseConfig = {
  get host() {
    return process.env.MYSQL_HOST?.trim() || 'localhost';
  },

  get port() {
    const raw = process.env.MYSQL_PORT;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? 3306 : n;
  },

  get user() {
    return process.env.MYSQL_USER?.trim() || null;
  },

  get password() {
    return process.env.MYSQL_PASSWORD?.trim() || null;
  },

  get database() {
    return process.env.MYSQL_DATABASE?.trim() || null;
  },

  get table() {
    return process.env.MYSQL_TABLE?.trim() || null;
  },
  
  /**
   * Valida que la configuración esté completa
   */
  validate() {
    const missing = [];
    
    if (!this.user) missing.push('MYSQL_USER');
    if (!this.password) missing.push('MYSQL_PASSWORD');
    if (!this.database) missing.push('MYSQL_DATABASE');
    if (!this.table) missing.push('MYSQL_TABLE');
    
    if (missing.length > 0) {
      throw new Error(
        `Configuración incompleta. Faltan las siguientes variables de entorno: ${missing.join(', ')}`
      );
    }
    
    return true;
  },
  
  /**
   * Obtiene la configuración de conexión para mysql2
   */
  getConnectionConfig() {
    return {
      host: this.host,
      port: this.port,
      user: this.user,
      password: this.password,
      database: this.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
  }
};

