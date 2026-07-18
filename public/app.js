// State management variables
const sendForm = document.getElementById('send-form');
const apiKeyInput = document.getElementById('api-key-input');
const copyApiKeyBtn = document.getElementById('copy-api-key-btn');
const regenerateKeyBtn = document.getElementById('regenerate-key-btn');
const rateLimitInput = document.getElementById('rate-limit-input');
const saveRateLimitBtn = document.getElementById('save-rate-limit-btn');
const healthPulse = document.getElementById('health-pulse');
const consoleLogs = document.getElementById('console-logs');

const connectionTrigger = document.getElementById('connection-trigger');
const connectionModal = document.getElementById('connection-modal');
const connectionModalClose = document.getElementById('connection-modal-close');
const devicesContainer = document.getElementById('devices-container');
const addDeviceBtn = document.getElementById('add-device-btn');
const pairingSection = document.getElementById('pairing-section');
const pairingForm = document.getElementById('pairing-form');
const pairingPhoneInput = document.getElementById('pairing-phone');
const pairingCodeDisplay = document.getElementById('pairing-code-display');
const pairingCodeText = document.getElementById('pairing-code-text');

// Detail Sidebar elements
let selectedLogItem = null;
const detailSidebar = document.getElementById('detail-sidebar');
const detailSidebarClose = document.getElementById('detail-sidebar-close');
const detailStatus = document.getElementById('detail-status');
const detailRecipient = document.getElementById('detail-recipient');
const detailSender = document.getElementById('detail-sender');
const detailClinic = document.getElementById('detail-clinic');
const detailTimestamp = document.getElementById('detail-timestamp');
const detailMessage = document.getElementById('detail-message');
const detailErrorContainer = document.getElementById('detail-error-container');
const detailError = document.getElementById('detail-error');
const detailResendBtn = document.getElementById('detail-resend-btn');

function showDetailSidebar(item) {
  selectedLogItem = item;
  detailRecipient.textContent = `+${item.phone}`;
  detailSender.textContent = item.sender ? `+${item.sender}` : '-';
  detailClinic.textContent = item.clinicId || '-';
  
  let localTime = item.timestamp;
  try {
    localTime = new Date(item.timestamp).toLocaleString();
  } catch (e) {}
  detailTimestamp.textContent = localTime;
  detailMessage.textContent = item.message;
  
  if (item.status === 'sent') {
    detailStatus.className = 'inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-955/40 text-emerald-400 border border-emerald-900/20';
    detailStatus.textContent = 'SENT';
    detailErrorContainer.classList.add('hidden');
  } else {
    detailStatus.className = 'inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-rose-955/40 text-rose-400 border border-rose-900/20';
    detailStatus.textContent = 'FAILED';
    detailError.textContent = item.error || 'Unknown Error';
    detailErrorContainer.classList.remove('hidden');
  }
  
  detailSidebar.classList.remove('w-0', 'border-l-0');
  detailSidebar.classList.add('w-80', 'border-l');
}

function closeDetailSidebar() {
  detailSidebar.classList.remove('w-80', 'border-l');
  detailSidebar.classList.add('w-0', 'border-l-0');
  selectedLogItem = null;
}

detailSidebarClose.addEventListener('click', closeDetailSidebar);

