// Bilder till Pusslet. Varje bild ritas i en ruta på 300 × 300 och delas i 3 × 3 brickor.
// Motiven har tydliga former i alla nio rutor, så att det går att se var varje bricka hör hemma.

const star = (x, y, r) =>
  `<path d="M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z" fill="#fff6d8"/>`;

module.exports = [
  {
    id: 'solnedgang',
    name: 'Solnedgång',
    svg: `
      <defs>
        <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3b2a8f"/><stop offset=".55" stop-color="#e2557a"/><stop offset="1" stop-color="#ffb547"/>
        </linearGradient>
        <linearGradient id="sea1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1f6fa8"/><stop offset="1" stop-color="#123a6b"/>
        </linearGradient>
      </defs>
      <rect width="300" height="190" fill="url(#sky1)"/>
      <circle cx="150" cy="185" r="62" fill="#ffd36b"/>
      <circle cx="150" cy="185" r="78" fill="#ffd36b" opacity=".25"/>
      ${star(40, 30, 8)}${star(255, 45, 6)}${star(95, 60, 5)}
      <path d="M0 150 Q40 110 80 150 Q120 170 160 158 Q215 105 300 140 L300 190 L0 190Z" fill="#5b2a6e"/>
      <rect y="185" width="300" height="115" fill="url(#sea1)"/>
      <path d="M100 200 H200 M115 215 H185 M128 230 H172 M138 245 H162" stroke="#ffd36b" stroke-width="5" stroke-linecap="round" opacity=".8"/>
      <path d="M40 255 h40 l-8 14 h-26z" fill="#2b1d3c"/><path d="M60 255 V205 L85 250Z" fill="#f5f1ff"/><path d="M58 255 V215 L38 250Z" fill="#ffb547"/>
      <path d="M215 275 q12 -8 24 0 q12 8 24 0" stroke="#9fd0ff" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M240 90 l8 -6 l8 6 M262 76 l6 -4 l6 4" stroke="#2b1d3c" stroke-width="3" fill="none" stroke-linecap="round"/>
    `,
  },
  {
    id: 'ballong',
    name: 'Luftballong',
    svg: `
      <defs>
        <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7ec8ff"/><stop offset="1" stop-color="#d9f1ff"/>
        </linearGradient>
      </defs>
      <rect width="300" height="300" fill="url(#sky2)"/>
      <circle cx="255" cy="45" r="28" fill="#ffe066"/>
      <g fill="#ffffff"><ellipse cx="55" cy="55" rx="38" ry="16"/><ellipse cx="80" cy="45" rx="24" ry="16"/><ellipse cx="225" cy="140" rx="34" ry="13"/><ellipse cx="245" cy="132" rx="20" ry="12"/></g>
      <path d="M150 40 C95 40 92 120 135 150 L165 150 C208 120 205 40 150 40Z" fill="#ff5d73"/>
      <path d="M150 40 C130 40 122 120 140 150 L160 150 C178 120 170 40 150 40Z" fill="#ffd166"/>
      <path d="M150 40 C145 40 143 120 147 150 L153 150 C157 120 155 40 150 40Z" fill="#5b8cff"/>
      <path d="M138 150 L142 172 M162 150 L158 172" stroke="#5a3d2b" stroke-width="2"/>
      <rect x="140" y="172" width="20" height="16" rx="3" fill="#8b5a3c"/>
      <path d="M0 230 Q75 190 150 230 T300 220 L300 300 L0 300Z" fill="#6cc46c"/>
      <path d="M0 260 Q90 225 180 262 T300 255 L300 300 L0 300Z" fill="#3e9a52"/>
      <g fill="#2f6b3a"><path d="M40 240 l12 -30 l12 30z"/><path d="M60 246 l10 -24 l10 24z"/><path d="M245 238 l12 -30 l12 30z"/></g>
      <rect x="185" y="250" width="34" height="26" fill="#f5f1ff"/><path d="M180 252 l22 -18 l22 18z" fill="#d94a4a"/><rect x="197" y="262" width="10" height="14" fill="#5a3d2b"/>
      <path d="M100 290 q20 -10 40 0" stroke="#ffe066" stroke-width="4" fill="none"/>
    `,
  },
  {
    id: 'fyr',
    name: 'Fyren',
    svg: `
      <defs>
        <linearGradient id="sky3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#15122e"/><stop offset="1" stop-color="#3a3378"/>
        </linearGradient>
      </defs>
      <rect width="300" height="300" fill="url(#sky3)"/>
      ${star(30, 40, 7)}${star(80, 20, 5)}${star(250, 30, 8)}${star(270, 110, 5)}${star(40, 130, 5)}
      <circle cx="230" cy="70" r="24" fill="#f5f1ff"/><circle cx="240" cy="62" r="22" fill="#2a2560"/>
      <path d="M170 92 L20 60 L20 124 Z" fill="#ffd36b" opacity=".35"/>
      <path d="M130 225 L140 100 L160 100 L170 225Z" fill="#f5f1ff"/>
      <path d="M134 175 L166 175 L168 200 L132 200Z M137 130 L163 130 L164 150 L136 150Z" fill="#e2445c"/>
      <rect x="136" y="82" width="28" height="18" fill="#ffd36b"/>
      <path d="M132 82 L150 64 L168 82Z" fill="#e2445c"/>
      <path d="M0 230 Q60 200 120 222 L180 222 Q240 200 300 228 L300 300 L0 300Z" fill="#1e2a44"/>
      <path d="M0 262 q25 -10 50 0 t50 0 t50 0 t50 0 t50 0 t50 0" stroke="#5b8cff" stroke-width="5" fill="none"/>
      <path d="M0 282 q25 -10 50 0 t50 0 t50 0 t50 0 t50 0 t50 0" stroke="#4fe3b0" stroke-width="4" fill="none" opacity=".7"/>
      <path d="M230 245 h44 l-8 12 h-28z" fill="#ffb547"/><path d="M250 245 V215 L268 242Z" fill="#f5f1ff"/>
    `,
  },
];
