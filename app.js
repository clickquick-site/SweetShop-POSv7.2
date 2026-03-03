// ============================================================
//  POS DZ - app.js  |  قاعدة البيانات والمنطق المشترك
// ============================================================

// ── IndexedDB Setup ──────────────────────────────────────────
const DB_NAME = 'POSDZ_DB';
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Users
      if (!db.objectStoreNames.contains('users')) {
        const us = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        us.createIndex('username', 'username', { unique: true });
      }
      // Products
      if (!db.objectStoreNames.contains('products')) {
        const ps = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        ps.createIndex('name', 'name', { unique: true });
        ps.createIndex('barcode', 'barcode', { unique: false });
      }
      // Families
      if (!db.objectStoreNames.contains('families')) {
        const fs = db.createObjectStore('families', { keyPath: 'id', autoIncrement: true });
        fs.createIndex('name', 'name', { unique: true });
      }
      // Customers
      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
      }
      // Suppliers
      if (!db.objectStoreNames.contains('suppliers')) {
        db.createObjectStore('suppliers', { keyPath: 'id', autoIncrement: true });
      }
      // Sales
      if (!db.objectStoreNames.contains('sales')) {
        const ss = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
        ss.createIndex('date', 'date', { unique: false });
        ss.createIndex('customerId', 'customerId', { unique: false });
      }
      // Sale Items
      if (!db.objectStoreNames.contains('saleItems')) {
        const si = db.createObjectStore('saleItems', { keyPath: 'id', autoIncrement: true });
        si.createIndex('saleId', 'saleId', { unique: false });
      }
      // Debts
      if (!db.objectStoreNames.contains('debts')) {
        const di = db.createObjectStore('debts', { keyPath: 'id', autoIncrement: true });
        di.createIndex('customerId', 'customerId', { unique: false });
      }
      // Settings
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      // Operations Log
      if (!db.objectStoreNames.contains('logs')) {
        db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
      }
      // Daily Counter
      if (!db.objectStoreNames.contains('counter')) {
        db.createObjectStore('counter', { keyPath: 'id' });
      }
    };

    req.onsuccess = async (e) => {
      db = e.target.result;
      await seedDefaults();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Generic DB Helpers ───────────────────────────────────────
function dbGet(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function dbGetAll(store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function dbPut(store, data) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function dbAdd(store, data) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(data);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
function dbDelete(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}
function dbGetByIndex(store, indexName, value) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).index(indexName).getAll(value);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

// ── Settings ─────────────────────────────────────────────────
async function getSetting(key) {
  const rec = await dbGet('settings', key);
  return rec ? rec.value : null;
}
async function setSetting(key, value) {
  await dbPut('settings', { key, value });
}

// ── Default Seed Data ─────────────────────────────────────────
async function seedDefaults() {
  // Default admin user
  try {
    await dbAdd('users', {
      username: 'ADMIN',
      password: hashPassword('1234'),
      role: 'admin',
      createdAt: new Date().toISOString()
    });
  } catch(e) {}

  // Default settings
  const defaults = {
    storeName: 'اسم المتجر', storePhone: '', storeAddress: '',
    storeWelcome: 'شكراً لزيارتكم', storeLogo: '',
    currency: 'DA', language: 'ar', dateFormat: 'DD/MM/YYYY',
    themeColor: 'blue_purple', fontSize: '15',
    soundAdd: '1', soundSell: '1', soundButtons: '1',
    barcodeReader: '1', barcodeAuto: '1',
    touchKeyboard: '0',
    paperSize: '80mm',
    printLogo: '1', printName: '1', printPhone: '1',
    printWelcome: '1', printAddress: '1', printBarcode: '1',
    autoBackup: '1',
    invoiceNumber: '1',
    lowStockAlert: '5', expiryAlertDays: '30',
    lastResetDate: '', dailyCounter: '1',
  };
  for (const [key, value] of Object.entries(defaults)) {
    const existing = await dbGet('settings', key);
    if (!existing) await dbPut('settings', { key, value });
  }

  // Daily counter
  const counter = await dbGet('counter', 1);
  if (!counter) await dbPut('counter', { id: 1, number: 1, lastReset: todayStr() });
}

// ── Password ─────────────────────────────────────────────────
function hashPassword(str) {
  // Simple hash for browser (use SHA-256 via SubtleCrypto in production)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + str.length;
}

// ── Session ───────────────────────────────────────────────────
function saveSession(user) {
  sessionStorage.setItem('posdz_user', JSON.stringify(user));
}
function getSession() {
  const u = sessionStorage.getItem('posdz_user');
  return u ? JSON.parse(u) : null;
}
function clearSession() {
  sessionStorage.removeItem('posdz_user');
}
function requireAuth(redirectTo = 'index.html') {
  const user = getSession();
  if (!user) { window.location.href = redirectTo; return null; }
  return user;
}
function requireRole(roles, redirectTo = 'sale.html') {
  const user = requireAuth();
  if (!user) return null;
  if (!roles.includes(user.role)) { window.location.href = redirectTo; return null; }
  return user;
}

// ── Invoice Number ────────────────────────────────────────────
async function getNextInvoiceNumber() {
  const today = todayStr();
  let counter = await dbGet('counter', 1);
  if (!counter) counter = { id: 1, number: 1, lastReset: today };
  if (counter.lastReset !== today) {
    counter.number = 1;
    counter.lastReset = today;
  }
  const num = counter.number;
  counter.number++;
  await dbPut('counter', counter);
  return '#' + String(num).padStart(3, '0');
}

async function resetDailyCounter() {
  await dbPut('counter', { id: 1, number: 1, lastReset: todayStr() });
}

// ── Date Helpers ──────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function formatDate(iso, fmt) {
  if (!iso) return '';
  const d = new Date(iso);
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  if (!fmt || fmt === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
  if (fmt === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
  if (fmt === 'YYYY/MM/DD') return `${year}/${month}/${day}`;
  return `${day}/${month}/${year}`;
}
function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-DZ') + ' ' + d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
}
function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0,0,0,0);
  return d.toISOString();
}
function startOfMonth() {
  const d = new Date();
  d.setDate(1); d.setHours(0,0,0,0);
  return d.toISOString();
}
function startOfYear() {
  const d = new Date();
  d.setMonth(0,1); d.setHours(0,0,0,0);
  return d.toISOString();
}

// ── Currency ─────────────────────────────────────────────────
let _currency = 'DA';
async function loadCurrency() {
  _currency = await getSetting('currency') || 'DA';
}
function formatMoney(amount) {
  return parseFloat(amount || 0).toFixed(2) + ' ' + _currency;
}

// ── Toast Notifications ───────────────────────────────────────
function toast(message, type = 'success', duration = 2800) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, duration);
}

// ── Modal Helpers ─────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); }
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
}

// ── Sidebar ───────────────────────────────────────────────────
function initSidebar() {
  const overlay = document.getElementById('sidebarOverlay');
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menuBtn');

  if (menuBtn) menuBtn.addEventListener('click', () => {
    overlay.classList.add('open');
    sidebar.classList.add('open');
  });
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Mark active nav
  const current = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('href') === current) item.classList.add('active');
  });

  // Load user info
  const user = getSession();
  if (user) {
    const userEl = document.getElementById('sidebarUser');
    if (userEl) userEl.textContent = '👤 ' + user.username;

    // Hide restricted items
    if (user.role === 'seller') {
      document.querySelectorAll('[data-role]').forEach(el => {
        const roles = el.dataset.role.split(',');
        if (!roles.includes('seller')) el.style.display = 'none';
      });
    }
  }
}
function closeSidebar() {
  document.getElementById('sidebarOverlay')?.classList.remove('open');
  document.getElementById('sidebar')?.classList.remove('open');
}

// ── Clock ─────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('clockDisplay');
  if (!el) return;
  function tick() {
    const now = new Date();
    const date = now.toLocaleDateString('ar-DZ', { day:'2-digit', month:'2-digit', year:'numeric' });
    const time = now.toLocaleTimeString('ar-DZ', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false });
    el.textContent = `${date}  ${time}`;
  }
  tick();
  setInterval(tick, 1000);
}

// ── Store Name in Header ──────────────────────────────────────
async function loadHeaderStoreName() {
  const el = document.getElementById('headerStoreName');
  if (!el) return;
  const name = await getSetting('storeName');
  if (name) el.textContent = name;
}

// applyTheme defined in Sound/Theme block below

// ── Barcode Scanner Support ───────────────────────────────────
let barcodeBuffer = '';
let barcodeTimer = null;
function initBarcodeScanner(onScan) {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Enter') {
      if (barcodeBuffer.length > 2) onScan(barcodeBuffer);
      barcodeBuffer = '';
      clearTimeout(barcodeTimer);
    } else if (e.key.length === 1) {
      barcodeBuffer += e.key;
      clearTimeout(barcodeTimer);
      barcodeTimer = setTimeout(() => { barcodeBuffer = ''; }, 100);
    }
  });
}

// ── Virtual Keyboard ──────────────────────────────────────────
let vkbTarget = null;
function initVirtualKeyboard() {
  const overlay = document.getElementById('vkbOverlay');
  if (!overlay) return;

  // تحديث الـ target عند التركيز — بدون إغلاق الخلفية
  document.addEventListener('focusin', async (e) => {
    const touchKb = await getSetting('touchKeyboard');
    if (touchKb !== '1') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.target.type === 'date' || e.target.type === 'file') return;
      // تحديث الهدف فقط — الكيبورد يبقى مفتوحاً إذا كان مفتوحاً
      vkbTarget = e.target;
    }
  });

  // الضغط على أي خانة خارج الكيبورد يُغيّر الهدف مباشرة
  document.addEventListener('mousedown', (e) => {
    if (overlay.classList.contains('open')) {
      if (!overlay.contains(e.target) && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        // لا نغلق الكيبورد — فقط نتيح التفاعل مع الخلفية
      }
    }
  }, true); // capture phase — يعمل قبل أي شيء آخر
}

function vkbPress(key) {
  if (!vkbTarget) return;
  if (key === '⌫') {
    const val = vkbTarget.value;
    vkbTarget.value = val.slice(0, -1);
  } else if (key === ' ') {
    vkbTarget.value += ' ';
  } else {
    vkbTarget.value += key;
  }
  vkbTarget.dispatchEvent(new Event('input', { bubbles: true }));
}

function vkbClose() {
  document.getElementById('vkbOverlay')?.classList.remove('open');
  vkbTarget = null;
}

// ── CSV Export ────────────────────────────────────────────────
function exportCSV(data, filename) {
  if (!data.length) return toast('لا توجد بيانات للتصدير', 'warning');
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

// ── CSV Import ────────────────────────────────────────────────
function importCSV(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split('\n').filter(l => l.trim());
    if (lines.length < 2) return toast('الملف فارغ أو غير صالح', 'error');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const data = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.replace(/"/g, '').trim());
      const obj = {};
      headers.forEach((h, i) => obj[h] = vals[i] || '');
      return obj;
    });
    callback(data);
  };
  reader.readAsText(file, 'UTF-8');
}

