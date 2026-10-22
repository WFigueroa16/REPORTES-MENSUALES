// Beneficio ZA - Client Application Logic

const state = {
  token: localStorage.getItem('za_token') || null,
  user: null,
  currentTab: 'tab-dashboard',
  date: null,
  guardia: 'A',
  equipos: [],
  catControles: []
};

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  setupDateAndGuardia();
  setupTabNavigation();
  setupEventListeners();

  if (state.token) {
    await checkSession();
  } else {
    showLoginModal();
  }
});

// Setup default date & shift according to plant operations schedule (09:00 start)
function setupDateAndGuardia() {
  const now = new Date();
  const currentHour = now.getHours();

  // If before 09:00 AM, plant operating day is yesterday
  const opDate = new Date();
  if (currentHour < 9) {
    opDate.setDate(opDate.getDate() - 1);
  }
  const dateStr = opDate.toISOString().split('T')[0];
  state.date = dateStr;

  // Determine standard shift
  // Guardia A: 07:00 - 15:00
  // Guardia B: 15:00 - 23:00
  // Guardia C: 23:00 - 07:00
  if (currentHour >= 7 && currentHour < 15) {
    state.guardia = 'A';
  } else if (currentHour >= 15 && currentHour < 23) {
    state.guardia = 'B';
  } else {
    state.guardia = 'C';
  }

  const dateInput = document.getElementById('global-date');
  const guardiaSelect = document.getElementById('global-guardia');
  if (dateInput) dateInput.value = state.date;
  if (guardiaSelect) guardiaSelect.value = state.guardia;

  const paradaFecha = document.getElementById('parada-fecha');
  if (paradaFecha) paradaFecha.value = state.date;
}

// Global Event Listeners
function setupEventListeners() {
  // Global Date & Guardia change
  document.getElementById('global-date')?.addEventListener('change', (e) => {
    state.date = e.target.value;
    loadActiveTabData();
  });

  document.getElementById('global-guardia')?.addEventListener('change', (e) => {
    state.guardia = e.target.value;
    if (state.currentTab === 'tab-rdo') loadRDO();
  });

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);

  // Logout button
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);

  // RDO save
  document.getElementById('btn-save-rdo')?.addEventListener('click', saveRDO);

  // Concentrado save
  document.getElementById('btn-save-concentrado')?.addEventListener('click', saveConcentrado);

  // Controles save
  document.getElementById('btn-save-controles')?.addEventListener('click', saveControles);

  // Paradas form submit
  document.getElementById('form-parada')?.addEventListener('submit', handleCreateParada);

  // User modal
  document.getElementById('btn-new-user')?.addEventListener('click', () => {
    document.getElementById('user-modal')?.classList.remove('hidden');
  });
  document.getElementById('btn-close-user-modal')?.addEventListener('click', () => {
    document.getElementById('user-modal')?.classList.add('hidden');
  });
  document.getElementById('form-create-user')?.addEventListener('submit', handleCreateUser);

  // Subtabs for Controles
  document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subtab-btn').forEach(b => {
        b.classList.remove('active', 'bg-slate-700', 'text-white');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('active', 'bg-slate-700', 'text-white');
      btn.classList.remove('text-slate-400');

      const target = btn.dataset.subtab;
      document.querySelectorAll('.subtab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(target)?.classList.remove('hidden');
    });
  });

  // Refresh buttons
  document.getElementById('btn-refresh-kpi')?.addEventListener('click', loadDashboardKPIs);
  document.getElementById('btn-refresh-auditoria')?.addEventListener('click', loadAuditoria);
}

// Navigation Tabs
function setupTabNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      switchTab(targetId);
    });
  });
}

function switchTab(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.dataset.tab === tabId) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-content').forEach(c => {
    if (c.id === tabId) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });

  loadActiveTabData();
}

