const fs = require('fs');
const p = 'nodo/src/ui/components/ChatView.tsx';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const anchor = "  // Pantalla encendida mientras genera el motor nativo.\n  useEffect(() => {\n    if (!generating) return";
const inject = `  // Temporizador visible en la isla mientras la IA piensa.
  useEffect(() => {
    if (!generating) return
    const t0 = Date.now()
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000)
      setIsland({ mode: 'thinking', label: \`IA pensando… \${s}s\` })
    }, 1000)
    return () => clearInterval(id)
  }, [generating])

  // Pantalla encendida mientras genera el motor nativo.
  useEffect(() => {
    if (!generating) return`;
if (!s.includes('Temporizador visible en la isla') && s.includes(anchor)) {
  s = s.split(anchor).join(inject);
  console.log('timer inyectado');
} else {
  console.log('sin cambios');
}
fs.writeFileSync(p, s.replace(/\n/g, '\r\n'));
console.log('ok');
