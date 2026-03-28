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
const appVersionLabel = document.getElementById('appVersion');
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
const customerPrintFromInput = document.getElementById('customerPrintFrom');
const customerPrintToInput = document.getElementById('customerPrintTo');
const statsRangeFromInput = document.getElementById('statsRangeFrom');
const statsRangeToInput = document.getElementById('statsRangeTo');
const statsRangeResetBtn = document.getElementById('statsRangeReset');
let statsRangeApplyBtn = document.getElementById('statsRangeApply');
const statsPeriodHint = document.getElementById('statsPeriodHint');
const customerAddressSuggestionMap = new Map();
let editingCustomerAgreementId = null;
let saveCustomerAgreementBtn;
let printCustomerListBtn;
let customerEditModal;
let currentSort = { key:null, dir:'asc' };
let appliedStatsRange = null;
let statsRangeDirty = false;


function renderAppVersion(){
  if(!appVersionLabel) return;
  const appVersion = document.querySelector('meta[name="app-version"]')?.content || 'dev';
  appVersionLabel.textContent = `Version ${appVersion}`;
}

function parseDecimal(value){
  if(value == null) return 0;
  if(typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value).trim().replace(',', '.');
  if(!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDateValue(value){
  if(!value) return new Date().toISOString().slice(0,10);
  const raw = String(value).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const dotMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if(dotMatch){
    const [, dd, mm, yyyy] = dotMatch;
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if(!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0,10);

  return new Date().toISOString().slice(0,10);
}

function normalizePeriodValue(period, dateValue){
  const rawPeriod = String(period || '').trim();
  if(/^\d{4}-\d{2}$/.test(rawPeriod)) return rawPeriod;

  const loosePeriodMatch = rawPeriod.match(/^(\d{4})-(\d{1,2})$/);
  if(loosePeriodMatch){
    const [, yy, mm] = loosePeriodMatch;
    return `${yy}-${String(mm).padStart(2, '0')}`;
  }

  const normalizedDate = normalizeDateValue(dateValue);
  const dateForPeriod = new Date(normalizedDate);
  const yy = dateForPeriod.getFullYear();
  const mm = String(dateForPeriod.getMonth() + 1).padStart(2,'0');
  return `${yy}-${mm}`;
}

function normalizeActionsValue(actions){
  if(!Array.isArray(actions)) return [];
  return actions
    .map((action)=>({
      price: parseDecimal(action?.price),
      qty: Number(action?.qty || 0),
    }))
    .filter((action)=> Number.isFinite(action.price) && Number.isFinite(action.qty) && action.price > 0 && action.qty > 0);
}

function normalizeTourRecord(tour = {}){
  const normalized = { ...tour };
  const normalizedDate = normalizeDateValue(normalized.date);
  normalized.date = normalizedDate;
  normalized.period = normalizePeriodValue(normalized.period, normalizedDate);

  normalized.amount = parseDecimal(normalized.amount);
  normalized.reklamation = parseDecimal(normalized.reklamation);
  normalized.gutscheine = parseDecimal(normalized.gutscheine);
  normalized.umsatzvorgabe = parseDecimal(normalized.umsatzvorgabe ?? normalized.umsatzVorgabe);
  if(Object.prototype.hasOwnProperty.call(normalized, 'umsatzVorgabe')){
    delete normalized.umsatzVorgabe;
  }

  normalized.newC = Number(normalized.newC || 0);
  normalized.integrations = Number(normalized.integrations || 0);
  normalized.integrationBought = Number(
    normalized.integrationBought
    ?? normalized.integrationKauf
    ?? normalized.integrations
    ?? 0
  );
  normalized.integrationUnreachable = Number(normalized.integrationUnreachable || 0);
  normalized.integrationNoNeed = Number(normalized.integrationNoNeed || 0);
  normalized.integrationCancelled = Number(normalized.integrationCancelled || 0);
  normalized.integrationPreordered = Number(normalized.integrationPreordered || 0);

  normalized.actions = normalizeActionsValue(normalized.actions);
  normalized.vertretung = !!normalized.vertretung;
  normalized.fahrt45 = !!normalized.fahrt45;
  normalized.einbringung = !!normalized.einbringung;
  normalized.workStart = normalized.workStart ? String(normalized.workStart) : '';
  normalized.tourStart = normalized.tourStart ? String(normalized.tourStart) : '';
  normalized.tourEnd = normalized.tourEnd ? String(normalized.tourEnd) : '';
  normalized.workEnd = normalized.workEnd ? String(normalized.workEnd) : '';
  normalized.breakMinutes = Number.isFinite(Number(normalized.breakMinutes)) ? Number(normalized.breakMinutes) : 45;

  return normalized;
}

function readDecimalInput(inputId){
  const input = document.getElementById(inputId);
  if(!input) return 0;
  return parseDecimal(input.value);
}


function bindById(id, eventName, handler){
  const element = document.getElementById(id);
  if(!element){
    console.warn(`[ui] Element mit ID "${id}" nicht gefunden; Listener für "${eventName}" wurde übersprungen.`);
    return null;
  }
  element.addEventListener(eventName, handler);
  return element;
}

function compareToursByDateDesc(a, b){
  const da = a?.date || '';
  const db = b?.date || '';
  return db.localeCompare(da);
}

const NAVIGATION_STRUCTURE = [
  { index: 1, tabId: 'tabNewTour', sectionId: 'sectionNewTour', label: 'Neue Tour' },
  { index: 2, tabId: 'tabTours', sectionId: 'sectionTours', label: 'Touren' },
  { index: 3, tabId: 'tabSummary', sectionId: 'sectionSummary', label: 'Übersicht' },
  { index: 4, tabId: 'tabWorktime', sectionId: 'sectionWorktime', label: 'Arbeitszeit' },
  { index: 5, tabId: 'tabStats', sectionId: 'sectionStats', label: 'Statistik' },
  { index: 6, tabId: 'tabCustomers', sectionId: 'sectionCustomers', label: 'Kunden' },
  { index: 7, tabId: 'tabSettings', sectionId: 'sectionSettings', label: 'Einstellungen' },
  { index: 8, tabId: 'tabBackups', sectionId: 'sectionBackups', label: 'Backups' },
  { index: 9, tabId: 'tabExport', sectionId: 'sectionExport', label: 'Export' }
];

const tabTargets = Object.fromEntries(NAVIGATION_STRUCTURE.map(item => [item.tabId, item.sectionId]));

const sectionIds = new Set(Object.values(tabTargets));

function renderSideMenuNavigation(){
  const sideMenuBody = document.getElementById('sideMenuBody');
  if(!sideMenuBody) return;

  sideMenuBody.innerHTML = '';
  const sortedNavigation = [...NAVIGATION_STRUCTURE].sort((a, b)=> a.index - b.index);
  sortedNavigation.forEach((item)=>{
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = item.tabId;
    tab.className = 'tabButton';
    tab.dataset.sectionId = item.sectionId;
    tab.dataset.navIndex = String(item.index);
    tab.setAttribute('aria-label', item.label);
    tab.setAttribute('aria-posinset', String(item.index));
    tab.setAttribute('aria-setsize', String(sortedNavigation.length));
    tab.title = `${item.index}. ${item.label}`;
    tab.textContent = item.label;
    sideMenuBody.appendChild(tab);
  });
}

function handleNavigationShortcuts(event){
  if(!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if(!/^Digit[1-9]$/.test(event.code)) return;
  const pressedIndex = Number(event.code.replace('Digit', ''));
  const target = NAVIGATION_STRUCTURE.find(item => item.index === pressedIndex);
  if(!target) return;
  event.preventDefault();
  setActiveSection(target.sectionId);
  closeSideMenu();
}

function sectionFromHash(){
  const hashValue = window.location.hash.replace(/^#/, '');
  return sectionIds.has(hashValue) ? hashValue : null;
}

function updateLocationHash(sectionId){
  const targetHash = `#${sectionId}`;
  if(window.location.hash !== targetHash){
    history.replaceState(null, '', targetHash);
  }
}

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
  if(!sectionIds.has(sectionId)) return;

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

  updateLocationHash(sectionId);
}

/* Jahre + Monatsselektoren auffüllen */
(function populateYearsAndPaprov(){
  if(!selectYear) return;
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
bindById('addActionBtn', 'click', (e)=>{
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

function mapAgreementTypePrintRowClass(type){
  const classes = {
    rhythmus_geaendert: 'print-row-rhythmus-geaendert',
    komplett_storno: 'print-row-komplett-storno',
    nur_auf_bestellung: 'print-row-nur-auf-bestellung',
    urlaub: 'print-row-urlaub',
    sonstiges: 'print-row-sonstiges'
  };
  return classes[type] || 'print-row-sonstiges';
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

function createCustomerEditModal(){
  if(customerEditModal) return customerEditModal;

  customerEditModal = document.createElement('div');
  customerEditModal.id = 'customerEditModal';
  customerEditModal.className = 'modal';
  customerEditModal.innerHTML = `
    <div class="modalContent">
      <h3>Kundenabsprache bearbeiten</h3>
      <form onsubmit="return false;">
        <div class="row">
          <label>Kundennummer
            <input id="customerEditNumber" placeholder="z.B. 4711" />
          </label>
          <label>Name
            <input id="customerEditLastName" placeholder="z.B. Muster" />
          </label>
        </div>

        <div class="row">
          <label>Vorname
            <input id="customerEditFirstName" placeholder="z.B. Max" />
          </label>
          <label>Art
            <select id="customerEditAgreementType">
              <option value="rhythmus_geaendert">Rhythmus geändert</option>
              <option value="komplett_storno">Komplett Storno</option>
              <option value="urlaub">Urlaub</option>
              <option value="nur_auf_bestellung">Nur auf Bestellung</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </label>
        </div>

        <div class="row">
          <label>Straße
            <input id="customerEditStreet" placeholder="z.B. Musterstraße" />
          </label>
          <label>Hausnummer
            <input id="customerEditHouseNumber" placeholder="z.B. 12a" />
          </label>
        </div>

        <div class="row">
          <label>PLZ
            <input id="customerEditPostalCode" placeholder="z.B. 12345" />
          </label>
          <label>Ort
            <input id="customerEditCity" placeholder="z.B. Musterstadt" />
          </label>
        </div>

        <div class="row">
          <label>Gültig ab
            <input id="customerEditSince" type="date" />
          </label>
          <label>Bis (optional)
            <input id="customerEditUntil" type="date" />
          </label>
        </div>

        <label>Notiz
          <textarea id="customerEditNote" rows="2" placeholder="Details zur Absprache"></textarea>
        </label>

        <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
          <button id="cancelCustomerEdit" class="small">Abbrechen</button>
          <button id="saveCustomerEdit" class="small" aria-label="Änderungen speichern" title="Änderungen speichern">💾</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(customerEditModal);

  bindById('cancelCustomerEdit', 'click', ()=>{
    customerEditModal.classList.remove('active');
    editingCustomerAgreementId = null;
  });

  bindById('saveCustomerEdit', 'click', async ()=>{
    if(!editingCustomerAgreementId) return;

    const customerLastName = (document.getElementById('customerEditLastName').value || '').trim();
    const customerFirstName = (document.getElementById('customerEditFirstName').value || '').trim();
    const customerStreet = (document.getElementById('customerEditStreet').value || '').trim();
    const customerHouseNumber = (document.getElementById('customerEditHouseNumber').value || '').trim();
    const customerPostalCode = (document.getElementById('customerEditPostalCode').value || '').trim();
    const customerCity = (document.getElementById('customerEditCity').value || '').trim();

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

    const all = await getAllCustomerAgreements();
    const previous = all.find(item => item.idAuto === editingCustomerAgreementId);
    if(!previous) return;

    const agreement = {
      ...previous,
      idAuto: editingCustomerAgreementId,
      customerNumber: (document.getElementById('customerEditNumber').value || '').trim() || '—',
      customerLastName,
      customerFirstName,
      customerStreet,
      customerHouseNumber,
      customerPostalCode,
      customerCity,
      type: document.getElementById('customerEditAgreementType').value || 'sonstiges',
      since: document.getElementById('customerEditSince').value || '',
      until: document.getElementById('customerEditUntil').value || '',
      note: (document.getElementById('customerEditNote').value || '').trim(),
      updatedAt: new Date().toISOString()
    };

    await idbPut('customerAgreements', agreement);
    customerEditModal.classList.remove('active');
    editingCustomerAgreementId = null;
    await renderCustomerAgreements();
    await renderCustomerAddressSuggestions('');
    await triggerAutoBackup('customer_agreement_saved');
  });

  return customerEditModal;
}

function openCustomerAgreementEditModal(agreement){
  const modal = createCustomerEditModal();
  if(!agreement) return;
  editingCustomerAgreementId = agreement.idAuto;

  document.getElementById('customerEditNumber').value = agreement.customerNumber === '—' ? '' : (agreement.customerNumber || '');
  document.getElementById('customerEditLastName').value = agreement.customerLastName || '';
  document.getElementById('customerEditFirstName').value = agreement.customerFirstName || '';
  document.getElementById('customerEditStreet').value = agreement.customerStreet || '';
  document.getElementById('customerEditHouseNumber').value = agreement.customerHouseNumber || '';
  document.getElementById('customerEditPostalCode').value = agreement.customerPostalCode || '';
  document.getElementById('customerEditCity').value = agreement.customerCity || '';
  document.getElementById('customerEditAgreementType').value = agreement.type || 'sonstiges';
  document.getElementById('customerEditSince').value = agreement.since || '';
  document.getElementById('customerEditUntil').value = agreement.until || '';
  document.getElementById('customerEditNote').value = agreement.note || '';

  modal.classList.add('active');
}

async function printCustomerAgreements(filter = {}){
  const agreements = await getAllCustomerAgreements();
  const from = filter.from || '';
  const to = filter.to || '';

  const filteredAgreements = agreements.filter(agreement => {
    const since = agreement.since || '';
    if(from && (!since || since < from)) return false;
    if(to && (!since || since > to)) return false;
    return true;
  });
  filteredAgreements.sort((a,b)=>{
    const lastNameCompare = (a.customerLastName || '').localeCompare((b.customerLastName || ''), 'de', { sensitivity: 'base' });
    if(lastNameCompare !== 0) return lastNameCompare;

    const firstNameCompare = (a.customerFirstName || '').localeCompare((b.customerFirstName || ''), 'de', { sensitivity: 'base' });
    if(firstNameCompare !== 0) return firstNameCompare;

    const numberCompare = String(a.customerNumber || '').localeCompare(String(b.customerNumber || ''), 'de', { numeric: true, sensitivity: 'base' });
    if(numberCompare !== 0) return numberCompare;

    return (a.since || '').localeCompare((b.since || ''));
  });

  const rows = filteredAgreements.map(agreement => {
    const fullName = `${agreement.customerLastName || '—'}, ${agreement.customerFirstName || '—'}`;
    const address = [
      [agreement.customerStreet || '', agreement.customerHouseNumber || ''].filter(Boolean).join(' '),
      [agreement.customerPostalCode || '', agreement.customerCity || ''].filter(Boolean).join(' ')
    ].filter(Boolean).join(', ') || '—';

    return `<tr class="${mapAgreementTypePrintRowClass(agreement.type)}">
      <td>${sanitizeForPdf(agreement.customerNumber || '—')}</td>
      <td>${sanitizeForPdf(fullName)}</td>
      <td>${sanitizeForPdf(address)}</td>
      <td>${sanitizeForPdf(mapAgreementTypeLabel(agreement.type))}</td>
      <td>${sanitizeForPdf(agreement.since ? new Date(agreement.since).toLocaleDateString('de-DE') : '—')}</td>
      <td>${sanitizeForPdf(agreement.until ? new Date(agreement.until).toLocaleDateString('de-DE') : 'offen')}</td>
      <td class="note-cell">${sanitizeForPdf(agreement.note || '')}</td>
    </tr>`;
  });

  const tableRows = rows.length
    ? rows.join('')
    : '<tr><td colspan="7">Keine Kundenabsprachen vorhanden.</td></tr>';

  const printHtml = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>Kundenliste</title>
  <style>
    :root {
      --print-text: #1b1f23;
      --print-grid: #c7d0db;
      --print-header-bg: #1d3557;
      --print-header-text: #ffffff;
      --print-row-rhythmus: #e9f1ff;
      --print-row-storno: #ffe7e7;
      --print-row-bestellung: #fff2df;
      --print-row-urlaub: #e8f8ef;
      --print-row-sonstiges: #f3f5f7;
    }
    @page { size: A4 landscape; margin: 8mm; }
    body { font-family: Arial, sans-serif; padding: 8px; color: var(--print-text); }
    h1 { margin: 0 0 8px; font-size: 20px; }
    p { margin: 0 0 10px; color: #485260; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
    col.col-number { width: 7%; }
    col.col-name { width: 17%; }
    col.col-address { width: 26%; }
    col.col-type { width: 14%; }
    col.col-since { width: 8%; }
    col.col-until { width: 8%; }
    col.col-note { width: 20%; }
    th, td {
      border: 1px solid var(--print-grid);
      padding: 5px;
      text-align: left;
      vertical-align: top;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    tr {
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .note-cell { white-space: pre-wrap; }
    th {
      background: var(--print-header-bg);
      color: var(--print-header-text);
      font-weight: 700;
    }
    .print-row-rhythmus-geaendert { background: var(--print-row-rhythmus); }
    .print-row-komplett-storno { background: var(--print-row-storno); }
    .print-row-nur-auf-bestellung { background: var(--print-row-bestellung); }
    .print-row-urlaub { background: var(--print-row-urlaub); }
    .print-row-sonstiges { background: var(--print-row-sonstiges); }
    thead { display: table-header-group; }
    tbody {
      break-inside: auto;
      page-break-inside: auto;
    }
    @media print {
      body { padding: 0; }
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <h1>Kundenliste</h1>
  <p>Stand: ${new Date().toLocaleString('de-DE')}</p>
  <p>Zeitraum (Gültig ab): ${from ? new Date(from).toLocaleDateString('de-DE') : 'alle'} bis ${to ? new Date(to).toLocaleDateString('de-DE') : 'alle'}</p>
  <table>
    <colgroup>
      <col class="col-number">
      <col class="col-name">
      <col class="col-address">
      <col class="col-type">
      <col class="col-since">
      <col class="col-until">
      <col class="col-note">
    </colgroup>
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
      ${tableRows}
    </tbody>
  </table>
</body>
</html>`;

  if(!openAndPrintDocument(printHtml)){
    alert('Drucken wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben.');
  }
}

function openAndPrintDocument(html, existingPopup = null){
  const popup = existingPopup && !existingPopup.closed ? existingPopup : window.open('', '_blank');
  const canUsePopup = popup && popup !== window;

  if(canUsePopup){
    popup.document.write(html);
    popup.document.close();

    const closePopup = ()=> {
      try { popup.close(); } catch(_err){ /* noop */ }
    };

    popup.addEventListener('afterprint', closePopup, { once: true });
    window.setTimeout(closePopup, 120000);
    popup.focus();
    popup.print();
    return true;
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';

  document.body.appendChild(frame);

  const frameWindow = frame.contentWindow;
  if(!frameWindow){
    frame.remove();
    return false;
  }

  frameWindow.document.open();
  frameWindow.document.write(html);
  frameWindow.document.close();

  const cleanup = ()=> {
    if(frame.parentNode){
      frame.parentNode.removeChild(frame);
    }
  };

  frameWindow.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(cleanup, 120000);
  frameWindow.focus();
  frameWindow.print();
  return true;
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
      openCustomerAgreementEditModal(agreement);
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
async function addTourRecord(tour){
  const normalizedTour = normalizeTourRecord(tour);
  await idbAdd('tours', normalizedTour);
}

async function saveTourObj(t){
  await addTourRecord(t);
  await triggerAutoBackup('tour_saved');
  await renderTours();
}
async function getAllTours(){
  const tours = await idbGetAll('tours');
  return tours.map((tour)=> normalizeTourRecord(tour));
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
bindById('exportJson', 'click', async ()=>{
  const tours = await getAllTours();
  const conf = await loadConfObj();
  const customerAgreements = await getAllCustomerAgreements();
  const payload = { ts: new Date().toISOString(), data: { tours, conf, customerAgreements } };
  downloadJson(payload, `provision_export_${payload.ts.replace(/[:.]/g,'-')}.json`);
});
bindById('importJson', 'click', ()=> jsonInput?.click());
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
        await addTourRecord(t);
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
bindById('exportCsv', 'click', async ()=>{
  const allTours = await getAllTours();
  const conf = await loadConfObj();
  const monthFilter = `${selectYear.value}-${selectMonth.value}`;
  const monthTours = allTours.filter(t=>t.period===monthFilter);
  const totalNKThisMonth = monthTours.reduce((s,t)=> s + Number(t.newC || 0), 0);
  const nkRate = getNeukundenRate(totalNKThisMonth, conf); // € pro NK

  let csv = 'Datum;Tour;Art;Umsatz;Umsatzvorgabe;Reklamation;Gutscheine;Neukunden;Neukunden€;Integrationen;Integr€;AktionsJSON;AktStk;AktEuro;Vertretung;Fahrt45;Einbringung;Arbeitszeitbeginn;Tourenstart;PauseMinuten;Tourenende;Arbeitszeitende;Period;PAPROV;Notiz\n';
  monthTours.forEach(t=>{
    const baseCents = toCents(t.amount || 0);
    const reklCents = toCents(t.reklamation || 0);
    const gutsCents = toCents(t.gutscheine || 0);
    const totCents = baseCents + reklCents + gutsCents;
    const nk = computeNeukundenBonusForTourCents(t.newC || 0, totalNKThisMonth, conf);
    const ip = computeIntegrationCents(t.integrationBought || 0, conf);
    const actionsSum = computeActionSum(t.actions || []);
    const actionsPiece = (t.actions && t.actions.length) ? t.actions.reduce((s,a)=>s+Number(a.qty||0),0) : 0;
    const paprovVal = (t.tourType !== 'tourentag' && conf.paprovPerMonth && conf.paprovPerMonth[t.period]) ? conf.paprovPerMonth[t.period] : 0;
    const actionsJson = JSON.stringify(t.actions || []);
    csv += `${t.date};${t.id};${t.tourType};${fromCents(totCents)};${getRevenueTargetValue(t).toFixed(2)};${fromCents(reklCents)};${fromCents(gutsCents)};${t.newC||0};${fromCents(nk)};${t.integrations||0};${fromCents(ip)};"${actionsJson.replace(/"/g,'""')}";${actionsPiece};${actionsSum.toFixed(2)};${t.vertretung?"JA":"NEIN"};${t.fahrt45?"JA":"NEIN"};${t.einbringung?"JA":"NEIN"};${t.workStart||''};${t.tourStart||''};${Number(t.breakMinutes ?? 45)};${t.tourEnd||''};${t.workEnd||''};${t.period};${paprovVal.toFixed(2)};"${(t.note||'').replace(/"/g,'""')}"\n`;
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
  const idx = { date: col("Datum"), id: col("Tour"), art: col("Art"), umsatz: col("Umsatz"), umsatzvorgabe: col("Umsatzvorgabe"), rekl: col("Reklamation"), guts: col("Gutscheine"), nk: col("Neukunden"), integ: col("Integrationen"), actions: col("AktionsJSON"), vert: col("Vertretung"), f45: col("Fahrt45"), einbringung: col("Einbringung"), workStart: col("Arbeitszeitbeginn"), tourStart: col("Tourenstart"), breakMinutes: col("PauseMinuten"), tourEnd: col("Tourenende"), workEnd: col("Arbeitszeitende"), per: col("Period"), note: col("Notiz") };
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
      amount: parseDecimal(parts[idx.umsatz] || 0),
      umsatzvorgabe: idx.umsatzvorgabe >= 0 ? parseDecimal(parts[idx.umsatzvorgabe] || 0) : 0,
      reklamation: parseDecimal(parts[idx.rekl] || 0),
      gutscheine: parseDecimal(parts[idx.guts] || 0),
      newC: Number(parts[idx.nk] || 0),
      integrations: Number(parts[idx.integ] || 0),
      actions: actions,
      vertretung: (parts[idx.vert] || '').toUpperCase() === 'JA',
      fahrt45: (parts[idx.f45] || '').toUpperCase() === 'JA',
      einbringung: idx.einbringung >= 0 ? (parts[idx.einbringung] || '').toUpperCase() === 'JA' : false,
      workStart: idx.workStart >= 0 ? (parts[idx.workStart] || '') : '',
      tourStart: idx.tourStart >= 0 ? (parts[idx.tourStart] || '') : '',
      breakMinutes: idx.breakMinutes >= 0 ? Number(parts[idx.breakMinutes] || 45) : 45,
      tourEnd: idx.tourEnd >= 0 ? (parts[idx.tourEnd] || '') : '',
      workEnd: idx.workEnd >= 0 ? (parts[idx.workEnd] || '') : '',
      period: parts[idx.per] || `${selectYear.value}-${selectMonth.value}`,
      note: parts[idx.note] || ''
    };
    await addTourRecord(t);
  }
  await renderTours();
  alert('Import abgeschlossen ✔');
  ev.target.value = '';
  await triggerAutoBackup('csv_import');
});

/* ========== Tour aus Formular speichern ========== */
bindById('addBtn', 'click', async ()=>{
  const month = selectMonth.value;
  const year = selectYear.value;
  const t = {
    id: document.getElementById('tourId').value || '—',
    date: document.getElementById('date').value || new Date().toISOString().slice(0,10),
    amount: readDecimalInput('amount'),
    umsatzvorgabe: readDecimalInput('umsatzvorgabe'),
    reklamation: readDecimalInput('reklamation'),
    gutscheine: readDecimalInput('gutscheine'),
    newC: Number(document.getElementById('newCustomers').value || 0),
    integrations: Number(document.getElementById('integrations').value || 0),
    schooldayCustomers: Number(document.getElementById('schooldayCustomers').value || 0),
    prevDayUnreachable: Number(document.getElementById('prevDayUnreachable').value || 0),
    prevDayBought: Number(document.getElementById('prevDayBought').value || 0),
    prevDayNi: Number(document.getElementById('prevDayNi').value || 0),
    prevDayKb: Number(document.getElementById('prevDayKb').value || 0),
    buyingCustomers: Number(document.getElementById('buyingCustomers').value || 0),
    tourdayNi: Number(document.getElementById('tourdayNi').value || 0),
    tourdayKb: Number(document.getElementById('tourdayKb').value || 0),
    tourdayCancelled: Number(document.getElementById('tourdayCancelled').value || 0),
    tourdayReserved: Number(document.getElementById('tourdayReserved').value || 0),
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
    einbringung: document.getElementById('einbringung').checked,
    note: document.getElementById('note').value || '',
    workStart: document.getElementById('workStart').value || '',
    tourStart: document.getElementById('tourStart').value || '',
    breakMinutes: Number(document.getElementById('breakMinutes').value || 45),
    tourEnd: document.getElementById('tourEnd').value || '',
    workEnd: document.getElementById('workEnd').value || '',
    actions: Array.from(document.querySelectorAll('#actionsList .action-row')).map(r=>({ price: Number(r.querySelector('.actPrice').value||0), qty: Number(r.querySelector('.actQty').value||0) })).filter(a=>a.price>0 && a.qty>0),
    period: `${year}-${month}`
  };
  await addTourRecord(t);
  document.getElementById('tourId').value=''; document.getElementById('amount').value=''; document.getElementById('umsatzvorgabe').value='0.00';
  document.getElementById('reklamation').value='0.00'; document.getElementById('gutscheine').value='0.00';
  document.getElementById('newCustomers').value=0; document.getElementById('integrations').value=0;
  document.getElementById('schooldayCustomers').value=0; document.getElementById('prevDayUnreachable').value=0;
  document.getElementById('prevDayBought').value=0; document.getElementById('prevDayNi').value=0; document.getElementById('prevDayKb').value=0;
  document.getElementById('buyingCustomers').value=0; document.getElementById('tourdayNi').value=0; document.getElementById('tourdayKb').value=0; document.getElementById('tourdayCancelled').value=0; document.getElementById('tourdayReserved').value=0; document.getElementById('integrationBought').value=0;
  document.getElementById('integrationUnreachable').value=0; document.getElementById('integrationNoNeed').value=0;
  document.getElementById('integrationCancelled').value=0; document.getElementById('integrationPreordered').value=0;
  document.getElementById('threeCustomersTotal').value=0; document.getElementById('threeCustomersBought').value=0; document.getElementById('threeCustomersNi').value=0;
  document.getElementById('threeCustomersKb').value=0; document.getElementById('threeCustomersCancelled').value=0; document.getElementById('threeCustomersPreordered').value=0;
  document.getElementById('note').value=''; renderActionsList([]);
  document.getElementById('workStart').value=''; document.getElementById('tourStart').value=''; document.getElementById('breakMinutes').value=45; document.getElementById('tourEnd').value=''; document.getElementById('workEnd').value='';
  document.getElementById('vertretung').checked=false; document.getElementById('fahrt45').checked=false; document.getElementById('einbringung').checked=false;
  await renderTours();
  await triggerAutoBackup('tour_added');
});

/* Formular leeren */
bindById('clearBtn', 'click', ()=>{
  document.getElementById('tourId').value=''; document.getElementById('amount').value=''; document.getElementById('umsatzvorgabe').value='0.00';
  document.getElementById('reklamation').value='0.00'; document.getElementById('gutscheine').value='0.00';
  document.getElementById('newCustomers').value=0; document.getElementById('integrations').value=0;
  document.getElementById('schooldayCustomers').value=0; document.getElementById('prevDayUnreachable').value=0;
  document.getElementById('prevDayBought').value=0; document.getElementById('prevDayNi').value=0; document.getElementById('prevDayKb').value=0;
  document.getElementById('buyingCustomers').value=0; document.getElementById('tourdayNi').value=0; document.getElementById('tourdayKb').value=0; document.getElementById('tourdayCancelled').value=0; document.getElementById('tourdayReserved').value=0; document.getElementById('integrationBought').value=0;
  document.getElementById('integrationUnreachable').value=0; document.getElementById('integrationNoNeed').value=0;
  document.getElementById('integrationCancelled').value=0; document.getElementById('integrationPreordered').value=0;
  document.getElementById('threeCustomersTotal').value=0; document.getElementById('threeCustomersBought').value=0; document.getElementById('threeCustomersNi').value=0;
  document.getElementById('threeCustomersKb').value=0; document.getElementById('threeCustomersCancelled').value=0; document.getElementById('threeCustomersPreordered').value=0;
  document.getElementById('note').value=''; renderActionsList([]);
  document.getElementById('workStart').value=''; document.getElementById('tourStart').value=''; document.getElementById('breakMinutes').value=45; document.getElementById('tourEnd').value=''; document.getElementById('workEnd').value='';
  document.getElementById('vertretung').checked=false; document.getElementById('fahrt45').checked=false; document.getElementById('einbringung').checked=false;
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
    const from = customerPrintFromInput?.value || '';
    const to = customerPrintToInput?.value || '';

    if(from && to && from > to){
      alert('Bitte einen gültigen Zeitraum wählen (Von-Datum darf nicht nach dem Bis-Datum liegen).');
      return;
    }

    printCustomerAgreements({ from, to }).catch(err => {
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

bindById('saveSettings', 'click', async ()=>{
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
bindById('savePaprov', 'click', async ()=>{
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
bindById('clearPaprov', 'click', async ()=>{
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
bindById('paprovMonth', 'change', async ()=>{
  const conf = await loadConfObj();
  const pm = document.getElementById('paprovMonth').value;
  document.getElementById('paprovValue').value = (conf.paprovPerMonth && conf.paprovPerMonth[pm] !== undefined) ? conf.paprovPerMonth[pm] : 0;
});

/* Kundenmanagement speichern/löschen */
bindById('saveLostCustomers', 'click', async ()=>{
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
bindById('clearLostCustomers', 'click', async ()=>{
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
bindById('lostCustomersMonth', 'change', async ()=>{
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
    freizeitausgleich: 'Freizeitausgleich',
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
    freizeitausgleich: 'tour-type-freizeitausgleich',
    krank: 'tour-type-krank',
    urlaub: 'tour-type-urlaub'
  };
  return classes[type] || 'tour-type-tourentag';
}

function parseTimeToMinutes(value){
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if(!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if(hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function minutesToHoursLabel(minutes){
  if(!Number.isFinite(minutes)) return '00:00 h';
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hoursPart = Math.floor(safeMinutes / 60);
  const minutesPart = safeMinutes % 60;
  return `${String(hoursPart).padStart(2, '0')}:${String(minutesPart).padStart(2, '0')} h`;
}

function formatTimeForDisplay(value){
  return value ? value : '—';
}

const REGULAR_WORK_MINUTES = (7 * 60) + 42;
const MAX_DAILY_WORK_MINUTES = 10 * 60;
const MIN_REST_MINUTES = 11 * 60;

function minutesToSignedHoursLabel(minutes){
  if(!Number.isFinite(minutes)) return '±00:00 h';
  const sign = minutes < 0 ? '-' : '+';
  const absoluteLabel = minutesToHoursLabel(Math.abs(minutes)).replace(' h', '');
  return `${sign}${absoluteLabel} h`;
}

function computeWorktimeForTour(tour){
  if(tour?.tourType === 'krank' || tour?.tourType === 'urlaub'){
    return {
      workMinutes: REGULAR_WORK_MINUTES,
      fieldMinutes: 0,
      breakMinutes: 0,
      overtimeMinutes: 0
    };
  }

  const workStart = parseTimeToMinutes(tour.workStart);
  const tourStart = parseTimeToMinutes(tour.tourStart);
  const tourEnd = parseTimeToMinutes(tour.tourEnd);
  const workEnd = parseTimeToMinutes(tour.workEnd);
  const breakMinutes = Math.max(0, Number(tour.breakMinutes || 0));

  let workMinutes = 0;
  if(workStart !== null && workEnd !== null && workEnd > workStart){
    workMinutes = Math.max(0, workEnd - workStart - breakMinutes);
  }

  let fieldMinutes = 0;
  if(tourStart !== null && tourEnd !== null && tourEnd > tourStart){
    fieldMinutes = Math.max(0, tourEnd - tourStart);
  }

  const overtimeMinutes = Math.max(0, workMinutes - REGULAR_WORK_MINUTES);
  return { workMinutes, fieldMinutes, breakMinutes, overtimeMinutes };
}

function toTimestampFromDateAndMinutes(dateValue, minutes){
  if(!dateValue || !Number.isFinite(minutes)) return null;
  const parsedDate = new Date(`${dateValue}T00:00:00`);
  if(Number.isNaN(parsedDate.getTime())) return null;
  parsedDate.setMinutes(parsedDate.getMinutes() + minutes);
  return parsedDate.getTime();
}

function collectWorktimeReportData(tours){
  const sortedTours = [...tours].sort(compareToursByDateDesc);
  const restViolationByTourKey = new Set();
  const toursByDateAsc = [...tours].sort((a, b)=> (a?.date || '').localeCompare(b?.date || ''));

  let previousDayEndTimestamp = null;
  toursByDateAsc.forEach((tour)=>{
    const workStart = parseTimeToMinutes(tour.workStart);
    const workEnd = parseTimeToMinutes(tour.workEnd);

    const startTimestamp = toTimestampFromDateAndMinutes(tour.date, workStart);
    const endTimestamp = toTimestampFromDateAndMinutes(tour.date, workEnd);

    if(startTimestamp !== null && previousDayEndTimestamp !== null){
      const restMinutes = Math.floor((startTimestamp - previousDayEndTimestamp) / 60000);
      if(restMinutes < MIN_REST_MINUTES){
        restViolationByTourKey.add(`${tour.date || ''}__${tour.id || ''}`);
      }
    }

    if(startTimestamp !== null && endTimestamp !== null && endTimestamp > startTimestamp){
      previousDayEndTimestamp = endTimestamp;
    }
  });

  let totalWorkMinutes = 0;
  let totalFieldMinutes = 0;
  let totalBreakMinutes = 0;
  let totalOvertimeMinutes = 0;
  let maxDailyExceededCount = 0;
  let restViolationCount = 0;

  const reportRows = sortedTours.map((tour)=>{
    const metrics = computeWorktimeForTour(tour);
    totalWorkMinutes += metrics.workMinutes;
    totalFieldMinutes += metrics.fieldMinutes;
    totalBreakMinutes += metrics.breakMinutes;
    totalOvertimeMinutes += metrics.overtimeMinutes;

    const exceedsDailyMax = metrics.workMinutes > MAX_DAILY_WORK_MINUTES;
    if(exceedsDailyMax) maxDailyExceededCount += 1;

    const tourKey = `${tour.date || ''}__${tour.id || ''}`;
    const violatesRestTime = restViolationByTourKey.has(tourKey);
    if(violatesRestTime) restViolationCount += 1;

    const deltaToTarget = metrics.workMinutes - REGULAR_WORK_MINUTES;
    return {
      tour,
      metrics,
      exceedsDailyMax,
      violatesRestTime,
      deltaToTarget
    };
  });

  const expectedMinutes = reportRows.length * REGULAR_WORK_MINUTES;
  const balanceMinutes = totalWorkMinutes - expectedMinutes;

  return {
    reportRows,
    totalWorkMinutes,
    totalFieldMinutes,
    totalBreakMinutes,
    totalOvertimeMinutes,
    expectedMinutes,
    balanceMinutes,
    maxDailyExceededCount,
    restViolationCount
  };
}

function buildWorktimeMonthlyReportHtml(data, meta = {}){
  const {
    reportRows,
    totalWorkMinutes,
    totalFieldMinutes,
    totalBreakMinutes,
    totalOvertimeMinutes,
    expectedMinutes,
    balanceMinutes,
    maxDailyExceededCount,
    restViolationCount
  } = data;

  const monthLabel = sanitizeForPdf(meta.monthLabel || 'Monat');
  const period = sanitizeForPdf(meta.period || '');
  const printedAt = new Date().toLocaleString('de-DE');
  const targetLabel = minutesToHoursLabel(expectedMinutes);
  const actualLabel = minutesToHoursLabel(totalWorkMinutes);
  const balanceLabel = minutesToSignedHoursLabel(balanceMinutes);
  const averageWorkLabel = reportRows.length ? minutesToHoursLabel(Math.round(totalWorkMinutes / reportRows.length)) : '00:00 h';

  const rowsHtml = reportRows.map((row)=>{
    const dateLabel = row.tour.date ? new Date(row.tour.date).toLocaleDateString('de-DE') : '—';
    const warningParts = [];
    if(row.exceedsDailyMax) warningParts.push('⛔ >10h');
    if(row.violatesRestTime) warningParts.push('🌙 <11h Ruhezeit');
    return `
      <tr>
        <td>${sanitizeForPdf(dateLabel)}</td>
        <td>${sanitizeForPdf(row.tour.id || '—')}</td>
        <td>${sanitizeForPdf(row.tour.tourType || '—')}</td>
        <td>${minutesToHoursLabel(REGULAR_WORK_MINUTES)}</td>
        <td>${minutesToHoursLabel(row.metrics.workMinutes)}</td>
        <td>${minutesToSignedHoursLabel(row.deltaToTarget)}</td>
        <td>${row.metrics.breakMinutes} Min</td>
        <td>${minutesToHoursLabel(row.metrics.fieldMinutes)}</td>
        <td>${sanitizeForPdf(warningParts.join(' · ') || '—')}</td>
      </tr>
    `;
  }).join('');

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>Arbeitszeit Monatsbericht</title>
  <style>
    :root {
      --text: #10243f;
      --muted: #4c6285;
      --line: #d5dfef;
      --head-bg: #1d3557;
      --head-text: #ffffff;
      --card-bg: #f5f9ff;
      --warning-bg: #fff4df;
    }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: var(--text); margin: 0; padding: 16px; }
    h1 { margin: 0 0 4px; font-size: 1.35rem; }
    .meta { margin: 0; color: var(--muted); font-size: 0.9rem; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px;
      margin: 14px 0;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card-bg);
      padding: 10px;
    }
    .card .label { display: block; font-size: 0.8rem; color: var(--muted); margin-bottom: 4px; }
    .card .value { font-size: 1.05rem; font-weight: 700; }
    .card.warning { background: var(--warning-bg); }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.86rem;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: var(--head-bg);
      color: var(--head-text);
      font-weight: 700;
      position: sticky;
      top: 0;
    }
    @media print {
      body { padding: 0; }
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <h1>Arbeitszeit-Monatsbericht</h1>
  <p class="meta">Monat: ${monthLabel}${period ? ` (${period})` : ''}</p>
  <p class="meta">Stand: ${sanitizeForPdf(printedAt)}</p>

  <section class="cards">
    <article class="card"><span class="label">Sollzeit gesamt</span><span class="value">${targetLabel}</span></article>
    <article class="card"><span class="label">Istzeit gesamt</span><span class="value">${actualLabel}</span></article>
    <article class="card"><span class="label">Mehr-/Minderarbeit</span><span class="value">${balanceLabel}</span></article>
    <article class="card"><span class="label">Überstunden gesamt</span><span class="value">${minutesToHoursLabel(totalOvertimeMinutes)}</span></article>
    <article class="card"><span class="label">Außendienstzeit</span><span class="value">${minutesToHoursLabel(totalFieldMinutes)}</span></article>
    <article class="card"><span class="label">Pausen gesamt</span><span class="value">${totalBreakMinutes} Min</span></article>
    <article class="card"><span class="label">Erfasste Tage</span><span class="value">${reportRows.length}</span></article>
    <article class="card"><span class="label">Ø Istzeit pro Tag</span><span class="value">${averageWorkLabel}</span></article>
    <article class="card warning"><span class="label">Warnungen</span><span class="value">${maxDailyExceededCount}× >10h · ${restViolationCount}× Ruhezeit</span></article>
  </section>

  <table>
    <thead>
      <tr>
        <th>Datum</th>
        <th>Tour</th>
        <th>Art</th>
        <th>Soll</th>
        <th>Ist</th>
        <th>Delta</th>
        <th>Pause</th>
        <th>Außendienst</th>
        <th>Hinweis</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="9">Keine Arbeitszeitdaten im ausgewählten Monat.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

async function printWorktimeMonthlyReport(){
  const monthFilter = `${selectYear?.value || ''}-${selectMonth?.value || ''}`;
  if(!/^\d{4}-\d{2}$/.test(monthFilter)){
    alert('Monat/Jahr ist ungültig. Bitte Auswahl prüfen.');
    return;
  }
  const popup = window.open('', '_blank');
  if(!popup || popup === window){
    alert('Drucken wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben.');
    return;
  }
  try{
    const allTours = await getAllTours();
    const tours = allTours.filter((tour)=> tour.period === monthFilter);
    const reportData = collectWorktimeReportData(tours);
    const monthLabel = new Date(`${monthFilter}-01T00:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const printHtml = buildWorktimeMonthlyReportHtml(reportData, { monthLabel, period: monthFilter });

    if(!openAndPrintDocument(printHtml, popup)){
      try { popup.close(); } catch(_err){ /* noop */ }
      alert('Drucken wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben.');
    }
  }catch(err){
    try { popup.close(); } catch(_err){ /* noop */ }
    throw err;
  }
}

function renderWorktime(tours){
  const summaryEl = document.getElementById('worktimeSummary');
  const listEl = document.getElementById('worktimeBubbleList');
  if(!summaryEl || !listEl) return;

  summaryEl.innerHTML = '';
  listEl.innerHTML = '';

  const reportData = collectWorktimeReportData(tours);

  reportData.reportRows.forEach((row) => {
    const { tour, metrics, exceedsDailyMax, violatesRestTime } = row;

    const card = document.createElement('details');
    card.className = 'tour-bubble-card';
    if(exceedsDailyMax || violatesRestTime){
      card.classList.add('tour-bubble-card--warning');
    }

    const summary = document.createElement('summary');
    summary.className = 'tour-bubble-summary';

    const topRow = document.createElement('div');
    topRow.className = 'tour-bubble-top-row';

    const dateLabel = tour.date ? new Date(tour.date).toLocaleDateString('de-DE') : 'Kein Datum';
    const title = document.createElement('div');
    title.className = 'tour-bubble-title';
    const markers = [];
    if(exceedsDailyMax) markers.push('⛔');
    if(violatesRestTime) markers.push('🌙');
    title.textContent = markers.length
      ? `${dateLabel} · ${tour.id || '—'} · ${markers.join(' · ')}`
      : `${dateLabel} · ${tour.id || '—'}`;

    const totalBadge = document.createElement('span');
    totalBadge.className = 'tour-type-badge';
    totalBadge.textContent = minutesToHoursLabel(metrics.workMinutes);

    topRow.append(title, totalBadge);
    summary.appendChild(topRow);

    const body = document.createElement('div');
    body.className = 'tour-bubble-body';
    const lines = [
      `Arbeitszeitbeginn: ${formatTimeForDisplay(tour.workStart)}`,
      `Tourenstart: ${formatTimeForDisplay(tour.tourStart)}`,
      `Pause: ${metrics.breakMinutes} Min`,
      `Tourenende: ${formatTimeForDisplay(tour.tourEnd)}`,
      `Arbeitszeitende: ${formatTimeForDisplay(tour.workEnd)}`,
      `Arbeitszeit (abzgl. Pause): ${minutesToHoursLabel(metrics.workMinutes)}`,
      `Überstunden: ${minutesToHoursLabel(metrics.overtimeMinutes)}`,
      `Außendienstzeit: ${minutesToHoursLabel(metrics.fieldMinutes)}`
    ];
    if(exceedsDailyMax){
      lines.push('⛔ Hinweis: Reguläre Tageshöchstarbeitszeit von 10 Stunden überschritten.');
    }
    if(violatesRestTime){
      lines.push('🌙 Hinweis: Ruhezeit unter 11 Stunden (Markierung am frühen Arbeitsbeginn).');
    }
    lines.forEach((line) => {
      const lineEl = document.createElement('div');
      lineEl.className = 'tour-bubble-detail-line';
      if(line.startsWith('⛔') || line.startsWith('🌙')){
        lineEl.classList.add('tour-bubble-detail-line--warning');
      }
      lineEl.textContent = line;
      body.appendChild(lineEl);
    });

    card.append(summary, body);
    listEl.appendChild(card);
  });

  summaryEl.append(
    createSumRow('❯ Sollzeit gesamt', minutesToHoursLabel(reportData.expectedMinutes)),
    createSumRow('❯ Istzeit gesamt (abzgl. Pausen)', minutesToHoursLabel(reportData.totalWorkMinutes)),
    createSumRow('❯ Mehr-/Minderarbeit', minutesToSignedHoursLabel(reportData.balanceMinutes)),
    createSumRow('❯ Überstunden gesamt', minutesToHoursLabel(reportData.totalOvertimeMinutes)),
    createSumRow('❯ Außendienstzeit gesamt', minutesToHoursLabel(reportData.totalFieldMinutes)),
    createSumRow('❯ Pausen gesamt', `${reportData.totalBreakMinutes} Min`)
  );
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

  // Sortierung anwenden (immer zusätzlich nach Datum)
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
      return compareToursByDateDesc(a, b);
    });
  } else {
    tours.sort(compareToursByDateDesc);
  }

  // Totals
  let totalUmsatzAllCents = 0, totalVGRevenueCents=0, countVGTours=0, countNeukundentouren=0;
  let totalIntegrationCents=0, totalSpesenCents=0, totalActionProvCents=0, totalPaprovCents=0, totalExtrasCents=0, totalFreizeitausgleichCents=0;

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

    totalIntegrationCents += computeIntegrationCents(t.integrationBought || 0, conf);
    const spC = computeSpesenCentsForTour(t, conf);
    totalSpesenCents += spC;
    totalActionProvCents += computeActionProvisionCents(t.actions || []);

    let extra=0;
    if(t.vertretung) extra += Math.round(tourTotalCents * 0.02);
    if(t.fahrt45) extra += Math.round(tourTotalCents * 0.0025);
    totalExtrasCents += extra;
    if(t.einbringung) totalFreizeitausgleichCents -= toCents(130);
    if(t.tourType === 'freizeitausgleich') totalFreizeitausgleichCents += toCents(130);

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
      const bubble = document.createElement('details');
      bubble.className = 'tour-bubble-card';

      const summary = document.createElement('summary');
      summary.className = 'tour-bubble-summary';

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
      summary.appendChild(topRow);

      const detailContainer = document.createElement('div');
      detailContainer.className = 'tour-bubble-details';
      const detailParts = [
        `Umsatz: ${fromCents(tourTotalCents)}`,
        `Umsatzvorgabe: ${Number(getRevenueTargetValue(t)).toFixed(2).replace('.', ',')} €`,
        `Reklamationen: ${fromCents(reklCents)}`,
        `Gutscheine: ${gutscheineDisplay(t.gutscheine)}`,
        `Neukunden: ${t.newC || 0}`,
        `Kunden: ${t.schooldayCustomers || 0}`,
        `NE Vortag: ${t.prevDayUnreachable || 0}`,
        `Integrationen: ${t.integrations || 0}`,
        `D3: ${t.threeCustomersTotal || 0}`,
        `Tourentag K/NE/KB/A/R: ${t.buyingCustomers || 0}/${t.tourdayNi || 0}/${t.tourdayKb || 0}/${t.tourdayCancelled || 0}/${t.tourdayReserved || 0}`,
        `Nachbearbeitung K/NE/KB: ${t.prevDayBought || 0}/${t.prevDayNi || 0}/${t.prevDayKb || 0}`,
        `Integration K/NE/KB/A/VB: ${t.integrationBought || 0}/${t.integrationUnreachable || 0}/${t.integrationNoNeed || 0}/${t.integrationCancelled || 0}/${t.integrationPreordered || 0}`,
        `D3 K/NE/KB/A/VB: ${t.threeCustomersBought || 0}/${t.threeCustomersNi || 0}/${t.threeCustomersKb || 0}/${t.threeCustomersCancelled || 0}/${t.threeCustomersPreordered || 0}`,
        `Spesen: ${fromCents(spC)}`,
        `Aktionen: ${actionsPieceCount} (${fromCents(actionsSumCents)})`,
        `Vertretung: ${t.vertretung ? 'Ja' : 'Nein'}`,
        `Entfernung >45 Min: ${t.fahrt45 ? 'Ja' : 'Nein'}`,
        `Einbringung: ${t.einbringung ? 'Ja' : 'Nein'}`
      ];
      detailParts.forEach(line=>{
        const detailLine = document.createElement('div');
        detailLine.className = 'tour-bubble-detail-line';
        detailLine.textContent = line;
        detailContainer.appendChild(detailLine);
      });

      const body = document.createElement('div');
      body.className = 'tour-bubble-body';

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
      body.append(detailContainer, controls);
      bubble.append(summary, body);
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

  const totalProvisionCents = vgProvisionCents + totalNeukCents + totalIntegrationCents + totalActionProvCents + totalPaprovCents + totalExtrasCents + totalFreizeitausgleichCents + kmBonusCents;
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
    createSumRow('❯ Freizeitausgleich', `€ ${fromCents(totalFreizeitausgleichCents)}`),
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
  renderWorktime(tours);
}


function collectTourdayStats(t){
  const kundenAnzahl = Number(t.schooldayCustomers || 0);
  const vortagNe = Number(t.prevDayUnreachable || 0);
  const kauf = Number(t.buyingCustomers || 0);
  const ne = Number(t.tourdayNi || 0);
  const kb = Number(t.tourdayKb || 0);
  const absage = Number(t.tourdayCancelled || 0);
  const reserviert = Number(t.tourdayReserved || 0);

  const vortagKauf = Number(t.prevDayBought || 0);
  const vortagNeStatus = Number(t.prevDayNi || 0);
  const vortagKb = Number(t.prevDayKb || 0);

  const integrationAnzahl = Number(t.integrations || 0);
  const integrationKauf = Number(t.integrationBought || 0);
  const integrationNe = Number(t.integrationUnreachable || 0);
  const integrationKb = Number(t.integrationNoNeed || 0);
  const integrationAbsage = Number(t.integrationCancelled || 0);
  const integrationReserviert = Number(t.integrationPreordered || 0);

  const d3Anzahl = Number(t.threeCustomersTotal || 0);
  const d3Kauf = Number(t.threeCustomersBought || 0);
  const d3Ne = Number(t.threeCustomersNi || 0);
  const d3Kb = Number(t.threeCustomersKb || 0);
  const d3Absage = Number(t.threeCustomersCancelled || 0);
  const d3Reserviert = Number(t.threeCustomersPreordered || 0);
  const verkaufteAktionen = (t.actions && t.actions.length)
    ? t.actions.reduce((sum, action) => sum + Number(action.qty || 0), 0)
    : 0;

  return {
    kundenAnzahl,
    vortagNe,
    kauf,
    ne,
    kb,
    absage,
    reserviert,
    vortagKauf,
    vortagNeStatus,
    vortagKb,
    integrationAnzahl,
    integrationKauf,
    integrationNe,
    integrationKb,
    integrationAbsage,
    integrationReserviert,
    d3Anzahl,
    d3Kauf,
    d3Ne,
    d3Kb,
    d3Absage,
    d3Reserviert,
    verkaufteAktionen,
  };
}

function formatStatsCount(value){
  const numericValue = Number(value || 0);
  if(!Number.isFinite(numericValue)) return '0';
  return numericValue.toLocaleString('de-DE');
}

function calculatePercent(value, total){
  const numericValue = Number(value || 0);
  const numericTotal = Number(total || 0);
  if(!Number.isFinite(numericValue) || !Number.isFinite(numericTotal) || numericTotal <= 0){
    return '0,0';
  }
  return ((numericValue / numericTotal) * 100).toFixed(1).replace('.', ',');
}

function calculateActionRatePercent(soldActions, customers){
  const numericSoldActions = Number(soldActions || 0);
  const numericCustomers = Number(customers || 0);
  if(!Number.isFinite(numericSoldActions) || !Number.isFinite(numericCustomers) || numericCustomers <= 0){
    return '0,0';
  }
  return ((numericSoldActions / numericCustomers) * 100).toFixed(1).replace('.', ',');
}

function createStatsMetricRow(label, value, total){
  const percent = `${calculatePercent(value, total)} %`;
  const row = document.createElement('div');
  row.className = 'statsMetricRow';

  const normalizedLabel = String(label || '').trim().toLowerCase();
  const statusColorClass = {
    kauf: 'statsMetric--kauf',
    ne: 'statsMetric--ne',
    kb: 'statsMetric--kb',
    absage: 'statsMetric--absage',
    reserviert: 'statsMetric--reservierung',
    reservierung: 'statsMetric--reservierung'
  }[normalizedLabel] || '';
  if(statusColorClass) row.classList.add(statusColorClass);

  const labelEl = document.createElement('span');
  labelEl.className = 'statsMetricLabel';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'statsMetricValue';
  valueEl.textContent = formatStatsCount(value);

  const percentEl = document.createElement('span');
  percentEl.className = 'statsMetricPercent';
  percentEl.textContent = percent;

  row.append(labelEl, valueEl, percentEl);
  return row;
}

function createStatsCard(title, total, metrics, accentClass = ''){
  const card = document.createElement('article');
  card.className = `statsCard ${accentClass}`.trim();

  const header = document.createElement('div');
  header.className = 'statsCardHeader';
  header.innerHTML = `<h4>${title}</h4><span class="statsCardTotal">${formatStatsCount(total)}</span>`;

  const body = document.createElement('div');
  body.className = 'statsCardBody';
  metrics.forEach(metric => {
    body.appendChild(createStatsMetricRow(metric.label, metric.value, total));
  });

  card.append(header, body);
  return card;
}

function createEmptyTourdayTotals(){
  return {
    kundenAnzahl: 0,
    vortagNe: 0,
    vortagKauf: 0,
    vortagNeStatus: 0,
    vortagKb: 0,
    kauf: 0,
    ne: 0,
    kb: 0,
    absage: 0,
    reserviert: 0,
    integrationAnzahl: 0,
    integrationKauf: 0,
    integrationNe: 0,
    integrationKb: 0,
    integrationAbsage: 0,
    integrationReserviert: 0,
    d3Anzahl: 0,
    d3Kauf: 0,
    d3Ne: 0,
    d3Kb: 0,
    d3Absage: 0,
    d3Reserviert: 0,
    verkaufteAktionen: 0,
  };
}

function mergeTourdayTotals(target, stats){
  target.kundenAnzahl += stats.kundenAnzahl;
  target.vortagNe += stats.vortagNe;
  target.vortagKauf += stats.vortagKauf;
  target.vortagNeStatus += stats.vortagNeStatus;
  target.vortagKb += stats.vortagKb;
  target.kauf += stats.kauf;
  target.ne += stats.ne;
  target.kb += stats.kb;
  target.absage += stats.absage;
  target.reserviert += stats.reserviert;

  target.integrationAnzahl += stats.integrationAnzahl;
  target.integrationKauf += stats.integrationKauf;
  target.integrationNe += stats.integrationNe;
  target.integrationKb += stats.integrationKb;
  target.integrationAbsage += stats.integrationAbsage;
  target.integrationReserviert += stats.integrationReserviert;

  target.d3Anzahl += stats.d3Anzahl;
  target.d3Kauf += stats.d3Kauf;
  target.d3Ne += stats.d3Ne;
  target.d3Kb += stats.d3Kb;
  target.d3Absage += stats.d3Absage;
  target.d3Reserviert += stats.d3Reserviert;
  target.verkaufteAktionen += stats.verkaufteAktionen;
}


function buildRevenueTargetGapInfo(orderValue = 0, targetValue = 0){
  const safeOrderValue = Number(orderValue) || 0;
  const safeTargetValue = Number(targetValue) || 0;
  const gapValue = safeOrderValue - safeTargetValue;
  const sign = gapValue >= 0 ? '+' : '-';
  const absGap = Math.abs(gapValue);
  const percent = safeTargetValue > 0 ? (absGap / safeTargetValue) * 100 : 0;

  return {
    className: gapValue >= 0 ? 'statsRevenueTarget--above' : 'statsRevenueTarget--below',
    valueText: `${sign}${absGap.toFixed(2).replace('.', ',')} € (${percent.toFixed(2).replace('.', ',')}%)`,
  };
}

function getRevenueTargetValue(tour = {}){
  const rawValue = tour.umsatzvorgabe ?? tour.umsatzVorgabe ?? 0;
  return Number(rawValue) || 0;
}

function normalizeRevenueTargetField(tour = {}){
  const normalizedValue = getRevenueTargetValue(tour);
  tour.umsatzvorgabe = normalizedValue;
  if(Object.prototype.hasOwnProperty.call(tour, 'umsatzVorgabe')){
    delete tour.umsatzVorgabe;
  }
  return normalizedValue;
}

function createStatsDashboard(totals, averageOrderValue, revenueTargetModel){
  const dashboard = document.createElement('div');
  dashboard.className = 'statsDashboard';

  dashboard.append(
    createStatsCard('Anzahl Kunden', totals.kundenAnzahl, [
      { label: 'Kauf', value: totals.kauf },
      { label: 'NE', value: totals.ne },
      { label: 'KB', value: totals.kb },
      { label: 'Absage', value: totals.absage },
      { label: 'Reserviert', value: totals.reserviert },
    ], 'statsCard--primary'),
    createStatsCard('Vortag NE', totals.vortagNe, [
      { label: 'Kauf', value: totals.vortagKauf },
      { label: 'NE', value: totals.vortagNeStatus },
      { label: 'KB', value: totals.vortagKb },
    ], 'statsCard--secondary'),
    createStatsCard('Integrationen', totals.integrationAnzahl, [
      { label: 'Kauf', value: totals.integrationKauf },
      { label: 'NE', value: totals.integrationNe },
      { label: 'KB', value: totals.integrationKb },
      { label: 'Absage', value: totals.integrationAbsage },
      { label: 'Reserviert', value: totals.integrationReserviert },
    ], 'statsCard--success'),
    createStatsCard('D3', totals.d3Anzahl, [
      { label: 'Kauf', value: totals.d3Kauf },
      { label: 'NE', value: totals.d3Ne },
      { label: 'KB', value: totals.d3Kb },
      { label: 'Absage', value: totals.d3Absage },
      { label: 'Reserviert', value: totals.d3Reserviert },
    ], 'statsCard--warning'),
  );

  const verkaufteAktionen = formatStatsCount(totals.verkaufteAktionen);
  const aktionsquote = calculateActionRatePercent(totals.verkaufteAktionen, totals.kundenAnzahl);

  const highlightMetrics = document.createElement('div');
  highlightMetrics.className = 'statsHighlightMetrics';
  const revenueTargetInfo = buildRevenueTargetGapInfo(
    revenueTargetModel?.orderValue || 0,
    revenueTargetModel?.target || 0,
  );

  highlightMetrics.innerHTML = `
    <article class="statsHighlightBubble">
      <span>Auftragswert</span>
      <strong>${averageOrderValue.toFixed(2).replace('.', ',')} €</strong>
    </article>
    <article class="statsHighlightBubble statsRevenueTarget ${revenueTargetInfo.className}">
      <span>Tourenvorgabe</span>
      <strong>${revenueTargetInfo.valueText}</strong>
    </article>
    <article class="statsHighlightBubble">
      <span>Aktionsquote</span>
      <strong>${verkaufteAktionen} (${aktionsquote} %)</strong>
    </article>
  `;
  dashboard.appendChild(highlightMetrics);

  return dashboard;
}


function buildTourdayStatsModels(tours = []){
  const tourdays = tours.filter(t => t.tourType === 'tourentag');

  const totals = createEmptyTourdayTotals();
  tourdays.forEach(t => mergeTourdayTotals(totals, collectTourdayStats(t)));

  const totalOrderValue = tourdays.reduce((sum, t) => {
    const base = Number(t.amount || 0);
    const rekl = Number(t.reklamation || 0);
    const guts = Number(t.gutscheine || 0);
    return sum + base + rekl + guts;
  }, 0);

  const totalRevenueTarget = tourdays.reduce((sum, t) => sum + getRevenueTargetValue(t), 0);

  const totalBuyingCustomersForOrderValue = totals.kauf;
  const averageOrderValue = totalBuyingCustomersForOrderValue > 0
    ? totalOrderValue / totalBuyingCustomersForOrderValue
    : 0;

  const byDate = new Map();
  tourdays.forEach(t => {
    const key = t.date || 'ohne-datum';
    if(!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(t);
  });

  const perDay = [...byDate.keys()]
    .sort((a,b)=> b.localeCompare(a))
    .map(dateKey => {
      const entries = byDate.get(dateKey) || [];
      const dayTotals = createEmptyTourdayTotals();
      entries.forEach(t => mergeTourdayTotals(dayTotals, collectTourdayStats(t)));

      const dayOrderValue = entries.reduce((sum, t) => {
        const base = Number(t.amount || 0);
        const rekl = Number(t.reklamation || 0);
        const guts = Number(t.gutscheine || 0);
        return sum + base + rekl + guts;
      }, 0);
      const dayRevenueTarget = entries.reduce((sum, t) => sum + getRevenueTargetValue(t), 0);
      const dayBuyingCustomers = dayTotals.kauf;
      const dayAverageOrderValue = dayBuyingCustomers > 0 ? dayOrderValue / dayBuyingCustomers : 0;

      return {
        dateKey,
        entries,
        totals: dayTotals,
        averageOrderValue: dayAverageOrderValue,
        revenueTargetModel: {
          orderValue: dayOrderValue,
          target: dayRevenueTarget,
        },
      };
    });

  return {
    tourdays,
    cumulative: {
      totals,
      averageOrderValue,
      revenueTargetModel: {
        orderValue: totalOrderValue,
        target: totalRevenueTarget,
      },
    },
    perDay,
  };
}

function formatStatsDate(dateKey){
  if(dateKey === 'ohne-datum') return 'Ohne Datum';
  const parsed = new Date(`${dateKey}T00:00:00`);
  if(Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString('de-DE');
}

function toDateInputValue(date){
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value){
  if(!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getMonthDateRange(){
  const year = Number(selectYear?.value || new Date().getFullYear());
  const monthIndex = Math.max(0, Number(selectMonth?.value || 1) - 1);
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
  };
}

function normalizeStatsRange(range, { writeToInputs = false } = {}){
  const monthRange = getMonthDateRange();
  let from = range?.from || monthRange.from;
  let to = range?.to || monthRange.to;

  if(from > to){
    [from, to] = [to, from];
  }

  if(from < monthRange.from) from = monthRange.from;
  if(to > monthRange.to) to = monthRange.to;

  if(writeToInputs){
    if(statsRangeFromInput) statsRangeFromInput.value = from;
    if(statsRangeToInput) statsRangeToInput.value = to;
  }

  const isFullMonth = from === monthRange.from && to === monthRange.to;
  const fromDate = parseDateInput(from);
  const toDate = parseDateInput(to);
  const label = isFullMonth
    ? 'gesamter Monat'
    : `${fromDate ? fromDate.toLocaleDateString('de-DE') : from} bis ${toDate ? toDate.toLocaleDateString('de-DE') : to}`;

  return { from, to, monthRange, label };
}

function getDraftStatsRange(){
  if(!statsRangeFromInput || !statsRangeToInput){
    return normalizeStatsRange({});
  }
  return normalizeStatsRange({
    from: statsRangeFromInput.value,
    to: statsRangeToInput.value,
  }, { writeToInputs: true });
}

function syncStatsApplyButtonState(){
  if(!statsRangeApplyBtn) return;
  statsRangeApplyBtn.disabled = !statsRangeDirty;
}

function syncStatsRangeToMonth(){
  const monthRange = getMonthDateRange();
  if(statsRangeFromInput) statsRangeFromInput.value = monthRange.from;
  if(statsRangeToInput) statsRangeToInput.value = monthRange.to;
  appliedStatsRange = normalizeStatsRange(monthRange, { writeToInputs: true });
  statsRangeDirty = false;
  syncStatsApplyButtonState();
  updateStatsPeriodHint();
}

function markStatsRangeAsDirty(){
  statsRangeDirty = true;
  syncStatsApplyButtonState();
  updateStatsPeriodHint();
}

function applyStatsRangeSelection(){
  appliedStatsRange = getDraftStatsRange();
  statsRangeDirty = false;
  syncStatsApplyButtonState();
  updateStatsPeriodHint();
}

function getSelectedStatsRange(){
  if(!appliedStatsRange){
    appliedStatsRange = getDraftStatsRange();
  }
  return appliedStatsRange;
}

function isTourWithinStatsRange(tour, range){
  const tourDate = parseDateInput(normalizeDateValue(tour?.date));
  const fromDate = parseDateInput(range.from);
  const toDate = parseDateInput(range.to);
  if(!tourDate || !fromDate || !toDate) return false;
  return tourDate >= fromDate && tourDate <= toDate;
}

function updateStatsPeriodHint(){
  if(!statsPeriodHint) return;
  const range = getSelectedStatsRange();
  const pendingSuffix = statsRangeDirty ? ' (Änderung noch nicht übernommen)' : '';
  statsPeriodHint.textContent = `Zeitraum: ${range.label}${pendingSuffix}`;
}

function ensureStatsRangeApplyButton(){
  if(statsRangeApplyBtn || !statsRangeResetBtn) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'statsRangeApply';
  btn.className = 'small statsApplyButton';
  btn.textContent = 'Zeitraum übernehmen';
  statsRangeResetBtn.insertAdjacentElement('afterend', btn);
  statsRangeApplyBtn = btn;
}

async function printTourStats(mode = 'cumulative'){
  const allTours = await getAllTours();
  const monthFilter = `${selectYear.value}-${selectMonth.value}`;
  const monthTours = allTours.filter(t => t.period === monthFilter);
  const selectedRange = getSelectedStatsRange();
  const statsTours = monthTours.filter(t => isTourWithinStatsRange(t, selectedRange));
  const statsModel = buildTourdayStatsModels(statsTours);

  if(!statsModel.tourdays.length){
    alert('Keine Tourentage für die Statistik im ausgewählten Zeitraum vorhanden.');
    return;
  }

  const monthLabel = `${selectMonth.options[selectMonth.selectedIndex].text} ${selectYear.value}`;
  const periodLabel = selectedRange.label === 'gesamter Monat' ? monthLabel : `${monthLabel} (${selectedRange.label})`;

  const sections = [];
  if(mode === 'perTour'){
    statsModel.perDay.forEach(day => {
      sections.push(`
        <section class="print-page">
          <h2>Tour vom ${formatStatsDate(day.dateKey)}</h2>
          <p class="meta">${day.entries.length} Tour${day.entries.length === 1 ? '' : 'en'} im Zeitraum ${periodLabel}</p>
          ${createStatsDashboard(day.totals, day.averageOrderValue, day.revenueTargetModel).outerHTML}
        </section>
      `);
    });
  } else {
    sections.push(`
      <section class="print-page">
        <h2>Kumulierte Statistik</h2>
        <p class="meta">Zeitraum: ${periodLabel}</p>
        ${createStatsDashboard(statsModel.cumulative.totals, statsModel.cumulative.averageOrderValue, statsModel.cumulative.revenueTargetModel).outerHTML}
      </section>
    `);
  }

  const printHtml = `<!doctype html>
  <html lang="de">
    <head>
      <meta charset="utf-8" />
      <title>Statistik drucken</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; margin: 18px; color: #0b2f6b; }
        h1 { margin: 0 0 14px; font-size: 1.2rem; }
        h2 { margin: 0 0 8px; font-size: 1.05rem; color: #123d84; }
        .meta { margin: 0 0 10px; color: #4d6ea6; font-size: 0.92rem; }
        .print-page { margin-bottom: 22px; break-after: page; page-break-after: always; }
        .print-page:last-of-type { break-after: auto; page-break-after: auto; }
        .statsDashboard { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .statsCard { border: 1px solid #d8e6ff; border-radius: 10px; background: #fff; overflow: hidden; }
        .statsCardHeader { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid #e3edff; font-weight: 700; }
        .statsCardHeader h4 { margin: 0; }
        .statsCardTotal { color: #284f9c; }
        .statsCardBody { padding: 6px 10px 8px; }
        .statsMetricRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(70px, auto) minmax(60px, auto);
          align-items: baseline;
          column-gap: 10px;
          padding: 4px 0;
          border-top: 1px dashed #e8efff;
        }
        .statsMetricRow:first-child { border-top: none; }
        .statsMetricLabel { color: #324d83; font-weight: 600; text-align: left; }
        .statsMetricValue { color: #12336a; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
        .statsMetricPercent { color: #5a71a1; font-size: 0.88rem; text-align: right; font-variant-numeric: tabular-nums; }
        .statsMetric--kauf .statsMetricLabel,
        .statsMetric--kauf .statsMetricValue { color: #2f9a43; }
        .statsMetric--ne .statsMetricLabel,
        .statsMetric--ne .statsMetricValue { color: #f57c00; }
        .statsMetric--kb .statsMetricLabel,
        .statsMetric--kb .statsMetricValue { color: #6b7280; }
        .statsMetric--absage .statsMetricLabel,
        .statsMetric--absage .statsMetricValue { color: #cf233d; }
        .statsMetric--reservierung .statsMetricLabel,
        .statsMetric--reservierung .statsMetricValue { color: #b58900; }
        .statsCard--primary .statsCardHeader { background: linear-gradient(180deg, #e8f2ff 0%, #dcecff 100%); }
        .statsCard--secondary .statsCardHeader { background: linear-gradient(180deg, #eff3ff 0%, #e5ebff 100%); }
        .statsCard--success .statsCardHeader { background: linear-gradient(180deg, #ebf9f2 0%, #def3e9 100%); }
        .statsCard--warning .statsCardHeader { background: linear-gradient(180deg, #fff7ea 0%, #fff0d8 100%); }
        .statsHighlightMetrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 6px;
        }
        .statsHighlightBubble {
          border: 1px solid #d7e4ff;
          border-radius: 10px;
          background: #f7faff;
          padding: 10px;
        }
        .statsHighlightBubble span { color: #204c95; font-weight: 700; }
        .statsHighlightBubble strong { color: #07387f; font-size: 1.2rem; }
        .statsRevenueTarget--above strong { color: #12803a; }
        .statsRevenueTarget--below strong { color: #c62828; }
        .statsOrderValueCard { border: 1px solid #d8e6ff; border-radius: 10px; padding: 10px; }
        .statsOrderValueCard strong { display:block; margin-top: 4px; font-size: 1.2rem; }
        @media print {
          body { margin: 0.4cm; }
          .print-page { margin-bottom: 0; }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <h1>Tourenstatistik</h1>
      ${sections.join('')}
    </body>
  </html>`;

  if(!openAndPrintDocument(printHtml)){
    alert('Druckfenster konnte nicht geöffnet werden.');
  }
}

async function printSingleTourStatsByDate(dateKey){
  const allTours = await getAllTours();
  const monthFilter = `${selectYear.value}-${selectMonth.value}`;
  const monthTours = allTours.filter(t => t.period === monthFilter);
  const selectedRange = getSelectedStatsRange();
  const statsTours = monthTours.filter(t => isTourWithinStatsRange(t, selectedRange));
  const statsModel = buildTourdayStatsModels(statsTours);
  const day = statsModel.perDay.find(entry => entry.dateKey === dateKey);

  if(!day){
    alert('Für diesen Tourtag wurden keine Daten gefunden.');
    return;
  }

  const monthLabel = `${selectMonth.options[selectMonth.selectedIndex].text} ${selectYear.value}`;
  const periodLabel = selectedRange.label === 'gesamter Monat' ? monthLabel : `${monthLabel} (${selectedRange.label})`;
  const sectionHtml = `
    <section class="print-page">
      <h2>Tour vom ${formatStatsDate(day.dateKey)}</h2>
      <p class="meta">${day.entries.length} Tour${day.entries.length === 1 ? '' : 'en'} im Zeitraum ${periodLabel}</p>
      ${createStatsDashboard(day.totals, day.averageOrderValue, day.revenueTargetModel).outerHTML}
    </section>
  `;

  const printHtml = `<!doctype html>
  <html lang="de">
    <head>
      <meta charset="utf-8" />
      <title>Tourstatistik drucken</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; margin: 18px; color: #0b2f6b; }
        h1 { margin: 0 0 14px; font-size: 1.2rem; }
        h2 { margin: 0 0 8px; font-size: 1.05rem; color: #123d84; }
        .meta { margin: 0 0 10px; color: #4d6ea6; font-size: 0.92rem; }
        .print-page { margin-bottom: 22px; }
        .statsDashboard { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .statsCard { border: 1px solid #d8e6ff; border-radius: 10px; background: #fff; overflow: hidden; }
        .statsCardHeader { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid #e3edff; font-weight: 700; }
        .statsCardHeader h4 { margin: 0; }
        .statsCardTotal { color: #284f9c; }
        .statsCardBody { padding: 6px 10px 8px; }
        .statsMetricRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(70px, auto) minmax(60px, auto);
          align-items: baseline;
          column-gap: 10px;
          padding: 4px 0;
          border-top: 1px dashed #e8efff;
        }
        .statsMetricRow:first-child { border-top: none; }
        .statsMetricLabel { color: #324d83; font-weight: 600; text-align: left; }
        .statsMetricValue { color: #12336a; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
        .statsMetricPercent { color: #5a71a1; font-size: 0.88rem; text-align: right; font-variant-numeric: tabular-nums; }
        .statsMetric--kauf .statsMetricLabel,
        .statsMetric--kauf .statsMetricValue { color: #2f9a43; }
        .statsMetric--ne .statsMetricLabel,
        .statsMetric--ne .statsMetricValue { color: #f57c00; }
        .statsMetric--kb .statsMetricLabel,
        .statsMetric--kb .statsMetricValue { color: #6b7280; }
        .statsMetric--absage .statsMetricLabel,
        .statsMetric--absage .statsMetricValue { color: #cf233d; }
        .statsMetric--reservierung .statsMetricLabel,
        .statsMetric--reservierung .statsMetricValue { color: #b58900; }
        .statsCard--primary .statsCardHeader { background: linear-gradient(180deg, #e8f2ff 0%, #dcecff 100%); }
        .statsCard--secondary .statsCardHeader { background: linear-gradient(180deg, #eff3ff 0%, #e5ebff 100%); }
        .statsCard--success .statsCardHeader { background: linear-gradient(180deg, #ebf9f2 0%, #def3e9 100%); }
        .statsCard--warning .statsCardHeader { background: linear-gradient(180deg, #fff7ea 0%, #fff0d8 100%); }
        .statsHighlightMetrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 6px;
        }
        .statsHighlightBubble {
          border: 1px solid #d7e4ff;
          border-radius: 10px;
          background: #f7faff;
          padding: 10px;
        }
        .statsHighlightBubble span { color: #204c95; font-weight: 700; }
        .statsHighlightBubble strong { color: #07387f; font-size: 1.2rem; }
        .statsRevenueTarget--above strong { color: #12803a; }
        .statsRevenueTarget--below strong { color: #c62828; }
        .statsOrderValueCard { border: 1px solid #d8e6ff; border-radius: 10px; padding: 10px; }
        .statsOrderValueCard strong { display:block; margin-top: 4px; font-size: 1.2rem; }
        @media print {
          body { margin: 0.4cm; }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <h1>Tourenstatistik</h1>
      ${sectionHtml}
    </body>
  </html>`;

  if(!openAndPrintDocument(printHtml)){
    alert('Druckfenster konnte nicht geöffnet werden.');
  }
}

function renderStatsSummary(tours){
  const statsContent = document.getElementById('statsContent');
  if(!statsContent) return;

  const selectedRange = getSelectedStatsRange();
  const filteredTours = tours.filter(t => isTourWithinStatsRange(t, selectedRange));
  const statsModel = buildTourdayStatsModels(filteredTours);

  statsContent.innerHTML = '';
  statsContent.className = 'statsContentStack';

  const cumulativeSection = document.createElement('div');
  cumulativeSection.className = 'statsSection';
  cumulativeSection.appendChild(createStatsDashboard(statsModel.cumulative.totals, statsModel.cumulative.averageOrderValue, statsModel.cumulative.revenueTargetModel));
  statsContent.appendChild(cumulativeSection);

  if(!statsModel.tourdays.length){
    return;
  }

  const perDayWrapper = document.createElement('div');
  perDayWrapper.className = 'statsPerDayList';

  statsModel.perDay.forEach((day, idx) => {
    const details = document.createElement('details');
    details.className = 'statsDayDetails';
    if(idx === 0) details.open = true;

    const summary = document.createElement('summary');
    summary.className = 'statsDaySummary';

    const summaryMain = document.createElement('span');
    summaryMain.className = 'statsDaySummaryMain';
    summaryMain.innerHTML = `<span>${formatStatsDate(day.dateKey)}</span><small>${day.entries.length} Tour${day.entries.length === 1 ? '' : 'en'}</small>`;

    const summaryActions = document.createElement('span');
    summaryActions.className = 'statsDaySummaryActions';

    const printBtn = document.createElement('button');
    printBtn.type = 'button';
    printBtn.className = 'statsIconButton';
    printBtn.textContent = '🖨️';
    printBtn.title = `Tour vom ${formatStatsDate(day.dateKey)} drucken`;
    printBtn.setAttribute('aria-label', printBtn.title);
    printBtn.addEventListener('click', (evt)=>{
      evt.preventDefault();
      evt.stopPropagation();
      printSingleTourStatsByDate(day.dateKey).catch(err => {
        console.error('Tourstatistik drucken fehlgeschlagen', err);
        alert('Tourstatistik konnte nicht gedruckt werden.');
      });
    });

    summaryActions.appendChild(printBtn);
    summary.append(summaryMain, summaryActions);

    details.append(summary, createStatsDashboard(day.totals, day.averageOrderValue, day.revenueTargetModel));
    perDayWrapper.appendChild(details);
  });

  statsContent.appendChild(perDayWrapper);
}



/* ========== Edit-Modal ========== */
let currentEditingKey = null;

function getEditElement(id){
  const direct = document.getElementById(id);
  if(direct) return direct;
  const fallbackId = id.replace(/^edit([A-Z])/, (_, first)=> first.toLowerCase());
  return document.getElementById(fallbackId);
}

function setEditValue(id, value){
  const el = getEditElement(id);
  if(el) el.value = value;
}

function getEditValue(id, fallback = ''){
  const el = getEditElement(id);
  return el ? el.value : fallback;
}

function getEditChecked(id){
  const el = getEditElement(id);
  return !!el?.checked;
}

function openEditModalFor(entry, key){
  currentEditingKey = key;
  setEditValue('editId', entry.id || '');
  setEditValue('editDate', entry.date || '');
  setEditValue('editTourType', entry.tourType || 'tourentag');
  setEditValue('editAmount', entry.amount || 0);
  setEditValue('editUmsatzvorgabe', normalizeRevenueTargetField(entry));
  setEditValue('editReklamation', entry.reklamation || 0);
  setEditValue('editGutscheine', entry.gutscheine || 0);
  setEditValue('editNewC', entry.newC || 0);
  setEditValue('editIntegrations', entry.integrations || 0);
  setEditValue('editSchooldayCustomers', entry.schooldayCustomers || 0);
  setEditValue('editPrevDayUnreachable', entry.prevDayUnreachable || 0);
  setEditValue('editPrevDayBought', entry.prevDayBought || 0);
  setEditValue('editPrevDayNi', entry.prevDayNi || 0);
  setEditValue('editPrevDayKb', entry.prevDayKb || 0);
  setEditValue('editBuyingCustomers', entry.buyingCustomers || 0);
  setEditValue('editTourdayNi', entry.tourdayNi || 0);
  setEditValue('editTourdayKb', entry.tourdayKb || 0);
  setEditValue('editTourdayCancelled', entry.tourdayCancelled || 0);
  setEditValue('editTourdayReserved', entry.tourdayReserved || 0);
  setEditValue('editIntegrationBought', entry.integrationBought || 0);
  setEditValue('editIntegrationUnreachable', entry.integrationUnreachable || 0);
  setEditValue('editIntegrationNoNeed', entry.integrationNoNeed || 0);
  setEditValue('editIntegrationCancelled', entry.integrationCancelled || 0);
  setEditValue('editIntegrationPreordered', entry.integrationPreordered || 0);
  setEditValue('editThreeCustomersTotal', entry.threeCustomersTotal || 0);
  setEditValue('editThreeCustomersBought', entry.threeCustomersBought || 0);
  setEditValue('editThreeCustomersNi', entry.threeCustomersNi || 0);
  setEditValue('editThreeCustomersKb', entry.threeCustomersKb || 0);
  setEditValue('editThreeCustomersCancelled', entry.threeCustomersCancelled || 0);
  setEditValue('editThreeCustomersPreordered', entry.threeCustomersPreordered || 0);
  const vertretungEl = getEditElement('editVertretung');
  if(vertretungEl) vertretungEl.checked = !!entry.vertretung;
  const fahrt45El = getEditElement('editFahrt45');
  if(fahrt45El) fahrt45El.checked = !!entry.fahrt45;
  const einbringungEl = getEditElement('editEinbringung');
  if(einbringungEl) einbringungEl.checked = !!entry.einbringung;
  setEditValue('editActionsDetail', (entry.actions && entry.actions.length) ? JSON.stringify(entry.actions) : '');
  setEditValue('editNote', entry.note || '');
  setEditValue('editWorkStart', entry.workStart || '');
  setEditValue('editTourStart', entry.tourStart || '');
  setEditValue('editBreakMinutes', Number(entry.breakMinutes ?? 45));
  setEditValue('editTourEnd', entry.tourEnd || '');
  setEditValue('editWorkEnd', entry.workEnd || '');
  document.getElementById('editModal').classList.add('active');
}
bindById('cancelEdit', 'click', ()=> { document.getElementById('editModal').classList.remove('active'); currentEditingKey = null; });
bindById('saveEdit', 'click', async ()=>{
  if(currentEditingKey === null) return;
  const all = await idbGetAll('tours');
  const idx = all.findIndex(x=> x.idAuto === currentEditingKey);
  if(idx === -1) return;
  const t = all[idx];
  t.id = getEditValue('editId') || t.id;
  t.date = getEditValue('editDate') || t.date;
  t.tourType = getEditValue('editTourType');
  t.amount = readDecimalInput('editAmount');
  t.umsatzvorgabe = readDecimalInput('editUmsatzvorgabe');
  if(Object.prototype.hasOwnProperty.call(t, 'umsatzVorgabe')){
    delete t.umsatzVorgabe;
  }
  t.reklamation = readDecimalInput('editReklamation');
  t.gutscheine = readDecimalInput('editGutscheine');
  t.newC = Number(document.getElementById('editNewC').value || 0);
  t.integrations = Number(document.getElementById('editIntegrations').value || 0);
  t.schooldayCustomers = Number(getEditValue('editSchooldayCustomers', '0') || 0);
  t.prevDayUnreachable = Number(getEditValue('editPrevDayUnreachable', '0') || 0);
  t.prevDayBought = Number(getEditValue('editPrevDayBought', '0') || 0);
  t.prevDayNi = Number(getEditValue('editPrevDayNi', '0') || 0);
  t.prevDayKb = Number(getEditValue('editPrevDayKb', '0') || 0);
  t.buyingCustomers = Number(getEditValue('editBuyingCustomers', '0') || 0);
  t.tourdayNi = Number(getEditValue('editTourdayNi', '0') || 0);
  t.tourdayKb = Number(getEditValue('editTourdayKb', '0') || 0);
  t.tourdayCancelled = Number(getEditValue('editTourdayCancelled', '0') || 0);
  t.tourdayReserved = Number(getEditValue('editTourdayReserved', '0') || 0);
  t.integrationBought = Number(getEditValue('editIntegrationBought', '0') || 0);
  t.integrationUnreachable = Number(getEditValue('editIntegrationUnreachable', '0') || 0);
  t.integrationNoNeed = Number(getEditValue('editIntegrationNoNeed', '0') || 0);
  t.integrationCancelled = Number(getEditValue('editIntegrationCancelled', '0') || 0);
  t.integrationPreordered = Number(getEditValue('editIntegrationPreordered', '0') || 0);
  t.threeCustomersTotal = Number(getEditValue('editThreeCustomersTotal', '0') || 0);
  t.threeCustomersBought = Number(getEditValue('editThreeCustomersBought', '0') || 0);
  t.threeCustomersNi = Number(getEditValue('editThreeCustomersNi', '0') || 0);
  t.threeCustomersKb = Number(getEditValue('editThreeCustomersKb', '0') || 0);
  t.threeCustomersCancelled = Number(getEditValue('editThreeCustomersCancelled', '0') || 0);
  t.threeCustomersPreordered = Number(getEditValue('editThreeCustomersPreordered', '0') || 0);
  t.vertretung = getEditChecked('editVertretung');
  t.fahrt45 = getEditChecked('editFahrt45');
  t.einbringung = getEditChecked('editEinbringung');
  t.note = getEditValue('editNote') || '';
  t.workStart = getEditValue('editWorkStart') || '';
  t.tourStart = getEditValue('editTourStart') || '';
  t.breakMinutes = Number(getEditValue('editBreakMinutes', '45') || 45);
  t.tourEnd = getEditValue('editTourEnd') || '';
  t.workEnd = getEditValue('editWorkEnd') || '';
  const ad = getEditValue('editActionsDetail') || '';
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
  await addTourRecord(t);
  currentEditingKey = null;
  document.getElementById('editModal').classList.remove('active');
  await renderTours();
  await triggerAutoBackup('tour_edited');
});

/* ========== PDF Export ========== */
bindById('exportPdf', 'click', async () => {
  if(!window.jspdf || !window.jspdf.jsPDF){ alert('jsPDF nicht geladen'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const conf = await loadConfObj();
  const periodKey = `${selectYear.value}-${selectMonth.value}`;
  const tours = (await getAllTours()).filter(t=>t.period === periodKey);

  let totalUmsatzAllCents=0, totalVGRevenueCents=0, countVGTours=0, countNeukundentouren=0;
  let totalIntegrationCents=0, totalSpesenCents=0, totalActionProvCents=0, totalPaprovCents=0, totalExtrasCents=0, totalFreizeitausgleichCents=0;
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
    totalIntegrationCents += computeIntegrationCents(t.integrationBought||0,conf);
    totalSpesenCents += computeSpesenCentsForTour(t,conf);
    totalActionProvCents += computeActionProvisionCents(t.actions||[]);
    let extra=0;
    if(t.vertretung) extra += Math.round(tourTotal * 0.02);
    if(t.fahrt45) extra += Math.round(tourTotal * 0.0025);
    totalExtrasCents += extra;
    if(t.einbringung) totalFreizeitausgleichCents -= toCents(130);
    if(t.tourType === 'freizeitausgleich') totalFreizeitausgleichCents += toCents(130);
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
  const totalProvisionCents = vgProvisionCents + totalNeukCents + totalIntegrationCents + totalActionProvCents + totalPaprovCents + totalExtrasCents + totalFreizeitausgleichCents + kmBonus;
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
    ['Freizeitausgleich', `€ ${fromCents(totalFreizeitausgleichCents)}`],
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
bindById('openBackups', 'click', ()=>{
  setActiveSection('sectionBackups');
});
bindById('closeBackups', 'click', ()=> setActiveSection('sectionTours'));
bindById('clearBackups', 'click', async ()=>{
  if(!confirm('Alle Backups löschen?')) return;
  await idbClear('backups'); document.getElementById('backupsList').innerHTML = '<div class="muted">Keine Backups vorhanden</div>';
});

/* Reset / Print */
bindById('resetAll', 'click', async ()=>{
  if(!confirm('Alle Touren und Einstellungen löschen?')) return;
  await clearAllData();
  await renderTours();
});
const printStatsCumulativeBtn = document.getElementById('printStatsCumulative');
if(printStatsCumulativeBtn){
  printStatsCumulativeBtn.textContent = '🖨️';
  printStatsCumulativeBtn.title = 'Kumulierte Statistik drucken';
  printStatsCumulativeBtn.addEventListener('click', ()=>{
    printTourStats('cumulative').catch(err => {
      console.error('Statistik (kumuliert) drucken fehlgeschlagen', err);
      alert('Statistik konnte nicht gedruckt werden.');
    });
  });
}

const printStatsPerTourBtn = document.getElementById('printStatsPerTour');
if(printStatsPerTourBtn){
  printStatsPerTourBtn.remove();
}

ensureStatsRangeApplyButton();

if(statsRangeFromInput){
  statsRangeFromInput.addEventListener('change', ()=>{
    getDraftStatsRange();
    markStatsRangeAsDirty();
  });
}
if(statsRangeToInput){
  statsRangeToInput.addEventListener('change', ()=>{
    getDraftStatsRange();
    markStatsRangeAsDirty();
  });
}
if(statsRangeResetBtn){
  statsRangeResetBtn.addEventListener('click', ()=>{
    syncStatsRangeToMonth();
    renderTours();
  });
}
if(statsRangeApplyBtn){
  statsRangeApplyBtn.addEventListener('click', ()=>{
    applyStatsRangeSelection();
    renderTours();
  });
}

bindById('printWorktimeMonthly', 'click', ()=>{
  printWorktimeMonthlyReport().catch((err)=>{
    console.error('Arbeitszeit-Monatsbericht drucken fehlgeschlagen', err);
    alert('Arbeitszeit-Monatsbericht konnte nicht gedruckt werden.');
  });
});

bindById('printReport', 'click', ()=> window.print());


/* CSV-Import Button */
bindById('importCsv', 'click', ()=> csvInput?.click());

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
  const today = new Date(); 
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const yy = today.getFullYear();
  if(selectMonth) selectMonth.value = mm;
  if(selectYear) selectYear.value = yy;
  syncStatsRangeToMonth();

  const dateInput = document.getElementById('date');
  if(dateInput) dateInput.value = today.toISOString().slice(0,10);

  if(paprovMonth) paprovMonth.value = `${yy}-${mm}`;
  if(lostCustomersMonth) lostCustomersMonth.value = `${yy}-${mm}`;
  if(baseSalaryMonth) baseSalaryMonth.value = `${yy}-${mm}`;
  if(heimschlaeferMonth) heimschlaeferMonth.value = `${yy}-${mm}`;

  renderSideMenuNavigation();
  renderAppVersion();

  if(menuTriggerBtn) menuTriggerBtn.addEventListener('click', toggleSideMenu);
  if(closeMenuBtn) closeMenuBtn.addEventListener('click', closeSideMenu);
  if(menuOverlay) menuOverlay.addEventListener('click', closeSideMenu);
  document.addEventListener('keydown', (event)=>{
    if(event.key === 'Escape') closeSideMenu();
  });
  document.addEventListener('keydown', handleNavigationShortcuts);
  window.addEventListener('resize', ()=>{
    if(sideMenu && sideMenu.classList.contains('active')) positionSideMenuNearTrigger();
  });

  window.addEventListener('hashchange', ()=>{
    const hashedSection = sectionFromHash();
    if(hashedSection){
      setActiveSection(hashedSection);
    }
  });

  Object.entries(tabTargets).forEach(([tabId, sectionId])=>{
    const tab = document.getElementById(tabId);
    if(tab) tab.addEventListener('click', ()=> {
      setActiveSection(sectionId);
      closeSideMenu();
    });
  });

  if(selectMonth){
    selectMonth.addEventListener('change', ()=> {
      syncStatsRangeToMonth();
      renderTours();
      if(document.getElementById('sectionSettings')?.classList.contains('active')) populateSettingsSection();
    });
  } else {
    console.warn('[ui] selectMonth nicht gefunden – Monatswechsel deaktiviert.');
  }

  if(selectYear){
    selectYear.addEventListener('change', ()=> {
      syncStatsRangeToMonth();
      renderTours();
      if(document.getElementById('sectionSettings')?.classList.contains('active')) populateSettingsSection();
    });
  } else {
    console.warn('[ui] selectYear nicht gefunden – Jahreswechsel deaktiviert.');
  }

  try {
    const conf = await loadConfObj();
    document.getElementById('lostCustomersValue').value = getLostCustomersForPeriod(conf, `${yy}-${mm}`);
    document.getElementById('paprovValue').value = (conf.paprovPerMonth && conf.paprovPerMonth[`${yy}-${mm}`]) ? conf.paprovPerMonth[`${yy}-${mm}`] : 0;
    if(baseSalaryMonth) document.getElementById('baseSalaryValue').value = getBaseSalaryForPeriod(conf, `${yy}-${mm}`);
    if(heimschlaeferMonth){
      const heimschlaefer = getHeimschlaeferForPeriod(conf, `${yy}-${mm}`);
      document.getElementById('heimschlaeferEnabled').checked = heimschlaefer.enabled;
      document.getElementById('heimschlaeferNetto').value = heimschlaefer.netto;
    }
  } catch (err) {
    console.error('Konfiguration konnte nicht geladen werden.', err);
  }

  try {
    await renderCustomerAgreements();
    await renderCustomerAddressSuggestions('');
  } catch (err) {
    console.error('Kundenbereich konnte nicht initialisiert werden.', err);
  }

  setActiveSection(sectionFromHash() || 'sectionNewTour');

  try {
    await renderTours();
  } catch (err) {
    console.error('Touren konnten nicht geladen werden.', err);
  }
}
