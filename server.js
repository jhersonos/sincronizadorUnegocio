import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import apiRoutes from './src/routes/api.js';
import { printEnvStatus } from './src/utils/envChecker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurar dotenv: cargar .env si existe (desarrollo local). En Railway/Heroku las variables vienen por process.env.
const envPath = path.join(__dirname, '.env');

if (existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('\n❌ ERROR al cargar el archivo .env:', result.error.message);
    process.exit(1);
  }
  console.log('✅ Archivo .env encontrado y cargado');
} else {
  console.log('ℹ️  No hay archivo .env; usando variables de entorno del sistema (ej. Railway, Heroku).');
}

// Mostrar estado de las variables de entorno
printEnvStatus();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares (límite body razonable para APIs; sync HubDB→BD obtiene filas en servidor)
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'src', 'public')));

// Rutas API
app.use('/api', apiRoutes);

// Health check (para Railway y monitoreo)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'sincronizador-unegocio' });
});

// Ruta principal (dashboard de sincronización)
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'src', 'public', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error al enviar index.html:', err.message);
      res.status(500).send(`Error: no se encontró el dashboard. Ruta buscada: ${indexPath}`);
    }
  });
});

// Vista de solo lectura de programas/diplomados
app.get('/programa', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'programa.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Dashboard disponible en http://localhost:${PORT}`);
});