// ── CSV Template Download ─────────────────────────────────────
function downloadCSVTemplate() {
  const template = 'name,barcode,family,size,unit,buy_price,sell_price,quantity,expiry_date\n' +
    'مثال منتج,1234567890,عائلة,500ml,قطعة,100,150,50,2026-12-31\n';
  const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'products_template.csv';
  a.click(); URL.revokeObjectURL(url);
}

// ── Backup ────────────────────────────────────────────────────
async function createBackup() {
  const stores = ['users','products','families','customers','suppliers','sales','saleItems','debts','settings'];
  const backup = {};
  for (const store of stores) {
    backup[store] = await dbGetAll(store);
  }
  backup.timestamp = new Date().toISOString();
  backup.version = '6.0.0';
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `POSDZ_backup_${todayStr()}.json`;
  a.click(); URL.revokeObjectURL(url);
  toast('تم إنشاء النسخة الاحتياطية بنجاح ✅', 'success');
}

// ── Thermal Print ────────────────────────────────────────────
async function printInvoice(sale, items) {
  const storeName    = await getSetting('storeName') || '';
  const storePhone   = await getSetting('storePhone') || '';
  const storeAddress = await getSetting('storeAddress') || '';
  const welcome      = await getSetting('storeWelcome') || '';
  const currency     = await getSetting('currency') || 'DA';
  const storeLogo    = await getSetting('storeLogo') || '';
  const paperSize    = await getSetting('paperSize') || '80mm';
  const printLogo    = await getSetting('printLogo') === '1';
  const printName    = await getSetting('printName') === '1';
  const printPhone   = await getSetting('printPhone') === '1';
  const printAddress = await getSetting('printAddress') === '1';
  const printWelcome = await getSetting('printWelcome') === '1';
  const printBarcode = await getSetting('printBarcode') === '1';

  // Paper width mapping
  const widthMap = { '58mm': '54mm', '80mm': '76mm', 'A5': '148mm', 'A4': '210mm' };
  const pageW = widthMap[paperSize] || '76mm';

  const now = new Date(sale.date || new Date());
  const dateStr = now.toLocaleDateString('ar-DZ');
  const timeStr = now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

  let html = `<!DOCTYPE html><html dir="rtl"><head>
    <meta charset="UTF-8">
    <style>
      @page { margin: 4mm; size: ${pageW} auto; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body {
        font-family: 'Courier New', 'Arial', monospace;
        font-size: 12px; color: #000 !important;
        background: #fff;
        width: ${pageW};
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .center { text-align: center; }
      .bold { font-weight: 900 !important; }
      .big { font-size: 15px; font-weight: 900; }
      .xl { font-size: 18px; font-weight: 900; }
      .dline { border-top: 2px solid #000; margin: 5px 0; }
      .sline { border-top: 1px dashed #000; margin: 5px 0; }
      .row { display: flex; justify-content: space-between; padding: 1px 0; }
      .logo img { max-width: 70px; max-height: 70px; display: block; margin: 0 auto 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { font-weight: 900; border-bottom: 1px solid #000; padding: 3px 2px; text-align: right; font-size: 11px; }
      td { padding: 3px 2px; font-weight: 700; }
      .total-row td { font-weight: 900; font-size: 13px; border-top: 2px solid #000; }
      @media print {
        body { width: 100%; }
        * { color: #000 !important; -webkit-print-color-adjust: exact; }
      }
    </style>
  </head><body>`;

  // Invoice label — clear naming for each type
  let invoiceLabel;
  if (sale.debtSettlement && sale.partialSettlement) {
    invoiceLabel = `فاتورة تسديد جزئي #${sale.invoiceNumber}`;
  } else if (sale.debtSettlement) {
    invoiceLabel = `فاتورة تسديد #${sale.invoiceNumber}`;
  } else if (sale.isDebt) {
    invoiceLabel = `فاتورة دين #${sale.invoiceNumber}`;
  } else {
    invoiceLabel = `فاتورة: #${sale.invoiceNumber}`;
  }
  html += `<div class="row bold"><span>${invoiceLabel}</span><span>${dateStr} ${timeStr}</span></div>`;
  html += `<div class="dline"></div>`;

  // Store info centered
  if (printLogo && storeLogo) html += `<div class="logo center"><img src="${storeLogo}"/></div>`;
  if (printName && storeName) html += `<div class="center xl bold">${storeName}</div>`;
  if (printPhone && storePhone) html += `<div class="center bold">📞 ${storePhone}</div>`;
  if (printAddress && storeAddress) html += `<div class="center bold">${storeAddress}</div>`;

  if (sale.customerName) {
    html += `<div class="sline"></div>`;
    html += `<div class="row"><span class="bold">الزبون:</span><span class="bold">${sale.customerName}</span></div>`;
    if (sale.customerPhone) html += `<div class="row"><span class="bold">الهاتف:</span><span class="bold">${sale.customerPhone}</span></div>`;
  }
  html += `<div class="dline"></div>`;

  // Products table
  html += `<table>
    <thead><tr><th>المنتج</th><th style="text-align:center">ك</th><th style="text-align:center">السعر</th><th style="text-align:left">المجموع</th></tr></thead>
    <tbody>`;
  items.forEach(item => {
    html += `<tr>
      <td class="bold">${item.productName}</td>
      <td style="text-align:center" class="bold">${item.quantity}</td>
      <td style="text-align:center" class="bold">${parseFloat(item.unitPrice).toFixed(2)}</td>
      <td style="text-align:left" class="bold">${parseFloat(item.total).toFixed(2)}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  html += `<div class="dline"></div>`;

  if (sale.discount > 0) {
    html += `<div class="row bold"><span>خصم:</span><span>- ${parseFloat(sale.discount).toFixed(2)} ${currency}</span></div>`;
  }
  html += `<div class="row xl bold"><span>الإجمالي:</span><span>${parseFloat(sale.total).toFixed(2)} ${currency}</span></div>`;
  if (sale.paid && sale.paid > 0) {
    html += `<div class="row bold"><span>المدفوع:</span><span>${parseFloat(sale.paid).toFixed(2)} ${currency}</span></div>`;
    if (sale.isDebt) {
      const remaining = sale.total - sale.paid;
      html += `<div class="row bold"><span>المتبقي (دين):</span><span>${remaining.toFixed(2)} ${currency}</span></div>`;
    }
  }
  // Show updated remaining debt after partial settlement
  if (sale.remainingDebt !== undefined) {
    html += `<div class="row bold"><span>المتبقي بعد التسديد:</span><span style="color:#dc2626;">${parseFloat(sale.remainingDebt).toFixed(2)} ${currency}</span></div>`;
  } else if (sale.remainingAfterPay !== undefined) {
    html += `<div class="row bold"><span>الدين المتبقي:</span><span style="color:#dc2626;">${parseFloat(sale.remainingAfterPay).toFixed(2)} ${currency}</span></div>`;
  }

  html += `<div class="dline"></div>`;
  if (printWelcome && welcome) html += `<div class="center bold" style="font-size:13px;margin:6px 0;">${welcome}</div>`;

  // Barcode placeholder (text-based)
  if (printBarcode && sale.invoiceNumber) {
    html += `<div class="center sline" style="font-family:monospace;font-size:10px;margin-top:4px;">||||| ${sale.invoiceNumber} |||||</div>`;
  }

  html += `</body></html>`;

  // ── طباعة مباشرة بدون نافذة — iframe مخفي ──────────────────
  _silentPrint(html);
}

// ── دالة الطباعة الصامتة المشتركة لكل أنواع الطباعة ──────────
function _silentPrint(html) {
  // إزالة أي iframe سابق
  const old = document.getElementById('_posdzPrintFrame');
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '_posdzPrintFrame';
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // انتظار تحميل الصور والمحتوى ثم طباعة فورية
  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch(e) {
      // fallback: window.print مباشرة إذا فشل الـ iframe
      const win = window.open('', '_blank', 'width=1,height=1');
      if (win) { win.document.write(html); win.document.close(); win.onload = () => { win.print(); win.onafterprint = () => win.close(); }; }
    }
    // تنظيف بعد الطباعة
    setTimeout(() => { if (iframe.parentNode) iframe.remove(); }, 3000);
  };
}

// ── Barcode Label Print ───────────────────────────────────────
// Matches the preview in settings exactly — compact, clear, consistent
async function printBarcodeLabel(product) {
  const barcodeVal  = product.barcode || String(product.id);
  const storeName   = await getSetting('storeName')        || '';
  const currency    = await getSetting('currency')         || 'دج';
  const barcodeFont = await getSetting('barcodeFont')      || 'Cairo';
  const barcodeType = await getSetting('barcodeType')      || 'CODE128';
  const showStore   = await getSetting('barcodeShowStore') === '1';
  const showName    = (await getSetting('barcodeShowName'))  !== '0';
  const showPrice   = (await getSetting('barcodeShowPrice')) !== '0';

  // Build barcode bars — deterministic, uniform height for clean look
  function buildBars(code) {
    const str = String(code);
    // Use a fixed pattern based on character values for visual consistency
    const NARROW = 2, WIDE = 4, BAR_H = 36;
    let bars = '';
    // Start guard
    bars += `<div style="width:2px;height:${BAR_H}px;background:#000;"></div>`;
    bars += `<div style="width:2px;height:${BAR_H}px;background:#fff;"></div>`;
    bars += `<div style="width:2px;height:${BAR_H}px;background:#000;"></div>`;
    bars += `<div style="width:2px;height:${BAR_H}px;background:#fff;"></div>`;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      // 5 bars per character: alternating black/white based on bit pattern
      for (let b = 0; b < 5; b++) {
        const isBlack = (b % 2 === 0);
        const bit     = (c >> (4 - b)) & 1;
        const w       = bit ? WIDE : NARROW;
        bars += `<div style="width:${w}px;height:${BAR_H}px;background:${isBlack?'#000':'#fff'};"></div>`;
      }
      bars += `<div style="width:2px;height:${BAR_H}px;background:#fff;"></div>`;
    }
    // Stop guard
    bars += `<div style="width:2px;height:${BAR_H}px;background:#000;"></div>`;
    bars += `<div style="width:2px;height:${BAR_H}px;background:#fff;"></div>`;
    bars += `<div style="width:3px;height:${BAR_H}px;background:#000;"></div>`;
    return `<div style="display:flex;align-items:flex-end;justify-content:center;gap:0;overflow:hidden;max-width:54mm;">${bars}</div>`;
  }

  // QR fallback (text-based simplified)
  function buildQR(code) {
    return `<div style="font-size:9px;font-family:monospace;color:#000;word-break:break-all;max-width:54mm;border:2px solid #000;padding:3px;">[QR: ${code}]</div>`;
  }

  const barsHtml = barcodeType === 'QR' ? buildQR(barcodeVal) : buildBars(barcodeVal);

  // ── طباعة الباركود مباشرة — iframe مخفي ──────────────────
  const bcHtml = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
  @page { margin:1mm; size:58mm 38mm; }
  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: '${barcodeFont}', 'Cairo', Arial, sans-serif;
    background:#fff; color:#000;
    width:56mm; text-align:center; padding:2px 1px;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .s  { font-size:8px;  font-weight:800; letter-spacing:0.5px; margin-bottom:1px; }
  .n  { font-size:10px; font-weight:900; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:54mm; }
  .bc { font-family:'Courier New',monospace; font-size:7px; margin:1px 0; letter-spacing:2px; color:#000; }
  .pr { font-size:12px; font-weight:900; margin-top:2px; }
  @media print { * { color:#000!important; } }
</style>
</head><body>
  ${showStore && storeName ? `<div class="s">${storeName}</div>` : ''}
  ${showName ? `<div class="n">${product.name}</div>` : ''}
  ${barsHtml}
  <div class="bc">${barcodeVal}</div>
  ${showPrice ? `<div class="pr">${parseFloat(product.sellPrice||0).toFixed(2)} ${currency}</div>` : ''}
</body></html>`;
  _silentPrint(bcHtml);
}


// ── Sound System ─────────────────────────────────────────────
// AudioContext created lazily on first user gesture (browser requirement)
let _AC = null;
function _getAC() {
  if (_AC && _AC.state !== 'closed') {
    if (_AC.state === 'suspended') _AC.resume().catch(()=>{});
    return _AC;
  }
  try {
    _AC = new (window.AudioContext || window.webkitAudioContext)();
    return _AC;
  } catch(e) { return null; }
}

function _beep(freq=880, dur=0.12, type='sine', vol=0.4) {
  const ac = _getAC();
  if (!ac) return;
  try {
    const g = ac.createGain();
    const o = ac.createOscillator();
    const now = ac.currentTime;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    o.connect(g); g.connect(ac.destination);
    o.start(now); o.stop(now + dur);
  } catch(e) {}
}

// Ensure context is resumed on any user interaction
document.addEventListener('click',      () => _getAC(), { passive: true });
document.addEventListener('touchstart', () => _getAC(), { passive: true });
document.addEventListener('keydown',    () => _getAC(), { passive: true });

async function playSound(type) {
  // type: 'add' | 'sell' | 'btn'
  const settingMap = { add:'soundAdd', sell:'soundSell', btn:'soundButtons' };
  try {
    const enabled = await getSetting(settingMap[type] || 'soundButtons');
    if (enabled !== '1') return;
  } catch(e) { return; }

  _getAC(); // ensure context alive
  if (type === 'add') {
    _beep(880, 0.09, 'sine', 0.4);
  } else if (type === 'sell') {
    _beep(660, 0.10, 'triangle', 0.45);
    setTimeout(() => _beep(880,  0.15, 'triangle', 0.4),  110);
    setTimeout(() => _beep(1100, 0.22, 'triangle', 0.38), 240);
  } else if (type === 'btn') {
    _beep(600, 0.06, 'square', 0.22);
  }
}

// Attach button sounds to ALL buttons/nav across the app
function initButtonSounds() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button, .btn, .nav-item, .tab-btn, .disc-pill, .theme-dot, .printer-card');
    if (!btn) return;
    if (btn.dataset.soundSkip) return; // marked as skip
    // sell/add sounds handled by their own callers — skip generic btn for those
    if (btn.classList.contains('sound-sell') || btn.classList.contains('sound-add')) return;
    playSound('btn');
  }, { passive: true });
}

