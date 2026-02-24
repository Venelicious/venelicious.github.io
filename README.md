<html lang="de">
<head>
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Touren & Provisionen">
<link rel="apple-touch-icon" href="icon-192.png">
<meta name="theme-color" content="#0a3d91">
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="assets/styles.css">
<title>Provisionstool</title>

<!-- jsPDF & AutoTable via CDN -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js"></script>
</head>
<body>
<div class="pageShell">
  <header class="topHeader">
    <div class="topHeaderBar">
      <button class="menuTrigger" type="button" aria-label="Menü öffnen">☰</button>
      <div class="brandWrap">
        <strong class="brandName">bofrost*</strong>
        <span class="brandSubline">Touren und Provisionen.</span>
      </div>
      <div class="headerCompactPeriod">
        <label for="selectMonth">Monat / Jahr</label>
        <div class="headerCompactPeriodFields">
          <select id="selectMonth">
            <option value="01">Januar</option><option value="02">Februar</option><option value="03">März</option>
            <option value="04">April</option><option value="05">Mai</option><option value="06">Juni</option>
            <option value="07">Juli</option><option value="08">August</option><option value="09">September</option>
            <option value="10">Oktober</option><option value="11">November</option><option value="12">Dezember</option>
          </select>
          <select id="selectYear"></select>
        </div>
      </div>
    </div>
    <p class="headerLead">Hallo Bastian, hier findest du alle Infos rund um deine Touren.</p>
  </header>

<div id="menuOverlay" class="menuOverlay" aria-hidden="true"></div>
<nav id="sideMenu" class="sideMenu" aria-label="Seitenmenü" aria-hidden="true">
  <div class="sideMenuHeader">
    <strong>Navigation</strong>
    <button id="closeMenu" class="menuClose" type="button" aria-label="Menü schließen">✕</button>
  </div>
  <div id="sideMenuBody" class="sideMenuBody"></div>
</nav>

<section id="sectionNewTour" class="tabSection active">
  <div class="panel">
    <div class="panelHeader">
      <div>
        <h3>Neue Tour erfassen</h3>
        <p class="muted">Lege eine Tour mit allen Details an und speichere sie im gewünschten Zeitraum.</p>
      </div>
    </div>

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

    <div class="entry-grid">
      <section class="entry-block">
        <h4>Allgemein</h4>
        <div class="row">
          <div>
            <label>Neukunden
              <input id="newCustomers" type="number" step="1" min="0" value="0"/>
            </label>
          </div>
          <div></div>
        </div>
      </section>

      <section class="entry-block compact-entry-block">
        <h4>Integrationen</h4>
        <p class="entry-block-hint">Anzahl // Kauf // NE // KB // Absage // Vorbestellt</p>
        <div class="compact-metrics-row">
          <label>Anzahl<input id="integrations" type="number" step="1" min="0" value="0"/></label>
          <label>Kauf<input id="integrationBought" type="number" step="1" min="0" value="0"/></label>
          <label>NE<input id="integrationUnreachable" type="number" step="1" min="0" value="0"/></label>
          <label>KB<input id="integrationNoNeed" type="number" step="1" min="0" value="0"/></label>
          <label>Absage<input id="integrationCancelled" type="number" step="1" min="0" value="0"/></label>
          <label>Vorbestellt<input id="integrationPreordered" type="number" step="1" min="0" value="0"/></label>
        </div>
      </section>

      <section class="entry-block compact-entry-block">
        <h4>Tourentag (normale Tour)</h4>
        <p class="entry-block-hint">Anzahl // Kauf // NE // KB // Absage // Reservierung // Vortag NE</p>
        <div class="compact-metrics-row">
          <label>Anzahl<input id="schooldayCustomers" type="number" step="1" min="0" value="0"/></label>
          <label>Kauf<input id="buyingCustomers" type="number" step="1" min="0" value="0"/></label>
          <label>NE<input id="tourdayNi" type="number" step="1" min="0" value="0"/></label>
          <label>KB<input id="tourdayKb" type="number" step="1" min="0" value="0"/></label>
          <label>Absage<input id="tourdayCancelled" type="number" step="1" min="0" value="0"/></label>
          <label>Reservierung<input id="tourdayReserved" type="number" step="1" min="0" value="0"/></label>
          <label>Vortag NE<input id="prevDayUnreachable" type="number" step="1" min="0" value="0"/></label>
        </div>
        <p class="entry-block-hint" style="margin-top:8px;">Vortag NE: Kauf // NE // KB</p>
        <div class="compact-metrics-row compact-metrics-row--five">
          <label>Kauf<input id="prevDayBought" type="number" step="1" min="0" value="0"/></label>
          <label>NE<input id="prevDayNi" type="number" step="1" min="0" value="0"/></label>
          <label>KB<input id="prevDayKb" type="number" step="1" min="0" value="0"/></label>
        </div>
      </section>

      <section class="entry-block compact-entry-block">
        <h4>D3 Kunden</h4>
        <p class="entry-block-hint">Anzahl // Kauf // NE // KB // Absage // Vorbestellt</p>
        <div class="compact-metrics-row">
          <label>Anzahl<input id="threeCustomersTotal" type="number" step="1" min="0" value="0"/></label>
          <label>Kauf<input id="threeCustomersBought" type="number" step="1" min="0" value="0"/></label>
          <label>NE<input id="threeCustomersNi" type="number" step="1" min="0" value="0"/></label>
          <label>KB<input id="threeCustomersKb" type="number" step="1" min="0" value="0"/></label>
          <label>Absage<input id="threeCustomersCancelled" type="number" step="1" min="0" value="0"/></label>
          <label>Vorbestellt<input id="threeCustomersPreordered" type="number" step="1" min="0" value="0"/></label>
        </div>
      </section>
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
      <button id="addBtn" class="small" aria-label="Tour speichern" title="Tour speichern">💾</button>
      <button id="clearBtn" class="small" aria-label="Formular leeren" title="Formular leeren">🧹</button>
    </div>
  </div>
