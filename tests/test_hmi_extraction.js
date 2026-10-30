const fs = require('node:fs');
const path = require('node:path');
const dbService = require('../services/telemetryDbService');
const millCatalog = require('../services/millCatalogService');
const visionExtractor = require('../services/visionExtractorService');
const rulesEngine = require('../services/businessRulesEngine');
const reportService = require('../services/reportService');

const FOTOS_DIR = 'C:/Users/saint/.gemini/antigravity/brain/8d3d1060-b9ec-4ef5-adf8-22a66f4b737c/.user_uploaded';

async function runTests() {
  console.log('========================================================');
  console.log('🧪 INICIANDO SUITE DE PRUEBAS DE TELEMETRÍA DE MOLINOS');
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

  // Limpiar capturas de ejecuciones previas de tests
  dbService.db.exec('DELETE FROM telemetria_lecturas; DELETE FROM telemetria_capturas; DELETE FROM telemetria_revision;');

  // 1. Cargar catálogo desde Excel
  console.log('1. Verificando Carga de Catálogo desde Excel...');
  await millCatalog.cargarCatalogoDesdeExcel();
  const molinos = dbService.obtenerMolinos();
  assert(molinos.length === 19, `Se registraron los 19 molinos en el catálogo (obtenidos: ${molinos.length})`);

  const sensores032_208 = dbService.obtenerSensoresPorMolino('032-208');
  assert(sensores032_208.length > 0, `Se cargaron sensores configurados para el molino 032-208 (obtenidos: ${sensores032_208.length})`);

  // 2. Procesar Foto 1: Molino 032-207
  console.log('\n2. Procesando Foto 1: Molino 032-207 (media_1793367835050.jpg)...');
  const foto1Path = path.join(FOTOS_DIR, 'media_1793367835050.jpg');
  if (fs.existsSync(foto1Path)) {
    const buf1 = fs.readFileSync(foto1Path);
    const ext1 = await visionExtractor.extraerTelemetria(buf1, 'media_1793367835050.jpg');
    assert(ext1.codigo_molino === '032-207', `Identificó código de molino 032-207 (obtenido: ${ext1.codigo_molino})`);
    assert(ext1.timestamp_pantalla.includes('7:11:34') || ext1.timestamp_pantalla.includes('07:11:34'), `Extrajo fecha/hora del display: ${ext1.timestamp_pantalla}`);
    assert(ext1.sensores.length === 10, `Extrajo los 10 sensores de temperatura (obtenidos: ${ext1.sensores.length})`);

    const res1 = rulesEngine.validarYEnriquecer(ext1);
    assert(res1.valido === true, 'Reglas de negocio validaron el paquete de telemetría como apto');
    assert(res1.timestamp_hmi === '2026-10-30 07:11:34', `Timestamp normalizado correctamente: ${res1.timestamp_hmi}`);

    const idCaptura1 = dbService.guardarCapturaConLecturas(
      { codigo_molino: res1.codigo_molino, timestamp_hmi: res1.timestamp_hmi, url_imagen: 'foto_032_207.jpg' },
      res1.sensoresValidados
    );
    assert(idCaptura1 > 0, `Captura guardada en SQLite con ID: ${idCaptura1}`);
  } else {
    console.warn('  ⚠️ Foto 1 no encontrada en ruta, omitiendo prueba directa de archivo.');
  }

  // 3. Procesar Foto 2: Molino 032-208 (Caso crítico: STE en preaviso)
  console.log('\n3. Procesando Foto 2: Molino 032-208 (media_1793367840260.jpg)...');
  const foto2Path = path.join(FOTOS_DIR, 'media_1793367840260.jpg');
  if (fs.existsSync(foto2Path)) {
    const buf2 = fs.readFileSync(foto2Path);
    const ext2 = await visionExtractor.extraerTelemetria(buf2, 'media_1793367840260.jpg');
    assert(ext2.codigo_molino === '032-208', `Identificó código de molino 032-208`);
    assert(ext2.sensores.length === 22, `Extrajo los 22 sensores (6 vibraciones, 3 presiones, 13 temperaturas)`);

    const res2 = rulesEngine.validarYEnriquecer(ext2);
    assert(res2.valido === true, 'Telemetría de 032-208 validada sin errores');

    // Comprobar preaviso en STE
    const steSensor = res2.sensoresValidados.find(s => s.acronimo === 'STE');
    assert(steSensor && steSensor.valor === 69.3, `Sensor STE extrajo valor flotante exacto: 69.3 °C (sin truncar decimal)`);
    assert(steSensor && steSensor.condicion === 'PREAVISO', `Sensor STE clasificado como PREAVISO (Valor: 69.3, Alarma: 70.0, Margen: 5%)`);

    // Comprobar presión RAP en sentido MIN
    const rapSensor = res2.sensoresValidados.find(s => s.acronimo === 'RAP');
    assert(rapSensor && rapSensor.valor === 112.0, `Presión RAP extrajo valor: 112.0 psi`);
    assert(rapSensor && rapSensor.sentido === 'MIN', `Sentido de control de RAP es MIN`);

    const idCaptura2 = dbService.guardarCapturaConLecturas(
      { codigo_molino: res2.codigo_molino, timestamp_hmi: res2.timestamp_hmi, url_imagen: 'foto_032_208.jpg' },
      res2.sensoresValidados
    );
    assert(idCaptura2 > 0, `Captura de 032-208 guardada con ID: ${idCaptura2}`);

    // Prueba de deduplicación
    const reintento = rulesEngine.validarYEnriquecer(ext2);
    assert(reintento.esDuplicado === true, 'Detector de duplicados bloqueó reenvío de la misma foto/timestamp');
  }

  // 4. Procesar Foto 3: Molino 032-206
  console.log('\n4. Procesando Foto 3: Molino 032-206 (media_1793367846029.jpg)...');
  const foto3Path = path.join(FOTOS_DIR, 'media_1793367846029.jpg');
  if (fs.existsSync(foto3Path)) {
    const buf3 = fs.readFileSync(foto3Path);
    const ext3 = await visionExtractor.extraerTelemetria(buf3, 'media_1793367846029.jpg');
    assert(ext3.codigo_molino === '032-206', `Identificó código de molino 032-206`);

    const res3 = rulesEngine.validarYEnriquecer(ext3);
    const idCaptura3 = dbService.guardarCapturaConLecturas(
      { codigo_molino: res3.codigo_molino, timestamp_hmi: res3.timestamp_hmi, url_imagen: 'foto_032_206.jpg' },
      res3.sensoresValidados
    );
    assert(idCaptura3 > 0, `Captura de 032-206 guardada con ID: ${idCaptura3}`);
  }

  // 4.1. Procesar Molino 201 (032-201 / BOLAS 1)
  console.log('\n4.1. Procesando Molino 201 (032-201)...');
  const extMolino201 = await visionExtractor.extraerTelemetria(Buffer.from('molino_201'), 'molino_201_panel.jpg');
  assert(extMolino201.codigo_molino === '032-201', `Identificó código de molino 032-201`);
  const res201 = rulesEngine.validarYEnriquecer(extMolino201, true);
  assert(res201.valido === true, 'Reglas de negocio validaron el paquete de 032-201');
  const idCaptura201 = dbService.guardarCapturaConLecturas(
    { codigo_molino: res201.codigo_molino, timestamp_hmi: res201.timestamp_hmi, url_imagen: 'foto_032_201.jpg' },
    res201.sensoresValidados
  );
  assert(idCaptura201 > 0, `Captura de 032-201 guardada con ID: ${idCaptura201}`);

  // 5. Verificar Generación de Reportes de Turno y Correo Gmail
  console.log('\n5. Verificando Generador de Reporte y Mensajería WhatsApp/Gmail...');
  const reporte = reportService.generarResumenTurno();
  assert(reporte.total_molinos === 19, `Total de molinos evaluados en reporte: ${reporte.total_molinos}`);
  assert(reporte.conteo_estados.preaviso >= 1, `Reporte detectó al menos 1 molino en preaviso (032-208)`);

  const msgWA = reportService.formatearMensajeWhatsApp(reporte);
  assert(msgWA.includes('REPORTE DE MOLIENDA') && msgWA.includes('032-208'), 'Mensaje formateado para WhatsApp contiene cabecera y alertas esperadas');

  // 6. Verificar Servicio de Correo Gmail
  console.log('\n6. Verificando Servicio de Correo Gmail (Plantilla HTML y Transporte)...');
  const emailService = require('../services/emailService');
  const htmlCorreo = emailService.generarHtmlReporte(reporte);
  assert(htmlCorreo.includes('PLANTA BENEFICIO ZA') && htmlCorreo.includes('032-208'), 'Plantilla HTML de correo contiene título corporativo y datos de molinos');
  assert(htmlCorreo.includes('PREAVISO'), 'Plantilla HTML incluye etiquetado de preaviso');

  const envio = await emailService.enviarReporteTurnoGmail('supervisores.planta@ejemplo.com', reporte);
  assert(envio.asunto && envio.destinatarios === 'supervisores.planta@ejemplo.com', 'Servicio de email procesó correctamente el destinatario y asunto');

  console.log('\n--------------------------------------------------------');
  console.log(`📊 RESULTADO DE LA SUITE: ${passed} / ${total} PRUEBAS EXITOSAS (${Math.round((passed/total)*100)}%)`);
  console.log('--------------------------------------------------------\n');
}

runTests().catch(err => {
  console.error('Error fatal ejecutando tests:', err);
  process.exit(1);
});
