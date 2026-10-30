const dbService = require('./telemetryDbService');
const ExcelJS = require('exceljs');
const path = require('node:path');

class ReportService {
  /**
   * Determina el turno actual según la hora local de Planta ZA
   */
  obtenerTurnoActual(fecha = new Date()) {
    const hora = fecha.getHours();
    if (hora >= 7 && hora < 15) return { nombre: 'Guardia 1 (Día)', inicio: '07:00', fin: '15:00' };
    if (hora >= 15 && hora < 23) return { nombre: 'Guardia 2 (Tarde)', inicio: '15:00', fin: '23:00' };
    return { nombre: 'Guardia 3 (Noche)', inicio: '23:00', fin: '07:00' };
  }

  /**
   * Genera el consolidado del estado de los 19 molinos
   */
  generarResumenTurno() {
    const dashboard = dbService.obtenerDashboard();
    const turno = this.obtenerTurnoActual();

    const molinosAlerta = [];
    const molinosFalla = [];
    const molinosSilenciosos = [];
    let molinosOperando = 0;

    for (const item of dashboard) {
      const { molino, ultima_captura, horas_sin_reporte, estado_general, resumen } = item;

      if (!ultima_captura) {
        molinosSilenciosos.push({
          codigo: molino.codigo_hmi,
          nombre: molino.nombre,
          motivo: 'Sin ninguna lectura registrada'
        });
        continue;
      }

      if (horas_sin_reporte !== null && horas_sin_reporte > 2.5) {
        molinosSilenciosos.push({
          codigo: molino.codigo_hmi,
          nombre: molino.nombre,
          horas: horas_sin_reporte,
          ultima_captura: ultima_captura.timestamp_hmi
        });
      }

      if (ultima_captura.estado_motor === 'ON') {
        molinosOperando++;
      }

      if (estado_general === 'FALLA') {
        molinosFalla.push({ codigo: molino.codigo_hmi, nombre: molino.nombre, fallas: resumen.falla });
      } else if (estado_general === 'ALARMA' || estado_general === 'PREAVISO') {
        molinosAlerta.push({ codigo: molino.codigo_hmi, nombre: molino.nombre, alarmas: resumen.alarma, preavisos: resumen.preaviso });
      }
    }

    return {
      fecha: new Date().toISOString().slice(0, 10),
      turno,
      total_molinos: dashboard.length,
      molinos_operando: molinosOperando,
      conteo_estados: {
        normales: dashboard.filter(d => d.estado_general === 'NORMAL').length,
        preaviso: dashboard.filter(d => d.estado_general === 'PREAVISO').length,
        alarma: dashboard.filter(d => d.estado_general === 'ALARMA').length,
        falla: dashboard.filter(d => d.estado_general === 'FALLA').length,
        sin_datos: dashboard.filter(d => d.estado_general === 'SIN_DATOS').length
      },
      molinos_falla: molinosFalla,
      molinos_alerta: molinosAlerta,
      molinos_silenciosos: molinosSilenciosos
    };
  }

  /**
   * Formatea el mensaje en texto enriquecido para WhatsApp
   */
  formatearMensajeWhatsApp(resumen) {
    let msg = `📊 *REPORTE DE MOLIENDA - PLANTA BENEFICIO ZA*\n`;
    msg += `📅 *Fecha:* ${resumen.fecha} | *Turno:* ${resumen.turno.nombre}\n`;
    msg += `⚙️ *Molinos en Operación:* ${resumen.molinos_operando} / ${resumen.total_molinos}\n`;
    msg += `------------------------------------\n`;

    if (resumen.molinos_falla.length > 0) {
      msg += `🚨 *MOLINOS EN FALLA CRÍTICA:* ${resumen.molinos_falla.length}\n`;
      resumen.molinos_falla.forEach(m => {
        msg += `  • *${m.codigo}* (${m.nombre}): ${m.fallas} sensor(es) superaron el límite de disparo.\n`;
      });
      msg += `\n`;
    }

    if (resumen.molinos_alerta.length > 0) {
      msg += `⚠️ *MOLINOS EN ALERTA / PREAVISO:* ${resumen.molinos_alerta.length}\n`;
      resumen.molinos_alerta.forEach(m => {
        msg += `  • *${m.codigo}* (${m.nombre}): ${m.alarmas} alarma(s), ${m.preavisos} preaviso(s).\n`;
      });
      msg += `\n`;
    }

    if (resumen.molinos_silenciosos.length > 0) {
      msg += `⏳ *MOLINOS SIN REPORTE FOTOGRÁFICO (>2.5h):* ${resumen.molinos_silenciosos.length}\n`;
      resumen.molinos_silenciosos.forEach(m => {
        if (m.horas) {
          msg += `  • *${m.codigo}*: ${m.horas}h sin foto (Última: ${m.ultima_captura})\n`;
        } else {
          msg += `  • *${m.codigo}*: ${m.motivo}\n`;
        }
      });
      msg += `\n`;
    }

    if (resumen.molinos_falla.length === 0 && resumen.molinos_alerta.length === 0) {
      msg += `✅ *Todos los molinos monitoreados operan en condiciones normales.*\n`;
    }

    msg += `------------------------------------\n_Generado automáticamente por Sistema de Telemetría ZA_`;
    return msg;
  }
}

module.exports = new ReportService();
