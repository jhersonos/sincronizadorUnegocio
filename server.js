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

// Configurar dotenv - buscar .env en la raíz del proyecto
const envPath = path.join(__dirname, '.env');

// Verificar si el archivo .env existe
if (!existsSync(envPath)) {
  console.error('\n❌ ERROR: No se encontró el archivo .env');
  console.error(`   Buscado en: ${envPath}`);
  console.error('   💡 Crea un archivo .env en la raíz del proyecto');
  console.error('   💡 Puedes copiar env.example como referencia: cp env.example .env\n');
  process.exit(1);
}

// Cargar variables de entorno
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('\n❌ ERROR al cargar el archivo .env:');
  console.error(`   ${result.error.message}\n`);
  process.exit(1);
}

console.log('✅ Archivo .env encontrado y cargado');

// Mostrar estado de las variables de entorno
printEnvStatus();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'src', 'public')));

// Rutas API
app.use('/api', apiRoutes);

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Dashboard disponible en http://localhost:${PORT}`);
});

