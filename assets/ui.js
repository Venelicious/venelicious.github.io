import { idbPut, idbAdd, idbGetAll, idbClear, idbDelete, openDb } from './db.js';
import {
  toCents,
  fromCents,
  sanitizeForPdf,
  tickFor,
  computeActionSum,
  computeActionProvisionCents,
  computeMonthlyNeukundenBonusCents,
  computeNeukundenBonusForTourCents,
  computeIntegrationCents,
  computeSpesenCentsForTour,
  computeKundenmanagementBonusCents,
  determineVGRate,
  computeNetResult,
} from './calculations.js';

/* ========== UI init-Grundlagen ========== */
const selectMonth = document.getElementById('selectMonth');
const selectYear = document.getElementById('selectYear');
const paprovMonth = document.getElementById('paprovMonth');
const lostCustomersMonth = document.getElementById('lostCustomersMonth');
const baseSalaryMonth = document.getElementById('baseSalaryMonth');
const heimschlaeferMonth = document.getElementById('heimschlaeferMonth');
const csvInput = document.getElementById('csvInput');
const jsonInput = document.getElementById('jsonInput');
const customerNumberInput = document.getElementById('customerNumber');
const customerNameInput = document.getElementById('customerName');
const customerLastNameInput = document.getElementById('customerLastName');
const customerFirstNameInput = document.getElementById('customerFirstName');
const customerStreetInput = document.getElementById('customerStreet');
const customerHouseNumberInput = document.getElementById('customerHouseNumber');
const customerPostalCodeInput = document.getElementById('customerPostalCode');
const customerCityInput = document.getElementById('customerCity');
const customerAgreementTypeSelect = document.getElementById('customerAgreementType');
const customerAgreementSinceInput = document.getElementById('customerAgreementSince');
const customerAgreementUntilInput = document.getElementById('customerAgreementUntil');
const customerAgreementNoteInput = document.getElementById('customerAgreementNote');
const customerAgreementsList = document.getElementById('customerAgreementsList');
const customerAddressSearchInput = document.getElementById('customerAddressSearch');
const customerAddressSuggestions = document.getElementById('customerAddressSuggestions');
const customerAddressSuggestionMap = new Map();
let editingCustomerAgreementId = null;
let saveCustomerAgreementBtn;
let printCustomerListBtn;
let currentSort = { key:null, dir:'asc' };

const tabTargets = {
  tabNewTour: 'sectionNewTour',
  tabTours: 'sectionTours',
  tabSummary: 'sectionSummary',
  tabStats: 'sectionStats',
  tabCustomers: 'sectionCustomers',
  tabSettings: 'sectionSettings',
  tabBackups: 'sectionBackups',
  tabExport: 'sectionExport'
};

const menuTriggerBtn = document.querySelector('.menuTrigger');
const sideMenu = document.getElementById('sideMenu');
const menuOverlay = document.getElementById('menuOverlay');
const closeMenuBtn = document.getElementById('closeMenu');

function closeSideMenu(){
  if(!sideMenu || !menuOverlay) return;
  sideMenu.classList.remove('active');
  menuOverlay.classList.remove('active');
  sideMenu.setAttribute('aria-hidden', 'true');
  menuOverlay.setAttribute('aria-hidden', 'true');
}

function positionSideMenuNearTrigger(){
  if(!sideMenu || !menuTriggerBtn) return;
  if(window.matchMedia('(max-width: 840px)').matches){
    const rect = menuTriggerBtn.getBoundingClientRect();
    sideMenu.style.setProperty('--menu-top', `${Math.max(rect.bottom + 8, 12)}px`);
    sideMenu.style.setProperty('--menu-left', `${Math.max(rect.left - 2, 10)}px`);
  } else {
    sideMenu.style.removeProperty('--menu-top');
    sideMenu.style.removeProperty('--menu-left');
  }
}

function openSideMenu(){
  if(!sideMenu || !menuOverlay) return;
  positionSideMenuNearTrigger();
  sideMenu.classList.add('active');
  menuOverlay.classList.add('active');
  sideMenu.setAttribute('aria-hidden', 'false');
  menuOverlay.setAttribute('aria-hidden', 'false');
}

function toggleSideMenu(){
  if(!sideMenu) return;
  if(sideMenu.classList.contains('active')){
    closeSideMenu();
  } else {
    openSideMenu();
  }
}

function childrenCountForStatus(status){
  switch(status){
    case 'childless_over_23':
    case 'childless_under_23':
      return 0;
    case 'two_children':
      return 2;
    case 'three_children':
      return 3;
    case 'four_children':
      return 4;
    case 'five_plus_children':
      return 5;
    case 'one_child':
    default:
      return 1;
  }
}

function deriveChildrenStatusFromConfig(netCfg = {}){
  if(netCfg.childrenStatus) return netCfg.childrenStatus;

  const count = Number(netCfg.childrenCount);
  if(!Number.isNaN(count)){
    if(count <= 0){
      const ageVal = Number(netCfg.age || 0);
      return ageVal >= 23 ? 'childless_over_23' : 'childless_under_23';
    }
    if(count >= 5) return 'five_plus_children';
    if(count === 4) return 'four_children';
    if(count === 3) return 'three_children';
    if(count === 2) return 'two_children';
    return 'one_child';
  }

  if(netCfg.hasKids === false){
    const ageVal = Number(netCfg.age || 0);
    return ageVal >= 23 ? 'childless_over_23' : 'childless_under_23';
  }

  return 'one_child';
}

function setActiveSection(sectionId){
  Object.entries(tabTargets).forEach(([tabId, targetId]) => {
    const tab = document.getElementById(tabId);
    const section = document.getElementById(targetId);
    if(tab && section){
      const isActive = targetId === sectionId;
      tab.classList.toggle('active', isActive);
      section.classList.toggle('active', isActive);
    }
  });

  if(sectionId === 'sectionSettings'){
    populateSettingsSection().catch(err => console.error('Settings laden fehlgeschlagen', err));
  }else if(sectionId === 'sectionBackups'){
    loadBackupsList().catch(err => console.error('Backups laden fehlgeschlagen', err));
  }else if(sectionId === 'sectionCustomers'){
    renderCustomerAgreements().catch(err => console.error('Kundenabsprachen laden fehlgeschlagen', err));
  }
}

/* Jahre + Monatsselektoren auffüllen */
(function populateYearsAndPaprov(){
  const now = new Date();
  const cy = now.getFullYear();
  for(let y=cy-5;y<=cy+1;y++){
    const opt = document.createElement('option'); opt.value = y; opt.textContent = y;
    selectYear.appendChild(opt);
  }
  selectYear.value = cy;

  const monthlySelectors = [paprovMonth, lostCustomersMonth, baseSalaryMonth, heimschlaeferMonth].filter(Boolean);
  monthlySelectors.forEach(sel => sel.innerHTML = '');
  for(let y=cy-1;y<=cy+1;y++){
    for(let m=1;m<=12;m++){
      const mm = String(m).padStart(2,'0');
      const opt = document.createElement('option');
      opt.value = `${y}-${mm}`;
      opt.textContent = `${mm}.${y}`;
      monthlySelectors.forEach(sel => sel.appendChild(opt.cloneNode(true)));
    }
  }
})();

/* Aktionen-UI */
function createActionRow(price='', qty=''){
  const row = document.createElement('div'); row.className = 'action-row';

  const priceInput = document.createElement('input');
  priceInput.className = 'actPrice';
  priceInput.type = 'number';
  priceInput.step = '0.01';
  priceInput.value = price;
  priceInput.placeholder = 'Preis €';

  const qtyInput = document.createElement('input');
  qtyInput.className = 'actQty';
  qtyInput.type = 'number';
  qtyInput.step = '1';
  qtyInput.value = qty;
  qtyInput.placeholder = 'Stück';

  const delBtn = document.createElement('button');
  delBtn.className = 'small delAct';
  delBtn.type = 'button';
  delBtn.textContent = 'x';
  delBtn.addEventListener('click', ()=> row.remove());

  row.append(priceInput, qtyInput, delBtn);
  return row;
}
function renderActionsList(actions = [], target = document.getElementById('actionsList')){
  if(!target) return;
  target.innerHTML = '';
  actions.forEach(a => target.appendChild(createActionRow(a.price ?? '', a.qty ?? '')));
}
function createSumRow(label, value, { emphasize=false, style='' } = {}){
  const row = document.createElement('div');
  row.className = 'sumRow';
  if(style) row.style.cssText = style;

  const labelSpan = document.createElement('span');
  const valueSpan = document.createElement('span');

  if(emphasize){
    const strongLabel = document.createElement('strong');
    strongLabel.textContent = label;
    const strongValue = document.createElement('strong');
    strongValue.textContent = value;
    labelSpan.appendChild(strongLabel);
    valueSpan.appendChild(strongValue);
  } else {
    labelSpan.textContent = label;
    valueSpan.textContent = value;
  }

  row.append(labelSpan, valueSpan);
  return row;
}
document.getElementById('addActionBtn').addEventListener('click', (e)=>{
  e.preventDefault();
  const p = document.getElementById('actPrice').value;
  const q = document.getElementById('actQty').value;
  const list = document.getElementById('actionsList');
  const existing = Array.from(list.querySelectorAll('.action-row')).map(r=>({
    price: r.querySelector('.actPrice').value,
    qty: r.querySelector('.actQty').value
  }));
  renderActionsList([...existing, { price: p, qty: q }], list);
  document.getElementById('actPrice').value=''; document.getElementById('actQty').value='';
});

async function ensureCustomerAgreementsStore(){
  const db = await openDb();
  if(db.objectStoreNames.contains('customerAgreements')) return;

  db.close();
  const nextVersion = db.version + 1;
  await new Promise((resolve, reject)=>{
    const req = indexedDB.open(db.name, nextVersion);
    req.onupgradeneeded = (ev)=>{
      const upgradeDb = ev.target.result;
      if(!upgradeDb.objectStoreNames.contains('customerAgreements')){
        upgradeDb.createObjectStore('customerAgreements', { keyPath: 'idAuto', autoIncrement: true });
      }
    };
    req.onsuccess = ()=>{
      req.result.close();
      resolve(true);
    };
    req.onerror = ()=> reject(req.error);
  });
}

async function getAllCustomerAgreements(){
  await ensureCustomerAgreementsStore();
  return await idbGetAll('customerAgreements');
}

async function addCustomerAgreement(agreement){
  await ensureCustomerAgreementsStore();
  return await idbAdd('customerAgreements', agreement);
}

async function deleteCustomerAgreement(idAuto){
  await ensureCustomerAgreementsStore();
  return await idbDelete('customerAgreements', idAuto);
}

function mapAgreementTypeLabel(type){
  const labels = {
    rhythmus_geaendert: 'Rhythmus geändert',
    komplett_storno: 'Komplett Storno',
    nur_auf_bestellung: 'Nur auf Bestellung',
    urlaub: 'Urlaub',
    sonstiges: 'Sonstiges'
  };
  return labels[type] || type || '—';
}

function mapAgreementTypeClass(type){
  const classes = {
    rhythmus_geaendert: 'agreement-type-rhythmus-geaendert',
    komplett_storno: 'agreement-type-komplett-storno',
    nur_auf_bestellung: 'agreement-type-nur-auf-bestellung',
    urlaub: 'agreement-type-urlaub',
    sonstiges: 'agreement-type-sonstiges'
  };
  return classes[type] || 'agreement-type-sonstiges';
}

function buildAddressSuggestionLabel(agreement){
  const address = [agreement.customerStreet || '', agreement.customerHouseNumber || ''].filter(Boolean).join(' ');
  const city = [agreement.customerPostalCode || '', agreement.customerCity || ''].filter(Boolean).join(' ');
  const customer = [agreement.customerLastName || '', agreement.customerFirstName || ''].filter(Boolean).join(', ');
  return [address, city, customer].filter(Boolean).join(' • ');
}

