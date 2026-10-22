const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { db, hashPassword, verifyPassword, logAudit } = require('./db');
const { generateWorkbook, scheduleLiveSync, consolidatedFilePath } = require('./sync_excel');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory session management
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Authentication Middleware
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '') || req.query.token;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'No autorizado. Inicie sesión.' });
  }
  req.user = sessions.get(token);
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || (!roles.includes(req.user.role) && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Acceso denegado: permisos insuficientes' });
    }
    next();
  };
}

// Server-Sent Events (SSE) for Real-Time synchronization across clients
const sseClients = new Set();
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('retry: 5000\n\n');
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Conectado a Beneficio ZA Live' })}\n\n`);

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function broadcastEvent(type, payload) {
  const data = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ==========================================
// 1. AUTHENTICATION & USERS
// ==========================================

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND activo = 1').get(username.trim());
  if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
    return res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo' });
  }

  const token = generateToken();
  const sessionUser = {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    area: user.area
  };
  sessions.set(token, sessionUser);

  logAudit(user.username, 'users', user.id, 'LOGIN', 'session', null, 'Inicio de sesión', 'Login exitoso');

  res.json({ token, user: sessionUser });
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  if (token) sessions.delete(token);
  res.json({ message: 'Sesión finalizada' });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Users CRUD (Admin)
app.get('/api/users', authMiddleware, requireRole('admin', 'supervisor'), (req, res) => {
  const users = db.prepare('SELECT id, username, full_name, role, area, activo, created_at FROM users ORDER BY id ASC').all();
  res.json(users);
});

