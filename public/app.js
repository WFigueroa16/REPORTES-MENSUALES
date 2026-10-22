// Beneficio ZA - Matriz Multi-Turno Client Application Logic

const state = {
  token: localStorage.getItem('za_token') || null,
  user: null,
  currentTab: 'tab-dashboard',
  date: null,
  equipos: []
};

// Parameter catalog with aggregation types ('sum', 'avg', 'text')
const RDO_SECTIONS = [
  {
    title: '1. TRITURACIÓN & SILOS DE FINO',
    area: 'TRITURACION',
    icon: 'ph-hammer',
    color: 'text-amber-400',
    params: [
      { name: 'Envío de mina', type: 'text', placeholder: 'ej. C2 / NO HAY ENVIO' },
      { name: 'Chute', type: 'text', placeholder: 'ej. 12 al 14' },
      { name: 'Transferido (TMH)', type: 'sum', unit: 'TMH', placeholder: '0.00' },
      { name: 'Silo 1', type: 'num', unit: 'm', placeholder: '0.0' },
      { name: 'Silo 2', type: 'num', unit: 'm', placeholder: '0.0' },
      { name: 'Silo 3', type: 'num', unit: 'm', placeholder: '0.0' },
      { name: 'Silo 4', type: 'num', unit: 'm', placeholder: '0.0' },
      { name: 'Silo 5', type: 'num', unit: 'm', placeholder: '0.0' },
      { name: 'Silo 6', type: 'num', unit: 'm', placeholder: '0.0' },
      { name: 'Silo 7', type: 'num', unit: 'm', placeholder: '0.0' },
      { name: 'Silo 8', type: 'num', unit: 'm', placeholder: '0.0' },
      { name: 'Silo 9', type: 'num', unit: 'm', placeholder: '0.0' },
      { name: 'Linea 1 (chancadoras)', type: 'text', placeholder: 'ej. 3 C2 / 3 C7' },
      { name: 'Linea 2 (chancadoras)', type: 'text', placeholder: 'ej. Operando chancadoras C2' }
    ]
  },
  {
    title: '2. FILTROS, DESALADORA & CALIDAD',
    area: 'FILTROS',
    icon: 'ph-funnel',
    color: 'text-blue-400',
    params: [
      { name: '053-050 (%)', type: 'num', unit: '%', placeholder: '0.0' },
      { name: '053-008 (%)', type: 'num', unit: '%', placeholder: '0.4' },
      { name: '053-007 (%)', type: 'num', unit: '%', placeholder: '0.5' },
      { name: '% Humedad (%)', type: 'avg', unit: '%', placeholder: '8.4' },
      { name: 'Malla -325', type: 'avg', unit: '%', placeholder: '65.0' },
      { name: '%S', type: 'avg', unit: '%', placeholder: '0.00' },
      { name: 'TMS', type: 'sum', unit: 'TMS', placeholder: '0.00' },
      { name: 'Bbas de captación', type: 'text', placeholder: 'ej. 3,4' },
      { name: 'Unidades de SF', type: 'text', placeholder: 'ej. 11' },
      { name: 'Unidades de UF', type: 'text', placeholder: 'ej. 12' },
      { name: 'Unidades de RO', type: 'text', placeholder: 'ej. 16' },
      { name: 'Nivel de TK - Pq 7 (m)', type: 'num', unit: 'm', placeholder: '7.8' },
      { name: 'Flujo a Pq 7 (m3/h)', type: 'num', unit: 'm3/h', placeholder: '670' },
      { name: 'TK de filtros (mt)', type: 'num', unit: 'mt', placeholder: '4.5' },
      { name: 'Flujo a Filtros (m3/h)', type: 'num', unit: 'm3/h', placeholder: '360' },
      { name: 'Conductividad Us/cm', type: 'num', unit: 'Us/cm', placeholder: '980' }
    ]
  },
  {
    title: '3. PLANTA MAGNÉTICA & MOLIENDA',
    area: 'PLANTA MAGNETICA',
    icon: 'ph-magnet',
    color: 'text-amber-400',
    params: [
      { name: 'Tratamiento (Ton)', type: 'sum', unit: 'Ton', placeholder: '0.00' },
      { name: 'Molinos de barras', type: 'text', placeholder: 'ej. 1,2,3,5,6,7,8,9' },
      { name: 'Molinos de bolas', type: 'text', placeholder: 'ej. 1,2,3,4,5,6,8,9,10' },
      { name: 'Separadores Magneticos', type: 'text', placeholder: 'ej. Operando 16 unidades' },
      { name: 'Celdas de flotación', type: 'text', placeholder: 'ej. Normal' }
    ]
  },
  {
    title: '4. ÁREA RELAVES & BOMBEO',
    area: 'RELAVES',
    icon: 'ph-waves',
    color: 'text-cyan-400',
    params: [
      { name: 'CB1 - Linea', type: 'text', placeholder: 'ej. AX3' },
      { name: 'CB1 - Presión (PSI)', type: 'num', unit: 'PSI', placeholder: '110' },
      { name: 'CB1 - Flujo (GPM)', type: 'num', unit: 'GPM', placeholder: '2800' },
      { name: 'CB1 - BOMBAS DE RECUPERACION', type: 'text', placeholder: '1H/1V' },
      { name: 'CB1 - NIVEL DE POZA', type: 'text', placeholder: '1.7' },
      { name: 'R2 - Linea', type: 'text', placeholder: 'ej. L1' },
      { name: 'R2 - Presión (PSI)', type: 'num', unit: 'PSI', placeholder: '114' },
      { name: 'R2 - Flujo (GPM)', type: 'num', unit: 'GPM', placeholder: '2710' },
      { name: 'R2 - BOMBAS DE RECUPERACION', type: 'text', placeholder: '4h' },
      { name: 'CB2 - Linea', type: 'text', placeholder: 'ej. AX1' },
      { name: 'CB2 - Presión (PSI)', type: 'num', unit: 'PSI', placeholder: '47' },
      { name: 'CB2 - Enviado a:', type: 'text', placeholder: 'Shouxin / Choclón' }
    ]
  },
  {
    title: '5. EMBARQUE & DESPACHO',
    area: 'EMBARQUE',
    icon: 'ph-boat',
    color: 'text-emerald-400',
    params: [
      { name: 'Nave', type: 'text', placeholder: 'ej. M/V NEW FUTURE' },
      { name: 'Material', type: 'text', placeholder: 'FKPS' },
      { name: 'Embarcado  (TMH)', type: 'sum', unit: 'TMH', placeholder: '0.00' },
      { name: 'Fecha de inicio', type: 'text', placeholder: 'dd/mm/aaaa hh:mm' },
      { name: 'Fecha de Término', type: 'text', placeholder: 'dd/mm/aaaa hh:mm' }
    ]
  }
];

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  setupInitialDate();
  setupTabNavigation();
  setupEventListeners();

  if (state.token) {
    await checkSession();
  } else {
    showLoginModal();
  }
});

function setupInitialDate() {
  const now = new Date();
  if (now.getHours() < 9) {
    now.setDate(now.getDate() - 1);
  }
  state.date = now.toISOString().split('T')[0];
  updateDateDisplays();
}

