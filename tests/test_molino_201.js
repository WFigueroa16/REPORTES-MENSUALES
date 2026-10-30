const fs = require('node:fs');
const path = require('node:path');
const millCatalog = require('../services/millCatalogService');
const rulesEngine = require('../services/businessRulesEngine');
const dbService = require('../services/telemetryDbService');
const visionExtractor = require('../services/visionExtractorService');

async function testMolino201() {
  console.log('========================================================');
  console.log('🧪 TEST ESPECÍFICO: MOLINO 201 (032-201) EXTRACCIÓN Y PERSISTENCIA');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(cond, desc) {
    total++;
    if (cond) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  // 1. Verificación de Normalización de Códigos de Molino
  console.log('1. Normalización de Códigos de Molino 201 y variantes:');
  assert(millCatalog.normalizarCodigoMolino('201') === '032-201', "Código '201' normalizado a '032-201'");
  assert(millCatalog.normalizarCodigoMolino('MOLINO 201') === '032-201', "Texto 'MOLINO 201' normalizado a '032-201'");
  assert(millCatalog.normalizarCodigoMolino('Molino de bolas 201') === '032-201', "Texto 'Molino de bolas 201' normalizado a '032-201'");
  assert(millCatalog.normalizarCodigoMolino('Bolas 1') === '032-201', "Texto 'Bolas 1' normalizado a '032-201'");
  assert(millCatalog.normalizarCodigoMolino('032-201') === '032-201', "Código '032-201' preservado");
  assert(millCatalog.normalizarCodigoMolino('2010') === '032-2010', "Código '2010' normalizado a '032-2010'");
  assert(millCatalog.normalizarCodigoMolino('81') === '032-081', "Código '81' normalizado a '032-081'");

  // 2. Información en Catálogo
  console.log('\n2. Consulta en Catálogo Maestro:');
  const info201 = millCatalog.obtenerInfoMolino('201');
  assert(info201 !== null && info201.nombre === 'BOLAS 1', "Info de '201' encontrada: BOLAS 1");

  // 3. Reglas de Negocio con '201'
  console.log('\n3. Reglas de Negocio con código extraído como 201:');
  const paquete201 = {
    codigo_molino: '201',
    timestamp_pantalla: '2026-10-30 09:45:25',
    sensores: [
      { acronimo: 'CAP', descripcion: 'Presion de aire embrague (CAP)', valor_actual: 111.5, unidad: 'psi', alarma: 90.0, falla: 80.0, sentido: 'MIN' },
      { acronimo: 'RAP', descripcion: 'Presion de aire recepecion (RAP)', valor_actual: 112.0, unidad: 'psi', alarma: 90.0, falla: 80.0, sentido: 'MIN' },
      { acronimo: 'ROP', descripcion: 'Temp. Aceite reductor molino (ROT)', valor_actual: 38.5, unidad: '°C', alarma: 50.0, falla: 60.0 },
      { acronimo: 'STA', descripcion: 'Temp. Pedestal motor anillo ( STA)', valor_actual: 54.2, unidad: '°C', alarma: 68.0, falla: 70.0 },
      { acronimo: 'TEMP_INFRARROJO', descripcion: 'Temp. Infrarrojo descarga', valor_actual: 44.8, unidad: '°C', alarma: 55.0, falla: 60.0 },
      { acronimo: 'VR1', descripcion: 'Sensor vibracion VR1 al VR6', valor_actual: 0.8, unidad: 'mm/seg', alarma: 8.0, falla: 10.0 }
    ]
  };

  const validacion = rulesEngine.validarYEnriquecer(paquete201, true);
  assert(validacion.valido === true, "Paquete de Molino 201 validado como VÁLIDO");
  assert(validacion.codigo_molino === '032-201', `Código enriquecido a canónico: ${validacion.codigo_molino}`);
  assert(validacion.sensoresValidados.length === 6, `6 sensores validados (obtenidos: ${validacion.sensoresValidados.length})`);

  // 4. Guardar en SQLite
  console.log('\n4. Persistencia en SQLite:');
  const capturaId = dbService.guardarCapturaConLecturas(
    {
      codigo_molino: validacion.codigo_molino,
      timestamp_hmi: validacion.timestamp_hmi,
      hash_imagen: 'hash_test_201',
      url_imagen: 'foto_molino_201.jpg',
      estado_motor: 'ON',
      calidad_ocr: 'ALTA'
    },
    validacion.sensoresValidados
  );
  assert(capturaId > 0, `Captura guardada con ID: ${capturaId}`);

  // Verificar en base de datos directamente
  const rowCaptura = dbService.db.prepare('SELECT * FROM telemetria_capturas WHERE id = ?').get(capturaId);
  assert(rowCaptura && rowCaptura.codigo_molino === '032-201', `Captura en SQLite tiene codigo_molino '032-201'`);

  const lecturas = dbService.db.prepare('SELECT * FROM telemetria_lecturas WHERE captura_id = ?').all(capturaId);
  assert(lecturas.length === 6, `Se persistieron 6 lecturas de sensores en SQLite`);

  // 5. Verificar Dashboard API
  console.log('\n5. Verificación de Dashboard Consolidado:');
  const dashboard = dbService.obtenerDashboard();
  const molino201Card = dashboard.find(m => m.molino.codigo_hmi === '032-201');
  assert(molino201Card !== undefined, "Molino 032-201 presente en el dashboard");
  assert(molino201Card.ultima_captura !== null, "Molino 032-201 TIENE última captura registrada");
  assert(molino201Card.ultima_captura.timestamp_hmi === '2026-10-30 09:45:25', `Timestamp coincide: ${molino201Card.ultima_captura.timestamp_hmi}`);
  assert(molino201Card.sensores.length === 6, `Molino 032-201 contiene sus 6 sensores en dashboard`);
  assert(molino201Card.estado_general === 'NORMAL', `Estado general es NORMAL`);

  // 6. Prueba End-to-End vía HTTP con el servidor en ejecución
  console.log('\n6. Prueba HTTP End-to-End contra http://localhost:3000:');
  try {
    const fakeBuffer = Buffer.from('mock_image_hmi_molino_201');
    const uploadRes = await fetch('http://localhost:3000/api/telemetria/subir-foto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64: fakeBuffer.toString('base64'),
        nombreArchivo: 'molino_201_panel.jpg'
      })
    });

    const uploadJson = await uploadRes.json();
    assert(uploadRes.status === 201, `HTTP Status de /subir-foto es 201 (obtenido: ${uploadRes.status})`);
    assert(uploadJson.status === 'procesado_exitosamente', `Status devuelto es 'procesado_exitosamente'`);
    assert(uploadJson.molino === '032-201', `Respuesta HTTP indica molino '032-201'`);
    assert(uploadJson.sensores_registrados === 6, `Registró 6 sensores vía HTTP`);

    // GET /api/telemetria/dashboard
    const dashRes = await fetch('http://localhost:3000/api/telemetria/dashboard');
    const dashJson = await dashRes.json();
    assert(dashRes.status === 200, "HTTP GET /dashboard responde 200");
    const m201 = dashJson.data.find(m => m.molino.codigo_hmi === '032-201');
    assert(m201 && m201.ultima_captura !== null, "Dashboard vía HTTP confirma Molino 032-201 guardado con captura activa");

    // POST /api/telemetria/sync-state
    const syncRes = await fetch('http://localhost:3000/api/telemetria/sync-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [m201] })
    });
    const syncJson = await syncRes.json();
    assert(syncRes.status === 200 && syncJson.success === true, "Endpoint /sync-state sincroniza estado de cliente sin fallos");

  } catch (err) {
    console.error('Error en pruebas HTTP:', err.message);
    assert(false, `Prueba HTTP falló: ${err.message}`);
  }

  console.log('\n========================================================');
  console.log(`🏁 RESULTADO: ${passed} / ${total} PRUEBAS EXITOSAS`);
  console.log('========================================================\n');
}

testMolino201().catch(e => {
  console.error(e);
  process.exit(1);
});
