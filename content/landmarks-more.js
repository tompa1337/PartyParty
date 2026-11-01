// Fler skisser till Skissen. Samma format som landmarks.js: viewBox 0 0 400 300,
// strecken ritas i ordning, grova konturer först och tydliga detaljer sist.

const circle = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;

const waves = (y, x0 = 20, x1 = 380, step = 40) => {
  const out = [];
  for (let x = x0; x < x1; x += step) out.push(`M${x} ${y} q${step / 4} -5 ${step / 2} 0 q${step / 4} 5 ${step / 2} 0`);
  return out.join(' ');
};

// Symmetrisk trappstegsprofil kring cx. steps = [[halvbredd, y], …] nerifrån och upp.
const stepped = (cx, base, steps, tipY) => {
  const pts = [[cx - steps[0][0], base]];
  steps.forEach(([w, y], i) => {
    pts.push([cx - w, y]);
    if (i + 1 < steps.length) pts.push([cx - steps[i + 1][0], y]);
  });
  pts.push([cx, tipY]);
  for (let i = steps.length - 1; i >= 0; i--) {
    const [w, y] = steps[i];
    pts.push([cx + w, y]);
    pts.push([cx + w, i === 0 ? base : steps[i - 1][1]]);
    if (i > 0) pts.push([cx + steps[i - 1][0], steps[i - 1][1]]);
  }
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
};

// Lökkupol med kors, basen på (cx, y).
const onion = (cx, y, w, h) =>
  `M${cx - w / 2} ${y} Q${cx - w * 0.85} ${y - h * 0.45} ${cx} ${y - h} Q${cx + w * 0.85} ${y - h * 0.45} ${cx + w / 2} ${y} Z M${cx} ${y - h} L${cx} ${y - h - 12} M${cx - 4} ${y - h - 8} L${cx + 4} ${y - h - 8}`;

// Ränder på en lökkupol (som snurrar).
const swirl = (cx, y, w, h) =>
  [-0.3, 0, 0.3].map((k) => `M${cx + k * w - w * 0.2} ${y - 2} Q${cx + k * w + w * 0.25} ${y - h * 0.5} ${cx} ${y - h + 3}`).join(' ');

// Torn med spetsigt tak: rektangel från base upp till top, kon till tip.
const tower = (cx, w, base, top, tip) =>
  `M${cx - w / 2} ${base} L${cx - w / 2} ${top} L${cx + w / 2} ${top} L${cx + w / 2} ${base} M${cx - w / 2 - 3} ${top} L${cx} ${tip} L${cx + w / 2 + 3} ${top}`;

// En moaistaty, mitt på x, med huvudets topp på y0 och foten på 250.
const moai = (x, y0, s = 1) => {
  const w = 22 * s;
  return [
    `M${x - w} 250 L${x - w - 2} ${y0 + 46 * s} Q${x - w - 4} ${y0} ${x} ${y0} Q${x + w + 4} ${y0} ${x + w + 2} ${y0 + 46 * s} L${x + w} 250`,
    `M${x - w + 4} ${y0 + 26 * s} L${x + w - 4} ${y0 + 26 * s} M${x} ${y0 + 28 * s} L${x - 5 * s} ${y0 + 56 * s} L${x + 6 * s} ${y0 + 58 * s} M${x - 9 * s} ${y0 + 68 * s} L${x + 9 * s} ${y0 + 68 * s} M${x - w - 2} ${y0 + 30 * s} L${x - w - 7} ${y0 + 34 * s} L${x - w - 3} ${y0 + 64 * s} M${x + w + 2} ${y0 + 30 * s} L${x + w + 7} ${y0 + 34 * s} L${x + w + 3} ${y0 + 64 * s}`,
  ];
};

// Murkrön: små tänder längs en linje från (x0,y0) till (x1,y1).
const crenels = (x0, y0, x1, y1, n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = (i + 0.25) / n;
    const t1 = (i + 0.75) / n;
    const ax = x0 + (x1 - x0) * t0;
    const ay = y0 + (y1 - y0) * t0;
    const bx = x0 + (x1 - x0) * t1;
    const by = y0 + (y1 - y0) * t1;
    out.push(`M${ax.toFixed(1)} ${ay.toFixed(1)} L${ax.toFixed(1)} ${(ay - 7).toFixed(1)} L${bx.toFixed(1)} ${(by - 7).toFixed(1)} L${bx.toFixed(1)} ${by.toFixed(1)}`);
  }
  return out.join(' ');
};