// ── Global Page Translation System ─────────────────────────────
// Translates all fixed UI text across all pages when language changes.
// Excludes: product names, family names, customer names, supplier names, store name.
const APP_I18N = {
  ar: {
    // Sidebar nav
    navSale:'واجهة البيع', navInventory:'إدارة المخزون',
    navCustomers:'إدارة الزبائن', navReports:'إدارة الأعمال',
    navUsers:'إدارة المستخدمين', navSuppliers:'إدارة الموزعين',
    navSettings:'الإعدادات العامة', navLogout:'إغلاق',
    // Page titles
    titleSale:'واجهة البيع', titleInventory:'📦 إدارة المخزون',
    titleCustomers:'👥 إدارة الزبائن', titleReports:'إدارة الأعمال',
    titleUsers:'👤 إدارة المستخدمين', titleSuppliers:'🚚 إدارة الموزعين',
    titleSettings:'⚙️ الإعدادات العامة',
    // Common buttons
    btnSave:'💾 حفظ', btnCancel:'إلغاء', btnClose:'إغلاق', btnAdd:'➕ إضافة',
    btnEdit:'✏️ تعديل', btnDelete:'🗑️ حذف', btnPrint:'🖨️ طباعة', btnSearch:'🔍 بحث',
    btnBack:'← رجوع', btnConfirm:'✅ تأكيد', btnAll:'الكل',
    // Sale page
    saleSearchPlaceholder:'ابحث عن منتج أو امسح الباركود...',
    saleProduct:'المنتج', saleQty:'الكمية', salePrice:'السعر', saleTotal:'المجموع',
    saleDiscount:'خصم:', saleCustomer:'الزبون:', salePaid:'المبلغ المدفوع:',
    saleBtnCheckout:'تسديد', saleBtnPartial:'جزئي + دين', saleBtnDebt:'دين كامل',
    saleEmpty:'السلة فارغة', saleItems:' صنف',
    saleModalTitle:'تأكيد البيع', saleBtnPrint:'طباعة الفاتورة', saleBtnNoprint:'إغلاق',
    saleTotalLabel:'الإجمالي', saleNoProducts:'لا توجد منتجات',
    saleSelectCustomer:'— اختر الزبون —', saleItemsUnit:'صنف',
    // Customers
    custAdd:'➕ إضافة زبون', custSearch:'ابحث بالاسم أو الهاتف...',
    custFilterAll:'الكل', custFilterDebt:'💳 مديونون', custFilterClear:'✅ مسددون',
    custName:'👤 الاسم *', custPhone:'📞 الهاتف *',
    custBtnDebts:'📋 الديون', custBtnPartial:'💰 جزئي', custBtnPayAll:'✅ تسديد الكل',
    custBtnDebtInv:'🖨️ فاتورة دين', custBtnEdit:'✏️', custBtnDelete:'🗑️',
    custTotalCustomers:'إجمالي الزبائن', custTotalDebt:'إجمالي الديون',
    custNone:'لا يوجد زبائن', custNoDebt:'✅ لا ديون', custDebtLeft:'دين متبقي',
    // Inventory
    invAddProduct:'➕ إضافة منتج', invAddFamily:'➕ إضافة عائلة',
    invSearch:'ابحث عن منتج...', invFilterAll:'الكل',
    invColProduct:'المنتج', invColFamily:'العائلة', invColPrice:'السعر',
    invColQty:'المخزون', invColBarcode:'الباركود', invColActions:'إجراءات',
    invLowStock:'⚠️ مخزون منخفض', invOutStock:'🚫 نفذت الكمية',
    // Reports
    repDashboard:'📊 لوحة التحكم', repDaily:'💰 المداخيل اليومية',
    repDebts:'💳 الديون اليومية', repFamilies:'🏪 مداخيل العائلات',
    repProducts:'📦 مداخيل السلع', repScale:'⚖️ مداخيل الميزان',
    repBackToSale:'رجوع للبيع', repPeriodWeek:'📅 أسبوعي',
    repPeriodMonth:'🗓️ شهري', repPeriodYear:'📆 سنوي',
    repToday:'اليوم', repPrintAll:'🖨️ طباعة الكل',
    repCloseDay:'🔒 إقفال اليوم', repManageCustomers:'👥 إدارة الزبائن',
    // Users
    usersAdd:'➕ إضافة مستخدم',
    usersColName:'الاسم', usersColUser:'اسم المستخدم', usersColRole:'الصلاحية', usersColActions:'إجراءات',
    // Suppliers
    suppAdd:'➕ إضافة مورد',
    suppName:'اسم المورد', suppPhone:'الهاتف', suppEmail:'البريد الإلكتروني',
  },
  fr: {
    navSale:'Interface vente', navInventory:'Gestion stock',
    navCustomers:'Clients', navReports:'Activité commerciale',
    navUsers:'Utilisateurs', navSuppliers:'Fournisseurs',
    navSettings:'Paramètres', navLogout:'Déconnexion',
    titleSale:'Interface Vente', titleInventory:'📦 Gestion du stock',
    titleCustomers:'👥 Gestion clients', titleReports:'Activité commerciale',
    titleUsers:'👤 Gestion utilisateurs', titleSuppliers:'🚚 Fournisseurs',
    titleSettings:'⚙️ Paramètres généraux',
    btnSave:'💾 Enregistrer', btnCancel:'Annuler', btnClose:'Fermer', btnAdd:'➕ Ajouter',
    btnEdit:'✏️ Modifier', btnDelete:'🗑️ Supprimer', btnPrint:'🖨️ Imprimer', btnSearch:'🔍 Rechercher',
    btnBack:'← Retour', btnConfirm:'✅ Confirmer', btnAll:'Tout',
    saleSearchPlaceholder:'Rechercher un produit ou scanner...',
    saleProduct:'Produit', saleQty:'Quantité', salePrice:'Prix', saleTotal:'Total',
    saleDiscount:'Remise:', saleCustomer:'Client:', salePaid:'Montant payé:',
    saleBtnCheckout:'Payer', saleBtnPartial:'Partiel + Dette', saleBtnDebt:'Crédit total',
    saleEmpty:'Panier vide', saleItems:' article(s)',
    saleModalTitle:'Confirmer la vente', saleBtnPrint:'Imprimer la facture', saleBtnNoprint:'Fermer',
    saleTotalLabel:'Total', saleNoProducts:'Aucun produit', saleSelectCustomer:'— Choisir client —', saleItemsUnit:'art.',
    custAdd:'➕ Ajouter client', custSearch:'Rechercher par nom ou téléphone...',
    custFilterAll:'Tout', custFilterDebt:'💳 Débiteurs', custFilterClear:'✅ Sans dette',
    custName:'👤 Nom *', custPhone:'📞 Téléphone *',
    custBtnDebts:'📋 Dettes', custBtnPartial:'💰 Partiel', custBtnPayAll:'✅ Tout payer',
    custBtnDebtInv:'🖨️ Facture dette', custBtnEdit:'✏️', custBtnDelete:'🗑️',
    custTotalCustomers:'Total clients', custTotalDebt:'Total dettes',
    custNone:'Aucun client', custNoDebt:'✅ Aucune dette', custDebtLeft:'Dette restante',
    invAddProduct:'➕ Ajouter produit', invAddFamily:'➕ Ajouter famille',
    invSearch:'Rechercher un produit...', invFilterAll:'Tout',
    invColProduct:'Produit', invColFamily:'Famille', invColPrice:'Prix',
    invColQty:'Stock', invColBarcode:'Code-barres', invColActions:'Actions',
    invLowStock:'⚠️ Stock bas', invOutStock:'🚫 Rupture de stock',
    repDashboard:'📊 Tableau de bord', repDaily:'💰 Revenus journaliers',
    repDebts:'💳 Dettes journalières', repFamilies:'🏪 Revenus par famille',
    repProducts:'📦 Revenus produits', repScale:'⚖️ Revenus balance',
    repBackToSale:'Retour vente', repPeriodWeek:'📅 Semaine',
    repPeriodMonth:'🗓️ Mois', repPeriodYear:'📆 Année',
    repToday:"Aujourd'hui", repPrintAll:'🖨️ Tout imprimer',
    repCloseDay:'🔒 Clôture journée', repManageCustomers:'👥 Gestion clients',
    usersAdd:'➕ Ajouter utilisateur',
    usersColName:'Nom', usersColUser:'Identifiant', usersColRole:'Rôle', usersColActions:'Actions',
    suppAdd:'➕ Ajouter fournisseur',
    suppName:'Nom fournisseur', suppPhone:'Téléphone', suppEmail:'E-mail',
  },
  en: {
    navSale:'Sale', navInventory:'Inventory',
    navCustomers:'Customers', navReports:'Business',
    navUsers:'Users', navSuppliers:'Suppliers',
    navSettings:'Settings', navLogout:'Logout',
    titleSale:'Sale Interface', titleInventory:'📦 Inventory Management',
    titleCustomers:'👥 Customer Management', titleReports:'Business Analytics',
    titleUsers:'👤 User Management', titleSuppliers:'🚚 Suppliers',
    titleSettings:'⚙️ General Settings',
    btnSave:'💾 Save', btnCancel:'Cancel', btnClose:'Close', btnAdd:'➕ Add',
    btnEdit:'✏️ Edit', btnDelete:'🗑️ Delete', btnPrint:'🖨️ Print', btnSearch:'🔍 Search',
    btnBack:'← Back', btnConfirm:'✅ Confirm', btnAll:'All',
    saleSearchPlaceholder:'Search product or scan barcode...',
    saleProduct:'Product', saleQty:'Qty', salePrice:'Price', saleTotal:'Total',
    saleDiscount:'Discount:', saleCustomer:'Customer:', salePaid:'Paid:',
    saleBtnCheckout:'Pay', saleBtnPartial:'Partial + Debt', saleBtnDebt:'Full Credit',
    saleEmpty:'Cart is empty', saleItems:' item(s)',
    saleModalTitle:'Confirm Sale', saleBtnPrint:'Print Invoice', saleBtnNoprint:'Close',
    saleTotalLabel:'Total', saleNoProducts:'No products', saleSelectCustomer:'— Select customer —', saleItemsUnit:'item(s)',
    custAdd:'➕ Add Customer', custSearch:'Search by name or phone...',
    custFilterAll:'All', custFilterDebt:'💳 Debtors', custFilterClear:'✅ Cleared',
    custName:'👤 Name *', custPhone:'📞 Phone *',
    custBtnDebts:'📋 Debts', custBtnPartial:'💰 Partial', custBtnPayAll:'✅ Pay All',
    custBtnDebtInv:'🖨️ Debt Invoice', custBtnEdit:'✏️', custBtnDelete:'🗑️',
    custTotalCustomers:'Total Customers', custTotalDebt:'Total Debts',
    custNone:'No customers', custNoDebt:'✅ No debts', custDebtLeft:'Remaining debt',
    invAddProduct:'➕ Add Product', invAddFamily:'➕ Add Family',
    invSearch:'Search product...', invFilterAll:'All',
    invColProduct:'Product', invColFamily:'Family', invColPrice:'Price',
    invColQty:'Stock', invColBarcode:'Barcode', invColActions:'Actions',
    invLowStock:'⚠️ Low stock', invOutStock:'🚫 Out of stock',
    repDashboard:'📊 Dashboard', repDaily:'💰 Daily Revenue',
    repDebts:'💳 Daily Debts', repFamilies:'🏪 Family Revenue',
    repProducts:'📦 Product Revenue', repScale:'⚖️ Scale Revenue',
    repBackToSale:'Back to sale', repPeriodWeek:'📅 Weekly',
    repPeriodMonth:'🗓️ Monthly', repPeriodYear:'📆 Yearly',
    repToday:'Today', repPrintAll:'🖨️ Print All',
    repCloseDay:'🔒 Close Day', repManageCustomers:'👥 Manage Customers',
    usersAdd:'➕ Add User',
    usersColName:'Name', usersColUser:'Username', usersColRole:'Role', usersColActions:'Actions',
    suppAdd:'➕ Add Supplier',
    suppName:'Supplier name', suppPhone:'Phone', suppEmail:'E-mail',
  }
};