function loadActiveTabData() {
  switch (state.currentTab) {
    case 'tab-dashboard':
      loadDashboardKPIs();
      break;
    case 'tab-rdo':
      loadRDO();
      break;
    case 'tab-concentrado':
      loadConcentrado();
      break;
    case 'tab-controles':
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
// API HELPER
// ==========================================

async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(endpoint, { ...options, headers });
  if (res.status === 401) {
    showLoginModal();
    throw new Error('Sesión expirada');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }
  return data;
}

// ==========================================
// REAL-TIME SERVER-SENT EVENTS (SSE)
// ==========================================

function connectSSE() {
  const eventSource = new EventSource('/api/events');
  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'CONNECTED') {
        console.log('SSE conectado:', data.message);
      } else {
        showToast(`Actualización en tiempo real: ${data.type}`, 'info');
        // Refresh active tab if relevant
        if (
          (data.type === 'RDO_UPDATE' && state.currentTab === 'tab-rdo') ||
          (data.type === 'CONCENTRADO_UPDATE' && state.currentTab === 'tab-concentrado') ||
          (data.type === 'PARADAS_UPDATE' && state.currentTab === 'tab-paradas')
        ) {
          loadActiveTabData();
        }
        if (state.currentTab === 'tab-dashboard') loadDashboardKPIs();
      }
    } catch {}
  };

  eventSource.onerror = () => {
    console.warn('SSE reconectando...');
  };
}

// Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-red-600' : (type === 'info' ? 'bg-blue-600' : 'bg-emerald-600');
  toast.className = `toast px-4 py-3 rounded-xl shadow-2xl text-white text-xs font-semibold flex items-center gap-2 pointer-events-auto ${bg}`;
  toast.innerHTML = `
    <i class="ph-bold ${type === 'error' ? 'ph-warning' : 'ph-check-circle'} text-base"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
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
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');

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
    showToast(`Bienvenido, ${state.user.full_name}`, 'success');
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('hidden');
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

  // Hide Users & Audit tab for non-admin/supervisor
  const isAdminOrSup = state.user.role === 'admin' || state.user.role === 'supervisor';
  const usersTab = document.querySelector('[data-tab="tab-users"]');
  const auditTab = document.querySelector('[data-tab="tab-auditoria"]');
  if (usersTab) usersTab.style.display = isAdminOrSup ? 'flex' : 'none';
  if (auditTab) auditTab.style.display = isAdminOrSup ? 'flex' : 'none';
}

// Load master equipment catalog for autocomplete
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
// TAB 1: DASHBOARD & KPIS
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
  } catch (err) {
    console.error('Error cargando KPIs:', err);
  }
}

// ==========================================
// TAB 2: RDO (REPORTE DIARIO DE OPERACIONES)
// ==========================================

async function loadRDO() {
  try {
    // Reset all RDO inputs
    document.querySelectorAll('.rdo-input').forEach(inp => inp.value = '');
    const data = await api(`/api/rdo?fecha=${state.date}&guardia=${state.guardia}`);

    // Populate saved entries
    (data.entries || []).forEach(e => {
      const input = document.querySelector(`.rdo-input[data-rdo-area="${e.area}"][data-rdo-param="${e.parametro}"]`);
      if (input) input.value = e.valor || '';
    });

    // Populate bitacora
    const historyDiv = document.getElementById('rdo-bitacora-history');
    if (historyDiv) {
      if ((data.bitacora || []).length === 0) {
        historyDiv.innerHTML = '<div class="text-slate-500 text-xs italic">Sin registros de bitácora para esta fecha y guardia.</div>';
      } else {
        historyDiv.innerHTML = data.bitacora.map(b => `
          <div class="bg-slate-900 border border-slate-750 p-3 rounded-lg text-xs">
            <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span class="font-bold text-amber-400 uppercase">${b.area}</span>
              <span>${b.registrado_por} • ${b.fecha_registro}</span>
            </div>
            <p class="text-slate-200">${b.detalle}</p>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    showToast('Error cargando RDO: ' + err.message, 'error');
  }
}

