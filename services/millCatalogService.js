const path = require('node:path');
const fs = require('node:fs');
const ExcelJS = require('exceljs');
const dbService = require('./telemetryDbService');

let catalogLoaded = false;
let catalogCache = new Map();

/**
 * Mapeo de códigos de pantalla HMI a nombres de molino y números
 */
const MOLINOS_MAP = {
  // Barras 1 a 9: 032-081 a 032-089
  '032-081': { nombre: 'BARRAS 1', tipo: 'Barras', numero: 1 },
  '032-082': { nombre: 'BARRAS 2', tipo: 'Barras', numero: 2 },
  '032-083': { nombre: 'BARRAS 3', tipo: 'Barras', numero: 3 },
  '032-084': { nombre: 'BARRAS 4', tipo: 'Barras', numero: 4 },
  '032-085': { nombre: 'BARRAS 5', tipo: 'Barras', numero: 5 },
  '032-086': { nombre: 'BARRAS 6', tipo: 'Barras', numero: 6 },
  '032-087': { nombre: 'BARRAS 7', tipo: 'Barras', numero: 7 },
  '032-088': { nombre: 'BARRAS 8', tipo: 'Barras', numero: 8 },
  '032-089': { nombre: 'BARRAS 9', tipo: 'Barras', numero: 9 },

  // Bolas 1 a 9: 032-201 a 032-209
  '032-201': { nombre: 'BOLAS 1', tipo: 'Bolas', numero: 1 },
  '032-202': { nombre: 'BOLAS 2', tipo: 'Bolas', numero: 2 },
  '032-203': { nombre: 'BOLAS 3', tipo: 'Bolas', numero: 3 },
  '032-204': { nombre: 'BOLAS 4', tipo: 'Bolas', numero: 4 },
  '032-205': { nombre: 'BOLAS 5', tipo: 'Bolas', numero: 5 },
  '032-206': { nombre: 'BOLAS 6', tipo: 'Bolas', numero: 6 },
  '032-207': { nombre: 'BOLAS 7', tipo: 'Bolas', numero: 7 },
  '032-208': { nombre: 'BOLAS 8', tipo: 'Bolas', numero: 8 },
  '032-209': { nombre: 'BOLAS 9', tipo: 'Bolas', numero: 9 },
  '032-2010': { nombre: 'BOLAS 10', tipo: 'Bolas', numero: 10 }
};

/**
 * Normaliza acrónimos extraídos del HMI
 */
function normalizarAcronimo(texto) {
  if (!texto) return 'DESCONOCIDO';
  const t = texto.toUpperCase();
  if (t.includes('VR1') || t.includes('VIBRACIÓN 1') || t.includes('VIBRACION 1')) return 'VR1';
  if (t.includes('VR2') || t.includes('VIBRACIÓN 2') || t.includes('VIBRACION 2')) return 'VR2';
  if (t.includes('VR3') || t.includes('VIBRACIÓN 3') || t.includes('VIBRACION 3')) return 'VR3';
  if (t.includes('VR4') || t.includes('VIBRACIÓN 4') || t.includes('VIBRACION 4')) return 'VR4';
  if (t.includes('VR5') || t.includes('VIBRACIÓN 5') || t.includes('VIBRACION 5')) return 'VR5';
  if (t.includes('VR6') || t.includes('VIBRACIÓN 6') || t.includes('VIBRACION 6')) return 'VR6';
  
  if (t.includes('RAP') || t.includes('RECEPCION') || t.includes('RECEPECION')) return 'RAP';
  if (t.includes('CAP') || t.includes('EMBRAGUE')) return 'CAP';
  if (t.includes('ROP') || t.includes('ACEITE REDUCTOR')) return 'ROP';
  
  if (t.includes('STE') || t.includes('ESTATOR')) return 'STE';
  if (t.includes('STA') || t.includes('ANILLO')) return 'STA';
  if (t.includes('ROT') || t.includes('EN EL REDUCTOR')) return 'ROT';
  
  if (t.includes('TTE') || t.includes('TRUNION LADO CARGA') || t.includes('TRUNNION LADO CARGA')) return 'TTE';
  if (t.includes('TTS') || t.includes('TRUNION LADO DESCARGA') || t.includes('TRUNNION LADO DESCARGA')) return 'TTS';
  
  if (t.includes('IFC1') || t.includes('INFRARROJO LADO CARGA 1')) return 'IFC1';
  if (t.includes('IFC2') || t.includes('INFRARROJO LADO CARGA 2')) return 'IFC2';
  if (t.includes('IFD3') || t.includes('INFRARROJO LADO DESCARGA 1') || t.includes('IFD 3')) return 'IFD3';
  if (t.includes('IFD4') || t.includes('INFRARROJO LADO DESCARGA 2') || t.includes('IFD 4')) return 'IFD4';

  if (t.includes('TRC') || t.includes('RETORNO CARGA')) return 'TRC';
  if (t.includes('TRD') || t.includes('RETORNO DESCARGA')) return 'TRD';

  if (t.includes('BOBINA 1') || t.includes('BOBINA DEL MOTOR 1') || t.includes('BOBINA DEL MOTOR °C')) return 'BOBINA_1';
  if (t.includes('BOBINA 2') || t.includes('BOBINA DEL MOTOR 2')) return 'BOBINA_2';

  // Si no coincide con un patrón específico, limpiar texto y retornar
  return t.replace(/[^A-Z0-9_-]/g, '_').slice(0, 15);
}

