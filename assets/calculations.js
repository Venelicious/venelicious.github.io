export function toCents(e) {
  return Math.round(Number(e || 0) * 100);
}

export function fromCents(c) {
  return (c / 100).toFixed(2);
}

export function sanitizeForPdf(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, 'und').replace(/</g, '').replace(/>/g, '').replace(/–/g, '-');
}

export function tickFor(val) {
  return val ? '✔' : '✖';
}

export function computeActionSum(actions) {
  if (!actions || !actions.length) return 0;
  return actions.reduce((s, a) => s + Number(a.price || 0) * Number(a.qty || 0), 0);
}

export function computeActionProvisionCents(actions) {
  const sum = computeActionSum(actions);
  return toCents(sum * 0.1);
}

function getNeukundenRate(totalCount, conf) {
  const base = Number(conf.newBase || 30);
  const high = Number(conf.newHigh || 60);
  const threshold = Number(conf.newThreshold || 4);
  return totalCount >= threshold ? high : base;
}

export function computeMonthlyNeukundenBonusCents(totalCount, conf) {
  const rate = getNeukundenRate(totalCount, conf);
  return toCents(totalCount * rate);
}

export function computeNeukundenBonusForTourCents(tourCount, totalCount, conf) {
  const rate = getNeukundenRate(totalCount, conf);
  return toCents(tourCount * rate);
}

export function computeIntegrationCents(count, conf) {
  return toCents(count * Number(conf.integrationAmount || 0));
}

export function computeSpesenCentsForTour(t, conf) {
  let s = 0;
  if (t.tourType !== 'krank' && t.tourType !== 'urlaub') {
    s += toCents(conf.spKleider || 1.2);
  }
  if (t.tourType === 'tourentag' || t.tourType === 'neukundentour') {
    s += toCents(conf.spAuslagen || 10.0);
  }
  return s;
}

export function computeKundenmanagementBonusCents(lost) {
  const base = 300;
  if (lost <= 5) return toCents(base);
  const red = (lost - 5) * 30;
  return toCents(Math.max(base - red, 0));
}

export function determineVGRate(avgEuro) {
  if (avgEuro >= 1630) return 0.095;
  if (avgEuro >= 1400) return 0.0925;
  if (avgEuro >= 1285) return 0.09;
  if (avgEuro >= 1130) return 0.0875;
  return 0.085;
}

function taxClassFactor(tc) {
  switch (tc) {
    case 'II': return 0.98;
    case 'III': return 0.6;
    case 'V': return 1.3;
    case 'VI': return 1.4;
    default: return 1; // I & IV
  }
}

export function computeNetResult(bruttoEuro, netConf = {}) {
  const brutto = Number(bruttoEuro || 0);
  const defaults = {
    taxClass: 'I',
    state: 'NW',
    churchTax: false,
    kvType: 'gesetzlich',
    kvZusatz: 2.45,
    kvFlatRate: 0,
    hasKids: true,
    age: 30,
    bavMonthly: 0,
    rvRate: 0.093,
    avRate: 0.013,
    pvRate: 0.024,
    pvSurchargeRate: 0.0035,
    taxYear: new Date().getFullYear(),
  };
  const conf = { ...defaults, ...netConf };
  conf.churchTax = netConf.churchTax ?? defaults.churchTax;
  conf.hasKids = netConf.hasKids ?? defaults.hasKids;

  if (brutto <= 0) {
    return {
      netto: 0,
      breakdown: { rv: 0, av: 0, kv: 0, pv: 0, social: 0, lohnsteuer: 0, soli: 0, kirche: 0, bav: Number(conf.bavMonthly || 0), taxableBrutto: 0 }
    };
  }

  const bav = Number(conf.bavMonthly || 0);
  const taxableBrutto = Math.max(brutto - bav, 0);

  const kvZusatz = Number(conf.kvZusatz ?? defaults.kvZusatz);
  const kvRate = (conf.kvType === 'gesetzlich' || conf.kvType === 'freiwillig') ? ((14.6 + kvZusatz) / 100) / 2 : 0;
  const kvFlat = conf.kvType === 'privat' ? Number(conf.kvFlatRate || 0) : 0;

  const pvSurcharge = (!conf.hasKids && Number(conf.age || 0) >= 23) ? Number(conf.pvSurchargeRate ?? defaults.pvSurchargeRate) : 0;
  const pvRate = Number(conf.pvRate ?? defaults.pvRate) + pvSurcharge;

  const rvRate = Number(conf.rvRate ?? defaults.rvRate);
  const avRate = Number(conf.avRate ?? defaults.avRate);
  const churchRate = conf.churchTax ? (conf.state === 'BY' || conf.state === 'BW' ? 0.08 : 0.09) : 0;

  const rv = taxableBrutto * rvRate;
  const av = taxableBrutto * avRate;
  const kv = taxableBrutto * kvRate + kvFlat;
  const pv = taxableBrutto * pvRate;
  const sozial = rv + av + kv + pv;

  const taxableIncome = Math.max(taxableBrutto - sozial, 0);

  const annualBrutto = taxableIncome * 12;
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
  lohnsteuerAnnual *= taxClassFactor(conf.taxClass);

  let lohnsteuerMonat = lohnsteuerAnnual / 12;
  let soli = lohnsteuerMonat > 16 ? lohnsteuerMonat * 0.055 : 0;
  let kirche = lohnsteuerMonat * churchRate;

  let netto = brutto - sozial - lohnsteuerMonat - soli - kirche - bav;

  return {
    netto,
    breakdown: { rv, av, kv, pv, social: sozial, lohnsteuer: lohnsteuerMonat, soli, kirche, bav, taxableBrutto, taxableIncome }
  };
}

export function computeNetFromBrutto(bruttoEuro, netConf = {}) {
  return computeNetResult(bruttoEuro, netConf).netto;
}
