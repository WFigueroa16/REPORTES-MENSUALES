const path = require('node:path');
const fs = require('node:fs');
const dbService = require('../services/telemetryDbService');
const millCatalog = require('../services/millCatalogService');
const visionExtractor = require('../services/visionExtractorService');
const rulesEngine = require('../services/businessRulesEngine');
const reportService = require('../services/reportService');

class TelemetryController {
  /**
   * Endpoint Webhook de Green API
   */
  async handleGreenApiWebhook(req, res) {
    try {
      const body = req.body;
      if (!body) return res.status(400).json({ error: 'Body vacío' });

      // Filtrar únicamente mensajes entrantes con imágenes
      const typeWebhook = body.typeWebhook;
      const messageData = body.messageData;

      if (typeWebhook !== 'incomingMessageReceived' || !messageData) {
        return res.status(200).json({ status: 'ignorado', motivo: 'No es mensaje entrante' });
      }

      if (messageData.typeMessage !== 'imageMessage') {
        return res.status(200).json({ status: 'ignorado', motivo: 'No contiene imagen' });
      }

      const fileData = messageData.fileMessageData;
      if (!fileData || !fileData.downloadUrl) {
        return res.status(400).json({ error: 'Falta downloadUrl de la imagen' });
      }

      console.log(`[Webhook GreenAPI] Foto recibida: ${fileData.downloadUrl}`);

      // Descargar imagen
      const imgRes = await fetch(fileData.downloadUrl);
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extraer telemetría con Visión IA
      const datosExtraidos = await visionExtractor.extraerTelemetria(buffer, fileData.fileName || 'whatsapp_img.jpg');

      // Validar y aplicar reglas de negocio
      const resultado = rulesEngine.validarYEnriquecer(datosExtraidos);

      if (resultado.esDuplicado) {
        return res.status(200).json({ status: 'duplicado', detalle: resultado.incidencias[0].detalle });
      }

      if (!resultado.valido) {
        dbService.registrarIncidencia(
          datosExtraidos.codigo_molino || 'DESCONOCIDO',
          resultado.incidencias[0].motivo,
          resultado.incidencias[0].detalle,
          fileData.downloadUrl
        );
        return res.status(200).json({ status: 'enviado_a_revision', incidencias: resultado.incidencias });
      }

      // Guardar en base de datos
      const capturaId = dbService.guardarCapturaConLecturas(
        {
          codigo_molino: resultado.codigo_molino,
          timestamp_hmi: resultado.timestamp_hmi,
          hash_imagen: datosExtraidos.hash_imagen,
          url_imagen: fileData.downloadUrl,
          estado_motor: (datosExtraidos.estados_discretos && datosExtraidos.estados_discretos.motor_principal) || 'ON',
          calidad_ocr: 'ALTA',
          observaciones: resultado.incidencias.map(i => i.detalle).join(' | ')
        },
        resultado.sensoresValidados
      );

      // Alerta inmediata por WhatsApp si hay sensor en FALLA
      if (resultado.resumenCondiciones.falla > 0) {
        console.warn(`[ALERTA INMEDIATA] Molino ${resultado.codigo_molino} tiene sensores en falla.`);
      }

      return res.status(201).json({
        status: 'procesado_exitosamente',
        captura_id: capturaId,
        molino: resultado.codigo_molino,
        timestamp_hmi: resultado.timestamp_hmi,
        sensores_registrados: resultado.sensoresValidados.length,
        resumen: resultado.resumenCondiciones
      });
    } catch (err) {
      console.error('[Webhook GreenAPI] Error crítico:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Endpoint para procesar una foto manualmente desde el Frontend o Tests
   */
  async procesarFotoManual(req, res) {
    try {
      const { base64, nombreArchivo, url } = req.body;
      let buffer = null;

      if (base64) {
        buffer = Buffer.from(base64, 'base64');
      } else if (url) {
        const resp = await fetch(url);
        const ab = await resp.arrayBuffer();
        buffer = Buffer.from(ab);
      } else {
        return res.status(400).json({ error: 'Se requiere base64 o url de la imagen' });
      }

      const datosExtraidos = await visionExtractor.extraerTelemetria(buffer, nombreArchivo || 'foto_manual.jpg');
      // En subida manual permitimos sobreescritura/reprocesamiento para pruebas inmediatas en pantalla
      const resultado = rulesEngine.validarYEnriquecer(datosExtraidos, true);

      if (!resultado.valido) {
        dbService.registrarIncidencia(
          datosExtraidos.codigo_molino || 'DESCONOCIDO',
          resultado.incidencias[0].motivo,
          resultado.incidencias[0].detalle,
          url || 'subida_manual'
        );
        return res.status(200).json({ status: 'enviado_a_revision', incidencias: resultado.incidencias });
      }

      const capturaId = dbService.guardarCapturaConLecturas(
        {
          codigo_molino: resultado.codigo_molino,
          timestamp_hmi: resultado.timestamp_hmi,
          hash_imagen: datosExtraidos.hash_imagen,
          url_imagen: url || 'subida_manual',
          estado_motor: (datosExtraidos.estados_discretos && datosExtraidos.estados_discretos.motor_principal) || 'ON',
          calidad_ocr: 'ALTA',
          observaciones: resultado.incidencias.map(i => i.detalle).join(' | ')
        },
        resultado.sensoresValidados
      );

      const muestraSensores = resultado.sensoresValidados.slice(0, 4).map(s => `${s.acronimo}: ${s.valor}${s.unidad}`).join(' | ');

      return res.status(201).json({
        status: 'procesado_exitosamente',
        captura_id: capturaId,
        molino: resultado.codigo_molino,
        timestamp_hmi: resultado.timestamp_hmi,
        sensores_registrados: resultado.sensoresValidados.length,
        resumen: resultado.resumenCondiciones,
        sensores_resumen: muestraSensores,
        sensores: resultado.sensoresValidados,
        estado_general: resultado.resumenCondiciones.falla > 0 ? 'FALLA' : (resultado.resumenCondiciones.alarma > 0 ? 'ALARMA' : (resultado.resumenCondiciones.preaviso > 0 ? 'PREAVISO' : 'NORMAL'))
      });
    } catch (err) {
      console.error('[Procesar Foto] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Endpoint de Dashboard en tiempo real
   */
  obtenerDashboard(req, res) {
    try {
      const data = dbService.obtenerDashboard();
      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Endpoint del Reporte de Turno Consolidado
   */
  obtenerReporteTurno(req, res) {
    try {
      const resumen = reportService.generarResumenTurno();
      const textoWhatsApp = reportService.formatearMensajeWhatsApp(resumen);
      return res.json({ success: true, resumen, textoWhatsApp });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Endpoint para despachar el reporte por correo vía Gmail
   */
  async enviarReporteCorreo(req, res) {
    try {
      const emailService = require('../services/emailService');
      const destinatarios = req.body.destinatarios || process.env.REPORT_EMAILS || 'supervisores.planta@ejemplo.com';
      const resumen = reportService.generarResumenTurno();

      const resultadoEnvio = await emailService.enviarReporteTurnoGmail(destinatarios, resumen);
      return res.json({ success: true, resultado: resultadoEnvio });
    } catch (err) {
      console.error('[Enviar Correo] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Sincroniza estado de telemetría enviado desde el cliente (LocalStorage -> SQLite)
   */
  sincronizarEstadoCliente(req, res) {
    try {
      const { items } = req.body;
      const syncedCount = dbService.sincronizarCapturasDesdeCliente(items);
      const dataActualizada = dbService.obtenerDashboard();
      return res.json({ success: true, synced: syncedCount, data: dataActualizada });
    } catch (err) {
      console.error('[Sync State] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new TelemetryController();
