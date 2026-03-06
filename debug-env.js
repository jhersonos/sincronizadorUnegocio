/**
 * Script de diagnóstico para variables de entorno
 * Ejecutar: node debug-env.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 DIAGNÓSTICO DE VARIABLES DE ENTORNO\n');
console.log('='.repeat(60));

// 1. Verificar si existe el archivo
const envPath = path.join(__dirname, '.env');
console.log(`\n1️⃣  Verificando archivo .env:`);
console.log(`   Ruta: ${envPath}`);
console.log(`   Existe: ${existsSync(envPath) ? '✅ SÍ' : '❌ NO'}`);

if (!existsSync(envPath)) {
  console.log('\n❌ El archivo .env no existe en la ruta esperada.');
  console.log('   Crea el archivo .env en la raíz del proyecto.\n');
  process.exit(1);
}

// 2. Leer el contenido del archivo
console.log(`\n2️⃣  Contenido del archivo .env:`);
console.log('   ' + '-'.repeat(56));
try {
  const envContent = readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      // Mostrar solo el nombre de la variable, no el valor completo por seguridad
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      const displayValue = value.length > 30 
        ? value.substring(0, 30) + '...' 
        : value;
      const hasValue = value && value.trim().length > 0;
      
      console.log(`   Línea ${index + 1}: ${key}=${hasValue ? '✓' : '✗ (vacío)'}`);
      if (hasValue) {
        console.log(`              Valor: "${displayValue}" (${value.length} caracteres)`);
      }
    } else if (trimmed.startsWith('#')) {
      console.log(`   Línea ${index + 1}: ${trimmed.substring(0, 50)}...`);
    }
  });
} catch (error) {
  console.error(`   ❌ Error al leer el archivo: ${error.message}`);
  process.exit(1);
}

// 3. Cargar con dotenv
console.log(`\n3️⃣  Cargando variables con dotenv:`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error(`   ❌ Error: ${result.error.message}`);
  process.exit(1);
} else {
  console.log(`   ✅ dotenv.config() ejecutado sin errores`);
  if (result.parsed) {
    console.log(`   ✅ Variables parseadas: ${Object.keys(result.parsed).length}`);
  }
}

// 4. Verificar variables específicas
console.log(`\n4️⃣  Verificando variables requeridas:`);
console.log('   ' + '-'.repeat(56));

const requiredVars = [
  'HUBSPOT_API_TOKEN',
  'HUBSPOT_PORTAL_ID',
  'HUBDB_TABLE_ID'
];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  const exists = value !== undefined;
  const hasValue = exists && value !== null && value.toString().trim().length > 0;
  
  console.log(`   ${varName}:`);
  console.log(`      Existe en process.env: ${exists ? '✅' : '❌'}`);
  console.log(`      Tiene valor: ${hasValue ? '✅' : '❌'}`);
  
  if (exists) {
    const trimmed = value.toString().trim();
    const displayValue = trimmed.length > 30 
      ? trimmed.substring(0, 30) + '...' 
      : trimmed;
    console.log(`      Tipo: ${typeof value}`);
    console.log(`      Longitud: ${trimmed.length} caracteres`);
    console.log(`      Valor (primeros 30 chars): "${displayValue}"`);
    
    if (trimmed.length === 0) {
      console.log(`      ⚠️  ADVERTENCIA: El valor está vacío o solo tiene espacios`);
    }
  } else {
    console.log(`      ⚠️  La variable no está definida en process.env`);
  }
  console.log('');
});

// 5. Resumen
console.log('='.repeat(60));
console.log('\n📊 RESUMEN:\n');

const allValid = requiredVars.every(varName => {
  const value = process.env[varName];
  return value !== undefined && value !== null && value.toString().trim().length > 0;
});

if (allValid) {
  console.log('✅ Todas las variables están correctamente configuradas!');
  console.log('   Puedes ejecutar: npm start\n');
} else {
  console.log('❌ Hay problemas con las variables de entorno.\n');
  console.log('💡 POSIBLES SOLUCIONES:');
  console.log('   1. Verifica que el archivo .env esté en la raíz del proyecto');
  console.log('   2. Verifica que no haya espacios alrededor del signo =');
  console.log('   3. Verifica que los valores no estén entre comillas innecesarias');
  console.log('   4. Verifica que no haya caracteres especiales o espacios al inicio/fin');
  console.log('   5. Asegúrate de que el archivo esté guardado en UTF-8\n');
}

