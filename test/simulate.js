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

function bot(name, code, behaviour) {
  return new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'] });
    let me = null;
    const done = new Set();
    s.on('connect', () => {
      s.emit('player:join', { code, name, emoji: '🤖' }, (res) => {
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
        }
        setTimeout(() => s.emit('player:next'), 5);
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
      }
    });
    s.on('connect_error', reject);
  });
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

  const results = await Promise.all([bot('Anna', code, 'normal'), bot('Erik', code, 'allin'), bot('Sara', code, 'sleepy')]);
  const final = results[0];
  console.log('Faser:', [...seenPhases].join(', '));
  console.log('Segment:', [...seenTypes].join(', '));
  console.log('Slutställning:', final.standings.map((s) => `${s.name} ${s.points}`).join(' | '));

  assert.strictEqual(final.standings.length, N);
  for (const t of ['skiss', 'ordning', 'narmast', 'swipe', 'final']) assert(seenTypes.has(t), `segment ${t} spelades inte`);
  for (const ph of ['countdown', 'warmup', 'warmup-reveal', 'segment-intro', 'bet', 'play', 'reveal', 'podium']) {
    assert(seenPhases.has(ph), `fas ${ph} saknas`);
  }
  assert(final.standings.every((s) => s.points >= 0));
  assert(sawRescue, 'räddningspoängen användes aldrig');
  assert(lastTv && lastTv.qr && lastTv.qr.startsWith('data:image/png'), 'QR saknas på TV:n');

  // Poänglogik
  const S = require('../server/scoring');
  const r = S.rankAndPayout([
    { id: 'a', perf: 90, tiebreak: 1, bet: 100 },
    { id: 'b', perf: 50, tiebreak: 1, bet: 100 },
    { id: 'c', perf: 10, tiebreak: 1, bet: 100 },
  ]);
  assert.deepStrictEqual(r.map((x) => x.delta), [100, 0, -100]);
  const tie = S.rankAndPayout([
    { id: 'a', perf: 90, tiebreak: 1, bet: 300 },
    { id: 'b', perf: 90, tiebreak: 1, bet: 300 },
    { id: 'c', perf: 10, tiebreak: 1, bet: 300 },
  ]);
  assert.deepStrictEqual(tie.map((x) => x.payout), [450, 450, 0]);
  assert.strictEqual(S.skissScore(5, 0.05), 100);
  assert.strictEqual(S.skissScore(5, 1), 40);
  assert.strictEqual(S.skissScore(2500, 0), 0);
  assert.strictEqual(S.ordningScore(['a', 'b', 'c'], ['a', 'c', 'b']), 60);
  assert.strictEqual(S.narmastPoints(330, 335), 30);
  assert.strictEqual(S.narmastPoints(0, 400), 0);
  assert.deepStrictEqual(S.betLimits(1000, false), { min: 100, max: 1000 });
  assert.deepStrictEqual(S.betLimits(150, true), { min: 0, max: 150 });

  console.log('Allt ok ✔');
  tv.close();
  server.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
