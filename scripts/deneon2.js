const fs = require('fs');
const files = [
  'nodo/src/index.css',
  'nodo/src/ui/components/ChatView.tsx',
  'nodo/src/ui/components/LibraryView.tsx',
  'nodo/src/ui/components/OfflineBadge.tsx',
];
const pairs = [
  ['rgba(255, 184, 0,', 'rgba(201, 150, 60,'],
  ['rgba(255,184,0,', 'rgba(201,150,60,'],
  ['rgba(239,68,68,', 'rgba(201,106,94,'],
  ['rgba(239, 68, 68,', 'rgba(201, 106, 94,'],
];
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const o = s;
  for (const [a, b] of pairs) s = s.split(a).join(b);
  if (s !== o) { fs.writeFileSync(f, s); console.log('patched', f); }
}
