// Testar testsidan: lösenordsskydd, testrum med en omgång per del och botar.
process.env.TIME_SCALE = process.env.TIME_SCALE || '0.05';
process.env.PORT = process.env.PORT || '3998';
process.env.TEST_PASSWORD = 'hemligt-test';

const assert = require('assert');
const http = require('http');
const { io } = require('socket.io-client');
const { server, rooms } = require('../server/index');

const URL = `http://localhost:${process.env.PORT}`;

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(URL + path, { headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

const basic = (pw) => 'Basic ' + Buffer.from('vem-som-helst:' + pw).toString('base64');

function hello(cookie, test) {
  return new Promise((resolve) => {
    const s = io(URL, { transports: ['websocket'], extraHeaders: cookie ? { cookie } : {} });
    s.on('connect', () => s.emit('host:hello', { origin: URL, test }, (r) => resolve({ s, code: r.code })));
  });
}

(async () => {
  // 1. Lösenordsskyddet
  const noAuth = await get('/test');
  assert.strictEqual(noAuth.status, 401, 'utan lösenord ska testsidan nekas');
  const wrong = await get('/test', { authorization: basic('fel') });
  assert.strictEqual(wrong.status, 401, 'fel lösenord ska nekas');
  const ok = await get('/test', { authorization: basic('hemligt-test') });
  assert.strictEqual(ok.status, 200);
  assert(ok.body.includes('Testläge'));
  const cookie = ok.headers['set-cookie'][0].split(';')[0];
  assert(cookie.startsWith('pp_test='));
  const direct = await get('/test.html');
  assert.notStrictEqual(direct.status, 200, 'testsidan får inte gå att nå som vanlig fil');

  const segments = ['warmup', 'skiss', 'ordning', 'narmast', 'pussel', 'swipe', 'king', 'final'];

  // 2. Utan inloggning blir det ett vanligt rum även om man ber om testläge
  const fake = await hello(null, { segments, bots: 3 });
  assert.strictEqual(rooms.get(fake.code).test, null, 'testläge kräver inloggning');
  assert.strictEqual(rooms.get(fake.code).players.size, 0, 'inga botar utan inloggning');
  fake.s.close();

  // 3. Testrum med två botar och en riktig spelare
  const tv = await hello(cookie, { segments, bots: 2 });
  const room = rooms.get(tv.code);
  assert(room.test, 'testrummet ska vara i testläge');
  assert.strictEqual([...room.players.values()].filter((p) => p.bot).length, 2);

  const types = new Set();
  const final = await new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'] });
    const done = new Set();
    s.on('connect', () =>
      s.emit('player:join', { code: tv.code, name: 'Tom', emoji: '🦊' }, (res) => {
        if (res.error) return reject(new Error(res.error));
        s.emit('player:ready', { ready: true });
      })
    );
    s.on('state', (st) => {
      if (st.phase === 'podium') return resolve(st);
      const key = `${st.phase}:${st.roundIndex}`;
      if (done.has(key)) return;
      done.add(key);
      if (st.round) types.add(st.round.type);
      if (st.warmup) types.add('warmup');
      if (st.phase === 'warmup') s.emit('player:answer', { choice: 1 });
      if (st.phase === 'reveal' || st.phase === 'warmup-reveal') s.emit('player:next');
      if (st.phase === 'bet' && st.betLimits) s.emit('player:bet', { amount: st.betLimits.max });
      if (st.phase === 'vote') s.emit('player:vote', { yes: [] });
      if (st.phase === 'play' && st.round) {
        const t = st.round.type;
        if (t === 'skiss') s.emit('player:answer', { lat: 48, lon: 2, lock: true });
        if (t === 'ordning') s.emit('player:answer', { order: st.round.items.map((i) => i.id), lock: true });
        if (t === 'narmast') s.emit('player:answer', { value: 500, lock: true });
        if (t === 'final') s.emit('player:answer', { choice: 0 });
        if (t === 'king') {
          assert(st.round.isKing, 'i testläget ska den riktiga spelaren vara kingen');
          s.emit('player:answer', { text: 'Näsa' });
        }
        // Pussel och Höger eller vänster hoppas över med Enter på TV:n.
        if (t === 'pussel' || t === 'swipe') setTimeout(() => tv.s.emit('host:next'), 50);
      }
    });
  });

  assert.strictEqual(room.plan.length, 7, 'en omgång per del (7 delar utöver uppvärmningen)');
  for (const t of ['warmup', 'skiss', 'ordning', 'narmast', 'pussel', 'swipe', 'king', 'final']) assert(types.has(t), `${t} spelades inte`);
  assert.strictEqual(final.standings.length, 3);

  // 4. Bara några delar valda, utan uppvärmning
  const tv2 = await hello(cookie, { segments: ['pussel', 'final'], bots: 0 });
  const r2 = rooms.get(tv2.code);
  const p2 = r2.addOrRejoin({ name: 'Solo', emoji: '🐸' }).player;
  r2.setReady(p2.id, true);
  assert.deepStrictEqual(r2.plan.map((x) => x.type), ['pussel', 'final'], 'bara valda delar');
  r2.hostNext(); // hoppa över nedräkningen
  assert.strictEqual(r2.phase, 'segment-intro', 'uppvärmningen ska hoppas över');
  clearTimeout(r2.timer);

  console.log('Testläget ok ✔');
  tv.s.close();
  tv2.s.close();
  server.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