</section>

<section id="sectionStats" class="tabSection">
  <div class="panel">
    <div class="panelHeader">
      <div>
        <h3>Statistik</h3>
        <p class="muted">Kumuliert</p>
      </div>
      <div class="statsPrintActions">
        <button id="printStatsCumulative" class="small" type="button" aria-label="Kumulierte Statistik drucken" title="Kumulierte Statistik drucken">Kumuliert drucken</button>
        <button id="printStatsPerTour" class="small" type="button" aria-label="Jede Tour einzeln drucken" title="Jede Tour einzeln drucken">Touren einzeln drucken</button>
      </div>
    </div>

    <div class="statsBoard" id="statsSummary">
      <div id="statsContent"></div>
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

    <div id="toursBubbleList" class="tours-bubble-list" style="margin-top:12px"></div>

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

<section id="sectionCustomers" class="tabSection">
  <div class="panel">
    <div class="panelHeader">
      <div>
        <h3>Kundenabsprachen</h3>
        <p class="muted">Lege besondere Absprachen mit Kunden fest (z. B. Rhythmus geändert, Storno, Urlaub).</p>
      </div>
    </div>

    <div class="row">
      <label>Kundennummer
        <input id="customerNumber" placeholder="z.B. 4711" />
      </label>
      <label>Name
        <input id="customerLastName" placeholder="z.B. Muster" />
      </label>
    </div>

    <div class="row">
      <label>Vorname
        <input id="customerFirstName" placeholder="z.B. Max" />
      </label>
      <label>Art
        <select id="customerAgreementType">
          <option value="rhythmus_geaendert">Rhythmus geändert</option>
          <option value="komplett_storno">Komplett Storno</option>
          <option value="urlaub">Urlaub</option>
          <option value="nur_auf_bestellung">Nur auf Bestellung</option>
          <option value="sonstiges">Sonstiges</option>
        </select>
      </label>
    </div>


    <label>Adresse suchen (Vorschläge aus gespeicherten Kunden)
      <input id="customerAddressSearch" list="customerAddressSuggestions" placeholder="z.B. Musterstraße 12a, 12345 Musterstadt" />
      <datalist id="customerAddressSuggestions"></datalist>
    </label>

    <div class="row">
      <label>Straße
        <input id="customerStreet" placeholder="z.B. Musterstraße" />
      </label>
      <label>Hausnummer
        <input id="customerHouseNumber" placeholder="z.B. 12a" />
      </label>
    </div>

    <div class="row">
      <label>PLZ
        <input id="customerPostalCode" placeholder="z.B. 12345" />
      </label>
      <label>Ort
        <input id="customerCity" placeholder="z.B. Musterstadt" />
      </label>
    </div>

    <div class="row">
      <label>Gültig ab
        <input id="customerAgreementSince" type="date" />
      </label>
      <label>Bis (optional)
        <input id="customerAgreementUntil" type="date" />
      </label>
    </div>

    <label>Notiz
      <textarea id="customerAgreementNote" rows="2" placeholder="Details zur Absprache"></textarea>
    </label>

    <div class="controls">
      <button id="saveCustomerAgreement" class="small" aria-label="Absprache speichern" title="Absprache speichern">💾</button>
      <button id="clearCustomerAgreementForm" class="small" aria-label="Formular leeren" title="Formular leeren">🧹</button>
      <button id="printCustomerList" class="small" aria-label="Kundenliste drucken" title="Kundenliste drucken">🖨️</button>
    </div>

    <div class="row" style="margin-top:8px">
      <label>Druckfilter von
        <input id="customerPrintFrom" type="date" />
      </label>
      <label>bis
        <input id="customerPrintTo" type="date" />
      </label>
    </div>
    <p class="muted" style="margin-top:6px">Beim Drucken werden Kundendaten nach „Gültig ab" im gewählten Zeitraum gefiltert.</p>

    <div id="customerAgreementsList" class="customer-agreements-list" style="margin-top:12px"></div>
  </div>