function applyPageTranslation(lang) {
  const t = APP_I18N[lang] || APP_I18N.ar;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;

  // Sidebar nav labels — use data-nav attribute
  document.querySelectorAll('[data-nav]').forEach(el => {
    const k = el.dataset.nav;
    if (t[k] !== undefined) el.textContent = t[k];
  });

  // General data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.dataset.i18n;
    if (t[k] !== undefined) {
      if (el.tagName === 'INPUT' && el.placeholder !== undefined) {
        el.placeholder = t[k];
      } else {
        el.textContent = t[k];
      }
    }
  });

  // Placeholders with data-i18n-ph
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const k = el.dataset.i18nPh;
    if (t[k] !== undefined) el.placeholder = t[k];
  });

  // ── Sale page — عناصر ديناميكية بـ ID مباشر ─────────────────
  // "الإجمالي" فوق السعر
  const lblTotal = document.getElementById('lblTotal');
  if (lblTotal && t.saleTotalLabel) lblTotal.textContent = t.saleTotalLabel;

  // "خصم:"
  const lblDiscount = document.getElementById('lblDiscount');
  if (lblDiscount && t.saleDiscount) lblDiscount.textContent = t.saleDiscount;

  // "المبلغ المدفوع:"
  const lblPaid = document.getElementById('lblPaid');
  if (lblPaid && t.salePaid) lblPaid.textContent = t.salePaid;

  // "الزبون:"
  const lblCustomer = document.getElementById('lblCustomer');
  if (lblCustomer && t.saleCustomer) lblCustomer.textContent = t.saleCustomer;

  // "لا توجد منتجات" — عند السلة الفارغة (يُحدَّث عند كل renderCart)
  window._saleI18n = t; // تخزين لاستخدامه في renderCart

  // "اختر الزبون" — الخيار الأول في قائمة الزبائن
  const optCust = document.getElementById('optSelectCustomer');
  if (optCust && t.saleSelectCustomer) optCust.textContent = t.saleSelectCustomer;
  // إعادة بناء select الزبائن عند تغيير اللغة
  if (typeof loadCustomerSelect === 'function') loadCustomerSelect().catch(() => {});

  // Search placeholder
  const searchInput = document.getElementById('searchInput');
  if (searchInput && t.saleSearchPlaceholder) searchInput.placeholder = t.saleSearchPlaceholder;
}

// ── Theme Apply (accent + bg — fully separated) ───────────────
async function applyTheme() {
  const accent = await getSetting('themeColor') || 'blue_purple';
  const bg     = await getSetting('bgMode')     || 'dark';

  const root = document.documentElement;
  root.setAttribute('data-accent', accent);
  root.setAttribute('data-bg',     bg);
  root.setAttribute('data-theme', accent === 'blue_purple' ? '' : accent);

  if (bg === 'light') {
    document.body.style.background = '#EAEAF2';
    document.body.style.color      = '#111122';
  } else {
    document.body.style.background = '';
    document.body.style.color      = '';
  }

  // Language + Font
  const lang = await getSetting('language') || localStorage.getItem('posdz_lang') || 'ar';
  root.lang = lang;
  root.dir  = lang === 'ar' ? 'rtl' : 'ltr';
  localStorage.setItem('posdz_lang', lang);

  // Apply translations to current page
  applyPageTranslation(lang);

  const font = await getSetting('appFont') || 'Cairo';
  document.body.style.fontFamily = `'${font}', 'Cairo', sans-serif`;

  const fontSize = parseInt(await getSetting('fontSize')) || 15;
  root.style.fontSize = fontSize + 'px';
}

