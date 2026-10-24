// Blyertsskisser av kända platser för Skissen.
// Varje skiss ritas i en viewBox 0 0 400 300. Strecken ritas i den ordning de står:
// först grova konturer (svårt att gissa), sedan detaljer (lättare).

const arcRow = (x0, x1, yBase, n, h) => {
  // En rad med små valv mellan x0 och x1, med valvens fot på yBase.
  const w = (x1 - x0) / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = x0 + i * w + w * 0.18;
    const b = x0 + (i + 1) * w - w * 0.18;
    out.push(`M${a.toFixed(1)} ${yBase} L${a.toFixed(1)} ${yBase - h * 0.55} Q${((a + b) / 2).toFixed(1)} ${yBase - h * 1.15} ${b.toFixed(1)} ${yBase - h * 0.55} L${b.toFixed(1)} ${yBase}`);
  }
  return out.join(' ');
};

const waves = (y, x0 = 20, x1 = 380, step = 40) => {
  const out = [];
  for (let x = x0; x < x1; x += step) {
    out.push(`M${x} ${y} q${step / 4} -5 ${step / 2} 0 q${step / 4} 5 ${step / 2} 0`);
  }
  return out.join(' ');
};

// Lodräta hängstag från en kvadratisk kurva (bärkabeln) ner till brobanan.
const suspenders = (xs, ys, atX, deckY) => {
  const pt = (t, v) => (1 - t) * (1 - t) * v[0] + 2 * t * (1 - t) * v[1] + t * t * v[2];
  return atX
    .map((x) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i <= 400; i++) {
        const t = i / 400;
        const d = Math.abs(pt(t, xs) - x);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      return `M${x} ${pt(best, ys).toFixed(1)} L${x} ${deckY}`;
    })
    .join(' ');
};

const circle = (cx, cy, r) =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;

