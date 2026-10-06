const fs = require('fs');
const files = [
  'nodo/src/App.tsx',
  'nodo/src/ui/components/ChatView.tsx',
  'nodo/src/ui/components/LibraryView.tsx',
  'nodo/src/ui/components/NotesView.tsx',
  'nodo/src/ui/components/SettingsView.tsx',
  'nodo/src/ui/components/SetupWizard.tsx',
];
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const o = s;
  s = s.split('min-h-screen').join('min-h-dvh').split('h-screen').join('h-dvh');
  if (s !== o) { fs.writeFileSync(f, s); console.log('patched', f); }
}
