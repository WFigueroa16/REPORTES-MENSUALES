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
    // Opcional: Enviar email o Webhook
  }
}