// ── Custom Confirm Dialog (replaces native browser confirm) ───────
// Injects a styled modal — no browser URL shown in the dialog
function customConfirm(message, onOk, onCancel) {
  // Remove any existing custom confirm
  const existing = document.getElementById('_posdzConfirm');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '_posdzConfirm';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.65);
    display:flex;align-items:center;justify-content:center;
    animation:fadeIn 0.15s ease;
  `;
  overlay.innerHTML = `
    <div style="
      background:var(--bg-card,#241848);
      border:1px solid var(--primary,#7C3AED);
      border-radius:16px;padding:28px 24px;
      max-width:340px;width:90%;
      box-shadow:0 16px 48px rgba(0,0,0,0.6);
      text-align:center;
    ">
      <div style="font-size:1.3rem;margin-bottom:8px;">❓</div>
      <div style="color:var(--text-primary,#F8F8FF);font-size:0.97rem;font-weight:600;margin-bottom:22px;line-height:1.5;">${message}</div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="_posdzConfOk" style="
          flex:1;padding:11px 18px;border-radius:10px;border:none;cursor:pointer;
          background:var(--primary,#7C3AED);color:#fff;font-family:'Cairo',sans-serif;
          font-size:0.95rem;font-weight:700;transition:opacity 0.15s;
        ">✅ نعم</button>
        <button id="_posdzConfNo" style="
          flex:1;padding:11px 18px;border-radius:10px;cursor:pointer;
          background:transparent;color:var(--text-secondary,#A0A0C0);font-family:'Cairo',sans-serif;
          font-size:0.95rem;font-weight:700;border:1px solid var(--border,#3D2E6B);
        ">✖️ لا</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById('_posdzConfOk').onclick = () => { close(); if (onOk) onOk(); };
  document.getElementById('_posdzConfNo').onclick = () => { close(); if (onCancel) onCancel(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) { close(); if (onCancel) onCancel(); } });
}

// ── Custom Alert (replaces native alert) ──────────────────────────
function customAlert(message, icon = 'ℹ️') {
  const existing = document.getElementById('_posdzAlert');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = '_posdzAlert';
  overlay.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;`;
  overlay.innerHTML = `
    <div style="background:var(--bg-card,#241848);border:1px solid var(--border,#3D2E6B);border-radius:16px;padding:28px 24px;max-width:320px;width:90%;box-shadow:0 16px 48px rgba(0,0,0,0.6);text-align:center;">
      <div style="font-size:1.6rem;margin-bottom:10px;">${icon}</div>
      <div style="color:var(--text-primary,#F8F8FF);font-size:0.95rem;margin-bottom:20px;line-height:1.5;">${message}</div>
      <button onclick="document.getElementById('_posdzAlert').remove()" style="padding:10px 28px;border-radius:10px;border:none;background:var(--primary,#7C3AED);color:#fff;font-family:'Cairo',sans-serif;font-size:0.9rem;font-weight:700;cursor:pointer;">حسناً</button>
    </div>`;
  document.body.appendChild(overlay);
}

// ── Async confirm wrapper (for use with await) ───────────────────
function customConfirmAsync(message) {
  return new Promise(resolve => {
    customConfirm(message, () => resolve(true), () => resolve(false));
  });
}

// ── Input Dialog (replaces native prompt) ────────────────────────
function _inputDialog(label, defaultVal = '') {
  return new Promise(resolve => {
    const existing = document.getElementById('_posdzInput');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = '_posdzInput';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:var(--bg-card,#241848);border:1px solid var(--primary,#7C3AED);border-radius:16px;padding:24px 22px;max-width:320px;width:90%;box-shadow:0 16px 48px rgba(0,0,0,0.6);">
        <div style="color:var(--text-primary,#F8F8FF);font-size:0.95rem;font-weight:600;margin-bottom:14px;">${label}</div>
        <input id="_posdzInputField" type="text" value="${defaultVal}" style="width:100%;background:var(--bg-input,#1E1540);border:1px solid var(--primary,#7C3AED);border-radius:8px;color:var(--text-primary,#F8F8FF);padding:10px 12px;font-family:'Cairo',sans-serif;font-size:1rem;outline:none;box-sizing:border-box;margin-bottom:14px;"/>
        <div style="display:flex;gap:10px;">
          <button id="_posdzInputOk" style="flex:2;padding:10px;border-radius:10px;border:none;cursor:pointer;background:var(--primary,#7C3AED);color:#fff;font-family:'Cairo',sans-serif;font-size:0.92rem;font-weight:700;">✅ تأكيد</button>
          <button id="_posdzInputCancel" style="flex:1;padding:10px;border-radius:10px;cursor:pointer;background:transparent;color:var(--text-secondary,#A0A0C0);font-family:'Cairo',sans-serif;font-size:0.92rem;border:1px solid var(--border,#3D2E6B);">إلغاء</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = document.getElementById('_posdzInputField');
    input.focus();
    input.select();
    const submit = () => { overlay.remove(); resolve(input.value.trim() || null); };
    const cancel = () => { overlay.remove(); resolve(null); };
    document.getElementById('_posdzInputOk').onclick = submit;
    document.getElementById('_posdzInputCancel').onclick = cancel;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') cancel(); });
  });
}


// ── Header Injection v7 ──────────────────────────────────────
function injectHeader() {
  const el = document.getElementById('appHeader');
  if (!el) return;
  el.innerHTML = '<button class="menu-btn" id="menuBtn">&#9776;</button>'
    + '<span class="store-name" id="headerStoreName">POS DZ</span>'
    + '<div id="headerNotifWrap" style="position:relative;margin-right:auto;">'
    + '<button id="bellBtn" onclick="toggleNotifPanel()" style="background:none;border:none;color:var(--text-primary);font-size:1.3rem;cursor:pointer;padding:6px;position:relative;">&#128276;'
    + '<span id="notifBadge" style="display:none;position:absolute;top:2px;right:2px;background:var(--danger);color:#fff;font-size:.6rem;font-weight:800;border-radius:50%;width:16px;height:16px;line-height:16px;text-align:center;"></span>'
    + '</button>'
    + '<div id="notifPanel" style="display:none;position:absolute;top:44px;right:0;width:300px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:500;max-height:360px;overflow-y:auto;"></div>'
    + '</div>'
    + '<div class="app-brand"><span class="brand-title">POS DZ</span><span class="brand-clock" id="clockDisplay"></span></div>';
}

// ── Init ──────────────────────────────────────────────────────
async function initApp() {
  await openDB();
  await applyTheme();
  await loadCurrency();
  injectHeader();
  await loadHeaderStoreName();
  if (typeof loadLanguage === 'function') await loadLanguage();
  if (typeof initSync     === 'function') await initSync();
  startClock();
  initSidebar();
  initVirtualKeyboard();
  initButtonSounds();
  setTimeout(() => initNotifications(), 2000);
}

// ═══════════════════════════════════════════════════════════════
// ── NOTIFICATION ENGINE — POS DZ v6.0.0
// ═══════════════════════════════════════════════════════════════

// Notification storage key (localStorage — fast, cross-tab)
const NOTIF_KEY   = 'posdz_notifications';
const NOTIF_READ  = 'posdz_notif_read_ts'; // timestamps of read items

// ── Load / Save notifications from localStorage ────────────────
function _loadNotifs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch { return []; }
}
function _saveNotifs(list) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(list)); } catch {}
}

// ── Add a notification (dedup by id within 24h) ────────────────
function _pushNotif(id, icon, title, body, type = 'warning') {
  const list  = _loadNotifs();
  const now   = Date.now();
  const exist = list.find(n => n.id === id);
  // Deduplicate: if same id exists and was added < 24h ago, skip
  if (exist && (now - exist.ts) < 24 * 60 * 60 * 1000) return;
  // Remove old entry with same id if present
  const fresh = list.filter(n => n.id !== id);
  fresh.unshift({ id, icon, title, body, type, ts: now, read: false });
  // Keep max 50 notifications
  _saveNotifs(fresh.slice(0, 50));
  _renderBell();
}

// ── Mark a single notif as read ────────────────────────────────
function _markRead(id) {
  const list = _loadNotifs().map(n => n.id === id ? { ...n, read: true } : n);
  _saveNotifs(list);
  _renderBell();
  _renderNotifPanel();
}

// ── Mark all as read ──────────────────────────────────────────
function _markAllRead() {
  const list = _loadNotifs().map(n => ({ ...n, read: true }));
  _saveNotifs(list);
  _renderBell();
  _renderNotifPanel();
}

// ── Inject bell button into every page header ─────────────────
function _injectBell() {
  const header = document.querySelector('.app-header');
  if (!header || document.getElementById('_notifBell')) return;

  // Bell button — inserted BEFORE the menu button
  const menuBtn = header.querySelector('.menu-btn');
  const bell = document.createElement('button');
  bell.id = '_notifBell';
  bell.title = 'الإشعارات';
  bell.style.cssText = `
    position:relative; background:transparent; border:none;
    color:var(--text-primary); font-size:1.4rem; cursor:pointer;
    padding:6px 10px; border-radius:8px; transition:0.2s;
    line-height:1; flex-shrink:0;
  `;
  bell.innerHTML = `
    🔔
    <span id="_notifBadge" style="
      display:none; position:absolute; top:2px; right:4px;
      background:#ef4444; color:#fff; border-radius:50%;
      min-width:18px; height:18px; font-size:0.65rem; font-weight:900;
      font-family:'Cairo',sans-serif; line-height:18px; text-align:center;
      padding:0 3px; box-shadow:0 0 6px rgba(239,68,68,0.7);
      pointer-events:none;
    "></span>
  `;
  bell.addEventListener('mouseenter', () => bell.style.background = 'var(--bg-card)');
  bell.addEventListener('mouseleave', () => bell.style.background = 'transparent');
  bell.onclick = (e) => { e.stopPropagation(); _toggleNotifPanel(); };

  // Correct order: ☰ | اسم المتجر | 🔔 | POS DZ
  // Insert bell before app-brand (which is POS DZ)
  const appBrand = header.querySelector('.app-brand');
  if (appBrand) header.insertBefore(bell, appBrand);
  else if (menuBtn) header.insertBefore(bell, menuBtn);
  else header.appendChild(bell);

  // Notification panel (dropdown)
  const panel = document.createElement('div');
  panel.id = '_notifPanel';
  panel.style.cssText = `
    display:none; position:fixed; top:68px; right:16px; z-index:9000;
    width:340px; max-height:480px; overflow-y:auto;
    background:var(--bg-card); border:1px solid var(--primary);
    border-radius:14px; box-shadow:0 12px 40px rgba(0,0,0,0.55);
    font-family:'Cairo',sans-serif;
  `;
  document.body.appendChild(panel);

  // Close panel on outside click
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== bell && !bell.contains(e.target)) {
      panel.style.display = 'none';
    }
  });

  _renderBell();
}

// ── Render badge count ─────────────────────────────────────────
function _renderBell() {
  const badge = document.getElementById('_notifBadge');
  if (!badge) return;
  const unread = _loadNotifs().filter(n => !n.read).length;
  if (unread > 0) {
    badge.style.display = 'block';
    badge.textContent   = unread > 99 ? '99+' : String(unread);
  } else {
    badge.style.display = 'none';
  }
}

// ── Toggle notification panel ─────────────────────────────────
function _toggleNotifPanel() {
  const panel = document.getElementById('_notifPanel');
  if (!panel) return;
  if (panel.style.display === 'none' || !panel.style.display) {
    _renderNotifPanel();
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

// ── Render notification list inside panel ─────────────────────
function _renderNotifPanel() {
  const panel = document.getElementById('_notifPanel');
  if (!panel) return;
  const list   = _loadNotifs();
  const unread = list.filter(n => !n.read).length;

  const typeColor = { warning: '#f59e0b', danger: '#ef4444', success: '#10b981', info: '#3b82f6' };

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding:14px 16px;border-bottom:1px solid var(--border);
      background:var(--bg-dark);border-radius:14px 14px 0 0;position:sticky;top:0;z-index:1;">
      <span style="font-weight:800;font-size:1rem;color:var(--primary-light);">
        🔔 الإشعارات
        ${unread > 0 ? `<span style="background:#ef4444;color:#fff;border-radius:10px;padding:1px 8px;font-size:0.72rem;margin-right:6px;">${unread}</span>` : ''}
      </span>
      ${unread > 0 ? `<button onclick="_markAllRead()" style="background:transparent;border:1px solid var(--border);color:var(--text-secondary);padding:4px 10px;border-radius:8px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:0.75rem;">قراءة الكل ✓</button>` : '<span style="color:var(--success);font-size:0.82rem;">✅ لا جديد</span>'}
    </div>
  `;

  if (!list.length) {
    html += `<div style="padding:32px;text-align:center;color:var(--text-secondary);font-size:0.9rem;">
      <div style="font-size:2rem;margin-bottom:10px;">🔕</div>
      لا توجد إشعارات
    </div>`;
  } else {
    // Show unread first, then read
    const sorted = [...list.filter(n => !n.read), ...list.filter(n => n.read)];
    html += sorted.map(n => {
      const color = typeColor[n.type] || '#6b7280';
      const dateStr = new Date(n.ts).toLocaleDateString('ar-DZ') + ' ' + new Date(n.ts).toLocaleTimeString('ar-DZ', { hour:'2-digit', minute:'2-digit' });
      return `
        <div onclick="_markRead('${n.id}')" style="
          display:flex;gap:10px;padding:12px 16px;
          border-bottom:1px solid var(--border);cursor:pointer;
          background:${n.read ? 'transparent' : 'rgba(124,58,237,0.06)'};
          transition:background 0.15s;
          ${n.read ? 'opacity:0.6;' : ''}
        " onmouseenter="this.style.background='var(--bg-medium)'" onmouseleave="this.style.background='${n.read ? 'transparent' : 'rgba(124,58,237,0.06)'}'">
          <div style="width:36px;height:36px;border-radius:50%;background:${color}22;border:2px solid ${color};
            display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">
            ${n.icon}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:${n.read ? '600' : '800'};font-size:0.88rem;color:var(--text-primary);margin-bottom:3px;">
              ${n.title}
              ${!n.read ? '<span style="background:#ef4444;border-radius:50%;width:8px;height:8px;display:inline-block;margin-right:4px;"></span>' : ''}
            </div>
            <div style="font-size:0.78rem;color:var(--text-secondary);line-height:1.4;">${n.body}</div>
            <div style="font-size:0.7rem;color:var(--text-secondary);margin-top:4px;opacity:0.7;">${dateStr}</div>
          </div>
        </div>`;
    }).join('');

    // Clear all button at bottom
    html += `<div style="padding:10px 16px;text-align:center;">
      <button onclick="localStorage.removeItem('${NOTIF_KEY}');_renderBell();_renderNotifPanel();"
        style="background:transparent;border:1px solid var(--danger);color:var(--danger);
        padding:5px 14px;border-radius:8px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:0.78rem;">
        🗑️ مسح جميع الإشعارات
      </button>
    </div>`;
  }

  panel.innerHTML = html;
}

// ── Notification checks (called on init + every 24h) ──────────
async function initNotifications() {
  const enabled = await getSetting('notifEnabled');
  if (enabled === '0') return;

  // Always inject the bell (even if notifs disabled, user can see history)
  _injectBell();

  const inApp = await getSetting('notifInApp');
  if (inApp === '0') return;

  try {
    const products  = await dbGetAll('products');
    const debts     = await dbGetAll('debts');
    const customers = await dbGetAll('customers');
    const now       = new Date();

    // ① Low stock
    if (await getSetting('notifLowStock') !== '0') {
      const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= (p.minStock || 5));
      lowStock.forEach(p => _pushNotif(
        `low_stock_${p.id}`, '📉', 'مخزون منخفض',
        `${p.name} — الكمية المتبقية: ${p.quantity}`, 'warning'
      ));
    }

    // ② Out of stock
    if (await getSetting('notifOutStock') !== '0') {
      const outStock = products.filter(p => p.quantity === 0);
      outStock.forEach(p => _pushNotif(
        `out_stock_${p.id}`, '🚫', 'نفاذ الكمية',
        `${p.name} — نفدت الكمية من المخزون`, 'danger'
      ));
    }

    // ③ Debt >= 30 days (per customer)
    if (await getSetting('notifDebt30') !== '0') {
      const grouped = {};
      debts.filter(d => !d.isPaid).forEach(d => {
        const days = (now - new Date(d.date)) / (1000 * 60 * 60 * 24);
        if (days >= 28) { // warn at 28 days, alert at 30
          if (!grouped[d.customerId]) grouped[d.customerId] = { days: 0, amount: 0 };
          grouped[d.customerId].days   = Math.max(grouped[d.customerId].days, Math.floor(days));
          grouped[d.customerId].amount += d.amount;
        }
      });
      for (const [custId, info] of Object.entries(grouped)) {
        const c = customers.find(x => x.id === parseInt(custId));
        _pushNotif(
          `debt_30_${custId}`,
          info.days >= 30 ? '💳' : '⚠️',
          info.days >= 30 ? `دين متجاوز 30 يوم` : 'دين يقترب من 30 يوم',
          `${c ? c.name : '—'} — ${info.amount.toFixed(0)} دج — منذ ${info.days} يوم`,
          info.days >= 30 ? 'danger' : 'warning'
        );
      }
    }

    // ④ Product expiry within 7 days
    if (await getSetting('notifExpiry') !== '0') {
      products.filter(p => p.expiryDate).forEach(p => {
        const daysLeft = (new Date(p.expiryDate) - now) / (1000 * 60 * 60 * 24);
        if (daysLeft <= 7 && daysLeft >= 0) {
          _pushNotif(
            `expiry_${p.id}`, '⏰', 'انتهاء الصلاحية قريب',
            `${p.name} — يتبقى ${Math.ceil(daysLeft)} يوم`, 'warning'
          );
        } else if (daysLeft < 0) {
          _pushNotif(
            `expired_${p.id}`, '❌', 'منتج منتهي الصلاحية',
            `${p.name} — انتهت الصلاحية`, 'danger'
          );
        }
      });
    }

    // Refresh bell badge after all checks
    _renderBell();

    // Re-run checks every 24 hours
    setTimeout(() => initNotifications(), 24 * 60 * 60 * 1000);

  } catch(e) { /* silent fail */ }
}

// ── Instant notifications (login / password change) ───────────
// Called from login flow and password change — NOT periodic
function notifLogin(username) {
  getSetting('notifEnabled').then(en => {
    if (en === '0') return;
    getSetting('notifLogin').then(v => {
      if (v === '0') return;
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ar-DZ', { hour:'2-digit', minute:'2-digit' });
      _pushNotif(
        `login_${username}_${Date.now()}`,
        '👤', 'دخول مستخدم',
        `${username} — سجّل الدخول في ${timeStr}`,
        'info'
      );
    });
  });
}

function notifPasswordChange(username) {
  getSetting('notifEnabled').then(en => {
    if (en === '0') return;
    getSetting('notifPwdChange').then(v => {
      if (v === '0') return;
      _pushNotif(
        `pwd_${username}_${Date.now()}`,
        '🔑', 'تغيير الرقم السري',
        `تم تغيير كلمة المرور للمستخدم: ${username}`,
        'warning'
      );
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// ── AUTO-INIT — POS DZ v7.0.0
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', initApp);

// ================================================================
//  POS DZ v7.0.0 — addon.js  |  الوظائف الإضافية
//  يُضاف هذا الملف إلى نهاية app.js
// ================================================================

// ── i18n — نظام الترجمة ─────────────────────────────────────────
const TRANSLATIONS = {
  ar: {
    navSale:'واجهة البيع', navInventory:'المخزون', navCustomers:'الزبائن',
    navReports:'إدارة الأعمال', navSuppliers:'الموردين', navUsers:'المستخدمين',
    navSettings:'الإعدادات', navLogout:'تسجيل الخروج',
    product:'المنتج', qty:'الكمية', total:'الإجمالي', price:'السعر',
    discount:'خصم', paid:'المدفوع', change:'الباقي', customer:'الزبون',
    sell:'تسديد', partialDebt:'جزئي + دين', fullDebt:'دين كامل',
    print:'طباعة', close:'إغلاق', save:'حفظ', cancel:'إلغاء', add:'إضافة',
    edit:'تعديل', delete:'حذف', search:'بحث', noCustomer:'— بدون زبون —',
    emptyCart:'السلة فارغة — ابحث عن منتج أو امسح الباركود',
    invoice:'فاتورة', stock:'المخزون', family:'العائلة', barcode:'الباركود',
    buyPrice:'سعر الشراء', sellPrice:'سعر البيع', expiry:'انتهاء الصلاحية',
    name:'الاسم', phone:'الهاتف', address:'العنوان', email:'البريد',
    debt:'الدين', supplier:'المورد', user:'المستخدم', role:'الدور',
    password:'كلمة المرور', active:'نشط', inactive:'غير نشط',
    scale:'الميزان', error:'خطأ', success:'نجاح', warning:'تحذير',
    searchProduct:'ابحث عن منتج أو امسح الباركود...', language:'اللغة',
    settings:'الإعدادات', reports:'التقارير', today:'اليوم', week:'الأسبوع',
    month:'الشهر', year:'السنة', salesTotal:'إجمالي المبيعات',
    debtTotal:'إجمالي الديون', profit:'الربح', cost:'التكلفة',
    confirm:'تأكيد', yes:'نعم', no:'لا',
  },
  fr: {
    navSale:'Point de vente', navInventory:'Inventaire', navCustomers:'Clients',
    navReports:'Gestion', navSuppliers:'Fournisseurs', navUsers:'Utilisateurs',
    navSettings:'Paramètres', navLogout:'Déconnexion',
    product:'Produit', qty:'Qté', total:'Total', price:'Prix',
    discount:'Remise', paid:'Payé', change:'Rendu', customer:'Client',
    sell:'Encaisser', partialDebt:'Partiel + Dette', fullDebt:'Dette totale',
    print:'Imprimer', close:'Fermer', save:'Sauvegarder', cancel:'Annuler',
    add:'Ajouter', edit:'Modifier', delete:'Supprimer', search:'Rechercher',
    noCustomer:'— Sans client —', emptyCart:'Panier vide',
    invoice:'Facture', stock:'Stock', family:'Famille', barcode:'Code-barres',
    buyPrice:'Prix achat', sellPrice:'Prix vente', expiry:'Expiration',
    name:'Nom', phone:'Téléphone', address:'Adresse', email:'E-mail',
    debt:'Dette', supplier:'Fournisseur', user:'Utilisateur', role:'Rôle',
    password:'Mot de passe', active:'Actif', inactive:'Inactif',
    scale:'Balance', error:'Erreur', success:'Succès', warning:'Avertissement',
    searchProduct:'Rechercher produit ou scanner...', language:'Langue',
    settings:'Paramètres', reports:'Rapports', today:"Aujourd'hui",
    week:'Semaine', month:'Mois', year:'Année',
    salesTotal:'Total ventes', debtTotal:'Total dettes', profit:'Bénéfice',
    cost:'Coût', confirm:'Confirmer', yes:'Oui', no:'Non',
  },
  en: {
    navSale:'Point of Sale', navInventory:'Inventory', navCustomers:'Customers',
    navReports:'Business', navSuppliers:'Suppliers', navUsers:'Users',
    navSettings:'Settings', navLogout:'Logout',
    product:'Product', qty:'Qty', total:'Total', price:'Price',
    discount:'Discount', paid:'Paid', change:'Change', customer:'Customer',
    sell:'Checkout', partialDebt:'Partial + Debt', fullDebt:'Full Debt',
    print:'Print', close:'Close', save:'Save', cancel:'Cancel',
    add:'Add', edit:'Edit', delete:'Delete', search:'Search',
    noCustomer:'— No customer —', emptyCart:'Cart is empty',
    invoice:'Invoice', stock:'Stock', family:'Family', barcode:'Barcode',
    buyPrice:'Buy Price', sellPrice:'Sell Price', expiry:'Expiry',
    name:'Name', phone:'Phone', address:'Address', email:'Email',
    debt:'Debt', supplier:'Supplier', user:'User', role:'Role',
    password:'Password', active:'Active', inactive:'Inactive',
    scale:'Scale', error:'Error', success:'Success', warning:'Warning',
    searchProduct:'Search product or scan barcode...', language:'Language',
    settings:'Settings', reports:'Reports', today:'Today',
    week:'Week', month:'Month', year:'Year',
    salesTotal:'Total Sales', debtTotal:'Total Debts', profit:'Profit',
    cost:'Cost', confirm:'Confirm', yes:'Yes', no:'No',
  }
};

let _currentLang = 'ar';

function _i18n(key) {
  return (TRANSLATIONS[_currentLang] || TRANSLATIONS['ar'])[key] || key;
}

async function setLanguage(lang, save = true) {
  if (!TRANSLATIONS[lang]) return;
  _currentLang = lang;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.documentElement.dir  = dir;
  document.body.dir = dir;
  // Update all [data-i18n] elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = _i18n(key);
    if (val) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = _i18n(key);
    if (val) el.placeholder = val;
  });
  if (save) await setSetting('language', lang);
  document.dispatchEvent(new CustomEvent('langChanged', { detail: lang }));
}

async function loadLanguage() {
  const lang = await getSetting('language') || 'ar';
  await setLanguage(lang, false);
}

// ── verifyPassword — دعم SHA-256 والنص العادي ───────────────────
async function verifyPassword(plain, stored) {
  if (!plain || !stored) return false;
  // Direct match (legacy plain text)
  if (plain === stored) return true;
  // SHA-256 match
  const hashed = hashPassword(plain);
  if (hashed === stored) return true;
  // Async SHA-256 via SubtleCrypto
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
    const hex = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    if (hex === stored) return true;
  } catch(e) {}
  return false;
}

// ── Audit Log ───────────────────────────────────────────────────
async function logAudit(type, action, data) {
  try {
    const user = getSession();
    await dbAdd('settings', {
      key: 'audit_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      value: JSON.stringify({
        type, action, data,
        userId: user ? user.id : null,
        username: user ? user.username : 'unknown',
        date: new Date().toISOString()
      })
    });
  } catch(e) { /* silent fail */ }
}

// ── Firebase Sync — Stub (works offline-first) ──────────────────
let _syncEnabled = false;
let _firebaseUrl  = '';
let _firebaseKey  = '';

async function initSync() {
  _syncEnabled = await getSetting('syncEnabled') === '1';
  _firebaseUrl  = await getSetting('firebaseUrl')  || '';
  _firebaseKey  = await getSetting('firebaseKey')  || '';
}

async function syncPush(collection, record) {
  if (!_syncEnabled || !_firebaseUrl || !record) return;
  try {
    const url = _firebaseUrl.replace(/\/$/, '') + '/' + collection + '/' + record.id + '.json'
              + (_firebaseKey ? '?auth=' + _firebaseKey : '');
    await fetch(url, {
      method : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(record)
    });
  } catch(e) { /* offline — ignore */ }
}

async function syncDelete(collection, id) {
  if (!_syncEnabled || !_firebaseUrl) return;
  try {
    const url = _firebaseUrl.replace(/\/$/, '') + '/' + collection + '/' + id + '.json'
              + (_firebaseKey ? '?auth=' + _firebaseKey : '');
    await fetch(url, { method: 'DELETE' });
  } catch(e) {}
}

// ── Electronic Scale (Web Serial API) ───────────────────────────
let _scalePort   = null;
let _scaleReader = null;
let _scaleWeight = 0;
let _scaleCallbacks = [];

async function connectScale() {
  if (!navigator.serial) {
    toast('Web Serial API غير مدعوم في هذا المتصفح', 'error');
    return false;
  }
  try {
    const baud = parseInt(await getSetting('scaleBaud')) || 9600;
    _scalePort = await navigator.serial.requestPort();
    await _scalePort.open({ baudRate: baud });
    _readScaleLoop();
    updateScaleStatus(true);
    toast('تم الاتصال بالميزان ✅', 'success');
    return true;
  } catch(e) {
    toast('فشل الاتصال بالميزان: ' + e.message, 'error');
    return false;
  }
}

async function _readScaleLoop() {
  const decoder = new TextDecoderStream();
  _scalePort.readable.pipeTo(decoder.writable);
  _scaleReader = decoder.readable.getReader();
  let buf = '';
  while (true) {
    try {
      const { value, done } = await _scaleReader.read();
      if (done) break;
      buf += value;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) {
        const w = _parseScaleData(line.trim());
        if (w !== null) {
          _scaleWeight = w;
          updateScaleDisplay(w);
          _scaleCallbacks.forEach(cb => { try { cb(w); } catch(e){} });
        }
      }
    } catch(e) { break; }
  }
}

function _parseScaleData(raw) {
  if (!raw) return null;
  // Format: ST,GS,+000.000kg
  let m = raw.match(/[+-]?\d+\.?\d*/);
  if (m) {
    const w = parseFloat(m[0]);
    if (!isNaN(w) && w >= 0) return w;
  }
  return null;
}

function updateScaleDisplay(weight) {
  const el = document.getElementById('saleScaleDisplay') || document.getElementById('scaleDisplay');
  if (el) el.textContent = weight.toFixed(3) + ' kg';
  const badge = document.getElementById('scaleWeightBadge');
  if (badge) badge.textContent = weight.toFixed(3) + ' kg';
}

function updateScaleStatus(connected) {
  const el = document.getElementById('scaleStatusIndicator');
  if (el) {
    el.textContent = connected ? '⚖️ متصل' : '⚖️ غير متصل';
    el.style.color = connected ? 'var(--success)' : 'var(--text-secondary)';
  }
}

function onScaleRead(callback) {
  if (typeof callback === 'function') _scaleCallbacks.push(callback);
}

async function disconnectScale() {
  try {
    if (_scaleReader) await _scaleReader.cancel();
    if (_scalePort)   await _scalePort.close();
    _scalePort = _scaleReader = null;
    updateScaleStatus(false);
  } catch(e) {}
}

// ── SMS (Twilio / Vonage) ────────────────────────────────────────
async function sendSMS(to, message) {
  const provider = await getSetting('smsProvider') || '';
  if (!provider || !to) return { ok: false, error: 'No provider or recipient' };
  try {
    if (provider === 'twilio') {
      const sid   = await getSetting('twilioSID')   || '';
      const token = await getSetting('twilioToken') || '';
      const from  = await getSetting('twilioFrom')  || '';
      const resp  = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method : 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(sid + ':' + token),
          'Content-Type' : 'application/x-www-form-urlencoded'
        },
        body: `To=${encodeURIComponent(to)}&From=${encodeURIComponent(from)}&Body=${encodeURIComponent(message)}`
      });
      const data = await resp.json();
      return { ok: resp.ok, data };
    }
    if (provider === 'vonage') {
      const apiKey    = await getSetting('vonageKey')    || '';
      const apiSecret = await getSetting('vonageSecret') || '';
      const from      = await getSetting('vonageFrom')   || 'POSDZ';
      const resp = await fetch('https://rest.nexmo.com/sms/json', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ api_key: apiKey, api_secret: apiSecret, to, from, text: message })
      });
      const data = await resp.json();
      return { ok: resp.ok, data };
    }
  } catch(e) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: 'Unknown provider' };
}