async function saveRDO() {
  const btn = document.getElementById('btn-save-rdo');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Guardando...';

  try {
    const trituracionEntries = {};
    const filtrosEntries = {};

    document.querySelectorAll('.rdo-input').forEach(inp => {
      const area = inp.dataset.rdoArea;
      const param = inp.dataset.rdoParam;
      const val = inp.value;
      if (area === 'TRITURACION') trituracionEntries[param] = val;
      if (area === 'FILTROS') filtrosEntries[param] = val;
    });

    const bitacora = document.getElementById('rdo-bitacora-input').value;

    // Save Trituración
    await api('/api/rdo', {
      method: 'POST',
      body: JSON.stringify({
        fecha: state.date,
        guardia: state.guardia,
        area: 'TRITURACION',
        entries: trituracionEntries,
        bitacoraDetalle: bitacora
      })
    });

    // Save Filtros
    await api('/api/rdo', {
      method: 'POST',
      body: JSON.stringify({
        fecha: state.date,
        guardia: state.guardia,
        area: 'FILTROS',
        entries: filtrosEntries,
        bitacoraDetalle: null
      })
    });

    document.getElementById('rdo-bitacora-input').value = '';
    showToast('RDO guardado exitosamente', 'success');
    loadRDO();
  } catch (err) {
    showToast('Error guardando RDO: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Guardar RDO';
  }
}

// ==========================================
// TAB 3: PRODUCCIÓN HORARIA / CONCENTRADO
// ==========================================

async function loadConcentrado() {
  try {
    const rows = await api(`/api/concentrado?fecha=${state.date}`);
    const tbody = document.getElementById('tbody-concentrado');
    if (!tbody) return;

    tbody.innerHTML = rows.map((r, i) => `
      <tr class="hover:bg-slate-800/60 transition-colors" data-hora-idx="${r.num_hora}">
        <td class="py-2.5 px-3 font-mono font-bold text-slate-300 whitespace-nowrap">${r.hora}</td>
        <td class="py-2 px-2 text-right">
          <input type="number" step="any" value="${r.mineral_tms || ''}" class="conc-mineral w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono focus:border-amber-400">
        </td>
        <td class="py-2 px-2 text-right">
          <input type="number" step="any" value="${r.concentrado_tms || ''}" class="conc-prod w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono focus:border-amber-400">
        </td>
        <td class="py-2 px-2 text-right">
          <input type="number" step="any" value="${r.s_pct || ''}" class="conc-s w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono focus:border-amber-400">
        </td>
        <td class="py-2 px-2 text-right">
          <input type="number" step="any" value="${r.esp_n_fe_sol || ''}" class="conc-fesol w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono focus:border-amber-400">
        </td>
        <td class="py-2 px-2 text-right">
          <input type="number" step="any" value="${r.esp_n_feo || ''}" class="conc-feo w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono focus:border-amber-400">
        </td>
        <td class="py-2 px-2 text-right">
          <input type="number" step="any" value="${r.h2o_pct || ''}" class="conc-h2o w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white font-mono focus:border-amber-400">
        </td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 calc-recup">
          ${r.recup_pct ? r.recup_pct + '%' : '-'}
        </td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-amber-400 calc-ratio">
          ${r.ratio ? r.ratio : '-'}
        </td>
        <td class="py-2 px-2">
          <input type="text" value="${r.obs_magnetica || ''}" placeholder="Obs..." class="conc-obs w-full min-w-[140px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200">
        </td>
      </tr>
    `).join('');

    // Attach live calculation listener
    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('input', () => calculateRow(tr));
    });
  } catch (err) {
    showToast('Error cargando Producción: ' + err.message, 'error');
  }
}