function fillCustomerAgreementForm(agreement){
  if(!agreement) return;
  if(customerNumberInput) customerNumberInput.value = agreement.customerNumber === '—' ? '' : (agreement.customerNumber || '');
  if(customerNameInput) customerNameInput.value = agreement.customerLastName || '';
  if(customerLastNameInput) customerLastNameInput.value = agreement.customerLastName || '';
  if(customerFirstNameInput) customerFirstNameInput.value = agreement.customerFirstName || '';
  if(customerStreetInput) customerStreetInput.value = agreement.customerStreet || '';
  if(customerHouseNumberInput) customerHouseNumberInput.value = agreement.customerHouseNumber || '';
  if(customerPostalCodeInput) customerPostalCodeInput.value = agreement.customerPostalCode || '';
  if(customerCityInput) customerCityInput.value = agreement.customerCity || '';
  if(customerAgreementTypeSelect) customerAgreementTypeSelect.value = agreement.type || 'sonstiges';
  if(customerAgreementSinceInput) customerAgreementSinceInput.value = agreement.since || '';
  if(customerAgreementUntilInput) customerAgreementUntilInput.value = agreement.until || '';
  if(customerAgreementNoteInput) customerAgreementNoteInput.value = agreement.note || '';
}

async function renderCustomerAddressSuggestions(query = ''){
  if(!customerAddressSuggestions) return;
  const agreements = await getAllCustomerAgreements();
  const needle = query.trim().toLowerCase();

  const matched = agreements.filter(agreement => {
    if(!needle) return true;
    return buildAddressSuggestionLabel(agreement).toLowerCase().includes(needle);
  }).slice(0, 20);

  customerAddressSuggestionMap.clear();
  customerAddressSuggestions.innerHTML = '';
  matched.forEach(agreement => {
    const label = buildAddressSuggestionLabel(agreement);
    if(!label) return;
    customerAddressSuggestionMap.set(label, agreement);
    const option = document.createElement('option');
    option.value = label;
    customerAddressSuggestions.appendChild(option);
  });
}

function clearCustomerAgreementForm(){
  editingCustomerAgreementId = null;
  if(customerNumberInput) customerNumberInput.value = '';
  if(customerNameInput) customerNameInput.value = '';
  if(customerLastNameInput) customerLastNameInput.value = '';
  if(customerFirstNameInput) customerFirstNameInput.value = '';
  if(customerStreetInput) customerStreetInput.value = '';
  if(customerHouseNumberInput) customerHouseNumberInput.value = '';
  if(customerPostalCodeInput) customerPostalCodeInput.value = '';
  if(customerCityInput) customerCityInput.value = '';
  if(customerAgreementTypeSelect) customerAgreementTypeSelect.value = 'rhythmus_geaendert';
  if(customerAgreementSinceInput) customerAgreementSinceInput.value = '';
  if(customerAgreementUntilInput) customerAgreementUntilInput.value = '';
  if(customerAgreementNoteInput) customerAgreementNoteInput.value = '';
  if(customerAddressSearchInput) customerAddressSearchInput.value = '';
  if(saveCustomerAgreementBtn){
    saveCustomerAgreementBtn.textContent = '💾';
    saveCustomerAgreementBtn.setAttribute('aria-label', 'Absprache speichern');
    saveCustomerAgreementBtn.setAttribute('title', 'Absprache speichern');
  }
}

