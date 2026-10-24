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

  socket.on('connect', () => {
    const saved = sessionStorage.getItem('pp-tv-room');
    socket.emit('host:hello', { code: saved, origin: location.origin }, ({ code }) => {
      sessionStorage.setItem('pp-tv-room', code);
    });
  });
  socket.on('state', (s) => {
    state = s;
    render();
  });

  // Enter, mellanslag eller pil höger går vidare när det går, praktiskt med fjärrkontroll eller tangentbord.
  document.addEventListener('keydown', (e) => {
    if (['Enter', ' ', 'ArrowRight'].includes(e.key)) {
      if (state && ['reveal', 'warmup-reveal', 'segment-intro'].includes(state.phase)) socket.emit('host:next');
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
  }

  function cleanup() {
    sketch = null;
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
    top.innerHTML = `<span class="logo">PartyParty</span>${seg}<span class="code">Rumskod <b>${esc(s.code)}</b></span>`;
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
    if (n < 2) hint = 'Minst två spelare behövs. Spelet startar när alla har tryckt Redo.';
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
          seg.type === 'final' ? 'Satsa före varje fråga.' : `Etta får ${s.players.length * 100} poäng, sist får 100.`
        }</p>
        <ul>${seg.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
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
    } else if (r.type === 'king') {
      const done = s.players.filter((p) => p.connected && p.status === 'done').length;
      const n = s.players.filter((p) => p.connected).length;
      stage.innerHTML = `
        <p class="king-who"><span class="crown">👑</span> Kingen är <b>${esc(r.kingEmoji)} ${esc(r.kingName)}</b></p>
        <p class="prompt">${esc(r.prompt)}</p>
        <div class="king-rules">
          <div class="sheet"><b>${esc(r.kingName)}</b> skriver det hen tror att någon annan också skriver. <span class="ok">+100</span> per träff.</div>
          <div class="sheet"><b>Ni andra</b> skriver något, men inte samma som kingen. Samma ger <span class="bad">−100</span>, annat ger <span class="ok">+100</span>.</div>
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
      <p class="prompt" style="font-size:2.4rem">Räknas något av de här som samma sak?</p>
      <div class="cards">${r.candidates.map((c) => `<div class="card sheet">${esc(c.text)}</div>`).join('')}</div>
      <p class="sub">Rösta i mobilen. Majoriteten avgör. ${done} av ${n} har röstat.</p>`;
  }

  function drawLoop() {
    if (!sketch || drawStart == null) return;
    sketch.setProgress((performance.now() - drawStart) / drawMs);
    requestAnimationFrame(drawLoop);
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
      case 'king': {
        if (d.verdict === 'king') return `<b>${esc(d.text || '–')}</b> <span class="soft">· 👑 kingen, ${d.same} träff${d.same === 1 ? '' : 'ar'}</span>`;
        const vote = d.voted ? ` <span class="soft">· röstat ${d.voted.yes}–${d.voted.no}</span>` : '';
        const tag = d.verdict === 'same' ? '<span class="bad">samma</span>' : '<span class="ok">annat</span>';
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
        .bindTooltip(`${esc(row.name)}: ${fmt(row.detail.km)} km`, { permanent: true, direction: 'right', className: 'pin-label', offset: [14, 0] });
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