async function sendDebtReminderSMS(customer) {
  if (!customer || !customer.phone) return;
  const storeName = await getSetting('storeName') || 'المتجر';
  const debt = customer.debt || 0;
  const msg = `${storeName}: عزيزي ${customer.name}، لديك دين بقيمة ${formatMoney(debt)}. يرجى التسديد. شكراً.`;
  return sendSMS(customer.phone, msg);
}

// ── Email (EmailJS / SendGrid) ───────────────────────────────────
async function sendEmail(to, subject, htmlBody) {
  const provider = await getSetting('emailProvider') || '';
  if (!provider || !to) return { ok: false, error: 'No provider or recipient' };
  try {
    if (provider === 'sendgrid') {
      const apiKey = await getSetting('sendgridKey') || '';
      const from   = await getSetting('emailFrom')   || 'noreply@posdz.com';
      const resp   = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method : 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from },
          subject,
          content: [{ type: 'text/html', value: htmlBody }]
        })
      });
      return { ok: resp.ok };
    }
    if (provider === 'emailjs') {
      const serviceId  = await getSetting('emailjsService')  || '';
      const templateId = await getSetting('emailjsTemplate') || '';
      const userId     = await getSetting('emailjsUser')     || '';
      const resp = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          service_id: serviceId, template_id: templateId, user_id: userId,
          template_params: { to_email: to, subject, html_body: htmlBody }
        })
      });
      return { ok: resp.ok };
    }
  } catch(e) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: 'Unknown email provider' };
}