async function printCustomerAgreements(){
  const agreements = await getAllCustomerAgreements();
  agreements.sort((a,b)=>{
    const lastNameCompare = (a.customerLastName || '').localeCompare((b.customerLastName || ''), 'de', { sensitivity: 'base' });
    if(lastNameCompare !== 0) return lastNameCompare;

    const firstNameCompare = (a.customerFirstName || '').localeCompare((b.customerFirstName || ''), 'de', { sensitivity: 'base' });
    if(firstNameCompare !== 0) return firstNameCompare;

    const numberCompare = String(a.customerNumber || '').localeCompare(String(b.customerNumber || ''), 'de', { numeric: true, sensitivity: 'base' });
    if(numberCompare !== 0) return numberCompare;

    return (a.since || '').localeCompare((b.since || ''));
  });

  const printWindow = window.open('', '_blank');
  if(!printWindow){
    alert('Drucken wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben.');
    return;
  }

  const rows = agreements.map(agreement => {
    const fullName = `${agreement.customerLastName || '—'}, ${agreement.customerFirstName || '—'}`;
    const address = [
      [agreement.customerStreet || '', agreement.customerHouseNumber || ''].filter(Boolean).join(' '),
      [agreement.customerPostalCode || '', agreement.customerCity || ''].filter(Boolean).join(' ')
    ].filter(Boolean).join(', ') || '—';

    return `<tr>
      <td>${sanitizeForPdf(agreement.customerNumber || '—')}</td>
      <td>${sanitizeForPdf(fullName)}</td>
      <td>${sanitizeForPdf(address)}</td>
      <td>${sanitizeForPdf(mapAgreementTypeLabel(agreement.type))}</td>
      <td>${sanitizeForPdf(agreement.since ? new Date(agreement.since).toLocaleDateString('de-DE') : '—')}</td>
      <td>${sanitizeForPdf(agreement.until ? new Date(agreement.until).toLocaleDateString('de-DE') : 'offen')}</td>
      <td class="note-cell">${sanitizeForPdf(agreement.note || '')}</td>
    </tr>`;
  });

  const rowsPerPage = 24;
  const rowChunks = [];
  for(let i = 0; i < rows.length; i += rowsPerPage){
    rowChunks.push(rows.slice(i, i + rowsPerPage));
  }

  if(!rowChunks.length){
    rowChunks.push(['<tr><td colspan="7">Keine Kundenabsprachen vorhanden.</td></tr>']);
  }

  const totalPages = rowChunks.length;
  const pagedTables = rowChunks.map((chunk, index) => `
    <section class="print-page">
      <table>
        <thead>
          <tr>
            <th>Kundennr.</th>
            <th>Name</th>
            <th>Adresse</th>
            <th>Absprache</th>
            <th>Gültig ab</th>
            <th>Bis</th>
            <th>Notiz</th>
          </tr>
        </thead>
        <tbody>
          ${chunk.join('')}
        </tbody>
      </table>
      <footer>Seite ${index + 1} von ${totalPages}</footer>
    </section>
  `).join('');

  printWindow.document.write(`<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>Kundenliste</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
    h1 { margin: 0 0 8px; font-size: 20px; }
    p { margin: 0 0 16px; color: #555; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
    th, td {
      border: 1px solid #bbb;
      padding: 6px;
      text-align: left;
      vertical-align: top;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    tr { break-inside: avoid-page; page-break-inside: avoid; }
    .note-cell { white-space: pre-wrap; }
    th { background: #f0f0f0; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    .print-page { break-after: page; page-break-after: always; }
    .print-page:last-of-type { break-after: auto; page-break-after: auto; }
    footer { margin-top: 6px; text-align: right; color: #666; font-size: 11px; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>Kundenliste</h1>
  <p>Stand: ${new Date().toLocaleString('de-DE')}</p>
  ${pagedTables}
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function renderCustomerAgreements(){
  if(!customerAgreementsList) return;
  const agreements = await getAllCustomerAgreements();
  if(!agreements.length){
    customerAgreementsList.innerHTML = '<div class="muted">Noch keine Kundenabsprachen gespeichert.</div>';
    return;
  }

  agreements.sort((a,b)=>{
    const lastNameCompare = (a.customerLastName || '').localeCompare((b.customerLastName || ''), 'de', { sensitivity: 'base' });
    if(lastNameCompare !== 0) return lastNameCompare;

    const firstNameCompare = (a.customerFirstName || '').localeCompare((b.customerFirstName || ''), 'de', { sensitivity: 'base' });
    if(firstNameCompare !== 0) return firstNameCompare;

    const numberCompare = String(a.customerNumber || '').localeCompare(String(b.customerNumber || ''), 'de', { numeric: true, sensitivity: 'base' });
    if(numberCompare !== 0) return numberCompare;

    return (a.since || '').localeCompare((b.since || ''));
  });

  customerAgreementsList.innerHTML = '';
  agreements.forEach(agreement=>{
    const card = document.createElement('div');
    card.className = 'customer-agreement-card';

    const topRow = document.createElement('div');
    topRow.className = 'customer-agreement-top-row';

    const title = document.createElement('div');
    title.className = 'customer-agreement-title';
    title.textContent = `${agreement.customerNumber || '—'} · ${agreement.customerLastName || '—'}, ${agreement.customerFirstName || '—'}`;

    const typeBadge = document.createElement('span');
    typeBadge.className = `agreement-type-badge ${mapAgreementTypeClass(agreement.type)}`;
    typeBadge.textContent = mapAgreementTypeLabel(agreement.type);

    topRow.append(title, typeBadge);

    const meta = document.createElement('div');
    meta.className = 'customer-agreement-meta';
    const sinceLabel = agreement.since ? new Date(agreement.since).toLocaleDateString('de-DE') : '—';
    const untilLabel = agreement.until ? new Date(agreement.until).toLocaleDateString('de-DE') : 'offen';
    meta.textContent = `${sinceLabel} bis ${untilLabel}`;

    const note = document.createElement('div');
    note.className = 'customer-agreement-note';
    const addressParts = [
      agreement.customerStreet || '',
      agreement.customerHouseNumber || ''
    ].filter(Boolean);
    const cityParts = [agreement.customerPostalCode || '', agreement.customerCity || ''].filter(Boolean);
    note.textContent = [
      addressParts.join(' '),
      cityParts.join(' '),
      agreement.note || 'Keine Notiz'
    ].filter(Boolean).join(' • ');

    const controls = document.createElement('div');
    controls.className = 'customer-agreement-controls';

    const editBtn = document.createElement('button');
    editBtn.className = 'small';
    editBtn.type = 'button';
    editBtn.textContent = '✏️';
    editBtn.setAttribute('aria-label', 'Bearbeiten');
    editBtn.setAttribute('title', 'Bearbeiten');
    editBtn.addEventListener('click', ()=>{
      editingCustomerAgreementId = agreement.idAuto;
      fillCustomerAgreementForm(agreement);
      if(saveCustomerAgreementBtn){
        saveCustomerAgreementBtn.textContent = '💾';
        saveCustomerAgreementBtn.setAttribute('aria-label', 'Absprache aktualisieren');
        saveCustomerAgreementBtn.setAttribute('title', 'Absprache aktualisieren');
      }
      setActiveSection('sectionCustomers');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'small';
    deleteBtn.type = 'button';
    deleteBtn.textContent = '🗑️';
    deleteBtn.setAttribute('aria-label', 'Löschen');
    deleteBtn.setAttribute('title', 'Löschen');
    deleteBtn.addEventListener('click', async ()=>{
      if(!confirm('Diese Kundenabsprache löschen?')) return;
      await deleteCustomerAgreement(agreement.idAuto);
      await renderCustomerAgreements();
      await renderCustomerAddressSuggestions('');
      await triggerAutoBackup('customer_agreement_deleted');
    });
    controls.appendChild(editBtn);
    controls.appendChild(deleteBtn);

    card.append(topRow, meta, note, controls);
    customerAgreementsList.appendChild(card);
  });
}

/* ========== Data-Operationen via IndexedDB ========== */
async function saveTourObj(t){
  if(!t.period){
    const d = new Date(t.date || new Date().toISOString().slice(0,10));
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = d.getFullYear();
    t.period = `${yy}-${mm}`;
  }
  await idbAdd('tours', t);
  await triggerAutoBackup('tour_saved');
  await renderTours();
}
async function getAllTours(){
  return await idbGetAll('tours');
}
async function clearAllData(){
  await idbClear('tours'); await idbClear('conf'); await idbClear('backups'); await idbClear('customerAgreements');
  localStorage.removeItem('provision_tours_v3');
  localStorage.removeItem('provision_conf_v3');
}
async function saveConf(k, v){
  await idbPut('conf', { k: k, v: v });
  await triggerAutoBackup('conf_saved');
}
async function loadConfObj(){
  const all = await idbGetAll('conf');
  const map = {};
  all.forEach(x=> map[x.k] = x.v);
  const childrenStatus = deriveChildrenStatusFromConfig(map.netConfig || {});
  const childrenCount = childrenCountForStatus(childrenStatus);
  return {
    // Feste Werte
    baseSalary: Number(map.baseSalaryDefault ?? 2500),
    newBase: 30,
    newThreshold: Number(map.newThreshold || 4),
    newHigh: 60,
    integrationAmount: 10,
    spKleider: 1.2,
    spAuslagen: 10,
    lostCustomersAvg: Number(map.lostCustomersAvg || 0),
    lostCustomersPerMonth: (()=>{
      const perMonth = { ...(map.lostCustomersPerMonth || {}) };
      if(Object.keys(perMonth).length === 0 && map.lostCustomersAvg !== undefined){
        const today = new Date();
        const mm = String(today.getMonth()+1).padStart(2,'0');
        perMonth[`${today.getFullYear()}-${mm}`] = Number(map.lostCustomersAvg || 0);
      }
      return perMonth;
    })(),
    paprovPerMonth: (map.paprovPerMonth || {}),
    baseSalaryPerMonth: (map.baseSalaryPerMonth || {}),
    heimschlaeferPerMonth: (map.heimschlaeferPerMonth || {}),
    netConfig: {
      taxClass: map.netConfig?.taxClass || 'I',
      state: map.netConfig?.state || 'NW',
      churchTax: map.netConfig?.churchTax ?? false,
      kvType: map.netConfig?.kvType || 'gesetzlich',
      kvZusatz: Number(map.netConfig?.kvZusatz ?? 2.45),
      kvFlatRate: Number(map.netConfig?.kvFlatRate || 0),
      hasKids: childrenCount > 0,
      childrenStatus,
      childrenCount,
      age: Number(map.netConfig?.age || 30),
      bavMonthly: Number(map.netConfig?.bavMonthly || 0),
      rvRate: map.netConfig?.rvRate ?? 0.093,
      avRate: map.netConfig?.avRate ?? 0.013,
      pvRate: map.netConfig?.pvRate ?? 0.018,
      taxYear: Number(map.netConfig?.taxYear || new Date().getFullYear())
    }
  };
}

function getBaseSalaryForPeriod(conf, period){
  if(conf.baseSalaryPerMonth && conf.baseSalaryPerMonth[period] !== undefined){
    return Number(conf.baseSalaryPerMonth[period]);
  }
  return Number(conf.baseSalary || 0);
}

function getLostCustomersForPeriod(conf, period){
  if(conf.lostCustomersPerMonth && conf.lostCustomersPerMonth[period] !== undefined){
    return Number(conf.lostCustomersPerMonth[period]);
  }
  if(conf.lostCustomersAvg !== undefined){
    return Number(conf.lostCustomersAvg);
  }
  return 0;
}

function getHeimschlaeferForPeriod(conf, period){
  const entry = conf.heimschlaeferPerMonth?.[period];
  if(!entry) return { enabled: false, netto: 0 };
  if(typeof entry === 'number'){
    return { enabled: entry > 0, netto: Number(entry) };
  }
  return { enabled: !!entry.enabled, netto: Number(entry.netto || 0) };
}

async function populateSettingsSection(){
  const conf = await loadConfObj();
  const yy = selectYear.value;
  const mm = selectMonth.value;
  const curPeriod = `${yy}-${mm}`;
  paprovMonth.value = curPeriod;
  document.getElementById('paprovValue').value = (conf.paprovPerMonth && conf.paprovPerMonth[curPeriod] !== undefined)
    ? conf.paprovPerMonth[curPeriod]
    : 0;
  document.getElementById('lostCustomersMonth').value = curPeriod;
  document.getElementById('lostCustomersValue').value = getLostCustomersForPeriod(conf, curPeriod);
  if(baseSalaryMonth){
    baseSalaryMonth.value = curPeriod;
    document.getElementById('baseSalaryValue').value = getBaseSalaryForPeriod(conf, curPeriod);
  }
  if(heimschlaeferMonth){
    const heimschlaefer = getHeimschlaeferForPeriod(conf, curPeriod);
    heimschlaeferMonth.value = curPeriod;
    document.getElementById('heimschlaeferEnabled').checked = heimschlaefer.enabled;
    document.getElementById('heimschlaeferNetto').value = heimschlaefer.netto;
  }
  const taxYearInput = document.getElementById('netTaxYear');
  if(taxYearInput) taxYearInput.value = yy || conf.netConfig.taxYear || new Date().getFullYear();
  document.getElementById('netBav').value = conf.netConfig.bavMonthly || 0;
  document.getElementById('netTaxClass').value = conf.netConfig.taxClass;
  document.getElementById('netState').value = conf.netConfig.state;
  document.getElementById('netChurch').value = conf.netConfig.churchTax ? 'yes' : 'no';
  document.getElementById('netKvType').value = conf.netConfig.kvType || 'gesetzlich';
  const kvFundSelect = document.getElementById('netKvFund');
  if(kvFundSelect){
    const match = Array.from(kvFundSelect.options).find(o=> Number(o.value) === Number(conf.netConfig.kvZusatz));
    kvFundSelect.value = match ? match.value : 'custom';
  }
  document.getElementById('netKvZusatz').value = conf.netConfig.kvZusatz;
  document.getElementById('netKvFlatRate').value = conf.netConfig.kvFlatRate || 0;
  document.getElementById('netKids').value = conf.netConfig.childrenStatus || 'one_child';
  document.getElementById('netAge').value = conf.netConfig.age || '';
  const pvSurchargeField = document.getElementById('netPvSurcharge');
  if(pvSurchargeField) pvSurchargeField.value = `${((conf.netConfig.pvSurchargeRate ?? 0.006)*100).toFixed(2)}%`;
  document.getElementById('netRvRate').value = conf.netConfig.rvRate ?? 0.093;
  document.getElementById('netAvRate').value = conf.netConfig.avRate ?? 0.013;
}

/* Migration von localStorage (falls noch alte Daten) */
async function migrateFromLocalStorageIfPresent(){
  const tRaw = localStorage.getItem('provision_tours_v3') || localStorage.getItem('provision_tours_v2') || localStorage.getItem('provision_tours_v1');
  const cRaw = localStorage.getItem('provision_conf_v3') || localStorage.getItem('provision_conf_v2');
  if(tRaw){
    try{
      const arr = JSON.parse(tRaw);
      if(Array.isArray(arr)){
        for(const t of arr){
          await idbAdd('tours', t);
        }
      }
      localStorage.removeItem('provision_tours_v3');
    }catch(e){}
  }
  if(cRaw){
    try{
      const cObj = JSON.parse(cRaw);
      if(typeof cObj === 'object'){
        const keys = ['lostCustomersPerMonth','paprovPerMonth'];
        for(const k of keys){
          if(cObj[k] !== undefined) await idbPut('conf', { k: k, v: cObj[k] });
        }
        if(cObj.lostCustomersAvg !== undefined && cObj.lostCustomersPerMonth === undefined){
          const today = new Date();
          const mm = String(today.getMonth()+1).padStart(2,'0');
          await idbPut('conf', { k: 'lostCustomersPerMonth', v: { [`${today.getFullYear()}-${mm}`]: Number(cObj.lostCustomersAvg || 0) } });
        }
      }
      localStorage.removeItem('provision_conf_v3');
    }catch(e){}
  }
}

/* ========== Auto-Backup (lokal) ========== */
let autoBackupTimeout = null;
async function triggerAutoBackup(reason){
  if(autoBackupTimeout) clearTimeout(autoBackupTimeout);
  autoBackupTimeout = setTimeout(async ()=>{
    try{
      const tours = await getAllTours();
      const conf = await loadConfObj();
      const customerAgreements = await getAllCustomerAgreements();
      const payload = {
        ts: new Date().toISOString(),
        reason: reason || null,
        data: { tours, conf, customerAgreements }
      };
      await idbAdd('backups', { ts: payload.ts, payload });
      downloadJson(payload, `backup_provision_${payload.ts.replace(/[:.]/g,'-')}.json`);
    }catch(e){
      console.error('Backup failed', e);
    }
  }, 600);
}

function downloadJson(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

async function loadBackupsList(){
  const list = document.getElementById('backupsList');
  if(!list) return;
  list.innerHTML = '<em>Lade...</em>';
  const all = await idbGetAll('backups');
  if(!all.length){
    list.innerHTML = '<div class="muted">Keine Backups vorhanden</div>';
    return;
  }

  list.innerHTML = '';
  all.sort((a,b)=> b.ts.localeCompare(a.ts));
  all.forEach(b=>{
    const el = document.createElement('div');
    el.style.borderBottom = '1px solid #eef6ff';
    el.style.padding = '8px 4px';
    el.innerHTML = `<div><strong>${b.ts}</strong> <span class="muted" style="margin-left:6px">${(b.payload && b.payload.reason) ? b.payload.reason : ''}</span></div>
                    <div style="margin-top:6px"><button class="small dlBackup">Download</button> <button class="small delBackup">Löschen</button></div>`;
    el.querySelector('.dlBackup').addEventListener('click', ()=> downloadJson(b.payload, `backup_${b.ts.replace(/[:.]/g,'-')}.json`));
    el.querySelector('.delBackup').addEventListener('click', async ()=>{
      if(!confirm('Backup löschen?')) return;
      await idbDelete('backups', b.ts);
      el.remove();
    });
    list.appendChild(el);
  });
}

/* JSON Export/Import */
document.getElementById('exportJson').addEventListener('click', async ()=>{
  const tours = await getAllTours();
  const conf = await loadConfObj();
  const customerAgreements = await getAllCustomerAgreements();
  const payload = { ts: new Date().toISOString(), data: { tours, conf, customerAgreements } };
  downloadJson(payload, `provision_export_${payload.ts.replace(/[:.]/g,'-')}.json`);
});
document.getElementById('importJson').addEventListener('click', ()=> jsonInput.click());
jsonInput.addEventListener('change', async (ev)=>{
  const f = ev.target.files[0]; if(!f) return;
  const text = await f.text();
  try{
    const j = JSON.parse(text);
    if(j && j.data){
      await idbClear('tours'); await idbClear('conf'); await idbClear('customerAgreements');
      const confObj = j.data.conf || {};
      for(const k of Object.keys(confObj)){
        await idbPut('conf', { k: k, v: confObj[k] });
      }
      const arr = j.data.tours || [];
      for(const t of arr){
        delete t.idAuto;
        await idbAdd('tours', t);
      }
      const agreements = Array.isArray(j.data.customerAgreements) ? j.data.customerAgreements : [];
      for(const agreement of agreements){
        const copy = { ...agreement };
        delete copy.idAuto;
        await addCustomerAgreement(copy);
      }
      await renderTours();
      await renderCustomerAgreements();
      alert('JSON importiert und wiederhergestellt ✔');
      await triggerAutoBackup('import_json');
    }else alert('Ungültiges JSON-Format');
  }catch(e){ alert('Fehler beim Lesen der JSON-Datei'); }
  ev.target.value = '';
});

/* CSV Export/Import (mit NK-Rate pro Monat) */
document.getElementById('exportCsv').addEventListener('click', async ()=>{
  const allTours = await getAllTours();
  const conf = await loadConfObj();
  const monthFilter = `${selectYear.value}-${selectMonth.value}`;
  const monthTours = allTours.filter(t=>t.period===monthFilter);
  const totalNKThisMonth = monthTours.reduce((s,t)=> s + Number(t.newC || 0), 0);
  const nkRate = getNeukundenRate(totalNKThisMonth, conf); // € pro NK

  let csv = 'Datum;Tour;Art;Umsatz;Reklamation;Gutscheine;Neukunden;Neukunden€;Integrationen;Integr€;AktionsJSON;AktStk;AktEuro;Vertretung;Fahrt45;Period;PAPROV;Notiz\n';
  monthTours.forEach(t=>{
    const baseCents = toCents(t.amount || 0);
    const reklCents = toCents(t.reklamation || 0);
    const gutsCents = toCents(t.gutscheine || 0);
    const totCents = baseCents + reklCents + gutsCents;
    const nk = computeNeukundenBonusForTourCents(t.newC || 0, totalNKThisMonth, conf);
    const ip = computeIntegrationCents(t.integrations || 0, conf);
    const actionsSum = computeActionSum(t.actions || []);
    const actionsPiece = (t.actions && t.actions.length) ? t.actions.reduce((s,a)=>s+Number(a.qty||0),0) : 0;
    const paprovVal = (t.tourType !== 'tourentag' && conf.paprovPerMonth && conf.paprovPerMonth[t.period]) ? conf.paprovPerMonth[t.period] : 0;
    const actionsJson = JSON.stringify(t.actions || []);
    csv += `${t.date};${t.id};${t.tourType};${fromCents(totCents)};${fromCents(reklCents)};${fromCents(gutsCents)};${t.newC||0};${fromCents(nk)};${t.integrations||0};${fromCents(ip)};"${actionsJson.replace(/"/g,'""')}";${actionsPiece};${actionsSum.toFixed(2)};${t.vertretung?"JA":"NEIN"};${t.fahrt45?"JA":"NEIN"};${t.period};${paprovVal.toFixed(2)};"${(t.note||'').replace(/"/g,'""')}"\n`;
  });
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `touren_${selectYear.value}_${selectMonth.value}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
});

