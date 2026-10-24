// Ett spelrum: håller spelare, spelplan och fas. Servern äger klockan;
// TV och mobiler visar bara det rummet skickar ut.

const S = require('./scoring');
const landmarks = require('../content/landmarks');
const inventions = require('../content/inventions');
const narmastQs = require('../content/narmast');
const swipePairs = require('../content/swipe');
const finalQs = require('../content/final');
const warmups = require('../content/warmup');

const SCALE = Number(process.env.TIME_SCALE || 1);
const T = (ms) => Math.round(ms * SCALE);

const DUR = {
  countdown: 3000,
  segmentIntro: 9000,
  bet: 20000,
  skissDraw: 45000,
  skissGrace: 10000,
  ordning: 45000,
  narmast: 20000,
  swipeCountdown: 3000,
  swipe: 30000,
  finalQuestion: 12000,
  warmup: 20000,
  reveal: 30000,
  lobbyDropMs: 60000,
};

const START_POINTS = 1000;
const RESCUE_POINTS = 50;
const SWIPE_WORDS_PER_SIDE = 10;

const SEGMENTS = {
  warmup: { title: 'Uppvärmning', rules: ['En fråga utan poäng', 'Svara i mobilen så ser ni hur det funkar'] },
  skiss: {
    title: 'Skissen',
    rules: [
      'En känd plats ritas upp streck för streck',
      'Sätt din nål på kartan och tryck Lås när du tror att du vet',
      'Ju närmare och ju snabbare, desto bättre',
    ],
  },
  ordning: {
    title: 'Ordningen',
    rules: ['Fem uppfinningar', 'Dra dem i ordning från äldst till nyast', '30 poäng för rätt plats, 15 för en plats fel'],
  },
  narmast: {
    title: 'Närmast vinner',
    rules: ['Svaret ligger alltid mellan 0 och 1000', 'Dra reglaget och lås ditt svar', 'Närmast vinner'],
  },
  swipe: {
    title: 'Höger eller vänster',
    rules: ['20 ord på 30 sekunder', 'Swipa åt rätt kategori', 'Fel svar skakar till och kostar en sekund'],
  },
  final: {
    title: 'Finalen',
    rules: [
      'Fem frågor, du ser kategorin först',
      'Satsa 0–200 poäng per fråga',
      'Rätt svar ger poängen, fel svar tar dem',
    ],
  },
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr, n) => shuffle(arr).slice(0, n);

function pickInventions(n) {
  // Fem uppfinningar med minst fem års mellanrum, så att facit är tydligt.
  for (let attempt = 0; attempt < 200; attempt++) {
    const chosen = pick(inventions, n).sort((a, b) => a.year - b.year);
    const ok = chosen.every((it, i) => i === 0 || it.year - chosen[i - 1].year >= 5);
    if (ok) return chosen;
  }
  return pick(inventions, n).sort((a, b) => a.year - b.year);
}

function buildPlan() {
  const plan = [];
  for (const lm of pick(landmarks, 3)) plan.push({ type: 'skiss', landmark: lm });
  plan.push({ type: 'ordning', items: pickInventions(5) });
  for (const q of pick(narmastQs, 3)) plan.push({ type: 'narmast', q });
  const pair = pick(swipePairs, 1)[0];
  const words = shuffle([
    ...pick(pair.leftWords, SWIPE_WORDS_PER_SIDE).map((w) => ({ w, side: 'L' })),
    ...pick(pair.rightWords, SWIPE_WORDS_PER_SIDE).map((w) => ({ w, side: 'R' })),
  ]);
  plan.push({ type: 'swipe', pair, words });
  for (const q of pick(finalQs, 5)) plan.push({ type: 'final', q });
  return plan;
}

class Room {
  constructor(code, onChange) {
    this.code = code;
    this.onChange = onChange; // anropas när något ändrats och alla vyer ska skickas om
    this.players = new Map();
    this.phase = 'lobby';
    this.plan = [];
    this.roundIndex = -1;
    this.round = null;
    this.timer = null;
    this.phaseEndsAt = null;
    this.joinUrl = null;
    this.qr = null;
    this.hostConnected = false;
    this.lastActivity = Date.now();
    this.lastResults = null;
  }

  // ---------- spelare ----------

  connectedPlayers() {
    return [...this.players.values()].filter((p) => p.connected);
  }