async function sendInvoiceEmail(customer, sale, items) {
  if (!customer || !customer.email) return;
  const storeName = await getSetting('storeName') || 'POS DZ';
  const currency  = await getSetting('currency')  || 'DA';
  const rows = items.map(i =>
    `<tr><td>${i.productName||i.name}</td><td>${i.qty}</td><td>${i.unitPrice||i.price} ${currency}</td><td>${((i.qty)*(i.unitPrice||i.price)).toFixed(2)} ${currency}</td></tr>`
  ).join('');
  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#7C3AED;">${storeName}</h2>
      <p>فاتورة رقم: <b>${sale.invoiceNum || '#'}</b> — ${new Date(sale.date).toLocaleDateString('ar')}</p>
      <table border="1" style="width:100%;border-collapse:collapse;">
        <thead style="background:#f3f4f6;"><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${sale.discount > 0 ? `<p>الخصم: <b>-${sale.discount} ${currency}</b></p>` : ''}
      <h3>المجموع: ${sale.total} ${currency}</h3>
      <p style="color:#888;font-size:12px;">POS DZ v7.0.0 | شكراً لتسوقك معنا</p>
    </div>`;
  return sendEmail(customer.email, `فاتورة ${storeName} — ${sale.invoiceNum}`, html);
}

// ── Customer Classification ──────────────────────────────────────
async function classifyCustomer(customer) {
  if (!customer) return { cls: '', badge: '', label: '' };
  const sales    = await dbGetByIndex('saleItems', 'customerId', customer.id).catch(() => []);
  const debtRec  = (await dbGetByIndex('debts', 'customerId', customer.id).catch(() => []))[0];
  const debt     = debtRec ? (debtRec.amount || 0) : 0;
  const allSales = (await dbGetAll('sales').catch(() => [])).filter(s => s.customerId === customer.id);
  const totalBought = allSales.reduce((s, x) => s + (x.total || 0), 0);
  const lastSale    = allSales.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const daysSince   = lastSale
    ? Math.floor((Date.now() - new Date(lastSale.date)) / 86400000) : 9999;

  let cls = 'active', badge = '🟢', label = 'نشط';
  if (totalBought >= 50000)   { cls = 'vip';      badge = '👑'; label = 'VIP'; }
  else if (debt > 0 && daysSince > 30) { cls = 'debtor'; badge = '🔴'; label = 'مدين'; }
  else if (daysSince > 90)    { cls = 'sleeping'; badge = '😴'; label = 'نائم'; }
  else if (daysSince > 30)    { cls = 'medium';   badge = '🟡'; label = 'متوسط'; }

  return { cls, badge, label, totalBought, totalDebt: debt, daysSinceVisit: daysSince, invoiceCount: allSales.length };
}

// ── Product Classification ───────────────────────────────────────
async function classifyProduct(product) {
  if (!product) return { cls: 'good', badge: '🟢', label: 'جيد' };
  const stock  = product.stock  || 0;
  const minQty = product.minQty || 5;
  const expiry = product.expiryDate || null;

  let daysToExpiry = Infinity;
  if (expiry) daysToExpiry = Math.floor((new Date(expiry) - Date.now()) / 86400000);

  const sales = await dbGetAll('saleItems').catch(() => []);
  const totalSold = sales.filter(s => s.productId === product.id).reduce((s, x) => s + (x.qty || 0), 0);

  let cls = 'good', badge = '🟢', label = 'جيد';
  if (daysToExpiry < 0)          { cls = 'expired';  badge = '🚫'; label = 'منتهي'; }
  else if (daysToExpiry <= 30)   { cls = 'expiring'; badge = '⚠️'; label = 'قريب الانتهاء'; }
  else if (stock <= 0)           { cls = 'empty';    badge = '🔴'; label = 'نفذ'; }
  else if (stock <= minQty)      { cls = 'low';      badge = '🟡'; label = 'منخفض'; }
  else if (totalSold >= 50)      { cls = 'top';      badge = '⭐'; label = 'الأكثر مبيعاً'; }

  return { cls, badge, label, totalSold };
}

// ── Notification panel toggle (v7 uses _toggleNotifPanel) ───────
function toggleNotifPanel() {
  _toggleNotifPanel();
}

// ── openVKB / closeVKB v7 ───────────────────────────────────────
// New v7 VKB container support (used by pages with id="vkbContainer")
let _vkbTarget = null;
let _vkbLang   = 'ar';
let _vkbShift  = false;
let _vkbSymbols = false;

const VKB_LAYOUTS = {
  ar:    ['ض ص ث ق ف غ ع ه خ ح ج', 'ش س ي ب ل ا ت ن م ك ط', 'ز و ة ى ر ذ ئ ء ؤ إ أ'],
  fr:    ['a z e r t y u i o p', 'q s d f g h j k l m', 'w x c v b n'],
  en:    ['q w e r t y u i o p', 'a s d f g h j k l', 'z x c v b n m'],
  arSh:  ['ض ص ث ق ف غ ع ه خ ح ج', 'ش س ي ب ل ا ت ن م ك ط', 'ز و ة ى ر ذ ئ ء ؤ إ أ'],
  frSh:  ['A Z E R T Y U I O P', 'Q S D F G H J K L M', 'W X C V B N'],
  enSh:  ['Q W E R T Y U I O P', 'A S D F G H J K L', 'Z X C V B N M'],
  sym:   ['1 2 3 4 5 6 7 8 9 0', '! @ # $ % ^ & * ( )', '- _ = + [ ] { } ; :'],
};

function _buildVKB() {
  const c = document.getElementById('vkbContainer');
  if (!c) return;
  const lang   = _vkbLang;
  const key    = _vkbSymbols ? 'sym' : (_vkbShift ? lang + 'Sh' : lang);
  const layout = VKB_LAYOUTS[key] || VKB_LAYOUTS[lang] || VKB_LAYOUTS['ar'];

  c.style.display = 'flex';
  c.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:var(--bg-dark);border-radius:18px 18px 0 0;cursor:move;" id="vkbTopBar">
      <span style="font-size:.85rem;color:var(--primary-light);font-weight:700;">⌨ POS DZ</span>
      <div style="display:flex;gap:6px;align-items:center;">
        <button onclick="setVKBLang('ar')" style="padding:2px 10px;border-radius:12px;border:1px solid var(--border);background:${lang==='ar'?'var(--primary)':'transparent'};color:${lang==='ar'?'#fff':'var(--text-secondary)'};cursor:pointer;font-family:'Cairo',sans-serif;font-size:.75rem;">ع</button>
        <button onclick="setVKBLang('fr')" style="padding:2px 10px;border-radius:12px;border:1px solid var(--border);background:${lang==='fr'?'var(--primary)':'transparent'};color:${lang==='fr'?'#fff':'var(--text-secondary)'};cursor:pointer;font-family:'Cairo',sans-serif;font-size:.75rem;">FR</button>
        <button onclick="setVKBLang('en')" style="padding:2px 10px;border-radius:12px;border:1px solid var(--border);background:${lang==='en'?'var(--primary)':'transparent'};color:${lang==='en'?'#fff':'var(--text-secondary)'};cursor:pointer;font-family:'Cairo',sans-serif;font-size:.75rem;">EN</button>
        <button onclick="closeVKB()" style="background:var(--danger);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;font-weight:900;font-size:.9rem;">✕</button>
      </div>
    </div>
    <div style="padding:10px 12px 14px;" id="vkbKeys">
      ${layout.map(row =>
        `<div style="display:flex;gap:5px;justify-content:center;margin-bottom:5px;">${
          row.split(' ').map(k => `<button onclick="vkbPressV7('${k}')" style="min-width:36px;height:40px;padding:0 6px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:1rem;font-family:'Cairo',sans-serif;cursor:pointer;transition:background .12s;flex:1;max-width:50px;" onmouseover="this.style.background='var(--primary)';this.style.color='#fff'" onmouseout="this.style.background='var(--bg-card)';this.style.color='var(--text-primary)'">${k}</button>`).join('')
        }</div>`
      ).join('')}
      <div style="display:flex;gap:5px;justify-content:center;margin-top:4px;">
        <button onclick="vkbPressV7('SHIFT')" style="flex:1;height:38px;background:${_vkbShift?'var(--primary)':'var(--bg-input)'};border:1px solid var(--border);border-radius:8px;color:var(--text-primary);cursor:pointer;font-size:.9rem;">⇧</button>
        <button onclick="vkbPressV7('SPACE')" style="flex:4;height:38px;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;color:var(--text-secondary);cursor:pointer;font-size:.8rem;">${lang==='ar'?'مسافة':lang==='fr'?'espace':'space'}</button>
        <button onclick="vkbPressV7('#')" style="flex:1;height:38px;background:${_vkbSymbols?'var(--primary)':'var(--bg-input)'};border:1px solid var(--border);border-radius:8px;color:var(--text-primary);cursor:pointer;font-size:.9rem;">#&</button>
        <button onclick="vkbPressV7('BACKSPACE')" style="flex:1;height:38px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:var(--danger);cursor:pointer;font-size:1rem;">⌫</button>
        <button onclick="vkbPressV7('ENTER')" style="flex:1.5;height:38px;background:var(--primary);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:.85rem;font-weight:700;">↵</button>
      </div>
      ${lang !== 'ar' ? `<div style="display:flex;gap:4px;justify-content:center;margin-top:4px;">${'0123456789'.split('').map(d=>`<button onclick="vkbPressV7('${d}')" style="flex:1;height:34px;background:var(--bg-card);border:1px solid var(--border);border-radius:7px;color:var(--text-primary);font-size:.95rem;cursor:pointer;">${d}</button>`).join('')}</div>` : ''}
    </div>`;

  // Make draggable
  const bar = document.getElementById('vkbTopBar');
  if (bar) {
    let startX = 0, startLeft = 0;
    bar.onmousedown = (e) => {
      startX = e.clientX;
      startLeft = c.getBoundingClientRect().left;
      const move = (ev) => {
        const dx = ev.clientX - startX;
        c.style.left = (startLeft + dx) + 'px';
        c.style.transform = 'none';
      };
      const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    };
  }
}

