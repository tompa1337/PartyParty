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


// Ett ansikte i berget (Mount Rushmore). x, y = mitten av ansiktet.
const face = (x, y, s = 1, beard = false) => {
  const w = 24 * s;
  const h = 40 * s;
  return {
    head: `M${x - w} ${y - h * 0.2} Q${x - w} ${y - h} ${x} ${y - h} Q${x + w} ${y - h} ${x + w} ${y - h * 0.2} Q${x + w * 0.9} ${y + h * 0.75} ${x} ${y + h * 0.85} Q${x - w * 0.9} ${y + h * 0.75} ${x - w} ${y - h * 0.2}`,
    features: `M${x - w * 0.6} ${y - h * 0.3} L${x - w * 0.15} ${y - h * 0.28} M${x + w * 0.15} ${y - h * 0.28} L${x + w * 0.6} ${y - h * 0.3} M${x - w * 0.5} ${y - h * 0.15} q${w * 0.15} ${-h * 0.06} ${w * 0.3} 0 M${x + w * 0.2} ${y - h * 0.15} q${w * 0.15} ${-h * 0.06} ${w * 0.3} 0 M${x} ${y - h * 0.25} L${x - w * 0.12} ${y + h * 0.15} L${x + w * 0.1} ${y + h * 0.18} M${x - w * 0.35} ${y + h * 0.38} Q${x} ${y + h * 0.46} ${x + w * 0.35} ${y + h * 0.38}`,
    beard: beard ? `M${x - w * 0.85} ${y + h * 0.1} Q${x - w * 0.5} ${y + h * 0.9} ${x} ${y + h * 0.95} Q${x + w * 0.5} ${y + h * 0.9} ${x + w * 0.85} ${y + h * 0.1}` : '',
  };
};