/**
 * Carga el catálogo desde la hoja Calc de parametros molinos.xlsx
 */
async function cargarCatalogoDesdeExcel() {
  const rutaExcel = path.join(__dirname, '..', 'parametros molinos.xlsx');
  if (!fs.existsSync(rutaExcel)) {
    console.warn(`[MillCatalog] No se encontró ${rutaExcel}. Se usará catálogo base.`);
    poblarCatalogoBase();
    return;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(rutaExcel);
  const sCalc = wb.getWorksheet('Calc');

  // Registrar molinos en base de datos
  for (const [cod, info] of Object.entries(MOLINOS_MAP)) {
    dbService.registrarMolino(cod, info.nombre, info.tipo, info.tipo === 'Barras' ? 8 : 22);
  }

  if (sCalc) {
    let sensoresRegistrados = 0;
    // Fila 5 en adelante son los 170 sensores
    for (let r = 5; r <= sCalc.rowCount; r++) {
      const row = sCalc.getRow(r);
      const numMolino = row.getCell(1).value;
      const tipoEquipo = row.getCell(2).value;
      const sensorObj = row.getCell(3).value;
      const sensorNombre = typeof sensorObj === 'object' && sensorObj ? (sensorObj.result || sensorObj.toString()) : String(sensorObj || '');
      const unidadObj = row.getCell(4).value;
      const unidad = typeof unidadObj === 'object' && unidadObj ? (unidadObj.result || unidadObj.toString()) : String(unidadObj || '');
      const sentidoObj = row.getCell(5).value;
      const sentido = typeof sentidoObj === 'object' && sentidoObj ? (sentidoObj.result || sentidoObj.toString()) : (sentidoObj || 'Máx');
      const alarmaObj = row.getCell(6).value;
      const alarma = typeof alarmaObj === 'object' && alarmaObj ? alarmaObj.result : alarmaObj;
      const fallaObj = row.getCell(7).value;
      const falla = typeof fallaObj === 'object' && fallaObj ? fallaObj.result : fallaObj;

      if (!numMolino || !sensorNombre) continue;

      // Determinar código HMI del molino
      const tipoNormal = String(tipoEquipo).toLowerCase();
      let codigoMolino = null;
      if (tipoNormal.includes('barra')) {
        codigoMolino = `032-08${numMolino}`;
      } else {
        codigoMolino = numMolino === 10 ? '032-2010' : `032-20${numMolino}`;
      }

      const acronimo = normalizarAcronimo(sensorNombre);

      dbService.guardarSensorConfig({
        molino_codigo: codigoMolino,
        acronimo,
        nombre_completo: sensorNombre,
        unidad: unidad || '°C',
        sentido: String(sentido).toUpperCase().includes('MÍN') || String(sentido).toUpperCase().includes('MIN') ? 'MIN' : 'MAX',
        umbral_alarma: Number(alarma) || null,
        umbral_falla: Number(falla) || null,
        margen_preaviso: 0.05
      });
      sensoresRegistrados++;
    }
    console.log(`[MillCatalog] Se cargaron ${sensoresRegistrados} sensores desde la hoja Calc.`);
  }

  catalogLoaded = true;
}

function poblarCatalogoBase() {
  for (const [cod, info] of Object.entries(MOLINOS_MAP)) {
    dbService.registrarMolino(cod, info.nombre, info.tipo, info.tipo === 'Barras' ? 8 : 22);
  }
  catalogLoaded = true;
}

module.exports = {
  MOLINOS_MAP,
  normalizarAcronimo,
  cargarCatalogoDesdeExcel,
  obtenerInfoMolino(codigo) {
    return MOLINOS_MAP[codigo] || null;
  }
};
