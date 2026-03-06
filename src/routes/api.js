import express from 'express';
import { getHubDBFields, getHubDBTableInfo, syncHubDB } from '../controllers/hubdbController.js';
import { getDatabaseFields, getPreviewData, getSyncData } from '../controllers/databaseController.js';

const router = express.Router();

// Ruta para obtener los campos de HubDB
router.get('/hubdb/fields', getHubDBFields);

// Ruta para obtener información de la tabla de HubDB
router.get('/hubdb/table-info', getHubDBTableInfo);

// Ruta para obtener los campos de la base de datos MySQL
router.get('/db/fields', getDatabaseFields);

// Ruta para obtener vista previa de datos basada en mapeos
router.post('/db/preview', getPreviewData);

// Ruta para obtener todos los registros necesarios para sincronización
router.post('/db/sync-data', getSyncData);

// Ruta para iniciar la sincronización con HubDB
router.post('/hubdb/sync', syncHubDB);

export default router;