detailResendBtn.addEventListener('click', async () => {
  if (!selectedLogItem) return;
  const item = selectedLogItem;
  detailResendBtn.disabled = true;
  detailResendBtn.textContent = 'Queuing...';
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['x-api-key'] = key;

    const body = { phone: item.phone, message: item.message };
    if (item.clinicId) body.clinicId = item.clinicId;

    const res = await fetch(`${API_BASE}/api/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const raw = await res.json();
    const data = raw.data !== undefined ? raw.data : raw;

    if (res.ok && (raw.success || data.success)) {
      logEvent(`Message successfully re-queued for +${item.phone}!`, 'success');
      closeDetailSidebar();
      if (activeTab === 'outbox') fetchOutboxLogs();
      if (activeTab === 'queue') fetchQueue();
    } else {
      const errMsg = data.error?.message || data.error || 'Server error';
      alert(`Resend failed: ${errMsg}`);
    }
  } catch (err) {
    alert('Network error during resend.');
  } finally {
    detailResendBtn.disabled = false;
    detailResendBtn.textContent = 'Resend Message';
  }
});

let outboxCurrentPage = 1;
const outboxLimit = 20;

// pagination DOM elements
const paginationRange = document.getElementById('pagination-range');
const paginationTotal = document.getElementById('pagination-total');
const paginationPrevBtn = document.getElementById('pagination-prev-btn');
const paginationNextBtn = document.getElementById('pagination-next-btn');
const paginationCurrentPage = document.getElementById('pagination-current-page');

let queueCurrentPage = 1;
const queueLimit = 20;

const queuePaginationRange = document.getElementById('queue-pagination-range');
const queuePaginationTotal = document.getElementById('queue-pagination-total');
const queuePaginationPrevBtn = document.getElementById('queue-pagination-prev-btn');
const queuePaginationNextBtn = document.getElementById('queue-pagination-next-btn');
const queuePaginationCurrentPage = document.getElementById('queue-pagination-current-page');

// Sandbox Inputs
const sandboxClinicId = document.getElementById('sandbox-clinic-id');

// Outbox filter inputs
const filterSearch = document.getElementById('filter-search');
const filterStatus = document.getElementById('filter-status');
const datePickerTrigger = document.getElementById('date-picker-trigger');
const datePickerLabel = document.getElementById('date-picker-label');
const datePickerPopover = document.getElementById('date-picker-popover');
const datePresetsList = document.getElementById('date-presets-list');
const popoverApplyBtn = document.getElementById('popover-apply-btn');
const resetFiltersBtn = document.getElementById('reset-filters-btn');

let activeDatePreset = 'all';
let fpInstance = null;

// Tabs navigation elements
const tabHomeBtn = document.getElementById('tab-home-btn');
const tabOutboxBtn = document.getElementById('tab-outbox-btn');
const tabDocsBtn = document.getElementById('tab-docs-btn');
const tabSettingsBtn = document.getElementById('tab-settings-btn');
const tabQueueBtn = document.getElementById('tab-queue-btn');
const tabDevicesBtn = document.getElementById('tab-devices-btn');
const tabHome = document.getElementById('tab-home');
const tabOutbox = document.getElementById('tab-outbox');
const tabQueue = document.getElementById('tab-queue');
const tabDocs = document.getElementById('tab-docs');
const tabSettings = document.getElementById('tab-settings');
const tabDevices = document.getElementById('tab-devices');
const devicesPageContainer = document.getElementById('devices-page-container');
const devicesCountBadge = document.getElementById('devices-count-badge');
const addDevicePageBtn = document.getElementById('add-device-page-btn');

// Queue Elements
const queueRows = document.getElementById('queue-rows');
const queueEmpty = document.getElementById('queue-empty');
const clearQueueBtn = document.getElementById('clear-queue-btn');

// Connection Status Modal elements
const connectionModalBackdrop = document.getElementById('connection-modal-backdrop');

const pageContextTitle = document.getElementById('page-context-title');
const sidebarStatus = document.getElementById('sidebar-status');

// Outbox history table rows
const outboxRows = document.getElementById('outbox-rows');
const outboxEmpty = document.getElementById('outbox-empty');

// Code Snippets UI
const docBtnCurl = document.getElementById('doc-btn-curl');
const docBtnNode = document.getElementById('doc-btn-node');
const docBtnPython = document.getElementById('doc-btn-python');
const codeSnippetBox = document.getElementById('code-snippet-box');
const copyCodeBtn = document.getElementById('copy-code-btn');

// Sandbox Response
const responseBlock = document.getElementById('response-block');
const responseJson = document.getElementById('response-json');
const responseBadge = document.getElementById('response-badge');

// Server API URL Setup
let apiBaseUrl = window.API_BASE || '';
if (apiBaseUrl.includes('host.docker.internal')) {
  apiBaseUrl = apiBaseUrl.replace('host.docker.internal', window.location.hostname);
}
const API_BASE = apiBaseUrl || (
  (window.location.port === '3001' || window.location.port === '3006')
    ? `${window.location.protocol}//${window.location.hostname}:${parseInt(window.location.port, 10) - 1}`
    : ''
);

const VALID_TABS = ['home', 'outbox', 'queue', 'devices', 'docs', 'settings'];
const savedTab = localStorage.getItem('activeTab');
let activeTab = VALID_TABS.includes(savedTab) ? savedTab : 'home';
let docLanguage = 'curl';
let linkMode = 'qr'; // 'qr' or 'pair'
let authPollingInterval = null;

// Helper functions
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Output logs inside the console box
function logEvent(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  let colorClass = 'text-slate-400';
  let prefix = 'LOG';
  
  if (type === 'success') {
    colorClass = 'text-emerald-400';
    prefix = 'OK ';
  } else if (type === 'error') {
    colorClass = 'text-red-400';
    prefix = 'ERR';
  } else if (type === 'warn') {
    colorClass = 'text-yellow-400';
    prefix = 'WRN';
  } else if (type === 'event') {
    colorClass = 'text-teal-400';
    prefix = 'EVT';
  }
  
  const line = document.createElement('div');
  line.className = `${colorClass} py-0.5 leading-relaxed border-b border-slate-900/40`;
  line.innerHTML = `<span class="text-slate-600 select-none">[${timestamp}]</span> <span class="bg-slate-900 text-slate-500 px-1 py-0.2 rounded font-semibold text-[10px] mr-1.5 select-none">${prefix}</span> ${message}`;
  
  consoleLogs.appendChild(line);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// Retrieve active API Key from config input
function getApiKey() {
  const localKey = localStorage.getItem('whatsapp_api_key');
  if (localKey) return localKey;
  if (window.API_KEY) {
    localStorage.setItem('whatsapp_api_key', window.API_KEY);
    return window.API_KEY;
  }
  return '';
}

// Update local config values
apiKeyInput.addEventListener('input', (e) => {
  const val = e.target.value;
  localStorage.setItem('whatsapp_api_key', val);
  updateCodeSnippet();
  logEvent('Local configuration: API Key modified.', 'warn');
});

// Check status of gateway connection
// Link modes map: deviceId -> 'qr' | 'pair'
const linkModeMap = {};

// Toggle device link mode between QR and pairing code
// Open a modal to connect (QR or Pairing) a specific device
window.showConnectModal = function(id) {
  // Get latest device data from the cache so we have the QR data URL
  const headers = { 'Content-Type': 'application/json' };
  const key = getApiKey();
  if (key) headers['x-api-key'] = key;

  fetch(`${API_BASE}/api/devices`, { headers })
    .then(r => r.json())
    .then(devices => {
      const device = devices.find(d => d.id === id);
      if (!device) return;
      renderConnectModal(device);
    })
    .catch(() => alert('Could not load device info.'));
};

function renderConnectModal(device) {
  // Remove any existing connect modal
  const existing = document.getElementById('connect-device-modal');
  if (existing) existing.remove();

  const mode = linkModeMap[device.id] || 'qr';
  const displayName = device.name || device.id.replace('session_', '#');

  const overlay = document.createElement('div');
  overlay.id = 'connect-device-modal';
  overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm';
  overlay.innerHTML = `
    <div class="glass-card rounded-2xl border border-slate-800 shadow-2xl p-6 w-full max-w-md mx-4 space-y-5">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-200">${displayName}</h3>
          <p class="text-[10px] text-slate-500 font-mono mt-0.5">Link a WhatsApp number to this device</p>
        </div>
        <button id="connect-modal-close" class="text-slate-500 hover:text-slate-300 transition-colors">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Mode toggle -->
      <div class="flex bg-slate-950 p-0.5 rounded-xl border border-slate-900 text-[11px] font-bold">
        <button id="cm-tab-qr" type="button"
          class="flex-1 py-2 text-center rounded-lg transition-all ${mode !== 'pair' ? 'bg-slate-800 text-teal-400 border border-slate-700' : 'text-slate-500 hover:text-slate-300'}">
          QR Code
        </button>
        <button id="cm-tab-pair" type="button"
          class="flex-1 py-2 text-center rounded-lg transition-all ${mode === 'pair' ? 'bg-slate-800 text-teal-400 border border-slate-700' : 'text-slate-500 hover:text-slate-300'}">
          Pairing Code
        </button>
      </div>

      <!-- Content -->
      <div id="cm-content"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#connect-modal-close').addEventListener('click', close);

  const renderContent = (m) => {
    const content = overlay.querySelector('#cm-content');
    if (m !== 'pair') {
      content.innerHTML = `
        <div class="flex items-start space-x-5">
          ${device.qr ? `
            <div class="bg-white p-2 rounded-xl border border-slate-700 flex-shrink-0">
              <img class="w-40 h-40" src="${device.qr}" alt="QR Code">
            </div>
          ` : `
            <div class="flex items-center justify-center w-40 h-40 rounded-xl border border-slate-800 bg-slate-950 flex-shrink-0">
              <div class="animate-spin rounded-full h-6 w-6 border-2 border-slate-800 border-t-teal-500"></div>
            </div>
          `}
          <div class="space-y-2 pt-1">
            <p class="text-xs font-semibold text-slate-300">Scan with WhatsApp</p>
            <ol class="text-[10px] text-slate-500 space-y-1 leading-relaxed list-decimal list-inside">
              <li>Open WhatsApp on your phone</li>
              <li>Go to Settings → Linked Devices</li>
              <li>Tap <strong class="text-slate-400">Link a Device</strong></li>
              <li>Point your camera at this QR code</li>
            </ol>
            ${device.status === 'connecting' ? '<p class="text-[10px] text-amber-400 animate-pulse font-mono">Connecting…</p>' : ''}
          </div>
        </div>
      `;
    } else {
      content.innerHTML = `
        <div class="space-y-3">
          <p class="text-[11px] text-slate-500">Enter the phone number registered on WhatsApp to receive a pairing code:</p>
          <div class="flex gap-2">
            <input type="text" id="cm-phone-input"
              class="flex-1 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-teal-500/60"
              placeholder="e.g. 5511999999999">
            <button id="cm-get-code" type="button"
              class="px-4 py-2.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 rounded-xl text-xs font-bold transition-all whitespace-nowrap">
              Get Code
            </button>
          </div>
          <div id="cm-pair-display" class="hidden bg-slate-950 border border-slate-800 rounded-xl py-4 text-center font-mono">
            <span class="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Your Pairing Code</span>
            <span id="cm-pair-code" class="text-2xl font-bold text-teal-400 tracking-[0.25em]"></span>
          </div>
        </div>
      `;

      overlay.querySelector('#cm-get-code').addEventListener('click', async () => {
        const phone = overlay.querySelector('#cm-phone-input').value.trim();
        if (!phone) { alert('Please enter a phone number.'); return; }

        const btn = overlay.querySelector('#cm-get-code');
        btn.textContent = 'Requesting…';
        btn.disabled = true;

        try {
          const headers = { 'Content-Type': 'application/json' };
          const key = getApiKey();
          if (key) headers['x-api-key'] = key;

          const res = await fetch(`${API_BASE}/api/devices/${device.id}/pairing-code`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ phone })
          });
          const raw = await res.json();
          const data = raw.data !== undefined ? raw.data : raw;

          if (res.ok && data.code) {
            overlay.querySelector('#cm-pair-display').classList.remove('hidden');
            overlay.querySelector('#cm-pair-code').textContent = data.code;
          } else {
            const errMsg = data.error?.message || data.error || 'Unknown error';
            alert('Failed to get pairing code: ' + errMsg);
          }
        } catch (err) {
          alert('Network error requesting pairing code.');
        } finally {
          btn.textContent = 'Get Code';
          btn.disabled = false;
        }
      });
    }
  };

  // Tab switching inside the modal
  overlay.querySelector('#cm-tab-qr').addEventListener('click', () => {
    linkModeMap[device.id] = 'qr';
    overlay.querySelector('#cm-tab-qr').className = 'flex-1 py-2 text-center rounded-lg transition-all bg-slate-800 text-teal-400 border border-slate-700';
    overlay.querySelector('#cm-tab-pair').className = 'flex-1 py-2 text-center rounded-lg transition-all text-slate-500 hover:text-slate-300';
    renderContent('qr');
  });
  overlay.querySelector('#cm-tab-pair').addEventListener('click', () => {
    linkModeMap[device.id] = 'pair';
    overlay.querySelector('#cm-tab-pair').className = 'flex-1 py-2 text-center rounded-lg transition-all bg-slate-800 text-teal-400 border border-slate-700';
    overlay.querySelector('#cm-tab-qr').className = 'flex-1 py-2 text-center rounded-lg transition-all text-slate-500 hover:text-slate-300';
    renderContent('pair');
  });

  renderContent(mode);
}

window.toggleDeviceLinkMode = function(id, mode) {
  linkModeMap[id] = mode;
  // Re-render but restore the panel open state
  fetchDevices().then(() => {
    const panel = document.getElementById(`connect-panel-${id}`);
    if (panel) panel.classList.remove('hidden');
  });
};

// Request pairing code for a specific device
window.requestDevicePairingCode = async function(id) {
  const phoneInput = document.getElementById(`phone-${id}`);
  const phone = phoneInput ? phoneInput.value.trim() : '';
  if (!phone) {
    alert('Please enter a valid phone number');
    return;
  }

  const pairDisplay = document.getElementById(`pair-display-${id}`);
  const pairCodeText = document.getElementById(`pair-code-${id}`);

  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['x-api-key'] = key;

    const res = await fetch(`${API_BASE}/api/devices/${id}/pairing-code`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone })
    });
    const raw = await res.json();
    const data = raw.data !== undefined ? raw.data : raw;

    if (res.ok && (raw.success || data.success) && data.code) {
      pairCodeText.textContent = data.code;
      pairDisplay.classList.remove('hidden');
      logEvent(`Pairing code for device ${id} generated successfully: ${data.code}`, 'success');
    } else {
      const errMsg = data.error?.message || data.error || 'Unknown error';
      alert('Failed to request pairing code: ' + errMsg);
    }
  } catch (err) {
    alert('Network error requesting pairing code.');
  }
};

// Delete/Disconnect device
window.deleteDevice = async function(id) {
  if (!confirm(`Are you sure you want to remove WhatsApp session: ${id}?`)) return;

  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['x-api-key'] = key;

    logEvent(`Deleting WhatsApp device ${id}...`, 'event');
    const res = await fetch(`${API_BASE}/api/devices/${id}`, {
      method: 'DELETE',
      headers
    });
    const raw = await res.json();
    const data = raw.data !== undefined ? raw.data : raw;

    if (res.ok && (raw.success || data.success)) {
      logEvent(`WhatsApp device ${id} deleted successfully.`, 'success');
      fetchDevices();
    } else {
      const errMsg = data.error?.message || data.error || 'Unknown error';
      alert('Failed to delete device: ' + errMsg);
    }
  } catch (err) {
    alert('Network error deleting device.');
  }
};

// Fetch devices list from backend
async function fetchDevices() {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['x-api-key'] = key;

    const res = await fetch(`${API_BASE}/api/devices`, { headers });
    if (res.ok) {
      const result = await res.json();
      const devices = result.data || [];
      renderDevices(devices);
    }
  } catch (e) {
    console.error('Failed to fetch devices:', e);
  }
}

// Fetch and render devices into the full-page Devices tab
async function fetchDevicesPage() {
  if (!devicesPageContainer) return;
  devicesPageContainer.innerHTML = `
    <div class="col-span-2 text-center py-10 text-xs text-slate-500">
      <div class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-slate-700 border-t-teal-500 mr-2 align-middle"></div>
      Loading devices...
    </div>`;

  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['x-api-key'] = key;

    const res = await fetch(`${API_BASE}/api/devices`, { headers });
    if (res.ok) {
      const result = await res.json();
      const devices = result.data || [];
      renderDevices(devices);
    }
  } catch (e) {
    console.error('Failed to fetch devices page:', e);
    devicesPageContainer.innerHTML = `<div class="col-span-2 text-center py-10 text-xs text-red-400">Failed to load devices. Check API connectivity.</div>`;
  }
}

function renderDevices(devices) {
  // --- Update sidebar badge ---
  const connectedCount = devices.filter(d => d.status === 'connected').length;

  if (devicesCountBadge) {
    if (connectedCount > 0) {
      devicesCountBadge.textContent = connectedCount;
      devicesCountBadge.classList.remove('hidden');
    } else {
      devicesCountBadge.classList.add('hidden');
    }
  }

  // Build the list HTML (shared between modal container and page container)
  const buildCards = (container, emptyMsg) => {
    if (!container) return;
    if (devices.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 text-xs text-slate-500 font-mono border border-dashed border-slate-800 rounded-xl">
          ${emptyMsg}
        </div>`;
      return;
    }
    container.innerHTML = `
      <div class="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80">
        ${devices.map(device => {
          // ---- Status display ----
          let dotColor, badgeClass, statusLabel, canConnect;
          switch (device.status) {
            case 'connected':
              dotColor = 'bg-emerald-500';
              badgeClass = 'bg-emerald-955/40 text-emerald-400 border border-emerald-900/30';
              statusLabel = 'CONNECTED';
              canConnect = false;
              break;
            case 'qr':
              dotColor = 'bg-amber-400 animate-pulse';
              badgeClass = 'bg-amber-955/40 text-amber-400 border border-amber-900/30 animate-pulse';
              statusLabel = 'LINK NEEDED';
              canConnect = true;
              break;
            case 'connecting':
              dotColor = 'bg-teal-400 animate-pulse';
              badgeClass = 'bg-teal-955/40 text-teal-400 border border-teal-900/30 animate-pulse';
              statusLabel = 'CONNECTING';
              canConnect = true;
              break;
            case 'disconnected':
            default:
              dotColor = 'bg-red-500';
              badgeClass = 'bg-red-955/40 text-red-400 border border-red-900/30';
              statusLabel = 'DISCONNECTED';
              canConnect = true;
              break;
          }

          const mode = linkModeMap[device.id] || 'qr';
          // Show user-given name if set; else shorten the session ID
          const shortId = device.id.replace('session_', '#');
          const displayName = device.name ? device.name : shortId;
          const phoneLine = device.number ? `+${device.number}` : 'Not linked';

          return `
            <div class="bg-slate-950/40 hover:bg-slate-900/30 transition-all">
              <!-- Row -->
              <div class="flex items-center justify-between px-4 py-3">
                <div class="flex items-center space-x-3 min-w-0">
                  <span class="h-2 w-2 rounded-full flex-shrink-0 ${dotColor}"></span>
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-slate-200 font-mono truncate">${displayName}</p>
                    <p class="text-[10px] text-slate-500 font-mono">${phoneLine}</p>
                  </div>
                </div>
                <div class="flex items-center space-x-2 flex-shrink-0 ml-4">
                  <span class="px-2 py-0.5 rounded text-[9px] font-bold ${badgeClass}">${statusLabel}</span>
                  ${canConnect ? `
                    <button type="button"
                      onclick="showConnectModal('${device.id}')"
                      class="px-2.5 py-1.5 bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 border border-teal-500/30 rounded-lg text-[10px] font-bold transition-all">
                      Connect
                    </button>
                  ` : ''}
                  <button type="button"
                    onclick="deleteDevice('${device.id}')"
                    class="px-2.5 py-1.5 bg-red-955/10 hover:bg-red-955/30 text-red-400 border border-red-900/30 rounded-lg text-[10px] font-bold transition-all">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>`;
  }; // end buildCards

  buildCards(devicesContainer, 'No load balancing devices registered yet. Click "+ Add Device" above to start.');
  buildCards(devicesPageContainer, 'No devices registered yet. Click "+ Add Device" above to get started.');
}

// Check status of gateway connection
async function checkStatus() {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) {
      headers['x-api-key'] = key;
    }

    const res = await fetch(`${API_BASE}/api/devices`, { headers });
    
    // Handle unauthenticated state (don't lock, just reflect state in console logs and status badge)
    if (res.status === 401) {
      healthPulse.className = 'h-2.5 w-2.5 rounded-full bg-red-500 shadow-glow-red';
      sidebarStatus.className = 'inline-flex items-center font-bold px-2.5 py-0.5 rounded text-[10px] bg-red-955/50 text-red-400 border border-red-900/30';
      sidebarStatus.textContent = 'UNAUTHORIZED';
      
      if (res.statusText !== 'LogChecked') {
        logEvent('API Authorization failed: Active API Key rejected (401). Please update in settings.', 'error');
        res.statusText = 'LogChecked'; // Prevent log spam
      }
      return;
    }

    const devices = await res.json();
    
    // Connection health pulse color based on overall connection status
    const connectedCount = devices.filter(d => d.status === 'connected').length;
    
    if (connectedCount > 0) {
      healthPulse.className = 'h-2.5 w-2.5 rounded-full bg-emerald-500 pulse-ring shadow-glow-emerald';
      sidebarStatus.className = 'inline-flex items-center font-bold px-2.5 py-0.5 rounded text-[10px] bg-emerald-955/50 text-emerald-400 border border-emerald-900/30';
      sidebarStatus.textContent = `${connectedCount} ACTIVE`;
    } else {
      healthPulse.className = 'h-2.5 w-2.5 rounded-full bg-amber-500 pulse-ring shadow-glow-amber';
      sidebarStatus.className = 'inline-flex items-center font-bold px-2.5 py-0.5 rounded text-[10px] bg-amber-955/50 text-amber-400 border border-amber-900/30';
      sidebarStatus.textContent = 'LINK NEEDED';
    }

    // If connection modal is open, refresh the device cards rendering
    // Always update stats & badge; also refresh visible containers
    renderDevices(devices);

    if (activeTab === 'queue') {
      fetchQueue();
    }
  } catch (err) {
    healthPulse.className = 'h-2.5 w-2.5 rounded-full bg-red-500 shadow-glow-red';
    sidebarStatus.className = 'inline-flex items-center font-bold px-2.5 py-0.5 rounded text-[10px] bg-red-955/50 text-red-400 border border-red-900/30';
    sidebarStatus.textContent = 'OFFLINE';
    logEvent('Connection failure: Unable to poll REST API devices list.', 'error');
  }
}

// Check gateway authentication status on load
async function checkAuthStatus() {
  try {
    logEvent('Checking gateway authorization requirements...', 'info');
    const res = await fetch(`${API_BASE}/api/auth-status`);
    const data = await res.json();
    
    if (data.authRequired) {
      const storedKey = getApiKey();
      if (!storedKey) {
        logEvent('Authorization is REQUIRED by the API Gateway. Please enter your API Key in the Settings panel.', 'warn');
      } else {
        apiKeyInput.value = storedKey;
        updateCodeSnippet();
        logEvent('Active local API Key configured for requests.', 'success');
      }
    } else {
      logEvent('No API Key protection enabled on backend. Operating in unlocked mode.', 'info');
    }
  } catch (e) {
    logEvent('Failed to query gateway authorization status.', 'error');
  } finally {
    startPolling();
  }
}

// Copy API Key
copyApiKeyBtn.addEventListener('click', () => {
  const key = getApiKey();
  if (!key) {
    alert('No API key configured to copy.');
    return;
  }
  navigator.clipboard.writeText(key);
  const originalText = copyApiKeyBtn.textContent;
  copyApiKeyBtn.textContent = 'Copied!';
  copyApiKeyBtn.className = 'px-3.5 py-2 bg-emerald-955 border border-emerald-900/30 text-emerald-400 text-xs font-bold rounded-xl transition-all';
  setTimeout(() => {
    copyApiKeyBtn.textContent = originalText;
    copyApiKeyBtn.className = 'px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition-all';
  }, 2000);
});

// Rotate API Key
regenerateKeyBtn.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to regenerate the API key? This will rewrite your server\'s `.env` configuration file immediately.')) return;
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['x-api-key'] = key;

    logEvent('Requesting API Key rotation to backend...', 'event');
    const res = await fetch(`${API_BASE}/api/key/regenerate`, {
      method: 'POST',
      headers
    });
    const data = await res.json();

    if (res.ok && data.success && data.apiKey) {
      localStorage.setItem('whatsapp_api_key', data.apiKey);
      apiKeyInput.value = data.apiKey;
      updateCodeSnippet();
      logEvent('Key rotated successfully. Backend .env rewritten with new secret.', 'success');
      alert('API Key successfully regenerated and saved to .env!\n\nNew Key: ' + data.apiKey);
    } else {
      const errMsg = data.error?.message || data.error || 'Unauthorized';
      logEvent('Failed to regenerate key: ' + errMsg, 'error');
      alert('Failed to regenerate API Key: ' + errMsg);
    }
  } catch (e) {
    logEvent('Failed to send key rotation request.', 'error');
    alert('Network error executing rotation.');
  }
});

  // Fetch active configuration from backend
  async function fetchConfig() {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const key = getApiKey();
      if (key) headers['x-api-key'] = key;

      const res = await fetch(`${API_BASE}/api/config`, { headers });
      if (res.ok) {
        const raw = await res.json();
        const data = raw.data !== undefined ? raw.data : raw;
        if (data.queueDelaySeconds && rateLimitInput) {
          rateLimitInput.value = data.queueDelaySeconds;
        }
      }
    } catch (err) {
      console.error('Failed to load active config from backend:', err);
    }
  }

  // Save Queue Delay Rate Limit
  saveRateLimitBtn.addEventListener('click', async () => {
    const val = parseInt(rateLimitInput.value, 10);
    if (isNaN(val) || val < 1 || val > 60) {
      alert('Please enter a valid rate limit delay between 1 and 60 seconds.');
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const key = getApiKey();
      if (key) headers['x-api-key'] = key;

      logEvent(`Saving new rate limit delay: ${val}s...`, 'event');
      const res = await fetch(`${API_BASE}/api/config/rate-limit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ delaySeconds: val })
      });
      const raw = await res.json();
      const data = raw.data !== undefined ? raw.data : raw;

      if (res.ok && (raw.success || data.success)) {
        logEvent(`Rate limit updated successfully to ${val}s.`, 'success');
        alert(`Rate limit successfully updated to ${val} seconds!`);
      } else {
        const errMsg = data.error?.message || data.error || 'Server error';
        logEvent('Failed to save rate limit: ' + errMsg, 'error');
        alert('Failed to save rate limit: ' + errMsg);
      }
    } catch (err) {
      logEvent('Failed to send rate limit save request.', 'error');
      alert('Network error saving rate limit.');
    }
  });

