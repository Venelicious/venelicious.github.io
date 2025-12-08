<html lang="de">
<head>
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Touren & Provisionen">
<link rel="apple-touch-icon" href="icon-192.png">
<meta name="theme-color" content="#0b2545">
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Provisionstool</title>
<style>
  :root{--bg:#f6fbff;--accent:#0b2545;--muted:#65788f}
  body{font-family:Inter, system-ui, Arial, sans-serif;margin:18px;color:var(--accent);background:#fff}
  h1{margin:0 0 8px}
  label{display:block;margin-top:10px;font-size:0.95rem}
  input,select,button,textarea{padding:8px;margin-top:6px;width:100%;box-sizing:border-box;border:1px solid #d0d7e0;border-radius:6px}
  .row{display:flex;gap:10px}
  .row>*{flex:1}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:0.95rem}
  th,td{padding:8px;border:1px solid #e6eef8;text-align:left;vertical-align:middle}
  th[data-sort]{cursor:pointer}
  th[data-sort]::after{content:" ⇅";font-size:0.75rem;color:var(--muted)}
  .muted{color:var(--muted);font-size:0.9rem}
  .controls{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
  .small{width:auto;padding:6px 10px;cursor:pointer}
  .summary{background:var(--bg);border:1px solid #d8e8ff;padding:12px;border-radius:8px;margin-top:12px}
  .actions-list{margin-top:8px;border:1px dashed #dbe9ff;padding:8px;border-radius:6px}
  .action-row{display:flex;gap:6px;margin-top:6px}
  .action-row input{flex:1}
  .tag{font-size:0.75rem;padding:4px 8px;border-radius:12px;background:#eef6ff;border:1px solid #d0e7ff;text-transform:uppercase}
  .sumRow{display:flex;justify-content:space-between;padding:4px 0;font-size:0.95rem}
  .sumRow span:first-child{width:65%}
  .sumRow span:last-child{width:35%;text-align:right;font-weight:600}
  .modal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);display:none;justify-content:center;align-items:center;z-index:2000}
  .modal.active{display:flex}
  .modalContent{background:#fff;padding:18px;border-radius:10px;width:620px;max-width:95%;box-shadow:0 6px 20px rgba(0,0,0,0.25)}
  .flexRow{display:flex;gap:8px}
  .right{margin-left:auto}
  @media (max-width:840px){ .row{flex-direction:column} .flexRow{flex-direction:column} .modalContent{width:92%} }
  h3{margin-top:6px;margin-bottom:6px}
  hr{border:none;border-top:1px solid #eef6ff;margin:10px 0}
</style>

<!-- jsPDF & AutoTable via CDN -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js"></script>
</head>
<body>

<h1>Provisionstool</h1>
<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:14px">
  <!-- linke Spalte -->
  <div style="flex:1;min-width:360px">
    <h3>Neue Tour erfassen</h3>

    <label>Monat / Jahr
      <div class="row">
        <select id="selectMonth" style="width:50%">
          <option value="01">Januar</option><option value="02">Februar</option><option value="03">März</option>
          <option value="04">April</option><option value="05">Mai</option><option value="06">Juni</option>
          <option value="07">Juli</option><option value="08">August</option><option value="09">September</option>
          <option value="10">Oktober</option><option value="11">November</option><option value="12">Dezember</option>
        </select>
        <select id="selectYear" style="width:50%"></select>
      </div>
    </label>

    <label>Tour-Nr. / Bezeichnung
      <input id="tourId" placeholder="z.B. Tour 101"/>
    </label>

    <div class="row">
      <div>
        <label>Datum
          <input id="date" type="date"/>
        </label>
      </div>
      <div>
        <label>Umsatz
          <input id="amount" type="number" step="0.01" placeholder="Gesamtumsatz"/>
        </label>
      </div>
    </div>

    <div class="row">
      <div>
        <label>Reklamation
          <input id="reklamation" type="number" step="0.01" value="0.00"/>
        </label>
      </div>
      <div>
        <label>Gutscheine
          <input id="gutscheine" type="number" step="0.01" value="0.00"/>
        </label>
      </div>
    </div>

    <div class="row">
      <div>
        <label>Neukunden
          <input id="newCustomers" type="number" step="1" min="0" value="0"/>
        </label>
      </div>
      <div>
        <label>Integrationen
          <input id="integrations" type="number" step="1" min="0" value="0"/>
        </label>
      </div>
    </div>

    <label>Tourenart
      <select id="tourType">
        <option value="tourentag">Tourentag</option>
        <option value="werbetag">Werbetag</option>
        <option value="neukundentour">Neukundentour</option>
        <option value="krank">Krank</option>
        <option value="urlaub">Urlaub</option>
      </select>
    </label>

    <label style="margin-top:10px;"><input type="checkbox" id="vertretung"/> Vertretung (+2% Provision)</label>
    <label><input type="checkbox" id="fahrt45"/> Entfernung >45 min (+0,25% Provision)</label>

    <h4 style="margin-top:12px">Aktionen</h4>
    <div class="actions-list" id="actionsList"></div>

    <div style="display:flex;gap:8px;margin-top:8px">
      <input id="actPrice" placeholder="Verkaufspreis €" type="number" step="0.01"/>
      <input id="actQty" placeholder="Stückzahl" type="number" step="1"/>
      <button id="addActionBtn" class="small">+ Aktion</button>
    </div>

    <label>Notiz
      <input id="note" placeholder="z.B. Neukunde, Aktion, Besonderheit"/>
    </label>

    <div class="controls">
      <button id="addBtn" class="small">🔺 Tour speichern</button>
      <button id="clearBtn" class="small">✖ Leeren</button>
      <button id="openSettings" class="small right">⚙</button>
    </div>

    <h3 style="margin-top:18px">Touren</h3>
    <table id="toursTable">
      <thead>
        <tr>
          <th data-sort="date">Datum</th>
          <th data-sort="id">Tour</th>
          <th data-sort="tourType">Art</th>
          <th data-sort="total">Umsatz</th>
          <th data-sort="rekl">Rekl.</th>
          <th data-sort="gs">GS</th>
          <th data-sort="newC">NK</th>
          <th data-sort="integrations">Int.</th>
          <th>Spesen</th>
          <th data-sort="actionsCount">Akt.</th>
          <th data-sort="actionsEuro">Akt. (€)</th>
          <th>Vert.</th>
          <th>Entf.</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>

    <div class="summary" id="summary">
      <strong>Zusammenfassung</strong>
      <div id="summaryContent" style="margin-top:8px"></div>
      <div style="margin-top:8px" class="controls">
        <button id="exportCsv" class="small">CSV export</button>
        <button id="exportPdf" class="small">PDF export</button>
        <button id="importCsv" class="small">CSV importieren</button>
        <button id="exportJson" class="small">JSON export</button>
        <button id="importJson" class="small">JSON import</button>
        <button id="printReport" class="small">Drucken</button>
        <button id="resetAll" class="small">Alle Daten löschen</button>
      </div>
    </div>

    <input type="file" id="csvInput" accept=".csv" style="display:none" />
    <input type="file" id="jsonInput" accept=".json" style="display:none" />
  </div>
</div>

<!-- Edit Modal -->
<div id="editModal" class="modal"><div class="modalContent">
  <h3>Tour bearbeiten</h3>
  <form onsubmit="return false;">
    <label>Bezeichnung<input type="text" id="editId"/></label>
    <label>Datum<input type="date" id="editDate"/></label>
    <label>Tourenart
      <select id="editTourType">
        <option value="tourentag">Tourentag</option>
        <option value="werbetag">Werbetag</option>
        <option value="neukundentour">Neukundentour</option>
        <option value="krank">Krank</option>
        <option value="urlaub">Urlaub</option>
      </select>
    </label>
    <label>Umsatz<input type="number" step="0.01" id="editAmount"/></label>
    <label>Reklamation<input type="number" step="0.01" id="editReklamation"/></label>
    <label>Gutscheine<input type="number" step="0.01" id="editGutscheine"/></label>
    <label>Neukunden<input type="number" id="editNewC"/></label>
    <label>Integrationen<input type="number" id="editIntegrations"/></label>
    <label><input type="checkbox" id="editVertretung"/> Vertretung (+2%)</label>
    <label><input type="checkbox" id="editFahrt45"/> Entfernung &gt;45min (+0,25%)</label>
    <label>Aktionen-Details
      <input type="text" id="editActionsDetail" placeholder='z.B. 3x5.99|2x3.50'/>
    </label>
    <label>Notiz<input type="text" id="editNote"/></label>

    <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
      <button id="cancelEdit" class="small">Abbrechen</button>
      <button id="saveEdit" class="small">Speichern</button>
    </div>
  </form>
</div></div>

<!-- Settings Modal (wieder als Modal!) -->
<div id="settingsModal" class="modal"><div class="modalContent">
  <h3>Einstellungen</h3>
  <hr/>
  <h4>PAPROV</h4>
  <div class="row">
    <select id="paprovMonth"></select>
    <input id="paprovValue" type="number" step="0.01" value="0.00" placeholder="PAPROV für Monat"/>
  </div>
  <div style="display:flex;gap:8px;margin-top:6px">
    <button id="savePaprov" class="small">Speichern (Monat)</button>
    <button id="clearPaprov" class="small">Löschen (Monat)</button>
  </div>

  <hr/>
  <h4>Kundenmanagement</h4>
  <label>Im Schnitt verlorene Kunden
    <input id="lostCustomersAvg" type="number" step="1" value="7"/>
  </label>

  <hr/>
  <h4>Backups</h4>
  <div style="display:flex;gap:8px;margin-top:6px;justify-content:flex-end">
    <button id="openBackups" class="small">Backups verwalten</button>
  </div>

  <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
    <button id="closeSettings" class="small">Schließen</button>
    <button id="saveSettings" class="small">Einstellungen speichern</button>
  </div>
</div></div>

<!-- Backups Modal -->
<div id="backupsModal" class="modal"><div class="modalContent">
  <h3>Backups</h3>
  <div id="backupsList" style="max-height:50vh;overflow:auto"></div>
  <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
    <button id="closeBackups" class="small">Schließen</button>
    <button id="clearBackups" class="small">Backups löschen</button>
  </div>
</div></div>

<script>
/* ========== IndexedDB wrapper ========== */
const DB_NAME = 'provisionDB_v1';
const DB_VERSION = 1;
let dbPromise = null;
function openDb(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if(!db.objectStoreNames.contains('tours')) db.createObjectStore('tours', { keyPath: 'idAuto', autoIncrement: true });
      if(!db.objectStoreNames.contains('conf')) db.createObjectStore('conf', { keyPath: 'k' });
      if(!db.objectStoreNames.contains('backups')) db.createObjectStore('backups', { keyPath: 'ts' });
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
  return dbPromise;
}
async function idbPut(store, val){
  const db = await openDb();
  return new Promise((res,rej)=>{
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(val);
    tx.oncomplete = ()=> res(true);
    tx.onerror = ()=> rej(tx.error);
  });
}
async function idbAdd(store, val){
  const db = await openDb();
  return new Promise((res,rej)=>{
    const tx = db.transaction(store, 'readwrite');
    const r = tx.objectStore(store).add(val);
    r.onsuccess = ()=> res(r.result);
    tx.onerror = ()=> rej(tx.error);
  });
}
async function idbGetAll(store){
  const db = await openDb();
  return new Promise((res,rej)=>{
    const tx = db.transaction(store,'readonly');
    const r = tx.objectStore(store).getAll();
    r.onsuccess = ()=> res(r.result);
    r.onerror = ()=> rej(r.error);
  });
}
async function idbClear(store){
  const db = await openDb();
  return new Promise((res,rej)=>{
    const tx = db.transaction(store,'readwrite');
    const r = tx.objectStore(store).clear();
    r.onsuccess = ()=> res(true);
    r.onerror = ()=> rej(r.error);
  });
}
async function idbDelete(store, key){
  const db = await openDb();
  return new Promise((res,rej)=>{
    const tx = db.transaction(store,'readwrite');
    const r = tx.objectStore(store).delete(key);
    r.onsuccess = ()=> res(true);
    r.onerror = ()=> rej(r.error);
  });
}

/* ========== Helpers & Berechnungen ========== */
function toCents(e){ return Math.round(Number(e||0)*100); }
function fromCents(c){ return (c/100).toFixed(2); }
function sanitizeForPdf(s){
  if(s === null || s === undefined) return '';
  return String(s).replace(/&/g,'und').replace(/</g,'').replace(/>/g,'').replace(/\u2013/g,'-');
}
function tickFor(val){ return val ? '✔' : '✖'; }

function computeActionSum(actions){
  if(!actions || !actions.length) return 0;
  return actions.reduce((s,a)=> s + (Number(a.price||0) * Number(a.qty||0)), 0);
}
function computeActionProvisionCents(actions){
  const sum = computeActionSum(actions); // euros
  return toCents(sum * 0.10);
}

function getNeukundenRate(totalCount, conf){
  const base = Number(conf.newBase || 30);
  const high = Number(conf.newHigh || 60);
  const threshold = Number(conf.newThreshold || 4);
  return totalCount >= threshold ? high : base;
}
function computeMonthlyNeukundenBonusCents(totalCount, conf){
  const rate = getNeukundenRate(totalCount, conf);
  return toCents(totalCount * rate);
}
function computeNeukundenBonusForTourCents(tourCount, totalCount, conf){
  const rate = getNeukundenRate(totalCount, conf);
  return toCents(tourCount * rate);
}

function computeIntegrationCents(count, conf){
  return toCents(count * (Number(conf.integrationAmount || 0)));
}
function computeSpesenCentsForTour(t, conf){
  let s = 0;
  if(t.tourType !== 'krank' && t.tourType !== 'urlaub'){
    s += toCents(conf.spKleider || 1.20);
  }
  if(t.tourType === 'tourentag' || t.tourType === 'neukundentour'){
    s += toCents(conf.spAuslagen || 10.00);
  }
  return s;
}
function computeKundenmanagementBonusCents(lost){
  const base = 300;
  if(lost <= 5) return toCents(base);
  const red = (lost - 5) * 30;
  return toCents(Math.max(base - red, 0));
}
function determineVGRate(avgEuro){
  if(avgEuro >= 1630) return 0.095;
  if(avgEuro >= 1400) return 0.0925;
  if(avgEuro >= 1285) return 0.09;
  if(avgEuro >= 1130) return 0.0875;
  return 0.085;
}

/* Netto-Berechnung mit TK 2025, kinderlos: PV AN = 2,4 % */
function computeNetFromBrutto(bruttoEuro){
  const brutto = Number(bruttoEuro || 0);
  const rv = brutto * 0.093;
  const av = brutto * 0.0125;
  const kv = brutto * ((14.6 + 2.45) / 100 / 2); // 8,525 %
  const pv = brutto * 0.024; // 2,4 % AN-Anteil (4,2 % gesamt, 1,8 % AG + 2,4 % AN)
  const sozial = rv + av + kv + pv;

  const annualBrutto = brutto * 12;
  let lohnsteuerAnnual = 0;
  if (annualBrutto <= 11604) {
    lohnsteuerAnnual = 0;
  } else if (annualBrutto <= 17005) {
    const y = (annualBrutto - 11604) / 10000;
    lohnsteuerAnnual = (922.98 * y + 1400) * y;
  } else if (annualBrutto <= 66799) {
    const z = (annualBrutto - 17005) / 10000;
    lohnsteuerAnnual = (181.19 * z + 2397) * z + 1025;
  } else {
    lohnsteuerAnnual = annualBrutto * 0.42 - 9972.98;
  }
  const lohnsteuerMonat = lohnsteuerAnnual / 12;
  const soli = lohnsteuerMonat > 16 ? lohnsteuerMonat * 0.055 : 0;
  const netto = brutto - sozial - lohnsteuerMonat - soli;
  return netto;
}

/* ========== UI init-Grundlagen ========== */
const selectMonth = document.getElementById('selectMonth');
const selectYear = document.getElementById('selectYear');
const paprovMonth = document.getElementById('paprovMonth');
const csvInput = document.getElementById('csvInput');
const jsonInput = document.getElementById('jsonInput');
let currentSort = { key:null, dir:'asc' };

/* Jahre + PAPROV-Monate auffüllen */
(function populateYearsAndPaprov(){
  const now = new Date();
  const cy = now.getFullYear();
  for(let y=cy-5;y<=cy+1;y++){
    const opt = document.createElement('option'); opt.value = y; opt.textContent = y;
    selectYear.appendChild(opt);
  }
  selectYear.value = cy;

  paprovMonth.innerHTML = '';
  for(let y=cy-1;y<=cy+1;y++){
    for(let m=1;m<=12;m++){
      const mm = String(m).padStart(2,'0');
      const opt = document.createElement('option');
      opt.value = `${y}-${mm}`;
      opt.textContent = `${mm}.${y}`;
      paprovMonth.appendChild(opt);
    }
  }
})();

/* Aktionen-UI */
function createActionRow(price='', qty=''){
  const row = document.createElement('div'); row.className = 'action-row';
  row.innerHTML = `<input class="actPrice" type="number" step="0.01" value="${price}" placeholder="Preis €">
                   <input class="actQty" type="number" step="1" value="${qty}" placeholder="Stück">
                   <button class="small delAct" type="button">x</button>`;
  row.querySelector('.delAct').addEventListener('click', ()=> row.remove());
  return row;
}
document.getElementById('addActionBtn').addEventListener('click', (e)=>{
  e.preventDefault();
  const p = document.getElementById('actPrice').value;
  const q = document.getElementById('actQty').value;
  document.getElementById('actionsList').appendChild(createActionRow(p,q));
  document.getElementById('actPrice').value=''; document.getElementById('actQty').value='';
});

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
  await idbClear('tours'); await idbClear('conf'); await idbClear('backups');
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
  return {
    // Feste Werte
    baseSalary: 2500,
    newBase: 30,
    newThreshold: Number(map.newThreshold || 4),
    newHigh: 60,
    integrationAmount: 10,
    spKleider: 1.2,
    spAuslagen: 10,
    lostCustomersAvg: Number(map.lostCustomersAvg || 0),
    paprovPerMonth: (map.paprovPerMonth || {})
  };
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
        const keys = ['lostCustomersAvg','paprovPerMonth'];
        for(const k of keys){
          if(cObj[k] !== undefined) await idbPut('conf', { k: k, v: cObj[k] });
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
      const payload = {
        ts: new Date().toISOString(),
        reason: reason || null,
        data: { tours, conf }
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

/* JSON Export/Import */
document.getElementById('exportJson').addEventListener('click', async ()=>{
  const tours = await getAllTours();
  const conf = await loadConfObj();
  const payload = { ts: new Date().toISOString(), data: { tours, conf } };
  downloadJson(payload, `provision_export_${payload.ts.replace(/[:.]/g,'-')}.json`);
});
document.getElementById('importJson').addEventListener('click', ()=> jsonInput.click());
jsonInput.addEventListener('change', async (ev)=>{
  const f = ev.target.files[0]; if(!f) return;
  const text = await f.text();
  try{
    const j = JSON.parse(text);
    if(j && j.data){
      await idbClear('tours'); await idbClear('conf');
      const confObj = j.data.conf || {};
      for(const k of Object.keys(confObj)){
        await idbPut('conf', { k: k, v: confObj[k] });
      }
      const arr = j.data.tours || [];
      for(const t of arr){
        delete t.idAuto;
        await idbAdd('tours', t);
      }
      await renderTours();
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
  document.getElementById('note').value=''; document.getElementById('actionsList').innerHTML='';
  document.getElementById('vertretung').checked=false; document.getElementById('fahrt45').checked=false;
  await renderTours();
  await triggerAutoBackup('tour_added');
});

/* Formular leeren */
document.getElementById('clearBtn').addEventListener('click', ()=>{
  document.getElementById('tourId').value=''; document.getElementById('amount').value='';
  document.getElementById('reklamation').value='0.00'; document.getElementById('gutscheine').value='0.00';
  document.getElementById('newCustomers').value=0; document.getElementById('integrations').value=0;
  document.getElementById('note').value=''; document.getElementById('actionsList').innerHTML='';
  document.getElementById('vertretung').checked=false; document.getElementById('fahrt45').checked=false;
});

/* Settings speichern (nur verlorene Kunden) */
document.getElementById('saveSettings').addEventListener('click', async ()=>{
  const lost = Number(document.getElementById('lostCustomersAvg').value || 0);
  await saveConf('lostCustomersAvg', lost);
  alert('Einstellungen gespeichert.');
  document.getElementById('settingsModal').classList.remove('active');
  await renderTours();
  await triggerAutoBackup('settings_saved');
});

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

/* Gutscheinanzeige */
function gutscheineDisplay(val){
  const v = Number(val || 0);
  return v > 0 ? fromCents(toCents(v)) : '–';
}

/* ========== Render Tours + Summary (mit Sortierung) ========== */
async function renderTours(){
  const tbody = document.querySelector('#toursTable tbody'); tbody.innerHTML = '';
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
    tr.innerHTML = `
      <td>${t.date}</td>
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
        <button class="small" data-i="${t.idAuto||''}" data-action="delete">Löschen</button>
        <button class="small" data-i="${t.idAuto||''}" data-action="edit">Bearbeiten</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Buttons löschen/bearbeiten
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

  // Zusammenfassung
  const avgVGEuros = (countVGTours>0) ? (totalVGRevenueCents/100/countVGTours) : 0;
  const vgRate = determineVGRate(avgVGEuros);
  const vgProvisionCents = Math.round(totalVGRevenueCents * vgRate);
  const rawKm = computeKundenmanagementBonusCents(conf.lostCustomersAvg||0);
  const totalTours = tours.length;
  const relevant = countVGTours + countNeukundentouren;
  const kmBonusCents = Math.round(rawKm * (totalTours>0 ? (relevant/totalTours) : 0));

  const totalProvisionCents = vgProvisionCents + totalNeukCents + totalIntegrationCents + totalActionProvCents + totalPaprovCents + totalExtrasCents + kmBonusCents;
  const baseSalaryCents = toCents(conf.baseSalary || 0);
  const monthlyBeforeSpesenCents = Math.max(baseSalaryCents, totalProvisionCents);
  const brutto = monthlyBeforeSpesenCents/100;
  const netto = computeNetFromBrutto(brutto);
  const nettoFromBruttoCents = Math.round(netto*100);
  const finalPayoutCents = nettoFromBruttoCents + totalSpesenCents;

  const rv = brutto * 0.093;
  const av = brutto * 0.0125;
  const kv = brutto * 0.08525;
  const pv = brutto * 0.024;
  const sozial = rv + av + kv + pv;
  const lohnsteuer = Math.max(0, brutto - sozial - netto);
  const soli = lohnsteuer > 16 ? lohnsteuer * 0.055 : 0;

  const summary = document.getElementById('summaryContent');
  summary.innerHTML = `
    <div class="sumRow"><span>❯ Arbeitstage</span><span>${tours.length}</span></div>
    <div class="sumRow"><span>❯ Tourentage</span><span>${countVGTours}</span></div>
    <div class="sumRow"><span>❯ Gesamtumsatz</span><span>€ ${fromCents(totalUmsatzAllCents)}</span></div>
    <div class="sumRow"><span>❯ Tagesumsatz ⌀</span><span>€ ${avgVGEuros.toFixed(2)}</span></div>
    <div class="sumRow"><span>❯ Provisionssatz</span><span>${(vgRate*100).toFixed(2)}%</span></div>
    <div class="sumRow"><span>❯ Provision</span><span>€ ${fromCents(vgProvisionCents)}</span></div>

    <hr/>

    <div class="sumRow"><span>❯ Neukunden-Boni</span><span>€ ${fromCents(totalNeukCents)}</span></div>
    <div class="sumRow"><span>❯ Integrationen</span><span>€ ${fromCents(totalIntegrationCents)}</span></div>
    <div class="sumRow"><span>❯ Aktionen (10%)</span><span>€ ${fromCents(totalActionProvCents)}</span></div>
    <div class="sumRow"><span>❯ PAPROV</span><span>€ ${fromCents(totalPaprovCents)}</span></div>
    <div class="sumRow"><span>❯ Zusatzprovision</span><span>€ ${fromCents(totalExtrasCents)}</span></div>
    <div class="sumRow"><span>❯ Kundenmanagement</span><span>€ ${fromCents(kmBonusCents)}</span></div>

    <hr/>

    <div class="sumRow"><span>❯ Spesen</span><span>€ ${fromCents(totalSpesenCents)}</span></div>

    <hr/>

    <div class="sumRow"><span><strong>❯ Provision</strong></span><span><strong>€ ${fromCents(totalProvisionCents)}</strong></span></div>
    <div class="sumRow"><span>❯ Grundgehalt</span><span>€ ${fromCents(baseSalaryCents)}</span></div>
    <div class="sumRow"><span><strong>❯ Monatsbrutto</strong></span><span><strong>€ ${fromCents(monthlyBeforeSpesenCents)}</strong></span></div>

    <hr/>

    <div class="sumRow"><span>Rentenversicherung</span><span>€ ${rv.toFixed(2)}</span></div>
    <div class="sumRow"><span>Arbeitslosenversicherung</span><span>€ ${av.toFixed(2)}</span></div>
    <div class="sumRow"><span>Krankenversicherung</span><span>€ ${kv.toFixed(2)}</span></div>
    <div class="sumRow"><span>Pflegeversicherung</span><span>€ ${pv.toFixed(2)}</span></div>
    <div class="sumRow"><span>Lohnsteuer</span><span>€ ${lohnsteuer.toFixed(2)}</span></div>
    <div class="sumRow"><span>Soli</span><span>€ ${soli.toFixed(2)}</span></div>

    <hr/>

    <div class="sumRow"><span><strong>Netto</strong></span><span><strong>€ ${fromCents(nettoFromBruttoCents)}</strong></span></div>
    <div class="sumRow"><span>+ Spesen</span><span>€ ${fromCents(totalSpesenCents)}</span></div>
    <div class="sumRow" style="margin-top:12px;font-size:1.1rem"><span><strong>💰 Auszahlung</strong></span><span><strong>€ ${fromCents(finalPayoutCents)}</strong></span></div>
  `;
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
  const rawKm = computeKundenmanagementBonusCents(conf.lostCustomersAvg||0);
  const totalTours = tours.length;
  const relevant = countVGTours + countNeukundentouren;
  const kmBonus = Math.round(rawKm * (totalTours>0 ? (relevant/totalTours) : 0));
  const totalProvisionCents = vgProvisionCents + totalNeukCents + totalIntegrationCents + totalActionProvCents + totalPaprovCents + totalExtrasCents + kmBonus;
  const baseSalaryCents = toCents(conf.baseSalary||0);
  const monthlyBeforeSpesenCents = Math.max(baseSalaryCents, totalProvisionCents);
  const brutto = monthlyBeforeSpesenCents/100;
  const netto = computeNetFromBrutto(brutto);
  const nettoFromBruttoCents = Math.round(netto*100);
  const finalPayoutCents = nettoFromBruttoCents + totalSpesenCents;

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
    ['Netto (ohne Spesen)', `€ ${fromCents(nettoFromBruttoCents)}`],
    ['End-Auszahlung (Netto + Spesen)', `€ ${fromCents(finalPayoutCents)}`]
  ];
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

/* Backups Modal */
document.getElementById('openBackups').addEventListener('click', async ()=>{
  const list = document.getElementById('backupsList');
  list.innerHTML = '<em>Lade...</em>';
  const all = await idbGetAll('backups');
  if(!all.length){ list.innerHTML = '<div class="muted">Keine Backups vorhanden</div>'; }
  else{
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
  document.getElementById('backupsModal').classList.add('active');
});
document.getElementById('closeBackups').addEventListener('click', ()=> document.getElementById('backupsModal').classList.remove('active'));
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

/* Settings-Modal öffnen/schließen */
document.getElementById('openSettings').addEventListener('click', async ()=>{
  const conf = await loadConfObj();
  const yy = selectYear.value;
  const mm = selectMonth.value;
  const curPeriod = `${yy}-${mm}`;
  document.getElementById('paprovMonth').value = curPeriod;
  document.getElementById('paprovValue').value = (conf.paprovPerMonth && conf.paprovPerMonth[curPeriod] !== undefined) ? conf.paprovPerMonth[curPeriod] : 0;
  document.getElementById('lostCustomersAvg').value = conf.lostCustomersAvg || 0;
  document.getElementById('settingsModal').classList.add('active');
});
document.getElementById('closeSettings').addEventListener('click', ()=> document.getElementById('settingsModal').classList.remove('active'));

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
(async function init(){
  await migrateFromLocalStorageIfPresent();

  const today = new Date(); 
  const mm = String(today.getMonth()+1).padStart(2,'0'); 
  const yy = today.getFullYear();
  selectMonth.value = mm; selectYear.value = yy;
  document.getElementById('date').value = today.toISOString().slice(0,10);
  document.getElementById('paprovMonth').value = `${yy}-${mm}`;

  const conf = await loadConfObj();
  document.getElementById('lostCustomersAvg').value = conf.lostCustomersAvg || 0;
  document.getElementById('paprovValue').value = (conf.paprovPerMonth && conf.paprovPerMonth[`${yy}-${mm}`]) ? conf.paprovPerMonth[`${yy}-${mm}`] : 0;

  selectMonth.addEventListener('change', ()=> renderTours());
  selectYear.addEventListener('change', ()=> renderTours());

  await renderTours();
})();
</script>
<script>
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js")
      .then(() => console.log("SW registered"))
      .catch(err => console.error("SW error", err));
  });
}
</script>
</body>
</html>
