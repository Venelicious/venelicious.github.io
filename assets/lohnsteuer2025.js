// Lohnsteuerberechnung nach dem amtlichen Programmablaufplan 2025 (vereinfacht auf laufenden Arbeitslohn)
// Quelle: PAP-Spezifikation "Lohnsteuer2025" Version 1.0 (Auszug im User-Kontext)

const ROUND = {
  DOWN: 'DOWN',
  UP: 'UP',
};

function round(value, decimals = 0, mode = ROUND.DOWN) {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  if (mode === ROUND.UP) {
    return (scaled >= 0 ? Math.ceil(scaled) : Math.floor(scaled)) / factor;
  }
  return (scaled >= 0 ? Math.floor(scaled) : Math.ceil(scaled)) / factor;
}

const ZAHL = {
  ONE: 1,
  TWO: 2,
  FIVE: 5,
  SEVEN: 7,
  TWELVE: 12,
  HUNDRED: 100,
  THREE_SIXTY: 360,
  FIVE_HUNDRED: 500,
  SEVEN_HUNDRED: 700,
  TEN_THOUSAND: 10000,
};

// Tabellen aus dem PAP (gekürzt für 2025)
const TAB1 = [
  0, 0.4, 0.384, 0.368, 0.352, 0.336, 0.32, 0.304, 0.288, 0.272, 0.256,
  0.24, 0.224, 0.208, 0.192, 0.176, 0.16, 0.152, 0.144, 0.14, 0.136, 0.132,
  0.128, 0.124, 0.12, 0.116, 0.112, 0.108, 0.104, 0.1, 0.096, 0.092, 0.088,
  0.084, 0.08, 0.076, 0.072, 0.068, 0.064, 0.06, 0.056, 0.052, 0.048, 0.044,
  0.04, 0.036, 0.032, 0.028, 0.024, 0.02, 0.016, 0.012, 0.008, 0.004, 0,
];

const TAB2 = [
  0, 3000, 2880, 2760, 2640, 2520, 2400, 2280, 2160, 2040, 1920, 1800, 1680,
  1560, 1440, 1320, 1200, 1140, 1080, 1050, 1020, 990, 960, 930, 900, 870,
  840, 810, 780, 750, 720, 690, 660, 630, 600, 570, 540, 510, 480, 450, 420,
  390, 360, 330, 300, 270, 240, 210, 180, 150, 120, 90, 60, 30, 0,
];

const TAB3 = [
  0, 900, 864, 828, 792, 756, 720, 684, 648, 612, 576, 540, 504, 468, 432,
  396, 360, 342, 324, 315, 306, 297, 288, 279, 270, 261, 252, 243, 234, 225,
  216, 207, 198, 189, 180, 171, 162, 153, 144, 135, 126, 117, 108, 99, 90,
  81, 72, 63, 54, 45, 36, 27, 18, 9, 0,
];

const TAB4 = TAB1; // identisch für 2025 laut PAP

const TAB5 = [
  0, 1900, 1824, 1748, 1672, 1596, 1520, 1444, 1368, 1292, 1216, 1140, 1064,
  988, 912, 836, 760, 722, 684, 665, 646, 627, 608, 589, 570, 551, 532, 513,
  494, 475, 456, 437, 418, 399, 380, 361, 342, 323, 304, 285, 266, 247, 228,
  209, 190, 171, 152, 133, 114, 95, 76, 57, 38, 19, 0,
];

// Hilfsfunktionen für Steuerklassen und Kinderfreibeträge
function mapTaxClass(stkl) {
  switch (String(stkl).toUpperCase()) {
    case 'I': return 1;
    case 'II': return 2;
    case 'III': return 3;
    case 'IV': return 4;
    case 'V': return 5;
    case 'VI': return 6;
    default: return Number(stkl) || 1;
  }
}

function roundCents(value) {
  return Math.round(value * 100) / 100;
}