// Add Device Button Listener
addDeviceBtn.addEventListener('click', async () => {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['x-api-key'] = key;

    logEvent('Registering a new load balancer WhatsApp device...', 'event');
    const res = await fetch(`${API_BASE}/api/devices`, {
      method: 'POST',
      headers
    });
    const raw = await res.json();
    const data = raw.data !== undefined ? raw.data : raw;

    if (res.ok && (raw.success || data.success)) {
      logEvent(`New device session ${data.id} initialized.`, 'success');
      fetchDevices();
    } else {
      const errMsg = data.error?.message || data.error || 'Unknown error';
      alert('Failed to register device: ' + errMsg);
    }
  } catch (err) {
    alert('Network error registering device.');
  }
});

function startPolling() {
  if (authPollingInterval) clearInterval(authPollingInterval);
  checkStatus();
  authPollingInterval = setInterval(checkStatus, 3000);
}

// Send Message sandbox trigger
sendForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('phone').value.trim();
  const message = document.getElementById('message').value;

  responseBlock.classList.add('hidden');
  logEvent(`Sandbox: Sending payload to recipient: ${phone}...`, 'event');

  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['x-api-key'] = key;

    const body = { phone, message };
    const clinicIdVal = sandboxClinicId.value.trim();
    if (clinicIdVal) {
      body.clinicId = clinicIdVal;
    }

    const res = await fetch(`${API_BASE}/api/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const raw = await res.json();
    const data = raw.data !== undefined ? raw.data : raw;

    responseBlock.classList.remove('hidden');
    responseJson.textContent = JSON.stringify(raw, null, 2);

    if (res.ok && (raw.success || data.success)) {
      responseBadge.className = 'absolute top-3 right-3 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-emerald-955 text-emerald-400 border border-emerald-900/30';
      responseBadge.textContent = '200 SUCCESS';
      logEvent(`Message queued successfully for +${phone}! Check Queue Manager.`, 'success');
      
      document.getElementById('message').value = '';
    } else {
      responseBadge.className = 'absolute top-3 right-3 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-900/30';
      responseBadge.textContent = `${res.status} ERROR`;
      const errMsg = data.error?.message || data.error || 'Server error';
      logEvent(`Message delivery failed. Reason: ${errMsg}`, 'error');
    }
  } catch (err) {
    responseBlock.classList.remove('hidden');
    responseJson.textContent = JSON.stringify({ error: 'Failed to complete fetch dispatch.' }, null, 2);
    responseBadge.className = 'absolute top-3 right-3 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-900/30';
    responseBadge.textContent = 'FAIL';
    logEvent('Sandbox fetch error: Network exception occurred.', 'error');
  }
});

// Database Outbox Logs Management
async function fetchOutboxLogs() {
  outboxRows.innerHTML = '';
  outboxEmpty.classList.add('hidden');
  
  const spinner = document.createElement('tr');
  spinner.innerHTML = `<td colspan="6" class="text-center py-6 text-xs text-slate-500">
    <div class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-slate-700 border-t-teal-500 mr-2 align-middle"></div>
    Fetching logs from gateway...
  </td>`;
  outboxRows.appendChild(spinner);

  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['x-api-key'] = key;

    // Build query filters based on inputs
    const search = filterSearch.value.trim();
    const status = filterStatus.value;
    const preset = activeDatePreset;
    
    let start = null;
    let end = null;

    if (preset !== 'all' && fpInstance && fpInstance.selectedDates.length > 0) {
      const dates = fpInstance.selectedDates;
      
      const s = new Date(dates[0]);
      s.setHours(0, 0, 0, 0);
      start = s.toISOString();
      
      const e = new Date(dates[1] || dates[0]);
      e.setHours(23, 59, 59, 999);
      end = e.toISOString();
    }

    let queryParams = `limit=${outboxLimit}&page=${outboxCurrentPage}`;
    if (search) queryParams += `&search=${encodeURIComponent(search)}`;
    if (status) queryParams += `&status=${encodeURIComponent(status)}`;
    if (start) queryParams += `&startDate=${encodeURIComponent(start)}`;
    if (end) queryParams += `&endDate=${encodeURIComponent(end)}`;

    const res = await fetch(`${API_BASE}/api/logs?${queryParams}`, { headers });
    if (res.status === 401) {
      outboxRows.innerHTML = '';
      outboxEmpty.classList.remove('hidden');
      outboxEmpty.textContent = 'Unauthorized: Invalid API Key to fetch logs.';
      updatePaginationControls(0, 0);
      return;
    }
    
    const result = await res.json();
    const logs = result.data || [];
    const total = result.metadata?.totalData || 0;
    outboxRows.innerHTML = '';

    if (!logs || logs.length === 0) {
      outboxEmpty.classList.remove('hidden');
      outboxEmpty.textContent = 'No matching message logs found.';
      updatePaginationControls(0, total);
      return;
    }
    outboxEmpty.classList.add('hidden');

    logs.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-900/30 transition-colors border-b border-slate-900/40';
      
      let statusBadge = '';
      if (item.status === 'sent') {
        statusBadge = `<button type="button" class="status-btn px-2 py-0.5 rounded text-[10px] bg-emerald-955/40 text-emerald-400 border border-emerald-900/20 hover:bg-emerald-900/20 transition-all font-semibold font-mono tracking-wider">Sent</button>`;
      } else {
        statusBadge = `<button type="button" class="status-btn px-2 py-0.5 rounded text-[10px] bg-rose-955/40 text-rose-400 border border-rose-900/20 hover:bg-rose-900/20 transition-all font-semibold font-mono tracking-wider">Failed</button>`;
      }

      // Format timestamp ISO string to local human readable
      let localTime = item.timestamp;
      try {
        localTime = new Date(item.timestamp).toLocaleString();
      } catch(e) {}

      const clinicCell = item.clinicId 
        ? `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-teal-400 border border-slate-800 font-mono">${escapeHTML(item.clinicId)}</span>`
        : `<span class="text-slate-600 font-mono text-[11px]">-</span>`;

      const escapeMsg = escapeHTML(item.message);
      const previewMsg = escapeMsg.length > 40 ? escapeMsg.substring(0, 37) + '...' : escapeMsg;

      const senderCell = item.sender 
        ? `<span class="text-slate-400 font-semibold font-mono text-[11px]">+${escapeHTML(item.sender)}</span>`
        : `<span class="text-slate-600 font-mono text-[11px]">-</span>`;

      row.innerHTML = `
        <td class="px-4 py-3">${senderCell}</td>
        <td class="px-4 py-3 text-slate-300 font-semibold select-all">+${item.phone}</td>
        <td class="px-4 py-3">${clinicCell}</td>
        <td class="px-4 py-3 text-slate-400 select-all" title="${escapeMsg}">${previewMsg}</td>
        <td class="px-4 py-3 text-slate-500">${localTime}</td>
        <td class="px-4 py-3">${statusBadge}</td>
      `;
      
      const btn = row.querySelector('.status-btn');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDetailSidebar(item);
      });

      outboxRows.appendChild(row);
    });

    updatePaginationControls(logs.length, total);
  } catch (err) {
    outboxRows.innerHTML = '';
    outboxEmpty.classList.remove('hidden');
    outboxEmpty.textContent = 'Error: Failed to retrieve logs from backend.';
    updatePaginationControls(0, 0);
  }
}

