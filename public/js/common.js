// Delade hjälpfunktioner för TV och mobil.
(function () {
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // Klocka: servern skickar hur många ms som återstår, vi räknar ner lokalt.
  const clock = {
    endsAt: null,
    total: null,
    set(remainingMs, key) {
      if (remainingMs == null) {
        this.endsAt = null;
        this.total = null;
        this.key = key;
        return;
      }
      const endsAt = performance.now() + remainingMs;
      if (this.key !== key) this.total = remainingMs;
      this.key = key;
      this.endsAt = endsAt;
    },
    left() {
      return this.endsAt == null ? null : Math.max(0, this.endsAt - performance.now());
    },
    frac() {
      const l = this.left();
      return l == null || !this.total ? 0 : l / this.total;
    },
  };

  // Uppdatera alla element med data-timer (stapel) och data-seconds (siffror) varje bildruta.
  function tick() {
    const l = clock.left();
    document.querySelectorAll('[data-timer] > i').forEach((el) => {
      el.style.transform = `scaleX(${l == null ? 0 : clock.frac()})`;
    });
    document.querySelectorAll('[data-seconds]').forEach((el) => {
      el.textContent = l == null ? '' : Math.ceil(l / 1000);
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Blyertsskiss: ritar stråkarna i ordning. setProgress(0..1) styr hur mycket som syns.
  function createSketch(container, paths, transform) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 400 300');
    svg.setAttribute('class', 'sketch');
    svg.innerHTML = `
      <defs>
        <filter id="pencil" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>`;
    const g = document.createElementNS(NS, 'g');
    if (transform) g.setAttribute('transform', transform);
    g.setAttribute('filter', 'url(#pencil)');
    svg.appendChild(g);
    container.innerHTML = '';
    container.appendChild(svg);

    // Två lager per streck: ett mörkt huvudstreck och ett ljusare, lite förskjutet, som ger blyertskänsla.
    const strokes = [];
    paths.forEach((d) => {
      const ghost = document.createElementNS(NS, 'path');
      ghost.setAttribute('d', d);
      ghost.setAttribute('class', 'ghost');
      ghost.setAttribute('transform', 'translate(0.9 0.7)');
      const main = document.createElementNS(NS, 'path');
      main.setAttribute('d', d);
      main.setAttribute('class', 'main');
      g.appendChild(ghost);
      g.appendChild(main);
      strokes.push({ ghost, main });
    });
    const lengths = strokes.map((s) => s.main.getTotalLength() || 1);
    const total = lengths.reduce((a, b) => a + b, 0);
    strokes.forEach((s, i) => {
      for (const el of [s.ghost, s.main]) {
        el.style.strokeDasharray = `${lengths[i]} ${lengths[i]}`;
        el.style.strokeDashoffset = lengths[i];
      }
    });

    function setProgress(p) {
      let drawn = Math.max(0, Math.min(1, p)) * total;
      strokes.forEach((s, i) => {
        const len = lengths[i];
        const show = Math.max(0, Math.min(len, drawn));
        drawn -= len;
        const off = len - show;
        s.main.style.strokeDashoffset = off;
        s.ghost.style.strokeDashoffset = off;
      });
    }
    setProgress(0);
    return { svg, setProgress };
  }

  // Egen världskarta utan kartbilder från nätet: länderna ritas från en fil som följer med appen.
  let worldPromise = null;
  function loadWorld() {
    if (!worldPromise) {
      worldPromise = fetch('/vendor/world/countries-50m.json')
        .then((r) => r.json())
        .then((topo) => {
          const geo = topojson.feature(topo, topo.objects.countries);
          // Antarktis tas bort (inga platser där), och länder som korsar datumlinjen
          // (Ryssland, Fiji) räknas om så att de inte ritar streck tvärs över kartan.
          geo.features = geo.features.filter((f) => f.id !== '010' && f.geometry);
          const unwrapRing = (ring) => {
            let shift = 0;
            return ring.map((pt, i) => {
              if (i > 0) {
                const prev = ring[i - 1][0];
                if (pt[0] - prev > 180) shift -= 360;
                else if (prev - pt[0] > 180) shift += 360;
              }
              return [pt[0] + shift, pt[1]];
            });
          };
          for (const f of geo.features) {
            const g = f.geometry;
            if (g.type === 'Polygon') g.coordinates = g.coordinates.map(unwrapRing);
            if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map((poly) => poly.map(unwrapRing));
          }
          return geo;
        });
    }
    return worldPromise;
  }

  function worldMap(el, opts = {}) {
    const map = L.map(el, {
      preferCanvas: true,
      zoomControl: opts.zoomControl !== false,
      attributionControl: false,
      minZoom: 1,
      maxZoom: 9,
      zoomSnap: 0.25,
      maxBounds: [[-88, -200], [88, 200]],
      maxBoundsViscosity: 0.8,
      worldCopyJump: false,
    });
    map.getContainer().style.background = '#16123a';
    map.setView([30, 10], 1);
    L.polyline([[0, -180], [0, 180]], { color: '#3a3378', weight: 1, dashArray: '4 6', interactive: false }).addTo(map);
    loadWorld().then((geo) => {
      L.geoJSON(geo, {
        interactive: false,
        style: { color: '#7a6fd0', weight: 0.7, fillColor: '#2c2660', fillOpacity: 1 },
      }).addTo(map);
      if (opts.onReady) opts.onReady(map);
    });
    return map;
  }

  const fmt = (n) => Math.round(n).toLocaleString('sv-SE');
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
  const mult = (m) => '×' + (Math.round(m * 100) / 100).toLocaleString('sv-SE');

  window.PP = { esc, clock, createSketch, fmt, signed, mult, worldMap, loadWorld };
})();
