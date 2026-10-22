const ExcelJS = require('exceljs');
const path = require('node:path');
const { db } = require('./db');
const { scheduleLiveSync } = require('./sync_excel');

const maestroPath = path.join(__dirname, 'MAESTRO REPORTES BENEFICIO ZA - PRODUCCION Y SEG.xlsm');

function formatDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    if (val.match(/^\d{4}-\d{2}-\d{2}/)) return val.substring(0, 10);
  }
  return String(val);
}

function formatTime(val) {
  if (!val) return '00:00';
  if (val instanceof Date) {
    const hours = String(val.getUTCHours()).padStart(2, '0');
    const mins = String(val.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  }
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60);
    const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const mins = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}:${mins}`;
  }
  return String(val);
}

function getVal(cellVal) {
  if (cellVal == null) return null;
  if (typeof cellVal === 'object') {
    if (cellVal.result !== undefined) return cellVal.result;
    if (cellVal.text !== undefined) return cellVal.text;
  }
  return cellVal;
}

async function migrateAll() {
  console.log('🚀 Iniciando migración de datos históricos de Setiembre...');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(maestroPath);
  console.log('📖 Archivo Maestro leído exitosamente.');

  // 1. Concentrado
  console.log('Cargando Datos Concentrado...');
  const wsConc = wb.getWorksheet('Datos Concentrado');
  const insertConc = db.prepare(`
    INSERT OR REPLACE INTO concentrado (
      fecha, num_hora, hora, mineral_tms, concentrado_tms, s_pct,
      rm123_dtt_s, rm123_dtt_sf, rm56789_dtt_s, rm56789_dtt_sf,
      esp_ant_fe, esp_n_fe_sol, esp_ant_feo, esp_n_feo, h2o_pct,
      prom_fe_sol, prom_feo, recup_pct, ratio, obs_magnetica, obs_filtros, registrado_por
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let concCount = 0;
  db.exec('BEGIN TRANSACTION');
  wsConc.eachRow((row, rowNumber) => {
    if (rowNumber <= 4) return; // Skip headers
    const fecha = formatDate(row.getCell(3).value);
    const numHora = Number(getVal(row.getCell(4).value));
    if (!fecha || !numHora) return;

    const hora = formatTime(row.getCell(5).value);
    const mineral = Number(getVal(row.getCell(6).value) || 0);
    const conc = Number(getVal(row.getCell(7).value) || 0);
    const s = Number(getVal(row.getCell(8).value) || 0);
    const rm123_s = Number(getVal(row.getCell(9).value) || 0);
    const rm123_sf = Number(getVal(row.getCell(10).value) || 0);
    const rm56789_s = Number(getVal(row.getCell(11).value) || 0);
    const rm56789_sf = Number(getVal(row.getCell(12).value) || 0);
    const esp_ant_fe = Number(getVal(row.getCell(13).value) || 0);
    const esp_n_fe_sol = Number(getVal(row.getCell(14).value) || 0);
    const esp_ant_feo = Number(getVal(row.getCell(15).value) || 0);
    const esp_n_feo = Number(getVal(row.getCell(16).value) || 0);
    const h2o = Number(getVal(row.getCell(17).value) || 0);
    const prom_fe_sol = Number(getVal(row.getCell(23).value) || esp_n_fe_sol);
    const prom_feo = Number(getVal(row.getCell(24).value) || esp_n_feo);
    const recup = Number(getVal(row.getCell(25).value) || 0);
    const ratio = Number(getVal(row.getCell(26).value) || 0);
    const obsMag = String(getVal(row.getCell(19).value) || '');
    const obsFil = String(getVal(row.getCell(20).value) || '');
    const regPor = String(getVal(row.getCell(21).value) || 'Migración');

    insertConc.run(
      fecha, numHora, hora, mineral, conc, s,
      rm123_s, rm123_sf, rm56789_s, rm56789_sf,
      esp_ant_fe, esp_n_fe_sol, esp_ant_feo, esp_n_feo, h2o,
      prom_fe_sol, prom_feo, parseFloat(recup.toFixed(2)), parseFloat(ratio.toFixed(2)),
      obsMag, obsFil, regPor
    );
    concCount++;
  });
  db.exec('COMMIT');
  console.log(`✅ ${concCount} filas de Concentrado importadas.`);

  // 2. Registro RDO
  console.log('Cargando Registro RDO...');
  const wsRDO = wb.getWorksheet('Registro RDO');
  const insertRDO = db.prepare(`
    INSERT OR REPLACE INTO rdo_entries (fecha, guardia, area, parametro, valor, registrado_por)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let rdoCount = 0;
  db.exec('BEGIN TRANSACTION');
  wsRDO.eachRow((row, rowNumber) => {
    if (rowNumber <= 4) return;
    const fecha = formatDate(row.getCell(2).value);
    const area = String(getVal(row.getCell(4).value) || '');
    const param = String(getVal(row.getCell(5).value) || '');
    const guardia = String(getVal(row.getCell(6).value) || '');
    const valor = String(getVal(row.getCell(7).value) || '');

    if (fecha && guardia && area && param) {
      insertRDO.run(fecha, guardia, area, param, valor, 'Migración Histórica');
      rdoCount++;
    }
  });
  db.exec('COMMIT');
  console.log(`✅ ${rdoCount} filas de RDO importadas.`);

  // 3. Bitácora RDO
  console.log('Cargando Bitácora RDO...');
  const wsBit = wb.getWorksheet('Bitácora RDO');
  const insertBit = db.prepare(`
    INSERT INTO bitacora (fecha, guardia, area, detalle, registrado_por)
    VALUES (?, ?, ?, ?, ?)
  `);

  let bitCount = 0;
  db.exec('BEGIN TRANSACTION');
  wsBit.eachRow((row, rowNumber) => {
    if (rowNumber <= 4) return;
    const fecha = formatDate(row.getCell(2).value);
    const guardia = String(getVal(row.getCell(4).value) || '');
    const area = String(getVal(row.getCell(5).value) || '');
    const detalle = String(getVal(row.getCell(6).value) || '');

    if (fecha && detalle) {
      insertBit.run(fecha, guardia || 'A', area || 'OPERACIONES', detalle, 'Migración Histórica');
      bitCount++;
    }
  });
  db.exec('COMMIT');
  console.log(`✅ ${bitCount} notas de Bitácora importadas.`);

  // 4. Fallas y Paradas
  console.log('Cargando Fallas y Paradas...');
  const wsParadas = wb.getWorksheet('Fallas y Paradas');
  const insertParada = db.prepare(`
    INSERT INTO paradas (
      fecha, equipo, inicio_parada, arranque, horas_perdidas,
      tmh_no_procesadas, mineral_no_procesado, concentrado_no_producido,
      tipo_falla, motivo, control, registrado_por
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let parCount = 0;
  db.exec('BEGIN TRANSACTION');
  wsParadas.eachRow((row, rowNumber) => {
    if (rowNumber <= 4) return;
    const fecha = formatDate(row.getCell(2).value);
    const equipo = String(getVal(row.getCell(3).value) || '');
    if (!fecha || !equipo) return;

    const inicio = formatTime(row.getCell(4).value);
    const arranque = formatTime(row.getCell(5).value);
    const horas = Number(getVal(row.getCell(6).value) || 0);
    const tmh = Number(getVal(row.getCell(7).value) || 0);
    const minNoProc = Number(getVal(row.getCell(8).value) || 0);
    const concNoProd = Number(getVal(row.getCell(9).value) || 0);
    const tipo = String(getVal(row.getCell(10).value) || 'MECÁNICA');
    const motivo = String(getVal(row.getCell(11).value) || '');
    const control = String(getVal(row.getCell(12).value) || '');

    insertParada.run(fecha, equipo, inicio, arranque, horas, tmh, minNoProc, concNoProd, tipo, motivo, control, 'Migración');
    parCount++;
  });
  db.exec('COMMIT');
  console.log(`✅ ${parCount} paradas importadas.`);

  // 5. Mantenimiento
  console.log('Cargando Reporte Mantenimiento...');
  const wsMantto = wb.getWorksheet('Reporte Mantenimiento');
  const insertMantto = db.prepare(`
    INSERT INTO mantto (
      fecha, guardia, area, equipo, aviso_sap, especialidad, tipo,
      trabajo_realizado, inicio, fin, horas, estado, responsable, observaciones, registrado_por
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let manttoCount = 0;
  db.exec('BEGIN TRANSACTION');
  wsMantto.eachRow((row, rowNumber) => {
    if (rowNumber <= 11) return; // Row 11 is header
    const fecha = formatDate(row.getCell(2).value);
    const equipo = String(getVal(row.getCell(5).value) || '');
    const trabajo = String(getVal(row.getCell(9).value) || '');
    if (!fecha || !equipo || !trabajo) return;

    insertMantto.run(
      fecha,
      String(getVal(row.getCell(3).value) || 'A'),
      String(getVal(row.getCell(4).value) || 'PLANTA'),
      equipo,
      String(getVal(row.getCell(6).value) || ''),
      String(getVal(row.getCell(7).value) || 'MECÁNICA'),
      String(getVal(row.getCell(8).value) || 'CORRECTIVO'),
      trabajo,
      formatTime(row.getCell(10).value),
      formatTime(row.getCell(11).value),
      Number(getVal(row.getCell(12).value) || 0),
      String(getVal(row.getCell(13).value) || 'Cerrado'),
      String(getVal(row.getCell(14).value) || ''),
      String(getVal(row.getCell(15).value) || ''),
      'Migración'
    );
    manttoCount++;
  });
  db.exec('COMMIT');
  console.log(`✅ ${manttoCount} trabajos de mantenimiento importados.`);

  // 6. Controles de Planta
  console.log('Cargando Datos Controles...');
  const wsControles = wb.getWorksheet('Datos Controles');
  const insertCtrl = db.prepare(`
    INSERT OR REPLACE INTO controles_planta (clave, fecha, modulo, item, turno, valor, observacion, registrado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let ctrlCount = 0;
  db.exec('BEGIN TRANSACTION');
  wsControles.eachRow((row, rowNumber) => {
    if (rowNumber <= 4) return;
    const clave = String(getVal(row.getCell(2).value) || '');
    const fecha = formatDate(row.getCell(3).value);
    const modulo = String(getVal(row.getCell(4).value) || '');
    const item = String(getVal(row.getCell(5).value) || '');
    const turno = String(getVal(row.getCell(6).value) || '1');
    const valor = String(getVal(row.getCell(7).value) || '');

    if (clave && fecha && modulo && item) {
      insertCtrl.run(clave, fecha, modulo, item, turno, valor, '', 'Migración Histórica');
      ctrlCount++;
    }
  });
  db.exec('COMMIT');
  console.log(`✅ ${ctrlCount} controles de planta importados.`);

  console.log('\n======================================================');
  console.log('🎉 MIGRACIÓN COMPLETA DE SETIEMBRE REALIZADA EXITOSAMENTE');
  console.log('======================================================\n');
  scheduleLiveSync();
}

migrateAll().catch(err => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