function updatePaginationControls(count, total) {
  paginationTotal.textContent = total;
  paginationCurrentPage.textContent = outboxCurrentPage;
  
  if (total === 0) {
    paginationRange.textContent = '0';
    paginationPrevBtn.disabled = true;
    paginationNextBtn.disabled = true;
    return;
  }
  
  const startRange = (outboxCurrentPage - 1) * outboxLimit + 1;
  const endRange = Math.min(outboxCurrentPage * outboxLimit, total);
  paginationRange.textContent = `${startRange}-${endRange}`;
  
  paginationPrevBtn.disabled = outboxCurrentPage <= 1;
  paginationNextBtn.disabled = endRange >= total;
}

// Database Sending Queue Management
async function fetchQueue() {
  if (!queueRows || !queueEmpty) return;
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['x-api-key'] = key;

    const res = await fetch(`${API_BASE}/api/queue?limit=${queueLimit}&page=${queueCurrentPage}`, { headers });
    if (res.status === 401) {
      queueRows.innerHTML = '';
      queueEmpty.classList.remove('hidden');
      queueEmpty.textContent = 'Unauthorized: Invalid API Key to fetch queue.';
      updateQueuePaginationControls(0, 0);
      return;
    }
    
    const result = await res.json();
    const queue = result.data || [];
    const total = result.metadata?.totalData || 0;
    queueRows.innerHTML = '';

    if (!queue || queue.length === 0) {
      queueEmpty.classList.remove('hidden');
      queueEmpty.textContent = 'No messages currently in sending queue.';
      updateQueuePaginationControls(0, total);
      return;
    }
    queueEmpty.classList.add('hidden');

    queue.forEach(item => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-900/30 transition-colors border-b border-slate-900/40';
      
      let localTime = item.timestamp;
      try {
        localTime = new Date(item.timestamp).toLocaleString();
      } catch(e) {}

      const clinicCell = item.clinicId 
        ? `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-teal-400 border border-slate-800 font-mono">${escapeHTML(item.clinicId)}</span>`
        : `<span class="text-slate-600 font-mono text-[11px]">-</span>`;

      const attemptsText = item.attempts > 0 
        ? `<span class="text-yellow-400 font-semibold" title="${item.error ? escapeHTML(item.error) : ''}">Attempt ${item.attempts}/3</span>`
        : `<span class="text-slate-500">0</span>`;

      const escapeMsg = escapeHTML(item.message);
      const previewMsg = escapeMsg.length > 40 ? escapeMsg.substring(0, 37) + '...' : escapeMsg;

      row.innerHTML = `
        <td class="px-4 py-3 text-slate-300 font-semibold select-all">+${item.phone}</td>
        <td class="px-4 py-3">${clinicCell}</td>
        <td class="px-4 py-3 text-slate-400 select-all" title="${escapeMsg}">${previewMsg}</td>
        <td class="px-4 py-3 text-slate-500">${localTime}</td>
        <td class="px-4 py-3">${attemptsText}</td>
      `;
      queueRows.appendChild(row);
    });

    updateQueuePaginationControls(queue.length, total);
  } catch (err) {
    queueRows.innerHTML = '';
    queueEmpty.classList.remove('hidden');
    queueEmpty.textContent = 'Error: Failed to retrieve queue from backend.';
    updateQueuePaginationControls(0, 0);
  }
}

