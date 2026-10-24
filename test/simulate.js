// Spelar ett helt parti med botar mot en riktig server, snabbspolat.
// Kör: npm test
process.env.TIME_SCALE = process.env.TIME_SCALE || '0.04';
process.env.PORT = process.env.PORT || '3999';

const assert = require('assert');
const { io } = require('socket.io-client');
const { server } = require('../server/index');

const URL = `http://localhost:${process.env.PORT}`;
const N = 3;
const seenPhases = new Set();
const seenTypes = new Set();
let sawRescue = false;
let puzzleSolvedRows = 0;
const kingRounds = new Set();
let sawVote = false;
const ordningRounds = new Set();
let betOutsideFinal = false;

function bot(name, code, behaviour, emoji) {
  return new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'] });
    let me = null;
    const done = new Set();
    s.on('connect', () => {
      s.emit('player:join', { code, name, emoji }, (res) => {
        if (res.error) return reject(new Error(res.error));
        me = res.playerId;
        s.emit('player:ready', { ready: true });
      });
    });
    s.on('state', (st) => {
      seenPhases.add(st.phase);
      const key = `${st.phase}:${st.roundIndex}`;
      if (st.phase === 'podium') {
        s.close();
        return resolve(st);
      }
      if (done.has(key)) {
        // Swipe skickas ord för ord.
        if (st.phase === 'play' && st.round && st.round.type === 'swipe') swipeStep(s, st, behaviour);
        return;
      }
      if (st.phase === 'warmup' && st.warmup) {
        done.add(key);
        s.emit('player:answer', { choice: 0 });
      } else if (st.phase === 'warmup-reveal' || st.phase === 'reveal') {
        done.add(key);
        if (st.phase === 'reveal') {
          assert(st.myResult, 'myResult saknas i reveal');
          assert.strictEqual(st.myResult.after, st.me.points, 'poäng efter reveal stämmer inte');
          if (st.round && st.round.type === 'pussel' && st.myResult.detail && st.myResult.detail.solved) puzzleSolvedRows++;
        }
        setTimeout(() => s.emit('player:next'), 5);
      } else if (st.phase === 'bet' && st.round && st.round.type !== 'final') {
        betOutsideFinal = true;
      } else if (st.phase === 'bet' && st.betLimits) {
        if (st.rescued) {
          sawRescue = true;
          assert.strictEqual(st.me.points, 50, 'räddning ska ge 50 poäng');
        }
        done.add(key);
        const { min, max } = st.betLimits;
        const amt = behaviour === 'allin' ? max : min + Math.floor(Math.random() * (max - min + 1));
        s.emit('player:bet', { amount: amt });
      } else if (st.phase === 'play' && st.round) {
        const t = st.round.type;
        seenTypes.add(t);
        if (t === 'ordning') ordningRounds.add(st.roundIndex);
        if (t === 'swipe') {
          if (st.round.startInMs > 0) return; // vänta på nedräkningen
          done.add(key);
          return swipeStep(s, st, behaviour);
        }
        done.add(key);
        if (behaviour === 'sleepy' && Math.random() < 0.3) return; // svarar inte alls ibland
        if (t === 'skiss') s.emit('player:answer', { lat: 40 + Math.random() * 20, lon: Math.random() * 40, lock: true });
        if (t === 'ordning') s.emit('player:answer', { order: st.round.items.map((i) => i.id).reverse(), lock: true });
        if (t === 'narmast') s.emit('player:answer', { value: Math.floor(Math.random() * 1001), lock: true });
        if (t === 'final') s.emit('player:answer', { choice: Math.floor(Math.random() * 4) });
        if (t === 'pussel') {
          const board = st.round.mine.board;
          const path = behaviour === 'sleepy' ? randomMoves(board, 6) : solvePuzzle(board);
          (async () => {
            for (const tile of path) await new Promise((res) => s.emit('player:puzzle', { tile }, res));
          })();
        }
        if (t === 'king') {
          kingRounds.add(st.roundIndex);
          // Kingen skriver "Näsa", övriga blandar exakt samma, en böjning och något annat.
          const pickText = st.round.isKing ? 'Näsa' : ['näsan', 'Öga', 'mun', 'Ögonen'][Math.floor(Math.random() * 4)];
          s.emit('player:answer', { text: pickText });
        }
      } else if (st.phase === 'vote' && st.round && st.round.candidates) {
        done.add(key);
        sawVote = true;
        assert(!st.round.candidates.some((c) => /^n[aä]san?$/i.test(c.text)), 'exakta matchningar ska inte röstas om');
        s.emit('player:vote', { yes: st.round.candidates.filter(() => Math.random() < 0.5).map((c) => c.id) });
      }
    });
    s.on('connect_error', reject);
  });
}

