// Beneficio ZA - Advanced Operator UI & Client Logic

const state = {
  token: localStorage.getItem('za_token') || null,
  user: null,
  currentTab: 'tab-dashboard',
  date: null,
  guardia: 'A',
  rdoViewMode: 'focus', // 'focus' (Mi Guardia) or 'all' (3 Guardias A-B-C)
  concFilter: 'ALL',     // 'ALL', 'GA', 'GB', 'GC'
  equipos: [],
  catControles: []
};

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  setupInitialDateAndGuardia();
  setupTabNavigation();
  setupEventListeners();
  renderSilosVisual();

  if (state.token) {
    await checkSession();
  } else {
    showLoginModal();
  }
});

// Setup default date & shift according to plant schedule (09:00 official start)
function setupInitialDateAndGuardia() {
  const now = new Date();
  const currentHour = now.getHours();

  // If before 09:00, operational plant date is yesterday
  const opDate = new Date();
  if (currentHour < 9) {
    opDate.setDate(opDate.getDate() - 1);
  }
  state.date = opDate.toISOString().split('T')[0];

  // Determine standard shift:
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

  updateHeaderControls();
}

function updateHeaderControls() {
  const dateInput = document.getElementById('global-date');
  if (dateInput) dateInput.value = state.date;

  const dashDateLabel = document.getElementById('dash-date-label');
  if (dashDateLabel) dashDateLabel.textContent = state.date;

  const focusTag = document.getElementById('focus-guardia-tag');
  if (focusTag) focusTag.textContent = state.guardia;

  // Update Guardia pills
  document.querySelectorAll('.guardia-pill-btn').forEach(btn => {
    if (btn.dataset.guardia === state.guardia) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const paradaFecha = document.getElementById('parada-fecha');
  if (paradaFecha) paradaFecha.value = state.date;
}

// Global Event Listeners
function setupEventListeners() {
  // Global Date change
  document.getElementById('global-date')?.addEventListener('change', (e) => {
    state.date = e.target.value;
    updateHeaderControls();
    loadActiveTabData();
  });

  // Prev / Next day buttons
  document.getElementById('btn-prev-day')?.addEventListener('click', () => {
    changeDateOffset(-1);
  });
  document.getElementById('btn-next-day')?.addEventListener('click', () => {
    changeDateOffset(1);
  });

  // Guardia pill buttons
  document.querySelectorAll('.guardia-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.guardia = btn.dataset.guardia;
      updateHeaderControls();
      if (state.currentTab === 'tab-rdo') loadRDO();
    });
  });

  // RDO Mode Toggle (Focus vs 3 Guardias)
  document.getElementById('btn-mode-focus')?.addEventListener('click', () => {
    state.rdoViewMode = 'focus';
    document.getElementById('btn-mode-focus').classList.add('active', 'bg-amber-500', 'text-slate-950');
    document.getElementById('btn-mode-focus').classList.remove('text-slate-400');
    document.getElementById('btn-mode-all').classList.remove('active', 'bg-amber-500', 'text-slate-950');
    document.getElementById('btn-mode-all').classList.add('text-slate-400');
    loadRDO();
  });

  document.getElementById('btn-mode-all')?.addEventListener('click', () => {
    state.rdoViewMode = 'all';
    document.getElementById('btn-mode-all').classList.add('active', 'bg-amber-500', 'text-slate-950');
    document.getElementById('btn-mode-all').classList.remove('text-slate-400');
    document.getElementById('btn-mode-focus').classList.remove('active', 'bg-amber-500', 'text-slate-950');
    document.getElementById('btn-mode-focus').classList.add('text-slate-400');
    loadRDO();
  });

  // Copy previous shift
  document.getElementById('btn-copy-prev-shift')?.addEventListener('click', handleCopyPrevShift);

  // Concentrado shift filter
  document.querySelectorAll('.conc-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.conc-filter-btn').forEach(b => {
        b.classList.remove('active', 'bg-amber-500', 'text-slate-950');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('active', 'bg-amber-500', 'text-slate-950');
      btn.classList.remove('text-slate-400');

      state.concFilter = btn.dataset.concFilter;
      filterConcentradoRows();
    });
  });

  // Forms and saves
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  document.getElementById('btn-save-rdo')?.addEventListener('click', saveRDO);
  document.getElementById('btn-save-concentrado')?.addEventListener('click', saveConcentrado);
  document.getElementById('btn-save-controles')?.addEventListener('click', saveControles);
  document.getElementById('form-parada')?.addEventListener('submit', handleCreateParada);

  // User modal
  document.getElementById('btn-new-user')?.addEventListener('click', () => {
    document.getElementById('user-modal')?.classList.remove('hidden');
  });
  document.getElementById('btn-close-user-modal')?.addEventListener('click', () => {
    document.getElementById('user-modal')?.classList.add('hidden');
  });
  document.getElementById('form-create-user')?.addEventListener('submit', handleCreateUser);

  // Subtabs Controles
  document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.subtab-btn').forEach(b => {
        b.classList.remove('active', 'bg-amber-500', 'text-slate-950');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('active', 'bg-amber-500', 'text-slate-950');
      btn.classList.remove('text-slate-400');

      const target = btn.dataset.subtab;
      document.querySelectorAll('.subtab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(target)?.classList.remove('hidden');
    });
  });

  // Refresh
  document.getElementById('btn-refresh-kpi')?.addEventListener('click', loadDashboardKPIs);
  document.getElementById('btn-refresh-auditoria')?.addEventListener('click', loadAuditoria);
}

