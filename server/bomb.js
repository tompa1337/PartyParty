// Bombdesarmeringen: bomber med färgade trådar och manualen som avgör vilken tråd som ska klippas.
// Reglerna och manualens text kommer från samma lista, så de kan aldrig säga olika saker.

const COLORS = ['röd', 'blå', 'gul', 'vit', 'svart'];
const ORD = ['första', 'andra', 'tredje', 'fjärde', 'femte', 'sjätte'];

const count = (b, c) => b.wires.filter((w) => w === c).length;
const first = (b, c) => b.wires.indexOf(c);
const lastOf = (b, c) => b.wires.lastIndexOf(c);
const last = (b) => b.wires.length - 1;
const odd = (b) => b.lastDigit % 2 === 1;

// Varje regel: när den gäller och vilken tråd (index) som ska klippas. Första regeln som gäller avgör.
const RULES = {
  3: [
    { text: 'Finns det ingen röd tråd: klipp den andra tråden.', when: (b) => count(b, 'röd') === 0, cut: () => 1 },
    { text: 'Annars, om den sista tråden är blå: klipp den första tråden.', when: (b) => b.wires[last(b)] === 'blå', cut: () => 0 },
    { text: 'Annars: klipp den första röda tråden.', when: () => true, cut: (b) => first(b, 'röd') },
  ],
  4: [
    { text: 'Finns det två eller fler gula trådar: klipp den sista gula.', when: (b) => count(b, 'gul') >= 2, cut: (b) => lastOf(b, 'gul') },
    { text: 'Annars, om serienumret slutar på en jämn siffra: klipp den andra tråden.', when: (b) => !odd(b), cut: () => 1 },
    { text: 'Annars, om det inte finns någon svart tråd: klipp den sista tråden.', when: (b) => count(b, 'svart') === 0, cut: (b) => last(b) },
    { text: 'Annars: klipp den första tråden.', when: () => true, cut: () => 0 },
  ],
  5: [
    { text: 'Är den första tråden vit: klipp den sista tråden.', when: (b) => b.wires[0] === 'vit', cut: (b) => last(b) },
    { text: 'Annars, om det finns exakt en blå tråd: klipp den blå.', when: (b) => count(b, 'blå') === 1, cut: (b) => first(b, 'blå') },
    { text: 'Annars, om serienumret slutar på en udda siffra: klipp den tredje tråden.', when: (b) => odd(b), cut: () => 2 },
    { text: 'Annars: klipp den fjärde tråden.', when: () => true, cut: () => 3 },
  ],
  6: [
    { text: 'Finns det ingen gul tråd: klipp den fjärde tråden.', when: (b) => count(b, 'gul') === 0, cut: () => 3 },
    { text: 'Annars, om det finns fler röda än blå trådar: klipp den första röda.', when: (b) => count(b, 'röd') > count(b, 'blå'), cut: (b) => first(b, 'röd') },
    { text: 'Annars, om den sista tråden är svart: klipp den femte tråden.', when: (b) => b.wires[last(b)] === 'svart', cut: () => 4 },
    { text: 'Annars: klipp den andra tråden.', when: () => true, cut: () => 1 },
  ],
};

const MANUAL = Object.entries(RULES).map(([n, rules]) => ({ wires: Number(n), rules: rules.map((r) => r.text) }));

function solution(b) {
  return RULES[b.wires.length].find((r) => r.when(b)).cut(b);
}

const LETTERS = 'ABCDEFGHJKLMNPRSTUVXYZ';
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

// Bomb nummer i (0, 1, 2 …): de första blir svårare steg för steg, sedan blandat.
function generate(i, rnd = Math.random) {
  const n = i < 4 ? 3 + i : 4 + Math.floor(rnd() * 3);
  const wires = Array.from({ length: n }, () => pick(COLORS, rnd));
  const lastDigit = Math.floor(rnd() * 10);
  const serial = `${pick(LETTERS, rnd)}${pick(LETTERS, rnd)}${Math.floor(rnd() * 10)}${pick(LETTERS, rnd)}${lastDigit}`;
  return { wires, serial, lastDigit };
}

module.exports = { generate, solution, MANUAL, RULES, COLORS, ORD };
