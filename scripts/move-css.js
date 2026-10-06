const fs = require('fs');
const p = 'nodo/src/index.css';
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('  /* Puntos de "escribiendo');
const endMarker = '  .animate-spin-slow {';
const end = s.indexOf(endMarker);
if (start < 0 || end < 0) { console.error('no encontrado'); process.exit(1); }
const endClose = s.indexOf('}', s.indexOf('animation: spin-slow 12s linear infinite;', end)) + 1;
const block = s.slice(start, endClose);
s = s.slice(0, start) + s.slice(endClose);
// Insertar antes de "@media (prefers-reduced-motion"
const anchor = '@media (prefers-reduced-motion: reduce)';
if (!s.includes(anchor)) { console.error('sin ancla'); process.exit(1); }
s = s.split(anchor).join(block + '\n' + anchor);
fs.writeFileSync(p, s);
console.log('movidas fuera de @theme, lineas:', block.split('\n').length);