  addOrRejoin({ playerId, name, emoji }) {
    let p = playerId && this.players.get(playerId);
    if (p) {
      p.connected = true;
      p.dropAt = null;
      if (name && this.phase === 'lobby') p.name = this.uniqueName(name, p.id);
      if (emoji && this.phase === 'lobby') p.emoji = emoji;
      return { player: p };
    }
    if (this.phase !== 'lobby') return { error: 'Spelet har redan startat. Vänta tills nästa omgång.' };
    if (this.players.size >= 10) return { error: 'Rummet är fullt (max 10 spelare).' };
    const id = 'p' + Math.random().toString(36).slice(2, 10);
    p = {
      id,
      name: this.uniqueName(name || 'Spelare', id),
      emoji: emoji || '🙂',
      points: START_POINTS,
      ready: false,
      connected: true,
      dropAt: null,
    };
    this.players.set(id, p);
    return { player: p };
  }

  uniqueName(name, selfId) {
    const base = String(name).trim().slice(0, 16) || 'Spelare';
    const taken = new Set([...this.players.values()].filter((p) => p.id !== selfId).map((p) => p.name.toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    for (let i = 2; i < 100; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
    return base;
  }

  disconnect(playerId) {
    const p = this.players.get(playerId);
    if (!p) return;
    p.connected = false;
    if (this.phase === 'lobby') {
      p.ready = false;
      p.dropAt = Date.now() + DUR.lobbyDropMs;
      setTimeout(() => {
        if (!p.connected && p.dropAt && Date.now() >= p.dropAt && this.phase === 'lobby') {
          this.players.delete(p.id);
          this.changed();
        }
      }, DUR.lobbyDropMs + 50);
    }
    this.checkProgress();
    this.changed();
  }

  setReady(playerId, ready) {
    const p = this.players.get(playerId);
    if (!p || this.phase !== 'lobby') return;
    p.ready = !!ready;
    this.changed();
    this.maybeStart();
  }

  maybeStart() {
    const ps = this.connectedPlayers();
    if (this.phase === 'lobby' && ps.length >= 2 && ps.every((p) => p.ready)) this.startGame();
  }

  // ---------- fasstyrning ----------

  setPhase(phase, ms, next) {
    clearTimeout(this.timer);
    this.phase = phase;
    this.phaseEndsAt = ms != null ? Date.now() + ms : null;
    if (ms != null && next) this.timer = setTimeout(next, ms);
    this.changed();
  }

  changed() {
    this.lastActivity = Date.now();
    if (this.onChange) this.onChange(this);
  }

  startGame() {
    for (const p of this.players.values()) {
      p.points = START_POINTS;
      p.history = [];
    }
    // Spelare som inte är anslutna när spelet startar tas bort.
    for (const p of [...this.players.values()]) if (!p.connected) this.players.delete(p.id);
    this.plan = buildPlan();
    this.roundIndex = -1;
    this.lastResults = null;
    this.setPhase('countdown', T(DUR.countdown), () => this.startWarmup());
  }

  startWarmup() {
    this.round = { type: 'warmup', q: pick(warmups, 1)[0], answers: new Map(), next: new Set() };
    this.setPhase('warmup', T(DUR.warmup), () => this.revealWarmup());
  }

  revealWarmup() {
    this.round.next = new Set();
    this.setPhase('warmup-reveal', T(DUR.reveal), () => this.nextRound());
  }

  nextRound() {
    const prevType = this.roundIndex >= 0 ? this.plan[this.roundIndex].type : 'warmup';
    this.roundIndex++;
    if (this.roundIndex >= this.plan.length) return this.finish();
    const spec = this.plan[this.roundIndex];
    this.round = {
      type: spec.type,
      spec,
      bets: new Map(),
      answers: new Map(),
      next: new Set(),
      results: null,
    };
    if (spec.type !== prevType) {
      this.setPhase('segment-intro', T(DUR.segmentIntro), () => this.startBet());
    } else {
      this.startBet();
    }
  }

  startBet() {
    // Den som står på noll får 50 poäng att spela med, så att ingen är utslagen resten av kvällen.
    this.round.rescued = new Set();
    for (const p of this.players.values()) {
      if (p.points <= 0) {
        p.points = RESCUE_POINTS;
        this.round.rescued.add(p.id);
      }
    }
    this.setPhase('bet', T(DUR.bet), () => this.startPlay());
  }

  placeBet(playerId, amount) {
    const p = this.players.get(playerId);
    if (!p || this.phase !== 'bet') return;
    const lim = S.betLimits(p.points, this.round.type === 'final');
    const a = Math.round(Number(amount));
    if (!Number.isFinite(a)) return;
    this.round.bets.set(playerId, S.clamp(a, lim.min, lim.max));
    this.changed();
    this.checkProgress();
  }

  betFor(p) {
    if (this.round.bets.has(p.id)) return this.round.bets.get(p.id);
    return S.betLimits(p.points, this.round.type === 'final').min;
  }

  startPlay() {
    const r = this.round;
    // Den som inte hann satsa får minsta satsningen.
    for (const p of this.players.values()) if (!r.bets.has(p.id)) r.bets.set(p.id, this.betFor(p));
    const now = Date.now();
    r.playStart = now;
    switch (r.type) {
      case 'skiss':
        r.drawMs = T(DUR.skissDraw);
        this.setPhase('play', T(DUR.skissDraw + DUR.skissGrace), () => this.endPlay());
        break;
      case 'ordning':
        r.startOrder = shuffle(r.spec.items.map((i) => i.id));
        this.setPhase('play', T(DUR.ordning), () => this.endPlay());
        break;
      case 'narmast':
        this.setPhase('play', T(DUR.narmast), () => this.endPlay());
        break;
      case 'swipe':
        r.swipeStart = now + T(DUR.swipeCountdown);
        r.swipeMs = T(DUR.swipe);
        r.orders = new Map();
        for (const p of this.players.values()) {
          r.orders.set(p.id, shuffle(r.spec.words.map((_, i) => i)));
          r.answers.set(p.id, { i: 0, correct: 0, wrong: 0, finishedAt: null });
        }
        this.setPhase('play', T(DUR.swipeCountdown + DUR.swipe), () => this.endPlay());
        break;
      case 'final':
        this.setPhase('play', T(DUR.finalQuestion), () => this.endPlay());
        break;
      default:
        this.endPlay();
    }
  }

  // ---------- svar ----------

  answer(playerId, data) {
    const p = this.players.get(playerId);
    if (!p || !data) return;
    const r = this.round;
    const now = Date.now();

    if (this.phase === 'warmup') {
      if (!r.answers.has(playerId)) r.answers.set(playerId, { choice: Number(data.choice), at: now });
      this.changed();
      return this.checkProgress();
    }
    if (this.phase !== 'play') return;

    const prev = r.answers.get(playerId);
    if (prev && prev.locked) return;

    switch (r.type) {
      case 'skiss': {
        const lat = Number(data.lat);
        const lon = Number(data.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        r.answers.set(playerId, { lat: S.clamp(lat, -90, 90), lon: normLon(lon), at: now, locked: !!data.lock });
        break;
      }
      case 'ordning': {
        const ids = r.spec.items.map((i) => i.id);
        const order = Array.isArray(data.order) ? data.order.filter((x) => ids.includes(x)) : [];
        if (order.length !== ids.length || new Set(order).size !== ids.length) return;
        r.answers.set(playerId, { order, at: now, locked: !!data.lock });
        break;
      }
      case 'narmast': {
        const v = Math.round(Number(data.value));
        if (!Number.isFinite(v)) return;
        r.answers.set(playerId, { value: S.clamp(v, 0, 1000), at: now, locked: !!data.lock });
        break;
      }
      case 'final': {
        const c = Number(data.choice);
        if (!(c >= 0 && c < r.spec.q.options.length)) return;
        r.answers.set(playerId, { choice: c, at: now, locked: true });
        break;
      }
      default:
        return;
    }
    this.changed();
    this.checkProgress();
  }

  // Ett swipe räknas på servern. Svaret går tillbaka direkt så att mobilen kan skaka vid fel.
  swipe(playerId, { i, dir }) {
    const r = this.round;
    if (this.phase !== 'play' || r.type !== 'swipe') return null;
    const st = r.answers.get(playerId);
    if (!st || st.finishedAt) return null;
    const now = Date.now();
    if (now < r.swipeStart || now > r.swipeStart + r.swipeMs + 500) return null;
    if (i !== st.i) return null;
    const order = r.orders.get(playerId);
    const word = r.spec.words[order[i]];
    const correct = word.side === dir;
    if (correct) st.correct++;
    else {
      st.wrong++;
      if (!r.misses) r.misses = new Map();
      r.misses.set(order[i], (r.misses.get(order[i]) || 0) + 1);
    }
    st.i++;
    if (st.i >= order.length) st.finishedAt = now;
    this.checkProgress();
    this.changed();
    return { i, correct };
  }

  pressNext(playerId) {
    if (this.phase !== 'reveal' && this.phase !== 'warmup-reveal') return;
    this.round.next.add(playerId);
    this.changed();
    this.checkProgress();
  }

  hostNext() {
    if (this.phase === 'reveal' || this.phase === 'warmup-reveal') return this.nextRound();
    if (this.phase === 'segment-intro') return this.startBet();
  }

  // Går vidare direkt när alla anslutna är klara.
  checkProgress() {
    const ps = this.connectedPlayers();
    if (!ps.length) return;
    const r = this.round;
    if (this.phase === 'lobby') return this.maybeStart();
    if (this.phase === 'warmup' && ps.every((p) => r.answers.has(p.id))) return this.revealWarmup();
    if (this.phase === 'warmup-reveal' && ps.every((p) => r.next.has(p.id))) return this.nextRound();
    if (this.phase === 'bet' && ps.every((p) => r.bets.has(p.id))) return this.startPlay();
    if (this.phase === 'play') {
      if (r.type === 'swipe') {
        if (ps.every((p) => r.answers.get(p.id) && r.answers.get(p.id).finishedAt)) return this.endPlay();
      } else if (ps.every((p) => r.answers.get(p.id) && r.answers.get(p.id).locked)) {
        return this.endPlay();
      }
    }
    if (this.phase === 'reveal' && ps.every((p) => r.next.has(p.id))) return this.nextRound();
  }

  // ---------- resultat ----------

  endPlay() {
    if (this.phase !== 'play') return;
    const r = this.round;
    const end = Date.now();
    const players = [...this.players.values()];
    let rows;

    if (r.type === 'final') {
      const correct = r.spec.q.correct;
      rows = players.map((p) => {
        const a = r.answers.get(p.id);
        const bet = r.bets.get(p.id) || 0;
        const right = !!a && a.choice === correct;
        return {
          id: p.id,
          bet,
          delta: right ? bet : -bet,
          detail: { choice: a ? a.choice : null, right },
        };
      });
    } else {
      const entries = players.map((p) => {
        const a = r.answers.get(p.id);
        const bet = r.bets.get(p.id) || 0;
        const base = { id: p.id, bet };
        switch (r.type) {
          case 'skiss': {
            if (!a) return { ...base, perf: -1, tiebreak: Infinity, detail: null };
            const km = S.haversineKm(a.lat, a.lon, r.spec.landmark.lat, r.spec.landmark.lon);
            const at = a.locked ? a.at : end;
            const progress = (at - r.playStart) / r.drawMs;
            const score = S.skissScore(km, progress);
            return {
              ...base,
              perf: score,
              tiebreak: at - r.playStart,
              detail: { lat: a.lat, lon: a.lon, km: Math.round(km), score, drawnPct: Math.round(S.clamp(progress, 0, 1) * 100) },
            };
          }
          case 'ordning': {
            if (!a) return { ...base, perf: -1, tiebreak: Infinity, detail: null };
            const correctOrder = r.spec.items.map((i) => i.id);
            const score = S.ordningScore(a.order, correctOrder);
            const at = a.locked ? a.at : end;
            return { ...base, perf: score, tiebreak: at - r.playStart, detail: { order: a.order, score } };
          }
          case 'narmast': {
            if (!a) return { ...base, perf: -Infinity, tiebreak: Infinity, detail: null };
            const dist = Math.abs(a.value - r.spec.q.answer);
            const at = a.locked ? a.at : end;
            return {
              ...base,
              perf: -dist,
              tiebreak: at - r.playStart,
              detail: { value: a.value, dist, score: S.narmastPoints(a.value, r.spec.q.answer) },
            };
          }
          case 'swipe': {
            if (!a || a.i === 0) return { ...base, perf: -1, tiebreak: Infinity, detail: null };
            const finished = !!a.finishedAt;
            const left = finished ? (r.swipeStart + r.swipeMs - a.finishedAt) / 1000 / SCALE : 0;
            const score = S.swipeScore(a.correct, finished, left);
            return {
              ...base,
              perf: score,
              tiebreak: finished ? a.finishedAt - r.swipeStart : Infinity,
              detail: { correct: a.correct, wrong: a.wrong, answered: a.i, score },
            };
          }
          default:
            return { ...base, perf: 0, tiebreak: 0, detail: null };
        }
      });
      rows = S.rankAndPayout(entries);
    }

    for (const row of rows) {
      const p = this.players.get(row.id);
      if (!p) continue;
      row.before = p.points;
      p.points = Math.max(0, p.points + row.delta);
      row.after = p.points;
    }
    r.results = rows;
    r.extra = this.revealExtra(r);
    this.lastResults = rows;
    this.setPhase('reveal', T(DUR.reveal), () => this.nextRound());
  }

  revealExtra(r) {
    if (r.type !== 'swipe' || !r.misses) return null;
    // Orden som flest swipade fel på.
    const top = [...r.misses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { misses: top.map(([idx, n]) => ({ w: r.spec.words[idx].w, side: r.spec.words[idx].side, n })) };
  }

  finish() {
    clearTimeout(this.timer);
    this.round = null;
    this.setPhase('podium', null, null);
  }

  restart() {
    for (const p of this.players.values()) {
      p.ready = false;
      p.points = START_POINTS;
    }
    this.plan = [];
    this.roundIndex = -1;
    this.round = null;
    this.setPhase('lobby', null, null);
  }

  // ---------- vyer ----------

  remainingMs() {
    return this.phaseEndsAt ? Math.max(0, this.phaseEndsAt - Date.now()) : null;
  }

  playerStatus(p) {
    const r = this.round;
    switch (this.phase) {
      case 'lobby':
        return p.ready ? 'ready' : 'waiting';
      case 'warmup':
        return r.answers.has(p.id) ? 'done' : 'waiting';
      case 'bet':
        return r.bets.has(p.id) ? 'done' : 'waiting';
      case 'play': {
        const a = r.answers.get(p.id);
        if (r.type === 'swipe') return a && a.finishedAt ? 'done' : 'waiting';
        return a && a.locked ? 'done' : 'waiting';
      }
      case 'reveal':
      case 'warmup-reveal':
        return r.next.has(p.id) ? 'done' : 'waiting';
      default:
        return null;
    }
  }

  publicPlayers() {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      points: p.points,
      connected: p.connected,
      status: this.playerStatus(p),
    }));
  }

  standings() {
    return [...this.players.values()]
      .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, points: p.points }))
      .sort((a, b) => b.points - a.points);
  }

  segmentInfo() {
    const r = this.round;
    if (!r) return null;
    const seg = SEGMENTS[r.type];
    if (!seg) return null;
    const ofType = this.plan.filter((x) => x.type === r.type);
    const idx = this.plan.slice(0, this.roundIndex + 1).filter((x) => x.type === r.type).length;
    return { type: r.type, title: seg.title, rules: seg.rules, index: idx, count: ofType.length };
  }

  base() {
    return {
      code: this.code,
      phase: this.phase,
      remainingMs: this.remainingMs(),
      players: this.publicPlayers(),
      segment: this.segmentInfo(),
      roundIndex: this.roundIndex,
      roundTotal: this.plan.length,
    };
  }

  // Det TV:n får se.
  tvView() {
    const v = { ...this.base(), joinUrl: this.joinUrl, qr: this.qr };
    const r = this.round;
    if (this.phase === 'podium' || this.phase === 'reveal') v.standings = this.standings();
    if (!r) return v;
    if (r.type === 'warmup') {
      v.warmup = { q: r.q.q, options: r.q.options };
      if (this.phase === 'warmup-reveal') v.warmup.correct = r.q.correct;
      return v;
    }
    v.round = this.roundPublic(r, true);
    if (this.phase === 'reveal') v.results = this.resultsPublic(r);
    return v;
  }

  // Det en enskild spelare får se.
  playerView(p) {
    const v = { ...this.base(), me: { id: p.id, name: p.name, emoji: p.emoji, points: p.points, ready: p.ready } };
    const r = this.round;
    if (this.phase === 'podium') v.standings = this.standings();
    if (!r) return v;
    if (r.type === 'warmup') {
      const a = r.answers.get(p.id);
      v.warmup = { q: r.q.q, options: r.q.options, myChoice: a ? a.choice : null };
      if (this.phase === 'warmup-reveal') v.warmup.correct = r.q.correct;
      v.me.pressedNext = r.next.has(p.id);
      return v;
    }
    v.round = this.roundPublic(r, false, p);
    if (this.phase === 'bet' || this.phase === 'segment-intro') {
      v.betLimits = S.betLimits(p.points, r.type === 'final');
      v.myBet = r.bets.has(p.id) ? r.bets.get(p.id) : null;
      v.rescued = !!(r.rescued && r.rescued.has(p.id));
    } else if (r.bets.has(p.id)) {
      v.myBet = r.bets.get(p.id);
    }
    if (this.phase === 'play') {
      const a = r.answers.get(p.id);
      v.myAnswer = a ? { ...a } : null;
    }
    if (this.phase === 'reveal') {
      v.results = this.resultsPublic(r);
      v.myResult = v.results.rows.find((x) => x.id === p.id) || null;
      v.me.pressedNext = r.next.has(p.id);
      v.myPlace = this.standings().findIndex((s) => s.id === p.id) + 1;
    }
    return v;
  }

  roundPublic(r, forTv, p) {
    const spec = r.spec;
    const reveal = this.phase === 'reveal';
    const now = Date.now();
    switch (r.type) {
      case 'skiss': {
        const o = { type: 'skiss' };
        if (this.phase === 'play' || reveal) {
          o.drawElapsedMs = this.phase === 'play' ? now - r.playStart : r.drawMs;
          o.drawMs = r.drawMs;
          if (forTv || reveal) {
            o.paths = spec.landmark.paths;
            o.transform = spec.landmark.transform || null;
          }
        }
        if (reveal) Object.assign(o, pickKeys(spec.landmark, ['name', 'place', 'lat', 'lon', 'fact']));
        return o;
      }
      case 'ordning': {
        const o = { type: 'ordning' };
        if (this.phase === 'play' || reveal) {
          const byId = Object.fromEntries(spec.items.map((i) => [i.id, i]));
          o.items = r.startOrder.map((id) => ({ id, name: byId[id].name }));
        }
        if (reveal) o.correct = spec.items.map((i) => ({ id: i.id, name: i.name, year: i.year, note: i.note }));
        return o;
      }
      case 'narmast': {
        const o = { type: 'narmast' };
        if (this.phase === 'play' || reveal) o.q = spec.q.q;
        if (reveal) {
          o.answer = spec.q.answer;
          o.unit = spec.q.unit;
        }
        return o;
      }
      case 'swipe': {
        const o = { type: 'swipe', left: spec.pair.left, right: spec.pair.right };
        if (this.phase === 'play') {
          o.startInMs = r.swipeStart - now;
          o.durationMs = r.swipeMs;
          if (p) {
            o.words = r.orders.get(p.id).map((i) => spec.words[i].w);
            const st = r.answers.get(p.id);
            o.progress = st ? { i: st.i, correct: st.correct, wrong: st.wrong, finished: !!st.finishedAt } : null;
          } else {
            o.total = spec.words.length;
            o.progress = Object.fromEntries([...r.answers].map(([pid, st]) => [pid, { i: st.i, correct: st.correct }]));
          }
        }
        if (reveal) o.words = spec.words.map((x) => ({ w: x.w, side: x.side }));
        return o;
      }
      case 'final': {
        const o = { type: 'final', category: spec.q.category, maxBet: 200 };
        if (this.phase === 'play' || reveal) {
          o.q = spec.q.q;
          o.options = spec.q.options;
        }
        if (reveal) o.correct = spec.q.correct;
        return o;
      }
      default:
        return { type: r.type };
    }
  }

  resultsPublic(r) {
    const extra = r.extra || null;
    const byId = Object.fromEntries([...this.players.values()].map((p) => [p.id, p]));
    const rows = (r.results || []).map((row) => ({
      id: row.id,
      name: byId[row.id] ? byId[row.id].name : '?',
      emoji: byId[row.id] ? byId[row.id].emoji : '',
      place: row.place || null,
      multiplier: row.multiplier != null ? row.multiplier : null,
      bet: row.bet,
      delta: row.delta,
      before: row.before,
      after: row.after,
      detail: row.detail,
    }));
    if (r.type === 'final') rows.sort((a, b) => b.delta - a.delta);
    return { type: r.type, rows, extra };
  }
}

function normLon(lon) {
  let x = ((((lon + 180) % 360) + 360) % 360) - 180;
  if (x === -180) x = 180;
  return x;
}

function pickKeys(obj, keys) {
  return Object.fromEntries(keys.map((k) => [k, obj[k]]));
}

module.exports = { Room, DUR, SEGMENTS, START_POINTS, buildPlan };
