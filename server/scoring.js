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

// Sorterar spelarna. Högre perf är bättre, lägre tiebreak (tid) är bättre.
// Exakt lika (samma perf och tiebreak) räknas som delad placering.
function rankGroups(entries) {
  const sorted = [...entries].sort((a, b) => {
    if (b.perf !== a.perf) return b.perf - a.perf;
    return a.tiebreak - b.tiebreak;
  });
  const groups = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].perf === sorted[i].perf && sorted[j + 1].tiebreak === sorted[i].tiebreak) j++;
    groups.push({ from: i, to: j, items: sorted.slice(i, j + 1) });
    i = j + 1;
  }
  return groups;
}

// Vanliga omgångar: sist får 100, varje plats uppåt ger 100 till.
// Med 6 spelare blir det 600, 500, 400, 300, 200, 100. Delad placering delar på poängen.
const PLACE_STEP = 100;
function placementPoints(entries) {
  const n = entries.length;
  const pointsFor = (i) => (n - i) * PLACE_STEP;
  const out = [];
  for (const g of rankGroups(entries)) {
    let sum = 0;
    for (let k = g.from; k <= g.to; k++) sum += pointsFor(k);
    const pts = Math.round(sum / g.items.length);
    for (const e of g.items) out.push({ ...e, place: g.from + 1, delta: pts });
  }
  return out;
}

// Finalen: multiplikatorer från 2 (först) ner till 0 (sist), jämnt fördelade.
function multipliers(n, top = 2, bottom = 0) {
  if (n <= 1) return [top];
  return Array.from({ length: n }, (_, i) => bottom + ((top - bottom) * (n - 1 - i)) / (n - 1));
}

// entries: [{ id, perf, tiebreak, bet, right }]. Fel svar ger alltid ×0.
function finalPayout(entries) {
  const mults = multipliers(entries.length);
  const out = [];
  for (const g of rankGroups(entries)) {
    const share = mults.slice(g.from, g.to + 1).reduce((s, m) => s + m, 0) / g.items.length;
    for (const e of g.items) {
      const m = e.right ? share : 0;
      const payout = Math.round(e.bet * m);
      out.push({ ...e, place: g.from + 1, multiplier: m, payout, delta: payout - e.bet });
    }
  }
  return out;
}

// I finalen satsar man 0 till allt man har.
function betLimits(points) {
  return { min: 0, max: Math.max(0, points) };
}

// Kingen: två svar räknas som samma automatiskt bara om de är lika efter att stora/små
// bokstäver, prickar (å ä ö), skiljetecken och vanliga svenska ändelser tagits bort.
// Allt annat avgörs av en omröstning.
const SUFFIXES = ['arna', 'orna', 'erna', 'na', 'en', 'et', 'ar', 'er', 'or', 'n', 't', 'a', 'e'];
function normAnswer(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function stemWord(w) {
  for (let round = 0; round < 2; round++) {
    const suf = SUFFIXES.find((x) => w.endsWith(x) && w.length - x.length >= 3);
    if (!suf) break;
    w = w.slice(0, -suf.length);
  }
  return w;
}
function stemAnswer(text) {
  return normAnswer(text).split(' ').filter(Boolean).map(stemWord).join(' ');
}
function answersMatch(a, b) {
  const sa = stemAnswer(a);
  return sa.length > 0 && sa === stemAnswer(b);
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
  rankGroups,
  placementPoints,
  finalPayout,
  betLimits,
  normAnswer,
  stemAnswer,
  answersMatch,
  clamp,
};