app.post('/api/users', authMiddleware, requireRole('admin'), (req, res) => {
  const { username, password, full_name, role, area } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (exists) {
    return res.status(400).json({ error: 'El nombre de usuario ya existe' });
  }

  const { hash, salt } = hashPassword(password);
  const stmt = db.prepare(`
    INSERT INTO users (username, password_hash, salt, full_name, role, area)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(username.trim(), hash, salt, full_name.trim(), role || 'operador', area || '');

  logAudit(req.user.username, 'users', result.lastInsertRowid, 'INSERT', null, null, username, 'Creación de usuario');
  res.status(201).json({ message: 'Usuario creado exitosamente', id: result.lastInsertRowid });
});

app.put('/api/users/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const { full_name, role, area, activo, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (password && password.trim()) {
    const { hash, salt } = hashPassword(password);
    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, id);
    logAudit(req.user.username, 'users', id, 'UPDATE', 'password', null, '[RESETEO]', 'Cambio de contraseña');
  }

  db.prepare(`
    UPDATE users SET full_name = ?, role = ?, area = ?, activo = ? WHERE id = ?
  `).run(
    full_name !== undefined ? full_name : user.full_name,
    role !== undefined ? role : user.role,
    area !== undefined ? area : user.area,
    activo !== undefined ? Number(activo) : user.activo,
    id
  );

  logAudit(req.user.username, 'users', id, 'UPDATE', 'profile', null, user.username, 'Actualización de usuario');
  res.json({ message: 'Usuario actualizado' });
});

// ==========================================
// 2. RDO (REPORTE DIARIO DE OPERACIONES)
// ==========================================

app.get('/api/rdo', authMiddleware, (req, res) => {
  const { fecha, guardia } = req.query;
  if (!fecha) {
    return res.status(400).json({ error: 'Parámetro fecha requerido' });
  }

  let entries, bitacora;
  if (guardia && guardia !== 'ALL') {
    entries = db.prepare('SELECT * FROM rdo_entries WHERE fecha = ? AND guardia = ?').all(fecha, guardia);
    bitacora = db.prepare('SELECT * FROM bitacora WHERE fecha = ? AND guardia = ? ORDER BY id ASC').all(fecha, guardia);
  } else {
    entries = db.prepare('SELECT * FROM rdo_entries WHERE fecha = ? ORDER BY area, id ASC').all(fecha);
    bitacora = db.prepare('SELECT * FROM bitacora WHERE fecha = ? ORDER BY guardia, id ASC').all(fecha);
  }

  res.json({ entries, bitacora });
});

// Copy previous shift values helper
app.post('/api/rdo/copy-previous', authMiddleware, (req, res) => {
  const { fecha, targetGuardia } = req.body;
  if (!fecha || !targetGuardia) {
    return res.status(400).json({ error: 'Fecha y guardia de destino requeridos' });
  }

  // Determine previous shift
  let prevFecha = fecha;
  let prevGuardia = 'A';
  if (targetGuardia === 'B') {
    prevGuardia = 'A';
  } else if (targetGuardia === 'C') {
    prevGuardia = 'B';
  } else if (targetGuardia === 'A') {
    prevGuardia = 'C';
    const d = new Date(`${fecha}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    prevFecha = d.toISOString().split('T')[0];
  }

  const prevEntries = db.prepare('SELECT * FROM rdo_entries WHERE fecha = ? AND guardia = ?').all(prevFecha, prevGuardia);
  if (prevEntries.length === 0) {
    return res.status(404).json({ error: `No se encontraron datos previos en Guardia ${prevGuardia} (${prevFecha})` });
  }

  const upsert = db.prepare(`
    INSERT INTO rdo_entries (fecha, guardia, area, parametro, valor, registrado_por, fecha_registro)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(fecha, guardia, area, parametro) DO UPDATE SET
      valor = excluded.valor,
      registrado_por = excluded.registrado_por,
      fecha_registro = excluded.fecha_registro
  `);

  db.exec('BEGIN TRANSACTION');
  try {
    let copied = 0;
    for (const e of prevEntries) {
      upsert.run(fecha, targetGuardia, e.area, e.parametro, e.valor, req.user.username);
      copied++;
    }
    db.exec('COMMIT');

    logAudit(req.user.username, 'rdo_entries', `${fecha}_${targetGuardia}`, 'COPY', 'previous_shift', null, `${copied} params`, `Copiado desde Guardia ${prevGuardia} (${prevFecha})`);
    broadcastEvent('RDO_UPDATE', { fecha, guardia: targetGuardia, user: req.user.username });
    scheduleLiveSync();

    res.json({ message: `Se copiaron ${copied} parámetros desde Guardia ${prevGuardia} (${prevFecha})`, count: copied });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rdo', authMiddleware, (req, res) => {
  const { fecha, guardia, area, entries, bitacoraDetalle } = req.body;
  if (!fecha || !guardia || !area) {
    return res.status(400).json({ error: 'Faltan datos obligatorios (fecha, guardia, área)' });
  }

  const upsert = db.prepare(`
    INSERT INTO rdo_entries (fecha, guardia, area, parametro, valor, registrado_por, fecha_registro)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(fecha, guardia, area, parametro) DO UPDATE SET
      valor = excluded.valor,
      registrado_por = excluded.registrado_por,
      fecha_registro = excluded.fecha_registro
  `);

  db.exec('BEGIN TRANSACTION');
  try {
    for (const [param, val] of Object.entries(entries || {})) {
      upsert.run(fecha, guardia, area, param, String(val ?? ''), req.user.username);
    }

    if (bitacoraDetalle && bitacoraDetalle.trim()) {
      db.prepare(`
        INSERT INTO bitacora (fecha, guardia, area, detalle, registrado_por)
        VALUES (?, ?, ?, ?, ?)
      `).run(fecha, guardia, area, bitacoraDetalle.trim(), req.user.username);
    }

    db.exec('COMMIT');
    logAudit(req.user.username, 'rdo_entries', `${fecha}_${guardia}_${area}`, 'INSERT/UPDATE', 'entries', null, `${Object.keys(entries || {}).length} params`, 'Guardado RDO');
    broadcastEvent('RDO_UPDATE', { fecha, guardia, area, user: req.user.username });
    scheduleLiveSync();

    res.json({ message: 'Datos de RDO guardados correctamente' });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. CONCENTRADO / PRODUCCIÓN HORARIA
// ==========================================

app.get('/api/concentrado', authMiddleware, (req, res) => {
  const { fecha } = req.query;
  if (!fecha) return res.status(400).json({ error: 'Parámetro fecha requerido' });

  let rows = db.prepare('SELECT * FROM concentrado WHERE fecha = ? ORDER BY num_hora ASC').all(fecha);
  
  // If not yet initialized for this day, generate 24 standard hour slots starting at 09:00
  if (rows.length === 0) {
    const hours = [
      '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00',
      '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00',
      '17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00', '20:00 - 21:00',
      '21:00 - 22:00', '22:00 - 23:00', '23:00 - 00:00', '00:00 - 01:00',
      '01:00 - 02:00', '02:00 - 03:00', '03:00 - 04:00', '04:00 - 05:00',
      '05:00 - 06:00', '06:00 - 07:00', '07:00 - 08:00', '08:00 - 09:00'
    ];
    rows = hours.map((h, i) => ({
      fecha,
      num_hora: i + 1,
      hora: h,
      mineral_tms: 0,
      concentrado_tms: 0,
      s_pct: 0,
      rm123_dtt_s: 0,
      rm123_dtt_sf: 0,
      rm56789_dtt_s: 0,
      rm56789_dtt_sf: 0,
      esp_ant_fe: 0,
      esp_n_fe_sol: 0,
      esp_ant_feo: 0,
      esp_n_feo: 0,
      h2o_pct: 0,
      prom_fe_sol: 0,
      prom_feo: 0,
      recup_pct: 0,
      ratio: 0,
      obs_magnetica: '',
      obs_filtros: '',
      registrado_por: ''
    }));
  }

  res.json(rows);
});

app.post('/api/concentrado', authMiddleware, (req, res) => {
  const { fecha, rows } = req.body;
  if (!fecha || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  const upsert = db.prepare(`
    INSERT INTO concentrado (
      fecha, num_hora, hora, mineral_tms, concentrado_tms, s_pct,
      rm123_dtt_s, rm123_dtt_sf, rm56789_dtt_s, rm56789_dtt_sf,
      esp_ant_fe, esp_n_fe_sol, esp_ant_feo, esp_n_feo, h2o_pct,
      prom_fe_sol, prom_feo, recup_pct, ratio,
      obs_magnetica, obs_filtros, registrado_por, fecha_registro
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(fecha, num_hora) DO UPDATE SET
      hora = excluded.hora,
      mineral_tms = excluded.mineral_tms,
      concentrado_tms = excluded.concentrado_tms,
      s_pct = excluded.s_pct,
      rm123_dtt_s = excluded.rm123_dtt_s,
      rm123_dtt_sf = excluded.rm123_dtt_sf,
      rm56789_dtt_s = excluded.rm56789_dtt_s,
      rm56789_dtt_sf = excluded.rm56789_dtt_sf,
      esp_ant_fe = excluded.esp_ant_fe,
      esp_n_fe_sol = excluded.esp_n_fe_sol,
      esp_ant_feo = excluded.esp_ant_feo,
      esp_n_feo = excluded.esp_n_feo,
      h2o_pct = excluded.h2o_pct,
      prom_fe_sol = excluded.prom_fe_sol,
      prom_feo = excluded.prom_feo,
      recup_pct = excluded.recup_pct,
      ratio = excluded.ratio,
      obs_magnetica = excluded.obs_magnetica,
      obs_filtros = excluded.obs_filtros,
      registrado_por = excluded.registrado_por,
      fecha_registro = excluded.fecha_registro
  `);

  db.exec('BEGIN TRANSACTION');
  try {
    for (const r of rows) {
      const mineral = Number(r.mineral_tms || 0);
      const conc = Number(r.concentrado_tms || 0);
      const feSol = Number(r.esp_n_fe_sol || 0);
      const feO = Number(r.esp_n_feo || 0);

      // Automated mining calculations
      const ratio = conc > 0 ? (mineral / conc) : 0;
      const recup = (mineral > 0 && conc > 0 && feSol > 0) ? ((conc * 68) / (mineral * feSol) * 100) : 0;

      upsert.run(
        fecha,
        Number(r.num_hora),
        String(r.hora || ''),
        mineral,
        conc,
        Number(r.s_pct || 0),
        Number(r.rm123_dtt_s || 0),
        Number(r.rm123_dtt_sf || 0),
        Number(r.rm56789_dtt_s || 0),
        Number(r.rm56789_dtt_sf || 0),
        Number(r.esp_ant_fe || 0),
        feSol,
        Number(r.esp_ant_feo || 0),
        feO,
        Number(r.h2o_pct || 0),
        feSol,
        feO,
        parseFloat(recup.toFixed(2)),
        parseFloat(ratio.toFixed(2)),
        String(r.obs_magnetica || ''),
        String(r.obs_filtros || ''),
        req.user.username
      );
    }
    db.exec('COMMIT');

    logAudit(req.user.username, 'concentrado', fecha, 'INSERT/UPDATE', 'all_hours', null, `${rows.length} horas`, 'Guardado Producción Horaria');
    broadcastEvent('CONCENTRADO_UPDATE', { fecha, user: req.user.username });
    scheduleLiveSync();

    res.json({ message: 'Producción horaria guardada y calculada exitosamente' });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. CONTROLES DE PLANTA (FILTROS H2O, PURGA, COBBER, ETC.)
// ==========================================

app.get('/api/cat_controles', authMiddleware, (req, res) => {
  const items = db.prepare('SELECT * FROM cat_controles WHERE activo = "SI" ORDER BY modulo, item').all();
  res.json(items);
});

app.get('/api/controles', authMiddleware, (req, res) => {
  const { fecha, modulo } = req.query;
  if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });

  let query = 'SELECT * FROM controles_planta WHERE fecha = ?';
  const params = [fecha];
  if (modulo) {
    query += ' AND modulo = ?';
    params.push(modulo);
  }
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

app.post('/api/controles', authMiddleware, (req, res) => {
  const { fecha, modulo, entries } = req.body; // entries: [{ item, turno, valor, observacion }]
  if (!fecha || !modulo || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const upsert = db.prepare(`
    INSERT INTO controles_planta (clave, fecha, modulo, item, turno, valor, observacion, registrado_por, fecha_registro)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(clave) DO UPDATE SET
      valor = excluded.valor,
      observacion = excluded.observacion,
      registrado_por = excluded.registrado_por,
      fecha_registro = excluded.fecha_registro
  `);

  db.exec('BEGIN TRANSACTION');
  try {
    for (const e of entries) {
      const clave = `${fecha}_${modulo}_${e.item}_${e.turno}`;
      upsert.run(clave, fecha, modulo, String(e.item), String(e.turno), String(e.valor || ''), String(e.observacion || ''), req.user.username);
    }
    db.exec('COMMIT');

    logAudit(req.user.username, 'controles_planta', `${fecha}_${modulo}`, 'INSERT/UPDATE', 'entries', null, `${entries.length} items`, `Guardado controles ${modulo}`);
    broadcastEvent('CONTROLES_UPDATE', { fecha, modulo, user: req.user.username });
    scheduleLiveSync();

    res.json({ message: 'Controles de planta guardados correctamente' });
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. FALLAS Y PARADAS
// ==========================================

app.get('/api/paradas', authMiddleware, (req, res) => {
  const { fecha } = req.query;
  let rows;
  if (fecha) {
    rows = db.prepare('SELECT * FROM paradas WHERE fecha = ? ORDER BY id DESC').all(fecha);
  } else {
    rows = db.prepare('SELECT * FROM paradas ORDER BY fecha DESC, id DESC LIMIT 200').all();
  }
  res.json(rows);
});

app.post('/api/paradas', authMiddleware, (req, res) => {
  const { fecha, equipo, inicio_parada, arranque, tmh_no_procesadas, tipo_falla, motivo, control } = req.body;
  if (!fecha || !equipo || !inicio_parada || !arranque) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // Calculate hours lost between inicio and arranque
  let horasPerdidas = 0;
  try {
    const t1 = new Date(`${fecha}T${inicio_parada}:00`);
    let t2 = new Date(`${fecha}T${arranque}:00`);
    if (t2 < t1) { // Crosses midnight
      t2 = new Date(t2.getTime() + 24 * 60 * 60 * 1000);
    }
    horasPerdidas = parseFloat(((t2 - t1) / (1000 * 60 * 60)).toFixed(2));
  } catch {
    horasPerdidas = 0;
  }

  const tmh = Number(tmh_no_procesadas || 0);
  const mineralNoProc = parseFloat((horasPerdidas * tmh).toFixed(2));
  const concNoProd = parseFloat((mineralNoProc * 0.35).toFixed(2)); // Standard plant factor

  const stmt = db.prepare(`
    INSERT INTO paradas (
      fecha, equipo, inicio_parada, arranque, horas_perdidas,
      tmh_no_procesadas, mineral_no_procesado, concentrado_no_producido,
      tipo_falla, motivo, control, registrado_por
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    fecha, equipo, inicio_parada, arranque, horasPerdidas,
    tmh, mineralNoProc, concNoProd,
    tipo_falla || 'MECÁNICA', motivo || '', control || '', req.user.username
  );

  logAudit(req.user.username, 'paradas', result.lastInsertRowid, 'INSERT', null, null, `${equipo}: ${horasPerdidas}h`, 'Nueva parada registrada');
  broadcastEvent('PARADAS_UPDATE', { fecha, id: result.lastInsertRowid });
  scheduleLiveSync();

  res.status(201).json({ message: 'Parada registrada exitosamente', id: result.lastInsertRowid });
});

app.delete('/api/paradas/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM paradas WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Parada no encontrada' });

  db.prepare('DELETE FROM paradas WHERE id = ?').run(id);
  logAudit(req.user.username, 'paradas', id, 'DELETE', null, `${existing.equipo} (${existing.fecha})`, null, 'Eliminación de parada');
  broadcastEvent('PARADAS_UPDATE', { id });
  scheduleLiveSync();

  res.json({ message: 'Parada eliminada' });
});

// ==========================================
// 6. MANTENIMIENTO & BOMBAS
// ==========================================

app.get('/api/mantto', authMiddleware, (req, res) => {
  const { fecha } = req.query;
  const query = fecha
    ? 'SELECT * FROM mantto WHERE fecha = ? ORDER BY id DESC'
    : 'SELECT * FROM mantto ORDER BY fecha DESC, id DESC LIMIT 150';
  const rows = db.prepare(query).all(...(fecha ? [fecha] : []));
  res.json(rows);
});

app.post('/api/mantto', authMiddleware, (req, res) => {
  const { fecha, guardia, area, equipo, aviso_sap, especialidad, tipo, trabajo_realizado, inicio, fin, horas, estado, responsable, observaciones } = req.body;
  if (!fecha || !equipo || !trabajo_realizado) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const stmt = db.prepare(`
    INSERT INTO mantto (fecha, guardia, area, equipo, aviso_sap, especialidad, tipo, trabajo_realizado, inicio, fin, horas, estado, responsable, observaciones, registrado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    fecha, guardia || 'A', area || 'PLANTA', equipo, aviso_sap || '', especialidad || 'MECÁNICA',
    tipo || 'CORRECTIVO', trabajo_realizado, inicio || '', fin || '', Number(horas || 0),
    estado || 'Cerrado', responsable || '', observaciones || '', req.user.username
  );

  logAudit(req.user.username, 'mantto', result.lastInsertRowid, 'INSERT', null, null, `${equipo}: ${trabajo_realizado}`, 'Registro mantenimiento');
  broadcastEvent('MANTTO_UPDATE', { id: result.lastInsertRowid });
  scheduleLiveSync();

  res.status(201).json({ message: 'Trabajo de mantenimiento guardado', id: result.lastInsertRowid });
});

app.get('/api/bombas', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM bombas ORDER BY fecha DESC, id DESC LIMIT 100').all();
  res.json(rows);
});

app.post('/api/bombas', authMiddleware, (req, res) => {
  const { fecha, turno, equipo, componentes_cambiados, tipo_mantto, horas_equipo, observaciones } = req.body;
  if (!fecha || !equipo) return res.status(400).json({ error: 'Fecha y equipo requeridos' });

  const stmt = db.prepare(`
    INSERT INTO bombas (fecha, turno, equipo, componentes_cambiados, tipo_mantto, horas_equipo, observaciones, registrado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(fecha, turno || '1', equipo, componentes_cambiados || '', tipo_mantto || '', Number(horas_equipo || 0), observaciones || '', req.user.username);

  logAudit(req.user.username, 'bombas', result.lastInsertRowid, 'INSERT', null, null, equipo, 'Registro mantto bomba');
  broadcastEvent('BOMBAS_UPDATE', { id: result.lastInsertRowid });
  scheduleLiveSync();

  res.status(201).json({ message: 'Mantenimiento de bomba registrado', id: result.lastInsertRowid });
});

// ==========================================
// 7. BALANZAS
// ==========================================

app.get('/api/balanzas', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM balanzas ORDER BY fecha DESC, id DESC LIMIT 100').all();
  res.json(rows);
});

app.post('/api/balanzas', authMiddleware, (req, res) => {
  const { fecha, equipo, faja, zero_as_found, zero_as_left, span_as_found, span_as_left, observacion } = req.body;
  if (!fecha || !equipo) return res.status(400).json({ error: 'Fecha y equipo requeridos' });

  const zFound = Number(zero_as_found || 0);
  const zLeft = Number(zero_as_left || 0);
  const deltaZ = parseFloat((zLeft - zFound).toFixed(2));
  const errZEnc = zFound !== 0 ? parseFloat((deltaZ / zFound * 100).toFixed(2)) : 0;

  const sFound = Number(span_as_found || 0);
  const sLeft = Number(span_as_left || 0);
  const deltaS = parseFloat((sLeft - sFound).toFixed(2));
  const errSEnc = sFound !== 0 ? parseFloat((deltaS / sFound * 100).toFixed(2)) : 0;

  const stmt = db.prepare(`
    INSERT INTO balanzas (
      fecha, equipo, faja, zero_as_found, zero_as_left, delta_zero, err_zero_enc, err_zero_dej,
      span_as_found, span_as_left, delta_span, err_span_enc, err_span_dej, observacion, registrado_por
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    fecha, equipo, faja || '', zFound, zLeft, deltaZ, errZEnc, 0,
    sFound, sLeft, deltaS, errSEnc, 0, observacion || '', req.user.username
  );

  logAudit(req.user.username, 'balanzas', result.lastInsertRowid, 'INSERT', null, null, equipo, 'Calibración balanza');
  broadcastEvent('BALANZAS_UPDATE', { id: result.lastInsertRowid });
  scheduleLiveSync();

  res.status(201).json({ message: 'Calibración de balanza guardada', id: result.lastInsertRowid });
});

// ==========================================
// 8. EQUIPOS (AUTOCOMPLETE & SEARCH)
// ==========================================

app.get('/api/equipos', authMiddleware, (req, res) => {
  const { q } = req.query;
  let rows;
  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    rows = db.prepare('SELECT * FROM equipos WHERE codigo LIKE ? OR descripcion LIKE ? OR area LIKE ? LIMIT 50').all(term, term, term);
  } else {
    rows = db.prepare('SELECT * FROM equipos ORDER BY area, codigo LIMIT 100').all();
  }
  res.json(rows);
});

// ==========================================
// 9. AUDITORIA & KPIS
// ==========================================

app.get('/api/auditoria', authMiddleware, requireRole('admin', 'supervisor'), (req, res) => {
  const rows = db.prepare('SELECT * FROM auditoria ORDER BY id DESC LIMIT 200').all();
  res.json(rows);
});

app.get('/api/kpi', authMiddleware, (req, res) => {
  const { fecha } = req.query;
  const targetDate = fecha || new Date().toISOString().split('T')[0];

  const concStats = db.prepare(`
    SELECT
      COUNT(*) as horas_cargadas,
      SUM(mineral_tms) as total_mineral,
      SUM(concentrado_tms) as total_concentrado,
      AVG(recup_pct) as prom_recuperacion,
      AVG(esp_n_fe_sol) as prom_ley_fe
    FROM concentrado WHERE fecha = ?
  `).get(targetDate);

  const paradasStats = db.prepare(`
    SELECT
      COUNT(*) as total_paradas,
      SUM(horas_perdidas) as total_horas_perdidas,
      SUM(mineral_no_procesado) as mineral_perdido
    FROM paradas WHERE fecha = ?
  `).get(targetDate);

  res.json({
    fecha: targetDate,
    produccion: concStats,
    paradas: paradasStats
  });
});

// ==========================================
// 10. EXPORTACIÓN A EXCEL EN VIVO
// ==========================================

app.get('/api/export/excel', async (req, res) => {
  try {
    const wb = await generateWorkbook();
    const dateStr = req.query.fecha || new Date().toISOString().split('T')[0];
    const filename = `BENEFICIO_ZA_REPORTE_${dateStr}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generando archivo Excel:', err);
    res.status(500).json({ error: 'Error generando archivo Excel: ' + err.message });
  }
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server and perform initial sync
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 SERVIDOR WEB BENEFICIO ZA ACTIVO EN PUERTO ${PORT}`);
  console.log(`👉 Acceso local: http://localhost:${PORT}`);
  console.log(`👉 Archivo Excel local sincronizado: ${consolidatedFilePath}`);
  console.log(`======================================================\n`);
  scheduleLiveSync();
});
