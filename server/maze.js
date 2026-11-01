// Labyrinten: slumpad labyrint och bollens rörelse. Ren logik utan sidoeffekter.
//
// Varje ruta har en bitmask med väggar: N=1, E=2, S=4, W=8. Bollens position mäts i rutor,
// där mitten av ruta (x, y) ligger på (x + 0,5, y + 0,5).

const N = 1;
const E = 2;
const S = 4;
const W = 8;
const DIRS = [
  { bit: N, dx: 0, dy: -1, opp: S },
  { bit: E, dx: 1, dy: 0, opp: W },
  { bit: S, dx: 0, dy: 1, opp: N },
  { bit: W, dx: -1, dy: 0, opp: E },
];

// Hur nära mitten bollen måste vara för att kunna svänga in i en sidogång.
const ALIGN = 0.12;

function generate(w, h, rnd = Math.random) {
  const cells = new Array(w * h).fill(N | E | S | W);
  const seen = new Array(w * h).fill(false);
  const at = (x, y) => y * w + x;
  // Djupet först med en egen stack, så att gångarna blir långa och slingriga.
  const stack = [[0, 0]];
  seen[0] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = DIRS.filter((d) => {
      const nx = x + d.dx;
      const ny = y + d.dy;
      return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[at(nx, ny)];
    });
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const d = opts[Math.floor(rnd() * opts.length)];
    const nx = x + d.dx;
    const ny = y + d.dy;
    cells[at(x, y)] &= ~d.bit;
    cells[at(nx, ny)] &= ~d.opp;
    seen[at(nx, ny)] = true;
    stack.push([nx, ny]);
  }
  // Riv några extra väggar så att det finns mer än en väg och man kan välja genvägar.
  const extra = Math.round(w * h * 0.03);
  for (let k = 0, tries = 0; k < extra && tries < 500; tries++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * h);
    const d = DIRS[Math.floor(rnd() * 4)];
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h || !(cells[at(x, y)] & d.bit)) continue;
    cells[at(x, y)] &= ~d.bit;
    cells[at(nx, ny)] &= ~d.opp;
    k++;
  }
  const start = { x: 0, y: 0 };
  const goal = { x: w - 1, y: h - 1 };
  return { w, h, cells, start, goal, dist: distances(w, h, cells, goal) };
}

// Antal steg från varje ruta till målet.
function distances(w, h, cells, goal) {
  const dist = new Array(w * h).fill(Infinity);
  dist[goal.y * w + goal.x] = 0;
  const queue = [[goal.x, goal.y]];
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    const here = dist[y * w + x];
    for (const d of DIRS) {
      if (cells[y * w + x] & d.bit) continue;
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (dist[ny * w + nx] > here + 1) {
        dist[ny * w + nx] = here + 1;
        queue.push([nx, ny]);
      }
    }
  }
  return dist;
}

const cellOf = (maze, ball) => ({
  x: Math.max(0, Math.min(maze.w - 1, Math.floor(ball.x))),
  y: Math.max(0, Math.min(maze.h - 1, Math.floor(ball.y))),
});

function stepsLeft(maze, ball) {
  const c = cellOf(maze, ball);
  return maze.dist[c.y * maze.w + c.x];
}

function inGoal(maze, ball) {
  const c = cellOf(maze, ball);
  return c.x === maze.goal.x && c.y === maze.goal.y;
}

// Flyttar bollen längs en axel. Utan väggar i vägen glider den fritt. För att svänga in i en
// sidogång måste den ligga nära mitten; om den andra spelaren inte styr dras bollen dit av sig själv.
function moveAxis(maze, ball, axis, dir, step, otherHeld) {
  const o = axis === 'x' ? 'y' : 'x';
  const c = cellOf(maze, ball);
  const center = (axis === 'x' ? c.x : c.y) + 0.5;
  const otherCenter = (axis === 'x' ? c.y : c.x) + 0.5;
  const off = ball[o] - otherCenter;
  if (Math.abs(off) < ALIGN && !otherHeld) ball[o] = otherCenter;
  else if (!otherHeld) ball[o] -= Math.sign(off) * Math.min(step, Math.abs(off));
  if (!dir) return;
  const bit = axis === 'x' ? (dir > 0 ? E : W) : dir > 0 ? S : N;
  const blocked = (maze.cells[c.y * maze.w + c.x] & bit) || Math.abs(ball[o] - otherCenter) >= ALIGN;
  let next = ball[axis] + dir * step;
  if (blocked) next = dir > 0 ? Math.min(next, Math.max(ball[axis], center)) : Math.max(next, Math.min(ball[axis], center));
  ball[axis] = next;
}

// Ett tidssteg. input = { x: -1|0|1, y: -1|0|1 }, speed i rutor per sekund.
function step(maze, ball, input, dtMs, speed) {
  const s = (speed * dtMs) / 1000;
  // Dela upp långa steg så att bollen aldrig hoppar över en sväng.
  const parts = Math.max(1, Math.ceil(s / 0.1));
  for (let i = 0; i < parts; i++) {
    moveAxis(maze, ball, 'x', input.x, s / parts, !!input.y);
    moveAxis(maze, ball, 'y', input.y, s / parts, !!input.x);
  }
}

// Nästa ruta på kortaste vägen mot målet (används av botarna).
function nextCell(maze, x, y) {
  const here = maze.dist[y * maze.w + x];
  for (const d of DIRS) {
    if (maze.cells[y * maze.w + x] & d.bit) continue;
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (maze.dist[ny * maze.w + nx] < here) return { x: nx, y: ny };
  }
  return { x, y };
}

module.exports = { generate, step, stepsLeft, inGoal, cellOf, nextCell, N, E, S, W };
