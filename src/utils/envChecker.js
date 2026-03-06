/**
 * Utilidad para verificar variables de entorno
 */

export const checkEnvVars = () => {
  const required = {
    hubspot: ['HUBSPOT_API_TOKEN', 'HUBSPOT_PORTAL_ID', 'HUBDB_TABLE_ID'],
    mysql: ['MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'MYSQL_TABLE']
  };

  const missing = {
    hubspot: [],
    mysql: []
  };

  // Verificar variables de HubSpot
  required.hubspot.forEach(varName => {
    if (!process.env[varName]) {
      missing.hubspot.push(varName);
    }
  });

  // Verificar variables de MySQL (opcionales para Sprint 1)
  required.mysql.forEach(varName => {
    if (!process.env[varName]) {
      missing.mysql.push(varName);
    }
  });

  return {
    hubspot: {
      required: required.hubspot,
      missing: missing.hubspot,
      valid: missing.hubspot.length === 0
    },
    mysql: {
      required: required.mysql,
      missing: missing.mysql,
      valid: missing.mysql.length === 0
    }
  };
};

export const printEnvStatus = () => {
  const status = checkEnvVars();
  
  console.log('\n📋 Estado de Variables de Entorno:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // HubSpot
  if (status.hubspot.valid) {
    console.log('✅ HubSpot: Todas las variables están configuradas');
    console.log(`   - HUBSPOT_API_TOKEN: ${process.env.HUBSPOT_API_TOKEN ? '✓ Configurado' : '✗ Faltante'}`);
    console.log(`   - HUBSPOT_PORTAL_ID: ${process.env.HUBSPOT_PORTAL_ID || '✗ Faltante'}`);
    console.log(`   - HUBDB_TABLE_ID: ${process.env.HUBDB_TABLE_ID || '✗ Faltante'}`);
  } else {
    console.log('❌ HubSpot: Faltan variables requeridas:');
    status.hubspot.missing.forEach(varName => {
      console.log(`   - ${varName}`);
    });
  }
  
  // MySQL
  if (status.mysql.valid) {
    console.log('✅ MySQL: Todas las variables están configuradas');
  } else {
    console.log('⚠️  MySQL: Faltan variables (necesarias para Sprint 2):');
    status.mysql.missing.forEach(varName => {
      console.log(`   - ${varName}`);
    });
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
};

