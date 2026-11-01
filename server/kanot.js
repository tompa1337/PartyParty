// Kanotracet: varje lag har en kanot i en egen fåra. En paddlar på vänster sida och en på höger.
// Ett paddeltag ger fart framåt och vrider kanoten bort från den sidan, så man måste paddla i takt.
//
// x = sträcka framåt (0 till LENGTH), y = sidled (−HALF till HALF, positivt är nedåt på TV:n),
// th = kurs i radianer (0 är rakt mot mål, positivt svänger nedåt).

const LENGTH = 100;
const HALF = 3;
const IMPULSE = 0.5; // fart per paddeltag
const TURN = 0.35; // vridning per paddeltag
const DRAG = 0.8; // vattnets broms per sekund
const TURN_DAMP = 3; // hur fort vridningen avtar
const MIN_GAP = 150; // ms mellan två paddeltag för samma spelare
const MAX_TH = 1.3;

const newBoat = () => ({ x: 0, y: 0, th: 0, v: 0, w: 0, nL: 0, nR: 0, bump: 0, finishedAt: null });

// Paddlar man på vänster sida svänger kanoten åt höger (nedåt på TV:n), och tvärtom.
function stroke(boat, side) {
  boat.v += IMPULSE;
  boat.w += side === 'L' ? TURN : -TURN;
  if (side === 'L') boat.nL++;
  else boat.nR++;
}

function step(boat, dtMs) {
  const s = Math.min(dtMs, 250) / 1000;
  boat.th = Math.max(-MAX_TH, Math.min(MAX_TH, boat.th + boat.w * s));
  boat.w -= boat.w * Math.min(1, TURN_DAMP * s);
  boat.v -= boat.v * Math.min(1, DRAG * s);
  boat.x += boat.v * Math.cos(boat.th) * s;
  boat.y += boat.v * Math.sin(boat.th) * s;
  // Strandkanten bromsar och vänder kanoten tillbaka ut i fåran.
  if (Math.abs(boat.y) > HALF) {
    boat.y = Math.sign(boat.y) * HALF;
    boat.v *= 0.6;
    if (Math.sign(boat.th) === Math.sign(boat.y)) boat.th = -boat.th * 0.3;
    boat.w = 0;
    boat.bump++;
  }
  boat.x = Math.max(0, boat.x);
}

module.exports = { LENGTH, HALF, MIN_GAP, newBoat, stroke, step };