module.exports = [
  {
    id: 'eiffel',
    name: 'Eiffeltornet',
    place: 'Paris, Frankrike',
    lat: 48.8584,
    lon: 2.2945,
    fact: 'Tornet byggdes till världsutställningen 1889 och skulle egentligen rivas efter 20 år.',
    paths: [
      'M60 272 L340 272',
      'M112 270 Q168 180 192 42',
      'M288 270 Q232 180 208 42',
      'M140 270 Q200 212 260 270',
      'M124 214 L276 214 M127 204 L273 204',
      'M160 146 L240 146 M163 139 L237 139',
      'M192 42 L200 20 L208 42 M200 20 L200 6',
      'M186 80 L214 80 M184 90 L216 90',
      'M140 214 L170 146 M260 214 L230 146 M155 204 L245 214 M155 214 L245 204',
      'M176 146 L192 80 M224 146 L208 80 M178 139 L222 100 M222 139 L178 100',
      'M118 254 L150 230 M282 254 L250 230',
    ],
  },
  {
    id: 'giza',
    name: 'Pyramiderna i Giza',
    place: 'Kairo, Egypten',
    lat: 29.9792,
    lon: 31.1342,
    fact: 'Den stora pyramiden var världens högsta byggnad i nästan 4 000 år.',
    paths: [
      'M10 268 Q120 258 200 266 T390 262',
      'M70 266 L185 112 L300 266',
      'M250 264 L322 170 L392 262',
      'M18 268 L58 214 L100 268',
      'M185 112 L208 266',
      'M322 170 L334 263',
      'M58 214 L64 268',
      'M110 214 L262 214 M135 180 L236 180 M158 148 L212 148 M92 240 L282 240',
      'M285 220 L360 220 M300 200 L345 200',
      circle(330, 70, 18),
      'M300 70 L290 70 M330 40 L330 30 M360 70 L370 70 M309 49 L302 42 M351 49 L358 42',
    ],
  },
  {
    id: 'sydney',
    name: 'Sydneyoperan',
    place: 'Sydney, Australien',
    lat: -33.8568,
    lon: 151.2153,
    fact: 'Taket består av över en miljon vita och gräddfärgade kakelplattor från Sverige.',
    paths: [
      'M30 232 L370 232 L358 252 L42 252 Z',
      'M62 232 Q84 150 152 118 Q138 180 150 232',
      'M118 232 Q150 128 226 98 Q202 170 212 232',
      'M196 232 Q232 142 304 124 Q282 182 288 232',
      'M262 232 Q292 178 344 166 Q330 202 336 232',
      'M80 232 Q102 172 148 140 M134 232 Q160 152 220 116 M210 232 Q240 162 298 140',
      'M100 232 Q116 192 146 166 M156 232 Q176 172 214 140 M232 232 Q254 182 292 160',
      waves(270, 20, 380, 45),
      waves(288, 40, 360, 55),
    ],
  },
  {
    id: 'bigben',
    name: 'Big Ben',
    place: 'London, Storbritannien',
    lat: 51.5007,
    lon: -0.1246,
    fact: 'Big Ben är egentligen namnet på den stora klockan inne i tornet, inte på tornet.',
    paths: [
      'M20 272 L380 272',
      'M176 272 L176 122 M224 272 L224 122',
      'M168 122 L232 122 L232 62 L168 62 Z',
      'M168 62 L200 10 L232 62',
      circle(200, 92, 21),
      'M200 92 L200 78 M200 92 L210 98',
      'M224 196 L380 196 M240 196 L240 272 M300 196 L300 272 M360 196 L360 272',
      'M240 196 L240 176 L252 168 L264 176 L264 196 M330 196 L330 170 L342 160 L354 170 L354 196',
      'M188 140 L188 170 M200 140 L200 170 M212 140 L212 170 M188 200 L188 230 M200 200 L200 230 M212 200 L212 230',
      'M184 50 L184 40 M200 36 L200 24 M216 50 L216 40',
      'M250 216 L250 236 M270 216 L270 236 M290 216 L290 236 M310 216 L310 236 M330 216 L330 236 M350 216 L350 236',
    ],
  },
  {
    id: 'pisa',
    name: 'Lutande tornet i Pisa',
    place: 'Pisa, Italien',
    lat: 43.723,
    lon: 10.3966,
    fact: 'Tornet började luta redan under bygget på 1170-talet, eftersom marken var för mjuk.',
    transform: 'rotate(6 200 272)',
    paths: [
      'M150 272 L250 272',
      'M168 272 L168 76 M232 272 L232 76',
      'M164 76 L236 76 M164 240 L236 240',
      'M176 76 L176 46 M224 76 L224 46 M172 46 L228 46',
      'M168 212 L232 212 M168 184 L232 184 M168 156 L232 156 M168 128 L232 128 M168 102 L232 102',
      arcRow(168, 232, 240, 4, 22),
      arcRow(168, 232, 212, 5, 18) + ' ' + arcRow(168, 232, 184, 5, 18),
      arcRow(168, 232, 156, 5, 18) + ' ' + arcRow(168, 232, 128, 5, 18) + ' ' + arcRow(168, 232, 102, 5, 16),
      arcRow(176, 224, 76, 3, 18),
    ],
  },
  {
    id: 'liberty',
    name: 'Frihetsgudinnan',
    place: 'New York, USA',
    lat: 40.6892,
    lon: -74.0445,
    fact: 'Statyn var en gåva från Frankrike och invigdes 1886.',
    paths: [
      'M120 272 L280 272',
      'M160 272 L160 202 L240 202 L240 272 M150 202 L250 202',
      'M176 202 Q168 146 184 104 L216 104 Q234 146 226 202',
      circle(200, 90, 11),
      'M187 106 L168 50',
      'M164 50 L176 50 L173 38 L167 38 Z',
      'M170 38 Q162 28 170 18 Q178 28 170 38',
      'M188 82 L178 68 M193 79 L189 62 M200 78 L200 60 M207 79 L211 62 M212 82 L222 68',
      'M216 118 L234 114 L236 142 L218 146 Z',
      'M186 140 Q196 170 190 202 M206 130 Q214 168 210 202',
      'M172 222 L228 222 M172 246 L228 246',
    ],
  },
  {
    id: 'taj',
    name: 'Taj Mahal',
    place: 'Agra, Indien',
    lat: 27.1751,
    lon: 78.0421,
    fact: 'Mausoleet byggdes av stormogulen Shah Jahan till minne av hans fru Mumtaz Mahal.',
    paths: [
      'M30 252 L370 252 L370 270 L30 270 Z',
      'M110 252 L110 152 L290 152 L290 252',
      'M150 152 Q138 104 200 72 Q262 104 250 152',
      'M200 72 L200 48 M196 56 L204 56',
      'M174 252 L174 194 Q200 160 226 194 L226 252',
      'M54 252 L54 120 M70 252 L70 120 M50 120 L74 120 M52 120 Q62 102 72 120 M62 106 L62 96',
      'M330 252 L330 120 M346 252 L346 120 M326 120 L350 120 M328 120 Q338 102 348 120 M338 106 L338 96',
      'M114 152 Q126 128 138 152 M262 152 Q274 128 286 152',
      'M124 240 L124 206 Q136 192 148 206 L148 240 M252 240 L252 206 Q264 192 276 206 L276 240',
      'M54 160 L70 160 M54 200 L70 200 M330 160 L346 160 M330 200 L346 200',
      'M180 278 L220 278 M170 286 L230 286 M186 294 L214 294',
    ],
  },
  {
    id: 'goldengate',
    name: 'Golden Gate-bron',
    place: 'San Francisco, USA',
    lat: 37.8199,
    lon: -122.4783,
    fact: 'När bron öppnade 1937 var den världens längsta hängbro.',
    paths: [
      'M0 212 L400 212 M0 220 L400 220',
      'M112 250 L112 70 M132 250 L132 70 M268 250 L268 70 M288 250 L288 70',
      'M122 74 Q200 300 278 74',
      'M122 74 Q70 170 0 196 M278 74 Q330 170 400 196',
      'M112 90 L132 90 M112 130 L132 130 M112 170 L132 170 M268 90 L288 90 M268 130 L288 130 M268 170 L288 170',
      suspenders([122, 300, 278], [74, 300, 74], [150, 170, 190, 210, 230, 250], 212),
      suspenders([122, 70, 0], [74, 170, 196], [30, 60, 90], 212) + ' ' + suspenders([278, 330, 400], [74, 170, 196], [310, 340, 370], 212),
      waves(262, 10, 390, 42),
    ],
  },
  {
    id: 'colosseum',
    name: 'Colosseum',
    place: 'Rom, Italien',
    lat: 41.8902,
    lon: 12.4922,
    fact: 'Arenan rymde runt 50 000 åskådare som såg gladiatorspel här i flera hundra år.',
    paths: [
      'M24 266 Q200 284 376 266',
      'M30 266 L30 92 Q140 74 250 86 L260 112 Q320 118 370 150 L370 266',
      'M30 214 Q200 230 370 214 M30 168 Q200 182 370 172 M30 124 Q150 128 254 124',
      arcRow(30, 370, 262, 10, 34),
      arcRow(30, 370, 212, 10, 30),
      arcRow(30, 370, 166, 10, 28),
      'M40 120 L40 98 M70 120 L70 94 M100 122 L100 92 M130 122 L130 90 M160 122 L160 88 M190 122 L190 87 M220 122 L220 87',
      'M250 86 L240 70 L232 84 M260 112 L274 104 L284 120',
    ],
  },
  {
    id: 'cristo',
    name: 'Kristusstatyn',
    place: 'Rio de Janeiro, Brasilien',
    lat: -22.9519,
    lon: -43.2105,
    fact: 'Statyn är 30 meter hög och står på berget Corcovado, 700 meter över staden.',
    paths: [
      'M0 272 Q110 240 166 182 L234 182 Q296 240 400 272',
      'M186 182 L186 154 L214 154 L214 182',
      'M190 154 L188 86 M210 154 L212 86',
      'M150 82 L250 82 M154 92 L246 92 M150 82 L148 92 M250 82 L252 92',
      circle(200, 70, 9),
      'M188 92 Q182 130 192 154 M212 92 Q218 130 208 154',
      'M196 100 L196 150 M204 100 L204 150',
      'M30 120 Q50 100 80 110 Q100 92 124 108 Q140 104 146 118 Z',
      'M270 60 Q290 44 316 54 Q336 40 356 56 Q372 56 372 70 Z',
      'M60 240 Q80 220 100 236 M300 236 Q320 216 344 238',
    ],
  },
];