</section>

<section id="sectionSettings" class="tabSection">
  <div class="panel">
    <h3>Einstellungen</h3>
    <hr/>
    <h4>Grundgehalt (Monat)</h4>
    <div class="row">
      <select id="baseSalaryMonth"></select>
      <input id="baseSalaryValue" type="number" step="0.01" value="2500.00" placeholder="Grundgehalt für Monat"/>
    </div>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button id="saveBaseSalary" class="small" aria-label="Monatswert speichern" title="Monatswert speichern">💾</button>
      <button id="clearBaseSalary" class="small" aria-label="Monatswert löschen" title="Monatswert löschen">🗑️</button>
    </div>

    <hr/>
    <h4>Heimschläfer</h4>
    <div class="row">
      <select id="heimschlaeferMonth"></select>
      <input id="heimschlaeferNetto" type="number" step="0.01" value="0.00" placeholder="Fixes Netto für Monat"/>
    </div>
    <label style="margin-top:8px"><input type="checkbox" id="heimschlaeferEnabled"/> Heimschläfer aktiv (Netto + Spesen)</label>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button id="saveHeimschlaefer" class="small" aria-label="Monatswert speichern" title="Monatswert speichern">💾</button>
      <button id="clearHeimschlaefer" class="small" aria-label="Monatswert löschen" title="Monatswert löschen">🗑️</button>
    </div>

    <hr/>
    <h4>PAPROV</h4>
    <div class="row">
      <select id="paprovMonth"></select>
      <input id="paprovValue" type="number" step="0.01" value="0.00" placeholder="PAPROV für Monat"/>
    </div>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button id="savePaprov" class="small" aria-label="Monatswert speichern" title="Monatswert speichern">💾</button>
      <button id="clearPaprov" class="small" aria-label="Monatswert löschen" title="Monatswert löschen">🗑️</button>
    </div>

    <hr/>
    <div class="row">
      <label>Abrechnungsjahr (automatisch)
        <input id="netTaxYear" type="number" readonly />
      </label>
      <label>Betriebliche Altersvorsorge (€/mtl.)
        <input id="netBav" type="number" step="0.01" value="0.00" />
      </label>
    </div>
    <div class="row">
      <label>Steuerklasse
        <select id="netTaxClass">
          <option value="I">I</option><option value="II">II</option><option value="III">III</option><option value="IV">IV</option><option value="V">V</option><option value="VI">VI</option>
        </select>
      </label>
      <label>Bundesland
        <select id="netState">
          <option value="BW">Baden-Württemberg</option><option value="BY">Bayern</option><option value="BE">Berlin</option><option value="BB">Brandenburg</option><option value="HB">Bremen</option><option value="HH">Hamburg</option><option value="HE">Hessen</option><option value="MV">Mecklenburg-Vorpommern</option><option value="NI">Niedersachsen</option><option value="NW">Nordrhein-Westfalen</option><option value="RP">Rheinland-Pfalz</option><option value="SL">Saarland</option><option value="SN">Sachsen</option><option value="ST">Sachsen-Anhalt</option><option value="SH">Schleswig-Holstein</option><option value="TH">Thüringen</option>
        </select>
      </label>
    </div>
    <div class="row">
      <label>Kirchensteuer (ja/nein)
        <select id="netChurch">
          <option value="yes">Ja</option>
          <option value="no">Nein</option>
        </select>
      </label>
      <label>Krankenversicherung
        <select id="netKvType">
          <option value="gesetzlich">Gesetzlich</option>
          <option value="freiwillig">Freiwillig gesetzlich</option>
          <option value="privat">Privat</option>
        </select>
      </label>
    </div>
    <div class="row">
      <label>Krankenkasse / Zusatzbeitrag
        <select id="netKvFund">
          <option value="2.45">Standard (2,45%)</option>
          <option value="2.6">AOK Baden-Württemberg (2,60%)</option>
          <option value="2.69">AOK Bayern (2,69%) – 2026: vorbehaltlich 19.12.2025</option>
          <option value="2.49">AOK Bremen/Bremerhaven (2,49%)</option>
          <option value="2.49">AOK Hessen (2,49%)</option>
          <option value="2.7">AOK Niedersachsen (2,70%)</option>
          <option value="3.5">AOK Nordost (3,50%)</option>
          <option value="2.79">AOK NORDWEST (2,79%)</option>
          <option value="3.1">AOK PLUS (3,10%) – 2026: Beschluss 19.12.2025</option>
          <option value="2.47">AOK Rheinland-Pfalz/Saarland (2,47%)</option>
          <option value="2.99">AOK Rheinland/Hamburg (2,99%)</option>
          <option value="2.5">AOK Sachsen-Anhalt (2,50%)</option>
          <option value="2.4">Audi BKK (2,40%)</option>
          <option value="3.4">BAHN-BKK (3,40%)</option>
          <option value="3.29">BARMER (3,29%) – 2026: geplant, Bestätigung 19.12.2025</option>
          <option value="2.95">BERGISCHE Krankenkasse (2,95%)</option>
          <option value="3.2">Bertelsmann BKK (3,20%)</option>
          <option value="3.39">BIG direkt gesund (3,39%)</option>
          <option value="4.39">BKK24 (4,39%)</option>
          <option value="3.39">BKK Akzo Nobel Bayern (3,39%) – 2026: geplant, Beschluss 18.12.2025</option>
          <option value="3.8">BKK Diakonie (3,80%)</option>
          <option value="3.88">BKK DürkoppAdler (3,88%)</option>
          <option value="3.39">BKK EUREGIO (3,39%)</option>
          <option value="2.39">BKK exklusiv (2,39%)</option>
          <option value="2.18">BKK Faber-Castell &amp; Partner (2,18%)</option>
          <option value="2.18">BKK firmus (2,18%)</option>
          <option value="2.49">BKK Freudenberg (2,49%)</option>
          <option value="3.4">BKK GILDEMEISTER SEIDENSTICKER (3,40%)</option>
          <option value="4.38">BKK Herkules (4,38%)</option>
          <option value="2.99">BKK Linde (2,99%)</option>
          <option value="3.5">bkk melitta hmr (3,50%)</option>
          <option value="3.5">BKK mkk- meine Krankenkasse (3,50%)</option>
          <option value="2.78">BKK PFAFF (2,78%)</option>
          <option value="3.9">BKK Pfalz (3,90%)</option>
          <option value="2.89">BKK ProVita (2,89%)</option>
          <option value="2.3">BKK Public (2,30%)</option>
          <option value="3.4">BKK Scheufelen (3,40%)</option>
          <option value="2.44">BKK SBH (2,44%)</option>
          <option value="3.49">BKK Technoform (3,49%)</option>
          <option value="3.19">BKK VDN (3,19%) – 2026: voraussichtlich stabil</option>
          <option value="3.89">BKK VerbundPlus (3,89%)</option>
          <option value="3.39">BKK WERRA-MEISSNER (3,39%)</option>
          <option value="3.99">BKK Wirtschaft &amp; Finanzen (3,99%)</option>
          <option value="2.68">BOSCH BKK (2,68%)</option>
          <option value="3.33">Continentale Betriebskrankenkasse (3,33%)</option>
          <option value="2.8">DAK-Gesundheit (2,80%)</option>
          <option value="3.25">Debeka BKK (3,25%)</option>
          <option value="2.98">energie-BKK (2,98%) – 2026: 3,98%</option>
          <option value="3.1">Heimat Krankenkasse (3,10%)</option>
          <option value="2.5">HEK-Hanseatische Krankenkasse (2,50%)</option>
          <option value="2.19">hkk Krankenkasse (2,19%)</option>
          <option value="4.3">IKK - Die Innovationskasse (4,30%) – 2026: voraussichtlich stabil</option>
          <option value="4.35">IKK Brandenburg und Berlin (4,35%)</option>
          <option value="3.4">IKK classic (3,40%)</option>
          <option value="3.39">IKK gesund plus (3,39%)</option>
          <option value="3.25">IKK Südwest (3,25%) – 2026: voraussichtlich stabil</option>
          <option value="3.78">KKH Kaufmännische Krankenkasse (3,78%) – 2026: geplant, Beschluss 20.12.2025</option>
          <option value="4.4">Knappschaft (4,40%)</option>
          <option value="3.29">mhplus BKK (3,29%)</option>
          <option value="3.89">Mobil Krankenkasse (3,89%)</option>
          <option value="2.98">Novitas BKK (2,98%)</option>
          <option value="3.2">pronova BKK (3,20%)</option>
          <option value="2.96">R + V Betriebskrankenkasse (2,96%)</option>
          <option value="2.99">Salus BKK (2,99%)</option>
          <option value="3.8">SBK (3,80%) – 2026: keine Erhöhung geplant (Sitzung 10.12.2025)</option>
          <option value="3.9">SECURVITA Krankenkasse (3,90%)</option>
          <option value="2.48">SKD BKK (2,48%)</option>
          <option value="2.45">Techniker Krankenkasse (2,45%)</option>
          <option value="2.5">TUI BKK (2,50%)</option>
          <option value="3.27">VIACTIV Krankenkasse (3,27%)</option>
          <option value="3.79">vivida bkk (3,79%)</option>
          <option value="2.45">WMF BKK (2,45%)</option>
          <option value="3.4">ZF BKK (3,40%)</option>
          <option value="custom">Individueller Satz</option>
        </select>
      </label>
      <label>KV-Zusatzbeitrag (14,6% + …)
        <input id="netKvZusatz" type="number" step="0.01" min="0" max="5" />
      </label>
    </div>
    <div class="row">
      <label>Privatbeitrag (€/mtl., nur bei PKV)
        <input id="netKvFlatRate" type="number" step="0.01" value="0.00" />
      </label>
      <label>Pflegeversicherung: Kinderstatus
        <select id="netKids">
          <option value="childless_over_23">Kinderlos, mind. 23</option>
          <option value="childless_under_23">Kinderlos, unter 23</option>
          <option value="one_child">1 Kind</option>
          <option value="two_children">2 Kinder</option>
          <option value="three_children">3 Kinder</option>
          <option value="four_children">4 Kinder</option>
          <option value="five_plus_children">5 oder mehr Kinder</option>
        </select>
      </label>
    </div>
    <div class="row">
      <label>Ihr Alter
        <input id="netAge" type="number" min="16" max="80" />
      </label>
      <label>Rentenversicherung
        <select id="netRvRate">
          <option value="0.093">Standard (9,3%)</option>
          <option value="0">Befreit (0%)</option>
          <option value="0.101">Knappschaft Bahn/See (10,1%)</option>
        </select>
      </label>
    </div>
    <div class="row">
      <label>Arbeitslosenversicherung
        <select id="netAvRate">
          <option value="0.013">Standard (1,3%)</option>
          <option value="0.015">Erhöhter Satz (1,5%)</option>
          <option value="0">Befreit (0%)</option>
        </select>
      </label>
    </div>
    <hr/>
    <h4>Kundenmanagement</h4>
    <div class="row">
      <select id="lostCustomersMonth"></select>
      <input id="lostCustomersValue" type="number" step="1" value="0" placeholder="Verlorene Kunden im Monat" />
    </div>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button id="saveLostCustomers" class="small" aria-label="Monatswert speichern" title="Monatswert speichern">💾</button>
      <button id="clearLostCustomers" class="small" aria-label="Monatswert löschen" title="Monatswert löschen">🗑️</button>
    </div>

    <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
      <button id="openBackups" class="small">Backups verwalten</button>
      <button id="saveSettings" class="small" aria-label="Einstellungen speichern" title="Einstellungen speichern">💾</button>
    </div>
  </div>
