import mysql from 'mysql2/promise';
import { databaseConfig } from '../config/database.js';
import { getBaseProgramaQuery } from './databaseController.js';

const getPool = (() => {
  let pool;
  return () => {
    if (!pool) {
      pool = mysql.createPool(databaseConfig.getConnectionConfig());
    }
    return pool;
  };
})();

// Lista programas/diplomados usando la misma vista base que el sincronizador.
export const listProgramas = async (req, res) => {
  try {
    try {
      databaseConfig.validate();
    } catch (validationError) {
      return res.status(400).send(`Error de configuración de BD: ${validationError.message}`);
    }

    const pool = getPool();
    const query = `
      SELECT *
      FROM (
        ${getBaseProgramaQuery()}
      ) AS programa
      ORDER BY fecha_inicio DESC, cod_diploma ASC
      LIMIT 500
    `;

    const [rows] = await pool.query(query);

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error('Error al listar programas:', err.message);
    return res.status(500).send('Error interno al listar programas');
  }
};

