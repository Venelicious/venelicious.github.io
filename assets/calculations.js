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

export function computeNetFromBrutto(bruttoEuro) {
  const brutto = Number(bruttoEuro || 0);
  const rv = brutto * 0.093;
  const av = brutto * 0.0125;
  const kv = brutto * ((14.6 + 2.45) / 100 / 2);
  const pv = brutto * 0.024;
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
