(function () {
  const { esc, clock, fmt, signed, mult } = window.PP;
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const meEl = $('#me');
  const timerEl = $('#timer');
  const socket = io();

  const EMOJIS = ['🦊', '🐼', '🐸', '🦄', '🐙', '🦁', '🐧', '🐝', '🦖', '🐢', '🦉', '🐳'];
  const params = new URLSearchParams(location.search);
  const urlCode = (params.get('rum') || '').toUpperCase();

  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem('pp-player') || 'null');
  } catch {
    saved = null;
  }
  let joined = false;
  let state = null;
  let screenKey = null;
  let ui = {}; // tillstånd för den aktuella skärmen (karta, swipe och så vidare)

  // ---------- anslutning ----------
  socket.on('connect', () => {
    if (saved && saved.playerId && (!urlCode || urlCode === saved.code)) join(saved.code, saved.name, saved.emoji, saved.playerId, true);
    else if (!joined) showJoin();
  });
  socket.on('state', (s) => {
    state = s;
    render();
  });

  function join(code, name, emoji, playerId, silent) {
    socket.emit('player:join', { code, name, emoji, playerId }, (res) => {
      if (res.error) {
        if (silent) {
          localStorage.removeItem('pp-player');
          saved = null;
          return showJoin();
        }
        const e = $('#err');
        if (e) e.textContent = res.error;
        return;
      }
      joined = true;
      saved = { code: res.code, playerId: res.playerId, name, emoji };
      localStorage.setItem('pp-player', JSON.stringify(saved));
      if (urlCode !== res.code) history.replaceState(null, '', `/spela?rum=${res.code}`);
    });
  }

  function showJoin() {
    screenKey = 'join';
    meEl.innerHTML = '<span class="hand title-sm">PartyParty</span>';
    timerEl.classList.remove('on');
    let emoji = (saved && saved.emoji) || EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    app.innerHTML = `
      <h1 class="title"><span class="mark">Gå med</span></h1>
      <div><label for="code">Rumskod</label><input id="code" class="code" type="text" maxlength="4" autocomplete="off" value="${esc(urlCode || (saved && saved.code) || '')}"></div>
      <div><label for="name">Ditt namn</label><input id="name" type="text" maxlength="16" autocomplete="nickname" value="${esc((saved && saved.name) || '')}"></div>
      <div><label>Välj figur</label><div class="emojis">${EMOJIS.map((e) => `<button type="button" data-e="${e}" class="${e === emoji ? 'on' : ''}">${e}</button>`).join('')}</div></div>
      <p class="err" id="err"></p>
      <button class="full" id="go">Gå med</button>`;
    app.querySelectorAll('.emojis button').forEach((b) =>
      b.addEventListener('click', () => {
        emoji = b.dataset.e;
        app.querySelectorAll('.emojis button').forEach((x) => x.classList.toggle('on', x === b));
      })
    );
    $('#go').addEventListener('click', () => {
      const code = $('#code').value.trim().toUpperCase();
      const name = $('#name').value.trim();
      if (code.length !== 4) return ($('#err').textContent = 'Rumskoden har fyra bokstäver. Den står på TV:n.');
      if (!name) return ($('#err').textContent = 'Skriv ditt namn så att de andra vet vem du är.');
      join(code, name, emoji, null, false);
    });
    if (!urlCode) $('#code').focus();
  }

  // ---------- rendering ----------
  function render() {
    const s = state;
    if (!s || !s.me) return;
    const key = `${s.phase}:${s.roundIndex}`;
    clock.set(s.remainingMs, key);
    timerEl.classList.toggle('on', s.remainingMs != null && !['lobby', 'podium', 'countdown', 'segment-intro'].includes(s.phase));
    meEl.innerHTML = `<span class="em">${esc(s.me.emoji)}</span><span class="nm">${esc(s.me.name)}</span>${
      s.phase === 'lobby' ? '' : `<span class="pts">${fmt(s.me.points)}</span>`
    }`;
    if (key !== screenKey) {
      screenKey = key;
      teardown();
      build(s);
    } else {
      update(s);
    }
  }

  function teardown() {
    if (ui.map) ui.map.remove();
    if (ui.sortable) ui.sortable.destroy();
    if (ui.raf) cancelAnimationFrame(ui.raf);
    if (ui.timeouts) ui.timeouts.forEach(clearTimeout);
    ui = { timeouts: [] };
  }

  function build(s) {
    switch (s.phase) {
      case 'lobby':
        return buildLobby(s);
      case 'countdown':
        app.innerHTML = `<div class="center"><h1 class="title">Nu kör vi!</h1><p class="lead">Titta på TV:n.</p></div>`;
        return;
      case 'warmup':
      case 'warmup-reveal':
        return buildWarmup(s);
      case 'segment-intro':
        app.innerHTML = `<div class="center"><p class="lead soft">Nästa del</p><h1 class="title"><span class="mark">${esc(s.segment.title)}</span></h1>
          <p class="lead">${s.segment.rules.map(esc).join('. ')}.</p><p class="soft">Snart dags att satsa.</p></div>`;
        return;
      case 'bet':
        return buildBet(s);
      case 'play':
        return buildPlay(s);
      case 'reveal':
        return buildReveal(s);
      case 'podium':
        return buildPodium(s);
      default:
        app.innerHTML = '';
    }
  }

  function update(s) {
    if (s.phase === 'lobby') return buildLobby(s);
    if (s.phase === 'reveal' || s.phase === 'warmup-reveal') {
      const b = $('#next');
      if (b && s.me.pressedNext) {
        b.disabled = true;
        b.textContent = 'Väntar på de andra…';
      }
    }
  }

  function waitingScreen(title, text) {
    app.innerHTML = `<div class="center"><h1 class="title-sm">${title}</h1><p class="lead">${text}</p></div>`;
  }

  // ---------- lobby ----------
  function buildLobby(s) {
    const others = s.players.filter((p) => p.id !== s.me.id);
    app.innerHTML = `
      <div class="center">
        <p class="lead">Du är med i rum <b class="hand" style="font-size:30px">${esc(s.code)}</b></p>
      </div>
      <button class="ready-btn ${s.me.ready ? 'is-ready' : ''}" id="ready">${s.me.ready ? '✓ Redo! (tryck för att ångra)' : 'Jag är redo'}</button>
      <p class="soft" style="text-align:center">Spelet startar när alla har tryckt Redo. Minst två spelare.</p>
      <div class="others">${others
        .map((p) => `<span class="chip sheet ${p.status === 'ready' ? 'done' : ''}">${esc(p.emoji)} ${esc(p.name)}</span>`)
        .join('')}</div>
      <button class="quiet" id="leave" style="margin-top:auto">Byt namn eller rum</button>`;
    $('#ready').addEventListener('click', () => socket.emit('player:ready', { ready: !s.me.ready }));
    $('#leave').addEventListener('click', () => {
      localStorage.removeItem('pp-player');
      location.href = '/spela';
    });
  }

  // ---------- uppvärmning ----------
  function buildWarmup(s) {
    const w = s.warmup;
    const reveal = s.phase === 'warmup-reveal';
    app.innerHTML = `
      <p class="soft">Uppvärmning, inga poäng</p>
      <p class="lead"><b>${esc(w.q)}</b></p>
      <div class="opts-phone">${w.options
        .map((o, i) => {
          let c = '';
          if (reveal) c = i === w.correct ? 'right' : 'wrong';
          else if (w.myChoice === i) c = 'picked';
          return `<button data-i="${i}" class="${c}" ${reveal || w.myChoice != null ? 'disabled' : ''}>${'ABCD'[i]}. ${esc(o)}</button>`;
        })
        .join('')}</div>
      ${
        reveal
          ? `<p class="lead">${w.myChoice === w.correct ? '<b class="ok">Rätt!</b>' : 'Inte riktigt, men nu vet du hur det funkar.'}</p><button class="full" id="next">Nästa</button>`
          : w.myChoice != null
            ? '<p class="lead">Svar skickat. Så här svarar du hela kvällen.</p>'
            : ''
      }`;
    app.querySelectorAll('.opts-phone button').forEach((b) =>
      b.addEventListener('click', () => {
        socket.emit('player:answer', { choice: Number(b.dataset.i) });
        b.classList.add('picked');
        app.querySelectorAll('.opts-phone button').forEach((x) => (x.disabled = true));
      })
    );
    const n = $('#next');
    if (n) n.addEventListener('click', () => pressNext(n));
    if (s.me.pressedNext) update(s);
  }

  function pressNext(btn) {
    socket.emit('player:next');
    btn.disabled = true;
    btn.textContent = 'Väntar på de andra…';
  }

  // ---------- satsning ----------
  function buildBet(s) {
    const r = s.round || {};
    const lim = s.betLimits || { min: 0, max: 0 };
    if (s.myBet != null) return waitingScreen(`Du satsade ${fmt(s.myBet)}`, 'Väntar på att de andra ska satsa.');
    const isFinal = r.type === 'final';
    let amount = isFinal ? Math.min(100, lim.max) : Math.max(lim.min, Math.round(lim.max * 0.25));
    const step = lim.max - lim.min > 200 ? 10 : 1;
    app.innerHTML = `
      <h1 class="title"><span class="mark">Satsa</span></h1>
      ${isFinal ? `<p class="lead">Kategori: <b>${esc(r.category)}</b></p>` : `<p class="lead">${esc(s.segment.title)}. Bäst får satsningen ×2, sist förlorar den.</p>`}
      <div class="bet-amount pts" id="amt">${fmt(amount)}</div>
      <input type="range" id="rng" min="${lim.min}" max="${lim.max}" step="${step}" value="${amount}" aria-label="Satsning">
      <div class="quick">
        <button data-q="min">${isFinal ? 'Inget' : 'Minst'}</button>
        <button data-q="0.25">25 %</button>
        <button data-q="0.5">Hälften</button>
        <button data-q="max">${isFinal ? 'Max' : 'Allt'}</button>
      </div>
      <p class="soft">Du kan satsa ${fmt(lim.min)}–${fmt(lim.max)} poäng.</p>
      <button class="full" id="bet" style="margin-top:auto">Satsa ${fmt(amount)}</button>`;
    const setAmt = (v) => {
      amount = Math.max(lim.min, Math.min(lim.max, Math.round(v)));
      $('#amt').textContent = fmt(amount);
      $('#rng').value = amount;
      $('#bet').textContent = `Satsa ${fmt(amount)}`;
    };
    $('#rng').addEventListener('input', (e) => setAmt(Number(e.target.value)));
    app.querySelectorAll('.quick button').forEach((b) =>
      b.addEventListener('click', () => {
        const q = b.dataset.q;
        if (q === 'min') setAmt(lim.min);
        else if (q === 'max') setAmt(lim.max);
        else setAmt(Math.max(lim.min, (s.me.points * Number(q))));
      })
    );
    $('#bet').addEventListener('click', () => {
      socket.emit('player:bet', { amount });
      waitingScreen(`Du satsade ${fmt(amount)}`, 'Väntar på att de andra ska satsa.');
    });
  }

  // ---------- spel ----------
  function buildPlay(s) {
    const r = s.round;
    if (!r) return;
    const a = s.myAnswer;
    if (a && a.locked && r.type !== 'swipe') return lockedScreen(r, a);
    if (r.type === 'skiss') return playSkiss(s);
    if (r.type === 'ordning') return playOrdning(s);
    if (r.type === 'narmast') return playNarmast(s);
    if (r.type === 'swipe') return playSwipe(s);
    if (r.type === 'final') return playFinal(s);
  }

  function lockedScreen(r, a) {
    let txt = 'Väntar på de andra.';
    if (r.type === 'final') txt = `Du svarade ${'ABCD'[a.choice]}. Väntar på de andra.`;
    if (r.type === 'narmast') txt = `Ditt svar: ${a.value}. Väntar på de andra.`;
    waitingScreen('Låst!', txt);
  }

  function playSkiss(s) {
    const r = s.round;
    app.innerHTML = `
      <p class="lead" style="margin:0">Titta på TV:n. Var ligger platsen?</p>
      <div class="mapwrap"><div class="map" id="map"></div><div class="maphint" id="hint">Tryck på kartan för att sätta din nål</div></div>
      <button class="full" id="lock" disabled>Lås nålen</button>`;
    const map = L.map('map', { worldCopyJump: true, zoomControl: true, attributionControl: true, minZoom: 1 }).setView([30, 10], 1);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd',
      maxZoom: 18,
    }).addTo(map);
    ui.map = map;
    let marker = null;
    let pos = null;
    map.on('click', (e) => {
      pos = e.latlng.wrap();
      if (marker) marker.setLatLng(e.latlng);
      else
        marker = L.marker(e.latlng, {
          icon: L.divIcon({ className: '', html: `<div style="font-size:34px;line-height:1;transform:translate(-2px,-6px)">📍</div>`, iconSize: [34, 34], iconAnchor: [17, 34] }),
        }).addTo(map);
      $('#lock').disabled = false;
      $('#hint').textContent = 'Flytta nålen genom att trycka igen';
      socket.emit('player:answer', { lat: pos.lat, lon: pos.lng, lock: false });
    });
    $('#lock').addEventListener('click', () => {
      if (!pos) return;
      socket.emit('player:answer', { lat: pos.lat, lon: pos.lng, lock: true });
      const pct = Math.min(100, Math.round(((r.drawElapsedMs + (performance.now() - ui.t0)) / r.drawMs) * 100));
      waitingScreen('Låst!', `Du låste när ungefär ${pct} % av teckningen syntes.`);
      teardownMapOnly();
    });
    ui.t0 = performance.now();
    setTimeout(() => map.invalidateSize(), 60);
  }

  function teardownMapOnly() {
    if (ui.map) {
      ui.map.remove();
      ui.map = null;
    }
  }

  function playOrdning(s) {
    const r = s.round;
    const items = s.myAnswer && s.myAnswer.order ? s.myAnswer.order.map((id) => r.items.find((i) => i.id === id)) : r.items;
    app.innerHTML = `
      <p class="lead" style="margin:0"><b>Dra i ordning, äldst överst</b></p>
      <div class="axis-label"><span>Äldst ↑</span></div>
      <ul class="sortlist" id="list">${items
        .map((i, n) => `<li class="sheet" data-id="${esc(i.id)}"><span class="num">${n + 1}</span><span class="grow">${esc(i.name)}</span><span class="grip">☰</span></li>`)
        .join('')}</ul>
      <div class="axis-label"><span>Nyast ↓</span></div>
      <button class="full" id="lock" style="margin-top:auto">Klar</button>`;
    const list = $('#list');
    const order = () => [...list.children].map((li) => li.dataset.id);
    const renumber = () => [...list.children].forEach((li, n) => (li.querySelector('.num').textContent = n + 1));
    ui.sortable = Sortable.create(list, {
      animation: 150,
      ghostClass: 'ghosting',
      chosenClass: 'chosen',
      delay: 0,
      onEnd: () => {
        renumber();
        socket.emit('player:answer', { order: order(), lock: false });
      },
    });
    socket.emit('player:answer', { order: order(), lock: false });
    $('#lock').addEventListener('click', () => {
      socket.emit('player:answer', { order: order(), lock: true });
      waitingScreen('Klart!', 'Väntar på de andra.');
    });
  }

  function playNarmast(s) {
    const r = s.round;
    let v = s.myAnswer ? s.myAnswer.value : 500;
    app.innerHTML = `
      <p class="lead" style="margin:0"><b>${esc(r.q)}</b></p>
      <div class="value pts" id="val">${v}</div>
      <input type="range" id="rng" min="0" max="1000" step="1" value="${v}" aria-label="Ditt svar">
      <div class="axis-label"><span>0</span><span>500</span><span>1000</span></div>
      <div class="nudge"><button data-d="-10">−10</button><button data-d="-1">−1</button><button data-d="1">+1</button><button data-d="10">+10</button></div>
      <button class="full" id="lock" style="margin-top:auto">Lås ${v}</button>`;
    let sendT = null;
    const set = (x) => {
      v = Math.max(0, Math.min(1000, Math.round(x)));
      $('#val').textContent = v;
      $('#rng').value = v;
      $('#lock').textContent = `Lås ${v}`;
      clearTimeout(sendT);
      sendT = setTimeout(() => socket.emit('player:answer', { value: v, lock: false }), 250);
    };
    $('#rng').addEventListener('input', (e) => set(Number(e.target.value)));
    app.querySelectorAll('.nudge button').forEach((b) => b.addEventListener('click', () => set(v + Number(b.dataset.d))));
    $('#lock').addEventListener('click', () => {
      clearTimeout(sendT);
      socket.emit('player:answer', { value: v, lock: true });
      waitingScreen('Låst!', `Ditt svar: ${v}. Väntar på de andra.`);
    });
  }

  function playFinal(s) {
    const r = s.round;
    app.innerHTML = `
      <p class="soft" style="margin:0">${esc(r.category)} · du satsade ${fmt(s.myBet || 0)}</p>
      <p class="lead"><b>${esc(r.q)}</b></p>
      <div class="opts-phone">${r.options.map((o, i) => `<button data-i="${i}">${'ABCD'[i]}. ${esc(o)}</button>`).join('')}</div>
      <p class="count"><span data-seconds></span> s</p>`;
    app.querySelectorAll('.opts-phone button').forEach((b) =>
      b.addEventListener('click', () => {
        socket.emit('player:answer', { choice: Number(b.dataset.i) });
        waitingScreen('Låst!', `Du svarade ${'ABCD'[Number(b.dataset.i)]}. Väntar på de andra.`);
      })
    );
  }

  // Höger eller vänster: mobilen visar nästa ord direkt och servern rättar i bakgrunden.
  function playSwipe(s) {
    const r = s.round;
    const words = r.words || [];
    const st = r.progress || { i: 0, finished: false };
    if (st.finished) return waitingScreen('Klar!', 'Väntar på de andra.');
    let i = st.i;
    let lockedUntil = 0;
    const startAt = performance.now() + Math.max(0, r.startInMs);
    const endAt = startAt + r.durationMs;

    app.innerHTML = `
      <div class="count" id="cnt"></div>
      <div class="swipe-area"><div class="word-card sheet" id="card"></div></div>
      <div class="sides"><button id="L">← ${esc(r.left)}</button><button id="R">${esc(r.right)} →</button></div>`;
    const card = $('#card');
    const cnt = $('#cnt');

    const showWord = () => {
      if (i >= words.length) {
        waitingScreen('Klar!', 'Väntar på de andra.');
        return;
      }
      card.textContent = words[i];
      card.style.transform = '';
    };

    const loop = () => {
      const now = performance.now();
      if (now < startAt) {
        card.textContent = Math.ceil((startAt - now) / 1000);
        cnt.textContent = 'Gör dig redo';
      } else {
        if (card.dataset.started !== '1') {
          card.dataset.started = '1';
          showWord();
        }
        const left = Math.max(0, endAt - now);
        cnt.textContent = `${i}/${words.length} · ${Math.ceil(left / 1000)} s`;
        card.classList.toggle('locked', now < lockedUntil);
        if (left <= 0) return;
      }
      ui.raf = requestAnimationFrame(loop);
    };
    ui.raf = requestAnimationFrame(loop);

    const go = (dir) => {
      const now = performance.now();
      if (now < startAt || now > endAt || now < lockedUntil || i >= words.length) return;
      const idx = i;
      socket.emit('player:swipe', { i: idx, dir }, (res) => {
        if (res && res.correct === false) {
          lockedUntil = performance.now() + 1000;
          card.classList.remove('shake');
          void card.offsetWidth;
          card.classList.add('shake');
          if (navigator.vibrate) navigator.vibrate(120);
        }
      });
      i++;
      card.style.transition = 'transform .15s';
      card.style.transform = `translateX(${dir === 'R' ? 120 : -120}%) rotate(${dir === 'R' ? 8 : -8}deg)`;
      ui.timeouts.push(
        setTimeout(() => {
          card.style.transition = '';
          showWord();
        }, 150)
      );
    };

    $('#L').addEventListener('click', () => go('L'));
    $('#R').addEventListener('click', () => go('R'));

    // Svep med fingret.
    let x0 = null;
    card.addEventListener('pointerdown', (e) => {
      x0 = e.clientX;
      card.setPointerCapture(e.pointerId);
    });
    card.addEventListener('pointermove', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
    });
    const release = (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 70) go(dx > 0 ? 'R' : 'L');
      else card.style.transform = '';
    };
    card.addEventListener('pointerup', release);
    card.addEventListener('pointercancel', release);
  }

  // ---------- resultat ----------
  function buildReveal(s) {
    const r = s.round;
    const res = s.myResult;
    const isFinal = r.type === 'final';
    let what = '';
    if (res && res.detail) {
      const d = res.detail;
      if (r.type === 'skiss') what = `${esc(r.name)}. Du var ${fmt(d.km)} km bort.`;
      if (r.type === 'ordning') what = `${d.score} av 150 poäng i ordningen.`;
      if (r.type === 'narmast') what = `Rätt svar: ${r.answer}. Du svarade ${d.value}.`;
      if (r.type === 'swipe') what = `${d.correct} rätt och ${d.wrong} fel.`;
      if (r.type === 'final') what = d.right ? 'Rätt svar!' : `Fel. Rätt svar var ${'ABCD'[r.correct]}. ${esc(r.options[r.correct])}.`;
    } else {
      what = r.type === 'final' ? `Inget svar. Rätt svar var ${esc(r.options[r.correct])}.` : 'Inget svar den här gången.';
    }
    const n = s.players.length;
    app.innerHTML = `
      <div class="center">
        ${isFinal ? '' : `<p class="lead">Plats ${res ? res.place : n} av ${n}</p>`}
        <div class="result-big pts ${res && res.delta > 0 ? 'ok' : res && res.delta < 0 ? 'bad' : ''}">${res ? signed(res.delta) : '±0'}</div>
        <p class="lead">${what}</p>
      </div>
      <div class="facts">
        <div class="fact-box sheet"><b>${res ? fmt(res.bet) : 0}</b><span>satsat${isFinal ? '' : ` · ${res ? mult(res.multiplier) : ''}`}</span></div>
        <div class="fact-box sheet"><b>${s.myPlace || '–'}</b><span>plats totalt</span></div>
      </div>
      <button class="full" id="next" style="margin-top:auto">Nästa</button>`;
    $('#next').addEventListener('click', () => pressNext($('#next')));
    if (s.me.pressedNext) update(s);
  }

  function buildPodium(s) {
    const st = s.standings || [];
    const place = st.findIndex((x) => x.id === s.me.id) + 1;
    app.innerHTML = `<div class="center">
      <p class="lead">Slutställning</p>
      <div class="result-big pts">${place}:${place <= 2 ? 'a' : 'e'}</div>
      <p class="lead">${place === 1 ? '<span class="mark">Du vann!</span>' : `med ${fmt(s.me.points)} poäng`}</p>
      <p class="soft">Starta en ny omgång från TV:n.</p></div>`;
  }
})();