function updateQueuePaginationControls(count, total) {
  queuePaginationTotal.textContent = total;
  queuePaginationCurrentPage.textContent = queueCurrentPage;
  
  if (total === 0) {
    queuePaginationRange.textContent = '0';
    queuePaginationPrevBtn.disabled = true;
    queuePaginationNextBtn.disabled = true;
    return;
  }
  
  const startRange = (queueCurrentPage - 1) * queueLimit + 1;
  const endRange = Math.min(queueCurrentPage * queueLimit, total);
  queuePaginationRange.textContent = `${startRange}-${endRange}`;
  
  queuePaginationPrevBtn.disabled = queueCurrentPage <= 1;
  queuePaginationNextBtn.disabled = endRange >= total;
}

// Clear Sending Queue
clearQueueBtn.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear the sending queue? This will delete all pending messages.')) return;
  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = getApiKey();
    if (key) headers['x-api-key'] = key;

    logEvent('Purging sending queue from backend...', 'event');
    const res = await fetch(`${API_BASE}/api/queue`, { method: 'DELETE', headers });
    const raw = await res.json();
    const data = raw.data !== undefined ? raw.data : raw;
    
    if (res.ok && (raw.success || data.success)) {
      logEvent('Queue purged successfully.', 'success');
      fetchQueue();
    } else {
      const errMsg = data.error?.message || data.error || 'Unknown error';
      logEvent('Failed to clear queue: ' + errMsg, 'error');
    }
  } catch (err) {
    logEvent('Failed to send clear queue request.', 'error');
    alert('Failed to clear queue.');
  }
});

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Wire filter events
filterSearch.addEventListener('input', debounce(() => {
  outboxCurrentPage = 1;
  fetchOutboxLogs();
}, 300));
filterStatus.addEventListener('change', () => {
  outboxCurrentPage = 1;
  fetchOutboxLogs();
});