function vkbPressV7(key) {
  const target = _vkbTarget || document.activeElement;
  if (key === 'BACKSPACE') {
    if (target && target.value !== undefined) {
      const s = target.selectionStart || target.value.length;
      target.value = target.value.slice(0, Math.max(0, s - 1)) + target.value.slice(s);
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else if (key === 'ENTER') {
    target?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    target?.closest('form')?.submit?.();
  } else if (key === 'SPACE') {
    if (target && target.value !== undefined) {
      target.value += ' ';
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else if (key === 'SHIFT') {
    _vkbShift = !_vkbShift;
    _vkbSymbols = false;
    _buildVKB();
  } else if (key === '#') {
    _vkbSymbols = !_vkbSymbols;
    _vkbShift = false;
    _buildVKB();
  } else {
    if (target && target.value !== undefined) {
      target.value += key;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (_vkbShift) { _vkbShift = false; _buildVKB(); }
  }
}

function setVKBLang(lang) {
  _vkbLang = lang;
  _vkbShift = false;
  _vkbSymbols = false;
  _buildVKB();
}

function openVKB(targetEl) {
  _vkbTarget = targetEl || document.activeElement;
  _vkbShift = false;
  _vkbSymbols = false;
  _buildVKB();
}

function closeVKB() {
  const c = document.getElementById('vkbContainer');
  if (c) c.style.display = 'none';
  _vkbTarget = null;
}

// Auto-attach VKB to inputs if setting enabled
document.addEventListener('focusin', async (e) => {
  const el = e.target;
  if (!['INPUT','TEXTAREA'].includes(el.tagName)) return;
  if (el.type === 'date' || el.type === 'file' || el.type === 'checkbox' || el.type === 'radio') return;
  _vkbTarget = el;
  const auto = await getSetting('touchKeyboard').catch(() => '0');
  if (auto === '1') openVKB(el);
});

// ── i18n init ───────────────────────────────────────────────────
// Load language on startup (called from initApp override below)
(async () => {
  try {
    const lang = await getSetting('language') || 'ar';
    _currentLang = lang;
    await setLanguage(lang, false);
  } catch(e) {}
})();