export function computeLohnsteuer2025(inputParams) {
  const p = {
    // Eingaben
    af: 1,
    f: 1,
    AJAHR: 0,
    ALTER1: 0,
    JFREIB: 0,
    JHINZU: 0,
    JRE4: 0,
    JRE4ENT: 0,
    JVBEZ: 0,
    KRV: 0,
    KVZ: 0,
    LZZ: 2,
    LZZFREIB: 0,
    LZZHINZU: 0,
    MBV: 0,
    PKPV: 0,
    PKV: 0,
    PVA: 0,
    PVS: 0,
    PVZ: 0,
    R: 0,
    RE4: 0,
    SONSTB: 0,
    SONSTENT: 0,
    STERBE: 0,
    STKL: 1,
    VBEZ: 0,
    VBEZM: 0,
    VBEZS: 0,
    VBS: 0,
    VJAHR: 0,
    ZKF: 0,
    ZMVB: 0,
    // Outputs
    BK: 0,
    LSTLZZ: 0,
    SOLZLZZ: 0,
    // interne Felder, initial 0
  };

  Object.assign(p, inputParams);
  p.STKL = mapTaxClass(p.STKL);

  // Interne Felder mit Default
  Object.assign(p, {
    FVBZ: 0, FVB: 0, FVBZSO: 0, FVBSO: 0,
    ALTE: 0, HBALTE: 0, EFA: 0, SAP: 0, ANP: 0,
    ZRE4J: 0, ZVBEZJ: 0, JLFREIB: 0, JLHINZU: 0,
    ZRE4: 0, ZRE4VP: 0, ZVBEZ: 0, KFB: 0, KZTAB: 1,
    ZTABFB: 0, VSP: 0, VSP1: 0, VSP2: 0, VSP3: 0,
    VSPN: 0, LSTJAHR: 0, JW: 0, ANTEIL1: 0, ST: 0,
    SOLZFREI: 0, JBMG: 0, VBEZBSO: 0,
    VFRB: 0, WVFRB: 0, VKV: 0, VKVLZZ: 0,
  });

  // Methoden
  function MPARA() {
    if (p.KRV < 1) {
      p.BBGRV = 96600;
      p.RVSATZAN = 0.093;
    }
    p.BBGKVPV = 66150;
    p.KVSATZAN = p.KVZ / 2 / 100 + 0.07;
    p.KVSATZAG = 0.0125 + 0.07;
    if (p.PVS === 1) {
      p.PVSATZAN = 0.023;
      p.PVSATZAG = 0.013;
    } else {
      p.PVSATZAN = 0.018;
      p.PVSATZAG = 0.018;
    }
    if (p.PVZ === 1) {
      p.PVSATZAN += 0.006;
    } else {
      p.PVSATZAN -= p.PVA * 0.0025;
    }
    p.W1STKL5 = 13785;
    p.W2STKL5 = 34240;
    p.W3STKL5 = 222260;
    p.GFB = 12096;
    p.SOLZFREI = 19950;
  }

  function MRE4JL() {
    if (p.LZZ === 1) {
      p.ZRE4J = round(p.RE4 / ZAHL.HUNDRED, 2, ROUND.DOWN);
      p.ZVBEZJ = round(p.VBEZ / ZAHL.HUNDRED, 2, ROUND.DOWN);
      p.JLFREIB = round(p.LZZFREIB / ZAHL.HUNDRED, 2, ROUND.DOWN);
      p.JLHINZU = round(p.LZZHINZU / ZAHL.HUNDRED, 2, ROUND.DOWN);
    } else if (p.LZZ === 2) {
      p.ZRE4J = round((p.RE4 * ZAHL.TWELVE) / ZAHL.HUNDRED, 2, ROUND.DOWN);
      p.ZVBEZJ = round((p.VBEZ * ZAHL.TWELVE) / ZAHL.HUNDRED, 2, ROUND.DOWN);
      p.JLFREIB = round((p.LZZFREIB * ZAHL.TWELVE) / ZAHL.HUNDRED, 2, ROUND.DOWN);
      p.JLHINZU = round((p.LZZHINZU * ZAHL.TWELVE) / ZAHL.HUNDRED, 2, ROUND.DOWN);
    } else if (p.LZZ === 3) {
      p.ZRE4J = round((p.RE4 * ZAHL.THREE_SIXTY) / ZAHL.SEVEN_HUNDRED, 2, ROUND.DOWN);
      p.ZVBEZJ = round((p.VBEZ * ZAHL.THREE_SIXTY) / ZAHL.SEVEN_HUNDRED, 2, ROUND.DOWN);
      p.JLFREIB = round((p.LZZFREIB * ZAHL.THREE_SIXTY) / ZAHL.SEVEN_HUNDRED, 2, ROUND.DOWN);
      p.JLHINZU = round((p.LZZHINZU * ZAHL.THREE_SIXTY) / ZAHL.SEVEN_HUNDRED, 2, ROUND.DOWN);
    } else {
      p.ZRE4J = round((p.RE4 * ZAHL.THREE_SIXTY) / ZAHL.HUNDRED, 2, ROUND.DOWN);
      p.ZVBEZJ = round((p.VBEZ * ZAHL.THREE_SIXTY) / ZAHL.HUNDRED, 2, ROUND.DOWN);
      p.JLFREIB = round((p.LZZFREIB * ZAHL.THREE_SIXTY) / ZAHL.HUNDRED, 2, ROUND.DOWN);
      p.JLHINZU = round((p.LZZHINZU * ZAHL.THREE_SIXTY) / ZAHL.HUNDRED, 2, ROUND.DOWN);
    }
    if (p.af === 0) p.f = 1;
  }

  function MRE4ALTE() {
    if (p.ALTER1 === 0) {
      p.ALTE = 0;
      return;
    }
    let K;
    if (p.AJAHR < 2006) {
      K = 1;
    } else if (p.AJAHR < 2058) {
      K = p.AJAHR - 2004;
    } else {
      K = 54;
    }
    p.BMG = p.ZRE4J - p.ZVBEZJ;
    p.ALTE = round(Math.ceil((p.BMG * TAB4[K])));
    p.HBALTE = TAB5[K];
    if (p.ALTE > p.HBALTE) p.ALTE = p.HBALTE;
  }

  function MRE4() {
    if (p.ZVBEZJ === 0) {
      p.FVBZ = 0; p.FVB = 0; p.FVBZSO = 0; p.FVBSO = 0;
    } else {
      let J;
      if (p.VJAHR < 2006) {
        J = 1;
      } else if (p.VJAHR < 2058) {
        J = p.VJAHR - 2004;
      } else {
        J = 54;
      }
      if (p.LZZ === 1) {
        p.VBEZB = p.VBEZM * p.ZMVB + p.VBEZS;
        p.HFVB = Math.ceil((TAB2[J] / ZAHL.TWELVE) * p.ZMVB);
        p.FVBZ = Math.ceil((TAB3[J] / ZAHL.TWELVE) * p.ZMVB);
      } else {
        p.VBEZB = round((p.VBEZM * ZAHL.TWELVE + p.VBEZS), 2, ROUND.DOWN);
        p.HFVB = TAB2[J];
        p.FVBZ = TAB3[J];
      }
      p.FVB = round((p.VBEZB * TAB1[J]) / ZAHL.HUNDRED, 2, ROUND.UP);
      if (p.FVB > p.HFVB) p.FVB = p.HFVB;
      if (p.FVB > p.ZVBEZJ) p.FVB = p.ZVBEZJ;

      p.FVBSO = round(p.FVB + (p.VBEZBSO * TAB1[J]) / ZAHL.HUNDRED, 2, ROUND.UP);
      if (p.FVBSO > TAB2[J]) p.FVBSO = TAB2[J];
      p.HFVBZSO = round((p.VBEZB + p.VBEZBSO) / ZAHL.HUNDRED - p.FVBSO, 2, ROUND.DOWN);
      p.FVBZSO = round(p.FVBZ + p.VBEZBSO / ZAHL.HUNDRED, 0, ROUND.UP);
      if (p.FVBZSO > p.HFVBZSO) p.FVBZSO = Math.ceil(p.HFVBZSO);
      if (p.FVBZSO > TAB3[J]) p.FVBZSO = TAB3[J];
      p.HFVBZ = round(p.VBEZB / ZAHL.HUNDRED - p.FVB, 2, ROUND.DOWN);
      if (p.FVBZ > p.HFVBZ) p.FVBZ = Math.ceil(p.HFVBZ);
    }
    MRE4ALTE();
  }

  function MRE4ABZ() {
    p.ZRE4 = round(p.ZRE4J - p.FVB - p.ALTE - p.JLFREIB + p.JLHINZU, 2, ROUND.DOWN);
    if (p.ZRE4 < 0) p.ZRE4 = 0;
    p.ZRE4VP = p.ZRE4J;
    p.ZVBEZ = round(p.ZVBEZJ - p.FVB, 2, ROUND.DOWN);
    if (p.ZVBEZ < 0) p.ZVBEZ = 0;
  }

  function MZTABFB() {
    p.ANP = 0;
    if (p.ZVBEZ >= 0 && p.ZVBEZ < p.FVBZ) {
      p.FVBZ = p.ZVBEZ;
    }
    if (p.STKL < 6 && p.ZVBEZ > 0) {
      if ((p.ZVBEZ - p.FVBZ) < 102) {
        p.ANP = Math.ceil(p.ZVBEZ - p.FVBZ);
      } else {
        p.ANP = 102;
      }
    } else if (p.STKL >= 6) {
      p.FVBZ = 0; p.FVBZSO = 0;
    }
    if (p.STKL < 6 && p.ZRE4 > p.ZVBEZ) {
      if ((p.ZRE4 - p.ZVBEZ) < 1230) {
        p.ANP = Math.ceil(p.ANP + p.ZRE4 - p.ZVBEZ);
      } else {
        p.ANP += 1230;
      }
    }
    p.KZTAB = 1;
    if (p.STKL === 1) {
      p.SAP = 36;
      p.KFB = round(p.ZKF * 9600, 0, ROUND.DOWN);
    } else if (p.STKL === 2) {
      p.EFA = 4260;
      p.SAP = 36;
      p.KFB = round(p.ZKF * 9600, 0, ROUND.DOWN);
    } else if (p.STKL === 3) {
      p.KZTAB = 2;
      p.SAP = 36;
      p.KFB = round(p.ZKF * 9600, 0, ROUND.DOWN);
    } else if (p.STKL === 4) {
      p.SAP = 36;
      p.KFB = round(p.ZKF * 4800, 0, ROUND.DOWN);
    } else if (p.STKL === 5) {
      p.SAP = 36;
      p.KFB = 0;
    } else {
      p.KFB = 0;
    }
    p.ZTABFB = round((p.EFA || 0) + p.ANP + (p.SAP || 0) + p.FVBZ, 2, ROUND.DOWN);
  }

  function MVSP() {
    if (p.ZRE4VP > p.BBGKVPV) p.ZRE4VP = p.BBGKVPV;
    if (p.PKV > 0) {
      if (p.STKL === 6) {
        p.VSP3 = 0;
      } else {
        p.VSP3 = round(p.PKPV * ZAHL.TWELVE / ZAHL.HUNDRED, 2, ROUND.DOWN);
        if (p.PKV === 2) {
          p.VSP3 = round(p.VSP3 - p.ZRE4VP * (p.KVSATZAG + p.PVSATZAG), 2, ROUND.DOWN);
        }
      }
    } else {
      p.VSP3 = round(p.ZRE4VP * (p.KVSATZAN + p.PVSATZAN), 2, ROUND.DOWN);
    }
    p.VSP = Math.ceil(p.VSP3 + p.VSP1);
  }

  function UPEVP() {
    if (p.KRV === 1) {
      p.VSP1 = 0;
    } else {
      if (p.ZRE4VP > p.BBGRV) p.ZRE4VP = p.BBGRV;
      p.VSP1 = round(p.ZRE4VP * p.RVSATZAN, 2, ROUND.DOWN);
    }
    p.VSP2 = round(p.ZRE4VP * 0.12, 2, ROUND.DOWN);
    p.VHB = p.STKL === 3 ? 3000 : 1900;
    if (p.VSP2 > p.VHB) p.VSP2 = p.VHB;
    p.VSPN = Math.ceil(p.VSP1 + p.VSP2);
    MVSP();
    if (p.VSPN > p.VSP) p.VSP = round(p.VSPN, 2, ROUND.DOWN);
  }

  function UPTAB25() {
    if (p.X < p.GFB + ZAHL.ONE) {
      p.ST = 0;
    } else if (p.X < 17444) {
      p.Y = round((p.X - p.GFB) / ZAHL.TEN_THOUSAND, 6, ROUND.DOWN);
      p.RW = p.Y * 932.30 + 1400;
      p.ST = Math.floor(p.RW * p.Y);
    } else if (p.X < 68481) {
      p.Y = round((p.X - 17443) / ZAHL.TEN_THOUSAND, 6, ROUND.DOWN);
      p.RW = p.Y * 176.64 + 2397;
      p.RW *= p.Y;
      p.ST = Math.floor(p.RW + 1015.13);
    } else if (p.X < 277826) {
      p.ST = Math.floor(p.X * 0.42 - 10911.92);
    } else {
      p.ST = Math.floor(p.X * 0.45 - 19246.67);
    }
    p.ST *= p.KZTAB;
  }

  function MST5_6() {
    p.ZZX = p.X;
    if (p.ZZX > p.W2STKL5) {
      p.ZX = p.W2STKL5; UPTAB25();
      if (p.ZZX > p.W3STKL5) {
        p.ST = Math.floor(p.ST + (p.W3STKL5 - p.W2STKL5) * 0.42);
        p.ST = Math.floor(p.ST + (p.ZZX - p.W3STKL5) * 0.45);
      } else {
        p.ST = Math.floor(p.ST + (p.ZZX - p.W2STKL5) * 0.42);
      }
    } else {
      p.ZX = p.ZZX; UPTAB25();
      if (p.ZZX > p.W1STKL5) {
        p.VERGL = p.ST;
        p.ZX = p.W1STKL5; UPTAB25();
        p.HOCH = Math.floor(p.ST + (p.ZZX - p.W1STKL5) * 0.42);
        if (p.HOCH < p.VERGL) p.ST = p.HOCH; else p.ST = p.VERGL;
      }
    }
  }

  function UPMLST() {
    if (p.ZVE < ZAHL.ONE) {
      p.ZVE = 0; p.X = 0;
    } else {
      p.X = Math.floor(p.ZVE / p.KZTAB);
    }
    if (p.STKL < 5) {
      UPTAB25();
    } else {
      MST5_6();
    }
  }

  function MLSTJAHR() {
    UPEVP();
    p.ZVE = p.ZRE4 - p.ZTABFB - p.VSP;
    UPMLST();
  }

  function UPANTEIL() {
    if (p.LZZ === 1) {
      p.ANTEIL1 = p.JW;
    } else if (p.LZZ === 2) {
      p.ANTEIL1 = Math.floor(p.JW / ZAHL.TWELVE);
    } else if (p.LZZ === 3) {
      p.ANTEIL1 = Math.floor((p.JW * ZAHL.SEVEN) / ZAHL.THREE_SIXTY);
    } else {
      p.ANTEIL1 = Math.floor(p.JW / ZAHL.THREE_SIXTY);
    }
  }

  function UPLSTLZZ() {
    p.JW = p.LSTJAHR * ZAHL.HUNDRED;
    UPANTEIL();
    p.LSTLZZ = p.ANTEIL1;
  }

  function UPVKVLZZ() {
    p.JW = p.VKV;
    UPANTEIL();
    p.VKVLZZ = p.ANTEIL1;
  }

  function MSOLZ() {
    p.SOLZFREI *= p.KZTAB;
    if (p.JBMG > p.SOLZFREI) {
      p.SOLZJ = round(p.JBMG * 5.5 / ZAHL.HUNDRED, 2, ROUND.DOWN);
      p.SOLZMIN = round((p.JBMG - p.SOLZFREI) * 11.9 / ZAHL.HUNDRED, 2, ROUND.DOWN);
      if (p.SOLZMIN < p.SOLZJ) p.SOLZJ = p.SOLZMIN;
      p.JW = Math.floor(p.SOLZJ * ZAHL.HUNDRED);
      UPANTEIL();
      p.SOLZLZZ = p.ANTEIL1;
    } else {
      p.SOLZLZZ = 0;
    }
    if (p.R > 0) {
      p.JW = Math.floor(p.JBMG * ZAHL.HUNDRED);
      UPANTEIL();
      p.BK = p.ANTEIL1;
    } else {
      p.BK = 0;
    }
  }

  function MBERECH() {
    MZTABFB();
    p.VFRB = Math.floor((p.ANP + p.FVB + p.FVBZ) * ZAHL.HUNDRED);
    MLSTJAHR();
    p.WVFRB = Math.floor((p.ZVE - p.GFB) * ZAHL.HUNDRED);
    if (p.WVFRB < 0) p.WVFRB = 0;
    p.LSTJAHR = Math.floor(p.ST * p.f);
    UPLSTLZZ();
    UPVKVLZZ();
    if (p.ZKF > 0) {
      p.ZTABFB += p.KFB;
      MRE4ABZ();
      MLSTJAHR();
      p.JBMG = Math.floor(p.ST * p.f);
    } else {
      p.JBMG = p.LSTJAHR;
    }
    MSOLZ();
  }

  // Ablauf
  MPARA();
  MRE4JL();
  p.VBEZBSO = 0;
  MRE4();
  MRE4ABZ();
  MBERECH();

  // Ausgabe in Euro
  return {
    LSTLZZ: p.LSTLZZ / ZAHL.HUNDRED,
    SOLZLZZ: p.SOLZLZZ / ZAHL.HUNDRED,
    BK: p.BK / ZAHL.HUNDRED,
  };
}

export function centsToEuro(cents) {
  return cents / ZAHL.HUNDRED;
}

export function euroToCents(euro) {
  return Math.round(euro * ZAHL.HUNDRED);
}