function changeDateOffset(delta) {
  const [y, m, d] = state.date.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  cur.setUTCDate(cur.getUTCDate() + delta);
  state.date = cur.toISOString().split('T')[0];
  updateHeaderControls();
  loadActiveTabData();
}

// Navigation Tabs
function setupTabNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
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
// API CLIENT & SSE
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
    throw new Error('Sesión requerida');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }
  return data;
}

function connectSSE() {
  const eventSource = new EventSource('/api/events');
  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'CONNECTED') return;

      showToast(`Actualización en vivo: ${data.type}`, 'info');
      if (
        (data.type === 'RDO_UPDATE' && state.currentTab === 'tab-rdo') ||
        (data.type === 'CONCENTRADO_UPDATE' && state.currentTab === 'tab-concentrado') ||
        (data.type === 'PARADAS_UPDATE' && state.currentTab === 'tab-paradas')
      ) {
        loadActiveTabData();
      }
      if (state.currentTab === 'tab-dashboard') loadDashboardKPIs();
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
    showToast(`Bienvenido a Planta, ${state.user.full_name}`, 'success');
  } catch (err) {
    document.getElementById('login-error-text').textContent = err.message;
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

    // Load Guardias Quick Comparison Cards on Dashboard
    const rdoData = await api(`/api/rdo?fecha=${state.date}&guardia=ALL`);
    renderGuardiasSummaryGrid(rdoData.entries || []);
  } catch (err) {
    console.error('Error cargando KPIs:', err);
  }
}