</section>

<section id="sectionBackups" class="tabSection">
  <div class="panel">
    <h3>Backups</h3>
    <div id="backupsList" style="max-height:50vh;overflow:auto"></div>
    <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
      <button id="closeBackups" class="small">Zurück zu Touren</button>
      <button id="clearBackups" class="small" aria-label="Backups löschen" title="Backups löschen">🗑️</button>
    </div>
  </div>
</section>

<section id="sectionExport" class="tabSection">
  <div class="panel">
    <h3>Export, Import &amp; Drucken</h3>
    <div class="muted" style="margin-bottom:8px">Aktionen wirken auf den ausgewählten Monat/Jahr.</div>
    <div class="controls">
      <button id="exportCsv" class="small">CSV exportieren</button>
      <button id="exportPdf" class="small">PDF exportieren</button>
      <button id="importCsv" class="small">CSV importieren</button>
      <button id="exportJson" class="small">JSON exportieren</button>
      <button id="importJson" class="small">JSON importieren</button>
      <button id="printReport" class="small" aria-label="Bericht drucken" title="Bericht drucken">🖨️</button>
      <button id="resetAll" class="small" aria-label="Alle Daten löschen" title="Alle Daten löschen">🗑️</button>
    </div>
    <input type="file" id="csvInput" accept=".csv" style="display:none" />
    <input type="file" id="jsonInput" accept=".json" style="display:none" />
  </div>