// Fönsterrader: lodräta streck mellan x0 och x1, n stycken, från y0 till y1.
const windows = (x0, x1, y0, y1, n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
    out.push(`M${x.toFixed(1)} ${y0} L${x.toFixed(1)} ${y1}`);
  }
  return out.join(' ');
};

// Turning Torso: nio kuber som var och en är vriden lite mer än den under.
// Varje kub ritas som sidor plus ett snett "golv" ovanpå, så att vridningen syns.
const torso = () => {
  const n = 9;
  const R = 44;
  const blocks = [];
  const plates = [];
  const edges = [];
  const sp = [];
  for (let i = 0; i < n; i++) {
    const y0 = 272 - i * 26;
    const y1 = y0 - 24;
    const a = (i * 11 * Math.PI) / 180;
    const corners = [0, 1, 2, 3].map((k) => {
      const t = a + Math.PI / 4 + (k * Math.PI) / 2;
      return { x: 200 + R * Math.cos(t), z: Math.sin(t) };
    });
    const xs = corners.map((c) => c.x);
    const lo = Math.min(...xs).toFixed(1);
    const hi = Math.max(...xs).toFixed(1);
    blocks.push(`M${lo} ${y0} L${lo} ${y1} M${hi} ${y0} L${hi} ${y1}`);
    plates.push(corners.map((c, k) => `${k ? 'L' : 'M'}${c.x.toFixed(1)} ${(y1 + 7 * c.z).toFixed(1)}`).join(' ') + ' Z');
    const front = corners.reduce((m, c) => (c.z > m.z ? c : m));
    edges.push(`M${front.x.toFixed(1)} ${(y0 + 7 * front.z).toFixed(1)} L${front.x.toFixed(1)} ${(y1 + 7 * front.z).toFixed(1)}`);
    sp.push([Number(hi) + 12, y1]);
  }
  return {
    blocks: blocks.join(' '),
    plates: plates.join(' '),
    edges: edges.join(' '),
    spine: `M${sp[0][0].toFixed(1)} 272 ` + sp.map(([x, y]) => `L${x.toFixed(1)} ${y}`).join(' '),
  };
};
const TT = torso();

