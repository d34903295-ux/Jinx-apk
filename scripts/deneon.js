const fs = require('fs');
const files = [
  'nodo/src/index.css',
  'nodo/src/ui/components/Icon.tsx',
  'nodo/src/ui/components/ChatView.tsx',
  'nodo/src/ui/components/NotesView.tsx',
  'nodo/src/ui/components/OfflineBadge.tsx',
  'nodo/src/ui/components/ToolCallCard.tsx',
  'nodo/src/ui/components/MessageBubble.tsx',
  'nodo/src/ui/components/LibraryView.tsx',
  'nodo/src/ui/components/SetupWizard.tsx',
  'nodo/src/ui/components/SettingsView.tsx',
  'nodo/src/ui/components/ModelsView.tsx',
  'nodo/src/App.tsx',
];
const pairs = [
  ['0, 245, 160', '47, 163, 124'],
  ['0,245,160', '47,163,124'],
  ['0, 210, 255', '107, 140, 174'],
  ['0,210,255', '107,140,174'],
  ['#00f5a0', '#2fa37c'],
  ['#00d26a', '#23855f'],
  ['#00a854', '#0e6b4f'],
  ['#5eead4', '#7bc9a8'],
  ['#00d2ff', '#6b8cae'],
  ['#00b4d8', '#54748f'],
  ['#67e8f9', '#9db8cf'],
  ['#ffb800', '#c9963c'],
  ['#ff9900', '#a87b2a'],
  ['#ff8c00', '#a87b2a'],
  ['#fde047', '#d9b06a'],
  ['#ea580c', '#7d5c20'],
  ['#f87171', '#c96a5e'],
  ['#ef4444', '#a84e44'],
];
for (const f of files) {
  let s;
  try { s = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const o = s;
  for (const [a, b] of pairs) s = s.split(a).join(b);
  if (s !== o) { fs.writeFileSync(f, s); console.log('patched', f); }
}