csvInput.addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  if(!file) return;
  const text = await file.text();
  const rows = text.split(/\r?\n/).filter(l=>l.trim());
  if(rows.length < 2){ alert('Keine Daten gefunden'); return; }
  const header = rows[0].split(';').map(h=>h.trim());
  const col = name => header.indexOf(name);
  const idx = { date: col("Datum"), id: col("Tour"), art: col("Art"), umsatz: col("Umsatz"), rekl: col("Reklamation"), guts: col("Gutscheine"), nk: col("Neukunden"), integ: col("Integrationen"), actions: col("AktionsJSON"), vert: col("Vertretung"), f45: col("Fahrt45"), per: col("Period"), note: col("Notiz") };
  for(let i=1;i<rows.length;i++){
    const parts = rows[i].split(';');
    if(parts.length < 2) continue;
    let actions = [];
    if(idx.actions >= 0 && parts[idx.actions]){
      let raw = parts[idx.actions].trim();
      if(raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1,-1).replace(/""/g,'"');
      try { actions = JSON.parse(raw); } catch(e){
        try {
          const cleaned = raw.replace(/"/g,'');
          const parts2 = cleaned.split('|');
          parts2.forEach(p=>{
            const m = p.match(/(\d+)\s*x\s*([\d.,]+)/);
            if(m) actions.push({ qty: Number(m[1]), price: Number(m[2].replace(',','.')) });
          });
        } catch(_) { actions = []; }
      }
    }
    const t = {
      date: parts[idx.date] || new Date().toISOString().slice(0,10),
      id: parts[idx.id] || '—',
      tourType: parts[idx.art] || 'tourentag',
      amount: Number((parts[idx.umsatz] || '0').replace(',','.')) || 0,
      reklamation: Number((parts[idx.rekl] || '0').replace(',','.')) || 0,
      gutscheine: Number((parts[idx.guts] || '0').replace(',','.')) || 0,
      newC: Number(parts[idx.nk] || 0),
      integrations: Number(parts[idx.integ] || 0),
      actions: actions,
      vertretung: (parts[idx.vert] || '').toUpperCase() === 'JA',
      fahrt45: (parts[idx.f45] || '').toUpperCase() === 'JA',
      period: parts[idx.per] || `${selectYear.value}-${selectMonth.value}`,
      note: parts[idx.note] || ''
    };
    await idbAdd('tours', t);
  }
  await renderTours();
  alert('Import abgeschlossen ✔');
  ev.target.value = '';
  await triggerAutoBackup('csv_import');
});

/* ========== Tour aus Formular speichern ========== */
document.getElementById('addBtn').addEventListener('click', async ()=>{
  const month = selectMonth.value;
  const year = selectYear.value;
  const t = {
    id: document.getElementById('tourId').value || '—',
    date: document.getElementById('date').value || new Date().toISOString().slice(0,10),
    amount: Number(document.getElementById('amount').value || 0),
    reklamation: Number(document.getElementById('reklamation').value || 0),
    gutscheine: Number(document.getElementById('gutscheine').value || 0),
    newC: Number(document.getElementById('newCustomers').value || 0),
    integrations: Number(document.getElementById('integrations').value || 0),
    schooldayCustomers: Number(document.getElementById('schooldayCustomers').value || 0),
    prevDayUnreachable: Number(document.getElementById('prevDayUnreachable').value || 0),
    buyingCustomers: Number(document.getElementById('buyingCustomers').value || 0),
    tourdayNi: Number(document.getElementById('tourdayNi').value || 0),
    tourdayKb: Number(document.getElementById('tourdayKb').value || 0),
    integrationBought: Number(document.getElementById('integrationBought').value || 0),
    integrationUnreachable: Number(document.getElementById('integrationUnreachable').value || 0),
    integrationNoNeed: Number(document.getElementById('integrationNoNeed').value || 0),
    integrationCancelled: Number(document.getElementById('integrationCancelled').value || 0),
    integrationPreordered: Number(document.getElementById('integrationPreordered').value || 0),
    threeCustomersTotal: Number(document.getElementById('threeCustomersTotal').value || 0),
    threeCustomersBought: Number(document.getElementById('threeCustomersBought').value || 0),
    threeCustomersNi: Number(document.getElementById('threeCustomersNi').value || 0),
    threeCustomersKb: Number(document.getElementById('threeCustomersKb').value || 0),
    threeCustomersCancelled: Number(document.getElementById('threeCustomersCancelled').value || 0),
    threeCustomersPreordered: Number(document.getElementById('threeCustomersPreordered').value || 0),
    tourType: document.getElementById('tourType').value,
    vertretung: document.getElementById('vertretung').checked,
    fahrt45: document.getElementById('fahrt45').checked,
    note: document.getElementById('note').value || '',
    actions: Array.from(document.querySelectorAll('#actionsList .action-row')).map(r=>({ price: Number(r.querySelector('.actPrice').value||0), qty: Number(r.querySelector('.actQty').value||0) })).filter(a=>a.price>0 && a.qty>0),
    period: `${year}-${month}`
  };
  await idbAdd('tours', t);
  document.getElementById('tourId').value=''; document.getElementById('amount').value='';
  document.getElementById('reklamation').value='0.00'; document.getElementById('gutscheine').value='0.00';
  document.getElementById('newCustomers').value=0; document.getElementById('integrations').value=0;
  document.getElementById('schooldayCustomers').value=0; document.getElementById('prevDayUnreachable').value=0;
  document.getElementById('buyingCustomers').value=0; document.getElementById('tourdayNi').value=0; document.getElementById('tourdayKb').value=0; document.getElementById('integrationBought').value=0;
  document.getElementById('integrationUnreachable').value=0; document.getElementById('integrationNoNeed').value=0;
  document.getElementById('integrationCancelled').value=0; document.getElementById('integrationPreordered').value=0;
  document.getElementById('threeCustomersTotal').value=0; document.getElementById('threeCustomersBought').value=0; document.getElementById('threeCustomersNi').value=0;
  document.getElementById('threeCustomersKb').value=0; document.getElementById('threeCustomersCancelled').value=0; document.getElementById('threeCustomersPreordered').value=0;
  document.getElementById('note').value=''; renderActionsList([]);
  document.getElementById('vertretung').checked=false; document.getElementById('fahrt45').checked=false;
  await renderTours();
  await triggerAutoBackup('tour_added');
});

/* Formular leeren */
document.getElementById('clearBtn').addEventListener('click', ()=>{
  document.getElementById('tourId').value=''; document.getElementById('amount').value='';
  document.getElementById('reklamation').value='0.00'; document.getElementById('gutscheine').value='0.00';
  document.getElementById('newCustomers').value=0; document.getElementById('integrations').value=0;
  document.getElementById('schooldayCustomers').value=0; document.getElementById('prevDayUnreachable').value=0;
  document.getElementById('buyingCustomers').value=0; document.getElementById('tourdayNi').value=0; document.getElementById('tourdayKb').value=0; document.getElementById('integrationBought').value=0;
  document.getElementById('integrationUnreachable').value=0; document.getElementById('integrationNoNeed').value=0;
  document.getElementById('integrationCancelled').value=0; document.getElementById('integrationPreordered').value=0;
  document.getElementById('threeCustomersTotal').value=0; document.getElementById('threeCustomersBought').value=0; document.getElementById('threeCustomersNi').value=0;
  document.getElementById('threeCustomersKb').value=0; document.getElementById('threeCustomersCancelled').value=0; document.getElementById('threeCustomersPreordered').value=0;
  document.getElementById('note').value=''; renderActionsList([]);
  document.getElementById('vertretung').checked=false; document.getElementById('fahrt45').checked=false;
});

saveCustomerAgreementBtn = document.getElementById('saveCustomerAgreement');
if(saveCustomerAgreementBtn){
  saveCustomerAgreementBtn.addEventListener('click', async ()=>{
    const customerNumber = (customerNumberInput?.value || '').trim();
    const legacyCustomerName = (customerNameInput?.value || '').trim();
    let customerLastName = (customerLastNameInput?.value || '').trim();
    let customerFirstName = (customerFirstNameInput?.value || '').trim();
    const customerStreet = (customerStreetInput?.value || '').trim();
    const customerHouseNumber = (customerHouseNumberInput?.value || '').trim();
    const customerPostalCode = (customerPostalCodeInput?.value || '').trim();
    const customerCity = (customerCityInput?.value || '').trim();

    // Kompatibilität mit älteren Formularversionen, die nur ein customerName-Feld hatten.
    if(!customerLastName && legacyCustomerName) customerLastName = legacyCustomerName;

    const missingFields = [];
    if(!customerLastName && !customerFirstName) missingFields.push('Kundenname');
    if(!customerStreet) missingFields.push('Straße');
    if(!customerHouseNumber) missingFields.push('Hausnummer');
    if(!customerPostalCode) missingFields.push('PLZ');
    if(!customerCity) missingFields.push('Ort');

    if(missingFields.length){
      alert(`Bitte folgende Angaben ergänzen: ${missingFields.join(', ')}.`);
      return;
    }

    const agreement = {
      idAuto: editingCustomerAgreementId || undefined,
      customerNumber: customerNumber || '—',
      customerLastName,
      customerFirstName,
      customerStreet,
      customerHouseNumber,
      customerPostalCode,
      customerCity,
      type: customerAgreementTypeSelect?.value || 'sonstiges',
      since: customerAgreementSinceInput?.value || '',
      until: customerAgreementUntilInput?.value || '',
      note: (customerAgreementNoteInput?.value || '').trim(),
      createdAt: new Date().toISOString()
    };

    if(editingCustomerAgreementId){
      const previous = (await getAllCustomerAgreements()).find(item => item.idAuto === editingCustomerAgreementId);
      agreement.createdAt = previous?.createdAt || agreement.createdAt;
      agreement.updatedAt = new Date().toISOString();
      await idbPut('customerAgreements', agreement);
    } else {
      delete agreement.idAuto;
      await addCustomerAgreement(agreement);
    }

    clearCustomerAgreementForm();
    await renderCustomerAgreements();
    await renderCustomerAddressSuggestions('');
    await triggerAutoBackup('customer_agreement_saved');
  });
}


if(customerAddressSearchInput){
  customerAddressSearchInput.addEventListener('focus', ()=>{
    renderCustomerAddressSuggestions(customerAddressSearchInput.value || '').catch(err => console.error('Adressvorschläge laden fehlgeschlagen', err));
  });
  customerAddressSearchInput.addEventListener('input', ()=>{
    renderCustomerAddressSuggestions(customerAddressSearchInput.value || '').catch(err => console.error('Adressvorschläge laden fehlgeschlagen', err));
  });
  customerAddressSearchInput.addEventListener('change', ()=>{
    const agreement = customerAddressSuggestionMap.get(customerAddressSearchInput.value || '');
    if(!agreement) return;
    fillCustomerAgreementForm(agreement);
  });
}

const clearCustomerAgreementFormBtn = document.getElementById('clearCustomerAgreementForm');
if(clearCustomerAgreementFormBtn){
  clearCustomerAgreementFormBtn.addEventListener('click', ()=> clearCustomerAgreementForm());
}

printCustomerListBtn = document.getElementById('printCustomerList');
if(printCustomerListBtn){
  printCustomerListBtn.addEventListener('click', ()=>{
    printCustomerAgreements().catch(err => {
      console.error('Kundenliste drucken fehlgeschlagen', err);
      alert('Kundenliste konnte nicht gedruckt werden.');
    });
  });
}

/* Settings speichern (nur verlorene Kunden) */
const netKvFundSelect = document.getElementById('netKvFund');
if(netKvFundSelect){
  netKvFundSelect.addEventListener('change', ()=>{
    if(netKvFundSelect.value !== 'custom'){
      document.getElementById('netKvZusatz').value = netKvFundSelect.value;
    }
  });
}