// Pusslet: kortaste lösningen med bredden-först-sökning (högst 181 440 lägen).
const NB = (pos) => [pos - 3, pos + 3, pos % 3 ? pos - 1 : -1, pos % 3 < 2 ? pos + 1 : -1].filter((x) => x >= 0 && x < 9);
function solvePuzzle(start) {
  const goal = '012345678';
  const key = start.join('');
  const prev = new Map([[key, null]]);
  const queue = [key];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur === goal) break;
    const b = cur.indexOf('8');
    for (const n of NB(b)) {
      const arr = cur.split('');
      [arr[b], arr[n]] = [arr[n], arr[b]];
      const k = arr.join('');
      if (!prev.has(k)) {
        prev.set(k, { from: cur, tile: Number(cur[n]) });
        queue.push(k);
      }
    }
  }
  const tiles = [];
  for (let k = goal; prev.get(k); k = prev.get(k).from) tiles.unshift(prev.get(k).tile);
  return tiles;
}
function randomMoves(start, n) {
  const b = [...start];
  const out = [];
  for (let i = 0; i < n; i++) {
    const blank = b.indexOf(8);
    const opts = NB(blank);
    const pos = opts[Math.floor(Math.random() * opts.length)];
    out.push(b[pos]);
    [b[blank], b[pos]] = [b[pos], b[blank]];
  }
  return out;
}

const swiping = new WeakMap();
function swipeStep(s, st, behaviour) {
  const pr = st.round.progress;
  if (!pr || pr.finished) return;
  if (swiping.get(s) === pr.i) return;
  swiping.set(s, pr.i);
  if (behaviour === 'sleepy' && pr.i >= 12) return; // hinner inte klart
  const dir = Math.random() < 0.7 ? 'R' : 'L';
  s.emit('player:swipe', { i: pr.i, dir });
}

