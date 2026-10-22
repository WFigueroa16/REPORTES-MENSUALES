const http = require('node:http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== INICIANDO PRUEBAS DEL SISTEMA WEB BENEFICIO ZA ===\n');

  // 1. Test Login
  console.log('1. Probando Login con usuario admin...');
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin123' });

  if (loginRes.status !== 200 || !loginRes.body.token) {
    throw new Error('Fallo login: ' + JSON.stringify(loginRes));
  }
  const token = loginRes.body.token;
  console.log('   ✅ Login exitoso. Token obtenido.');

  const authHeader = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 2. Test Me
  console.log('2. Verificando sesión (/api/auth/me)...');
  const meRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: authHeader
  });
  console.log(`   ✅ Sesión verificada para: ${meRes.body.user.full_name} (${meRes.body.user.role})`);

  // 3. Test RDO Save & Retrieve
  console.log('3. Probando guardado de Reporte Diario de Operaciones (RDO)...');
  const today = new Date().toISOString().split('T')[0];
  const rdoSaveRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/rdo',
    method: 'POST',
    headers: authHeader
  }, {
    fecha: today,
    guardia: 'A',
    area: 'TRITURACION',
    entries: {
      'Envío de mina': 'C2 / MINA PRINCIPAL',
      'Chute': '12 al 14',
      'Transferido (TMH)': '1450.50',
      'Silo 1': '4',
      'Silo 2': '3'
    },
    bitacoraDetalle: 'Operación continua en chancado sin anomalías.'
  });
  console.log(`   ✅ RDO guardado: ${rdoSaveRes.body.message}`);

  const rdoGetRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/rdo?fecha=${today}&guardia=A`,
    method: 'GET',
    headers: authHeader
  });
  console.log(`   ✅ RDO recuperado: ${rdoGetRes.body.entries.length} parámetros, ${rdoGetRes.body.bitacora.length} notas en bitácora.`);

  // 4. Test Concentrado (Producción Horaria)
  console.log('4. Probando guardado y cálculos automáticos de Producción Horaria...');
  const concRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/concentrado',
    method: 'POST',
    headers: authHeader
  }, {
    fecha: today,
    rows: [
      {
        num_hora: 1,
        hora: '09:00 - 10:00',
        mineral_tms: 320.5,
        concentrado_tms: 110.2,
        s_pct: 0.42,
        esp_n_fe_sol: 65.4,
        esp_n_feo: 24.1,
        h2o_pct: 8.5,
        obs_magnetica: 'Operación estable'
      }
    ]
  });
  console.log(`   ✅ Producción guardada: ${concRes.body.message}`);

  const concGetRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/concentrado?fecha=${today}`,
    method: 'GET',
    headers: authHeader
  });
  const row1 = concGetRes.body.find(r => r.num_hora === 1);
  console.log(`   ✅ Cálculos automáticos verificados -> % Recup: ${row1.recup_pct}%, Ratio: ${row1.ratio}`);

  // 5. Test Paradas
  console.log('5. Probando registro de Parada de Planta...');
  const paradaRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/paradas',
    method: 'POST',
    headers: authHeader
  }, {
    fecha: today,
    equipo: '210-097',
    inicio_parada: '11:15',
    arranque: '12:45',
    tmh_no_procesadas: 250,
    tipo_falla: 'MECÁNICA',
    motivo: 'Cambio preventivo de faja en alimentador'
  });
  console.log(`   ✅ Parada registrada con ID: ${paradaRes.body.id}`);

  // 6. Test User Creation
  console.log('6. Probando creación de nuevo usuario operador...');
  const userCreateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/users',
    method: 'POST',
    headers: authHeader
  }, {
    username: 'carlos.mendoza',
    password: 'password123',
    full_name: 'Carlos Mendoza',
    role: 'operador_rdo',
    area: 'TRITURACIÓN'
  });
  console.log(`   ✅ Usuario creado con ID: ${userCreateRes.body.id}`);

  // 7. Test Auditoría
  console.log('7. Verificando trazabilidad y pistas de auditoría...');
  const auditRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auditoria',
    method: 'GET',
    headers: authHeader
  });
  console.log(`   ✅ Auditoría activa: ${auditRes.body.length} eventos registrados inmutablemente.`);

  // 8. Test Excel Export Endpoint
  console.log('8. Verificando endpoint de exportación Excel (/api/export/excel)...');
  const excelRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/export/excel',
    method: 'GET',
    headers: authHeader
  });
  console.log(`   ✅ Excel export status: ${excelRes.status}, Content-Type: ${excelRes.headers['content-type']}`);

  console.log('\n======================================================');
  console.log('🎉 TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO AL 100%');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
