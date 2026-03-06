/**
 * Script de verificación de variables de entorno
 * Ejecutar: node check-env.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { printEnvStatus, checkEnvVars } from './src/utils/envChecker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verificando configuración de variables de entorno...\n');

const envPath = path.join(__dirname, '.env');

// Verificar si existe el archivo
if (!existsSync(envPath)) {
  console.error('❌ No se encontró el archivo .env');
  console.error(`   Ruta esperada: ${envPath}\n`);
  console.log('💡 Para crear el archivo .env:');
  console.log('   1. Copia env.example a .env: cp env.example .env');
  console.log('   2. Edita .env con tus credenciales\n');
  process.exit(1);
}

console.log(`✅ Archivo .env encontrado en: ${envPath}\n`);

// Cargar variables
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error al cargar .env:');
  console.error(`   ${result.error.message}\n`);
  process.exit(1);
}

// Mostrar estado
printEnvStatus();

// Verificar formato del archivo
console.log('📄 Verificando formato del archivo .env...');
const fs = await import('fs');
const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

console.log(`   Líneas con contenido: ${lines.length}`);

// Verificar que no haya espacios en los nombres de variables
const invalidLines = lines.filter(line => {
  const trimmed = line.trim();
  if (!trimmed.includes('=')) return true;
  const [key] = trimmed.split('=');
  return key.includes(' ') || key !== key.trim();
});

if (invalidLines.length > 0) {
  console.warn('\n⚠️  Advertencia: Líneas con formato incorrecto:');
  invalidLines.forEach((line, idx) => {
    console.warn(`   ${idx + 1}. ${line.substring(0, 50)}...`);
  });
  console.warn('\n   💡 Asegúrate de que no haya espacios alrededor del signo =');
  console.warn('   💡 Formato correcto: VARIABLE=valor\n');
}

// Verificar estado final
const status = checkEnvVars();
if (!status.hubspot.valid) {
  console.error('❌ Configuración incompleta. Por favor, completa las variables faltantes.\n');
  process.exit(1);
} else {
  console.log('✅ Todas las variables de HubSpot están configuradas correctamente!\n');
}