paginationPrevBtn.addEventListener('click', () => {
  if (outboxCurrentPage > 1) {
    outboxCurrentPage--;
    fetchOutboxLogs();
  }
});

paginationNextBtn.addEventListener('click', () => {
  outboxCurrentPage++;
  fetchOutboxLogs();
});

queuePaginationPrevBtn.addEventListener('click', () => {
  if (queueCurrentPage > 1) {
    queueCurrentPage--;
    fetchQueue();
  }
});

queuePaginationNextBtn.addEventListener('click', () => {
  queueCurrentPage++;
  fetchQueue();
});

// Toggle date picker popover on trigger button click
datePickerTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  const isVisible = datePickerPopover.style.display === 'flex';
  datePickerPopover.style.display = isVisible ? 'none' : 'flex';
});

// Close popover when clicking anywhere outside of it
document.addEventListener('click', (e) => {
  if (datePickerPopover.contains(e.target) || datePickerTrigger.contains(e.target)) {
    return;
  }
  datePickerPopover.style.display = 'none';
});

// Initialize flatpickr calendar view
function initFlatpickr() {
  if (typeof flatpickr === 'undefined') {
    setTimeout(initFlatpickr, 100);
    return;
  }
  
  fpInstance = flatpickr("#flatpickr-calendar", {
    inline: true,
    mode: "range",
    dateFormat: "Y-m-d",
    showMonths: 1,
    onChange: function(selectedDates) {
      // Clear active styling on presets list when user customizes dates
      datePresetsList.querySelectorAll('[data-preset]').forEach(btn => {
        btn.className = "w-full text-left px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 font-medium transition-all block";
      });
    }
  });
  
  // Wire preset buttons
  datePresetsList.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      
      // Update presets styling
      datePresetsList.querySelectorAll('[data-preset]').forEach(b => {
        b.className = "w-full text-left px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 font-medium transition-all block";
      });
      btn.className = "w-full text-left px-2.5 py-1.5 rounded-lg text-teal-400 bg-slate-900 border border-slate-800 font-semibold transition-all block";
      
      if (preset === 'all') {
        fpInstance.clear();
        activeDatePreset = 'all';
        datePickerLabel.textContent = 'All Time';
        datePickerPopover.style.display = 'none';
        outboxCurrentPage = 1;
        fetchOutboxLogs();
      } else {
        const now = new Date();
        let start = new Date(now);
        let end = new Date(now);
        
        if (preset === 'today') {
          // keeps start & end as today
        } else if (preset === 'yesterday') {
          start.setDate(start.getDate() - 1);
          end.setDate(end.getDate() - 1);
        } else if (preset === 'last7') {
          start.setDate(start.getDate() - 7);
        } else if (preset === 'last30') {
          start.setDate(start.getDate() - 30);
        }
        
        fpInstance.setDate([start, end]);
        activeDatePreset = preset;
        
        datePickerLabel.textContent = btn.textContent;
        datePickerPopover.style.display = 'none';
        outboxCurrentPage = 1;
        fetchOutboxLogs();
      }
    });
  });

  // Wire apply button
  popoverApplyBtn.addEventListener('click', () => {
    const dates = fpInstance.selectedDates;
    if (dates.length === 0) {
      alert('Please select a date range on the calendar.');
      return;
    }
    
    let start = dates[0];
    let end = dates[1] || start; // Single day fallback if they only clicked once
    
    activeDatePreset = 'custom';
    
    const opt = { month: 'short', day: 'numeric', year: 'numeric' };
    if (start.toDateString() === end.toDateString()) {
      datePickerLabel.textContent = start.toLocaleDateString('en-US', opt);
    } else {
      datePickerLabel.textContent = `${start.toLocaleDateString('en-US', opt)} - ${end.toLocaleDateString('en-US', opt)}`;
    }
    
    datePickerPopover.style.display = 'none';
    outboxCurrentPage = 1;
    fetchOutboxLogs();
  });
}