module.exports = [
  {
    id: 'towerbridge',
    name: 'Tower Bridge',
    place: 'London, Storbritannien',
    lat: 51.5055,
    lon: -0.0754,
    fact: 'Brons mitt kan fällas upp så att höga fartyg kommer förbi. Den öppnade 1894.',
    paths: [
      'M0 232 L400 232 M0 240 L400 240',
      'M112 262 L112 84 M148 262 L148 84 M252 262 L252 84 M288 262 L288 84',
      'M112 84 L130 44 L148 84 M252 84 L270 44 L288 84',
      'M148 98 L252 98 M148 110 L252 110',
      'M112 112 Q60 200 0 214 M288 112 Q340 200 400 214',
      'M106 84 L106 70 L112 62 L118 70 L118 84 M142 84 L142 70 L148 62 L154 70 L154 84 M246 84 L246 70 L252 62 L258 70 L258 84 M282 84 L282 70 L288 62 L294 70 L294 84',
      'M126 120 L126 140 Q130 134 134 140 L134 120 M266 120 L266 140 Q270 134 274 140 L274 120 M126 170 L126 190 Q130 184 134 190 L134 170 M266 170 L266 190 Q270 184 274 190 L274 170',
      'M130 44 L130 30 M270 44 L270 30',
      'M104 262 L156 262 M244 262 L296 262',
      waves(276, 10, 390, 44),
    ],
  },
  {
    id: 'brandenburg',
    name: 'Brandenburger Tor',
    place: 'Berlin, Tyskland',
    lat: 52.5163,
    lon: 13.3777,
    fact: 'Porten låg precis vid Berlinmuren och blev en symbol för när Tyskland enades igen 1990.',
    paths: [
      'M20 272 L380 272',
      'M64 272 L64 132 L336 132 L336 272',
      'M58 132 L342 132 L342 104 L58 104 Z',
      'M120 104 L120 88 L280 88 L280 104',
      'M78 268 L78 136 M90 268 L90 136 M124 268 L124 136 M136 268 L136 136 M170 268 L170 136 M182 268 L182 136 M218 268 L218 136 M230 268 L230 136 M264 268 L264 136 M276 268 L276 136 M310 268 L310 136 M322 268 L322 136',
      'M58 118 L342 118',
      'M166 88 Q170 70 180 66 L186 72 M182 88 Q186 70 196 66 L202 72 M204 88 Q208 70 218 66 L224 72 M220 88 Q224 70 234 66 L240 72',
      'M196 70 L198 44 M190 52 L206 50 M198 44 L210 34',
      'M10 272 L10 176 L58 176 M390 272 L390 176 L342 176',
    ],
  },
  {
    id: 'atomium',
    name: 'Atomium',
    place: 'Bryssel, Belgien',
    lat: 50.8949,
    lon: 4.3415,
    fact: 'Byggdes till världsutställningen 1958 och föreställer en järnkristall förstorad 165 miljarder gånger.',
    paths: [
      'M40 284 L360 284',
      'M200 256 L200 284 M119 189 L96 284 M281 189 L304 284',
      circle(119, 107, 17) + ' ' + circle(281, 107, 17) + ' ' + circle(119, 189, 17) + ' ' + circle(281, 189, 17),
      circle(200, 38, 17) + ' ' + circle(200, 256, 17),
      'M200 55 L200 131 M200 165 L200 239',
      'M186 48 L132 96 M214 48 L268 96 M132 200 L186 246 M268 200 L214 246',
      circle(200, 148, 17),
      'M119 124 L119 172 M281 124 L281 172 M134 118 L186 140 M266 118 L214 140 M134 178 L186 156 M266 178 L214 156',
      'M193 252 L207 252 M193 260 L207 260',
    ],
  },
  {
    id: 'turningtorso',
    name: 'Turning Torso',
    place: 'Malmö, Sverige',
    lat: 55.6133,
    lon: 12.9757,
    fact: 'Skyskrapan är 190 meter hög och vrider sig ett kvarts varv från botten till toppen.',
    paths: [
      'M20 272 L380 272',
      TT.blocks,
      TT.plates,
      TT.spine,
      TT.edges,
      'M40 272 L40 240 L90 240 L90 272 M310 272 L310 250 L360 250 L360 272',
      waves(288, 20, 380, 46),
    ],
  },
  {
    id: 'stadshuset',
    name: 'Stockholms stadshus',
    place: 'Stockholm, Sverige',
    lat: 59.3275,
    lon: 18.0543,
    fact: 'Här hålls Nobelfesten varje år. Tornet har Tre kronor i toppen.',
    paths: [
      'M10 252 L390 252',
      'M30 252 L30 160 L262 160 L262 252',
      'M26 160 L266 160 L246 140 L46 140 Z',
      'M262 252 L262 74 L310 74 L310 252',
      'M258 74 L314 74 L314 64 L258 64 Z',
      'M270 64 L270 46 L302 46 L302 64 M270 46 Q286 30 302 46',
      'M286 36 L286 14',
      'M278 16 L280 8 L283 13 L286 6 L289 13 L292 8 L294 16 Z M279 26 L281 18 L284 23 M288 23 L291 18 L293 26',
      'M58 252 L58 216 Q70 200 82 216 L82 252 M98 252 L98 216 Q110 200 122 216 L122 252 M138 252 L138 216 Q150 200 162 216 L162 252 M178 252 L178 216 Q190 200 202 216 L202 252',
      windows(40, 250, 172, 196, 14),
      'M276 100 L276 130 M296 100 L296 130 M276 160 L276 190 M296 160 L296 190',
      waves(270, 10, 390, 40),
      waves(288, 30, 370, 52),
    ],
  },
  {
    id: 'burj',
    name: 'Burj Khalifa',
    place: 'Dubai, Förenade Arabemiraten',
    lat: 25.1972,
    lon: 55.2744,
    fact: 'Världens högsta byggnad, 828 meter. Den är högre än två Empire State Building på varandra.',
    paths: [
      'M10 284 L390 284',
      stepped(200, 284, [[44, 236], [34, 192], [26, 150], [19, 112], [13, 78], [8, 50], [4, 32]], 4),
      'M200 284 L200 40',
      'M178 236 L178 192 M222 236 L222 192 M186 192 L186 150 M214 192 L214 150',
      'M30 284 L30 250 L70 250 L70 284 M80 284 L80 262 L120 262 L120 284 M280 284 L280 256 L318 256 L318 284 M330 284 L330 240 L370 240 L370 284',
      'M38 258 L38 280 M50 258 L50 280 M62 258 L62 280 M338 248 L338 280 M350 248 L350 280 M362 248 L362 280',
    ],
  },
  {
    id: 'petronas',
    name: 'Petronastornen',
    place: 'Kuala Lumpur, Malaysia',
    lat: 3.1579,
    lon: 101.7116,
    fact: 'Tvillingtornen var världens högsta byggnader 1998–2004 och binds ihop av en gångbro högt upp.',
    paths: [
      'M10 280 L390 280',
      stepped(130, 280, [[30, 130], [25, 100], [20, 78], [14, 62], [8, 50]], 14),
      stepped(270, 280, [[30, 130], [25, 100], [20, 78], [14, 62], [8, 50]], 14),
      'M160 168 L240 168 M160 176 L240 176',
      'M176 176 L200 220 L224 176',
      windows(102, 158, 140, 276, 7),
      windows(242, 298, 140, 276, 7),
      'M110 120 L150 120 M250 120 L290 120 M114 92 L146 92 M254 92 L286 92',
    ],
  },
  {
    id: 'spaceneedle',
    name: 'Space Needle',
    place: 'Seattle, USA',
    lat: 47.6205,
    lon: -122.3493,
    fact: 'Tornet byggdes till världsutställningen 1962 och har en restaurang högst upp.',
    paths: [
      'M20 280 L380 280',
      'M150 280 Q196 180 188 104 M250 280 Q204 180 212 104 M184 280 Q198 190 192 104 M216 280 Q202 190 208 104',
      'M130 92 Q200 70 270 92 L246 104 L154 104 Z',
      'M154 104 Q200 112 246 104',
      'M176 70 L224 70 L230 82 L170 82 Z M180 70 Q200 58 220 70',
      'M200 58 L200 6',
      'M166 230 L234 230 M178 160 L222 160',
      'M150 94 L150 100 M170 90 L170 102 M190 88 L190 103 M210 88 L210 103 M230 90 L230 102 M250 94 L250 100',
    ],
  },
  {
    id: 'stonehenge',
    name: 'Stonehenge',
    place: 'Wiltshire, England',
    lat: 51.1789,
    lon: -1.8262,
    fact: 'Stencirkeln restes för omkring 4 500 år sedan, och ingen vet säkert varför.',
    paths: [
      'M0 246 Q200 236 400 248',
      'M60 244 L62 156 L92 154 L94 244 M128 242 L126 140 L160 138 L162 242',
      'M54 156 L166 140 L168 124 L56 140 Z',
      'M220 242 L222 150 L252 148 L254 242 M290 244 L288 160 L322 162 L320 244',
      'M214 150 L326 160 L328 146 L216 136 Z',
      'M180 244 L182 196 L204 194 L206 244 M350 246 L356 196 L380 200 L376 246',
      'M20 248 L60 252 L58 262 L18 258 Z',
      'M74 170 L80 230 M140 160 L146 220 M234 170 L238 230 M300 180 L306 230',
    ],
  },
  {
    id: 'moai',
    name: 'Moaistatyerna',
    place: 'Påskön, Chile',
    lat: -27.1258,
    lon: -109.2767,
    fact: 'Det finns nästan 1 000 sådana stenstatyer på den lilla ön mitt i Stilla havet.',
    paths: [
      'M10 262 L390 262 M20 250 L380 250 L380 262',
      moai(80, 120)[0] + ' ' + moai(160, 104)[0],
      moai(240, 112)[0] + ' ' + moai(320, 124)[0],
      moai(80, 120)[1] + ' ' + moai(160, 104)[1],
      moai(240, 112)[1] + ' ' + moai(320, 124)[1],
      waves(282, 10, 390, 46),
      'M300 60 Q320 44 346 54 Q368 44 384 60 Z',
    ],
  },
  {
    id: 'fuji',
    name: 'Fuji',
    place: 'Honshu, Japan',
    lat: 35.3606,
    lon: 138.7274,
    fact: 'Fuji är en vulkan på 3 776 meter. Senaste utbrottet var 1707.',
    paths: [
      'M0 250 L150 104 Q200 92 250 104 L400 250',
      'M150 104 L132 124 L148 120 L160 138 L176 122 L198 140 L218 122 L234 136 L250 120 L268 124 L250 104',
      circle(330, 60, 20),
      'M40 286 L40 200 M100 286 L100 200 M30 200 L110 200 M36 210 L104 210',
      'M24 196 Q70 186 116 196',
      'M0 286 L400 286',
      'M300 200 Q312 188 326 196 Q338 184 352 196 Q366 190 372 204 Q350 212 300 200 Z',
    ],
  },
  {
    id: 'kinesiskamuren',
    name: 'Kinesiska muren',
    place: 'Kina',
    lat: 40.4319,
    lon: 116.5704,
    fact: 'Muren är tusentals kilometer lång, men det är en myt att den syns från rymden med blotta ögat.',
    paths: [
      'M0 150 Q60 110 120 140 T240 120 T400 150',
      'M0 230 L70 186 L140 214 L210 168 L280 196 L400 150',
      'M0 246 L70 202 L140 230 L210 184 L280 212 L400 166',
      'M60 192 L60 160 L82 160 L82 192 M200 172 L200 140 L222 140 L222 172 M330 172 L330 140 L352 140 L352 172',
      crenels(0, 230, 60, 192, 4) + ' ' + crenels(82, 190, 140, 214, 4) + ' ' + crenels(140, 214, 200, 172, 4),
      crenels(222, 174, 280, 196, 4) + ' ' + crenels(280, 196, 330, 170, 3) + ' ' + crenels(352, 168, 400, 150, 3),
      'M56 160 L86 160 L86 154 L56 154 Z M196 140 L226 140 L226 134 L196 134 Z M326 140 L356 140 L356 134 L326 134 Z',
      'M66 186 L66 176 Q71 170 76 176 L76 186 M206 166 L206 156 Q211 150 216 156 L216 166 M336 166 L336 156 Q341 150 346 156 L346 166',
      'M0 286 Q100 260 200 280 T400 270',
    ],
  },
  {
    id: 'triumfbagen',
    name: 'Triumfbågen',
    place: 'Paris, Frankrike',
    lat: 48.8738,
    lon: 2.295,
    fact: 'Napoleon beställde bågen 1806. Under den ligger den okände soldatens grav.',
    paths: [
      'M20 272 L380 272',
      'M100 272 L100 72 L300 72 L300 272',
      'M162 272 L162 168 Q200 112 238 168 L238 272',
      'M94 72 L306 72 L306 58 L94 58 Z',
      'M96 112 L304 112 M96 120 L304 120',
      'M100 72 L100 42 L300 42 L300 72',
      'M110 140 L150 140 L150 220 L110 220 Z M250 140 L290 140 L290 220 L250 220 Z',
      'M118 160 Q130 150 142 160 M118 180 Q130 170 142 180 M258 160 Q270 150 282 160 M258 180 Q270 170 282 180',
      'M100 272 L100 252 L162 252 M238 252 L300 252 L300 272',
      'M200 120 L200 112',
    ],
  },
  {
    id: 'vasilij',
    name: 'Vasilijkatedralen',
    place: 'Moskva, Ryssland',
    lat: 55.7525,
    lon: 37.6231,
    fact: 'Katedralen med de färgglada lökkupolerna byggdes på 1500-talet vid Röda torget.',
    paths: [
      'M20 272 L380 272',
      'M60 272 L60 196 L340 196 L340 272',
      'M180 196 L180 108 L220 108 L220 196 M176 108 L200 40 L224 108',
      'M88 196 L88 150 L132 150 L132 196 M268 196 L268 150 L312 150 L312 196 M146 196 L146 130 L170 130 L170 196 M230 196 L230 130 L254 130 L254 196',
      onion(110, 150, 40, 44) + ' ' + onion(290, 150, 40, 44),
      onion(158, 130, 28, 36) + ' ' + onion(242, 130, 28, 36) + ' ' + onion(200, 40, 18, 22),
      swirl(110, 150, 40, 44) + ' ' + swirl(290, 150, 40, 44),
      swirl(158, 130, 28, 36) + ' ' + swirl(242, 130, 28, 36),
      'M184 272 L184 236 Q200 220 216 236 L216 272 M76 240 L76 220 Q86 210 96 220 L96 240 M304 240 L304 220 Q314 210 324 220 L324 240',
    ],
  },
  {
    id: 'neuschwanstein',
    name: 'Neuschwanstein',
    place: 'Bayern, Tyskland',
    lat: 47.5576,
    lon: 10.7498,
    fact: 'Sagoslottet byggdes av kung Ludvig II av Bayern och inspirerade Disneys Törnrosaslott.',
    paths: [
      'M0 120 L60 60 L120 110 L190 40 L260 100 L320 50 L400 110',
      'M0 290 Q60 250 110 236 L300 236 Q350 250 400 290',
      'M120 236 L120 150 L250 150 L250 236',
      tower(270, 34, 236, 110, 60),
      tower(110, 22, 236, 130, 96) + ' ' + tower(200, 18, 150, 96, 62),
      tower(160, 14, 150, 112, 88) + ' ' + tower(236, 12, 150, 120, 98),
      'M120 150 L140 128 L230 128 L250 150',
      windows(128, 244, 170, 190, 9) + ' ' + windows(128, 244, 204, 222, 9),
      'M262 130 L262 146 M278 130 L278 146 M262 170 L262 186 M278 170 L278 186',
      'M270 60 L270 50 M110 96 L110 88 M200 62 L200 54',
    ],
  },
  {
    id: 'empirestate',
    name: 'Empire State Building',
    place: 'New York, USA',
    lat: 40.7484,
    lon: -73.9857,
    fact: 'Skyskrapan byggdes på bara drygt ett år och stod klar 1931.',
    paths: [
      'M10 282 L390 282',
      stepped(200, 282, [[56, 214], [44, 120], [34, 82], [24, 66], [14, 50], [8, 36]], 6),
      'M200 36 L200 6',
      windows(146, 254, 124, 210, 8),
      windows(168, 232, 86, 118, 5),
      'M20 282 L20 200 L80 200 L80 282 M320 282 L320 180 L384 180 L384 282',
      'M30 210 L70 210 M30 230 L70 230 M30 250 L70 250 M330 194 L374 194 M330 214 L374 214 M330 234 L374 234',
      'M260 282 L260 236 L300 236 L300 282 M100 282 L100 246 L140 246 L140 282',
    ],
  },
  {
    id: 'globen',
    name: 'Globen',
    place: 'Stockholm, Sverige',
    lat: 59.2936,
    lon: 18.0831,
    fact: 'Globen, som i dag heter Avicii Arena, är världens största klotformade byggnad.',
    paths: [
      'M10 262 L390 262',
      'M175 262 A105 105 0 1 1 225 262',
      'M108 110 Q200 124 292 110 M95 160 Q200 178 305 160 M108 210 Q200 226 292 210',
      'M200 55 Q140 160 182 262 M200 55 Q260 160 218 262 M200 55 Q90 150 140 240 M200 55 Q310 150 260 240',
      'M200 55 Q232 46 262 70',
      circle(232, 50, 7),
      'M30 262 L30 228 L74 228 L74 262 M330 262 L330 218 L372 218 L372 262',
      'M38 238 L66 238 M38 250 L66 250 M338 230 L364 230 M338 244 L364 244',
    ],
  },
  {
    id: 'oresundsbron',
    name: 'Öresundsbron',
    place: 'Mellan Malmö och Köpenhamn',
    lat: 55.5754,
    lon: 12.8264,
    fact: 'Bron öppnade år 2000 och har bilväg ovanpå och järnväg under.',
    paths: [
      'M0 196 L400 196 M0 206 L400 206',
      'M128 262 L128 56 M144 262 L144 56 M256 262 L256 56 M272 262 L272 56',
      'M136 70 L30 196 M136 90 L60 196 M136 110 L90 196 M136 70 L242 196 M136 90 L212 196 M136 110 L182 196',
      'M264 70 L370 196 M264 90 L340 196 M264 110 L310 196 M264 70 L158 196 M264 90 L188 196 M264 110 L218 196',
      'M128 150 L144 150 M256 150 L272 150',
      'M20 206 L20 262 M70 206 L70 262 M330 206 L330 262 M380 206 L380 262',
      'M20 186 L60 186 L60 196 M96 186 L136 186',
      waves(276, 10, 390, 44),
    ],
  },
];
