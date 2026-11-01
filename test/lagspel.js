// Testar Kanotracet och Bombdesarmeringen.
process.env.TIME_SCALE = process.env.TIME_SCALE || '0.05';
const assert = require('assert');
const K = require('../server/kanot');
const B = require('../server/bomb');
const { Room, buildPlan } = require('../server/game');

const ids = (n) => Array.from({ length: n }, (_, i) => 'p' + i);

// 1. Lagspelen kommer bara med vid jämnt antal, och lagen lottas om för varje lagspel.
{
  const types = (n) => buildPlan(ids(n)).map((x) => x.type);
  for (const t of ['kanot', 'bomb', 'labyrint']) {
    assert(types(4).includes(t), `${t} ska finnas med 4 spelare`);
    assert(!types(5).includes(t), `${t} ska inte finnas med 5 spelare`);
  }
}

// 2. Bomberna: varje bomb har exakt ett giltigt svar, och manualen täcker alla trådantal.
for (let i = 0; i < 2000; i++) {
  const b = B.generate(i % 12);
  const sol = B.solution(b);
  assert(Number.isInteger(sol) && sol >= 0 && sol < b.wires.length, `ogiltig lösning för ${JSON.stringify(b)}`);
  assert.strictEqual(String(b.lastDigit), b.serial.slice(-1));
}
assert.deepStrictEqual(B.MANUAL.map((m) => m.wires), [3, 4, 5, 6]);
// Ett par fall för hand
assert.strictEqual(B.solution({ wires: ['blå', 'gul', 'vit'], lastDigit: 1 }), 1, '3 trådar utan röd: andra');
assert.strictEqual(B.solution({ wires: ['röd', 'gul', 'blå'], lastDigit: 1 }), 0, '3 trådar, sista blå: första');
assert.strictEqual(B.solution({ wires: ['blå', 'röd', 'gul'], lastDigit: 1 }), 1, '3 trådar: första röda');
assert.strictEqual(B.solution({ wires: ['gul', 'röd', 'gul', 'blå'], lastDigit: 3 }), 2, '4 trådar, två gula: sista gula');

// 3. Kanoten: i takt går den rakt, bara på ena sidan svänger den.
{
  const b = K.newBoat();
  for (let t = 0; t < 4000; t += 50) {
    if (t % 600 === 0) K.stroke(b, 'L');
    if (t % 600 === 300) K.stroke(b, 'R');
    K.step(b, 50);
  }
  assert(b.x > 4 && Math.abs(b.y) < 1, 'paddlar man i takt ska kanoten gå framåt och nästan rakt');
  const c = K.newBoat();
  for (let t = 0; t < 4000; t += 50) {
    if (t % 300 === 0) K.stroke(c, 'L');
    K.step(c, 50);
  }
  assert(c.y > 1, 'bara vänster ska svänga kanoten åt höger');
  assert(c.x < b.x, 'och den ska komma kortare');
}

function teamRoom(type) {
  const room = new Room('LAG', () => {});
  const ps = ['A', 'B', 'C', 'D'].map((n, i) => room.addOrRejoin({ name: n, emoji: ['🦊', '🐼', '🐸', '🦄'][i] }).player);
  room.plan = buildPlan(ps.map((p) => p.id), { segments: [type] });
  room.roundIndex = -1;
  room.nextRound();
  room.startRound();
  clearInterval(room.loop);
  return { room, ps, r: room.round };
}

// 4. Kanotracet i ett rum
{
  const { room, r } = teamRoom('kanot');
  const [t0, t1] = r.spec.teams;
  // Rätt sida och spärr mot spam
  assert.strictEqual(room.paddle(t0.x, { side: 'R' }).ok, true);
  assert.strictEqual(r.boats[0].nL, 1, 'vänsterpaddlaren paddlar alltid vänster');
  assert.strictEqual(room.paddle(t0.x, { side: 'L' }).ok, false, 'för snabbt efter förra taget');
  // Lag 0 paddlar i takt tills de är i mål
  let now = Date.now();
  for (let k = 0; k < 4000 && !r.boats[0].finishedAt; k++) {
    now += 50;
    if (k % 4 === 0) {
      const th = r.boats[0].th;
      const who = th > 0.05 ? t0.y : th < -0.05 ? t0.x : k % 8 === 0 ? t0.x : t0.y;
      r.lastStroke.clear();
      room.paddle(who, {});
    }
    room.kanotStep(50, now);
  }
  assert(r.boats[0].finishedAt, 'lag 0 ska ha paddlat i mål');
  room.endPlay();
  const d = Object.fromEntries(r.results.map((x) => [x.id, x.delta]));
  assert.deepStrictEqual([d[t0.x], d[t0.y], d[t1.x], d[t1.y]], [350, 350, 150, 150]);
  clearTimeout(room.timer);
}