(async () => {
  const tv = io(URL, { transports: ['websocket'] });
  const code = await new Promise((res) => tv.on('connect', () => tv.emit('host:hello', { origin: URL }, (r) => res(r.code))));
  let lastTv = null;
  tv.on('state', (st) => (lastTv = st));
  console.log('Rum', code);

  const results = await Promise.all([bot('Anna', code, 'normal', '🦊'), bot('Erik', code, 'allin', '🐼'), bot('Sara', code, 'sleepy', '🐸')]);
  const final = results[0];
  console.log('Faser:', [...seenPhases].join(', '));
  console.log('Segment:', [...seenTypes].join(', '));
  console.log('Slutställning:', final.standings.map((s) => `${s.name} ${s.points}`).join(' | '));

  assert.strictEqual(final.standings.length, N);
  for (const t of ['skiss', 'ordning', 'narmast', 'pussel', 'swipe', 'king', 'final']) assert(seenTypes.has(t), `segment ${t} spelades inte`);
  for (const ph of ['countdown', 'warmup', 'warmup-reveal', 'segment-intro', 'round-ready', 'bet', 'play', 'reveal', 'podium']) {
    assert(seenPhases.has(ph), `fas ${ph} saknas`);
  }
  assert(final.standings.every((s) => s.points >= 0));
  assert.strictEqual(ordningRounds.size, 3, 'Ordningen ska ha tre omgångar');
  assert.strictEqual(kingRounds.size, N, 'Kingen ska ha en omgång per spelare');
  assert(!betOutsideFinal, 'satsning ska bara finnas i finalen');
  assert(lastTv && lastTv.qr && lastTv.qr.startsWith('data:image/png'), 'QR saknas på TV:n');

  // Poänglogik
  const S = require('../server/scoring');
  // Placeringspoäng: 6 spelare ger 600 ner till 100, delad plats delar på poängen.
  const pp = S.placementPoints([1, 2, 3, 4, 5, 6].map((i) => ({ id: i, perf: i, tiebreak: 0 })));
  assert.deepStrictEqual(pp.map((x) => x.delta), [600, 500, 400, 300, 200, 100]);
  const ppTie = S.placementPoints([
    { id: 'a', perf: 9, tiebreak: 1 },
    { id: 'b', perf: 9, tiebreak: 1 },
    { id: 'c', perf: 1, tiebreak: 1 },
  ]);
  assert.deepStrictEqual(ppTie.map((x) => x.delta), [250, 250, 100]);
  // Finalen: ×2 till ×0 bland rätt svar efter snabbhet, fel svar ×0.
  const fp = S.finalPayout([
    { id: 'a', perf: 1, tiebreak: 1, bet: 100, right: true },
    { id: 'b', perf: 1, tiebreak: 2, bet: 100, right: true },
    { id: 'c', perf: 1, tiebreak: 3, bet: 100, right: true },
    { id: 'd', perf: 0, tiebreak: 1, bet: 100, right: false },
  ]);
  assert.deepStrictEqual(fp.map((x) => x.delta), [100, 33, -33, -100]);
  const lone = S.finalPayout([
    { id: 'a', perf: 0, tiebreak: 1, bet: 100, right: false },
    { id: 'b', perf: 0, tiebreak: 2, bet: 100, right: false },
  ]);
  assert.deepStrictEqual(lone.map((x) => x.delta), [-100, -100]);
  // Träffsäkerhet går alltid före snabbhet.
  const acc = S.placementPoints([
    { id: 'slowRight', perf: 15, tiebreak: 9000 },
    { id: 'fastWrong', perf: 12, tiebreak: 100 },
  ]);
  assert.strictEqual(acc[0].id, 'slowRight', 'fler rätt ska slå snabbare');
  assert.strictEqual(S.skissScore(5, 0.05), 100);
  assert.strictEqual(S.skissScore(5, 1), 40);
  assert.strictEqual(S.skissScore(2500, 0), 0);
  assert.strictEqual(S.ordningScore(['a', 'b', 'c'], ['a', 'c', 'b']), 60);
  assert.strictEqual(S.narmastPoints(330, 335), 30);
  assert.strictEqual(S.narmastPoints(0, 400), 0);
  assert.deepStrictEqual(S.betLimits(1000), { min: 0, max: 1000 });

  // Räddning: den som står på noll får 50 poäng när det är dags att satsa.
  const { Room } = require('../server/game');
  const room = new Room('TEST', () => {});
  const a = room.addOrRejoin({ name: 'A', emoji: '🦊' }).player;
  room.addOrRejoin({ name: 'B', emoji: '🐼' });
  // Samma figur får inte väljas två gånger.
  const dup = room.addOrRejoin({ name: 'C', emoji: a.emoji });
  assert(dup.error && dup.emojiTaken, 'dubbel figur ska nekas');
  room.plan = [{ type: 'final', q: { category: 'Test', q: '?', options: ['a', 'b'], correct: 0 } }];
  room.roundIndex = 0;
  room.round = { type: 'final', spec: room.plan[0], bets: new Map(), answers: new Map(), next: new Set() };
  a.points = 0;
  room.startBet();
  assert.strictEqual(a.points, 50, 'räddning ska ge 50 poäng');
  assert(room.playerView(a).rescued, 'mobilen ska få veta om räddningen');
  clearTimeout(room.timer);

  // Pusslet: blandningen ska alltid gå att lösa och en löst bricka-följd ska ge löst bräde.
  {
    const { scramble, correctTiles } = require('../server/game');
    for (let i = 0; i < 20; i++) {
      const b = scramble();
      const path = solvePuzzle(b);
      const bb = [...b];
      for (const t of path) {
        const p = bb.indexOf(t);
        const bl = bb.indexOf(8);
        [bb[p], bb[bl]] = [bb[bl], bb[p]];
      }
      assert.strictEqual(correctTiles(bb), 8, 'blandningen ska gå att lösa');
    }
  }
  assert(puzzleSolvedRows > 0, 'någon bot skulle ha löst pusslet');

  // Kingen: kingen +100 per träff, träffar −100, övriga +100.
  {
    const kr = new Room('KING', () => {});
    const k = kr.addOrRejoin({ name: 'K', emoji: '👑' }).player;
    const x = kr.addOrRejoin({ name: 'X', emoji: '🐸' }).player;
    const y = kr.addOrRejoin({ name: 'Y', emoji: '🐼' }).player;
    const z = kr.addOrRejoin({ name: 'Z', emoji: '🦊' }).player;
    kr.plan = [{ type: 'king', kingId: k.id, prompt: 'Något i ansiktet' }];
    kr.roundIndex = 0;
    kr.round = { type: 'king', spec: kr.plan[0], bets: new Map(), answers: new Map(), next: new Set(), votes: new Map() };
    kr.phase = 'play';
    kr.round.answers.set(k.id, { text: 'Glasögon', locked: true });
    kr.round.answers.set(x.id, { text: 'glasögonen', locked: true }); // automatiskt samma
    kr.round.answers.set(y.id, { text: 'brillor', locked: true }); // röstas till samma
    kr.round.answers.set(z.id, { text: 'näsa', locked: true }); // röstas till annat
    kr.endPlay();
    assert.strictEqual(kr.phase, 'vote');
    assert.deepStrictEqual(kr.round.candidates.map((c) => c.id).sort(), [y.id, z.id].sort());
    for (const p of [k, x, y]) kr.vote(p.id, { yes: [y.id] });
    kr.vote(z.id, { yes: [] });
    const d = Object.fromEntries(kr.round.results.map((r) => [r.id, r.delta]));
    assert.deepStrictEqual([d[k.id], d[x.id], d[y.id], d[z.id]], [200, -100, -100, 100]);
    clearTimeout(kr.timer);
  }

  console.log('Allt ok ✔');
  tv.close();
  server.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
