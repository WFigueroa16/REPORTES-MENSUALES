/**
 * TELEMETRÍA DE MOLINOS - GOOGLE APPS SCRIPT
 * Mantenimiento Predictivo y Control Operacional Planta Beneficio ZA
 * 
 * Funciones:
 * 1. actualizarDashboardTurno(): Calcula estado en tiempo real, alarmas y horas sin reporte.
 * 2. verificarMolinosSilenciosos(): Dispara alertas si un molino pasa > 3 horas sin fotos.
 * 3. enviarReporteTurno(): Envía consolidado al cierre de guardia (07:00, 15:00, 23:00).
 */

const CONFIG = {
  HOJA_LECTURAS: 'Lecturas',
  HOJA_MOLINOS: 'Molinos',
  HOJA_DASHBOARD: 'Dashboard_Turno',
  HOJA_REVISION: 'Revision',
  HORAS_MAX_SIN_LECTURA: 3.0,
  EMAIL_SUPERVISORES: 'supervisores.planta@ejemplo.com'
};

/**
 * Actualiza la hoja Dashboard_Turno con la última foto y el estado de cada molino
 */
function actualizarDashboardTurno() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaLecturas = ss.getSheetByName(CONFIG.HOJA_LECTURAS);
  const hojaMolinos = ss.getSheetByName(CONFIG.HOJA_MOLINOS);
  const hojaDash = ss.getSheetByName(CONFIG.HOJA_DASHBOARD);

  if (!hojaLecturas || !hojaMolinos || !hojaDash) return;

  const molinosData = hojaMolinos.getRange(2, 1, hojaMolinos.getLastRow() - 1, 3).getValues();
  const lecturasData = hojaLecturas.getRange(2, 1, Math.max(hojaLecturas.getLastRow() - 1, 1), 13).getValues();

  const ahora = new Date();
  const resumen = [];

  molinosData.forEach(([codigo, nombre, tipo]) => {
    // Filtrar lecturas de este molino
    const lecturasMolino = lecturasData.filter(fila => fila[2] === codigo);

    if (lecturasMolino.length === 0) {
      resumen.push([
        codigo + ' (' + nombre + ')',
        'Sin lecturas registradas',
        99.9,
        'DESCONOCIDO',
        0,
        0,
        'ROJO (Sin datos)'
      ]);
      return;
    }

    // Obtener la lectura más reciente
    const ultimaLecturaFila = lecturasMolino[lecturasMolino.length - 1];
    const fechaTablero = new Date(ultimaLecturaFila[0]);
    const horasDif = isNaN(fechaTablero.getTime()) ? 0 : ((ahora - fechaTablero) / (1000 * 60 * 60)).toFixed(1);

    // Contar alarmas y fallas activas en la última tanda
    const tsUltimaTanda = ultimaLecturaFila[0];
    const tandaReciente = lecturasMolino.filter(f => f[0] === tsUltimaTanda);
    
    let fallas = 0;
    let alarmas = 0;
    let preavisos = 0;

    tandaReciente.forEach(fila => {
      const cond = String(fila[11]).toUpperCase();
      if (cond === 'FALLA') fallas++;
      else if (cond === 'ALARMA') alarmas++;
      else if (cond === 'PREAVISO') preavisos++;
    });

    let semaforo = 'VERDE (Normal)';
    if (fallas > 0) semaforo = 'ROJO (Falla crítica)';
    else if (alarmas > 0) semaforo = 'NARANJA (Alarma)';
    else if (preavisos > 0) semaforo = 'AMARILLO (Preaviso)';
    else if (horasDif > CONFIG.HORAS_MAX_SIN_LECTURA) semaforo = 'GRIS (Demora > 3h)';

    const estadoMotor = ultimaLecturaFila[12] || 'ON';

    resumen.push([
      codigo + ' (' + nombre + ')',
      ultimaLecturaFila[0],
      Number(horasDif),
      estadoMotor,
      alarmas,
      fallas,
      semaforo
    ]);
  });

  // Escribir en Dashboard
  hojaDash.getRange(2, 1, hojaDash.getMaxRows() - 1, 7).clearContent();
  if (resumen.length > 0) {
    hojaDash.getRange(2, 1, resumen.length, 7).setValues(resumen);
  }
}

/**
 * Disparador programado (Time-driven trigger cada 1 hora)
 * Alerta sobre molinos con retraso en el reporte fotográfico
 */
function verificarMolinosSilenciosos() {
  actualizarDashboardTurno();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaDash = ss.getSheetByName(CONFIG.HOJA_DASHBOARD);
  const datos = hojaDash.getRange(2, 1, hojaDash.getLastRow() - 1, 7).getValues();

  const rezagados = [];
  datos.forEach(([molino, ultimaLectura, horas, motor, alarmas, fallas, semaforo]) => {
    if (horas > CONFIG.HORAS_MAX_SIN_LECTURA) {
      rezagados.push(`- ${molino}: ${horas}h sin reporte (Última: ${ultimaLectura})`);
    }
  });

  if (rezagados.length > 0) {
    Logger.log("Molinos rezagados:\n" + rezagados.join("\n"));
  }
}