// 5. Bombdesarmeringen i ett rum
{
  const { room, ps, r } = teamRoom('bomb');
  const [t0, t1] = r.spec.teams;
  const pl = (id) => ps.find((p) => p.id === id);
  assert.strictEqual(room.bombRole(t0.x), 'defuser');
  assert.strictEqual(room.bombRole(t0.y), 'expert');
  const ev = room.playerView(pl(t0.y)).round;
  assert(ev.manual && !ev.bomb, 'den som läser ser manualen men inte bomben');
  const dv = room.playerView(pl(t0.x)).round;
  assert(dv.bomb && !dv.manual, 'den som klipper ser bomben men inte manualen');
  assert(!room.tvView().round.bomb, 'TV:n visar inte bomben');
  // Den som läser kan inte klippa
  assert.strictEqual(room.cut(t0.y, { bomb: 0, wire: 0 }), null);
  // Rätt tråd
  const st = r.bombState[0];
  const right = B.solution(room.bombAt(st, 0));
  assert.strictEqual(room.cut(t0.x, { bomb: 0, wire: right }).correct, true);
  assert.strictEqual(st.defused, 1);
  // Under tiden som "Desarmerad!" visas går det inte att klippa
  assert.strictEqual(room.cut(t0.y, { bomb: 1, wire: 0 }), null);
  st.flash.until = 0;
  // Nu har de bytt roller
  assert.strictEqual(room.bombRole(t0.y), 'defuser');
  const b1 = room.bombAt(st, 1);
  const wrong = (B.solution(b1) + 1) % b1.wires.length;
  assert.strictEqual(room.cut(t0.y, { bomb: 1, wire: wrong }).correct, false);
  assert.strictEqual(st.booms, 1);
  // Lagkamraten lämnar: man gör båda delarna själv
  room.disconnect(t1.y);
  assert.strictEqual(room.bombRole(t1.x), 'solo');
  const sv = room.playerView(pl(t1.x)).round;
  assert(sv.bomb && sv.manual, 'ensam ser man både bomb och manual');
  room.endPlay();
  const d = Object.fromEntries(r.results.map((x) => [x.id, x.delta]));
  assert.strictEqual(d[t0.x], 350);
  assert.strictEqual(d[t1.x], 150);
  clearTimeout(room.timer);
}

// Zoomen och Emojigåtan: alla bilder finns, fyra olika alternativ och ett rätt.
{
  const TW = require('../server/twemoji');
  const zoom = require('../content/zoom');
  const riddles = require('../content/emojigator');
  for (const a of zoom) assert(TW.exists(a.emoji), `bild saknas för ${a.name}`);
  for (const g of riddles) for (const e of g.emojis) assert(TW.exists(e), `bild saknas i ${g.answer}: ${e}`);
  assert.strictEqual(new Set(zoom.map((a) => a.name)).size, zoom.length, 'djurnamn ska vara unika');
  for (let i = 0; i < 200; i++) {
    for (const r of buildPlan(ids(3)).filter((x) => x.type === 'emoji')) {
      assert.strictEqual(r.options.length, 4);
      assert.strictEqual(new Set(r.options).size, 4, 'alternativen ska vara olika');
      assert.strictEqual(r.options[r.correct], r.riddle.answer);
    }
  }
  // Skrivna svar: ändelser, stora bokstäver, små stavfel och andra namn godkänns.
  const S = require('../server/scoring');
  for (const [g, n, ok] of [
    ['giraffen', ['Giraff'], true],
    ['En GIRAFF', ['Giraff'], true],
    ['elfant', ['Elefant'], true],
    ['noshorning', ['Noshörning'], true],
    ['kossa', ['Ko', 'kossa', 'tjur'], true],
    ['ko', ['Ko'], true],
    ['by', ['Bi'], false],
    ['hus', ['Mus'], false],
    ['hund', ['Katt'], false],
  ])
    assert.strictEqual(S.guessMatches(g, n), ok, `${g} mot ${n}`);
  // Zoomen i ett rum: en gissning, rätt slår fel, tidigt rätt slår sent rätt.
  const room = new Room('ZOO', () => {});
  const ps = ['A', 'B', 'C'].map((n, i) => room.addOrRejoin({ name: n, emoji: ['🦊', '🐼', '🐸'][i] }).player);
  room.plan = buildPlan(ps.map((p) => p.id), { segments: ['zoom'] });
  room.roundIndex = -1;
  room.nextRound();
  room.startRound();
  const name = room.round.spec.animal.name;
  assert.strictEqual(room.zoomGuess(ps[0].id, { text: 'xxx' }).left, 0, 'en gissning');
  assert.strictEqual(room.zoomGuess(ps[0].id, { text: name }).right, false, 'efter en gissning är det låst');
  assert.strictEqual(room.zoomGuess(ps[2].id, { text: name.toLowerCase() + 'en' }).right, true);
  // C gissade rätt först. B gissar rätt nu, sist av alla, och då avslutas omgången av sig själv.
  room.round.answers.get(ps[2].id).at = room.round.playStart - 1;
  assert.strictEqual(room.zoomGuess(ps[1].id, { text: name }).right, true);
  assert.strictEqual(room.phase, 'reveal', 'när alla är klara går spelet vidare');
  const place = Object.fromEntries(room.round.results.map((x) => [x.id, x.place]));
  assert.deepStrictEqual([place[ps[2].id], place[ps[1].id], place[ps[0].id]], [1, 2, 3]);
  clearTimeout(room.timer);
}

console.log('Kanotracet, Bombdesarmeringen, Zoomen och Emojigåtan ok ✔');
process.exit(0);
