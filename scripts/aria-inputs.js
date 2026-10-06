const fs = require('fs'), path = 'nodo/src/ui/components/';
const map = [
  ['placeholder={isLoading', 'aria-label="Entrada de mensaje" placeholder={isLoading'],
  ['placeholder="Filtrar..."', 'aria-label="Filtrar documentos" placeholder="Filtrar..."'],
  ['placeholder="Buscar en tus notas..."', 'aria-label="Buscar en notas" placeholder="Buscar en tus notas..."'],
  ['placeholder="Título de la nota..."', 'aria-label="Título de la nota" placeholder="Título de la nota..."'],
  ['placeholder="Escribe el contenido de tu nota aquí..."', 'aria-label="Contenido de la nota" placeholder="Escribe el contenido de tu nota aquí..."'],
];
for (const f of fs.readdirSync(path)) {
  if (!f.endsWith('.tsx')) continue;
  const p = path + f;
  let s = fs.readFileSync(p, 'utf8');
  const o = s;
  for (const [k, v] of map) s = s.split(k).join(v);
  if (s !== o) { fs.writeFileSync(p, s); console.log('patched', f); }
}
