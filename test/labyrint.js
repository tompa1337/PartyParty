// Testar Labyrinten: lagen, jämnt antal spelare, bollens rörelse och poängen.
const assert = require('assert');
const M = require('../server/maze');
const { Room, buildPlan, BALL_SPEED } = require('../server/game');

const ids = (n) => Array.from({ length: n }, (_, i) => 'p' + i);

// 1. Bara med jämnt antal spelare, och lagen är par där alla är med exakt en gång.
for (let n = 1; n <= 10; n++) {
  const plan = buildPlan(ids(n));
  const lab = plan.filter((x) => x.type === 'labyrint');
  if (n % 2) assert.strictEqual(lab.length, 0, `${n} spelare ska inte ge Labyrinten`);
  else {
    assert.strictEqual(lab.length, 1, `${n} spelare ska ge en Labyrint`);
    const teams = lab[0].teams;
    assert.strictEqual(teams.length, n / 2);
    const all = teams.flatMap((t) => [t.x, t.y]).sort();
    assert.deepStrictEqual(all, ids(n).sort(), 'alla spelare ska vara med i exakt ett lag');
  }
}

// 2. Labyrinten går alltid att lösa från start till mål.
for (let i = 0; i < 50; i++) {
  const mz = M.generate(15, 9);
  assert(Number.isFinite(mz.dist[0]), 'start ska nå målet');
  assert(mz.dist.every(Number.isFinite), 'alla rutor ska nå målet');
}

// 3. Två "spelare" som var för sig styr sin axel mot nästa ruta tar sig i mål.
function drive(mz, ms) {
  const ball = { x: mz.start.x + 0.5, y: mz.start.y + 0.5 };
  for (let t = 0; t < ms; t += 50) {
    const c = M.cellOf(mz, ball);
    const next = M.nextCell(mz, c.x, c.y);
    const input = {};
    for (const axis of ['x', 'y']) {
      const diff = next[axis] + 0.5 - ball[axis];
      input[axis] = Math.abs(diff) > 0.08 ? Math.sign(diff) : 0;
    }
    M.step(mz, ball, input, 50, BALL_SPEED);
    // Bollen får aldrig gå igenom en vägg.
    assert(ball.x > 0 && ball.y > 0 && ball.x < mz.w && ball.y < mz.h, 'bollen lämnade labyrinten');
    if (M.inGoal(mz, ball)) return t;
  }
  return null;
}
for (let i = 0; i < 30; i++) {
  const mz = M.generate(15, 9);
  const t = drive(mz, 90000);
  assert(t != null, 'perfekt styrning ska nå målet inom 90 sekunder');
}

// 4. Väggar stoppar bollen.
{
  const mz = M.generate(15, 9);
  const ball = { x: 0.5, y: 0.5 };
  M.step(mz, ball, { x: -1, y: 0 }, 2000, BALL_SPEED);
  assert.strictEqual(ball.x, 0.5, 'ytterväggen ska stoppa bollen');
  M.step(mz, ball, { x: 0, y: -1 }, 2000, BALL_SPEED);
  assert.strictEqual(ball.y, 0.5, 'ytterväggen ska stoppa bollen');
}

// 5. Ett helt parti Labyrinten i ett rum: rätt spelare styr rätt axel, poängen delas i laget.
{
  const room = new Room('LAB', () => {});
  const ps = ['A', 'B', 'C', 'D'].map((n, i) => room.addOrRejoin({ name: n, emoji: ['🦊', '🐼', '🐸', '🦄'][i] }).player);
  room.plan = buildPlan(ps.map((p) => p.id), { segments: ['labyrint'] });
  assert.strictEqual(room.plan.length, 1);
  room.roundIndex = -1;
  room.nextRound();
  assert.strictEqual(room.phase, 'segment-intro');
  const intro = room.playerView(ps[0]).round;
  assert(intro.mate && intro.myAxis, 'mobilen ska veta lagkamrat och axel redan i introt');
  room.startRound();
  assert.strictEqual(room.phase, 'play');
  clearInterval(room.loop); // vi stegar själva

  const r = room.round;
  const [t0, t1] = r.spec.teams;
  // Fel axel ignoreras: x-spelaren kan inte styra upp och ner så länge lagkamraten är kvar.
  room.steer(t0.x, { axis: 'y', dir: 1 });
  assert.deepStrictEqual(r.inputs.get(t0.x), { x: 1, y: 0 }, 'x-spelaren styr bara x');
  room.steer(t0.x, { axis: 'x', dir: 0 });

  // Lag 0 kör perfekt till mål, lag 1 står still.
  const mz = r.spec.maze;
  let now = Date.now();
  for (let k = 0; k < 2000 && !r.balls[0].finishedAt; k++) {
    const ball = r.balls[0];
    const c = M.cellOf(mz, ball);
    const next = M.nextCell(mz, c.x, c.y);
    const d = (axis) => (Math.abs(next[axis] + 0.5 - ball[axis]) > 0.08 ? Math.sign(next[axis] + 0.5 - ball[axis]) : 0);
    room.steer(t0.x, { axis: 'x', dir: d('x') });
    room.steer(t0.y, { axis: 'y', dir: d('y') });
    now += 50;
    room.labyrintStep(50, now);
  }
  assert(r.balls[0].finishedAt, 'lag 0 ska ha gått i mål');
  assert.strictEqual(room.playerView(ps.find((p) => p.id === t0.x)).players.find((x) => x.id === t0.x).status, 'done');

  // Om en spelare lämnar tar lagkamraten över båda axlarna.
  room.disconnect(t1.x);
  assert.deepStrictEqual(room.axesFor(t1.y), ['x', 'y']);
  room.steer(t1.y, { axis: 'x', dir: 1 });
  assert.strictEqual(r.inputs.get(t1.y).x, 1, 'lagkamraten ska kunna styra x');
  room.steer(t1.y, { axis: 'x', dir: 0 });

  room.endPlay();
  assert.strictEqual(room.phase, 'reveal');
  const d = Object.fromEntries(r.results.map((x) => [x.id, x.delta]));
  // 4 spelare: vinnarlaget delar 400 + 300, förlorarna 200 + 100.
  assert.strictEqual(d[t0.x], 350);
  assert.strictEqual(d[t0.y], 350);
  assert.strictEqual(d[t1.x], 150);
  assert.strictEqual(d[t1.y], 150);
  const tv = room.tvView();
  assert(tv.round.maze && tv.round.balls.length === 2, 'TV:n ska få labyrinten och bollarna');
  clearTimeout(room.timer);
}

console.log('Labyrinten ok ✔');
process.exit(0);
