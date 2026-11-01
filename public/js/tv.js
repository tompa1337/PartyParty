(function () {
  const { esc, clock, createSketch, fmt, signed, mult } = window.PP;
  const socket = io();
  const $ = (s) => document.querySelector(s);
  const top = $('#top');
  const stage = $('#stage');
  const rail = $('#rail');
  const timerEl = $('#timer');

  let state = null;
  let screenKey = null;
  let sketch = null;
  let drawStart = null;
  let drawMs = null;
  let map = null;
  let lab = null; // Labyrinten: canvas och bollarnas positioner
  let kanot = null; // Kanotracet: canvas, kanoter och plask
  let anim = null; // Zoomen och Emojigåtan: pågående animation

  // Testläge: inställningarna kommer från /test via adressen (?test=...).
  let testOpts = null;
  try {
    const t = new URLSearchParams(location.search).get('test');
    if (t) testOpts = JSON.parse(t);
  } catch {
    testOpts = null;
  }
  const roomKey = testOpts ? 'pp-tv-test-room' : 'pp-tv-room';

  socket.on('connect', () => {
    const saved = sessionStorage.getItem(roomKey);
    socket.emit('host:hello', { code: saved, origin: location.origin, test: testOpts }, ({ code }) => {
      sessionStorage.setItem(roomKey, code);
    });
  });
  socket.on('state', (s) => {
    state = s;
    render();
  });

  // ---------- helskärm ----------
  // Webbläsare tillåter bara helskärm efter att någon tryckt, så det finns en knapp, tangenten F och dubbelklick.
  const fsSupported = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function toggleFullscreen() {
    const el = document.documentElement;
    if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const res = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      if (res && res.catch) res.catch(() => {});
    }
  }
  function fsButton() {
    if (!fsSupported || isFull()) return '';
    return `<button class="quiet" id="fs" title="Helskärm (F)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>Helskärm</button>`;
  }
  document.addEventListener('fullscreenchange', () => state && renderTop(state));
  document.addEventListener('webkitfullscreenchange', () => state && renderTop(state));
  document.addEventListener('dblclick', (e) => {
    if (!e.target.closest('button, .leaflet-container')) toggleFullscreen();
  });
  // Installerad som app (utan adressfält) behövs ingen knapp.
  if (window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) document.body.classList.add('standalone');
  // Muspekaren göms efter tre sekunder utan rörelse.
  let idleT = null;
  const wake = () => {
    document.body.classList.remove('idle');
    clearTimeout(idleT);
    idleT = setTimeout(() => document.body.classList.add('idle'), 3000);
  };
  document.addEventListener('mousemove', wake);
  wake();

  // Enter, mellanslag eller pil höger går vidare när det går, praktiskt med fjärrkontroll eller tangentbord.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') return toggleFullscreen();
    if (['Enter', ' ', 'ArrowRight'].includes(e.key)) {
      if (state && (state.test || ['reveal', 'warmup-reveal', 'segment-intro'].includes(state.phase))) socket.emit('host:next');
    }
  });

  const SEG_NAMES = { skiss: 'Skissen', ordning: 'Ordningen', narmast: 'Närmast vinner', swipe: 'Höger eller vänster', final: 'Finalen' };

  function render() {
    const s = state;
    const key = `${s.phase}:${s.roundIndex}`;
    clock.set(s.remainingMs, key);
    const timed = s.remainingMs != null && !['lobby', 'podium', 'countdown', 'round-ready'].includes(s.phase);
    timerEl.classList.toggle('on', timed);
    document.body.classList.toggle('wide', s.phase === 'reveal');

    renderTop(s);
    renderRail(s);

    if (key !== screenKey) {
      screenKey = key;
      cleanup();
      build(s);
    } else {
      update(s);
    }
    fitAll();
  }

  // ---------- allt ska få plats ----------
  // Om innehållet är större än sin ram krymps det i små steg tills allt syns.
  function fit(el) {
    const box = el.parentElement;
    if (!box || box.offsetParent === null) return;
    const W = box.clientWidth;
    const H = box.clientHeight;
    let scale = 1;
    for (let i = 0; i < 14; i++) {
      el.style.width = `${W / scale}px`;
      el.style.height = `${H / scale}px`;
      el.style.transform = scale === 1 ? '' : `scale(${scale})`;
      if (el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) break;
      scale = Math.max(0.55, scale - 0.05);
    }
    if (map) map.invalidateSize();
  }
  let fitQueued = false;
  function fitAll() {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(() => {
      fitQueued = false;
      fit(stage);
      fit(rail);
    });
  }
  window.addEventListener('resize', fitAll);
  if (document.fonts) document.fonts.ready.then(fitAll);
  document.addEventListener('load', fitAll, true); // t.ex. när QR-koden laddats

  function cleanup() {
    sketch = null;
    lab = null;
    kanot = null;
    anim = null;
    drawStart = null;
    if (map) {
      map.remove();
      map = null;
    }
  }

  function renderTop(s) {
    const seg = s.segment && s.phase !== 'lobby' && s.phase !== 'podium' && s.phase !== 'countdown'
      ? `<span class="seg">${esc(s.segment.title)}${s.segment.count > 1 ? ` · ${s.segment.index} av ${s.segment.count}` : ''}</span>`
      : '';
    const test = s.test ? `<span class="test-pill" title="Enter hoppar till nästa steg">Testläge · Enter = nästa</span>` : '';
    top.innerHTML = `<span class="logo">PartyParty</span>${seg}${test}<span class="code">Rumskod <b>${esc(s.code)}</b></span>${fsButton()}`;
    const fsb = $('#fs');
    if (fsb) fsb.addEventListener('click', toggleFullscreen);
  }

  function statusMark(p, s) {
    const done = s.phase === 'lobby' ? p.status === 'ready' : p.status === 'done';
    if (!p.status) return '<span class="st"></span>';
    return done ? '<span class="st done" title="Klar"></span>' : '<span class="st">···</span>';
  }

  function renderRail(s) {
    const ps = [...s.players].sort((a, b) => (s.phase === 'lobby' ? 0 : b.points - a.points));
    const title = s.phase === 'lobby' ? `Spelare (${ps.length})` : 'Ställning';
    rail.innerHTML =
      `<h3>${title}</h3>` +
      (ps.length
        ? ps
            .map(
              (p) => `<div class="pl sheet ${p.connected ? '' : 'off'}">
          <span class="em">${esc(p.emoji)}</span>
          <span class="nm">${esc(p.name)}</span>
          <span class="pts">${s.phase === 'lobby' ? '' : fmt(p.points)}</span>
          ${statusMark(p, s)}
        </div>`
            )
            .join('')
        : '<p class="soft">Ingen här än. Skanna koden med mobilen.</p>');
  }

  // ---------- bygg en ny skärm ----------
  function build(s) {
    switch (s.phase) {
      case 'lobby':
        return buildLobby(s);
      case 'countdown':
        stage.innerHTML = `<h1 class="big"><span class="mark">Nu kör vi!</span></h1>`;
        return;
      case 'warmup':
      case 'warmup-reveal':
        return buildWarmup(s);
      case 'segment-intro':
        return buildIntro(s);
      case 'bet':
        return buildBet(s);
      case 'round-ready':
        stage.innerHTML = `<div class="intro"><p class="kicker">${esc(s.segment.title)}</p><h1 class="round-h"><span class="mark">Omgång ${s.segment.index} av ${s.segment.count}</span></h1></div>`;
        return;
      case 'play':
        return buildPlay(s);
      case 'vote':
        return buildVote(s);
      case 'reveal':
        return buildReveal(s);
      case 'podium':
        return buildPodium(s);
      default:
        stage.innerHTML = '';
    }
  }

  function update(s) {
    if (s.phase === 'lobby') return buildLobby(s);
    if (s.phase === 'warmup') return buildWarmup(s);
    if (s.phase === 'play' && s.round && s.round.type === 'swipe') return updateSwipe(s);
    if (s.phase === 'play' && s.round && s.round.type === 'king') return buildPlay(s);
    if (s.phase === 'play' && s.round && s.round.type === 'pussel') return updatePussel(s);
    if (s.phase === 'play' && s.round && s.round.type === 'labyrint') return updateLabyrint(s);
    if (s.phase === 'play' && s.round && s.round.type === 'kanot') return updateKanot(s);
    if (s.phase === 'play' && s.round && s.round.type === 'bomb') return updateBomb(s);
    if (s.phase === 'vote') return buildVote(s);
    if (s.phase === 'reveal') {
      const w = stage.querySelector('.res .wait span');
      if (w) w.textContent = waitText(s);
    }
  }

  function buildLobby(s) {
    const n = s.players.filter((p) => p.connected).length;
    const ready = s.players.filter((p) => p.connected && p.status === 'ready').length;
    const host = s.joinUrl ? s.joinUrl.replace(/^https?:\/\//, '').replace(/\?.*$/, '') : '';
    let hint;
    const humans = s.players.filter((p) => p.connected && !p.bot).length;
    if (s.test && !humans) hint = 'Testläge: gå med från mobilen eller öppna länken under QR-koden i en ny flik.';
    else if (!s.test && n < 2) hint = 'Minst två spelare behövs. Spelet startar när alla har tryckt Redo.';
    else if (ready < n) hint = `${ready} av ${n} är redo. Spelet startar när alla har tryckt Redo.`;
    else hint = 'Alla är redo!';
    stage.innerHTML = `
      <div class="lobby">
        <div>
          <h1>Party<span class="mark">Party</span></h1>
          <p class="tag">Fredagskväll i soffan. Mobilen är din handkontroll.</p>
          <p class="how">Skanna koden med mobilen, eller gå till <strong>${esc(host)}</strong> och skriv rumskoden <b>${esc(s.code)}</b></p>
        </div>
        <div class="qr sheet">
          ${s.qr ? `<img src="${s.qr}" alt="QR-kod för att gå med i spelet">` : ''}
          <p>Gå med i spelet</p>
          ${s.test && s.joinUrl ? `<p><a class="test-link" href="${esc(s.joinUrl)}" target="_blank" rel="noopener">Öppna mobilvyn i ny flik</a></p>` : ''}
        </div>
        <p class="hint">${esc(hint)}</p>
      </div>`;
  }

  function buildWarmup(s) {
    const w = s.warmup;
    if (!w) return;
    const reveal = s.phase === 'warmup-reveal';
    const answered = s.players.filter((p) => p.status === 'done').length;
    stage.innerHTML = `
      <p class="sub soft">Uppvärmning, inga poäng. Svara i mobilen.</p>
      <p class="prompt">${esc(w.q)}</p>
      <div class="opts">${w.options
        .map(
          (o, i) =>
            `<div class="opt sheet ${reveal ? (i === w.correct ? 'right' : 'wrong') : ''}"><span class="k">${'ABCD'[i]}</span>${esc(o)}</div>`
        )
        .join('')}</div>
      <p class="sub">${reveal ? 'Så enkelt är det! Tryck Nästa i mobilen när ni är redo.' : `${answered} av ${s.players.length} har svarat`}</p>`;
  }

  function buildIntro(s) {
    const seg = s.segment;
    stage.innerHTML = `
      <div class="intro">
        <p class="kicker">Nästa del</p>
        <h1><span class="mark">${esc(seg.title)}</span></h1>
        <p class="n soft">${seg.count > 1 ? `${seg.count} omgångar` : 'En omgång'}. ${
          seg.type === 'final'
            ? 'Satsa före varje fråga.'
            : TEAM_GAMES.includes(seg.type)
              ? `Lagkamraterna delar på poängen. Vinnarlaget får ${(2 * s.players.length - 1) * 50} poäng var.`
              : `Etta får ${s.players.length * 100} poäng, sist får 100.`
        }</p>
        <ul>${seg.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        ${TEAM_GAMES.includes(seg.type) && s.round && s.round.teams ? `<div class="lab-teams">${s.round.teams.map((t) => teamChip(t, '', ROLE_LABELS[seg.type])).join('')}</div>` : ''}
      </div>`;
  }

  function buildBet(s) {
    const r = s.round || {};
    stage.innerHTML = `
      <div class="betting">
        <h1>Satsa!</h1>
        <p class="cat">Kategori <b><span class="mark">${esc(r.category)}</span></b></p>
        <p class="sub">Snabbast rätt svar får satsningen ×2 och sist ×0. Fel svar förlorar hela satsningen.</p>
      </div>`;
  }

  // ---------- spel ----------
  function buildPlay(s) {
    const r = s.round;
    if (!r) return;
    if (r.type === 'skiss') {
      stage.innerHTML = `<div class="sketch-wrap sheet" id="sk"></div><p class="sub">Vad är det här? Sätt din nål på kartan i mobilen.</p>`;
      sketch = createSketch($('#sk'), r.paths, r.transform);
      drawMs = r.drawMs;
      drawStart = performance.now() - r.drawElapsedMs;
      requestAnimationFrame(drawLoop);
    } else if (r.type === 'ordning') {
      stage.innerHTML = `
        <p class="prompt">Vilken kom först? Sortera från äldst till nyast i mobilen.</p>
        <div class="cards">${r.items.map((i) => `<div class="card sheet">${esc(i.name)}</div>`).join('')}</div>`;
    } else if (r.type === 'narmast') {
      stage.innerHTML = `
        <p class="prompt">${esc(r.q)}</p>
        <div class="line">${ticks()}</div>
        <p class="sub soft">Svaret ligger mellan 0 och 1000. Dra reglaget i mobilen och lås.</p>`;
    } else if (r.type === 'swipe') {
      stage.innerHTML = `
        <div class="lr"><div class="side">← ${esc(r.left)}</div><div class="vs">eller</div><div class="side">${esc(r.right)} →</div></div>
        <div class="bars" id="bars"></div>`;
      updateSwipe(s);
    } else if (r.type === 'pussel') {
      stage.innerHTML = `
        <div class="pz-stage">
          <div class="pz-big sheet"><svg viewBox="0 0 300 300">${r.svg}</svg></div>
          <div>
            <p class="prompt" style="font-size:3rem">Lägg pusslet i mobilen</p>
            <p class="sub">Snabbast löst vinner. Hinner ingen, vinner flest brickor på rätt plats.</p>
            <div class="bars" id="bars"></div>
          </div>
        </div>`;
      updatePussel(s);
    } else if (r.type === 'labyrint') {
      stage.innerHTML = `
        <div class="lab-wrap"><canvas id="maze"></canvas></div>
        <div class="lab-teams" id="labteams"></div>`;
      startLab($('#maze'), r);
      updateLabyrint(s);
    } else if (r.type === 'kanot') {
      stage.innerHTML = `
        <div class="lab-wrap"><canvas id="river"></canvas></div>
        <div class="lab-teams" id="labteams"></div>`;
      startKanot($('#river'), r);
      updateKanot(s);
    } else if (r.type === 'zoom') {
      stage.innerHTML = `
        <div class="zoom-stage">
          <div class="zoom-view sheet" id="zv"></div>
          <div><p class="prompt" style="font-size:3rem">Vilket djur är det?</p>
            <div class="opts one">${optsHtml(r.options)}</div>
            <p class="sub">Svara i mobilen. Tidigt rätt svar slår sent.</p></div>
        </div>`;
      startZoom($('#zv'), r, s.roundIndex);
    } else if (r.type === 'emoji') {
      stage.innerHTML = `
        <p class="kicker emo-cat"><span class="mark">${esc(r.category)}</span></p>
        <div class="emo-row" id="er">${r.imgs.map((f) => `<img src="/vendor/twemoji/${esc(f)}" alt="">`).join('')}</div>
        <div class="opts">${optsHtml(r.options)}</div>
        <p class="sub">Fler emojis kommer hela tiden. Svara i mobilen, tidigt rätt svar slår sent.</p>`;
      startEmoji($('#er'), r);
    } else if (r.type === 'bomb') {
      stage.innerHTML = `
        <div class="bomb-top"><span class="bomb-ico">💣</span><div><p class="prompt" style="font-size:3rem">Desarmera så många bomber ni hinner</p>
        <p class="sub">Den som klipper ser bomben. Den andra läser manualen. Ni byter efter varje bomb.</p></div></div>
        <div class="bomb-teams" id="bombteams"></div>`;
      updateBomb(s);
    } else if (r.type === 'king') {
      const done = s.players.filter((p) => p.connected && p.status === 'done').length;
      const n = s.players.filter((p) => p.connected).length;
      stage.innerHTML = `
        <p class="king-who"><span class="crown">👑</span> Kingen är <b>${esc(r.kingEmoji)} ${esc(r.kingName)}</b></p>
        <p class="prompt">${esc(r.prompt)}</p>
        <div class="king-rules">
          <div class="sheet"><b>${esc(r.kingName)}</b> skriver det hen tror att någon annan också skriver. <span class="ok">+100</span> per träff.</div>
          <div class="sheet"><b>Ni andra</b> skriver något som passar, men inte samma som kingen. Samma ger <span class="bad">−100</span>, annat <span class="ok">+100</span>. Passar det inte: <span class="bad">−100</span>.</div>
        </div>
        <p class="sub">${done} av ${n} har skrivit</p>`;
    } else if (r.type === 'final') {
      stage.innerHTML = `
        <p class="sub">${esc(r.category)}</p>
        <p class="prompt">${esc(r.q)}</p>
        <div class="opts">${r.options.map((o, i) => `<div class="opt sheet"><span class="k">${'ABCD'[i]}</span>${esc(o)}</div>`).join('')}</div>
        <p class="sub"><span data-seconds></span> sekunder kvar</p>`;
    }
  }

  // Kingen: alla röstar om svar som inte är exakt samma som kingens.
  function buildVote(s) {
    const r = s.round;
    if (!r) return;
    const done = s.players.filter((p) => p.connected && p.status === 'done').length;
    const n = s.players.filter((p) => p.connected).length;
    stage.innerHTML = `
      <p class="king-who"><span class="crown">👑</span> ${esc(r.kingName)} skrev</p>
      <h1 class="king-answer"><span class="mark">${esc(r.kingText)}</span></h1>
      <p class="sub">${esc(r.prompt)}</p>
      <p class="prompt" style="font-size:2.4rem">Är något samma sak? Passar alla svar uppmaningen?</p>
      <div class="cards">${r.candidates.map((c) => `<div class="card sheet">${esc(c.text)}</div>`).join('')}</div>
      <p class="sub">Rösta i mobilen. Majoriteten avgör. ${done} av ${n} har röstat.</p>`;
  }

  function drawLoop() {
    if (!sketch || drawStart == null) return;
    sketch.setProgress((performance.now() - drawStart) / drawMs);
    requestAnimationFrame(drawLoop);
  }

  // ---------- Labyrinten ----------
  const secs = (ms) => (ms / 1000).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const TEAM_GAMES = ['labyrint', 'kanot', 'bomb'];
  const ROLE_LABELS = { labyrint: ['↔', '↕'], kanot: ['vänster', 'höger'], bomb: ['', ''] };

  function teamChip(t, status = '', roles = ROLE_LABELS.labyrint, done = false) {
    const who = (m, label) => `<span class="${m.connected ? '' : 'gone'}">${esc(m.emoji)} ${esc(m.name)}${label ? ` <span class="ax">${label}</span>` : ''}</span>`;
    return `<div class="lab-team sheet ${done ? 'done' : ''}" style="--team:${esc(t.color)}">
      <span class="dot"></span><b>Lag ${esc(t.name)}</b>${who(t.x, roles[0])}${who(t.y, roles[1])}${status}</div>`;
  }

  function setHtml(el, html) {
    if (el && el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
  }

  // ---------- Zoomen och Emojigåtan ----------
  function optsHtml(options, correct = null, who = null) {
    return options
      .map(
        (o, i) =>
          `<div class="opt sheet ${correct == null ? '' : i === correct ? 'right' : 'wrong'}"><span class="k">${'ABCD'[i]}</span>${esc(o)}${who ? `<span class="who">${who(i)}</span>` : ''}</div>`
      )
      .join('');
  }

  // Bilden läggs in som SVG och zoomas genom att krympa viewBox, så att den är skarp hela vägen.
  const ZOOM_MAX = 14;
  async function startZoom(box, r, seed) {
    const me = (anim = {});
    let svgText;
    try {
      svgText = await (await fetch(`/vendor/twemoji/${r.img}`)).text();
    } catch {
      return;
    }
    if (anim !== me || !box.isConnected) return;
    box.innerHTML = svgText;
    const svg = box.querySelector('svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const focal = await focalPoint(svgText, seed);
    const start = performance.now() - (r.elapsedMs || 0);
    const loop = (now) => {
      if (anim !== me || !box.isConnected) return;
      const t = Math.min(1, (now - start) / r.zoomMs);
      const scale = Math.pow(ZOOM_MAX, 1 - t);
      const w = 36 / scale;
      const k = (w - 36 / ZOOM_MAX) / (36 - 36 / ZOOM_MAX);
      const cx = focal.x + (18 - focal.x) * k;
      const cy = focal.y + (18 - focal.y) * k;
      svg.setAttribute('viewBox', `${(cx - w / 2).toFixed(3)} ${(cy - w / 2).toFixed(3)} ${w.toFixed(3)} ${w.toFixed(3)}`);
      if (t < 1) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // En punkt på djuret där något händer (kant mellan färger, ett öga), inte en enfärgad yta.
  // Väljs med ett fast frö så att alla TV-flikar visar samma.
  function focalPoint(svgText, seed) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const N = 72;
        const c = document.createElement('canvas');
        c.width = c.height = N;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, N, N);
        const d = ctx.getImageData(0, 0, N, N).data;
        const at = (x, y) => (y * N + x) * 4;
        const solid = (x, y) => d[at(x, y) + 3] > 200;
        const diff = (x0, y0, x1, y1) => {
          const a = at(x0, y0);
          const b = at(x1, y1);
          return Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2]);
        };
        const pts = [];
        for (let y = 6; y < N - 6; y++)
          for (let x = 6; x < N - 6; x++) {
            // Mitt i djuret (helt täckt runt om) och med en färgskiftning i närheten.
            if (!(solid(x, y) && solid(x - 5, y) && solid(x + 5, y) && solid(x, y - 5) && solid(x, y + 5))) continue;
            const v = diff(x - 4, y, x + 4, y) + diff(x, y - 4, x, y + 4);
            if (v > 120) pts.push([x, y]);
          }
        if (!pts.length) return resolve({ x: 18, y: 18 });
        const p = pts[Math.floor(((Math.sin(seed * 9301 + 49297) + 1) / 2) * pts.length) % pts.length];
        resolve({ x: ((p[0] + 0.5) / N) * 36, y: ((p[1] + 0.5) / N) * 36 });
      };
      img.onerror = () => resolve({ x: 18, y: 18 });
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    });
  }

  function startEmoji(row, r) {
    const me = (anim = {});
    const imgs = [...row.querySelectorAll('img')];
    const start = performance.now() - (r.elapsedMs || 0);
    const loop = (now) => {
      if (anim !== me || !row.isConnected) return;
      const shown = Math.min(imgs.length, 1 + Math.floor((now - start) / r.stepMs));
      imgs.forEach((im, i) => im.classList.toggle('on', i < shown));
      if (shown < imgs.length) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---------- Kanotracet ----------
  function updateKanot(s) {
    const r = s.round;
    if (!kanot || !r.boats) return;
    kanot.round = r;
    setHtml(
      $('#labteams'),
      r.teams
        .map((t) => {
          const b = r.boats[t.id];
          const st = b.finished ? `<span class="st ok">🏁 ${secs(b.ms)} s</span>` : `<span class="st">${Math.round(b.x)} av ${r.length} m</span>`;
          return teamChip(t, st, ROLE_LABELS.kanot, b.finished);
        })
        .join('')
    );
  }

  function startKanot(canvas, round) {
    kanot = { canvas, round, disp: round.boats.map((b) => ({ ...b })), seen: round.boats.map((b) => ({ nL: b.nL, nR: b.nR })), splashes: [] };
    const me = kanot;
    let last = performance.now();
    const loop = (now) => {
      if (kanot !== me || !canvas.isConnected) return;
      const k = Math.min(1, ((now - last) / 1000) * 14);
      last = now;
      me.round.boats.forEach((b, i) => {
        const d = me.disp[i] || (me.disp[i] = { ...b });
        d.x += (b.x - d.x) * k;
        d.y += (b.y - d.y) * k;
        d.th += (b.th - d.th) * k;
        const seen = me.seen[i] || (me.seen[i] = { nL: b.nL, nR: b.nR });
        if (b.nL > seen.nL) me.splashes.push({ team: i, side: 'L', at: now });
        if (b.nR > seen.nR) me.splashes.push({ team: i, side: 'R', at: now });
        seen.nL = b.nL;
        seen.nR = b.nR;
      });
      me.splashes = me.splashes.filter((sp) => now - sp.at < 450);
      drawRiver(canvas, me, now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function drawRiver(canvas, st, now) {
    const r = st.round;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const n = r.teams.length;
    const gap = Math.min(16, H * 0.03);
    const laneH = Math.min((H - gap * (n - 1)) / n, H * 0.4);
    const top0 = (H - (laneH * n + gap * (n - 1))) / 2;
    const left = W * 0.02;
    const right = W * 0.96;
    const sx = (right - left) / r.length;
    const sy = (laneH * 0.36) / r.half;

    r.teams.forEach((t, i) => {
      const top = top0 + i * (laneH + gap);
      const mid = top + laneH / 2;
      // Vatten och strandkanter
      const g = ctx.createLinearGradient(0, top, 0, top + laneH);
      g.addColorStop(0, '#1d3a6b');
      g.addColorStop(0.5, '#25508f');
      g.addColorStop(1, '#1d3a6b');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(left, top, right - left + W * 0.02, laneH, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(79, 227, 176, 0.35)';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Vågor som rör sig
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 14; k++) {
        const wx = left + (((k * 97 + now * 0.03) % (right - left)) + (right - left)) % (right - left);
        const wy = top + laneH * (0.2 + ((k * 37) % 60) / 100);
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + 10, wy - 4, wx + 20, wy);
        ctx.stroke();
      }
      // Mållinje
      const cs = Math.max(6, laneH / 10);
      for (let row = 0; row * cs < laneH; row++) {
        for (let col = 0; col < 2; col++) {
          ctx.fillStyle = (row + col) % 2 ? '#f5f1ff' : '#15122e';
          ctx.fillRect(right + col * cs, top + row * cs, cs, Math.min(cs, top + laneH - (top + row * cs)));
        }
      }
      // Lagets namn
      ctx.fillStyle = t.color;
      ctx.font = `700 ${Math.max(14, laneH * 0.16)}px Figtree, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Lag ${t.name}  ${t.x.emoji}${t.y.emoji}`, left + 12, top + 8);

      // Kanoten
      const b = st.disp[t.id];
      if (!b) return;
      const cx = left + b.x * sx;
      const cy = mid + b.y * sy;
      const ang = Math.atan2(Math.sin(b.th) * sy, Math.cos(b.th) * sx);
      const len = Math.max(40, Math.min(laneH * 0.9, W * 0.07));
      const wid = len * 0.28;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      for (const sp of st.splashes.filter((x) => x.team === t.id)) {
        const age = (now - sp.at) / 450;
        const side = sp.side === 'L' ? -1 : 1;
        ctx.fillStyle = `rgba(200, 235, 255, ${0.8 * (1 - age)})`;
        ctx.beginPath();
        ctx.arc(-len * 0.1 - age * len * 0.3, side * (wid * 0.9 + age * wid * 0.6), wid * (0.25 + age * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.moveTo(len / 2, 0);
      ctx.quadraticCurveTo(0, -wid, -len / 2, 0);
      ctx.quadraticCurveTo(0, wid, len / 2, 0);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(21, 18, 46, 0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.3, wid * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${wid * 0.9}px system-ui, sans-serif`;
      ctx.fillText(t.x.emoji, cx - Math.cos(ang) * len * 0.15, cy - Math.sin(ang) * len * 0.15);
      ctx.fillText(t.y.emoji, cx + Math.cos(ang) * len * 0.15, cy + Math.sin(ang) * len * 0.15);
    });
  }

  // ---------- Bombdesarmeringen ----------
  function updateBomb(s) {
    const r = s.round;
    if (!r.progress) return;
    const byId = Object.fromEntries(r.teams.flatMap((t) => [t.x, t.y]).map((m) => [m.id, m]));
    setHtml(
      $('#bombteams'),
      r.teams
        .map((t) => {
          const pr = r.progress[t.id];
          const cutter = byId[pr.solo || pr.defuser];
          const reader = cutter && cutter.id === t.x.id ? t.y : t.x;
          const roles = pr.solo
            ? `${esc(cutter.emoji)} ${esc(cutter.name)} gör allt själv`
            : `${esc(cutter.emoji)} ${esc(cutter.name)} klipper · ${esc(reader.emoji)} ${esc(reader.name)} läser`;
          const fl = pr.flash ? (pr.flash.kind === 'ok' ? '<div class="bomb-flash ok">✅ Desarmerad!</div>' : '<div class="bomb-flash boom">💥 PANG!</div>') : '';
          return `<div class="bomb-card sheet ${pr.flash ? pr.flash.kind : ''}" style="--team:${esc(t.color)}">
            <div class="bh"><span class="dot"></span><b>Lag ${esc(t.name)}</b><span class="bn">Bomb ${pr.n}</span></div>
            <div class="bs"><span class="ok">✅ ${pr.defused}</span><span class="bad">💥 ${pr.booms}</span></div>
            <p class="who">${roles}</p>
            ${fl}
          </div>`;
        })
        .join('')
    );
  }

  function updateLabyrint(s) {
    const r = s.round;
    if (!lab || !r.balls) return;
    lab.round = r;
    const el = $('#labteams');
    if (el) {
      const html = r.teams
        .map((t) => {
          const b = r.balls[t.id];
          const st = b.finished ? `<span class="st ok">🏁 ${secs(b.ms)} s</span>` : `<span class="st">${b.left} steg kvar</span>`;
          return teamChip(t, st, ROLE_LABELS.labyrint, b.finished);
        })
        .join('');
      if (el.dataset.html !== html) {
        el.innerHTML = html;
        el.dataset.html = html;
      }
    }
  }

  function startLab(canvas, round) {
    lab = { canvas, round, disp: round.balls.map((b) => ({ x: b.x, y: b.y })) };
    const me = lab;
    let last = performance.now();
    const loop = (now) => {
      if (lab !== me || !canvas.isConnected) return;
      const k = Math.min(1, ((now - last) / 1000) * 18);
      last = now;
      me.round.balls.forEach((b, i) => {
        const d = me.disp[i] || (me.disp[i] = { x: b.x, y: b.y });
        d.x += (b.x - d.x) * k;
        d.y += (b.y - d.y) * k;
      });
      drawMaze(canvas, me.round, me.disp);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function drawMaze(canvas, r, disp) {
    const mz = r.maze;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cell = Math.min((W - 8) / mz.w, (H - 8) / mz.h);
    const ox = (W - cell * mz.w) / 2;
    const oy = (H - cell * mz.h) / 2;
    const X = (x) => ox + x * cell;
    const Y = (y) => oy + y * cell;

    // Golv, start och mål
    ctx.fillStyle = 'rgba(20, 16, 50, 0.85)';
    ctx.fillRect(X(0), Y(0), cell * mz.w, cell * mz.h);
    ctx.fillStyle = 'rgba(141, 125, 255, 0.16)';
    ctx.fillRect(X(mz.start.x), Y(mz.start.y), cell, cell);
    ctx.fillStyle = 'rgba(255, 181, 71, 0.22)';
    ctx.fillRect(X(mz.goal.x), Y(mz.goal.y), cell, cell);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${cell * 0.6}px system-ui, sans-serif`;
    ctx.fillText('🏁', X(mz.goal.x + 0.5), Y(mz.goal.y + 0.52));

    // Väggar som neonrör
    ctx.strokeStyle = '#a99bff';
    ctx.lineWidth = Math.max(2, cell * 0.1);
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(141, 125, 255, 0.9)';
    ctx.shadowBlur = cell * 0.25;
    ctx.beginPath();
    for (let y = 0; y < mz.h; y++) {
      for (let x = 0; x < mz.w; x++) {
        const c = mz.cells[y * mz.w + x];
        if (c & 1) { ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x + 1), Y(y)); }
        if (c & 8) { ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x), Y(y + 1)); }
        if (x === mz.w - 1 && c & 2) { ctx.moveTo(X(x + 1), Y(y)); ctx.lineTo(X(x + 1), Y(y + 1)); }
        if (y === mz.h - 1 && c & 4) { ctx.moveTo(X(x), Y(y + 1)); ctx.lineTo(X(x + 1), Y(y + 1)); }
      }
    }
    ctx.stroke();

    // Bollar. Varje lag förskjuts lite så att bollar på samma ställe syns var för sig.
    const n = r.teams.length;
    r.teams.forEach((t, i) => {
      const p = disp[i];
      if (!p) return;
      const a = (i / n) * Math.PI * 2;
      const off = n > 1 ? cell * 0.13 : 0;
      const cx = X(p.x) + Math.cos(a) * off;
      const cy = Y(p.y) + Math.sin(a) * off;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = cell * 0.5;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(cx - cell * 0.08, cy - cell * 0.09, cell * 0.08, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  function updatePussel(s) {
    const bars = $('#bars');
    if (!bars || !s.round) return;
    const pr = s.round.progress || {};
    bars.innerHTML = s.players
      .map((p) => {
        const x = pr[p.id] || { correct: 0 };
        const label = x.solved ? `<span class="ok">${(x.ms / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} s</span>` : `${x.correct}/8`;
        return `<div class="bar"><span class="em">${esc(p.emoji)}</span><span>${esc(p.name)}</span>
          <div class="track"><div class="fill ${x.solved ? 'done' : ''}" style="width:${x.solved ? 100 : (x.correct / 8) * 100}%"></div></div><span class="pts">${label}</span></div>`;
      })
      .join('');
  }

  function updateSwipe(s) {
    const bars = $('#bars');
    if (!bars || !s.round) return;
    const total = s.round.total || 20;
    const pr = s.round.progress || {};
    const startIn = s.round.startInMs || 0;
    bars.innerHTML =
      (startIn > 0 ? `<p class="prompt hand" style="text-align:center">Gör er redo…</p>` : '') +
      s.players
        .map((p) => {
          const x = pr[p.id] || { i: 0 };
          return `<div class="bar"><span class="em">${esc(p.emoji)}</span><span>${esc(p.name)}</span>
            <div class="track"><div class="fill" style="width:${(x.i / total) * 100}%"></div></div><span class="pts">${x.i}/${total}</span></div>`;
        })
        .join('');
  }

  function ticks() {
    return [0, 250, 500, 750, 1000].map((v) => `<span class="tick" style="left:${v / 10}%">${v}</span>`).join('') + '<div class="axis"></div>';
  }

  // ---------- avslöjande ----------
  function waitText(s) {
    const done = s.players.filter((p) => p.connected && p.status === 'done').length;
    const n = s.players.filter((p) => p.connected).length;
    return `Tryck Nästa i mobilen (${done} av ${n})`;
  }

  // Vad varje spelare svarade, i klartext för topplistan.
  function answerText(round, row) {
    const d = row.detail;
    if (!d || (round.type === 'final' && d.choice == null)) return '<span class="soft">Inget svar</span>';
    switch (round.type) {
      case 'skiss':
        return `${fmt(d.km)} km <span class="soft">· låst vid ${d.drawnPct} %</span>`;
      case 'ordning':
        return `${d.exact} av 5 på rätt plats`;
      case 'narmast':
        return d.dist === 0 ? `${d.value} <span class="ok">exakt!</span>` : `${d.value} <span class="soft">· ${d.dist} fel</span>`;
      case 'swipe':
        return `${d.correct} rätt, ${d.wrong} fel${d.answered < 20 ? ` <span class="soft">· hann ${d.answered}</span>` : ''}`;
      case 'pussel':
        return d.solved
          ? `Löst på ${(d.ms / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} s <span class="soft">· ${d.moves} drag</span>`
          : `${d.correct} av 8 rätt <span class="soft">· ej löst</span>`;
      case 'zoom':
      case 'emoji':
        return `${'ABCD'[d.choice]}. ${esc(round.options[d.choice])} ${d.right ? `<span class="ok">rätt</span>` : `<span class="bad">fel</span>`} <span class="soft">· ${(d.ms / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} s</span>`;
      case 'kanot':
      case 'bomb': {
        const t = round.teams[d.team];
        const mate = t ? [t.x, t.y].find((m) => m.id === d.mate) : null;
        const dot = t ? `<span class="tdot" style="background:${esc(t.color)}"></span>` : '';
        const res =
          round.type === 'bomb'
            ? `✅ ${d.defused} desarmerade <span class="soft">· 💥 ${d.booms}</span>`
            : d.finished
              ? `I mål på ${secs(d.ms)} s`
              : `${d.dist} av ${round.length} m`;
        return `${dot}${res}${mate ? ` <span class="soft">· med ${esc(mate.emoji)} ${esc(mate.name)}</span>` : ''}`;
      }
      case 'labyrint': {
        const t = round.teams[d.team];
        const mate = t ? [t.x, t.y].find((m) => m.id === d.mate) : null;
        const dot = t ? `<span class="tdot" style="background:${esc(t.color)}"></span>` : '';
        const res = d.finished ? `I mål på ${secs(d.ms)} s` : `${d.left} steg kvar`;
        return `${dot}${res}${mate ? ` <span class="soft">· med ${esc(mate.emoji)} ${esc(mate.name)}</span>` : ''}`;
      }
      case 'king': {
        if (d.verdict === 'king') return `<b>${esc(d.text || '–')}</b> <span class="soft">· 👑 kingen, ${d.same} träff${d.same === 1 ? '' : 'ar'}</span>`;
        const vote = d.voted && d.verdict !== 'invalid' ? ` <span class="soft">· ${d.voted.yes} av ${d.voted.n} sa samma</span>` : '';
        const tag =
          d.verdict === 'invalid'
            ? '<span class="bad">passar inte</span>'
            : d.verdict === 'same'
              ? '<span class="bad">samma</span>'
              : '<span class="ok">annat</span>';
        return `${esc(d.text)} <span class="soft">·</span> ${tag}${vote}`;
      }
      case 'final':
        return `${'ABCD'[d.choice]}. ${esc(round.options[d.choice])} <span class="soft">· ${(d.ms / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} s</span>`;
      default:
        return '';
    }
  }

  function resultTable(s) {
    const res = s.results;
    const isFinal = res.type === 'final';
    const rows = res.rows
      .map(
        (r, i, all) => `<tr class="row ${r.place === 1 && (!isFinal || (r.detail && r.detail.right)) ? 'first' : ''}" style="animation-delay:${(all.length - 1 - i) * 0.18}s">
          <td class="pl1">${isFinal && !(r.detail && r.detail.right) ? '<span class="bad">✗</span>' : `<span>${r.place}</span>`}</td>
          <td>${esc(r.emoji)} ${esc(r.name)}</td>
          <td class="ans">${answerText(s.round, r)}</td>
          ${isFinal ? `<td class="n">${fmt(r.bet)}</td><td class="n">${mult(r.multiplier)}</td>` : ''}
          <td class="d ${r.delta > 0 ? 'ok' : r.delta < 0 ? 'bad' : ''}">${signed(r.delta)}</td>
          <td class="tot">${fmt(r.after)}</td>
        </tr>`
      )
      .join('');
    return `<div class="res sheet">
      <table>
        <tr><th>${isFinal ? '' : 'Plats'}</th><th>Spelare</th><th>Svar</th>${isFinal ? '<th>Satsat</th><th></th>' : ''}<th style="text-align:right">Poäng</th><th style="text-align:right">Totalt</th></tr>
        ${rows}
      </table>
      <div class="wait"><span>${waitText(s)}</span><button class="quiet" id="next">Nästa</button></div>
    </div>`;
  }

  function buildReveal(s) {
    const r = s.round;
    let left = '';
    if (r.type === 'skiss') {
      left = `<h2><span class="mark">${esc(r.name)}</span></h2>
        <p class="fact">${esc(r.place)}. ${esc(r.fact)}</p>
        <div class="mapbox" id="map"></div>`;
    } else if (r.type === 'ordning') {
      left = `<h2>Rätt ordning</h2>
        <ol class="timeline">${r.correct
          .map((c) => `<li><span class="yr">${c.year}</span><span class="nm">${esc(c.name)}<span class="nt">${esc(c.note)}</span></span></li>`)
          .join('')}</ol>`;
    } else if (r.type === 'narmast') {
      const guesses = s.results.rows
        .filter((x) => x.detail)
        .map((x) => `<span class="guess" style="left:${x.detail.value / 10}%"><span class="em">${esc(x.emoji)}</span>${x.detail.value}</span>`)
        .join('');
      left = `<p class="sub">${esc(r.q)}</p>
        <h2>${fmt(r.answer)} ${esc(r.unit)}</h2>
        <div class="line">${ticks()}<span class="ans" style="left:${r.answer / 10}%"><b>${r.answer}</b></span>${guesses}</div>`;
    } else if (r.type === 'swipe') {
      const misses = (s.results.extra && s.results.extra.misses) || [];
      left = `<h2>Höger eller vänster</h2>
        <p class="sub">${esc(r.left)} eller ${esc(r.right)}</p>
        ${
          misses.length
            ? `<p class="fact">Lurigast den här gången: ${misses
                .map((m) => `<b>${esc(m.w)}</b> är ${m.side === 'L' ? esc(r.left).toLowerCase() : esc(r.right).toLowerCase()}`)
                .join(', ')}.</p>`
            : '<p class="fact">Ingen swipade fel!</p>'
        }`;
    } else if (r.type === 'pussel') {
      left = `<h2><span class="mark">${esc(r.name)}</span></h2>
        <div class="pz-big sheet" style="max-width:24rem"><svg viewBox="0 0 300 300">${r.svg}</svg></div>`;
    } else if (r.type === 'labyrint') {
      const order = [...r.balls].sort((a, b) => (a.finished !== b.finished ? (a.finished ? -1 : 1) : a.finished ? a.ms - b.ms : a.left - b.left));
      const best = order[0];
      const w = best && r.teams[best.team];
      const title = !w ? 'Labyrinten' : best.finished ? `Lag ${esc(w.name)} vann!` : `Ingen kom i mål`;
      const sub = !w ? '' : best.finished ? `I mål på ${secs(best.ms)} sekunder.` : `Lag ${esc(w.name)} kom närmast, ${best.left} steg kvar.`;
      left = `<h2><span class="mark">${title}</span></h2><p class="fact">${sub}</p>
        <div class="lab-wrap mini"><canvas id="maze"></canvas></div>`;
    } else if (r.type === 'zoom' || r.type === 'emoji') {
      const who = (i) =>
        s.results.rows
          .filter((x) => x.detail && x.detail.choice === i)
          .map((x) => esc(x.emoji))
          .join(' ');
      const pic =
        r.type === 'zoom'
          ? `<div class="zoom-view small sheet"><img src="/vendor/twemoji/${esc(r.img)}" alt=""></div>`
          : `<div class="emo-row small">${r.imgs.map((f) => `<img class="on" src="/vendor/twemoji/${esc(f)}" alt="">`).join('')}</div>`;
      left = `<h2><span class="mark">${esc(r.type === 'zoom' ? r.name : r.answer)}</span></h2>${pic}<div class="opts one">${optsHtml(r.options, r.correct, who)}</div>`;
    } else if (r.type === 'kanot') {
      const order = [...r.boats.map((b, i) => ({ ...b, team: i }))].sort((a, b) => (a.finished !== b.finished ? (a.finished ? -1 : 1) : a.finished ? a.ms - b.ms : b.x - a.x));
      const best = order[0];
      const w = best && r.teams[best.team];
      const title = !w ? 'Kanotracet' : best.finished ? `Lag ${esc(w.name)} vann!` : 'Ingen kom i mål';
      const sub = !w ? '' : best.finished ? `I mål på ${secs(best.ms)} sekunder.` : `Lag ${esc(w.name)} kom längst, ${Math.round(best.x)} av ${r.length} meter.`;
      left = `<h2><span class="mark">${title}</span></h2><p class="fact">${sub}</p>
        <div class="lab-wrap mini"><canvas id="river"></canvas></div>`;
    } else if (r.type === 'bomb') {
      const order = r.teams.map((t) => ({ t, pr: r.progress[t.id] })).sort((a, b) => b.pr.defused - a.pr.defused || a.pr.booms - b.pr.booms);
      const best = order[0];
      left = `<h2><span class="mark">${best && best.pr.defused ? `Lag ${esc(best.t.name)} vann!` : 'Pang överallt!'}</span></h2>
        <div class="bomb-teams col">${order
          .map(({ t, pr }) => `<div class="bomb-card sheet" style="--team:${esc(t.color)}"><div class="bh"><span class="dot"></span><b>Lag ${esc(t.name)}</b></div><div class="bs"><span class="ok">✅ ${pr.defused}</span><span class="bad">💥 ${pr.booms}</span></div></div>`)
          .join('')}</div>`;
    } else if (r.type === 'king') {
      left = `<p class="sub">${esc(r.prompt)}</p>
        <p class="king-who"><span class="crown">👑</span> ${esc(r.kingEmoji)} ${esc(r.kingName)} skrev</p>
        <h2><span class="mark">${esc(r.kingText || 'inget')}</span></h2>`;
    } else if (r.type === 'final') {
      const who = (i) =>
        s.results.rows
          .filter((x) => x.detail && x.detail.choice === i)
          .map((x) => esc(x.emoji))
          .join(' ');
      left = `<p class="sub">${esc(r.category)}</p><p class="prompt">${esc(r.q)}</p>
        <div class="opts">${r.options
          .map(
            (o, i) =>
              `<div class="opt sheet ${i === r.correct ? 'right' : 'wrong'}"><span class="k">${'ABCD'[i]}</span>${esc(o)}<span class="who">${who(i)}</span></div>`
          )
          .join('')}</div>`;
    }
    stage.innerHTML = `<div class="reveal"><div class="left">${left}</div>${resultTable(s)}</div>`;
    $('#next').addEventListener('click', () => socket.emit('host:next'));
    if (r.type === 'skiss') drawRevealMap(s);
    if (r.type === 'labyrint' && r.maze) startLab($('#maze'), r);
    if (r.type === 'kanot' && r.boats) startKanot($('#river'), r);
  }

  function drawRevealMap(s) {
    const r = s.round;
    // Markeringarna läggs på när länderna är ritade, så att de hamnar ovanpå.
    map = window.PP.worldMap('map', { zoomControl: false, onReady: (m) => addRevealMarks(m, s) });
  }

  function addRevealMarks(map, s) {
    const r = s.round;
    const target = [r.lat, r.lon];
    const pts = [target];
    L.circleMarker(target, { radius: 11, color: '#ffe9c4', weight: 3, fillColor: '#ffb547', fillOpacity: 1 })
      .addTo(map)
      .bindTooltip('⭐ ' + r.name, { permanent: true, direction: 'top', className: 'pin-label', offset: [0, -10] });
    for (const row of s.results.rows) {
      if (!row.detail) continue;
      const p = [row.detail.lat, row.detail.lon];
      pts.push(p);
      L.polyline([p, target], { color: '#ff6b7a', weight: 2, dashArray: '6 6' }).addTo(map);
      L.marker(p, {
        icon: L.divIcon({ className: '', html: `<div style="font-size:28px;line-height:1">${esc(row.emoji)}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
      })
        .addTo(map)
        // Med många spelare krockar lapparna; då står avståndet bara i topplistan.
        .bindTooltip(`${esc(row.name)}: ${fmt(row.detail.km)} km`, { permanent: s.results.rows.length <= 4, direction: 'right', className: 'pin-label', offset: [14, 0] });
    }
    setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 6 });
    }, 50);
  }

  function buildPodium(s) {
    const st = s.standings || [];
    const step = (p, i) =>
      p
        ? `<div class="step p${i + 1}"><div class="em">${esc(p.emoji)}</div><div class="nm">${esc(p.name)}</div><div class="pts">${fmt(p.points)}</div><div class="block sheet">${i + 1}</div></div>`
        : '';
    stage.innerHTML = `
      <h1 class="winner"><span class="mark">${st[0] ? esc(st[0].name) + ' vinner!' : 'Slut!'}</span></h1>
      <div class="podium">${step(st[1], 1)}${step(st[0], 0)}${step(st[2], 2)}</div>
      <div class="end-actions"><button id="again">Spela igen</button></div>`;
    $('#again').addEventListener('click', () => socket.emit('host:restart'));
  }
})();
