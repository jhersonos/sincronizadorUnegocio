import axios from 'axios';
import 'dotenv/config';

/**
 * Script de prueba para actualizar solo el campo area_conocimiento
 * de una fila específica de HubDB, usando un valor en duro.
 *
 * Uso:
 *   node test-hubdb-area.js DPA.26.1.T1
 */

const main = async () => {
  const apiToken = process.env.HUBSPOT_API_TOKEN;
  const tableId = process.env.HUBDB_TABLE_ID; // 164321177 en tu caso

  if (!apiToken || !tableId) {
    console.error('❌ HUBSPOT_API_TOKEN o HUBDB_TABLE_ID no están definidos en el .env');
    process.exit(1);
  }

  const codDiploma = process.argv[2] || 'DPA.26.1.T1';

  const client = axios.create({
    baseURL: 'https://api.hubapi.com',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  });

  try {
    console.log(`🔍 Buscando fila HubDB con cod_diploma = ${codDiploma} en tabla ${tableId}...`);

    // 1) Buscar la fila por cod_diploma
    const searchResp = await client.get(
      `/cms/v3/hubdb/tables/${tableId}/rows`,
      {
        params: {
          cod_diploma__eq: codDiploma,
          limit: 5,
        },
      },
    );

    const results = searchResp.data?.results || [];
    if (results.length === 0) {
      console.error('❌ No se encontró ninguna fila con ese cod_diploma.');
      return;
    }

    const row = results[0];
    console.log('✅ Fila encontrada:');
    console.log(JSON.stringify(row, null, 2));

    const rowId = row.id;

    // 2) Construir el valor MAP para area_conocimiento
    // Según tu data.json, "Personas y Equipos" tiene id "6"
    const areaMap = {
      id: '6',
      name: 'Personas y Equipos',
      type: 'option',
    };

    console.log('\n🔧 Probando PATCH de area_conocimiento como MAP:');
    console.log(JSON.stringify(areaMap, null, 2));

    // 3) Hacer PATCH sobre la fila draft
    const patchUrl = `/cms/v3/hubdb/tables/${tableId}/rows/${rowId}/draft`;

    const patchBody = {
      values: {
        area_conocimiento: areaMap,
      },
    };

    console.log(`\n📡 PATCH ${patchUrl}`);
    console.log('Body:');
    console.log(JSON.stringify(patchBody, null, 2));

    const patchResp = await client.patch(patchUrl, patchBody);

    console.log('\n✅ Respuesta de HubDB:');
    console.log(JSON.stringify(patchResp.data, null, 2));
  } catch (err) {
    console.error('\n❌ Error en la prueba de actualización:');
    console.error('Mensaje:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    }
  }
};

main().catch((e) => {
  console.error('❌ Error inesperado:', e);
  process.exit(1);
});

