// Ren poänglogik utan sidoeffekter, så att den går att testa för sig.

const toRad = (d) => (d * Math.PI) / 180;

// Avstånd i km längs jordytan.
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Skissen: 100 poäng inom 25 km, sjunker linjärt till 0 vid 2 000 km.
function skissDistanceFactor(km) {
  if (km <= 25) return 1;
  if (km >= 2000) return 0;
  return 1 - (km - 25) / 1975;
}

// Låser man när högst 10 % av teckningen syns får man full faktor, sedan ner till 0,4 när den är klar.
function skissTimeFactor(progress) {
  const p = clamp(progress, 0, 1);
  if (p <= 0.1) return 1;
  return 1 - ((p - 0.1) / 0.9) * 0.6;
}

function skissScore(km, progress) {
  return Math.round(100 * skissDistanceFactor(km) * skissTimeFactor(progress));
}

// Ordningen: 30 poäng för exakt rätt plats, 15 för en plats fel.
function ordningScore(order, correctOrder) {
  let score = 0;
  correctOrder.forEach((id, i) => {
    const j = order.indexOf(id);
    if (j === -1) return;
    const diff = Math.abs(i - j);
    if (diff === 0) score += 30;
    else if (diff === 1) score += 15;
  });
  return score;
}

// Närmast vinner: 30 poäng inom 10 från rätt svar, sjunker till 0 vid 300 fel.
function narmastPoints(guess, answer) {
  const d = Math.abs(guess - answer);
  if (d <= 10) return 30;
  if (d >= 300) return 0;
  return Math.round(30 * (1 - (d - 10) / 290));
}

// Höger eller vänster: 6 poäng per rätt, plus 1 per sekund kvar om man hann med alla ord.
function swipeScore(correct, finishedAll, secondsLeft) {
  const bonus = finishedAll ? clamp(Math.floor(secondsLeft), 0, 30) : 0;
  return correct * 6 + bonus;
}

// Multiplikatorer från 2 (först) ner till 0 (sist), jämnt fördelade.
function multipliers(n) {
  if (n <= 1) return [1];
  return Array.from({ length: n }, (_, i) => (2 * (n - 1 - i)) / (n - 1));
}

// entries: [{ id, perf, tiebreak, bet }]. Högre perf är bättre, lägre tiebreak är bättre.
// Exakt lika (samma perf och tiebreak) delar på multiplikatorerna för sina platser.
function rankAndPayout(entries) {
  const sorted = [...entries].sort((a, b) => {
    if (b.perf !== a.perf) return b.perf - a.perf;
    return a.tiebreak - b.tiebreak;
  });
  const mults = multipliers(sorted.length);
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (
      j + 1 < sorted.length &&
      sorted[j + 1].perf === sorted[i].perf &&
      sorted[j + 1].tiebreak === sorted[i].tiebreak
    ) {
      j++;
    }
    const share = mults.slice(i, j + 1).reduce((s, m) => s + m, 0) / (j - i + 1);
    for (let k = i; k <= j; k++) {
      const e = sorted[k];
      const payout = Math.round(e.bet * share);
      out.push({ ...e, place: i + 1, multiplier: share, payout, delta: payout - e.bet });
    }
    i = j + 1;
  }
  return out;
}

// Minsta satsning är 10 % av ens poäng (avrundat uppåt), högst allt man har.
function betLimits(points, isFinal) {
  if (isFinal) return { min: 0, max: Math.max(0, Math.min(200, points)) };
  if (points <= 0) return { min: 0, max: 0 };
  return { min: Math.ceil(points * 0.1), max: points };
}

module.exports = {
  haversineKm,
  skissDistanceFactor,
  skissTimeFactor,
  skissScore,
  ordningScore,
  narmastPoints,
  swipeScore,
  multipliers,
  rankAndPayout,
  betLimits,
  clamp,
};