document.getElementById('saveSettings').addEventListener('click', async ()=>{
  const kvFundSelect = document.getElementById('netKvFund');
  const selectedKv = kvFundSelect ? kvFundSelect.value : 'custom';
  const kvZusatz = selectedKv !== 'custom' ? Number(selectedKv) : Number(document.getElementById('netKvZusatz').value || 0);
  const childrenStatus = document.getElementById('netKids').value;
  const childrenCount = childrenCountForStatus(childrenStatus);
  const netConfig = {
    taxClass: document.getElementById('netTaxClass').value,
    state: document.getElementById('netState').value,
    churchTax: document.getElementById('netChurch').value === 'yes',
    kvType: document.getElementById('netKvType').value,
    kvZusatz: kvZusatz,
    kvFlatRate: Number(document.getElementById('netKvFlatRate').value || 0),
    hasKids: childrenCount > 0,
    childrenStatus,
    childrenCount,
    age: Number(document.getElementById('netAge').value || 0),
    bavMonthly: Number(document.getElementById('netBav').value || 0),
    pvSurchargeRate: 0.006,
    rvRate: Number(document.getElementById('netRvRate').value || 0.093),
    avRate: Number(document.getElementById('netAvRate').value || 0.013),
    taxYear: Number(document.getElementById('netTaxYear').value || selectYear.value || new Date().getFullYear())
  };
  await saveConf('netConfig', netConfig);
  alert('Einstellungen gespeichert.');
  await renderTours();
  await triggerAutoBackup('settings_saved');
});

/* Grundgehalt speichern/löschen */
const saveBaseSalaryBtn = document.getElementById('saveBaseSalary');
if(saveBaseSalaryBtn){
  saveBaseSalaryBtn.addEventListener('click', async ()=>{
    const key = document.getElementById('baseSalaryMonth').value;
    const v = Number(document.getElementById('baseSalaryValue').value || 0);
    const conf = await loadConfObj();
    conf.baseSalaryPerMonth = conf.baseSalaryPerMonth || {};
    conf.baseSalaryPerMonth[key] = v;
    await saveConf('baseSalaryPerMonth', conf.baseSalaryPerMonth);
    alert('Grundgehalt gespeichert.');
    await renderTours();
    await triggerAutoBackup('base_salary_saved');
  });
}

const clearBaseSalaryBtn = document.getElementById('clearBaseSalary');
if(clearBaseSalaryBtn){
  clearBaseSalaryBtn.addEventListener('click', async ()=>{
    const key = document.getElementById('baseSalaryMonth').value;
    const conf = await loadConfObj();
    conf.baseSalaryPerMonth = conf.baseSalaryPerMonth || {};
    delete conf.baseSalaryPerMonth[key];
    await saveConf('baseSalaryPerMonth', conf.baseSalaryPerMonth);
    document.getElementById('baseSalaryValue').value = '';
    alert('Grundgehalt gelöscht.');
    await renderTours();
    await triggerAutoBackup('base_salary_cleared');
  });
}

const baseSalaryMonthSelect = document.getElementById('baseSalaryMonth');
if(baseSalaryMonthSelect){
  baseSalaryMonthSelect.addEventListener('change', async ()=>{
    const conf = await loadConfObj();
    const key = document.getElementById('baseSalaryMonth').value;
    document.getElementById('baseSalaryValue').value = getBaseSalaryForPeriod(conf, key);
  });
}

/* Heimschläfer speichern/löschen */
const saveHeimschlaeferBtn = document.getElementById('saveHeimschlaefer');
if(saveHeimschlaeferBtn){
  saveHeimschlaeferBtn.addEventListener('click', async ()=>{
    const key = document.getElementById('heimschlaeferMonth').value;
    const netto = Number(document.getElementById('heimschlaeferNetto').value || 0);
    const enabled = document.getElementById('heimschlaeferEnabled').checked;
    const conf = await loadConfObj();
    conf.heimschlaeferPerMonth = conf.heimschlaeferPerMonth || {};
    conf.heimschlaeferPerMonth[key] = { enabled, netto };
    await saveConf('heimschlaeferPerMonth', conf.heimschlaeferPerMonth);
    alert('Heimschläfer-Wert gespeichert.');
    await renderTours();
    await triggerAutoBackup('heimschlaefer_saved');
  });
}

const clearHeimschlaeferBtn = document.getElementById('clearHeimschlaefer');
if(clearHeimschlaeferBtn){
  clearHeimschlaeferBtn.addEventListener('click', async ()=>{
    const key = document.getElementById('heimschlaeferMonth').value;
    const conf = await loadConfObj();
    conf.heimschlaeferPerMonth = conf.heimschlaeferPerMonth || {};
    delete conf.heimschlaeferPerMonth[key];
    await saveConf('heimschlaeferPerMonth', conf.heimschlaeferPerMonth);
    document.getElementById('heimschlaeferNetto').value = '';
    document.getElementById('heimschlaeferEnabled').checked = false;
    alert('Heimschläfer-Wert gelöscht.');
    await renderTours();
    await triggerAutoBackup('heimschlaefer_cleared');
  });
}

const heimschlaeferMonthSelect = document.getElementById('heimschlaeferMonth');
if(heimschlaeferMonthSelect){
  heimschlaeferMonthSelect.addEventListener('change', async ()=>{
    const conf = await loadConfObj();
    const key = document.getElementById('heimschlaeferMonth').value;
    const heimschlaefer = getHeimschlaeferForPeriod(conf, key);
    document.getElementById('heimschlaeferEnabled').checked = heimschlaefer.enabled;
    document.getElementById('heimschlaeferNetto').value = heimschlaefer.netto;
  });
}

/* PAPROV speichern/löschen */
document.getElementById('savePaprov').addEventListener('click', async ()=>{
  const key = document.getElementById('paprovMonth').value;
  const v = Number(document.getElementById('paprovValue').value || 0);
  const conf = await loadConfObj();
  conf.paprovPerMonth = conf.paprovPerMonth || {};
  conf.paprovPerMonth[key] = v;
  await saveConf('paprovPerMonth', conf.paprovPerMonth);
  alert('PAPROV gespeichert.');
  await renderTours();
  await triggerAutoBackup('paprov_saved');
});
document.getElementById('clearPaprov').addEventListener('click', async ()=>{
  const key = document.getElementById('paprovMonth').value;
  const conf = await loadConfObj();
  conf.paprovPerMonth = conf.paprovPerMonth || {};
  delete conf.paprovPerMonth[key];
  await saveConf('paprovPerMonth', conf.paprovPerMonth);
  document.getElementById('paprovValue').value = '';
  alert('PAPROV gelöscht.');
  await renderTours();
  await triggerAutoBackup('paprov_cleared');
});
document.getElementById('paprovMonth').addEventListener('change', async ()=>{
  const conf = await loadConfObj();
  const pm = document.getElementById('paprovMonth').value;
  document.getElementById('paprovValue').value = (conf.paprovPerMonth && conf.paprovPerMonth[pm] !== undefined) ? conf.paprovPerMonth[pm] : 0;
});

/* Kundenmanagement speichern/löschen */
document.getElementById('saveLostCustomers').addEventListener('click', async ()=>{
  const key = document.getElementById('lostCustomersMonth').value;
  const v = Number(document.getElementById('lostCustomersValue').value || 0);
  const conf = await loadConfObj();
  conf.lostCustomersPerMonth = conf.lostCustomersPerMonth || {};
  conf.lostCustomersPerMonth[key] = v;
  await saveConf('lostCustomersPerMonth', conf.lostCustomersPerMonth);
  alert('Kundenmanagement-Wert gespeichert.');
  await renderTours();
  await triggerAutoBackup('lost_customers_saved');
});
document.getElementById('clearLostCustomers').addEventListener('click', async ()=>{
  const key = document.getElementById('lostCustomersMonth').value;
  const conf = await loadConfObj();
  conf.lostCustomersPerMonth = conf.lostCustomersPerMonth || {};
  delete conf.lostCustomersPerMonth[key];
  await saveConf('lostCustomersPerMonth', conf.lostCustomersPerMonth);
  document.getElementById('lostCustomersValue').value = '';
  alert('Kundenmanagement-Wert gelöscht.');
  await renderTours();
  await triggerAutoBackup('lost_customers_cleared');
});
document.getElementById('lostCustomersMonth').addEventListener('change', async ()=>{
  const conf = await loadConfObj();
  const key = document.getElementById('lostCustomersMonth').value;
  document.getElementById('lostCustomersValue').value = getLostCustomersForPeriod(conf, key);
});

/* Gutscheinanzeige */
function gutscheineDisplay(val){
  const v = Number(val || 0);
  return v > 0 ? fromCents(toCents(v)) : '–';
}

function mapTourTypeLabel(type){
  const labels = {
    tourentag: 'Tourentag',
    werbetag: 'Werbetag',
    neukundentour: 'Neukundentour',
    krank: 'Krank',
    urlaub: 'Urlaub'
  };
  return labels[type] || type || '—';
}

function mapTourTypeClass(type){
  const classes = {
    tourentag: 'tour-type-tourentag',
    werbetag: 'tour-type-werbetag',
    neukundentour: 'tour-type-neukundentour',
    krank: 'tour-type-krank',
    urlaub: 'tour-type-urlaub'
  };
  return classes[type] || 'tour-type-tourentag';
}

