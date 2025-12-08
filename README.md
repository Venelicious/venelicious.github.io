<html lang="de">
<head>
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Touren & Provisionen">
<link rel="apple-touch-icon" href="icon-192.png">
<meta name="theme-color" content="#0b2545">
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="assets/styles.css">
<title>Provisionstool</title>

<!-- jsPDF & AutoTable via CDN -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js"></script>
</head>
<body>

<h1>Provisionstool</h1>

<nav class="tabNav">
  <button id="tabNewTour" class="tabButton active" aria-label="Neue Tour erfassen" title="Neue Tour erfassen">📝</button>
  <button id="tabTours" class="tabButton" aria-label="Touren" title="Touren">🗺️</button>
  <button id="tabSummary" class="tabButton" aria-label="Zusammenfassung" title="Zusammenfassung">📊</button>
  <button id="tabSettings" class="tabButton" aria-label="Einstellungen" title="Einstellungen">⚙️</button>
  <button id="tabBackups" class="tabButton" aria-label="Backups" title="Backups">💾</button>
  <button id="tabExport" class="tabButton" aria-label="Export" title="Export">📤</button>
</nav>

<section id="sectionNewTour" class="tabSection active">
  <div class="panel">
    <div class="panelHeader">
      <div>
        <h3>Neue Tour erfassen</h3>
        <p class="muted">Lege eine Tour mit allen Details an und speichere sie im gewünschten Zeitraum.</p>
      </div>
    </div>

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

    <div class="flexRow" style="margin-top:8px">
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
      <button id="openSettings" class="small right">⚙ Einstellungen</button>
    </div>
  </div>
</section>

<section id="sectionTours" class="tabSection">
  <div class="panel toursPanel">
    <div class="panelHeader">
      <div>
        <h3>Touren</h3>
        <p class="muted">Gespeicherte Touren und aktuelle Zusammenfassung im Überblick.</p>
      </div>
    </div>

    <div class="tableCard">
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
    </div>

  </div>
</section>

<section id="sectionSummary" class="tabSection">
  <div class="panel">
    <div class="panelHeader">
      <div>
        <h3>Zusammenfassung</h3>
        <p class="muted">Aktuelle Kennzahlen und Summen für den ausgewählten Zeitraum.</p>
      </div>
    </div>

    <div class="summary" id="summary">
      <strong>Zusammenfassung</strong>
      <div id="summaryContent" style="margin-top:8px"></div>
    </div>
  </div>
</section>

<section id="sectionSettings" class="tabSection">
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

  <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
    <button id="openBackups" class="small">Backups verwalten</button>
    <button id="saveSettings" class="small">Einstellungen speichern</button>
  </div>
</section>

<section id="sectionBackups" class="tabSection">
  <h3>Backups</h3>
  <div id="backupsList" style="max-height:50vh;overflow:auto"></div>
  <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
    <button id="closeBackups" class="small">Zurück zu Touren</button>
    <button id="clearBackups" class="small">Backups löschen</button>
  </div>
</section>

<section id="sectionExport" class="tabSection">
  <h3>Export, Import &amp; Drucken</h3>
  <div class="muted" style="margin-bottom:8px">Aktionen wirken auf den ausgewählten Monat/Jahr.</div>
  <div class="controls">
    <button id="exportCsv" class="small">CSV exportieren</button>
    <button id="exportPdf" class="small">PDF exportieren</button>
    <button id="importCsv" class="small">CSV importieren</button>
    <button id="exportJson" class="small">JSON exportieren</button>
    <button id="importJson" class="small">JSON importieren</button>
    <button id="printReport" class="small">Drucken</button>
    <button id="resetAll" class="small">Alle Daten löschen</button>
  </div>
  <input type="file" id="csvInput" accept=".csv" style="display:none" />
  <input type="file" id="jsonInput" accept=".json" style="display:none" />
</section>

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

<script type="module">
  import { init } from './assets/ui.js';

  document.addEventListener('DOMContentLoaded', () => {
    init();
  });

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
