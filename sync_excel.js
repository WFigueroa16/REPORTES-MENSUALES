const ExcelJS = require('exceljs');
const path = require('node:path');
const fs = require('node:fs');
const { db } = require('./db');

const exportDir = path.join(__dirname, 'exports');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const consolidatedFilePath = path.join(exportDir, 'DATOS_CONSOLIDADOS_PLANTA.xlsx');

// Format table headers with modern styling
function applyHeaderStyle(row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate 800
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });
}

function applyDataRowStyle(row, isEven) {
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10 };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
    if (isEven) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
      };
    }
  });
}

async function generateWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema Beneficio ZA - Control Web';
  wb.lastModifiedBy = 'Beneficio ZA Live Sync';
  wb.created = new Date();
  wb.modified = new Date();

  // 1. Concentrado
  const wsConc = wb.addWorksheet('Datos Concentrado');
  wsConc.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'N° Hora', key: 'num_hora', width: 10 },
    { header: 'Hora', key: 'hora', width: 10 },
    { header: 'Mineral (TMS)', key: 'mineral_tms', width: 15 },
    { header: 'Concentrado (TMS)', key: 'concentrado_tms', width: 18 },
    { header: 'S (%)', key: 's_pct', width: 10 },
    { header: 'RM 1/2/3 DTT-100 S', key: 'rm123_dtt_s', width: 18 },
    { header: 'RM 1/2/3 DTT-100 S/F', key: 'rm123_dtt_sf', width: 20 },
    { header: 'RM 5/6/7/8/9 DTT-100 S', key: 'rm56789_dtt_s', width: 22 },
    { header: 'RM 5/6/7/8/9 DTT-100 S/F', key: 'rm56789_dtt_sf', width: 22 },
    { header: 'ESP.Ant Fe', key: 'esp_ant_fe', width: 14 },
    { header: 'ESP.N Fe Sol', key: 'esp_n_fe_sol', width: 14 },
    { header: 'ESP.Ant FeO', key: 'esp_ant_feo', width: 14 },
    { header: 'ESP.N FeO', key: 'esp_n_feo', width: 14 },
    { header: 'H2O (%)', key: 'h2o_pct', width: 12 },
    { header: 'Prom. Fe Sol', key: 'prom_fe_sol', width: 14 },
    { header: 'Prom. FeO', key: 'prom_feo', width: 14 },
    { header: '% Recup.', key: 'recup_pct', width: 12 },
    { header: 'Ratio', key: 'ratio', width: 10 },
    { header: 'Obs. Magnética', key: 'obs_magnetica', width: 25 },
    { header: 'Obs. Filtros', key: 'obs_filtros', width: 25 },
    { header: 'Registrado por', key: 'registrado_por', width: 16 },
    { header: 'Fecha registro', key: 'fecha_registro', width: 20 }
  ];
  applyHeaderStyle(wsConc.getRow(1));
  const concRows = db.prepare('SELECT * FROM concentrado ORDER BY fecha DESC, num_hora ASC').all();
  concRows.forEach((r, idx) => {
    const row = wsConc.addRow(r);
    applyDataRowStyle(row, idx % 2 === 1);
  });

  // 2. Registro RDO
  const wsRDO = wb.addWorksheet('Registro RDO');
  wsRDO.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Guardia', key: 'guardia', width: 10 },
    { header: 'Área', key: 'area', width: 18 },
    { header: 'Parámetro', key: 'parametro', width: 30 },
    { header: 'Valor', key: 'valor', width: 20 },
    { header: 'Registrado por', key: 'registrado_por', width: 16 },
    { header: 'Fecha registro', key: 'fecha_registro', width: 20 }
  ];
  applyHeaderStyle(wsRDO.getRow(1));
  const rdoRows = db.prepare('SELECT * FROM rdo_entries ORDER BY fecha DESC, guardia, area, id').all();
  rdoRows.forEach((r, idx) => {
    const row = wsRDO.addRow(r);
    applyDataRowStyle(row, idx % 2 === 1);
  });

  // 3. Bitácora RDO
  const wsBit = wb.addWorksheet('Bitácora RDO');
  wsBit.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Guardia', key: 'guardia', width: 10 },
    { header: 'Área', key: 'area', width: 18 },
    { header: 'Detalle', key: 'detalle', width: 45 },
    { header: 'Registrado por', key: 'registrado_por', width: 16 },
    { header: 'Fecha registro', key: 'fecha_registro', width: 20 }
  ];
  applyHeaderStyle(wsBit.getRow(1));
  const bitRows = db.prepare('SELECT * FROM bitacora ORDER BY fecha DESC, guardia, id').all();
  bitRows.forEach((r, idx) => {
    const row = wsBit.addRow(r);
    applyDataRowStyle(row, idx % 2 === 1);
  });

  // 4. Paradas
  const wsParadas = wb.addWorksheet('Fallas y Paradas');
  wsParadas.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Equipo', key: 'equipo', width: 16 },
    { header: 'Inicio de parada', key: 'inicio_parada', width: 18 },
    { header: 'Arranque', key: 'arranque', width: 18 },
    { header: 'Horas perdidas', key: 'horas_perdidas', width: 14 },
    { header: 'TM/h no procesadas', key: 'tmh_no_procesadas', width: 18 },
    { header: 'Mineral no proc. (TM)', key: 'mineral_no_procesado', width: 20 },
    { header: 'Conc. no prod. (TMS)', key: 'concentrado_no_producido', width: 20 },
    { header: 'Tipo de falla', key: 'tipo_falla', width: 18 },
    { header: 'Motivo', key: 'motivo', width: 35 },
    { header: 'Control', key: 'control', width: 20 },
    { header: 'Registrado por', key: 'registrado_por', width: 16 },
    { header: 'Fecha registro', key: 'fecha_registro', width: 20 }
  ];
  applyHeaderStyle(wsParadas.getRow(1));
  const paradasRows = db.prepare('SELECT * FROM paradas ORDER BY fecha DESC, id DESC').all();
  paradasRows.forEach((r, idx) => {
    const row = wsParadas.addRow(r);
    applyDataRowStyle(row, idx % 2 === 1);
  });

  // 5. Mantenimiento
  const wsMantto = wb.addWorksheet('Reporte Mantenimiento');
  wsMantto.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Guardia', key: 'guardia', width: 10 },
    { header: 'Área', key: 'area', width: 18 },
    { header: 'Equipo', key: 'equipo', width: 16 },
    { header: 'Aviso SAP', key: 'aviso_sap', width: 14 },
    { header: 'Especialidad', key: 'especialidad', width: 16 },
    { header: 'Tipo', key: 'tipo', width: 14 },
    { header: 'Trabajo realizado', key: 'trabajo_realizado', width: 35 },
    { header: 'Inicio', key: 'inicio', width: 12 },
    { header: 'Fin', key: 'fin', width: 12 },
    { header: 'Horas', key: 'horas', width: 10 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Responsable', key: 'responsable', width: 20 },
    { header: 'Observaciones', key: 'observaciones', width: 25 },
    { header: 'Registrado por', key: 'registrado_por', width: 16 }
  ];
  applyHeaderStyle(wsMantto.getRow(1));
  const manttoRows = db.prepare('SELECT * FROM mantto ORDER BY fecha DESC, id DESC').all();
  manttoRows.forEach((r, idx) => {
    const row = wsMantto.addRow(r);
    applyDataRowStyle(row, idx % 2 === 1);
  });

  // 6. Bombas
  const wsBombas = wb.addWorksheet('Mantto Bombas');
  wsBombas.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Turno', key: 'turno', width: 10 },
    { header: 'Equipo', key: 'equipo', width: 16 },
    { header: 'Componentes cambiados', key: 'componentes_cambiados', width: 28 },
    { header: 'Tipo mantto', key: 'tipo_mantto', width: 16 },
    { header: 'Horas equipo', key: 'horas_equipo', width: 14 },
    { header: 'Observaciones', key: 'observaciones', width: 25 },
    { header: 'Registrado por', key: 'registrado_por', width: 16 }
  ];
  applyHeaderStyle(wsBombas.getRow(1));
  const bombasRows = db.prepare('SELECT * FROM bombas ORDER BY fecha DESC, id DESC').all();
  bombasRows.forEach((r, idx) => {
    const row = wsBombas.addRow(r);
    applyDataRowStyle(row, idx % 2 === 1);
  });

  // 7. Balanzas
  const wsBalanzas = wb.addWorksheet('BALANZAS');
  wsBalanzas.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Equipo', key: 'equipo', width: 16 },
    { header: 'Faja Transp', key: 'faja', width: 16 },
    { header: 'Zero As Found', key: 'zero_as_found', width: 14 },
    { header: 'Zero As Left', key: 'zero_as_left', width: 14 },
    { header: 'Delta Zero', key: 'delta_zero', width: 14 },
    { header: 'Error Zero Enc (%)', key: 'err_zero_enc', width: 18 },
    { header: 'Error Zero Dej (%)', key: 'err_zero_dej', width: 18 },
    { header: 'Span As Found', key: 'span_as_found', width: 14 },
    { header: 'Span As Left', key: 'span_as_left', width: 14 },
    { header: 'Delta Span', key: 'delta_span', width: 14 },
    { header: 'Error Span Enc (%)', key: 'err_span_enc', width: 18 },
    { header: 'Error Span Dej (%)', key: 'err_span_dej', width: 18 },
    { header: 'Observación', key: 'observacion', width: 25 }
  ];
  applyHeaderStyle(wsBalanzas.getRow(1));
  const balanzasRows = db.prepare('SELECT * FROM balanzas ORDER BY fecha DESC, id DESC').all();
  balanzasRows.forEach((r, idx) => {
    const row = wsBalanzas.addRow(r);
    applyDataRowStyle(row, idx % 2 === 1);
  });

  // 8. Controles de Planta
  const wsControles = wb.addWorksheet('Datos Controles Planta');
  wsControles.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Módulo', key: 'modulo', width: 22 },
    { header: 'Ítem', key: 'item', width: 22 },
    { header: 'Turno', key: 'turno', width: 10 },
    { header: 'Valor', key: 'valor', width: 18 },
    { header: 'Observación', key: 'observacion', width: 25 },
    { header: 'Registrado por', key: 'registrado_por', width: 16 },
    { header: 'Fecha registro', key: 'fecha_registro', width: 20 }
  ];
  applyHeaderStyle(wsControles.getRow(1));
  const ctrlRows = db.prepare('SELECT * FROM controles_planta ORDER BY fecha DESC, modulo, id').all();
  ctrlRows.forEach((r, idx) => {
    const row = wsControles.addRow(r);
    applyDataRowStyle(row, idx % 2 === 1);
  });

  // 9. Auditoría
  const wsAuditoria = wb.addWorksheet('Auditoría');
  wsAuditoria.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Fecha y Hora', key: 'fecha_hora', width: 20 },
    { header: 'Usuario', key: 'usuario', width: 16 },
    { header: 'Tabla', key: 'tabla', width: 18 },
    { header: 'Registro ID', key: 'registro_id', width: 14 },
    { header: 'Acción', key: 'accion', width: 12 },
    { header: 'Campo', key: 'campo', width: 18 },
    { header: 'Valor Anterior', key: 'valor_anterior', width: 25 },
    { header: 'Valor Nuevo', key: 'valor_nuevo', width: 25 },
    { header: 'Motivo', key: 'motivo', width: 30 }
  ];
  applyHeaderStyle(wsAuditoria.getRow(1));
  const audRows = db.prepare('SELECT * FROM auditoria ORDER BY id DESC LIMIT 1000').all();
  audRows.forEach((r, idx) => {
    const row = wsAuditoria.addRow(r);
    applyDataRowStyle(row, idx % 2 === 1);
  });

  // 10. Maestro Equipos
  const wsEquipos = wb.addWorksheet('Maestro Equipos');
  wsEquipos.columns = [
    { header: 'Código', key: 'codigo', width: 14 },
    { header: 'Área', key: 'area', width: 18 },
    { header: 'Descripción', key: 'descripcion', width: 35 },
    { header: 'Criticidad', key: 'criticidad', width: 12 },
    { header: 'N° Avisos', key: 'num_avisos', width: 12 },
    { header: 'Pendientes', key: 'pendientes', width: 12 },
    { header: 'Parado', key: 'parado', width: 12 },
    { header: 'Último Aviso', key: 'ultimo_aviso', width: 18 }
  ];
  applyHeaderStyle(wsEquipos.getRow(1));
  const eqRows = db.prepare('SELECT * FROM equipos ORDER BY area, codigo').all();
  eqRows.forEach((r, idx) => {
    const row = wsEquipos.addRow(r);
    applyDataRowStyle(row, idx % 2 === 1);
  });

  return wb;
}

// Debounced live sync to avoid writing on every millisecond
let syncTimer = null;
function scheduleLiveSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const wb = await generateWorkbook();
      await wb.xlsx.writeFile(consolidatedFilePath);
      console.log(`[LIVE SYNC] Excel actualizado exitosamente en: ${consolidatedFilePath}`);
    } catch (err) {
      console.error('[LIVE SYNC] Error escribiendo archivo Excel:', err.message);
    }
  }, 2000); // 2 second debounce
}

module.exports = {
  generateWorkbook,
  scheduleLiveSync,
  consolidatedFilePath
};