function updateDateDisplays() {
  const inp = document.getElementById('global-date');
  if (inp) inp.value = state.date;
  const dashBadge = document.getElementById('dash-date-badge');
  if (dashBadge) dashBadge.textContent = state.date;
  const paradaFecha = document.getElementById('parada-fecha');
  if (paradaFecha) paradaFecha.value = state.date;
}

function setupEventListeners() {
  document.getElementById('global-date')?.addEventListener('change', (e) => {
    state.date = e.target.value;
    updateDateDisplays();
    loadActiveTabData();
  });

  document.getElementById('btn-prev-day')?.addEventListener('click', () => {
    changeDateOffset(-1);
  });
  document.getElementById('btn-next-day')?.addEventListener('click', () => {
    changeDateOffset(1);
  });

  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);

  document.getElementById('btn-save-rdo-matrix')?.addEventListener('click', saveRdoMatrix);
  document.getElementById('btn-save-concentrado')?.addEventListener('click', saveConcentrado);
  document.getElementById('btn-save-controles')?.addEventListener('click', saveControles);
  document.getElementById('form-parada')?.addEventListener('submit', handleCreateParada);

  document.getElementById('btn-new-user')?.addEventListener('click', () => {
    document.getElementById('user-modal')?.classList.remove('hidden');
  });
  document.getElementById('btn-close-user-modal')?.addEventListener('click', () => {
    document.getElementById('user-modal')?.classList.add('hidden');
  });
  document.getElementById('form-create-user')?.addEventListener('submit', handleCreateUser);

  document.getElementById('btn-refresh-kpi')?.addEventListener('click', loadDashboardKPIs);
  document.getElementById('btn-refresh-auditoria')?.addEventListener('click', loadAuditoria);
}

function changeDateOffset(delta) {
  const [y, m, d] = state.date.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  cur.setUTCDate(cur.getUTCDate() + delta);
  state.date = cur.toISOString().split('T')[0];
  updateDateDisplays();
  loadActiveTabData();
}

function setupTabNavigation() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(state.currentTab)?.classList.add('active');

      loadActiveTabData();
    });
  });
}

function loadActiveTabData() {
  switch (state.currentTab) {
    case 'tab-dashboard':
      loadDashboardKPIs();
      break;
    case 'tab-rdo-matrix':
      loadRdoMatrix();
      break;
    case 'tab-concentrado-24h':
      loadConcentrado();
      break;
    case 'tab-controles-turnos':
      loadControles();
      break;
    case 'tab-paradas':
      loadParadas();
      break;
    case 'tab-mantto':
      loadMantto();
      break;
    case 'tab-balanzas':
      loadBalanzas();
      break;
    case 'tab-users':
      loadUsers();
      break;
    case 'tab-auditoria':
      loadAuditoria();
      break;
  }
}

// ==========================================
// API CLIENT & SSE
// ==========================================

async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(endpoint, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    if (endpoint !== '/api/auth/login') {
      showLoginModal();
      throw new Error('Sesión requerida');
    } else {
      throw new Error(data.error || 'Credenciales inválidas');
    }
  }

  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data;
}

function connectSSE() {
  const eventSource = new EventSource('/api/events');
  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'CONNECTED') return;
      showToast(`Actualización en tiempo real recibida`, 'info');
      loadActiveTabData();
    } catch {}
  };
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-red-600' : (type === 'info' ? 'bg-blue-600' : 'bg-emerald-600');
  toast.className = `toast px-4 py-3 rounded-2xl shadow-2xl text-white text-xs font-bold flex items-center gap-2.5 pointer-events-auto ${bg} border border-white/20`;
  toast.innerHTML = `
    <i class="ph-bold ${type === 'error' ? 'ph-warning' : 'ph-check-circle'} text-lg"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ==========================================
// AUTHENTICATION
// ==========================================

function showLoginModal() {
  document.getElementById('login-modal')?.classList.remove('hidden');
}

function hideLoginModal() {
  document.getElementById('login-modal')?.classList.add('hidden');
}

async function handleLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const errorDiv = document.getElementById('login-error');
  const submitBtn = document.getElementById('btn-login-submit');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';

  if (!username || !password) {
    document.getElementById('login-error-text').textContent = 'Ingresa tu usuario y contraseña';
    errorDiv.classList.remove('hidden');
    return;
  }

  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i><span>Verificando...</span>`;
  }

  try {
    errorDiv.classList.add('hidden');
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    state.token = res.token;
    state.user = res.user;
    localStorage.setItem('za_token', res.token);
    hideLoginModal();
    updateUserUI();
    connectSSE();
    loadEquiposCatalog();
    loadActiveTabData();
    showToast(`Bienvenido a Planta, ${state.user.full_name}`, 'success');
  } catch (err) {
    document.getElementById('login-error-text').textContent = err.message;
    errorDiv.classList.remove('hidden');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }
}

async function checkSession() {
  try {
    const res = await api('/api/auth/me');
    state.user = res.user;
    hideLoginModal();
    updateUserUI();
    connectSSE();
    loadEquiposCatalog();
    loadActiveTabData();
  } catch {
    showLoginModal();
  }
}

function handleLogout() {
  api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  localStorage.removeItem('za_token');
  state.token = null;
  state.user = null;
  showLoginModal();
}

function updateUserUI() {
  if (!state.user) return;
  document.getElementById('user-display-name').textContent = state.user.full_name;
  document.getElementById('user-role-badge').textContent = state.user.role.toUpperCase();
  document.getElementById('user-avatar').textContent = state.user.full_name.charAt(0);

  const isAdminOrSup = state.user.role === 'admin' || state.user.role === 'supervisor';
  const usersTab = document.querySelector('[data-tab="tab-users"]');
  const auditTab = document.querySelector('[data-tab="tab-auditoria"]');
  if (usersTab) usersTab.style.display = isAdminOrSup ? 'flex' : 'none';
  if (auditTab) auditTab.style.display = isAdminOrSup ? 'flex' : 'none';
}

async function loadEquiposCatalog() {
  try {
    const equipos = await api('/api/equipos');
    state.equipos = equipos;
    const datalist = document.getElementById('equipos-datalist');
    if (datalist) {
      datalist.innerHTML = equipos.map(eq =>
        `<option value="${eq.codigo}">${eq.codigo} - ${eq.descripcion} (${eq.area})</option>`
      ).join('');
    }
  } catch {}
}

// ==========================================
// TAB 1: DASHBOARD
// ==========================================

