const fs = require('fs');
const files = [
  'nodo/src/App.tsx',
  'nodo/src/index.html',
  'nodo/src/ui/components/ChatView.tsx',
  'nodo/src/ui/components/ModelsView.tsx',
  'nodo/src/ui/components/SettingsView.tsx',
  'nodo/src/ui/components/LibraryView.tsx',
  'nodo/src/ui/components/NotesView.tsx',
  'nodo/src/ui/components/SetupWizard.tsx',
  'nodo/src/i18n/es.ts',
  'nodo/vite.config.ts',
  'app/src/main/java/com/example/jinx/llama/DownloadService.kt',
  'app/src/main/java/com/example/jinx/llama/ModelsActivity.kt',
  'app/src/main/java/com/example/jinx/agent/AgentActivity.kt',
  'app/src/main/java/com/example/jinx/agent/AgentTools.kt',
  'app/src/main/java/com/example/jinx/agent/AgentLoop.kt',
];
const SKIP = ['NodoBridge', 'NodoNative', '__nodo', 'com.example', '"nodo"', "'nodo'", 'NODO_LLAMA', 'NODO_DL', 'NODO_AGENT', 'NODO_BRIDGE', 'import ', 'from '];
for (const f of files) {
  let lines;
  try { lines = fs.readFileSync(f, 'utf8').split('\n'); } catch { continue; }
  let n = 0;
  const out = lines.map((l) => {
    if (SKIP.some((k) => l.includes(k))) return l;
    const nl = l.split('NODO').join('Jinx').split('Nodo').join('Jinx');
    if (nl !== l) n++;
    return nl;
  });
  if (n > 0) { fs.writeFileSync(f, out.join('\n')); console.log(f, n); }
}