function renderGuardiasSummaryGrid(entries) {
  const container = document.getElementById('guardias-summary-grid');
  if (!container) return;

  const guardias = ['A', 'B', 'C'];
  container.innerHTML = guardias.map(g => {
    const gEntries = entries.filter(e => e.guardia === g);
    const transferido = gEntries.find(e => e.parametro === 'Transferido (TMH)')?.valor || '0';
    const envioMina = gEntries.find(e => e.parametro === 'Envío de mina')?.valor || '-';
    const humedad = gEntries.find(e => e.parametro === '% Humedad (%)')?.valor || '-';
    const tratamiento = gEntries.find(e => e.parametro === 'Tratamiento (Ton)')?.valor || '-';

    return `
      <div class="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl space-y-3">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">${g}</span>
            <span class="font-bold text-white text-xs">Guardia ${g}</span>
          </div>
          <span class="text-[11px] text-slate-500 font-mono">${gEntries.length} params</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span class="text-slate-500 block text-[10px]">Envío Mina:</span>
            <span class="font-mono font-bold text-slate-200 truncate block">${envioMina}</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px]">Transferido Sinter:</span>
            <span class="font-mono font-bold text-amber-400 block">${transferido} TMH</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px]">% Humedad:</span>
            <span class="font-mono font-bold text-blue-400 block">${humedad}%</span>
          </div>
          <div>
            <span class="text-slate-500 block text-[10px]">Tratamiento Magnética:</span>
            <span class="font-mono font-bold text-emerald-400 block">${tratamiento} Ton</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// TAB 2: CAPTURA RDO
// ==========================================

// Render 9 visual interactive silo level meters
function renderSilosVisual() {
  const container = document.getElementById('silos-visual-container');
  if (!container) return;

  container.innerHTML = Array.from({ length: 9 }, (_, i) => {
    const siloNum = i + 1;
    return `
      <div class="silo-card bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex flex-col items-center space-y-2">
        <span class="font-mono font-black text-[11px] text-amber-400">Silo ${siloNum}</span>
        
        <!-- Vertical Bar Gauge -->
        <div class="w-7 h-20 bg-slate-950 rounded-lg p-0.5 border border-slate-800 relative flex flex-col justify-end overflow-hidden">
          <div id="silo-bar-${siloNum}" class="silo-bar w-full rounded-md bg-emerald-500" style="height: 60%;"></div>
        </div>

        <!-- Level Number Input (Scale 0 to 5 meters) -->
        <div class="w-full">
          <input type="number" step="0.5" min="0" max="5" value="3"
            data-silo-id="${siloNum}"
            data-rdo-param="Silo ${siloNum}"
            data-rdo-area="TRITURACION"
            class="silo-input rdo-field w-full bg-slate-950 border border-slate-700 rounded-lg py-1 text-center font-mono font-bold text-white text-xs focus:border-amber-400"
            placeholder="m">
        </div>
      </div>
    `;
  }).join('');

  // Attach live visual updates to silo inputs
  container.querySelectorAll('.silo-input').forEach(inp => {
    inp.addEventListener('input', () => updateSiloBarVisual(inp));
  });
}

function updateSiloBarVisual(input) {
  const siloId = input.dataset.siloId;
  const val = parseFloat(input.value) || 0;
  const pct = Math.min(100, Math.max(0, (val / 5) * 100));
  const bar = document.getElementById(`silo-bar-${siloId}`);
  if (!bar) return;

  bar.style.height = `${pct}%`;
  if (val >= 3.5) {
    bar.className = 'silo-bar w-full rounded-md bg-emerald-500';
  } else if (val >= 2) {
    bar.className = 'silo-bar w-full rounded-md bg-amber-500';
  } else {
    bar.className = 'silo-bar w-full rounded-md bg-red-500';
  }
}

async function loadRDO() {
  try {
    // Clear fields
    document.querySelectorAll('.rdo-field').forEach(f => f.value = '');

    const data = await api(`/api/rdo?fecha=${state.date}&guardia=${state.guardia}`);

    // Populate values
    (data.entries || []).forEach(e => {
      const field = document.querySelector(`.rdo-field[data-rdo-area="${e.area}"][data-rdo-param="${e.parametro}"]`);
      if (field) {
        field.value = e.valor || '';
        if (field.classList.contains('silo-input')) {
          updateSiloBarVisual(field);
        }
      }
    });

    // Populate Bitácora
    const hist = document.getElementById('rdo-bitacora-history');
    if (hist) {
      if ((data.bitacora || []).length === 0) {
        hist.innerHTML = '<div class="text-slate-500 text-xs italic">Sin novedades registradas para este turno.</div>';
      } else {
        hist.innerHTML = data.bitacora.map(b => `
          <div class="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs">
            <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span class="font-bold text-amber-400">${b.area}</span>
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
    const areas = ['TRITURACION', 'FILTROS', 'PLANTA MAGNETICA', 'RELAVES'];
    const bitacora = document.getElementById('rdo-bitacora-input').value;

    for (const area of areas) {
      const entries = {};
      document.querySelectorAll(`.rdo-field[data-rdo-area="${area}"]`).forEach(inp => {
        entries[inp.dataset.rdoParam] = inp.value;
      });

      await api('/api/rdo', {
        method: 'POST',
        body: JSON.stringify({
          fecha: state.date,
          guardia: state.guardia,
          area,
          entries,
          bitacoraDetalle: area === 'TRITURACION' ? bitacora : null
        })
      });
    }

    document.getElementById('rdo-bitacora-input').value = '';
    showToast('Reporte RDO guardado y sincronizado con éxito', 'success');
    loadRDO();
    loadDashboardKPIs();
  } catch (err) {
    showToast('Error guardando RDO: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-bold ph-floppy-disk text-base"></i> Guardar RDO';
  }
}

async function handleCopyPrevShift() {
  if (!confirm(`¿Copiar estados y líneas de la guardia anterior hacia Guardia ${state.guardia}?`)) return;

  try {
    const res = await api('/api/rdo/copy-previous', {
      method: 'POST',
      body: JSON.stringify({ fecha: state.date, targetGuardia: state.guardia })
    });
    showToast(res.message, 'success');
    loadRDO();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// TAB 3: PRODUCCIÓN HORARIA
// ==========================================

async function loadConcentrado() {
  try {
    const rows = await api(`/api/concentrado?fecha=${state.date}`);
    const tbody = document.getElementById('tbody-concentrado');
    if (!tbody) return;

    tbody.innerHTML = rows.map((r, i) => {
      // Determine shift tag for each hour
      // Hours 1-8: Guardia A (09:00 - 17:00)
      // Hours 9-16: Guardia B (17:00 - 01:00)
      // Hours 17-24: Guardia C (01:00 - 09:00)
      let shiftTag = 'GA';
      let shiftBadge = '<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold ml-1">G-A</span>';
      if (r.num_hora >= 9 && r.num_hora <= 16) {
        shiftTag = 'GB';
        shiftBadge = '<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold ml-1">G-B</span>';
      } else if (r.num_hora >= 17) {
        shiftTag = 'GC';
        shiftBadge = '<span class="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold ml-1">G-C</span>';
      }

      return `
        <tr class="hover:bg-slate-800/60 transition-colors conc-row" data-hora-idx="${r.num_hora}" data-shift="${shiftTag}">
          <td class="py-2.5 px-3 font-mono font-bold text-slate-300 whitespace-nowrap">
            ${r.hora} ${shiftBadge}
          </td>
          <td class="py-2 px-2 text-right">
            <input type="number" step="any" value="${r.mineral_tms || ''}" class="conc-mineral w-24 bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-right text-white font-mono focus:border-amber-400">
          </td>
          <td class="py-2 px-2 text-right">
            <input type="number" step="any" value="${r.concentrado_tms || ''}" class="conc-prod w-24 bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-right text-amber-300 font-mono font-bold focus:border-amber-400">
          </td>
          <td class="py-2 px-2 text-right">
            <input type="number" step="any" value="${r.s_pct || ''}" class="conc-s w-20 bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1.5 text-right text-white font-mono focus:border-amber-400">
          </td>
          <td class="py-2 px-2 text-right">
            <input type="number" step="any" value="${r.esp_n_fe_sol || ''}" class="conc-fesol w-20 bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1.5 text-right text-white font-mono focus:border-amber-400">
          </td>
          <td class="py-2 px-2 text-right">
            <input type="number" step="any" value="${r.esp_n_feo || ''}" class="conc-feo w-20 bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1.5 text-right text-white font-mono focus:border-amber-400">
          </td>
          <td class="py-2 px-2 text-right">
            <input type="number" step="any" value="${r.h2o_pct || ''}" class="conc-h2o w-20 bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1.5 text-right text-white font-mono focus:border-amber-400">
          </td>
          <td class="py-2.5 px-3 text-right font-mono font-black text-emerald-400 calc-recup">
            ${r.recup_pct ? r.recup_pct + '%' : '-'}
          </td>
          <td class="py-2.5 px-3 text-right font-mono font-black text-purple-400 calc-ratio">
            ${r.ratio ? r.ratio : '-'}
          </td>
          <td class="py-2 px-2">
            <input type="text" value="${r.obs_magnetica || ''}" placeholder="Obs..." class="conc-obs w-full min-w-[130px] bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-300">
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('input', () => {
        calculateConcentradoRow(tr);
        updateConcentradoSummaryStrip();
      });
    });

    filterConcentradoRows();
    updateConcentradoSummaryStrip();
  } catch (err) {
    showToast('Error cargando Producción: ' + err.message, 'error');
  }
}

function filterConcentradoRows() {
  document.querySelectorAll('.conc-row').forEach(tr => {
    if (state.concFilter === 'ALL' || tr.dataset.shift === state.concFilter) {
      tr.style.display = '';
    } else {
      tr.style.display = 'none';
    }
  });
  updateConcentradoSummaryStrip();
}

function calculateConcentradoRow(tr) {
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

function updateConcentradoSummaryStrip() {
  let totalMineral = 0;
  let totalConc = 0;
  let sumFeSol = 0;
  let countFeSol = 0;

  document.querySelectorAll('.conc-row').forEach(tr => {
    if (tr.style.display === 'none') return;
    const min = parseFloat(tr.querySelector('.conc-mineral')?.value) || 0;
    const conc = parseFloat(tr.querySelector('.conc-prod')?.value) || 0;
    const feSol = parseFloat(tr.querySelector('.conc-fesol')?.value) || 0;

    totalMineral += min;
    totalConc += conc;
    if (feSol > 0) {
      sumFeSol += feSol;
      countFeSol++;
    }
  });

  const avgFeSol = countFeSol > 0 ? (sumFeSol / countFeSol) : 0;
  const avgRecup = (totalMineral > 0 && totalConc > 0 && avgFeSol > 0) ? ((totalConc * 68) / (totalMineral * avgFeSol) * 100) : 0;
  const avgRatio = totalConc > 0 ? (totalMineral / totalConc) : 0;

  document.getElementById('conc-sum-mineral').textContent = totalMineral.toFixed(2) + ' TMS';
  document.getElementById('conc-sum-conc').textContent = totalConc.toFixed(2) + ' TMS';
  document.getElementById('conc-avg-fesol').textContent = avgFeSol.toFixed(2) + '%';
  document.getElementById('conc-avg-recup').textContent = avgRecup.toFixed(2) + '%';
  document.getElementById('conc-avg-ratio').textContent = avgRatio.toFixed(2);
}

async function saveConcentrado() {
  const btn = document.getElementById('btn-save-concentrado');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Guardando...';

  try {
    const rows = [];
    document.querySelectorAll('#tbody-concentrado tr').forEach(tr => {
      rows.push({
        num_hora: Number(tr.dataset.horaIdx),
        hora: tr.querySelector('td:first-child').textContent.split(' ')[0],
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
    btn.innerHTML = '<i class="ph-bold ph-floppy-disk text-base"></i> Guardar 24h';
  }
}

// ==========================================
// TAB 4: CONTROLES DE PLANTA
// ==========================================

async function loadControles() {
  try {
    const saved = await api(`/api/controles?fecha=${state.date}`);
    const savedMap = {};
    saved.forEach(s => savedMap[`${s.modulo}_${s.item}_${s.turno}`] = s.valor);

    // 1. Filtros H2O
    const filtrosGrid = document.getElementById('filtros-h2o-grid');
    if (filtrosGrid) {
      const items = [
        'Filtro # 1', 'Filtro # 2', 'Filtro # 3', 'Filtro # 4', 'Filtro # 5',
        'Filtro Linea # 5', 'Filtro Linea # 6', 'Filtro Linea # 7', 'Filtro Linea # 8'
      ];

      filtrosGrid.innerHTML = items.map(item => {
        const val = savedMap[`FILTROS_H2O_${item}_1`] || 'OK';
        const isOk = val === 'OK';
        return `
          <div class="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl flex items-center justify-between" data-control-item="${item}">
            <div>
              <span class="text-xs font-black text-white block">${item}</span>
              <span class="text-[10px] text-slate-500 font-bold uppercase">Estado Operativo</span>
            </div>
            <button type="button" class="btn-toggle-filtro px-5 py-2 rounded-xl font-black text-xs transition-all ${isOk ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-lg shadow-red-500/10'}" data-status="${val}">
              ${val}
            </button>
          </div>
        `;
      }).join('');

      filtrosGrid.querySelectorAll('.btn-toggle-filtro').forEach(btn => {
        btn.addEventListener('click', () => {
          const next = btn.dataset.status === 'OK' ? 'FALLA' : 'OK';
          btn.dataset.status = next;
          btn.textContent = next;
          btn.className = `btn-toggle-filtro px-5 py-2 rounded-xl font-black text-xs transition-all ${next === 'OK' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-lg shadow-red-500/10'}`;
          updateFiltrosSummary();
        });
      });
      updateFiltrosSummary();
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
            <input type="text" class="purga-obs w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-slate-200" placeholder="Normal">
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

function updateFiltrosSummary() {
  let okCount = 0;
  const buttons = document.querySelectorAll('.btn-toggle-filtro');
  buttons.forEach(b => {
    if (b.dataset.status === 'OK') okCount++;
  });
  const total = buttons.length || 9;
  const pct = Math.round((okCount / total) * 100);

  const countEl = document.getElementById('filtros-operativos-count');
  const pctEl = document.getElementById('filtros-cumplimiento-pct');
  if (countEl) countEl.textContent = `${okCount} de ${total}`;
  if (pctEl) pctEl.textContent = `${pct}%`;
}

async function saveControles() {
  const btn = document.getElementById('btn-save-controles');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Guardando...';

  try {
    const filtrosEntries = [];
    document.querySelectorAll('#filtros-h2o-grid [data-control-item]').forEach(el => {
      filtrosEntries.push({
        item: el.dataset.controlItem,
        turno: '1',
        valor: el.querySelector('.btn-toggle-filtro').dataset.status
      });
    });
    if (filtrosEntries.length > 0) {
      await api('/api/controles', {
        method: 'POST',
        body: JSON.stringify({ fecha: state.date, modulo: 'FILTROS_H2O', entries: filtrosEntries })
      });
    }

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

    showToast('Controles de planta guardados exitosamente', 'success');
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
  if (!confirm('¿Desea eliminar este registro de parada?')) return;
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