/* ========== Render Tours + Summary (mit Sortierung) ========== */
async function renderTours(){
  const tbody = document.querySelector('#toursTable tbody');
  if(tbody) tbody.innerHTML = '';
  const toursBubbleList = document.getElementById('toursBubbleList');
  if(toursBubbleList) toursBubbleList.innerHTML = '';
  const allTours = await getAllTours();
  const conf = await loadConfObj();
  const monthFilter = `${selectYear.value}-${selectMonth.value}`;
  let tours = allTours.filter(t=>t.period === monthFilter);

  // Gesamt-Neukunden im Monat
  const totalNKThisMonth = tours.reduce((s,t)=> s + Number(t.newC || 0), 0);
  const totalNeukCents = computeMonthlyNeukundenBonusCents(totalNKThisMonth, conf);

  // Sortierung anwenden
  if(currentSort.key){
    const dir = currentSort.dir === 'asc' ? 1 : -1;
    const key = currentSort.key;
    tours.sort((a,b)=>{
      function val(t){
        const baseCents = toCents(t.amount||0);
        const reklCents = toCents(t.reklamation||0);
        const gutsCents = toCents(t.gutscheine||0);
        const tourTotalCents = baseCents + reklCents + gutsCents;
        switch(key){
          case 'date': return t.date || '';
          case 'id': return t.id || '';
          case 'tourType': return t.tourType || '';
          case 'total': return tourTotalCents;
          case 'rekl': return toCents(t.reklamation||0);
          case 'gs': return toCents(t.gutscheine||0);
          case 'newC': return Number(t.newC||0);
          case 'integrations': return Number(t.integrations||0);
          case 'actionsCount':
            return (t.actions && t.actions.length) ? t.actions.reduce((s,a)=> s + Number(a.qty||0), 0) : 0;
          case 'actionsEuro':
            return toCents(computeActionSum(t.actions || []));
          default: return 0;
        }
      }
      const va = val(a), vb = val(b);
      if(va < vb) return -1*dir;
      if(va > vb) return 1*dir;
      return 0;
    });
  }

  // Totals
  let totalUmsatzAllCents = 0, totalVGRevenueCents=0, countVGTours=0, countNeukundentouren=0;
  let totalIntegrationCents=0, totalSpesenCents=0, totalActionProvCents=0, totalPaprovCents=0, totalExtrasCents=0;

  for(const t of tours){
    const baseCents = toCents(t.amount || 0);
    const reklCents = toCents(t.reklamation || 0);
    const gutsCents = toCents(t.gutscheine || 0);
    const tourTotalCents = baseCents + reklCents + gutsCents;
    totalUmsatzAllCents += tourTotalCents;

    if(t.tourType === 'tourentag'){
      totalVGRevenueCents += tourTotalCents;
      countVGTours++;
    }
    if(t.tourType === 'neukundentour') countNeukundentouren++;

    totalIntegrationCents += computeIntegrationCents(t.integrations || 0, conf);
    const spC = computeSpesenCentsForTour(t, conf);
    totalSpesenCents += spC;
    totalActionProvCents += computeActionProvisionCents(t.actions || []);

    let extra=0;
    if(t.vertretung) extra += Math.round(tourTotalCents * 0.02);
    if(t.fahrt45) extra += Math.round(tourTotalCents * 0.0025);
    totalExtrasCents += extra;

    if(t.tourType !== 'tourentag'){
      const paprovVal = (conf.paprovPerMonth && conf.paprovPerMonth[t.period]) ? toCents(conf.paprovPerMonth[t.period]) : 0;
      totalPaprovCents += paprovVal;
    }

    const actionsPieceCount = (t.actions && t.actions.length) ? t.actions.reduce((s,a)=> s + Number(a.qty||0), 0) : 0;
    const actionsSumCents = toCents(computeActionSum(t.actions || []));

    const tr = document.createElement('tr');
    const dateDisplay = t.date ? new Date(t.date).toLocaleDateString('de-DE') : '';
    tr.innerHTML = `
      <td>${dateDisplay}</td>
      <td>${t.id}</td>
      <td><span class="tag">${t.tourType}</span></td>
      <td>${fromCents(tourTotalCents)}</td>
      <td>${fromCents(reklCents)}</td>
      <td>${gutscheineDisplay(t.gutscheine)}</td>
      <td>${t.newC || 0}</td>
      <td>${t.integrations || 0}</td>
      <td>${fromCents(spC)}</td>
      <td>${actionsPieceCount}</td>
      <td>${fromCents(actionsSumCents)}</td>
      <td>${t.vertretung ? "✔" : "✖"}</td>
      <td>${t.fahrt45 ? "✔" : "✖"}</td>
      <td>
        <button class="small" data-i="${t.idAuto||''}" data-action="delete" aria-label="Löschen" title="Löschen">🗑️</button>
        <button class="small" data-i="${t.idAuto||''}" data-action="edit" aria-label="Bearbeiten" title="Bearbeiten">✏️</button>
      </td>
    `;
    if(tbody) tbody.appendChild(tr);

    if(toursBubbleList){
      const bubble = document.createElement('div');
      bubble.className = 'tour-bubble-card';

      const topRow = document.createElement('div');
      topRow.className = 'tour-bubble-top-row';

      const dateLabel = t.date ? new Date(t.date).toLocaleDateString('de-DE') : 'Kein Datum';
      const title = document.createElement('div');
      title.className = 'tour-bubble-title';
      title.textContent = `${dateLabel} · ${t.id || '—'}`;

      const typeBadge = document.createElement('span');
      typeBadge.className = `tour-type-badge ${mapTourTypeClass(t.tourType)}`;
      typeBadge.textContent = mapTourTypeLabel(t.tourType);

      topRow.append(title, typeBadge);

      const details = document.createElement('div');
      details.className = 'tour-bubble-details';
      const detailParts = [
        `Umsatz: ${fromCents(tourTotalCents)}`,
        `Rekl.: ${fromCents(reklCents)}`,
        `GS: ${gutscheineDisplay(t.gutscheine)}`,
        `NK: ${t.newC || 0}`,
        `Int.: ${t.integrations || 0}`,
        `Kunden Schultag: ${t.schooldayCustomers || 0}`,
        `Nicht erreicht Vortag: ${t.prevDayUnreachable || 0}`,
        `Kaufende Kunden: ${t.buyingCustomers || 0}`,
        `Tourentag NE/KB: ${t.tourdayNi || 0}/${t.tourdayKb || 0}`,
        `Int.-Status K/NE/KB/A/VB: ${t.integrationBought || 0}/${t.integrationUnreachable || 0}/${t.integrationNoNeed || 0}/${t.integrationCancelled || 0}/${t.integrationPreordered || 0}`,
        `3 Kunden G/K/NE/KB/A/VB: ${t.threeCustomersTotal || 0}/${t.threeCustomersBought || 0}/${t.threeCustomersNi || 0}/${t.threeCustomersKb || 0}/${t.threeCustomersCancelled || 0}/${t.threeCustomersPreordered || 0}`,
        `Spesen: ${fromCents(spC)}`,
        `Akt.: ${actionsPieceCount} (${fromCents(actionsSumCents)})`,
        `Vertretung: ${t.vertretung ? 'Ja' : 'Nein'}`,
        `Entfernung >45 Min: ${t.fahrt45 ? 'Ja' : 'Nein'}`
      ];
      detailParts.forEach(line=>{
        const detailLine = document.createElement('div');
        detailLine.className = 'tour-bubble-detail-line';
        detailLine.textContent = line;
        details.appendChild(detailLine);
      });

      const controls = document.createElement('div');
      controls.className = 'tour-bubble-controls';

      const bubbleDeleteBtn = document.createElement('button');
      bubbleDeleteBtn.className = 'small';
      bubbleDeleteBtn.type = 'button';
      bubbleDeleteBtn.textContent = '🗑️';
      bubbleDeleteBtn.setAttribute('aria-label', 'Löschen');
      bubbleDeleteBtn.setAttribute('title', 'Löschen');
      bubbleDeleteBtn.dataset.i = `${t.idAuto || ''}`;
      bubbleDeleteBtn.dataset.action = 'delete';

      const bubbleEditBtn = document.createElement('button');
      bubbleEditBtn.className = 'small';
      bubbleEditBtn.type = 'button';
      bubbleEditBtn.textContent = '✏️';
      bubbleEditBtn.setAttribute('aria-label', 'Bearbeiten');
      bubbleEditBtn.setAttribute('title', 'Bearbeiten');
      bubbleEditBtn.dataset.i = `${t.idAuto || ''}`;
      bubbleEditBtn.dataset.action = 'edit';

      controls.append(bubbleDeleteBtn, bubbleEditBtn);
      bubble.append(topRow, details, controls);
      toursBubbleList.appendChild(bubble);
    }
  }

  // Buttons löschen/bearbeiten
  if(tbody){
    tbody.querySelectorAll('button[data-action]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const action = btn.dataset.action;
        const key = Number(btn.dataset.i);
        if(action === 'delete'){
          if(!confirm('Tour löschen?')) return;
          await idbDelete('tours', key);
          await renderTours();
          await triggerAutoBackup('tour_deleted');
        } else if(action === 'edit'){
          const all = await idbGetAll('tours');
          const entry = all.find(x=> x.idAuto === key);
          if(!entry) return;
          openEditModalFor(entry, key);
        }
      });
    });
  }

  if(toursBubbleList){
    if(!tours.length){
      toursBubbleList.innerHTML = '<div class="muted">Noch keine Touren für diesen Monat gespeichert.</div>';
    }

    toursBubbleList.querySelectorAll('button[data-action]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const action = btn.dataset.action;
        const key = Number(btn.dataset.i);
        if(action === 'delete'){
          if(!confirm('Tour löschen?')) return;
          await idbDelete('tours', key);
          await renderTours();
          await triggerAutoBackup('tour_deleted');
        } else if(action === 'edit'){
          const all = await idbGetAll('tours');
          const entry = all.find(x=> x.idAuto === key);
          if(!entry) return;
          openEditModalFor(entry, key);
        }
      });
    });
  }

  // Zusammenfassung
  const avgVGEuros = (countVGTours>0) ? (totalVGRevenueCents/100/countVGTours) : 0;
  const vgRate = determineVGRate(avgVGEuros);
  const vgProvisionCents = Math.round(totalVGRevenueCents * vgRate);
  const lostCustomersValue = getLostCustomersForPeriod(conf, monthFilter);
  const rawKm = computeKundenmanagementBonusCents(lostCustomersValue);
  const totalTours = tours.length;
  const relevant = countVGTours + countNeukundentouren;
  const kmBonusCents = Math.round(rawKm * (totalTours>0 ? (relevant/totalTours) : 0));

  const totalProvisionCents = vgProvisionCents + totalNeukCents + totalIntegrationCents + totalActionProvCents + totalPaprovCents + totalExtrasCents + kmBonusCents;
  const baseSalaryCents = toCents(getBaseSalaryForPeriod(conf, monthFilter));
  const monthlyBeforeSpesenCents = Math.max(baseSalaryCents, totalProvisionCents);
  const brutto = monthlyBeforeSpesenCents/100;
  const netResult = computeNetResult(brutto, { ...conf.netConfig, taxYear: Number(selectYear.value) });
  const nettoFromBruttoCents = Math.round(netResult.netto*100);
  const heimschlaefer = getHeimschlaeferForPeriod(conf, monthFilter);
  const heimschlaeferNettoCents = heimschlaefer.enabled ? toCents(heimschlaefer.netto) : 0;
  const payoutNettoCents = heimschlaefer.enabled ? heimschlaeferNettoCents : nettoFromBruttoCents;
  const finalPayoutCents = nettoFromBruttoCents + payoutNettoCents + totalSpesenCents;

  const { rv, av, kv, pv, lohnsteuer, soli, kirche, bav } = netResult.breakdown;

  const summary = document.getElementById('summaryContent');
  summary.innerHTML = '';
  summary.append(
    createSumRow('❯ Arbeitstage', tours.length),
    createSumRow('❯ Tourentage', countVGTours),
    createSumRow('❯ Gesamtumsatz', `€ ${fromCents(totalUmsatzAllCents)}`),
    createSumRow('❯ Tagesumsatz ⌀', `€ ${avgVGEuros.toFixed(2)}`),
    createSumRow('❯ Provisionssatz', `${(vgRate*100).toFixed(2)}%`),
    createSumRow('❯ Provision', `€ ${fromCents(vgProvisionCents)}`),
  );
  summary.appendChild(document.createElement('hr'));
  summary.append(
    createSumRow('❯ Neukunden-Boni', `€ ${fromCents(totalNeukCents)}`),
    createSumRow('❯ Integrationen', `€ ${fromCents(totalIntegrationCents)}`),
    createSumRow('❯ Aktionen (10%)', `€ ${fromCents(totalActionProvCents)}`),
    createSumRow('❯ PAPROV', `€ ${fromCents(totalPaprovCents)}`),
    createSumRow('❯ Zusatzprovision', `€ ${fromCents(totalExtrasCents)}`),
    createSumRow('❯ Kundenmanagement', `€ ${fromCents(kmBonusCents)}`),
  );
  summary.appendChild(document.createElement('hr'));
  summary.append(
    createSumRow('❯ Spesen', `€ ${fromCents(totalSpesenCents)}`),
  );
  summary.appendChild(document.createElement('hr'));
  summary.append(
    createSumRow('❯ Provision', `€ ${fromCents(totalProvisionCents)}`, { emphasize: true }),
    createSumRow('❯ Grundgehalt', `€ ${fromCents(baseSalaryCents)}`),
    createSumRow('❯ Monatsbrutto', `€ ${fromCents(monthlyBeforeSpesenCents)}`, { emphasize: true }),
  );
  summary.appendChild(document.createElement('hr'));
  summary.append(
    createSumRow('Rentenversicherung', `€ ${rv.toFixed(2)}`),
    createSumRow('Arbeitslosenversicherung', `€ ${av.toFixed(2)}`),
    createSumRow('Krankenversicherung', `€ ${kv.toFixed(2)}`),
    createSumRow('Pflegeversicherung', `€ ${pv.toFixed(2)}`),
    createSumRow('Lohnsteuer', `€ ${lohnsteuer.toFixed(2)}`),
    createSumRow('Kirchensteuer', `€ ${kirche.toFixed(2)}`),
    createSumRow('Soli', `€ ${soli.toFixed(2)}`),
    createSumRow('Betriebliche Altersvorsorge', `€ ${bav.toFixed(2)}`),
  );
  summary.appendChild(document.createElement('hr'));
  summary.append(
    createSumRow(heimschlaefer.enabled ? 'Netto' : 'Netto', `€ ${fromCents(nettoFromBruttoCents)}`, { emphasize: true }),
  );
  if(heimschlaefer.enabled){
    summary.append(
      createSumRow('Heimschläfer', `€ ${fromCents(heimschlaeferNettoCents)}`, { emphasize: true })
    );
  }
  summary.append(
    createSumRow('+ Spesen', `€ ${fromCents(totalSpesenCents)}`),
    createSumRow('💰 Auszahlung', `€ ${fromCents(finalPayoutCents)}`, { emphasize: true, style: 'margin-top:12px;font-size:1.1rem' }),
  );

  renderStatsSummary(tours);
}


