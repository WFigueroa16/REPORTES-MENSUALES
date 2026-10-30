const nodemailer = require('nodemailer');
const dbService = require('./telemetryDbService');

class EmailService {
  /**
   * Crea el transporte de correo según variables de entorno o modo de simulación
   */
  obtenerTransporter() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (user && pass) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });
    }

    return null;
  }

  /**
   * Genera el HTML enriquecido del reporte de molienda
   */
  generarHtmlReporte(resumen) {
    const dashboard = dbService.obtenerDashboard();

    let filasMolinosHtml = '';
    dashboard.forEach(item => {
      const m = item.molino;
      const st = item.estado_general;
      const fecha = item.ultima_captura ? item.ultima_captura.timestamp_hmi : 'Sin datos';
      const horas = item.horas_sin_reporte !== null ? `${item.horas_sin_reporte}h` : '-';
      const motor = item.ultima_captura ? item.ultima_captura.estado_motor : '-';

      let colorBg = '#dcfce7';
      let colorTxt = '#166534';
      if (st === 'PREAVISO') { colorBg = '#fef9c3'; colorTxt = '#854d0e'; }
      else if (st === 'ALARMA') { colorBg = '#ffedd5'; colorTxt = '#9a3412'; }
      else if (st === 'FALLA') { colorBg = '#fee2e2'; colorTxt = '#991b1b'; }
      else if (st === 'SIN_DATOS') { colorBg = '#f1f5f9'; colorTxt = '#475569'; }

      filasMolinosHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
          <td style="padding: 8px 12px; font-weight: bold; font-family: monospace;">${m.codigo_hmi}</td>
          <td style="padding: 8px 12px;">${m.nombre}</td>
          <td style="padding: 8px 12px; text-align: center;">${motor}</td>
          <td style="padding: 8px 12px; text-align: center;">${fecha}</td>
          <td style="padding: 8px 12px; text-align: center;">${horas}</td>
          <td style="padding: 8px 12px; text-align: center;">
            <span style="background: ${colorBg}; color: ${colorTxt}; padding: 3px 8px; border-radius: 12px; font-weight: bold; font-size: 11px;">
              ${st}
            </span>
          </td>
        </tr>
      `;
    });

    let alertasHtml = '';
    if (resumen.molinos_falla.length > 0 || resumen.molinos_alerta.length > 0) {
      alertasHtml = `
        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
          <h3 style="color: #be123c; margin: 0 0 8px 0; font-size: 15px;">⚠️ Atención de Supervisión Requerida</h3>
          <ul style="margin: 0; padding-left: 20px; color: #4c0519; font-size: 13px;">
            ${resumen.molinos_falla.map(f => `<li><strong>${f.codigo} (${f.nombre}):</strong> ${f.fallas} sensor(es) en condición de FALLA.</li>`).join('')}
            ${resumen.molinos_alerta.map(a => `<li><strong>${a.codigo} (${a.nombre}):</strong> ${a.alarmas} alarma(s) y ${a.preavisos} preaviso(s) activo(s).</li>`).join('')}
          </ul>
        </div>
      `;
    }

    let retrasosHtml = '';
    if (resumen.molinos_silenciosos.length > 0) {
      retrasosHtml = `
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
          <h3 style="color: #b45309; margin: 0 0 8px 0; font-size: 15px;">⏳ Retraso en Reporte Fotográfico (> 2.5 Horas)</h3>
          <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 13px;">
            ${resumen.molinos_silenciosos.map(s => `<li><strong>${s.codigo} (${s.nombre || ''}):</strong> ${s.horas ? `${s.horas}h sin foto` : s.motivo}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0; color: #1e293b;">
        <div style="max-width: 720px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          
          <!-- Encabezado -->
          <div style="background: #0f172a; color: #ffffff; padding: 24px; border-bottom: 3px solid #38bdf8;">
            <h1 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">⚡ PLANTA BENEFICIO ZA - TELEMETRÍA DE MOLIENDA</h1>
            <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 13px;">Reporte Oficial Consolidado de Turno | Transcripción Automática desde WhatsApp</p>
          </div>

          <!-- Métricas Clave -->
          <div style="padding: 20px;">
            <div style="display: flex; gap: 12px; margin-bottom: 20px;">
              <table style="width: 100%; border-collapse: collapse; text-align: center;">
                <tr>
                  <td style="background: #f1f5f9; padding: 12px; border-radius: 6px; width: 25%;">
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Guardia</div>
                    <div style="font-size: 14px; font-weight: bold; margin-top: 4px;">${resumen.turno.nombre}</div>
                  </td>
                  <td style="width: 2%;"></td>
                  <td style="background: #f1f5f9; padding: 12px; border-radius: 6px; width: 25%;">
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Molinos Operando</div>
                    <div style="font-size: 18px; font-weight: bold; color: #0284c7; margin-top: 4px;">${resumen.molinos_operando} / ${resumen.total_molinos}</div>
                  </td>
                  <td style="width: 2%;"></td>
                  <td style="background: #f1f5f9; padding: 12px; border-radius: 6px; width: 25%;">
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">En Normal</div>
                    <div style="font-size: 18px; font-weight: bold; color: #16a34a; margin-top: 4px;">${resumen.conteo_estados.normales}</div>
                  </td>
                  <td style="width: 2%;"></td>
                  <td style="background: #f1f5f9; padding: 12px; border-radius: 6px; width: 25%;">
                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Alarma / Falla</div>
                    <div style="font-size: 18px; font-weight: bold; color: #dc2626; margin-top: 4px;">${resumen.conteo_estados.alarma + resumen.conteo_estados.falla}</div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Secciones de Alerta -->
            ${alertasHtml}
            ${retrasosHtml}

            <!-- Tabla de Molinos -->
            <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #334155;">Estado Detallado de los 19 Molinos</h3>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px;">
              <thead>
                <tr style="background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase;">
                  <th style="padding: 10px 12px; text-align: left;">Código</th>
                  <th style="padding: 10px 12px; text-align: left;">Equipo</th>
                  <th style="padding: 10px 12px; text-align: center;">Motor</th>
                  <th style="padding: 10px 12px; text-align: center;">Último HMI</th>
                  <th style="padding: 10px 12px; text-align: center;">Horas</th>
                  <th style="padding: 10px 12px; text-align: center;">Semáforo</th>
                </tr>
              </thead>
              <tbody>
                ${filasMolinosHtml}
              </tbody>
            </table>

            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
              Mensaje automático generado por el Sistema de Telemetría e Inteligencia Operacional · Planta Beneficio ZA
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Envía el reporte a través de Gmail o genera vista previa en simulación
   */
  async enviarReporteTurnoGmail(destinatarios, resumen) {
    const transporter = this.obtenerTransporter();
    const html = this.generarHtmlReporte(resumen);
    const asunto = `📊 [Planta ZA] Reporte de Molienda - Turno ${resumen.turno.nombre} (${resumen.fecha})`;

    if (!transporter) {
      console.log(`[EmailService] Modo Simulado: GMAIL_USER o GMAIL_APP_PASSWORD no configurados.`);
      console.log(`[EmailService] Simulación de envío a: ${destinatarios}`);
      return {
        enviado: false,
        simulado: true,
        destinatarios,
        asunto,
        htmlGenerado: html,
        mensaje: 'Correo simulado correctamente (configura GMAIL_USER y GMAIL_APP_PASSWORD para entrega real).'
      };
    }

    const info = await transporter.sendMail({
      from: `"Telemetría Planta ZA" <${process.env.GMAIL_USER}>`,
      to: destinatarios,
      subject: asunto,
      html
    });

    console.log(`[EmailService] Correo enviado exitosamente vía Gmail ID: ${info.messageId}`);
    return {
      enviado: true,
      simulado: false,
      messageId: info.messageId,
      destinatarios,
      asunto
    };
  }
}

module.exports = new EmailService();