/**
 * Envía el reporte consolidado de turno a través de Gmail de forma 100% nativa
 * Configurar un trigger por tiempo para que se ejecute a las 07:00, 15:00 y 23:00
 */
function enviarReporteTurnoPorGmail() {
  actualizarDashboardTurno();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaDash = ss.getSheetByName(CONFIG.HOJA_DASHBOARD);
  const datos = hojaDash.getRange(2, 1, hojaDash.getLastRow() - 1, 7).getValues();

  const ahora = new Date();
  const hora = ahora.getHours();
  let turnoNombre = 'Guardia 1 (Día: 07:00 - 15:00)';
  if (hora >= 15 && hora < 23) turnoNombre = 'Guardia 2 (Tarde: 15:00 - 23:00)';
  else if (hora >= 23 || hora < 7) turnoNombre = 'Guardia 3 (Noche: 23:00 - 07:00)';

  let filasHtml = '';
  let operandoCount = 0;
  let alarmasTotal = 0;
  let fallasTotal = 0;

  datos.forEach(([molino, ultimaLectura, horas, motor, alarmas, fallas, semaforo]) => {
    if (motor === 'ON') operandoCount++;
    alarmasTotal += Number(alarmas || 0);
    fallasTotal += Number(fallas || 0);

    let colorBg = '#dcfce7';
    let colorTxt = '#166534';
    if (String(semaforo).includes('FALLA') || String(semaforo).includes('ROJO')) {
      colorBg = '#fee2e2'; colorTxt = '#991b1b';
    } else if (String(semaforo).includes('ALARMA') || String(semaforo).includes('NARANJA')) {
      colorBg = '#ffedd5'; colorTxt = '#9a3412';
    } else if (String(semaforo).includes('PREAVISO') || String(semaforo).includes('AMARILLO')) {
      colorBg = '#fef9c3'; colorTxt = '#854d0e';
    } else if (String(semaforo).includes('Demora') || String(semaforo).includes('GRIS')) {
      colorBg = '#f1f5f9'; colorTxt = '#475569';
    }

    filasHtml += `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
        <td style="padding: 8px 12px; font-weight: bold; font-family: monospace;">${molino}</td>
        <td style="padding: 8px 12px; text-align: center;">${motor}</td>
        <td style="padding: 8px 12px; text-align: center;">${ultimaLectura}</td>
        <td style="padding: 8px 12px; text-align: center;">${horas > 90 ? '-' : horas + 'h'}</td>
        <td style="padding: 8px 12px; text-align: center;">${alarmas}</td>
        <td style="padding: 8px 12px; text-align: center;">${fallas}</td>
        <td style="padding: 8px 12px; text-align: center;">
          <span style="background: ${colorBg}; color: ${colorTxt}; padding: 3px 8px; border-radius: 12px; font-weight: bold; font-size: 11px;">
            ${semaforo}
          </span>
        </td>
      </tr>
    `;
  });

  const fechaStr = Utilities.formatDate(ahora, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  const asunto = `📊 [Planta ZA] Reporte de Molienda por Gmail - ${turnoNombre}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
      <div style="background: #0f172a; color: #ffffff; padding: 20px; border-bottom: 3px solid #38bdf8;">
        <h2 style="margin: 0; font-size: 18px;">⚡ PLANTA BENEFICIO ZA - TELEMETRÍA DE MOLINOS</h2>
        <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">Reporte Consolidado por Guardia | Emitido: ${fechaStr}</p>
      </div>

      <div style="padding: 20px;">
        <p style="margin: 0 0 16px 0; font-size: 14px;"><strong>Turno Activo:</strong> ${turnoNombre}<br>
        <strong>Molinos en Operación:</strong> ${operandoCount} / ${datos.length}<br>
        <strong>Alertas Totales:</strong> ${alarmasTotal} alarmas | ${fallasTotal} fallas</p>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase;">
              <th style="padding: 8px 12px; text-align: left;">Molino</th>
              <th style="padding: 8px 12px; text-align: center;">Motor</th>
              <th style="padding: 8px 12px; text-align: center;">Última Foto</th>
              <th style="padding: 8px 12px; text-align: center;">Demora</th>
              <th style="padding: 8px 12px; text-align: center;">Alarmas</th>
              <th style="padding: 8px 12px; text-align: center;">Fallas</th>
              <th style="padding: 8px 12px; text-align: center;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
        </table>

        <p style="color: #94a3b8; font-size: 11px; margin-top: 20px; text-align: center;">
          Generado automáticamente desde Google Sheets y despachado por GmailApp · Planta Beneficio ZA
        </p>
      </div>
    </div>
  `;

  GmailApp.sendEmail(CONFIG.EMAIL_SUPERVISORES, asunto, "", {
    htmlBody: html,
    name: "Telemetría Planta Beneficio ZA"
  });

  Logger.log("Reporte despachado exitosamente por Gmail a: " + CONFIG.EMAIL_SUPERVISORES);
}