// Enkla bokstäver av streck, w × h, nedre vänstra hörnet på (x, y).
const LETTERS = {
  H: (w, h) => `M0 0 L0 ${-h} M${w} 0 L${w} ${-h} M0 ${-h / 2} L${w} ${-h / 2}`,
  O: (w, h) => `M${w / 2} 0 Q0 0 0 ${-h / 2} Q0 ${-h} ${w / 2} ${-h} Q${w} ${-h} ${w} ${-h / 2} Q${w} 0 ${w / 2} 0`,
  L: (w, h) => `M0 ${-h} L0 0 L${w * 0.85} 0`,
  Y: (w, h) => `M0 ${-h} L${w / 2} ${-h * 0.45} L${w} ${-h} M${w / 2} ${-h * 0.45} L${w / 2} 0`,
  W: (w, h) => `M0 ${-h} L${w * 0.22} 0 L${w / 2} ${-h * 0.65} L${w * 0.78} 0 L${w} ${-h}`,
  D: (w, h) => `M0 0 L0 ${-h} Q${w} ${-h} ${w} ${-h / 2} Q${w} 0 0 0`,
};
const word = (text, x0, y0, x1, y1, w, h) =>
  [...text].map((ch, i) => {
    const t = i / (text.length - 1);
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    return LETTERS[ch](w, h).replace(/([ML]|Q)([-\d. ]+)/g, (m, cmd, nums) => {
      const n = nums.trim().split(/\s+/).map(Number);
      const out = [];
      for (let k = 0; k < n.length; k += 2) out.push(`${(n[k] + x).toFixed(1)} ${(n[k + 1] + y).toFixed(1)}`);
      return `${cmd}${out.join(' ')} `;
    }).trim();
  });

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
    id: 'rushmore',
    name: 'Mount Rushmore',
    place: 'South Dakota, USA',
    lat: 43.8791,
    lon: -103.4591,
    fact: 'Fyra presidenter är huggna i berget: Washington, Jefferson, Roosevelt och Lincoln. Varje ansikte är runt 18 meter högt.',
    paths: [
      'M0 200 Q40 120 70 90 Q120 50 200 56 Q280 50 330 80 Q370 110 400 170',
      'M0 280 Q60 250 120 262 T260 254 T400 270',
      face(92, 140, 1.05).head + ' ' + face(162, 130, 1.05).head,
      face(232, 150, 0.95).head + ' ' + face(306, 140, 1.1).head,
      face(92, 140, 1.05).features + ' ' + face(162, 130, 1.05).features,
      face(232, 150, 0.95).features + ' ' + face(306, 140, 1.1).features + ' ' + face(306, 140, 1.1, true).beard,
      'M216 142 L248 142 M220 137 Q226 131 232 137 Q238 131 244 137',
      'M30 260 L40 230 L50 260 M60 266 L72 232 L84 266 M330 262 L342 228 L354 262 M360 266 L370 238 L380 266',
    ],
  },
  {
    id: 'louvren',
    name: 'Louvren',
    place: 'Paris, Frankrike',
    lat: 48.8606,
    lon: 2.3376,
    fact: 'Glaspyramiden byggdes 1989 som ny entré till världens mest besökta konstmuseum, där Mona Lisa hänger.',
    paths: [
      'M0 262 L400 262',
      'M0 196 L0 120 L400 120 L400 196',
      'M0 120 L20 100 L380 100 L400 120 M170 100 L180 74 L220 74 L230 100',
      'M110 262 L200 140 L290 262 Z',
      'M200 140 L200 262 M155 201 L245 201 M132 232 L268 232',
      'M178 170 L222 170 M200 140 L155 262 M200 140 L245 262 M200 140 L132 262 M200 140 L268 262',
      'M40 262 L60 236 L80 262 M320 262 L340 236 L360 262',
      windows(10, 390, 136, 160, 22) + ' ' + windows(10, 390, 172, 192, 22),
    ],
  },
  {
    id: 'hollywood',
    name: 'Hollywoodskylten',
    place: 'Los Angeles, USA',
    lat: 34.1341,
    lon: -118.3215,
    fact: 'Skylten sattes upp 1923 som reklam för ett bostadsområde och stod först på HOLLYWOODLAND.',
    paths: [
      'M0 250 Q20 214 40 200 L340 150 Q372 150 400 196',
      'M0 290 Q120 260 200 278 T400 268',
      ...(() => {
        // Bokstäverna står på stolpar längs sluttningen. Sista bokstäverna gör det solklart.
        const ls = word('HOLLYWOOD', 40, 186, 312, 141, 26, 42);
        const legs = Array.from({ length: 9 }, (_, i) => {
          const x = 40 + (272 * i) / 8;
          const y = 186 - (45 * i) / 8;
          return `M${(x + 6).toFixed(1)} ${y.toFixed(1)} L${(x + 6).toFixed(1)} ${(y + 12).toFixed(1)} M${(x + 20).toFixed(1)} ${y.toFixed(1)} L${(x + 20).toFixed(1)} ${(y + 12).toFixed(1)}`;
        }).join(' ');
        return [legs, ls.slice(0, 2).join(' '), ls.slice(2, 4).join(' '), ls.slice(4, 6).join(' '), ls.slice(6, 9).join(' ')];
      })(),
    ],
  },
  {
    id: 'chichenitza',
    name: 'Chichén Itzá',
    place: 'Yucatán, Mexiko',
    lat: 20.6843,
    lon: -88.5678,
    fact: 'Vid vår- och höstdagjämning ser skuggorna ut som en orm som kryper nerför trappan.',
    paths: [
      'M0 270 L400 270',
      'M50 270 L66 252 L82 252 L96 234 L110 234 L124 216 L138 216 L150 198 L160 198 L170 180 L174 162 M350 270 L334 252 L318 252 L304 234 L290 234 L276 216 L262 216 L250 198 L240 198 L230 180 L226 162',
      'M174 162 L226 162',
      'M66 252 L334 252 M96 234 L304 234 M124 216 L276 216 M150 198 L250 198 M170 180 L230 180',
      'M180 162 L180 122 L220 122 L220 162 M176 122 L224 122 L224 114 L176 114 Z',
      'M182 270 L188 162 M218 270 L212 162',
      'M184 256 L216 256 M185 240 L215 240 M186 224 L214 224 M187 208 L213 208 M188 192 L212 192 M188 176 L212 176',
      'M192 162 L192 140 L208 140 L208 162',
      'M10 270 Q20 240 34 262 Q40 236 50 266 M360 266 Q370 236 380 262 Q388 240 396 270',
    ],
  },
  {
    id: 'parthenon',
    name: 'Parthenon',
    place: 'Aten, Grekland',
    lat: 37.9715,
    lon: 23.7267,
    fact: 'Templet byggdes åt gudinnan Athena på Akropolis för nästan 2 500 år sedan.',
    paths: [
      'M0 290 Q50 250 90 236 L310 236 Q352 250 400 290',
      'M70 236 L330 236 M76 226 L324 226 M82 216 L318 216',
      'M88 216 L88 132 M100 216 L100 132 M118 216 L118 132 M130 216 L130 132 M148 216 L148 132 M160 216 L160 132 M178 216 L178 132 M190 216 L190 132',
      'M210 216 L210 132 M222 216 L222 132 M240 216 L240 132 M252 216 L252 132 M270 216 L270 132 M282 216 L282 132 M300 216 L300 132 M312 216 L312 132',
      'M80 132 L320 132 L320 112 L80 112 Z',
      'M80 112 L200 76 L250 91 M290 103 L320 112',
      'M80 124 L320 124',
      'M250 91 L262 100 L274 96 L290 103',
    ],
  },
  {
    id: 'marinabay',
    name: 'Marina Bay Sands',
    place: 'Singapore',
    lat: 1.2834,
    lon: 103.8607,
    fact: 'Tre hotelltorn bär upp ett "skepp" 200 meter upp med en pool som ser ut att sluta i tomma luften.',
    paths: [
      'M0 250 L400 250',
      'M90 250 L96 82 M126 250 L116 82 M180 250 L186 82 M216 250 L206 82 M270 250 L276 82 M306 250 L296 82',
      'M96 82 L116 82 M186 82 L206 82 M276 82 L296 82',
      'M60 68 L360 68 Q378 64 392 56 L392 70 Q378 76 360 78 L60 78 Z',
      'M80 68 L80 60 L84 56 L88 60 L88 68 M120 68 L120 60 L124 56 L128 60 L128 68 M160 68 L160 60 L164 56 L168 60 L168 68 M240 68 L240 60 L244 56 L248 60 L248 68 M330 68 L330 60 L334 56 L338 60 L338 68',
      windows(96, 116, 100, 240, 3) + ' ' + windows(186, 206, 100, 240, 3) + ' ' + windows(276, 296, 100, 240, 3),
      waves(268, 10, 390, 44) + ' ' + waves(286, 30, 370, 52),
      'M20 250 Q30 228 44 236 Q52 220 66 234 Q74 226 80 250',
    ],
  },
  {
    id: 'burjalarab',
    name: 'Burj Al Arab',
    place: 'Dubai, Förenade Arabemiraten',
    lat: 25.1412,
    lon: 55.1853,
    fact: 'Hotellet står på en egen konstgjord ö och är byggt för att se ut som ett segel.',
    paths: [
      'M90 266 Q200 252 310 266',
      'M150 258 L176 26 M160 258 L184 34',
      'M176 26 Q300 110 248 258',
      'M150 258 L248 258',
      'M184 60 Q226 70 252 92 M182 90 Q232 100 262 124 M178 130 Q236 136 266 162 M174 170 Q234 176 264 200 M168 210 Q230 214 258 236',
      'M188 64 L188 250 M200 66 L200 250',
      'M176 26 L178 6',
      'M166 76 L140 76 M118 76 a14 5 0 1 0 28 0 a14 5 0 1 0 -28 0',
      'M90 262 L0 248 M90 270 L0 256 M30 252 L30 238 M60 257 L60 243',
      waves(284, 10, 390, 44),
    ],
  },
];