function calculateRow(tr) {
  const mineral = parseFloat(tr.querySelector('.conc-mineral')?.value) || 0;
  const conc = parseFloat(tr.querySelector('.conc-prod')?.value) || 0;
  const feSol = parseFloat(tr.querySelector('.conc-fesol')?.value) || 0;

  const recupCell = tr.querySelector('.calc-recup');
  const ratioCell = tr.querySelector('.calc-ratio');

  if (mineral > 0 && conc > 0 && feSol > 0) {
    const recup = (conc * 68) / (mineral * feSol) * 100;
    const ratio = mineral / conc;
    recupCell.textContent = recup.toFixed(2) + '%';
    ratioCell.textContent = ratio.toFixed(2);
  } else {
    recupCell.textContent = '-';
    ratioCell.textContent = '-';
  }
}

async function saveConcentrado() {
  const btn = document.getElementById('btn-save-concentrado');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Guardando...';

  try {
    const rows = [];
    document.querySelectorAll('#tbody-concentrado tr').forEach(tr => {
      const numHora = Number(tr.dataset.horaIdx);
      const hora = tr.querySelector('td:first-child').textContent.trim();
      const mineral = tr.querySelector('.conc-mineral').value;
      const conc = tr.querySelector('.conc-prod').value;
      const s = tr.querySelector('.conc-s').value;
      const feSol = tr.querySelector('.conc-fesol').value;
      const feO = tr.querySelector('.conc-feo').value;
      const h2o = tr.querySelector('.conc-h2o').value;
      const obs = tr.querySelector('.conc-obs').value;

      rows.push({
        num_hora: numHora,
        hora,
        mineral_tms: mineral,
        concentrado_tms: conc,
        s_pct: s,
        esp_n_fe_sol: feSol,
        esp_n_feo: feO,
        h2o_pct: h2o,
        obs_magnetica: obs
      });
    });

    await api('/api/concentrado', {
      method: 'POST',
      body: JSON.stringify({ fecha: state.date, rows })
    });

    showToast('Producción 24h guardada con éxito', 'success');
    loadConcentrado();
  } catch (err) {
    showToast('Error guardando producción: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Guardar Producción 24h';
  }
}

// ==========================================
// TAB 4: CONTROLES DE PLANTA
// ==========================================

async function loadControles() {
  try {
    if (state.catControles.length === 0) {
      state.catControles = await api('/api/cat_controles');
    }

    const saved = await api(`/api/controles?fecha=${state.date}`);
    const savedMap = {};
    saved.forEach(s => {
      savedMap[`${s.modulo}_${s.item}_${s.turno}`] = s.valor;
    });

    // 1. Filtros H2O
    const filtrosGrid = document.getElementById('filtros-h2o-grid');
    if (filtrosGrid) {
      const items = [
        'Filtro # 1', 'Filtro # 2', 'Filtro # 3', 'Filtro # 4', 'Filtro # 5',
        'Filtro Linea # 5', 'Filtro Linea # 6', 'Filtro Linea # 7', 'Filtro Linea # 8'
      ];
      filtrosGrid.innerHTML = items.map((item, idx) => {
        const val = savedMap[`FILTROS_H2O_${item}_1`] || 'OK';
        const isOk = val === 'OK';
        return `
          <div class="bg-slate-850 border border-slate-700/60 p-4 rounded-xl flex items-center justify-between" data-control-item="${item}">
            <div>
              <span class="text-xs font-bold text-white block">${item}</span>
              <span class="text-[10px] text-slate-400">Estado Operativo</span>
            </div>
            <button type="button" class="btn-toggle-filtro px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${isOk ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'}" data-status="${val}">
              ${val}
            </button>
          </div>
        `;
      }).join('');

      filtrosGrid.querySelectorAll('.btn-toggle-filtro').forEach(btn => {
        btn.addEventListener('click', () => {
          const current = btn.dataset.status;
          const next = current === 'OK' ? 'FALLA' : 'OK';
          btn.dataset.status = next;
          btn.textContent = next;
          btn.className = `btn-toggle-filtro px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${next === 'OK' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'}`;
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

      purgaTbody.innerHTML = tks.map(t => `
        <tr data-purga-item="${t.name}">
          <td class="py-2.5 px-3 font-mono font-bold text-slate-200">${t.name}</td>
          <td class="py-2.5 px-3 text-slate-400">${t.loc}</td>
          <td class="py-2 px-3 text-center">
            <input type="checkbox" class="purga-t1 w-4 h-4 accent-amber-500 rounded" ${savedMap[`PURGA_TKS_${t.name}_1`] === 'OK' ? 'checked' : ''}>
          </td>
          <td class="py-2 px-3 text-center">
            <input type="checkbox" class="purga-t2 w-4 h-4 accent-amber-500 rounded" ${savedMap[`PURGA_TKS_${t.name}_2`] === 'OK' ? 'checked' : ''}>
          </td>
          <td class="py-2 px-3 text-center">
            <input type="checkbox" class="purga-t3 w-4 h-4 accent-amber-500 rounded" ${savedMap[`PURGA_TKS_${t.name}_3`] === 'OK' ? 'checked' : ''}>
          </td>
          <td class="py-2 px-3">
            <input type="text" class="purga-obs w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200" placeholder="Normal">
          </td>
        </tr>
      `).join('');
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
        const checked = savedMap[`COBBER_${c}_1`] === 'OK';
        return `
          <button type="button" class="btn-cobber p-3 rounded-xl border text-center font-mono font-bold text-xs transition-all ${checked ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-850 text-slate-400 border-slate-700/60'}" data-cobber-id="${c}" data-checked="${checked}">
            <div>${c}</div>
            <div class="text-[10px] font-normal mt-0.5 text-slate-400 cobber-status">${checked ? 'LIMPIO' : 'PENDIENTE'}</div>
          </button>
        `;
      }).join('');

      cobberGrid.querySelectorAll('.btn-cobber').forEach(btn => {
        btn.addEventListener('click', () => {
          const isChecked = btn.dataset.checked === 'true';
          const next = !isChecked;
          btn.dataset.checked = String(next);
          btn.className = `btn-cobber p-3 rounded-xl border text-center font-mono font-bold text-xs transition-all ${next ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-850 text-slate-400 border-slate-700/60'}`;
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
    // 1. Filtros H2O entries
    const filtrosEntries = [];
    document.querySelectorAll('#filtros-h2o-grid [data-control-item]').forEach(el => {
      const item = el.dataset.controlItem;
      const status = el.querySelector('.btn-toggle-filtro').dataset.status;
      filtrosEntries.push({ item, turno: '1', valor: status });
    });
    if (filtrosEntries.length > 0) {
      await api('/api/controles', {
        method: 'POST',
        body: JSON.stringify({ fecha: state.date, modulo: 'FILTROS_H2O', entries: filtrosEntries })
      });
    }

    // 2. Purga TKs Aire
    const purgaEntries = [];
    document.querySelectorAll('#tbody-purga-tks tr').forEach(tr => {
      const item = tr.dataset.purgaItem;
      const t1 = tr.querySelector('.purga-t1').checked ? 'OK' : 'X';
      const t2 = tr.querySelector('.purga-t2').checked ? 'OK' : 'X';
      const t3 = tr.querySelector('.purga-t3').checked ? 'OK' : 'X';
      const obs = tr.querySelector('.purga-obs').value;
      purgaEntries.push({ item, turno: '1', valor: t1, observacion: obs });
      purgaEntries.push({ item, turno: '2', valor: t2, observacion: obs });
      purgaEntries.push({ item, turno: '3', valor: t3, observacion: obs });
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
      const item = btn.dataset.cobberId;
      const isClean = btn.dataset.checked === 'true';
      cobberEntries.push({ item, turno: '1', valor: isClean ? 'OK' : 'PENDIENTE' });
    });
    if (cobberEntries.length > 0) {
      await api('/api/controles', {
        method: 'POST',
        body: JSON.stringify({ fecha: state.date, modulo: 'COBBER', entries: cobberEntries })
      });
    }

    showToast('Controles de planta guardados exitosamente', 'success');
  } catch (err) {
    showToast('Error guardando controles: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Guardar Controles';
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
        <td class="py-2.5 px-3 text-right font-mono font-bold text-red-400">${Number(r.horas_perdidas).toFixed(2)}h</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-200">${Number(r.mineral_no_procesado).toFixed(2)} TM</td>
        <td class="py-2.5 px-3">
          <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 mr-1">${r.tipo_falla}</span>
          <span class="text-slate-300">${r.motivo || ''}</span>
        </td>
        <td class="py-2.5 px-3 text-center">
          <button onclick="deleteParada(${r.id})" class="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors" title="Eliminar">
            <i class="ph-bold ph-trash"></i>
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
  const equipo = document.getElementById('parada-equipo').value.split(' ')[0]; // Extract code
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
    showToast('Error registrando parada: ' + err.message, 'error');
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
    showToast('Error eliminando: ' + err.message, 'error');
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
        <td class="py-2.5 px-3 font-bold">${r.guardia}</td>
        <td class="py-2.5 px-3 font-mono text-amber-400">${r.equipo} <span class="text-slate-500 font-normal">(${r.area})</span></td>
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
      tbody.innerHTML = '<tr><td colspan="10" class="py-6 text-center text-slate-500 italic">No hay calibraciones de balanzas registradas.</td></tr>';
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
// TAB 8: GESTIÓN DE USUARIOS
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
        <td class="py-2.5 px-3 text-slate-200">${u.full_name}</td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase">${u.role}</span>
        </td>
        <td class="py-2.5 px-3 text-slate-400">${u.area || '-'}</td>
        <td class="py-2.5 px-3">
          <span class="inline-flex items-center gap-1 text-[11px] font-semibold ${u.activo ? 'text-emerald-400' : 'text-red-400'}">
            <span class="w-1.5 h-1.5 rounded-full ${u.activo ? 'bg-emerald-400' : 'bg-red-400'}"></span>
            ${u.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td class="py-2.5 px-3 font-mono text-slate-500 text-[11px]">${u.created_at || '-'}</td>
        <td class="py-2.5 px-3 text-center">
          <button onclick="toggleUserStatus(${u.id}, ${u.activo ? 0 : 1})" class="text-xs px-2.5 py-1 rounded-lg border border-slate-700 hover:bg-slate-700 text-slate-300">
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
    showToast('Error creando usuario: ' + err.message, 'error');
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
    showToast('Error actualizando usuario: ' + err.message, 'error');
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
      tbody.innerHTML = '<tr><td colspan="8" class="py-6 text-center text-slate-500 italic">No hay registros de auditoría aún.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr class="hover:bg-slate-800/60 transition-colors">
        <td class="py-2 px-3 text-slate-400 whitespace-nowrap">${r.fecha_hora}</td>
        <td class="py-2 px-3 font-bold text-amber-400">${r.usuario}</td>
        <td class="py-2 px-3 text-slate-300">${r.tabla}</td>
        <td class="py-2 px-3 text-slate-400">${r.registro_id || '-'}</td>
        <td class="py-2 px-3">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${r.accion === 'INSERT' ? 'bg-emerald-500/20 text-emerald-400' : (r.accion === 'DELETE' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400')}">${r.accion}</span>
        </td>
        <td class="py-2 px-3 text-slate-400 truncate max-w-[120px]">${r.valor_anterior || '-'}</td>
        <td class="py-2 px-3 text-slate-200 truncate max-w-[120px]">${r.valor_nuevo || '-'}</td>
        <td class="py-2 px-3 text-slate-400">${r.motivo || '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error cargando auditoría: ' + err.message, 'error');
  }
}