function formatPercent(value){
  if(!Number.isFinite(value)) return '0,00 %';
  return `${value.toFixed(2).replace('.', ',')} %`;
}

function safeDivide(numerator, denominator){
  if(!Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

function collectTourdayStats(t){
  const kundenAnzahl = Number(t.schooldayCustomers || 0);
  const vortagNe = Number(t.prevDayUnreachable || 0);
  const kauf = Number(t.buyingCustomers || 0);

  const integrationAnzahl = Number(t.integrations || 0);
  const integrationNe = Number(t.integrationUnreachable || 0);
  const integrationKauf = Number(t.integrationBought || 0);

  const d3Anzahl = Number(t.threeCustomersTotal || 0);
  const d3Ne = Number(t.threeCustomersNi || 0);
  const d3Kauf = Number(t.threeCustomersBought || 0);

  const serviceSuccessCount = kundenAnzahl + vortagNe;
  const serviceSuccessRate = safeDivide(serviceSuccessCount, kauf) * 100;

  const integrationsCount = integrationAnzahl - integrationNe;
  const integrationsRate = safeDivide(integrationsCount, integrationKauf) * 100;

  const d3Count = d3Anzahl - d3Ne;
  const d3Rate = safeDivide(d3Count, d3Kauf) * 100;

  return {
    kundenAnzahl,
    vortagNe,
    kauf,
    integrationAnzahl,
    integrationNe,
    integrationKauf,
    d3Anzahl,
    d3Ne,
    d3Kauf,
    serviceSuccessCount,
    serviceSuccessRate,
    integrationsCount,
    integrationsRate,
    d3Count,
    d3Rate,
  };
}

function createStatsGroupTitle(label){
  const title = document.createElement('h4');
  title.textContent = label;
  title.style.margin = '14px 0 8px';
  return title;
}

function renderStatsSummary(tours){
  const statsContent = document.getElementById('statsContent');
  if(!statsContent) return;

  const tourdays = tours
    .filter(t => t.tourType === 'tourentag')
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  const totals = tourdays.reduce((acc, t)=>{
    const stats = collectTourdayStats(t);
    acc.kundenAnzahl += stats.kundenAnzahl;
    acc.vortagNe += stats.vortagNe;
    acc.kauf += stats.kauf;
    acc.integrationAnzahl += stats.integrationAnzahl;
    acc.integrationNe += stats.integrationNe;
    acc.integrationKauf += stats.integrationKauf;
    acc.d3Anzahl += stats.d3Anzahl;
    acc.d3Ne += stats.d3Ne;
    acc.d3Kauf += stats.d3Kauf;
    return acc;
  }, {
    kundenAnzahl: 0,
    vortagNe: 0,
    kauf: 0,
    integrationAnzahl: 0,
    integrationNe: 0,
    integrationKauf: 0,
    d3Anzahl: 0,
    d3Ne: 0,
    d3Kauf: 0,
  });

  const totalServiceSuccessCount = totals.kundenAnzahl + totals.vortagNe;
  const totalServiceSuccessRate = safeDivide(totalServiceSuccessCount, totals.kauf) * 100;
  const totalIntegrationCount = totals.integrationAnzahl - totals.integrationNe;
  const totalIntegrationRate = safeDivide(totalIntegrationCount, totals.integrationKauf) * 100;
  const totalD3Count = totals.d3Anzahl - totals.d3Ne;
  const totalD3Rate = safeDivide(totalD3Count, totals.d3Kauf) * 100;

  statsContent.innerHTML = '';
  statsContent.append(createStatsGroupTitle('Monat gesamt (kumuliert)'));
  statsContent.append(
    createSumRow('❯ Serviceerfolg (Anzahl + Vortag NE) / Kauf', `${totalServiceSuccessCount} / ${totals.kauf} = ${formatPercent(totalServiceSuccessRate)}`),
    createSumRow('❯ Integrationen (Anzahl - NE) / Kauf', `${totalIntegrationCount} / ${totals.integrationKauf} = ${formatPercent(totalIntegrationRate)}`),
    createSumRow('❯ D3 Kunden (Anzahl - NE) / Kauf', `${totalD3Count} / ${totals.d3Kauf} = ${formatPercent(totalD3Rate)}`),
  );

  statsContent.appendChild(document.createElement('hr'));
  statsContent.append(createStatsGroupTitle('Pro Tourentag'));

  if(!tourdays.length){
    statsContent.append(createSumRow('❯ Keine Tourentage im ausgewählten Zeitraum', '-'));
    return;
  }

  tourdays.forEach((tour, index) => {
    const labelDate = tour.date ? new Date(tour.date).toLocaleDateString('de-DE') : 'ohne Datum';
    const dayLabel = `${labelDate}${tour.id ? ` · ${tour.id}` : ''}`;
    const stats = collectTourdayStats(tour);

    statsContent.append(
      createSumRow(`❯ ${dayLabel}`, '', { emphasize: true }),
      createSumRow('  Serviceerfolg (Anzahl + Vortag NE) / Kauf', `${stats.serviceSuccessCount} / ${stats.kauf} = ${formatPercent(stats.serviceSuccessRate)}`),
      createSumRow('  Integrationen (Anzahl - NE) / Kauf', `${stats.integrationsCount} / ${stats.integrationKauf} = ${formatPercent(stats.integrationsRate)}`),
      createSumRow('  D3 Kunden (Anzahl - NE) / Kauf', `${stats.d3Count} / ${stats.d3Kauf} = ${formatPercent(stats.d3Rate)}`),
    );

    if(index < tourdays.length - 1){
      statsContent.appendChild(document.createElement('hr'));
    }
  });
}


/* ========== Edit-Modal ========== */
let currentEditingKey = null;
function openEditModalFor(entry, key){
  currentEditingKey = key;
  document.getElementById('editId').value = entry.id || '';
  document.getElementById('editDate').value = entry.date || '';
  document.getElementById('editTourType').value = entry.tourType || 'tourentag';
  document.getElementById('editAmount').value = entry.amount || 0;
  document.getElementById('editReklamation').value = entry.reklamation || 0;
  document.getElementById('editGutscheine').value = entry.gutscheine || 0;
  document.getElementById('editNewC').value = entry.newC || 0;
  document.getElementById('editIntegrations').value = entry.integrations || 0;
  document.getElementById('editSchooldayCustomers').value = entry.schooldayCustomers || 0;
  document.getElementById('editPrevDayUnreachable').value = entry.prevDayUnreachable || 0;
  document.getElementById('editBuyingCustomers').value = entry.buyingCustomers || 0;
  document.getElementById('editTourdayNi').value = entry.tourdayNi || 0;
  document.getElementById('editTourdayKb').value = entry.tourdayKb || 0;
  document.getElementById('editIntegrationBought').value = entry.integrationBought || 0;
  document.getElementById('editIntegrationUnreachable').value = entry.integrationUnreachable || 0;
  document.getElementById('editIntegrationNoNeed').value = entry.integrationNoNeed || 0;
  document.getElementById('editIntegrationCancelled').value = entry.integrationCancelled || 0;
  document.getElementById('editIntegrationPreordered').value = entry.integrationPreordered || 0;
  document.getElementById('editThreeCustomersTotal').value = entry.threeCustomersTotal || 0;
  document.getElementById('editThreeCustomersBought').value = entry.threeCustomersBought || 0;
  document.getElementById('editThreeCustomersNi').value = entry.threeCustomersNi || 0;
  document.getElementById('editThreeCustomersKb').value = entry.threeCustomersKb || 0;
  document.getElementById('editThreeCustomersCancelled').value = entry.threeCustomersCancelled || 0;
  document.getElementById('editThreeCustomersPreordered').value = entry.threeCustomersPreordered || 0;
  document.getElementById('editVertretung').checked = !!entry.vertretung;
  document.getElementById('editFahrt45').checked = !!entry.fahrt45;
  document.getElementById('editActionsDetail').value = (entry.actions && entry.actions.length) ? JSON.stringify(entry.actions) : '';
  document.getElementById('editNote').value = entry.note || '';
  document.getElementById('editModal').classList.add('active');
}
document.getElementById('cancelEdit').addEventListener('click', ()=> { document.getElementById('editModal').classList.remove('active'); currentEditingKey = null; });
document.getElementById('saveEdit').addEventListener('click', async ()=>{
  if(currentEditingKey === null) return;
  const all = await idbGetAll('tours');
  const idx = all.findIndex(x=> x.idAuto === currentEditingKey);
  if(idx === -1) return;
  const t = all[idx];
  t.id = document.getElementById('editId').value || t.id;
  t.date = document.getElementById('editDate').value || t.date;
  t.tourType = document.getElementById('editTourType').value;
  t.amount = Number(document.getElementById('editAmount').value || 0);
  t.reklamation = Number(document.getElementById('editReklamation').value || 0);
  t.gutscheine = Number(document.getElementById('editGutscheine').value || 0);
  t.newC = Number(document.getElementById('editNewC').value || 0);
  t.integrations = Number(document.getElementById('editIntegrations').value || 0);
  t.schooldayCustomers = Number(document.getElementById('editSchooldayCustomers').value || 0);
  t.prevDayUnreachable = Number(document.getElementById('editPrevDayUnreachable').value || 0);
  t.buyingCustomers = Number(document.getElementById('editBuyingCustomers').value || 0);
  t.tourdayNi = Number(document.getElementById('editTourdayNi').value || 0);
  t.tourdayKb = Number(document.getElementById('editTourdayKb').value || 0);
  t.integrationBought = Number(document.getElementById('editIntegrationBought').value || 0);
  t.integrationUnreachable = Number(document.getElementById('editIntegrationUnreachable').value || 0);
  t.integrationNoNeed = Number(document.getElementById('editIntegrationNoNeed').value || 0);
  t.integrationCancelled = Number(document.getElementById('editIntegrationCancelled').value || 0);
  t.integrationPreordered = Number(document.getElementById('editIntegrationPreordered').value || 0);
  t.threeCustomersTotal = Number(document.getElementById('editThreeCustomersTotal').value || 0);
  t.threeCustomersBought = Number(document.getElementById('editThreeCustomersBought').value || 0);
  t.threeCustomersNi = Number(document.getElementById('editThreeCustomersNi').value || 0);
  t.threeCustomersKb = Number(document.getElementById('editThreeCustomersKb').value || 0);
  t.threeCustomersCancelled = Number(document.getElementById('editThreeCustomersCancelled').value || 0);
  t.threeCustomersPreordered = Number(document.getElementById('editThreeCustomersPreordered').value || 0);
  t.vertretung = document.getElementById('editVertretung').checked;
  t.fahrt45 = document.getElementById('editFahrt45').checked;
  t.note = document.getElementById('editNote').value || '';
  const ad = document.getElementById('editActionsDetail').value || '';
  let actions = [];
  if(ad.trim() !== ''){
    try{
      const parsed = JSON.parse(ad);
      if(Array.isArray(parsed)) actions = parsed.map(a=>({ qty: Number(a.qty||0), price: Number(a.price||0) }));
    }catch(e){
      const parts = ad.split('|');
      parts.forEach(p=>{
        const m = p.match(/(\d+)\s*x\s*([\d.,]+)/);
        if(m) actions.push({ qty: Number(m[1]), price: Number(m[2].replace(',','.')) });
      });
    }
  }
  t.actions = actions;
  await idbDelete('tours', currentEditingKey);
  delete t.idAuto;
  await idbAdd('tours', t);
  currentEditingKey = null;
  document.getElementById('editModal').classList.remove('active');
  await renderTours();
  await triggerAutoBackup('tour_edited');
});

/* ========== PDF Export ========== */
document.getElementById('exportPdf').addEventListener('click', async () => {
  if(!window.jspdf || !window.jspdf.jsPDF){ alert('jsPDF nicht geladen'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const conf = await loadConfObj();
  const periodKey = `${selectYear.value}-${selectMonth.value}`;
  const tours = (await getAllTours()).filter(t=>t.period === periodKey);

  let totalUmsatzAllCents=0, totalVGRevenueCents=0, countVGTours=0, countNeukundentouren=0;
  let totalIntegrationCents=0, totalSpesenCents=0, totalActionProvCents=0, totalPaprovCents=0, totalExtrasCents=0;
  let totalNKCount = 0;

  tours.forEach(t=>{
    const baseCents = toCents(t.amount||0);
    const reklCents = toCents(t.reklamation||0);
    const gutsCents = toCents(t.gutscheine||0);
    const tourTotal = baseCents + reklCents + gutsCents;
    totalUmsatzAllCents += tourTotal;
    if(t.tourType==='tourentag'){ totalVGRevenueCents += tourTotal; countVGTours++; }
    if(t.tourType==='neukundentour') countNeukundentouren++;
    totalNKCount += Number(t.newC || 0);
    totalIntegrationCents += computeIntegrationCents(t.integrations||0,conf);
    totalSpesenCents += computeSpesenCentsForTour(t,conf);
    totalActionProvCents += computeActionProvisionCents(t.actions||[]);
    let extra=0;
    if(t.vertretung) extra += Math.round(tourTotal * 0.02);
    if(t.fahrt45) extra += Math.round(tourTotal * 0.0025);
    totalExtrasCents += extra;
    if(t.tourType !== 'tourentag'){
      const paprovVal = (conf.paprovPerMonth && conf.paprovPerMonth[t.period]) ? toCents(conf.paprovPerMonth[t.period]) : 0;
      totalPaprovCents += paprovVal;
    }
  });

  const totalNeukCents = computeMonthlyNeukundenBonusCents(totalNKCount, conf);

  const avgVGEuros = (countVGTours>0) ? (totalVGRevenueCents/100/countVGTours) : 0;
  const vgRate = determineVGRate(avgVGEuros);
  const vgProvisionCents = Math.round(totalVGRevenueCents * vgRate);
  const lostCustomersValue = getLostCustomersForPeriod(conf, periodKey);
  const rawKm = computeKundenmanagementBonusCents(lostCustomersValue);
  const totalTours = tours.length;
  const relevant = countVGTours + countNeukundentouren;
  const kmBonus = Math.round(rawKm * (totalTours>0 ? (relevant/totalTours) : 0));
  const totalProvisionCents = vgProvisionCents + totalNeukCents + totalIntegrationCents + totalActionProvCents + totalPaprovCents + totalExtrasCents + kmBonus;
  const baseSalaryCents = toCents(getBaseSalaryForPeriod(conf, periodKey));
  const monthlyBeforeSpesenCents = Math.max(baseSalaryCents, totalProvisionCents);
  const brutto = monthlyBeforeSpesenCents/100;
  const netResult = computeNetResult(brutto, { ...conf.netConfig, taxYear: Number(selectYear.value) });
  const nettoFromBruttoCents = Math.round(netResult.netto*100);
  const heimschlaefer = getHeimschlaeferForPeriod(conf, periodKey);
  const heimschlaeferNettoCents = heimschlaefer.enabled ? toCents(heimschlaefer.netto) : 0;
  const payoutNettoCents = heimschlaefer.enabled ? heimschlaeferNettoCents : nettoFromBruttoCents;
  const finalPayoutCents = payoutNettoCents + totalSpesenCents;

  doc.setFillColor(11,37,69); doc.rect(0,0,doc.internal.pageSize.width,70,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(18);
  const monthLabel = `${selectMonth.options[selectMonth.selectedIndex].text} ${selectYear.value}`;
  doc.text('bofrost* – Verkaufsfahrer', 40, 36);
  doc.setFontSize(10); doc.text(`Monat: ${monthLabel}`, 40, 56); doc.setTextColor(0,0,0);

  let y = 100; doc.setFontSize(11);
  const left = 40, colXVal = 380;
  const summaryRows = [
    ['Anzahl Touren (Monat)', `${totalTours}`],
    ['Tourentage (VG)', `${countVGTours}`],
    ['Gesamtumsatz (Monat)', `€ ${fromCents(totalUmsatzAllCents)}`],
    ['Summe VG-Umsatz', `€ ${fromCents(totalVGRevenueCents)}`],
    ['Durchschnitt VG-Umsatz', `€ ${avgVGEuros.toFixed(2)}`],
    ['Provisionssatz (VG)', `${(vgRate*100).toFixed(2)}%`],
    ['Provision (VG)', `€ ${fromCents(vgProvisionCents)}`],
    ['Neukunden-Boni', `€ ${fromCents(totalNeukCents)}`],
    ['Integrationen', `€ ${fromCents(totalIntegrationCents)}`],
    ['Provision Aktionen (10%)', `€ ${fromCents(totalActionProvCents)}`],
    ['PAPROV (Monat)', `€ ${fromCents(totalPaprovCents)}`],
    ['Zusatzprovision (Vert./>45min)', `€ ${fromCents(totalExtrasCents)}`],
    ['Kundenmanagement (anteilig)', `€ ${fromCents(kmBonus)}`],
    ['Spesen (NETTO)', `€ ${fromCents(totalSpesenCents)}`],
    ['Provision gesamt (ohne Spesen)', `€ ${fromCents(totalProvisionCents)}`],
    ['Grundgehalt (Brutto)', `€ ${fromCents(baseSalaryCents)}`],
    ['Monatsbrutto (für Netto)', `€ ${fromCents(monthlyBeforeSpesenCents)}`],
    ['Betriebliche Altersvorsorge', `€ ${netResult.breakdown.bav.toFixed(2)}`],
    ['Netto (ohne Spesen)', `€ ${fromCents(nettoFromBruttoCents)}`],
    ['End-Auszahlung (Netto + Spesen)', `€ ${fromCents(finalPayoutCents)}`]
  ];
  if(heimschlaefer.enabled){
    summaryRows.splice(summaryRows.length - 1, 0, ['Heimschläfer-Netto', `€ ${fromCents(heimschlaeferNettoCents)}`]);
  }
  summaryRows.forEach(([k,v])=>{
    if(y > doc.internal.pageSize.height - 80){ doc.addPage(); y = 40; }
    doc.text(sanitizeForPdf(k), left, y);
    doc.text(sanitizeForPdf(String(v)), colXVal, y, {align:'right'});
    y += 16;
  });

  doc.addPage('a4','landscape');
  doc.setFontSize(14); doc.setTextColor(11,37,69);
  doc.text('Tourenübersicht', 40, 30); doc.setTextColor(0,0,0);

  const tableColumns = [
    { header: 'Datum', dataKey: 'date' },
    { header: 'Tour', dataKey: 'id' },
    { header: 'Art', dataKey: 'type' },
    { header: 'Umsatz (€)', dataKey: 'umsatz' },
    { header: 'Rekl.', dataKey: 'rekl' },
    { header: 'GS (€)', dataKey: 'gs' },
    { header: 'NK', dataKey: 'nk' },
    { header: 'Int', dataKey: 'int' },
    { header: 'Aktionen (Stk)', dataKey: 'acts' },
    { header: 'Aktionen (€)', dataKey: 'actEuro' },
    { header: 'Vertret.', dataKey: 'vert' },
    { header: '>45min', dataKey: 'f45' }
  ];
  const tableData = tours.map(t=>{
    const baseCents = toCents(t.amount||0);
    const reklCents = toCents(t.reklamation||0);
    const gutsCents = toCents(t.gutscheine||0);
    const gsCents = gutsCents;
    const actionsPiece = (t.actions && t.actions.length) ? t.actions.reduce((s,a)=> s + Number(a.qty||0), 0) : 0;
    const actionsSum = computeActionSum(t.actions || []);
    return {
      date: sanitizeForPdf(t.date||'-'),
      id: sanitizeForPdf(t.id||'-'),
      type: sanitizeForPdf(t.tourType||'-'),
      umsatz: `€ ${fromCents(baseCents + reklCents + gutsCents)}`,
      rekl: `€ ${fromCents(reklCents)}`,
      gs: gsCents > 0 ? `€ ${fromCents(gsCents)}` : '–',
      nk: t.newC || 0,
      int: t.integrations || 0,
      acts: actionsPiece,
      actEuro: actionsSum.toFixed(2),
      vert: tickFor(t.vertretung),
      f45: tickFor(t.fahrt45)
    };
  });

  doc.autoTable({
    startY: 48,
    head: [tableColumns.map(c=>c.header)],
    body: tableData.map(r => tableColumns.map(c => r[c.dataKey])),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [11,37,69], textColor: 255 },
    theme: 'striped',
    margin: { left: 20, right: 20 }
  });

  const fname = `provision_${selectYear.value}_${selectMonth.value}.pdf`;
  doc.save(fname);
});

/* Backups */
document.getElementById('openBackups').addEventListener('click', ()=>{
  setActiveSection('sectionBackups');
});
document.getElementById('closeBackups').addEventListener('click', ()=> setActiveSection('sectionTours'));
document.getElementById('clearBackups').addEventListener('click', async ()=>{
  if(!confirm('Alle Backups löschen?')) return;
  await idbClear('backups'); document.getElementById('backupsList').innerHTML = '<div class="muted">Keine Backups vorhanden</div>';
});

/* Reset / Print */
document.getElementById('resetAll').addEventListener('click', async ()=>{
  if(!confirm('Alle Touren und Einstellungen löschen?')) return;
  await clearAllData();
  await renderTours();
});
document.getElementById('printReport').addEventListener('click', ()=> window.print());


/* CSV-Import Button */
document.getElementById('importCsv').addEventListener('click', ()=> csvInput.click());

/* Sortier-Header initialisieren */
document.querySelectorAll('#toursTable thead th[data-sort]').forEach(th=>{
  th.addEventListener('click', ()=>{
    const key = th.dataset.sort;
    if(currentSort.key === key){
      currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    }else{
      currentSort.key = key;
      currentSort.dir = 'asc';
    }
    renderTours();
  });
});

/* ========== Init ========== */
export async function init(){
  await migrateFromLocalStorageIfPresent();

  const today = new Date(); 
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const yy = today.getFullYear();
  selectMonth.value = mm; selectYear.value = yy;
  document.getElementById('date').value = today.toISOString().slice(0,10);
  document.getElementById('paprovMonth').value = `${yy}-${mm}`;
  document.getElementById('lostCustomersMonth').value = `${yy}-${mm}`;
  if(baseSalaryMonth) baseSalaryMonth.value = `${yy}-${mm}`;
  if(heimschlaeferMonth) heimschlaeferMonth.value = `${yy}-${mm}`;

  const conf = await loadConfObj();
  document.getElementById('lostCustomersValue').value = getLostCustomersForPeriod(conf, `${yy}-${mm}`);
  document.getElementById('paprovValue').value = (conf.paprovPerMonth && conf.paprovPerMonth[`${yy}-${mm}`]) ? conf.paprovPerMonth[`${yy}-${mm}`] : 0;
  if(baseSalaryMonth) document.getElementById('baseSalaryValue').value = getBaseSalaryForPeriod(conf, `${yy}-${mm}`);
  if(heimschlaeferMonth){
    const heimschlaefer = getHeimschlaeferForPeriod(conf, `${yy}-${mm}`);
    document.getElementById('heimschlaeferEnabled').checked = heimschlaefer.enabled;
    document.getElementById('heimschlaeferNetto').value = heimschlaefer.netto;
  }

  if(menuTriggerBtn) menuTriggerBtn.addEventListener('click', toggleSideMenu);
  if(closeMenuBtn) closeMenuBtn.addEventListener('click', closeSideMenu);
  if(menuOverlay) menuOverlay.addEventListener('click', closeSideMenu);
  document.addEventListener('keydown', (event)=>{
    if(event.key === 'Escape') closeSideMenu();
  });
  window.addEventListener('resize', ()=>{
    if(sideMenu && sideMenu.classList.contains('active')) positionSideMenuNearTrigger();
  });

  Object.entries(tabTargets).forEach(([tabId, sectionId])=>{
    const tab = document.getElementById(tabId);
    if(tab) tab.addEventListener('click', ()=> {
      setActiveSection(sectionId);
      closeSideMenu();
    });
  });

  selectMonth.addEventListener('change', ()=> {
    renderTours();
    if(document.getElementById('sectionSettings').classList.contains('active')) populateSettingsSection();
  });
  selectYear.addEventListener('change', ()=> {
    renderTours();
    if(document.getElementById('sectionSettings').classList.contains('active')) populateSettingsSection();
  });

  await renderCustomerAgreements();
  await renderCustomerAddressSuggestions('');
  setActiveSection('sectionNewTour');
  await renderTours();
}
