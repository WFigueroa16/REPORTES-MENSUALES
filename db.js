const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const dbPath = path.join(__dirname, 'beneficio_za.sqlite');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize Tables
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operador',
      area TEXT,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS equipos (
      codigo TEXT PRIMARY KEY,
      area TEXT,
      descripcion TEXT,
      criticidad TEXT,
      num_avisos INTEGER DEFAULT 0,
      pendientes INTEGER DEFAULT 0,
      parado TEXT,
      ultimo_aviso TEXT
    );

    CREATE TABLE IF NOT EXISTS cat_controles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modulo TEXT NOT NULL,
      item TEXT NOT NULL,
      ubicacion TEXT,
      unidad TEXT,
      min_val REAL,
      max_val REAL,
      referencia TEXT,
      activo TEXT DEFAULT 'SI'
    );

    CREATE TABLE IF NOT EXISTS rdo_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      guardia TEXT NOT NULL,
      area TEXT NOT NULL,
      parametro TEXT NOT NULL,
      valor TEXT,
      registrado_por TEXT,
      fecha_registro TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(fecha, guardia, area, parametro)
    );

    CREATE TABLE IF NOT EXISTS bitacora (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      guardia TEXT NOT NULL,
      area TEXT NOT NULL,
      detalle TEXT NOT NULL,
      registrado_por TEXT,
      fecha_registro TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS concentrado (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      num_hora INTEGER NOT NULL,
      hora TEXT NOT NULL,
      mineral_tms REAL DEFAULT 0,
      concentrado_tms REAL DEFAULT 0,
      s_pct REAL DEFAULT 0,
      rm123_dtt_s REAL DEFAULT 0,
      rm123_dtt_sf REAL DEFAULT 0,
      rm56789_dtt_s REAL DEFAULT 0,
      rm56789_dtt_sf REAL DEFAULT 0,
      esp_ant_fe REAL DEFAULT 0,
      esp_n_fe_sol REAL DEFAULT 0,
      esp_ant_feo REAL DEFAULT 0,
      esp_n_feo REAL DEFAULT 0,
      h2o_pct REAL DEFAULT 0,
      prom_fe_sol REAL DEFAULT 0,
      prom_feo REAL DEFAULT 0,
      recup_pct REAL DEFAULT 0,
      ratio REAL DEFAULT 0,
      obs_magnetica TEXT,
      obs_filtros TEXT,
      registrado_por TEXT,
      fecha_registro TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(fecha, num_hora)
    );

    CREATE TABLE IF NOT EXISTS controles_planta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT UNIQUE,
      fecha TEXT NOT NULL,
      modulo TEXT NOT NULL,
      item TEXT NOT NULL,
      turno TEXT NOT NULL,
      valor TEXT,
      observacion TEXT,
      registrado_por TEXT,
      fecha_registro TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS paradas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      equipo TEXT NOT NULL,
      inicio_parada TEXT NOT NULL,
      arranque TEXT NOT NULL,
      horas_perdidas REAL DEFAULT 0,
      tmh_no_procesadas REAL DEFAULT 0,
      mineral_no_procesado REAL DEFAULT 0,
      concentrado_no_producido REAL DEFAULT 0,
      tipo_falla TEXT,
      motivo TEXT,
      control TEXT,
      registrado_por TEXT,
      fecha_registro TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS mantto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      guardia TEXT NOT NULL,
      area TEXT NOT NULL,
      equipo TEXT NOT NULL,
      aviso_sap TEXT,
      especialidad TEXT,
      tipo TEXT,
      trabajo_realizado TEXT NOT NULL,
      inicio TEXT,
      fin TEXT,
      horas REAL DEFAULT 0,
      estado TEXT DEFAULT 'Cerrado',
      responsable TEXT,
      observaciones TEXT,
      registrado_por TEXT,
      fecha_registro TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS bombas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      turno TEXT NOT NULL,
      equipo TEXT NOT NULL,
      componentes_cambiados TEXT,
      tipo_mantto TEXT,
      horas_equipo REAL DEFAULT 0,
      observaciones TEXT,
      registrado_por TEXT,
      fecha_registro TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS balanzas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      equipo TEXT NOT NULL,
      faja TEXT,
      zero_as_found REAL DEFAULT 0,
      zero_as_left REAL DEFAULT 0,
      delta_zero REAL DEFAULT 0,
      err_zero_enc REAL DEFAULT 0,
      err_zero_dej REAL DEFAULT 0,
      span_as_found REAL DEFAULT 0,
      span_as_left REAL DEFAULT 0,
      delta_span REAL DEFAULT 0,
      err_span_enc REAL DEFAULT 0,
      err_span_dej REAL DEFAULT 0,
      observacion TEXT,
      registrado_por TEXT,
      fecha_registro TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_hora TEXT DEFAULT (datetime('now', 'localtime')),
      usuario TEXT NOT NULL,
      tabla TEXT NOT NULL,
      registro_id TEXT,
      accion TEXT NOT NULL,
      campo TEXT,
      valor_anterior TEXT,
      valor_nuevo TEXT,
      motivo TEXT
    );

    CREATE TABLE IF NOT EXISTS control_dias (
      fecha TEXT PRIMARY KEY,
      estado TEXT DEFAULT 'Abierto',
      horas_cargadas REAL DEFAULT 0,
      completitud REAL DEFAULT 0,
      cerrado_por TEXT,
      fecha_cierre TEXT,
      nota TEXT
    );
  `);

  seedInitialData();
}

// Password hashing utilities using Node.js native crypto
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const check = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return check === hash;
}

// Seed admin and master catalogs if empty
function seedInitialData() {
  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  if (userCount === 0) {
    const adminPass = hashPassword('admin123');
    const opPass = hashPassword('operador123');
    const supPass = hashPassword('supervisor123');

    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, salt, full_name, role, area)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('admin', adminPass.hash, adminPass.salt, 'Administrador del Sistema', 'admin', 'SISTEMAS / PLANTA');
    insertUser.run('supervisor', supPass.hash, supPass.salt, 'Supervisor de Guardia', 'supervisor', 'PLANTA BENEFICIO');
    insertUser.run('operador_rdo', opPass.hash, opPass.salt, 'Operador RDO Trituración/Filtros', 'operador_rdo', 'OPERACIONES');
    insertUser.run('operador_planta', opPass.hash, opPass.salt, 'Operador Controles Planta', 'operador_planta', 'PRODUCCION');
    insertUser.run('mantto', opPass.hash, opPass.salt, 'Técnico de Mantenimiento', 'mantto', 'MANTENIMIENTO');

    console.log('✅ Usuarios base creados (admin, supervisor, operador_rdo, operador_planta, mantto)');
  }

  // Load catalogs from seed_catalogs.json if available
  const catalogPath = path.join(__dirname, 'seed_catalogs.json');
  if (fs.existsSync(catalogPath)) {
    const equiposCount = db.prepare('SELECT count(*) as count FROM equipos').get().count;
    if (equiposCount === 0) {
      try {
        const raw = fs.readFileSync(catalogPath, 'utf8').replace(/^\uFEFF/, '');
        const data = JSON.parse(raw);
        const insertEquipo = db.prepare(`
          INSERT OR REPLACE INTO equipos (codigo, area, descripcion, criticidad, num_avisos, pendientes, parado, ultimo_aviso)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        db.exec('BEGIN TRANSACTION');
        for (const eq of (data.equipos || [])) {
          insertEquipo.run(
            String(eq.codigo || ''),
            String(eq.area || ''),
            String(eq.descripcion || ''),
            String(eq.criticidad || ''),
            Number(eq.num_avisos || 0),
            Number(eq.pendientes || 0),
            String(eq.parado || ''),
            String(eq.ultimo_aviso || '')
          );
        }
        db.exec('COMMIT');
        console.log(`✅ ${data.equipos.length} equipos insertados en el catálogo maestro.`);

        const insertCatControl = db.prepare(`
          INSERT INTO cat_controles (modulo, item, ubicacion, unidad, min_val, max_val, referencia, activo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        db.exec('BEGIN TRANSACTION');
        for (const ctrl of (data.catControles || [])) {
          insertCatControl.run(
            String(ctrl.modulo || ''),
            String(ctrl.item || ''),
            String(ctrl.ubicacion || ''),
            String(ctrl.unidad || ''),
            ctrl.min != null && ctrl.min !== '' ? Number(ctrl.min) : null,
            ctrl.max != null && ctrl.max !== '' ? Number(ctrl.max) : null,
            String(ctrl.referencia || ''),
            String(ctrl.activo || 'SI')
          );
        }
        db.exec('COMMIT');
        console.log(`✅ ${data.catControles.length} controles insertados en el catálogo.`);
      } catch (err) {
        console.error('Error cargando catálogos:', err);
      }
    }
  }
}

// Log audit helper
function logAudit(usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo, motivo) {
  try {
    const stmt = db.prepare(`
      INSERT INTO auditoria (usuario, tabla, registro_id, accion, campo, valor_anterior, valor_nuevo, motivo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      usuario || 'sistema',
      tabla,
      String(registro_id || ''),
      accion,
      campo || null,
      valor_anterior != null ? String(valor_anterior) : null,
      valor_nuevo != null ? String(valor_nuevo) : null,
      motivo || null
    );
  } catch (err) {
    console.error('Error logging audit:', err);
  }
}

initSchema();

module.exports = {
  db,
  hashPassword,
  verifyPassword,
  logAudit
};
