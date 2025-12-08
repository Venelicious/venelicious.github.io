import { computeLohnsteuer2025 } from './lohnsteuer2025.js';

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
  // Kinderstatus sauber normalisieren, damit der Zuschlag nur bei ausdrücklicher Kinderlosigkeit greift.
  const hasKids = netConf.hasKids === false
    ? false
    : netConf.hasKids === true
      ? true
      : defaults.hasKids;
  conf.hasKids = hasKids;

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

  const isChildless = conf.hasKids === false;
  const pvSurcharge = (isChildless && Number(conf.age || 0) >= 23) ? Number(conf.pvSurchargeRate ?? defaults.pvSurchargeRate) : 0;
  const pvRate = Number(conf.pvRate ?? defaults.pvRate) + pvSurcharge;

  const rvRate = Number(conf.rvRate ?? defaults.rvRate);
  const avRate = Number(conf.avRate ?? defaults.avRate);
  const churchRate = conf.churchTax ? (conf.state === 'BY' || conf.state === 'BW' ? 0.08 : 0.09) : 0;

  const rv = taxableBrutto * rvRate;
  const av = taxableBrutto * avRate;
  const kv = taxableBrutto * kvRate + kvFlat;
  const pv = taxableBrutto * pvRate;
  const sozial = rv + av + kv + pv;

  // PAP-2025 basierte Lohnsteuer
  const taxableForPapEuro = Math.max(taxableBrutto, 0);
  const birthYear = conf.age ? (conf.taxYear - conf.age) : null;
  const ajahr = conf.age ? birthYear + 65 : 0;
  const papResult = computeLohnsteuer2025({
    RE4: toCents(taxableForPapEuro),
    LZZ: 2,
    STKL: conf.taxClass,
    KVZ: Number(conf.kvZusatz ?? defaults.kvZusatz),
    PKV: conf.kvType === 'privat' ? 2 : 0,
    PKPV: conf.kvType === 'privat' ? toCents(conf.kvFlatRate || 0) : 0,
    KRV: rvRate === 0 ? 1 : 0,
    PVS: conf.state === 'SN' ? 1 : 0,
    PVZ: (!conf.hasKids && Number(conf.age || 0) >= 23) ? 1 : 0,
    PVA: 0,
    R: conf.churchTax ? 1 : 0,
    ZKF: conf.hasKids ? 1 : 0,
    ALTER1: Number(conf.age || 0) >= 64 ? 1 : 0,
    AJAHR: ajahr || 0,
  });

  const lohnsteuerMonat = papResult.LSTLZZ;
  const soli = papResult.SOLZLZZ;
  const kirche = papResult.BK * churchRate;

  let netto = brutto - sozial - lohnsteuerMonat - soli - kirche - bav;
  const taxableIncome = papResult.ZVE ? papResult.ZVE / 100 : taxableBrutto;

  return {
    netto,
    breakdown: { rv, av, kv, pv, social: sozial, lohnsteuer: lohnsteuerMonat, soli, kirche, bav, taxableBrutto, taxableIncome }
  };
}

export function computeNetFromBrutto(bruttoEuro, netConf = {}) {
  return computeNetResult(bruttoEuro, netConf).netto;
}