async function loadDashboardKPIs() {
  try {
    const data = await api(`/api/kpi?fecha=${state.date}`);
    const prod = data.produccion || {};
    const par = data.paradas || {};

    document.getElementById('kpi-mineral').textContent = Number(prod.total_mineral || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('kpi-concentrado').textContent = Number(prod.total_concentrado || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('kpi-recup').textContent = `${Number(prod.prom_recuperacion || 0).toFixed(1)}%`;
    document.getElementById('kpi-horas-perdidas').textContent = Number(par.total_horas_perdidas || 0).toFixed(2);
    document.getElementById('kpi-paradas-count').textContent = par.total_paradas || 0;

    const rdoData = await api(`/api/rdo?fecha=${state.date}&guardia=ALL`);
    renderGuardiasSummaryGrid(rdoData.entries || []);
  } catch (err) {
    console.error('Error cargando KPIs:', err);
  }
}

function renderGuardiasSummaryGrid(entries) {
  const container = document.getElementById('guardias-summary-grid');
  if (!container) return;

  const guardias = [
    { key: 'A', name: 'Guardia A', hours: '07:00 - 15:00', border: 'border-blue-900/40', badge: 'bg-blue-500 text-slate-950' },
    { key: 'B', name: 'Guardia B', hours: '15:00 - 23:00', border: 'border-amber-900/40', badge: 'bg-amber-500 text-slate-950' },
    { key: 'C', name: 'Guardia C', hours: '23:00 - 07:00', border: 'border-purple-900/40', badge: 'bg-purple-500 text-slate-950' }
  ];

  container.innerHTML = guardias.map(g => {
    const gEntries = entries.filter(e => e.guardia === g.key);
    const transferido = gEntries.find(e => e.parametro === 'Transferido (TMH)')?.valor || '0';
    const envioMina = gEntries.find(e => e.parametro === 'Envío de mina')?.valor || '-';
    const humedad = gEntries.find(e => e.parametro === '% Humedad (%)')?.valor || '-';
    const tratamiento = gEntries.find(e => e.parametro === 'Tratamiento (Ton)')?.valor || '-';

    return `
      <div class="bg-slate-950 p-4 rounded-2xl border ${g.border} space-y-3 shadow-lg">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-lg ${g.badge} font-black text-xs flex items-center justify-center">${g.key}</span>
            <div>
              <span class="font-bold text-white text-xs block">${g.name}</span>
              <span class="text-[10px] text-slate-500 font-mono">${g.hours}</span>
            </div>
          </div>
          <span class="text-[11px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded">${gEntries.length} items</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span class="text-slate-500 block text-[10px] font-bold">Envío Mina:</span>
            <span class="font-mono font-bold text-slate-200 truncate block">${envioMina}</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px] font-bold">Transferido Sinter:</span>
            <span class="font-mono font-bold text-amber-400 block">${transferido} TMH</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px] font-bold">% Humedad:</span>
            <span class="font-mono font-bold text-blue-400 block">${humedad}%</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px] font-bold">Tratamiento Magnética:</span>
            <span class="font-mono font-bold text-emerald-400 block">${tratamiento} Ton</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// TAB 2: MATRIZ RDO 3 GUARDIAS (LADO A LADO)
// ==========================================

async function loadRdoMatrix() {
  try {
    const data = await api(`/api/rdo?fecha=${state.date}&guardia=ALL`);
    const entries = data.entries || [];
    const bitacora = data.bitacora || [];

    // Map: key = `${area}_${parametro}_${guardia}`
    const map = {};
    entries.forEach(e => {
      map[`${e.area}_${e.parametro}_${e.guardia}`] = e.valor;
    });

    renderRdoMatrixTable(map);
    renderMatrixSilos(map);
    renderBitacorasThreeShifts(bitacora);
  } catch (err) {
    showToast('Error cargando Matriz RDO: ' + err.message, 'error');
  }
}

function renderRdoMatrixTable(map) {
  const tbody = document.getElementById('tbody-rdo-matrix');
  if (!tbody) return;

  let html = '';

  RDO_SECTIONS.forEach(sec => {
    // Section Header Row
    html += `
      <tr class="bg-slate-950/90 border-y border-slate-700">
        <td colspan="5" class="py-2.5 px-4 font-black text-xs ${sec.color} uppercase tracking-wider flex items-center gap-2">
          <i class="ph-bold ${sec.icon} text-base"></i>
          <span>${sec.title}</span>
        </td>
      </tr>
    `;

    sec.params.forEach(p => {
      const valA = map[`${sec.area}_${p.name}_A`] || '';
      const valB = map[`${sec.area}_${p.name}_B`] || '';
      const valC = map[`${sec.area}_${p.name}_C`] || '';

      const isNumeric = p.type === 'sum' || p.type === 'avg' || p.type === 'num';

      html += `
        <tr class="hover:bg-slate-800/40 transition-colors rdo-matrix-row" data-area="${sec.area}" data-param="${p.name}" data-calc="${p.type}">
          <!-- Param Name -->
          <td class="py-2 px-4 font-bold text-slate-200">
            ${p.name} ${p.unit ? `<span class="text-slate-500 font-normal text-[10px]">(${p.unit})</span>` : ''}
          </td>

          <!-- Guardia A Cell -->
          <td class="py-1.5 px-2 bg-blue-950/10 border-x border-slate-800/60">
            <input type="${isNumeric ? 'number' : 'text'}" ${isNumeric ? 'step="any"' : ''}
              value="${valA}"
              data-guardia="A"
              class="rdo-cell w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:border-blue-400"
              placeholder="${p.placeholder || ''}">
          </td>

          <!-- Guardia B Cell -->
          <td class="py-1.5 px-2 bg-amber-950/10 border-r border-slate-800/60">
            <input type="${isNumeric ? 'number' : 'text'}" ${isNumeric ? 'step="any"' : ''}
              value="${valB}"
              data-guardia="B"
              class="rdo-cell w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:border-amber-400"
              placeholder="${p.placeholder || ''}">
          </td>

          <!-- Guardia C Cell -->
          <td class="py-1.5 px-2 bg-purple-950/10 border-r border-slate-800/60">
            <input type="${isNumeric ? 'number' : 'text'}" ${isNumeric ? 'step="any"' : ''}
              value="${valC}"
              data-guardia="C"
              class="rdo-cell w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:border-purple-400"
              placeholder="${p.placeholder || ''}">
          </td>

          <!-- Calculated Total/Average Day Cell -->
          <td class="py-2 px-3 text-right font-mono font-bold text-amber-400 rdo-cell-summary">
            -
          </td>
        </tr>
      `;
    });
  });

  tbody.innerHTML = html;

  // Attach live calculation to row cells
  tbody.querySelectorAll('.rdo-matrix-row').forEach(row => {
    calculateMatrixRowSummary(row);
    row.addEventListener('input', () => calculateMatrixRowSummary(row));
  });
}

function calculateMatrixRowSummary(row) {
  const calcType = row.dataset.calc;
  const summaryCell = row.querySelector('.rdo-cell-summary');
  if (!summaryCell) return;

  if (calcType === 'text') {
    summaryCell.textContent = '-';
    return;
  }

  const vA = parseFloat(row.querySelector('input[data-guardia="A"]')?.value);
  const vB = parseFloat(row.querySelector('input[data-guardia="B"]')?.value);
  const vC = parseFloat(row.querySelector('input[data-guardia="C"]')?.value);

  const nums = [vA, vB, vC].filter(n => !isNaN(n));
  if (nums.length === 0) {
    summaryCell.textContent = '-';
    return;
  }

  if (calcType === 'sum') {
    const total = nums.reduce((a, b) => a + b, 0);
    summaryCell.textContent = total.toLocaleString('es-PE', { maximumFractionDigits: 2 });
  } else if (calcType === 'avg') {
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    summaryCell.textContent = avg.toFixed(2) + ' (prom)';
  } else {
    // num or gauge: display last recorded value
    const last = nums[nums.length - 1];
    summaryCell.textContent = last.toFixed(1);
  }
}

// Render Silos with live levels across Guardias
function renderMatrixSilos(map) {
  const container = document.getElementById('matrix-silos-container');
  if (!container) return;

  container.innerHTML = Array.from({ length: 9 }, (_, i) => {
    const sNum = i + 1;
    // Get latest non-empty level among C, B, A
    const valC = parseFloat(map[`TRITURACION_Silo ${sNum}_C`]);
    const valB = parseFloat(map[`TRITURACION_Silo ${sNum}_B`]);
    const valA = parseFloat(map[`TRITURACION_Silo ${sNum}_A`]);

    const activeVal = !isNaN(valC) ? valC : (!isNaN(valB) ? valB : (!isNaN(valA) ? valA : 3.0));
    const pct = Math.min(100, Math.max(0, (activeVal / 5) * 100));

    let barGradient = 'from-emerald-500 to-emerald-400';
    let statusBadge = '<span class="text-[9px] px-1.5 py-0.5 rounded font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">ÓPTIMO</span>';
    let glowShadow = 'shadow-emerald-500/20';

    if (activeVal < 2.0) {
      barGradient = 'from-red-600 to-rose-500';
      statusBadge = '<span class="text-[9px] px-1.5 py-0.5 rounded font-black bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">CRÍTICO</span>';
      glowShadow = 'shadow-red-500/30';
    } else if (activeVal < 3.5) {
      barGradient = 'from-amber-600 to-amber-400';
      statusBadge = '<span class="text-[9px] px-1.5 py-0.5 rounded font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">MEDIO</span>';
      glowShadow = 'shadow-amber-500/20';
    }

    return `
      <div class="silo-card p-3 flex flex-col items-center justify-between space-y-2 border border-slate-800 bg-slate-900/90 shadow-lg rounded-2xl">
        <div class="w-full flex items-center justify-between">
          <span class="font-mono font-black text-xs text-amber-400 tracking-tight">Silo #${sNum}</span>
          ${statusBadge}
        </div>
        
        <!-- Industrial Silo Cylinder with level gradient and tick marks -->
        <div class="silo-cylinder my-1">
          <div class="silo-markings">
            <span>5m</span>
            <span>4m</span>
            <span>3m</span>
            <span>2m</span>
            <span>1m</span>
            <span>0m</span>
          </div>
          <div class="silo-level-fill bg-gradient-to-t ${barGradient} ${glowShadow}" style="height: ${pct}%;"></div>
        </div>

        <div class="w-full flex items-baseline justify-between pt-1 border-t border-slate-800/80">
          <span class="text-sm font-mono font-black text-white">${activeVal.toFixed(1)} <span class="text-[10px] text-slate-400 font-normal">m</span></span>
          <span class="text-[10px] font-mono text-slate-400 font-bold">${Math.round(pct)}%</span>
        </div>
      </div>
    `;
  }).join('');
}

// Render 3 separate bitacora textareas and historical logs
function renderBitacorasThreeShifts(bitacora) {
  ['A', 'B', 'C'].forEach(g => {
    const histEl = document.getElementById(`bitacora-history-${g}`);
    if (!histEl) return;

    const gNotes = bitacora.filter(b => b.guardia === g);
    if (gNotes.length === 0) {
      histEl.innerHTML = '<span class="text-slate-600 italic">Sin notas guardadas para este turno.</span>';
    } else {
      histEl.innerHTML = gNotes.map(n => `
        <div class="bg-slate-950 p-2 rounded border border-slate-800 text-[11px] mt-1">
          <div class="text-[10px] text-slate-500 mb-0.5">${n.registrado_por} • ${n.fecha_registro}</div>
          <p class="text-slate-300">${n.detalle}</p>
        </div>
      `).join('');
    }
  });
}

async function saveRdoMatrix() {
  const btn = document.getElementById('btn-save-rdo-matrix');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Guardando Matriz...';

  try {
    const rows = document.querySelectorAll('.rdo-matrix-row');

    // Group entries by Guardia and Area
    const payloadByGuardiaArea = {
      'A': {},
      'B': {},
      'C': {}
    };

    rows.forEach(r => {
      const area = r.dataset.area;
      const param = r.dataset.param;

      ['A', 'B', 'C'].forEach(g => {
        if (!payloadByGuardiaArea[g][area]) payloadByGuardiaArea[g][area] = {};
        const val = r.querySelector(`input[data-guardia="${g}"]`)?.value || '';
        payloadByGuardiaArea[g][area][param] = val;
      });
    });

    // Save for each Guardia and Area
    for (const g of ['A', 'B', 'C']) {
      const bitacoraText = document.getElementById(`bitacora-input-${g}`)?.value || '';
      let isFirstArea = true;

      for (const [area, entries] of Object.entries(payloadByGuardiaArea[g])) {
        await api('/api/rdo', {
          method: 'POST',
          body: JSON.stringify({
            fecha: state.date,
            guardia: g,
            area,
            entries,
            bitacoraDetalle: isFirstArea && bitacoraText.trim() ? bitacoraText.trim() : null
          })
        });
        isFirstArea = false;
      }
      if (bitacoraText.trim()) {
        const inp = document.getElementById(`bitacora-input-${g}`);
        if (inp) inp.value = '';
      }
    }

    showToast('Matriz RDO de las 3 Guardias guardada y sincronizada exitosamente', 'success');
    loadRdoMatrix();
    loadDashboardKPIs();
  } catch (err) {
    showToast('Error guardando matriz: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-floppy-disk text-base"></i> Guardar Matriz Completa';
  }
}

// ==========================================
// TAB 3: PRODUCCIÓN 24H CON SUB-TOTALES POR TURNO
// ==========================================

async function loadConcentrado() {
  try {
    const rows = await api(`/api/concentrado?fecha=${state.date}`);
    const tbody = document.getElementById('tbody-concentrado');
    if (!tbody) return;

    let html = '';

    // Split 24 hours into 3 shifts
    const shiftRanges = [
      { name: 'GUARDIA A (09:00 - 17:00)', key: 'A', start: 1, end: 8, badge: 'bg-blue-500 text-slate-950', border: 'border-blue-900/50' },
      { name: 'GUARDIA B (17:00 - 01:00)', key: 'B', start: 9, end: 16, badge: 'bg-amber-500 text-slate-950', border: 'border-amber-900/50' },
      { name: 'GUARDIA C (01:00 - 09:00)', key: 'C', start: 17, end: 24, badge: 'bg-purple-500 text-slate-950', border: 'border-purple-900/50' }
    ];

    shiftRanges.forEach(shift => {
      // Shift Header Row
      html += `
        <tr class="bg-slate-950/80 border-y border-slate-700">
          <td colspan="10" class="py-2.5 px-4 font-black text-xs text-white uppercase tracking-wider flex items-center justify-between">
            <span class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded ${shift.badge} font-black">${shift.key}</span>
              <span>${shift.name}</span>
            </span>
            <span class="text-[11px] text-slate-400 font-mono font-normal">8 Horas de Operación</span>
          </td>
        </tr>
      `;

      // 8 Hour rows for this shift
      const shiftRows = rows.filter(r => r.num_hora >= shift.start && r.num_hora <= shift.end);
      shiftRows.forEach(r => {
        html += `
          <tr class="hover:bg-slate-800/40 transition-colors conc-row" data-hora-idx="${r.num_hora}" data-shift="${shift.key}">
            <td class="py-2 px-3 font-mono font-bold text-slate-300 whitespace-nowrap">
              ${r.hora}
            </td>
            <td class="py-1.5 px-2 text-right">
              <input type="number" step="any" value="${r.mineral_tms || ''}" class="conc-mineral w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-white font-mono focus:border-amber-400">
            </td>
            <td class="py-1.5 px-2 text-right">
              <input type="number" step="any" value="${r.concentrado_tms || ''}" class="conc-prod w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-amber-300 font-mono font-bold focus:border-amber-400">
            </td>
            <td class="py-1.5 px-2 text-right">
              <input type="number" step="any" value="${r.s_pct || ''}" class="conc-s w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-white font-mono focus:border-amber-400">
            </td>
            <td class="py-1.5 px-2 text-right">
              <input type="number" step="any" value="${r.esp_n_fe_sol || ''}" class="conc-fesol w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-white font-mono focus:border-amber-400">
            </td>
            <td class="py-1.5 px-2 text-right">
              <input type="number" step="any" value="${r.esp_n_feo || ''}" class="conc-feo w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-white font-mono focus:border-amber-400">
            </td>
            <td class="py-1.5 px-2 text-right">
              <input type="number" step="any" value="${r.h2o_pct || ''}" class="conc-h2o w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-white font-mono focus:border-amber-400">
            </td>
            <td class="py-2 px-3 text-right font-mono font-black text-emerald-400 calc-recup">
              ${r.recup_pct ? r.recup_pct + '%' : '-'}
            </td>
            <td class="py-2 px-3 text-right font-mono font-black text-purple-400 calc-ratio">
              ${r.ratio ? r.ratio : '-'}
            </td>
            <td class="py-1.5 px-2">
              <input type="text" value="${r.obs_magnetica || ''}" placeholder="Obs..." class="conc-obs w-full min-w-[130px] bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-300">
            </td>
          </tr>
        `;
      });

      // Shift Subtotal Row
      html += `
        <tr class="bg-slate-900 border-b-2 border-slate-700 font-bold text-xs" id="subtotal-row-${shift.key}">
          <td class="py-2.5 px-3 uppercase text-amber-400">SUBTOTAL ${shift.name.split(' ')[0]} ${shift.name.split(' ')[1]}</td>
          <td class="py-2.5 px-2 text-right font-mono text-white sub-mineral">0.00</td>
          <td class="py-2.5 px-2 text-right font-mono text-amber-400 sub-conc">0.00</td>
          <td colspan="4" class="py-2.5 px-2 text-right text-slate-400 text-[11px]">Ley Prom: <span class="font-mono text-white sub-ley">0.0%</span></td>
          <td class="py-2.5 px-3 text-right font-mono text-emerald-400 sub-recup">0.0%</td>
          <td class="py-2.5 px-3 text-right font-mono text-purple-400 sub-ratio">0.00</td>
          <td></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // Attach listener
    tbody.querySelectorAll('.conc-row').forEach(tr => {
      tr.addEventListener('input', () => {
        calculateConcentradoRow(tr);
        update24hTotalsAndSubtotals();
      });
    });

    update24hTotalsAndSubtotals();
  } catch (err) {
    showToast('Error cargando Producción 24h: ' + err.message, 'error');
  }
}

function calculateConcentradoRow(tr) {
  const min = parseFloat(tr.querySelector('.conc-mineral')?.value) || 0;
  const conc = parseFloat(tr.querySelector('.conc-prod')?.value) || 0;
  const feSol = parseFloat(tr.querySelector('.conc-fesol')?.value) || 0;

  const recupCell = tr.querySelector('.calc-recup');
  const ratioCell = tr.querySelector('.calc-ratio');

  if (min > 0 && conc > 0 && feSol > 0) {
    recupCell.textContent = ((conc * 68) / (min * feSol) * 100).toFixed(2) + '%';
    ratioCell.textContent = (min / conc).toFixed(2);
  } else {
    recupCell.textContent = '-';
    ratioCell.textContent = '-';
  }
}

function update24hTotalsAndSubtotals() {
  let totalMineralDay = 0;
  let totalConcDay = 0;
  let sumFeSolDay = 0;
  let countFeSolDay = 0;

  ['A', 'B', 'C'].forEach(g => {
    let subMin = 0;
    let subConc = 0;
    let sumFeSol = 0;
    let countFeSol = 0;

    document.querySelectorAll(`.conc-row[data-shift="${g}"]`).forEach(tr => {
      const min = parseFloat(tr.querySelector('.conc-mineral')?.value) || 0;
      const conc = parseFloat(tr.querySelector('.conc-prod')?.value) || 0;
      const feSol = parseFloat(tr.querySelector('.conc-fesol')?.value) || 0;

      subMin += min;
      subConc += conc;
      if (feSol > 0) {
        sumFeSol += feSol;
        countFeSol++;
      }
    });

    totalMineralDay += subMin;
    totalConcDay += subConc;
    sumFeSolDay += sumFeSol;
    countFeSolDay += countFeSol;

    const avgFe = countFeSol > 0 ? (sumFeSol / countFeSol) : 0;
    const recup = (subMin > 0 && subConc > 0 && avgFe > 0) ? ((subConc * 68) / (subMin * avgFe) * 100) : 0;
    const ratio = subConc > 0 ? (subMin / subConc) : 0;

    // Subtotal table row
    const subRow = document.getElementById(`subtotal-row-${g}`);
    if (subRow) {
      subRow.querySelector('.sub-mineral').textContent = subMin.toFixed(2);
      subRow.querySelector('.sub-conc').textContent = subConc.toFixed(2);
      subRow.querySelector('.sub-ley').textContent = avgFe.toFixed(2) + '%';
      subRow.querySelector('.sub-recup').textContent = recup.toFixed(2) + '%';
      subRow.querySelector('.sub-ratio').textContent = ratio.toFixed(2);
    }

    // Top banner card
    const bannerEl = document.getElementById(`conc-subtotal-${g}`);
    if (bannerEl) bannerEl.textContent = subConc.toFixed(2) + ' TMS';
    const recupEl = document.getElementById(`conc-recup-${g}`);
    if (recupEl) recupEl.textContent = `Recup: ${recup.toFixed(1)}%`;
  });

  const avgFeDay = countFeSolDay > 0 ? (sumFeSolDay / countFeSolDay) : 0;
  const recupDay = (totalMineralDay > 0 && totalConcDay > 0 && avgFeDay > 0) ? ((totalConcDay * 68) / (totalMineralDay * avgFeDay) * 100) : 0;

  const dayTotalEl = document.getElementById('conc-total-day');
  if (dayTotalEl) dayTotalEl.textContent = totalConcDay.toFixed(2) + ' TMS';
  const dayRecupEl = document.getElementById('conc-recup-day');
  if (dayRecupEl) dayRecupEl.textContent = `Recup: ${recupDay.toFixed(1)}%`;
}

async function saveConcentrado() {
  const btn = document.getElementById('btn-save-concentrado');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Guardando...';

  try {
    const rows = [];
    document.querySelectorAll('#tbody-concentrado tr.conc-row').forEach(tr => {
      rows.push({
        num_hora: Number(tr.dataset.horaIdx),
        hora: tr.querySelector('td:first-child').textContent.trim(),
        mineral_tms: tr.querySelector('.conc-mineral').value,
        concentrado_tms: tr.querySelector('.conc-prod').value,
        s_pct: tr.querySelector('.conc-s').value,
        esp_n_fe_sol: tr.querySelector('.conc-fesol').value,
        esp_n_feo: tr.querySelector('.conc-feo').value,
        h2o_pct: tr.querySelector('.conc-h2o').value,
        obs_magnetica: tr.querySelector('.conc-obs').value
      });
    });

    await api('/api/concentrado', {
      method: 'POST',
      body: JSON.stringify({ fecha: state.date, rows })
    });

    showToast('Producción 24h guardada con éxito', 'success');
    loadConcentrado();
    loadDashboardKPIs();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-floppy-disk text-base"></i> Guardar Producción 24h';
  }
}

// ==========================================
// TAB 4: CONTROLES DE PLANTA (1°, 2°, 3° TURNO LADO A LADO)
// ==========================================

async function loadControles() {
  try {
    const saved = await api(`/api/controles?fecha=${state.date}`);
    const savedMap = {};
    saved.forEach(s => savedMap[`${s.modulo}_${s.item}_${s.turno}`] = { valor: s.valor, obs: s.observacion });

    // 1. Filtros H2O: 3 Turnos en paralelo por cada filtro
    const filtrosTbody = document.getElementById('tbody-filtros-turnos');
    if (filtrosTbody) {
      const items = [
        'Filtro # 1', 'Filtro # 2', 'Filtro # 3', 'Filtro # 4', 'Filtro # 5',
        'Filtro Linea # 5', 'Filtro Linea # 6', 'Filtro Linea # 7', 'Filtro Linea # 8'
      ];

      filtrosTbody.innerHTML = items.map(item => {
        const v1 = savedMap[`FILTROS_H2O_${item}_1`]?.valor || 'OK';
        const v2 = savedMap[`FILTROS_H2O_${item}_2`]?.valor || 'OK';
        const v3 = savedMap[`FILTROS_H2O_${item}_3`]?.valor || 'OK';
        const obs = savedMap[`FILTROS_H2O_${item}_1`]?.obs || '';

        return `
          <tr class="hover:bg-slate-800/40 transition-colors" data-filtro-item="${item}">
            <td class="py-2.5 px-4 font-mono font-bold text-white">${item}</td>

            <!-- Turno 1 Button -->
            <td class="py-2 px-3 text-center bg-blue-950/10">
              <button type="button" class="btn-turno-filtro px-3.5 py-1 rounded-lg font-bold text-xs ${v1 === 'OK' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'}" data-turno="1" data-status="${v1}">
                ${v1}
              </button>
            </td>

            <!-- Turno 2 Button -->
            <td class="py-2 px-3 text-center bg-amber-950/10">
              <button type="button" class="btn-turno-filtro px-3.5 py-1 rounded-lg font-bold text-xs ${v2 === 'OK' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'}" data-turno="2" data-status="${v2}">
                ${v2}
              </button>
            </td>

            <!-- Turno 3 Button -->
            <td class="py-2 px-3 text-center bg-purple-950/10">
              <button type="button" class="btn-turno-filtro px-3.5 py-1 rounded-lg font-bold text-xs ${v3 === 'OK' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'}" data-turno="3" data-status="${v3}">
                ${v3}
              </button>
            </td>

            <td class="py-2 px-3 text-center filtro-status-badge font-bold text-xs">
              ${v1 === 'OK' && v2 === 'OK' && v3 === 'OK' ? '<span class="text-emerald-400">100% OPERATIVO</span>' : '<span class="text-amber-400">CON PARADAS</span>'}
            </td>

            <td class="py-2 px-3">
              <input type="text" value="${obs}" placeholder="Observación..." class="filtro-obs w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-300">
            </td>
          </tr>
        `;
      }).join('');

      filtrosTbody.querySelectorAll('.btn-turno-filtro').forEach(btn => {
        btn.addEventListener('click', () => {
          const next = btn.dataset.status === 'OK' ? 'FALLA' : 'OK';
          btn.dataset.status = next;
          btn.textContent = next;
          btn.className = `btn-turno-filtro px-3.5 py-1 rounded-lg font-bold text-xs ${next === 'OK' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'}`;
        });
      });
    }

    // 2. Purga Tanques de Aire
    const purgaTbody = document.getElementById('tbody-purga-tks');
    if (purgaTbody) {
      const tks = [
        { name: 'TK-MG-S. ROTULO', loc: 'Línea 1' },
        { name: 'TK-MG-001', loc: 'Línea 5' },
        { name: 'TK-MG-002', loc: 'Línea 8' },
        { name: 'TK-MG-003', loc: 'Línea 10' },
        { name: 'TK-MG-005', loc: 'Línea 7' },
        { name: 'TK-MG-006', loc: 'Línea 8' },
        { name: 'TK-MG-007', loc: 'MB-1' },
        { name: 'TK-MG-004', loc: 'MB-4' },
        { name: 'TK-MG-008', loc: 'MB-5' }
      ];

      purgaTbody.innerHTML = tks.map(t => {
        const c1 = savedMap[`PURGA_TKS_${t.name}_1`]?.valor === 'OK';
        const c2 = savedMap[`PURGA_TKS_${t.name}_2`]?.valor === 'OK';
        const c3 = savedMap[`PURGA_TKS_${t.name}_3`]?.valor === 'OK';
        const obs = savedMap[`PURGA_TKS_${t.name}_1`]?.obs || '';

        return `
          <tr data-purga-item="${t.name}">
            <td class="py-2.5 px-4 font-mono font-bold text-slate-200">${t.name}</td>
            <td class="py-2.5 px-3 text-slate-400">${t.loc}</td>
            <td class="py-2 px-3 text-center bg-blue-950/10">
              <input type="checkbox" class="purga-t1 w-4 h-4 accent-amber-500 rounded" ${c1 ? 'checked' : ''}>
            </td>
            <td class="py-2 px-3 text-center bg-amber-950/10">
              <input type="checkbox" class="purga-t2 w-4 h-4 accent-amber-500 rounded" ${c2 ? 'checked' : ''}>
            </td>
            <td class="py-2 px-3 text-center bg-purple-950/10">
              <input type="checkbox" class="purga-t3 w-4 h-4 accent-amber-500 rounded" ${c3 ? 'checked' : ''}>
            </td>
            <td class="py-2 px-3">
              <input type="text" value="${obs}" class="purga-obs w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-300" placeholder="Normal">
            </td>
          </tr>
        `;
      }).join('');
    }

    // 3. Separadores Cobber
    const cobberGrid = document.getElementById('cobber-grid');
    if (cobberGrid) {
      const cobbers = [
        '210-097', '210-098', '210-099', '210-100', '210-114', '210-115',
        '210-101', '210-102', '210-103', '210-104', '210-105', '210-106',
        '210-107', '210-108', '210-268', '210-269'
      ];

      cobberGrid.innerHTML = cobbers.map(c => {
        const checked = savedMap[`COBBER_${c}_1`]?.valor === 'OK';
        return `
          <button type="button" class="btn-cobber p-3 rounded-2xl border text-center font-mono font-bold text-xs transition-all ${checked ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-lg shadow-amber-500/10' : 'bg-slate-950 text-slate-400 border-slate-800'}" data-cobber-id="${c}" data-checked="${checked}">
            <div>${c}</div>
            <div class="text-[10px] font-normal mt-0.5 text-slate-400 cobber-status">${checked ? 'LIMPIO' : 'PENDIENTE'}</div>
          </button>
        `;
      }).join('');

      cobberGrid.querySelectorAll('.btn-cobber').forEach(btn => {
        btn.addEventListener('click', () => {
          const next = btn.dataset.checked !== 'true';
          btn.dataset.checked = String(next);
          btn.className = `btn-cobber p-3 rounded-2xl border text-center font-mono font-bold text-xs transition-all ${next ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-lg shadow-amber-500/10' : 'bg-slate-950 text-slate-400 border-slate-800'}`;
          btn.querySelector('.cobber-status').textContent = next ? 'LIMPIO' : 'PENDIENTE';
        });
      });
    }

  } catch (err) {
    showToast('Error cargando controles: ' + err.message, 'error');
  }
}

async function saveControles() {
  const btn = document.getElementById('btn-save-controles');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Guardando...';

  try {
    // 1. Filtros H2O
    const filtrosEntries = [];
    document.querySelectorAll('#tbody-filtros-turnos tr').forEach(tr => {
      const item = tr.dataset.filtroItem;
      const obs = tr.querySelector('.filtro-obs').value;
      [1, 2, 3].forEach(t => {
        const status = tr.querySelector(`button[data-turno="${t}"]`).dataset.status;
        filtrosEntries.push({ item, turno: String(t), valor: status, observacion: obs });
      });
    });
    if (filtrosEntries.length > 0) {
      await api('/api/controles', {
        method: 'POST',
        body: JSON.stringify({ fecha: state.date, modulo: 'FILTROS_H2O', entries: filtrosEntries })
      });
    }

    // 2. Purga Tanques
    const purgaEntries = [];
    document.querySelectorAll('#tbody-purga-tks tr').forEach(tr => {
      const item = tr.dataset.purgaItem;
      const obs = tr.querySelector('.purga-obs').value;
      purgaEntries.push({ item, turno: '1', valor: tr.querySelector('.purga-t1').checked ? 'OK' : 'X', observacion: obs });
      purgaEntries.push({ item, turno: '2', valor: tr.querySelector('.purga-t2').checked ? 'OK' : 'X', observacion: obs });
      purgaEntries.push({ item, turno: '3', valor: tr.querySelector('.purga-t3').checked ? 'OK' : 'X', observacion: obs });
    });
    if (purgaEntries.length > 0) {
      await api('/api/controles', {
        method: 'POST',
        body: JSON.stringify({ fecha: state.date, modulo: 'PURGA_TKS', entries: purgaEntries })
      });
    }

    // 3. Cobber
    const cobberEntries = [];
    document.querySelectorAll('.btn-cobber').forEach(btn => {
      cobberEntries.push({
        item: btn.dataset.cobberId,
        turno: '1',
        valor: btn.dataset.checked === 'true' ? 'OK' : 'PENDIENTE'
      });
    });
    if (cobberEntries.length > 0) {
      await api('/api/controles', {
        method: 'POST',
        body: JSON.stringify({ fecha: state.date, modulo: 'COBBER', entries: cobberEntries })
      });
    }

    showToast('Controles de los 3 turnos guardados exitosamente', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-floppy-disk text-base"></i> Guardar Controles';
  }
}

// ==========================================
// TAB 5: FALLAS Y PARADAS
// ==========================================

async function loadParadas() {
  try {
    const rows = await api(`/api/paradas?fecha=${state.date}`);
    const tbody = document.getElementById('tbody-paradas');
    const badge = document.getElementById('paradas-badge');
    if (badge) badge.textContent = `${rows.length} registradas`;
    if (!tbody) return;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500 italic">No hay paradas registradas para esta fecha.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr class="hover:bg-slate-800/60 transition-colors">
        <td class="py-2.5 px-3 font-mono">${r.fecha}</td>
        <td class="py-2.5 px-3 font-mono font-bold text-amber-400">${r.equipo}</td>
        <td class="py-2.5 px-3 font-mono text-slate-300">${r.inicio_parada} - ${r.arranque}</td>
        <td class="py-2.5 px-3 text-right font-mono font-black text-red-400">${Number(r.horas_perdidas).toFixed(2)}h</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-200">${Number(r.mineral_no_procesado).toFixed(2)} TM</td>
        <td class="py-2.5 px-3">
          <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 mr-1">${r.tipo_falla}</span>
          <span class="text-slate-300">${r.motivo || ''}</span>
        </td>
        <td class="py-2.5 px-3 text-center">
          <button onclick="deleteParada(${r.id})" class="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors" title="Eliminar">
            <i class="ph-bold ph-trash text-base"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error cargando paradas: ' + err.message, 'error');
  }
}

async function handleCreateParada(e) {
  e.preventDefault();
  const fecha = document.getElementById('parada-fecha').value;
  const equipo = document.getElementById('parada-equipo').value.split(' ')[0];
  const inicio_parada = document.getElementById('parada-inicio').value;
  const arranque = document.getElementById('parada-arranque').value;
  const tmh_no_procesadas = document.getElementById('parada-tmh').value;
  const tipo_falla = document.getElementById('parada-tipo').value;
  const motivo = document.getElementById('parada-motivo').value;

  try {
    await api('/api/paradas', {
      method: 'POST',
      body: JSON.stringify({ fecha, equipo, inicio_parada, arranque, tmh_no_procesadas, tipo_falla, motivo })
    });

    document.getElementById('form-parada').reset();
    document.getElementById('parada-fecha').value = state.date;
    showToast('Parada registrada exitosamente', 'success');
    loadParadas();
    loadDashboardKPIs();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function deleteParada(id) {
  if (!confirm('¿Desea eliminar esta parada registrada?')) return;
  try {
    await api(`/api/paradas/${id}`, { method: 'DELETE' });
    showToast('Parada eliminada', 'info');
    loadParadas();
    loadDashboardKPIs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// TAB 6: MANTENIMIENTO
// ==========================================

async function loadMantto() {
  try {
    const rows = await api(`/api/mantto?fecha=${state.date}`);
    const tbody = document.getElementById('tbody-mantto');
    if (!tbody) return;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="py-6 text-center text-slate-500 italic">No hay registros de mantenimiento para esta fecha.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr class="hover:bg-slate-800/60 transition-colors">
        <td class="py-2.5 px-3 font-mono">${r.fecha}</td>
        <td class="py-2.5 px-3 font-bold text-amber-400">${r.guardia}</td>
        <td class="py-2.5 px-3 font-mono font-bold text-white">${r.equipo} <span class="text-slate-500 font-normal">(${r.area})</span></td>
        <td class="py-2.5 px-3 font-mono">${r.aviso_sap || '-'}</td>
        <td class="py-2.5 px-3">${r.especialidad}</td>
        <td class="py-2.5 px-3 font-semibold text-slate-200">${r.trabajo_realizado}</td>
        <td class="py-2.5 px-3 text-right font-mono">${r.horas}h</td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${r.estado === 'Cerrado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${r.estado}</span>
        </td>
        <td class="py-2.5 px-3 text-slate-400">${r.responsable || '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error cargando mantto: ' + err.message, 'error');
  }
}

// ==========================================
// TAB 7: BALANZAS
// ==========================================

async function loadBalanzas() {
  try {
    const rows = await api('/api/balanzas');
    const tbody = document.getElementById('tbody-balanzas');
    if (!tbody) return;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="py-6 text-center text-slate-500 italic">No hay calibraciones registradas.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr class="hover:bg-slate-800/60 transition-colors">
        <td class="py-2.5 px-3 font-mono">${r.fecha}</td>
        <td class="py-2.5 px-3 font-bold text-amber-400">${r.equipo}</td>
        <td class="py-2.5 px-3 font-mono">${r.faja || '-'}</td>
        <td class="py-2.5 px-3 text-right font-mono">${r.zero_as_found}</td>
        <td class="py-2.5 px-3 text-right font-mono">${r.zero_as_left}</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold ${Math.abs(r.err_zero_enc) > 1 ? 'text-red-400' : 'text-emerald-400'}">${r.err_zero_enc}%</td>
        <td class="py-2.5 px-3 text-right font-mono">${r.span_as_found}</td>
        <td class="py-2.5 px-3 text-right font-mono">${r.span_as_left}</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold ${Math.abs(r.err_span_enc) > 1 ? 'text-red-400' : 'text-emerald-400'}">${r.err_span_enc}%</td>
        <td class="py-2.5 px-3 text-slate-400">${r.observacion || '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error cargando balanzas: ' + err.message, 'error');
  }
}

// ==========================================
// TAB 8: USUARIOS
// ==========================================

async function loadUsers() {
  try {
    const users = await api('/api/users');
    const tbody = document.getElementById('tbody-users');
    if (!tbody) return;

    tbody.innerHTML = users.map(u => `
      <tr class="hover:bg-slate-800/60 transition-colors">
        <td class="py-2.5 px-3 font-mono text-slate-500">#${u.id}</td>
        <td class="py-2.5 px-3 font-mono font-bold text-white">${u.username}</td>
        <td class="py-2.5 px-3 text-slate-200 font-bold">${u.full_name}</td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">${u.role}</span>
        </td>
        <td class="py-2.5 px-3 text-slate-400">${u.area || '-'}</td>
        <td class="py-2.5 px-3">
          <span class="inline-flex items-center gap-1.5 text-[11px] font-bold ${u.activo ? 'text-emerald-400' : 'text-red-400'}">
            <span class="w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-emerald-400' : 'bg-red-400'}"></span>
            ${u.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td class="py-2.5 px-3 text-center">
          <button onclick="toggleUserStatus(${u.id}, ${u.activo ? 0 : 1})" class="text-xs px-2.5 py-1 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300">
            ${u.activo ? 'Desactivar' : 'Reactivar'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error cargando usuarios: ' + err.message, 'error');
  }
}

async function handleCreateUser(e) {
  e.preventDefault();
  const username = document.getElementById('new-user-username').value;
  const full_name = document.getElementById('new-user-fullname').value;
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;
  const area = document.getElementById('new-user-area').value;

  try {
    await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username, full_name, password, role, area })
    });

    document.getElementById('form-create-user').reset();
    document.getElementById('user-modal').classList.add('hidden');
    showToast(`Usuario ${username} creado exitosamente`, 'success');
    loadUsers();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function toggleUserStatus(id, newStatus) {
  try {
    await api(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ activo: newStatus })
    });
    showToast('Estado de usuario actualizado', 'info');
    loadUsers();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ==========================================
// TAB 9: AUDITORÍA
// ==========================================

async function loadAuditoria() {
  try {
    const rows = await api('/api/auditoria');
    const tbody = document.getElementById('tbody-auditoria');
    if (!tbody) return;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500 italic">No hay registros de auditoría aún.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr class="hover:bg-slate-800/60 transition-colors">
        <td class="py-2 px-3 text-slate-400 whitespace-nowrap">${r.fecha_hora}</td>
        <td class="py-2 px-3 font-bold text-amber-400">${r.usuario}</td>
        <td class="py-2 px-3 text-slate-300 font-mono">${r.tabla}</td>
        <td class="py-2 px-3">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${r.accion === 'INSERT' ? 'bg-emerald-500/20 text-emerald-400' : (r.accion === 'DELETE' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400')}">${r.accion}</span>
        </td>
        <td class="py-2 px-3 text-slate-400 truncate max-w-[120px]">${r.valor_anterior || '-'}</td>
        <td class="py-2 px-3 text-slate-200 font-bold truncate max-w-[120px]">${r.valor_nuevo || '-'}</td>
        <td class="py-2 px-3 text-slate-400">${r.motivo || '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error cargando auditoría: ' + err.message, 'error');
  }
}

// ==========================================
// EXPORTACIÓN A EXCEL (.XLSX) ROBUSTA
// ==========================================

async function downloadExcelReport(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  const triggerBtn = e?.currentTarget;
  const originalHtml = triggerBtn ? triggerBtn.innerHTML : '';
  
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.classList.add('opacity-75', 'cursor-not-allowed');
    triggerBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i><span>Generando Excel...</span>`;
  }
  
  showToast('Generando libro Excel consolidado con las 10 hojas...', 'info');
  
  try {
    const selectedDate = state.date || document.getElementById('global-date')?.value || new Date().toISOString().split('T')[0];
    const url = `/api/export/excel?fecha=${encodeURIComponent(selectedDate)}&token=${encodeURIComponent(state.token || '')}`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${state.token || ''}`
      }
    });
    
    if (!res.ok) {
      let errText = 'Error en el servidor al exportar Excel';
      try {
        const errJson = await res.json();
        errText = errJson.error || errText;
      } catch {}
      throw new Error(errText);
    }
    
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `BENEFICIO_ZA_REPORTE_${selectedDate}.xlsx`;
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    }, 1500);
    
    showToast('¡Descarga completada! Archivo Excel (.xlsx) listo en tus descargas.', 'success');
  } catch (err) {
    console.error('Error al exportar Excel:', err);
    showToast('Fallo en la descarga: ' + err.message, 'error');
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.classList.remove('opacity-75', 'cursor-not-allowed');
      triggerBtn.innerHTML = originalHtml;
    }
  }
}
window.downloadExcelReport = downloadExcelReport;
