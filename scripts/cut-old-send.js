const fs = require('fs');
const p = 'nodo/src/ui/components/ChatView.tsx';
const lines = fs.readFileSync(p, 'utf8').split('\n');
// Eliminar líneas 298..442 (1-indexed): cuerpo viejo + cierre huérfano.
// Verificaciones de seguridad:
const first = lines[297];
const last = lines[441];
if (!first.trim().startsWith('let currentChatId = activeChatId')) {
  console.error('inicio inesperado:', JSON.stringify(first)); process.exit(1);
}
if (last.trim() !== '}') {
  console.error('fin inesperado:', JSON.stringify(last)); process.exit(1);
}
const after = lines.slice(442);
if (!after[1].includes('const handleKeyDown')) {
  console.error('no sigue handleKeyDown'); process.exit(1);
}
const kept = lines.slice(0, 297).concat(after);
fs.writeFileSync(p, kept.join('\n'));
console.log('ok, lineas restantes:', kept.length);