</section>

<!-- Edit Modal -->
<div id="editModal" class="modal"><div class="modalContent">
  <h3>Tour bearbeiten</h3>
  <form onsubmit="return false;">
    <label>Tour-Nr. / Bezeichnung
      <input type="text" id="editId" placeholder="z.B. Tour 101"/>
    </label>

    <div class="row">
      <div>
        <label>Datum<input type="date" id="editDate"/></label>
      </div>
      <div>
        <label>Umsatz<input type="number" step="0.01" id="editAmount"/></label>
      </div>
    </div>

    <div class="row">
      <div>
        <label>Reklamation<input type="number" step="0.01" id="editReklamation"/></label>
      </div>
      <div>
        <label>Gutscheine<input type="number" step="0.01" id="editGutscheine"/></label>
      </div>
    </div>

    <div class="entry-grid">
      <section class="entry-block">
        <h4>Allgemein</h4>
        <div class="row">
          <div>
            <label>Neukunden<input type="number" id="editNewC"/></label>
          </div>
          <div></div>
        </div>
      </section>

      <section class="entry-block compact-entry-block">
        <h4>Integrationen</h4>
        <p class="entry-block-hint">Anzahl // Kauf // NE // KB // Absage // Vorbestellt</p>
        <div class="compact-metrics-row">
          <label>Anzahl<input type="number" id="editIntegrations"/></label>
          <label>Kauf<input type="number" id="editIntegrationBought"/></label>
          <label>NE<input type="number" id="editIntegrationUnreachable"/></label>
          <label>KB<input type="number" id="editIntegrationNoNeed"/></label>
          <label>Absage<input type="number" id="editIntegrationCancelled"/></label>
          <label>Vorbestellt<input type="number" id="editIntegrationPreordered"/></label>
        </div>
      </section>

      <section class="entry-block compact-entry-block">
        <h4>Tourentag (normale Tour)</h4>
        <p class="entry-block-hint">Anzahl // Kauf // NE // KB // Absage // Reservierung // Vortag NE</p>
        <div class="compact-metrics-row">
          <label>Anzahl<input type="number" id="editSchooldayCustomers"/></label>
          <label>Kauf<input type="number" id="editBuyingCustomers"/></label>
          <label>NE<input type="number" id="editTourdayNi"/></label>
          <label>KB<input type="number" id="editTourdayKb"/></label>
          <label>Absage<input type="number" id="editTourdayCancelled"/></label>
          <label>Reservierung<input type="number" id="editTourdayReserved"/></label>
          <label>Vortag NE<input type="number" id="editPrevDayUnreachable"/></label>
        </div>
        <p class="entry-block-hint" style="margin-top:8px;">Vortag NE: Kauf // NE // KB</p>
        <div class="compact-metrics-row compact-metrics-row--five">
          <label>Kauf<input type="number" id="editPrevDayBought"/></label>
          <label>NE<input type="number" id="editPrevDayNi"/></label>
          <label>KB<input type="number" id="editPrevDayKb"/></label>
        </div>
      </section>

      <section class="entry-block compact-entry-block">
        <h4>D3 Kunden</h4>
        <p class="entry-block-hint">Anzahl // Kauf // NE // KB // Absage // Vorbestellt</p>
        <div class="compact-metrics-row">
          <label>Anzahl<input type="number" id="editThreeCustomersTotal"/></label>
          <label>Kauf<input type="number" id="editThreeCustomersBought"/></label>
          <label>NE<input type="number" id="editThreeCustomersNi"/></label>
          <label>KB<input type="number" id="editThreeCustomersKb"/></label>
          <label>Absage<input type="number" id="editThreeCustomersCancelled"/></label>
          <label>Vorbestellt<input type="number" id="editThreeCustomersPreordered"/></label>
        </div>
      </section>
    </div>

    <label>Tourenart
      <select id="editTourType">
        <option value="tourentag">Tourentag</option>
        <option value="werbetag">Werbetag</option>
        <option value="neukundentour">Neukundentour</option>
        <option value="krank">Krank</option>
        <option value="urlaub">Urlaub</option>
      </select>
    </label>

    <label style="margin-top:10px;"><input type="checkbox" id="editVertretung"/> Vertretung (+2%)</label>
    <label><input type="checkbox" id="editFahrt45"/> Entfernung &gt;45min (+0,25%)</label>

    <h4 style="margin-top:12px">Aktionen</h4>
    <label>Aktionen-Details
      <input type="text" id="editActionsDetail" placeholder='z.B. 3x5.99|2x3.50'/>
    </label>

    <label>Notiz<input type="text" id="editNote"/></label>

    <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
      <button id="cancelEdit" class="small">Abbrechen</button>
      <button id="saveEdit" class="small" aria-label="Änderungen speichern" title="Änderungen speichern">💾</button>
    </div>
  </form>
</div></div>

</div>

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
