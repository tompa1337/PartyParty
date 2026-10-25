// Botar för testläget. De är vanliga spelare i rummet (bot: true) som svarar själva
// med lite slump och fördröjning, så att man kan prova spelet ensam.

const NAMES = ['Robot Rut', 'Bot Bengt', 'Kalkyl-Kim', 'Chip Charlie', 'Data Doris'];
const EMOJIS = ['🤖', '👾', '🛸', '🦾', '🎲'];
const KING_WORDS = ['Näsa', 'Glasögon', 'Äpple', 'Hund', 'Blå', 'Mjölk', 'Lärare', 'Tandborste', 'Bil', 'Sol', 'Fotboll', 'Katt'];

const rand = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

function addBots(room, count) {
  const n = Math.max(0, Math.min(NAMES.length, count | 0));
  for (let i = 0; i < n; i++) {
    const res = room.addOrRejoin({ name: NAMES[i], emoji: EMOJIS[i] });
    if (res.player) {
      res.player.bot = true;
      res.player.ready = true;
    }
  }
}

// Kallas efter varje ändring i rummet. Varje bot agerar en gång per fas och omgång.
function tick(room) {
  for (const p of room.players.values()) {
    if (!p.bot) continue;
    const key = `${room.phase}:${room.roundIndex}`;
    if (p.botKey === key) continue;
    p.botKey = key;
    act(room, p, key);
  }
}

// Kör en handling senare, men bara om rummet fortfarande är i samma fas.
// Handlingen sparas också, så att den kan köras direkt om man hoppar framåt i testläget.
function later(room, p, key, ms, fn) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    if (`${room.phase}:${room.roundIndex}` === key && room.players.has(p.id)) fn();
  };
  p.botPending = run;
  setTimeout(run, ms);
}

// Kallas precis innan testläget hoppar förbi en del: botar som inte hunnit svara gör det nu.
function answerNow(room) {
  for (const p of room.players.values()) {
    if (p.bot && p.botPending) {
      const run = p.botPending;
      p.botPending = null;
      run();
    }
  }
}

function act(room, p, key) {
  const r = room.round;
  switch (room.phase) {
    case 'lobby':
      p.ready = true;
      return;
    case 'warmup':
      return later(room, p, key, rand(1500, 4000), () => room.answer(p.id, { choice: chance(0.8) ? r.q.correct : Math.floor(Math.random() * 4) }));
    case 'warmup-reveal':
    case 'reveal':
      return later(room, p, key, rand(2500, 5000), () => room.pressNext(p.id));
    case 'bet':
      return later(room, p, key, rand(1500, 4000), () => room.placeBet(p.id, Math.round(p.points * rand(0.1, 0.5))));
    case 'vote':
      return later(room, p, key, rand(2000, 5000), () =>
        room.vote(p.id, { yes: (r.candidates || []).filter(() => chance(0.4)).map((c) => c.id) })
      );
    case 'play':
      return play(room, p, key, r);
    default:
      return;
  }
}

function play(room, p, key, r) {
  const spec = r.spec;
  switch (r.type) {
    case 'skiss': {
      // Låser någonstans mellan 30 och 85 % av teckningen, en bit ifrån rätt plats.
      const at = (r.drawMs || 30000) * rand(0.3, 0.85);
      const off = rand(1, 25);
      const ang = rand(0, Math.PI * 2);
      const lat = spec.landmark.lat + Math.sin(ang) * off * 0.6;
      const lon = spec.landmark.lon + Math.cos(ang) * off;
      return later(room, p, key, at, () => room.answer(p.id, { lat, lon, lock: true }));
    }
    case 'ordning': {
      const order = spec.items.map((i) => i.id);
      const swaps = Math.floor(rand(0, 3));
      for (let k = 0; k < swaps; k++) {
        const i = Math.floor(rand(0, order.length - 1));
        [order[i], order[i + 1]] = [order[i + 1], order[i]];
      }
      return later(room, p, key, rand(5000, 15000), () => room.answer(p.id, { order, lock: true }));
    }
    case 'narmast': {
      const value = Math.round(Math.max(0, Math.min(1000, spec.q.answer + rand(-250, 250))));
      return later(room, p, key, rand(3000, 10000), () => room.answer(p.id, { value, lock: true }));
    }
    case 'pussel': {
      // Botar löser inte pusslet, de flyttar runt lite så att staplarna rör sig.
      const step = () => {
        if (`${room.phase}:${room.roundIndex}` !== key) return;
        const st = r.boards && r.boards.get(p.id);
        if (!st || st.solvedAt) return;
        const blank = st.board.indexOf(8);
        const opts = [blank - 3, blank + 3, blank % 3 ? blank - 1 : -1, blank % 3 < 2 ? blank + 1 : -1].filter((x) => x >= 0 && x < 9);
        room.puzzleMove(p.id, { tile: st.board[pickOne(opts)] });
        setTimeout(step, rand(700, 1600));
      };
      return later(room, p, key, rand(1000, 3000), step);
    }
    case 'swipe': {
      const start = Math.max(0, (r.swipeStart || Date.now()) - Date.now());
      const next = () => {
        if (`${room.phase}:${room.roundIndex}` !== key) return;
        const st = r.answers.get(p.id);
        if (!st || st.finishedAt) return;
        const word = spec.words[r.orders.get(p.id)[st.i]];
        const dir = chance(0.8) ? word.side : word.side === 'L' ? 'R' : 'L';
        const res = room.swipe(p.id, { i: st.i, dir });
        setTimeout(next, rand(900, 1500) + (res && res.correct === false ? 1000 : 0));
      };
      return later(room, p, key, start + rand(300, 900), next);
    }
    case 'king': {
      const text = pickOne(KING_WORDS);
      return later(room, p, key, rand(3000, 9000), () => room.answer(p.id, { text }));
    }
    case 'final': {
      const choice = chance(0.6) ? spec.q.correct : Math.floor(Math.random() * spec.q.options.length);
      return later(room, p, key, rand(2000, 7000), () => room.answer(p.id, { choice }));
    }
    default:
      return;
  }
}

module.exports = { addBots, tick, answerNow };