resetFiltersBtn.addEventListener('click', () => {
  filterSearch.value = '';
  filterStatus.value = '';
  activeDatePreset = 'all';
  outboxCurrentPage = 1;
  if (fpInstance) {
    fpInstance.clear();
  }
  
  // Highlight "All Time" preset active
  datePresetsList.querySelectorAll('[data-preset]').forEach(b => {
    b.className = "w-full text-left px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 font-medium transition-all block";
  });
  const allBtn = datePresetsList.querySelector('[data-preset="all"]');
  if (allBtn) {
    allBtn.className = "w-full text-left px-2.5 py-1.5 rounded-lg text-teal-400 bg-slate-900 border border-slate-800 font-semibold transition-all block";
  }

  datePickerLabel.textContent = 'All Time';
  datePickerPopover.style.display = 'none';
  logEvent('Logs database filters reset.', 'info');
  fetchOutboxLogs();
});

// Tab view switcher
const activeStateClasses = ['text-teal-400', 'bg-slate-900', 'border-slate-800'];
const inactiveStateClasses = ['text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-900/60', 'border-transparent'];

function setTabBtnState(btn, isActive) {
  if (isActive) {
    inactiveStateClasses.forEach(c => btn.classList.remove(c));
    activeStateClasses.forEach(c => btn.classList.add(c));
  } else {
    activeStateClasses.forEach(c => btn.classList.remove(c));
    inactiveStateClasses.forEach(c => btn.classList.add(c));
  }
}

function switchTab(targetTab) {
  activeTab = targetTab;
  localStorage.setItem('activeTab', targetTab);

  // Update sidebar button states
  setTabBtnState(tabHomeBtn, targetTab === 'home');
  setTabBtnState(tabOutboxBtn, targetTab === 'outbox');
  setTabBtnState(tabQueueBtn, targetTab === 'queue');
  setTabBtnState(tabDevicesBtn, targetTab === 'devices');
  setTabBtnState(tabDocsBtn, targetTab === 'docs');
  setTabBtnState(tabSettingsBtn, targetTab === 'settings');

  // Update panel visibility (toggle hidden, keep base classes)
  tabHome.classList.toggle('hidden', targetTab !== 'home');
  tabOutbox.classList.toggle('hidden', targetTab !== 'outbox');
  tabQueue.classList.toggle('hidden', targetTab !== 'queue');
  tabDevices.classList.toggle('hidden', targetTab !== 'devices');
  tabDocs.classList.toggle('hidden', targetTab !== 'docs');
  tabSettings.classList.toggle('hidden', targetTab !== 'settings');

  // Update page context title
  if (targetTab === 'home') pageContextTitle.textContent = 'Home';
  else if (targetTab === 'outbox') pageContextTitle.textContent = 'Outbox History';
  else if (targetTab === 'queue') pageContextTitle.textContent = 'Queue Manager';
  else if (targetTab === 'devices') pageContextTitle.textContent = 'Devices';
  else if (targetTab === 'docs') pageContextTitle.textContent = 'Integration Guide';
  else if (targetTab === 'settings') pageContextTitle.textContent = 'Settings';

  if (targetTab === 'outbox') {
    fetchOutboxLogs();
  } else if (targetTab === 'queue') {
    fetchQueue();
  } else if (targetTab === 'devices') {
    fetchDevicesPage();
  } else if (targetTab === 'settings') {
    fetchConfig();
  }
}

