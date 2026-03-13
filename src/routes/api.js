import express from 'express';
import { getHubDBFields, getHubDBTableInfo, getHubDBRows, syncHubDB, getHubDBDirectorTableInfo, getHubDBDirectorFields, getHubDBDirectorRows, syncDirectorToHubDB } from '../controllers/hubdbController.js';
import { getDatabaseFields, getPreviewData, getSyncData, syncFromHubDB, getSyncConfig, updateSyncConfig, getDirectorDbFields, getDirectorSyncData } from '../controllers/databaseController.js';
import { listProgramas } from '../controllers/programaController.js';

const router = express.Router();

// Ruta para obtener los campos de HubDB
router.get('/hubdb/fields', getHubDBFields);

// Ruta para obtener información de la tabla de HubDB
router.get('/hubdb/table-info', getHubDBTableInfo);

// Ruta para obtener filas de HubDB (draft) — vista HubDB → BD
router.get('/hubdb/rows', getHubDBRows);

// Ruta para obtener los campos de la base de datos MySQL
router.get('/db/fields', getDatabaseFields);

// Ruta para listar programas/diplomados (vista /programa)
router.get('/db/programas', listProgramas);

// Ruta para obtener vista previa de datos basada en mapeos
router.post('/db/preview', getPreviewData);

// Ruta para obtener todos los registros necesarios para sincronización
router.post('/db/sync-data', getSyncData);

// Configuración de sincronización (ID tabla HubDB)
router.get('/config', getSyncConfig);
router.post('/config', updateSyncConfig);

// Ruta para iniciar la sincronización con HubDB
router.post('/hubdb/sync', syncHubDB);

// Ruta para sincronizar desde HubDB hacia la BD
router.post('/db/sync-from-hubdb', syncFromHubDB);

// Rutas para la tabla HubDB de directores/académicos
router.get('/hubdb/director/table-info', getHubDBDirectorTableInfo);
router.get('/hubdb/director/fields', getHubDBDirectorFields);
router.get('/hubdb/director/rows', getHubDBDirectorRows);

// Rutas para sincronización de directores/académicos
router.get('/db/director/fields', getDirectorDbFields);
router.post('/db/director/sync-data', getDirectorSyncData);
router.post('/hubdb/director/sync', syncDirectorToHubDB);

export default router;

