const path = require('node:path');
const fs = require('node:fs');
const { db } = require('../db');

function initTelemetrySchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS telemetria_molinos (
      codigo_hmi TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL,
      total_sensores INTEGER DEFAULT 0,
      activo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS telemetria_sensores_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      molino_codigo TEXT NOT NULL,
      acronimo TEXT NOT NULL,
      nombre_completo TEXT NOT NULL,
      unidad TEXT NOT NULL,
      sentido TEXT NOT NULL DEFAULT 'MAX',
      umbral_alarma REAL,
      umbral_falla REAL,
      margen_preaviso REAL DEFAULT 0.05,
      FOREIGN KEY(molino_codigo) REFERENCES telemetria_molinos(codigo_hmi),
      UNIQUE(molino_codigo, acronimo)
    );

    CREATE TABLE IF NOT EXISTS telemetria_capturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_molino TEXT NOT NULL,
      timestamp_hmi TEXT NOT NULL,
      timestamp_recepcion TEXT DEFAULT (datetime('now', 'localtime')),
      hash_imagen TEXT,
      url_imagen TEXT,
      estado_motor TEXT DEFAULT 'ON',
      calidad_ocr TEXT DEFAULT 'ALTA',
      observaciones TEXT,
      UNIQUE(codigo_molino, timestamp_hmi)
    );

    CREATE TABLE IF NOT EXISTS telemetria_lecturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      captura_id INTEGER NOT NULL,
      acronimo_sensor TEXT NOT NULL,
      nombre_sensor TEXT,
      valor REAL NOT NULL,
      unidad TEXT,
      alarma REAL,
      falla REAL,
      sentido TEXT,
      condicion TEXT NOT NULL,
      es_atipico INTEGER DEFAULT 0,
      FOREIGN KEY(captura_id) REFERENCES telemetria_capturas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS telemetria_revision (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp_deteccion TEXT DEFAULT (datetime('now', 'localtime')),
      codigo_molino TEXT,
      motivo TEXT NOT NULL,
      detalle_error TEXT,
      url_imagen TEXT,
      revisado INTEGER DEFAULT 0
    );
  `);
}

initTelemetrySchema();

module.exports = {
  db,
  initTelemetrySchema,

  // Molinos
  registrarMolino(codigo_hmi, nombre, tipo, total_sensores = 0) {
    const stmt = db.prepare(`
      INSERT INTO telemetria_molinos (codigo_hmi, nombre, tipo, total_sensores)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(codigo_hmi) DO UPDATE SET
        nombre = excluded.nombre,
        tipo = excluded.tipo,
        total_sensores = excluded.total_sensores
    `);
    return stmt.run(codigo_hmi, nombre, tipo, total_sensores);
  },

  obtenerMolinos() {
    return db.prepare('SELECT * FROM telemetria_molinos ORDER BY codigo_hmi ASC').all();
  },

  obtenerMolinoPorCodigo(codigo) {
    return db.prepare('SELECT * FROM telemetria_molinos WHERE codigo_hmi = ?').get(codigo);
  },

  // Sensores Config
  guardarSensorConfig(config) {
    const stmt = db.prepare(`
      INSERT INTO telemetria_sensores_config 
        (molino_codigo, acronimo, nombre_completo, unidad, sentido, umbral_alarma, umbral_falla, margen_preaviso)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(molino_codigo, acronimo) DO UPDATE SET
        nombre_completo = excluded.nombre_completo,
        unidad = excluded.unidad,
        sentido = excluded.sentido,
        umbral_alarma = excluded.umbral_alarma,
        umbral_falla = excluded.umbral_falla,
        margen_preaviso = excluded.margen_preaviso
    `);
    return stmt.run(
      config.molino_codigo,
      config.acronimo,
      config.nombre_completo,
      config.unidad,
      config.sentido || 'MAX',
      config.umbral_alarma,
      config.umbral_falla,
      config.margen_preaviso || 0.05
    );
  },

  obtenerSensoresPorMolino(molino_codigo) {
    return db.prepare('SELECT * FROM telemetria_sensores_config WHERE molino_codigo = ?').all(molino_codigo);
  },

  // Capturas y Lecturas
  existeCaptura(codigo_molino, timestamp_hmi) {
    const row = db.prepare('SELECT id FROM telemetria_capturas WHERE codigo_molino = ? AND timestamp_hmi = ?').get(codigo_molino, timestamp_hmi);
    return !!row;
  },

  guardarCapturaConLecturas(captura, lecturas) {
    const insertCaptura = db.prepare(`
      INSERT INTO telemetria_capturas (codigo_molino, timestamp_hmi, hash_imagen, url_imagen, estado_motor, calidad_ocr, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(codigo_molino, timestamp_hmi) DO UPDATE SET
        hash_imagen = excluded.hash_imagen,
        url_imagen = excluded.url_imagen,
        estado_motor = excluded.estado_motor,
        calidad_ocr = excluded.calidad_ocr,
        observaciones = excluded.observaciones
    `);

    insertCaptura.run(
      captura.codigo_molino,
      captura.timestamp_hmi,
      captura.hash_imagen || null,
      captura.url_imagen || null,
      captura.estado_motor || 'ON',
      captura.calidad_ocr || 'ALTA',
      captura.observaciones || ''
    );

    const capturaRow = db.prepare('SELECT id FROM telemetria_capturas WHERE codigo_molino = ? AND timestamp_hmi = ?').get(captura.codigo_molino, captura.timestamp_hmi);
    const capturaId = Number(capturaRow.id);

    // Limpiar lecturas anteriores si se está actualizando la captura
    db.prepare('DELETE FROM telemetria_lecturas WHERE captura_id = ?').run(capturaId);

    const insertLectura = db.prepare(`
      INSERT INTO telemetria_lecturas 
        (captura_id, acronimo_sensor, nombre_sensor, valor, unidad, alarma, falla, sentido, condicion, es_atipico)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const l of lecturas) {
      insertLectura.run(
        capturaId,
        l.acronimo,
        l.nombre_sensor || l.descripcion || l.acronimo,
        l.valor,
        l.unidad || '',
        l.alarma !== undefined ? l.alarma : null,
        l.falla !== undefined ? l.falla : null,
        l.sentido || 'MAX',
        l.condicion || 'NORMAL',
        l.es_atipico ? 1 : 0
      );
    }

    return capturaId;
  },

  registrarIncidencia(codigo_molino, motivo, detalle_error, url_imagen) {
    const stmt = db.prepare(`
      INSERT INTO telemetria_revision (codigo_molino, motivo, detalle_error, url_imagen)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(codigo_molino, motivo, detalle_error, url_imagen);
  },

  obtenerDashboard() {
    const molinos = db.prepare('SELECT * FROM telemetria_molinos ORDER BY codigo_hmi ASC').all();
    const resultado = [];

    for (const m of molinos) {
      const ultimaCaptura = db.prepare(`
        SELECT * FROM telemetria_capturas 
        WHERE codigo_molino = ? 
        ORDER BY timestamp_hmi DESC LIMIT 1
      `).get(m.codigo_hmi);

      if (!ultimaCaptura) {
        resultado.push({
          molino: m,
          ultima_captura: null,
          horas_sin_reporte: null,
          sensores: [],
          estado_general: 'SIN_DATOS',
          resumen: { normal: 0, preaviso: 0, alarma: 0, falla: 0 }
        });
        continue;
      }

      const lecturas = db.prepare(`
        SELECT * FROM telemetria_lecturas WHERE captura_id = ?
      `).all(ultimaCaptura.id);

      let normal = 0, preaviso = 0, alarma = 0, falla = 0;
      for (const l of lecturas) {
        if (l.condicion === 'FALLA') falla++;
        else if (l.condicion === 'ALARMA') alarma++;
        else if (l.condicion === 'PREAVISO') preaviso++;
        else normal++;
      }

      let estado_general = 'NORMAL';
      if (falla > 0) estado_general = 'FALLA';
      else if (alarma > 0) estado_general = 'ALARMA';
      else if (preaviso > 0) estado_general = 'PREAVISO';

      // Cálculo de horas
      const ahora = new Date();
      const ts = new Date(ultimaCaptura.timestamp_hmi);
      const diffHoras = isNaN(ts.getTime()) ? null : Number(((ahora - ts) / (1000 * 60 * 60)).toFixed(1));

      resultado.push({
        molino: m,
        ultima_captura: ultimaCaptura,
        horas_sin_reporte: diffHoras,
        sensores: lecturas,
        estado_general,
        resumen: { normal, preaviso, alarma, falla }
      });
    }

    return resultado;
  },

  sincronizarCapturasDesdeCliente(items) {
    if (!Array.isArray(items)) return 0;
    let synced = 0;
    for (const item of items) {
      if (!item || !item.molino || !item.ultima_captura) continue;
      const cod = item.ultima_captura.codigo_molino || item.molino.codigo_hmi;
      const ts = item.ultima_captura.timestamp_hmi;
      if (!cod || !ts) continue;

      if (!this.existeCaptura(cod, ts) && Array.isArray(item.sensores) && item.sensores.length > 0) {
        this.guardarCapturaConLecturas(
          {
            codigo_molino: cod,
            timestamp_hmi: ts,
            hash_imagen: item.ultima_captura.hash_imagen || null,
            url_imagen: item.ultima_captura.url_imagen || 'cliente_sync',
            estado_motor: item.ultima_captura.estado_motor || 'ON',
            calidad_ocr: item.ultima_captura.calidad_ocr || 'ALTA',
            observaciones: item.ultima_captura.observaciones || 'Sincronizado desde caché de cliente'
          },
          item.sensores.map(s => ({
            acronimo: s.acronimo_sensor || s.acronimo,
            nombre_sensor: s.nombre_sensor || s.descripcion || s.acronimo_sensor,
            valor: s.valor,
            unidad: s.unidad || '',
            alarma: s.alarma !== undefined ? s.alarma : null,
            falla: s.falla !== undefined ? s.falla : null,
            sentido: s.sentido || 'MAX',
            condicion: s.condicion || 'NORMAL'
          }))
        );
        synced++;
      }
    }
    return synced;
  }
};