tabHomeBtn.addEventListener('click', () => switchTab('home'));
tabOutboxBtn.addEventListener('click', () => switchTab('outbox'));
tabQueueBtn.addEventListener('click', () => switchTab('queue'));
tabDevicesBtn.addEventListener('click', () => switchTab('devices'));
tabDocsBtn.addEventListener('click', () => switchTab('docs'));
tabSettingsBtn.addEventListener('click', () => switchTab('settings'));

// Add Device from the page-level button
addDevicePageBtn.addEventListener('click', () => {
  showAddDeviceModal();
});

function showAddDeviceModal() {
  // Build a lightweight inline prompt modal
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm';
  overlay.innerHTML = `
    <div class="glass-card rounded-2xl border border-slate-800 shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
      <h3 class="text-sm font-bold uppercase tracking-wider text-slate-300">Add New Device</h3>
      <div class="space-y-1.5">
        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Device Name</label>
        <input
          id="new-device-name-input"
          type="text"
          placeholder="e.g. Main Number, Backup, Clinic 2"
          class="w-full rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-teal-500/60"
          maxlength="48"
          autocomplete="off"
        >
        <p class="text-[10px] text-slate-600">Optional — helps you identify this device in the list.</p>
      </div>
      <div class="flex justify-end space-x-2 pt-1">
        <button id="add-device-cancel" type="button"
          class="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 transition-all">
          Cancel
        </button>
        <button id="add-device-confirm" type="button"
          class="px-4 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all">
          Register Device
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const nameInput = overlay.querySelector('#new-device-name-input');
  const cancelBtn = overlay.querySelector('#add-device-cancel');
  const confirmBtn = overlay.querySelector('#add-device-confirm');

  // Focus the input
  setTimeout(() => nameInput.focus(), 50);

  const close = () => document.body.removeChild(overlay);

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmBtn.click(); });

  confirmBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    confirmBtn.textContent = 'Registering…';
    confirmBtn.disabled = true;

    try {
      const headers = { 'Content-Type': 'application/json' };
      const key = getApiKey();
      if (key) headers['x-api-key'] = key;

      const body = name ? JSON.stringify({ name }) : '{}';
      logEvent(`Registering new device${name ? ' "' + name + '"' : ''}...`, 'event');
      const res = await fetch(`${API_BASE}/api/devices`, { method: 'POST', headers, body });
      const data = await res.json();

      if (res.ok && data.success) {
        logEvent(`Device${name ? ' "' + name + '"' : ''} (${data.id}) initialized.`, 'success');
        close();
        fetchDevicesPage();
      } else {
        alert('Failed to register device: ' + (data.error || 'Unknown error'));
        confirmBtn.textContent = 'Register Device';
        confirmBtn.disabled = false;
      }
    } catch (err) {
      alert('Network error registering device.');
      confirmBtn.textContent = 'Register Device';
      confirmBtn.disabled = false;
    }
  });
}

// Sidebar status bar → go directly to Devices tab
connectionTrigger.addEventListener('click', () => {
  switchTab('devices');
});

function closeConnectionModal() {
  connectionModal.style.display = 'none';
}

connectionModalClose.addEventListener('click', closeConnectionModal);
connectionModalBackdrop.addEventListener('click', closeConnectionModal);

// Code snippets templates
function updateCodeSnippet() {
  const key = getApiKey() || 'YOUR_API_KEY';
  const host = API_BASE || `${window.location.protocol}//${window.location.host}`;
  
  const snippets = {
    curl: `curl -X POST ${host}/api/send \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${key}" \\
  -d '{
    "phone": "5511999999999",
    "message": "Hello from automated service!",
    "clinicId": "CLINIC_ALPHA"
  }'`,
    node: `const fetch = require('node-fetch');

async function sendWhatsApp() {
  const response = await fetch('${host}/api/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '${key}'
    },
    body: JSON.stringify({
      phone: '5511999999999',
      message: 'Hello from Node.js!',
      clinicId: 'CLINIC_ALPHA'
    })
  });
  
  const data = await response.json();
  console.log(data);
}

sendWhatsApp();`,
    python: `import requests

url = "${host}/api/send"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "${key}"
}
payload = {
    "phone": "5511999999999",
    "message": "Hello from Python script!",
    "clinicId": "CLINIC_ALPHA"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`
  };

  codeSnippetBox.textContent = snippets[docLanguage];
}

function switchDocLanguage(lang) {
  docLanguage = lang;
  
  // Update UI active buttons
  docBtnCurl.className = `px-2.5 py-1 text-[10px] font-bold uppercase rounded transition-all ${lang === 'curl' ? 'text-teal-400 bg-slate-900' : 'text-slate-400 hover:text-slate-200'}`;
  docBtnNode.className = `px-2.5 py-1 text-[10px] font-bold uppercase rounded transition-all ${lang === 'node' ? 'text-teal-400 bg-slate-900' : 'text-slate-400 hover:text-slate-200'}`;
  docBtnPython.className = `px-2.5 py-1 text-[10px] font-bold uppercase rounded transition-all ${lang === 'python' ? 'text-teal-400 bg-slate-900' : 'text-slate-400 hover:text-slate-200'}`;

  updateCodeSnippet();
}

docBtnCurl.addEventListener('click', () => switchDocLanguage('curl'));
docBtnNode.addEventListener('click', () => switchDocLanguage('node'));
docBtnPython.addEventListener('click', () => switchDocLanguage('python'));

copyCodeBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(codeSnippetBox.textContent);
  const originalText = copyCodeBtn.textContent;
  copyCodeBtn.textContent = 'Copied!';
  copyCodeBtn.className = 'absolute top-3 right-3 text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900/30 px-2 py-1 rounded transition-colors font-bold uppercase tracking-wider';
  
  setTimeout(() => {
    copyCodeBtn.textContent = originalText;
    copyCodeBtn.className = 'absolute top-3 right-3 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-1 rounded transition-colors font-bold uppercase tracking-wider';
  }, 2000);
});

// Clear logs console
document.getElementById('clear-logs-btn').addEventListener('click', () => {
  consoleLogs.innerHTML = '';
  logEvent('Console logs buffer cleared.', 'info');
});

// Initialize application
logEvent('Gateway dashboard boot sequence started...', 'info');
fetchOutboxLogs();
switchDocLanguage('curl');
checkAuthStatus();
fetchConfig();
initFlatpickr();

// Restore saved tab on load
switchTab(activeTab);
