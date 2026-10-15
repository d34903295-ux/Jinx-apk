import{E as e,c as t,i as n,r,v as i}from"./index-CEEjsfRL.js";import{n as a,r as o,t as s}from"./codeRunner-Bj2C_hmm.js";var c=e(),l=n(),u={benchmark:{label:`Benchmark: Búsqueda Binaria vs Lineal`,lang:`javascript`,code:`// Benchmark de Alto Rendimiento en Sandbox
const arraySize = 50000;
const data = Array.from({ length: arraySize }, (_, i) => i * 2);
const target = 49998;

// 1. Búsqueda Lineal O(N)
function linearSearch(arr, x) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === x) return i;
  }
  return -1;
}

// 2. Búsqueda Binaria O(log N)
function binarySearch(arr, x) {
  let low = 0, high = arr.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (arr[mid] === x) return mid;
    if (arr[mid] < x) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

console.log("Probando arreglos con", arraySize, "elementos ordenados...");
const b1 = jinx.bench("Búsqueda Lineal", () => linearSearch(data, target), 1000);
const b2 = jinx.bench("Búsqueda Binaria", () => binarySearch(data, target), 50000);

return {
  aceleracion: (b2.opsPerSec / b1.opsPerSec).toFixed(1) + "x más rápida",
  linealOps: b1.opsPerSec,
  binariaOps: b2.opsPerSec
};`},python_montecarlo:{label:`Python: Estimación Monte Carlo de Pi`,lang:`python`,code:`# Simulación Monte Carlo para calcular Pi 100% offline
import math

puntos_totales = 25000
dentro_circulo = 0

for i in range(puntos_totales):
    # Generador en el cuadrante unitario
    x = Math.random()
    y = Math.random()
    if (x * x + y * y) <= 1.0:
        dentro_circulo += 1

pi_estimado = 4.0 * dentro_circulo / puntos_totales
error_porcentual = abs(pi_estimado - math.pi) / math.pi * 100

print("Puntos simulados:", puntos_totales)
print("Puntos dentro del círculo:", dentro_circulo)
print("Pi estimado:", pi_estimado)
print("Pi real (Math.PI):", math.pi)
print("Error:", round(error_porcentual, 3), "%")

return { "pi_estimado": pi_estimado, "error": error_porcentual }`},canvas_visual:{label:`Visual: Canvas Animado de Partículas`,lang:`html`,code:`<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
    canvas { border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; box-shadow: 0 0 30px rgba(0,255,160,0.2); }
  </style>
</head>
<body>
  <canvas id="c" width="360" height="320"></canvas>
  <script>
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 1.6,
      vy: (Math.random() - 0.5) * 1.6,
      r: Math.random() * 3 + 1.5
    }));

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00F5A0';
      ctx.strokeStyle = 'rgba(0, 245, 160, 0.15)';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 65) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  <\/script>
</body>
</html>`},quicksort:{label:`Algoritmos: QuickSort con Métricas`,lang:`javascript`,code:`// Algoritmo QuickSort In-Place con análisis estadístico
function quickSort(arr, left = 0, right = arr.length - 1) {
  if (left < right) {
    const pivotIndex = partition(arr, left, right);
    quickSort(arr, left, pivotIndex - 1);
    quickSort(arr, pivotIndex + 1, right);
  }
  return arr;
}

function partition(arr, left, right) {
  const pivot = arr[right];
  let i = left - 1;
  for (let j = left; j < right; j++) {
    if (arr[j] <= pivot) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  [arr[i + 1], arr[right]] = [arr[right], arr[i + 1]];
  return i + 1;
}

const muestra = Array.from({ length: 15000 }, () => Math.floor(Math.random() * 100000));
console.log("Muestra desordenada generada: " + muestra.length + " números.");

const benchRes = jinx.bench("QuickSort 15k", () => {
  quickSort([...muestra]);
}, 10);

const ordenados = quickSort([...muestra]);
const stats = jinx.stats(ordenados);

console.log("Estadísticas del conjunto ordenado:");
console.log("• Min:", stats.min, "| Max:", stats.max);
console.log("• Media:", stats.mean, "| Mediana:", stats.median);

return { benchmark: benchRes, stats };`},crypto_security:{label:`Seguridad: Hashes SHA-256 & UUID`,lang:`javascript`,code:`// Utilidades criptográficas y seguridad local
const token = jinx.crypto.uuid();
const mensaje = "Transacción offline autorizada: " + token;

const encoded = jinx.crypto.base64Encode(mensaje);
const decoded = jinx.crypto.base64Decode(encoded);

console.log("Token UUID v4:", token);
console.log("Mensaje original:", mensaje);
console.log("Base64 codificado:", encoded);
console.log("Base64 decodificado:", decoded);

// Guardar en la memoria de sesión del sandbox
jinx.storage.set("ultimo_token", token);
jinx.storage.set("autenticado", true);

return {
  token,
  valido: mensaje === decoded,
  sesionKeys: jinx.storage.keys()
};`},primes:{label:`Criba de Eratóstenes y Estadísticas`,lang:`javascript`,code:`// Criba de Eratóstenes usando el namespace nativo de Jinx
const max = 500;
const primos = jinx.primes(max);

console.log("Números primos menores a " + max + ":", primos.length);
console.log("Primeros 15:", primos.slice(0, 15).join(", "));

const stats = jinx.stats(primos);
console.log("Estadísticas de la distribución de primos:");
console.log("• Media:", stats.mean);
console.log("• Mediana:", stats.median);
console.log("• Desviación Estándar:", stats.stdDev);

return stats;`},mock_data:{label:`Generador de Datos Mock y Análisis`,lang:`javascript`,code:`// Generación de datos sintéticos estructurados
const usuarios = jinx.mockData('users', 10);
const metricas = jinx.mockData('metrics', 8);

console.log("Usuarios generados:", usuarios.length);
usuarios.forEach(u => console.log(\`• [\${u.id}] \${u.name} - \${u.role} (Score: \${u.score})\`));

const scores = usuarios.map(u => u.score);
const statsScores = jinx.stats(scores);
console.log("Estadísticas de puntuación:", statsScores);

return { usuarios, statsScores };`},generate_pdf:{label:`Generador de Documento PDF Profesional`,lang:`javascript`,code:`// Generador de Documento PDF Profesional 100% Offline
const res = jinx.createPdf({
  title: "Informe Técnico de Rendimiento",
  subtitle: "Auditoría de Sistemas y Métricas Locales",
  author: "Jinx AI Architecture",
  sections: [
    {
      heading: "1. Resumen Ejecutivo",
      text: "Este informe certifica el funcionamiento óptimo del entorno local sin conexión a internet. Todas las inferencias y operaciones se realizan de forma soberana y privada.",
      callout: { type: "info", text: "Datos procesados localmente en memoria sin telemetría externa." }
    },
    {
      heading: "2. Métricas de Rendimiento",
      table: {
        headers: ["Módulo", "Latencia", "Consumo", "Estado"],
        rows: [
          ["MiniCPM / Gemma", "38 ms/token", "1.1 GB RAM", "Óptimo"],
          ["Embeddings RAG", "12 ms/doc", "85 MB RAM", "Activo"],
          ["Motor PDF", "3 ms", "12 MB RAM", "Verificado"],
          ["Sandbox JS/Py", "0.6 ms", "4 MB RAM", "Listo"]
        ]
      }
    },
    {
      heading: "3. Directrices y Conclusión",
      bullets: [
        "Seguridad garantizada mediante cifrado de sesión local.",
        "Autonomía completa frente a cortes de red.",
        "Generación documental lista para distribución."
      ]
    }
  ]
}, "informe_rendimiento.pdf");

console.log("PDF generado con éxito:", res);
return res;`},generate_qr_csv:{label:`Generador de Código QR y Hoja CSV`,lang:`javascript`,code:`// Generación de Código QR y Hoja de Cálculo CSV 100% Offline
const qrSvg = jinx.createQr("WIFI:S:MiRedPrivada;T:WPA;P:ClaveSegura2026;;", 256);
console.log("Código QR para configuración de red generado exitosamente.");

const csv = jinx.createCsv(
  "inventario_activos.csv",
  ["ID", "Dispositivo", "Ubicación", "Estado"],
  [
    [1, "Servidor Edge", "Sala A", "Activo"],
    [2, "Terminal Jinx", "Móvil 01", "Calibrado"],
    [3, "Sensor IoT", "Zona Norte", "En espera"]
  ]
);

console.log("Hoja de cálculo CSV generada:", csv);
return { qrSvgLength: qrSvg.length, csv };`}};function d({onBack:e,onSendToChat:n,initialCode:d,initialLang:f,autoRun:p}){let[m,h]=(0,c.useState)(f||`javascript`),[g,_]=(0,c.useState)(d??u.benchmark.code),[v,y]=(0,c.useState)(`benchmark`),[b,x]=(0,c.useState)(f===`html`||p?`preview`:`split`),[S,C]=(0,c.useState)(`sm`),[w,T]=(0,c.useState)(!1),[E,D]=(0,c.useState)(!1),[O,k]=(0,c.useState)(!1),[A,j]=(0,c.useState)(``),[M,N]=(0,c.useState)(!1),[P,F]=(0,c.useState)(``),[I,L]=(0,c.useState)([{id:`init-1`,type:`system`,text:`Jinx Code Studio Pro Terminal v2.4 [Listo]. Escribe "help" para ver los comandos disponibles.`,time:new Date().toLocaleTimeString()}]),[R,z]=(0,c.useState)([]),[B,V]=(0,c.useState)(-1),H=(0,c.useRef)(null),U=(0,c.useRef)(null),W=(0,c.useRef)(null),G=(0,c.useRef)(null),K=g.split(`
`).length,q=P.trim()?(g.match(new RegExp(P.replace(/[.*+?^${}()|[\]\\]/g,`\\$&`),`gi`))||[]).length:0;(0,c.useEffect)(()=>{if(d!=null){_(d);let e=f||`html`;h(e),x(e===`html`||p?`preview`:`split`)}},[d,f,p]),(0,c.useEffect)(()=>{let e=e=>{let t=e.data;t&&t.type===`SANDBOX_LOG`&&t.text&&J({type:t.level===`error`?`error`:`output`,text:t.text})};return window.addEventListener(`message`,e),()=>window.removeEventListener(`message`,e)},[]),(0,c.useEffect)(()=>{b===`preview`&&G.current?.contentWindow&&G.current.contentWindow.postMessage({type:`RENDER_HTML`,html:g},`*`)},[g,b]),(0,c.useEffect)(()=>{U.current?.scrollIntoView({behavior:`smooth`})},[I]);let J=e=>{let t={...e,id:`entry-`+Math.random().toString(36).substring(2,9),time:new Date().toLocaleTimeString()};L(e=>[...e,t])},Y=()=>{o(),T(!1),J({type:`info`,text:`✕ Ejecución detenida manualmente por el usuario.`})},X=async()=>{T(!0);let e=performance.now();try{if(m===`html`){x(`preview`),G.current?.contentWindow?.postMessage({type:`RENDER_HTML`,html:g},`*`),J({type:`info`,text:`✓ Vista previa HTML/Canvas actualizada en pestaña Live Render.`});return}J({type:`input`,text:`run [${m.toUpperCase()}] (${K} líneas)`});let t=await s(g,m===`python`?`python`:`javascript`,8e3,void 0,e=>J({type:`output`,text:e})),n=Math.round(performance.now()-e);t.benchmark&&t.benchmark.length>0&&t.benchmark.forEach(e=>{J({type:`bench`,text:`⏱ [BENCHMARK] "${e.name}": ${e.iterations} iteraciones en ${e.totalTimeMs}ms (${e.opsPerSec.toLocaleString()} ops/s)`})}),t.result!==void 0&&t.result!==``&&J({type:`output`,text:`<<< ${t.result}`,durationMs:n}),t.error?J({type:`error`,text:`✕ Error: ${t.error}`,durationMs:n}):(!t.logs||t.logs.length===0)&&t.result===void 0&&J({type:`info`,text:`✓ Ejecutado con éxito (${n}ms, sin retorno)`,durationMs:n})}catch(e){J({type:`error`,text:`✕ Excepción no controlada: ${e.message||String(e)}`})}finally{T(!1)}},Z=async e=>{e.preventDefault();let n=A.trim();if(!n)return;z(e=>[...e,n]),V(-1),j(``),J({type:`input`,text:`> ${n}`});let r=n.toLowerCase();if(r===`help`||r===`?`){J({type:`info`,text:`Comandos Disponibles en la Terminal:
• run          - Ejecuta el código actual del editor
• clear / cls  - Limpia los registros de la terminal (Ctrl+L)
• reset        - Reinicia las variables de sesión del sandbox
• history      - Muestra el historial de comandos ejecutados
• bench        - Ejecuta prueba de estrés de CPU en memoria
• models       - Consulta los modelos de IA activos en Jinx
• stats        - Muestra métricas del editor y sesión
• theme        - Alterna tema claro / oscuro
• date         - Muestra la fecha y hora del sistema
• echo <texto> - Imprime texto directamente
• eval <expr>  - Evalúa expresión JavaScript
• py <expr>    - Evalúa expresión Python
• <expresión>  - Cualquier expresión JS se evalúa directamente con memoria de sesión`});return}if(r===`clear`||r===`cls`){L([]);return}if(r===`reset`){for(let e of Object.keys(a))delete a[e];J({type:`info`,text:`✓ Variables y memoria de sesión reiniciadas con éxito.`});return}if(r===`history`){J({type:`info`,text:R.length?R.map((e,t)=>`  ${t+1}. ${e}`).join(`
`):`(Historial vacío)`});return}if(r===`run`){X();return}if(r===`bench`){let e=performance.now(),t=0;for(let e=0;e<1e5;e++)t+=e*3^7;let n=Math.round((performance.now()-e)*100)/100;J({type:`bench`,text:`⏱ CPU Stress Benchmark: 100,000 operaciones en ${n}ms (${Math.round(1e5/(n||.001)*1e3).toLocaleString()} ops/s). Checksum: ${t}`});return}if(r===`models`){let e=t();J({type:`info`,text:`Modelo Nativo Activo: ${e||`Ninguno cargado (descarga desde pestaña Modelos: MiniCPM, Gemma, Qwen)`}`});return}if(r===`date`){J({type:`info`,text:new Date().toLocaleString()});return}if(r===`stats`){J({type:`info`,text:`Métricas:
• Lenguaje: ${m.toUpperCase()}
• Líneas de código: ${K}
• Caracteres: ${g.length}
• Variables en sesión: ${Object.keys(a).length} (${Object.keys(a).join(`, `)||`ninguna`})`});return}if(r===`theme`){document.documentElement.classList.contains(`dark`)?(document.documentElement.classList.remove(`dark`),J({type:`info`,text:`Tema cambiado a: Claro`})):(document.documentElement.classList.add(`dark`),J({type:`info`,text:`Tema cambiado a: Oscuro`}));return}if(r.startsWith(`echo `)){J({type:`output`,text:n.slice(5)});return}let i=r.startsWith(`py `),o=i?n.slice(3):r.startsWith(`eval `)?n.slice(5):n,c=i?`python`:`javascript`,l=performance.now(),u=await s(o,c),d=Math.round(performance.now()-l);u.logs&&u.logs.length>0&&u.logs.forEach(e=>J({type:`output`,text:e})),u.result!==void 0&&u.result!==``&&J({type:`output`,text:`< ${u.result}`,durationMs:d}),u.error&&J({type:`error`,text:`✕ ${u.error}`,durationMs:d})},Q=e=>{if(e.key===`ArrowUp`){if(e.preventDefault(),R.length===0)return;let t=B===-1?R.length-1:Math.max(0,B-1);V(t),j(R[t]||``)}else if(e.key===`ArrowDown`){if(e.preventDefault(),B===-1)return;let t=B+1;t>=R.length?(V(-1),j(``)):(V(t),j(R[t]||``))}},ee=e=>{y(e);let t=u[e];t&&(h(t.lang),_(t.code),t.lang===`html`&&x(`preview`),J({type:`info`,text:`Plantilla cargada: "${t.label}" (${t.lang.toUpperCase()})`}))},te=e=>{if(e.key===`Tab`){e.preventDefault();let t=H.current;if(!t)return;let n=t.selectionStart,r=t.selectionEnd,i=g.substring(0,n)+`  `+g.substring(r);_(i),setTimeout(()=>{t.selectionStart=t.selectionEnd=n+2},0)}(e.ctrlKey||e.metaKey)&&e.key===`Enter`&&(e.preventDefault(),X()),(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()===`l`&&(e.preventDefault(),L([])),(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()===`f`&&(e.preventDefault(),N(e=>!e))},ne=()=>{try{let e=g.split(`
`),t=0,n=e.map(e=>{let n=e.trim();if(!n)return``;(n.startsWith(`}`)||n.startsWith(`]`)||n.startsWith(`)`))&&(t=Math.max(0,t-1));let r=`  `.repeat(t)+n;return(n.endsWith(`{`)||n.endsWith(`[`)||n.endsWith(`(`))&&t++,r});_(n.join(`
`)),J({type:`info`,text:`✓ Código formateado con sangría de 2 espacios.`})}catch{}},re=()=>{navigator.clipboard.writeText(g),D(!0),setTimeout(()=>D(!1),2e3)},ie=()=>{let e=I.map(e=>`[${e.time}] ${e.text}`).join(`
`);navigator.clipboard.writeText(e),J({type:`info`,text:`✓ Registros de la terminal copiados al portapapeles.`})},ae=()=>{let e=m===`javascript`?`js`:m===`python`?`py`:`html`,t=new Blob([g],{type:`text/plain;charset=utf-8`}),n=URL.createObjectURL(t),r=document.createElement(`a`);r.href=n,r.download=`script_${v}_${Date.now()}.${e}`,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(n),J({type:`info`,text:`📄 Archivo descargado: ${r.download}`})},oe=e=>{let t=new FileReader;t.onload=t=>{let n=t.target?.result;if(n!==void 0){_(n);let t=e.name.toLowerCase();t.endsWith(`.py`)?h(`python`):t.endsWith(`.html`)||t.endsWith(`.htm`)?(h(`html`),x(`preview`)):h(`javascript`),J({type:`info`,text:`✓ Archivo cargado con éxito: "${e.name}"`})}},t.readAsText(e)},se=async()=>{try{let e=`Snippet [${m.toUpperCase()}]: ${u[v]?.label||`Código Jinx`}`;await i(e,`\`\`\`${m}\n${g}\n\`\`\`\n\nGuardado desde Code Studio Pro`),k(!0),J({type:`info`,text:`✓ Código guardado en el gestor de Notas.`}),setTimeout(()=>k(!1),2500)}catch{}},$=e=>{n&&n(e||`Analiza, optimiza o explica este código (${m}) desarrollado en Code Studio Pro:\n\n\`\`\`${m}\n${g}\n\`\`\``)},ce=S===`xs`?`text-[11px] leading-relaxed`:S===`base`?`text-sm md:text-base leading-relaxed`:`text-xs md:text-sm leading-relaxed`;return(0,l.jsxs)(`div`,{className:`flex flex-col h-full w-full bg-white dark:bg-black text-black dark:text-white transition-colors duration-200`,children:[(0,l.jsx)(`input`,{ref:W,type:`file`,accept:`.js,.ts,.py,.html,.css,.json,.txt`,className:`hidden`,onChange:e=>{let t=e.target.files?.[0];t&&oe(t),e.target.value=``}}),(0,l.jsxs)(`header`,{className:`shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 border-b border-black/10 dark:border-white/10 backdrop-blur-xl bg-white/70 dark:bg-black/70 z-10`,children:[(0,l.jsxs)(`div`,{className:`flex items-center gap-2 sm:gap-3`,children:[(0,l.jsx)(`button`,{type:`button`,onClick:e,className:`p-1.5 -ml-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer`,title:`Volver`,children:(0,l.jsx)(r,{name:`chevronDown`,className:`rotate-90`,size:18})}),(0,l.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,l.jsx)(`div`,{className:`p-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/15`,children:(0,l.jsx)(r,{name:`code`,size:18})}),(0,l.jsxs)(`div`,{children:[(0,l.jsxs)(`div`,{className:`flex items-center gap-1.5`,children:[(0,l.jsx)(`h1`,{className:`text-sm font-semibold tracking-tight leading-tight`,children:`Code Studio Pro`}),(0,l.jsx)(`span`,{className:`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30`,children:`IDE v2.4`})]}),(0,l.jsx)(`p`,{className:`text-[10px] text-neutral-500 dark:text-neutral-400`,children:`Sandbox JS • Python • Live Canvas • Offline`})]})]})]}),(0,l.jsxs)(`div`,{className:`flex items-center gap-1.5 sm:gap-2`,children:[(0,l.jsx)(`div`,{className:`flex bg-black/5 dark:bg-white/10 p-0.5 rounded-full border border-black/10 dark:border-white/15 text-[11px]`,children:[`javascript`,`python`,`html`].map(e=>(0,l.jsx)(`button`,{type:`button`,onClick:()=>{h(e),e===`html`?x(`preview`):b===`preview`&&x(`split`)},className:`px-2 py-0.5 rounded-full uppercase font-medium transition cursor-pointer ${m===e?`bg-black text-white dark:bg-white dark:text-black shadow-xs`:`text-neutral-500 hover:text-black dark:hover:text-white`}`,children:e===`javascript`?`JS`:e===`python`?`PY`:`UI`},e))}),(0,l.jsx)(`select`,{value:v,onChange:e=>ee(e.target.value),className:`text-xs py-1 px-2 rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-black dark:text-white focus:outline-none max-w-[140px] sm:max-w-none truncate`,children:Object.entries(u).map(([e,t])=>(0,l.jsx)(`option`,{value:e,className:`bg-white dark:bg-neutral-900 text-black dark:text-white`,children:t.label},e))})]})]}),(0,l.jsxs)(`div`,{className:`shrink-0 flex flex-wrap items-center justify-between gap-1.5 px-3 sm:px-4 py-1.5 bg-neutral-50 dark:bg-neutral-950/70 border-b border-black/5 dark:border-white/5 text-xs`,children:[(0,l.jsxs)(`div`,{className:`flex items-center gap-1.5 sm:gap-2`,children:[w?(0,l.jsxs)(`button`,{type:`button`,onClick:Y,className:`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition shadow-sm cursor-pointer`,title:`Detener ejecución inmediatamente`,children:[(0,l.jsx)(r,{name:`close`,size:13}),(0,l.jsx)(`span`,{children:`Detener`})]}):(0,l.jsxs)(`button`,{type:`button`,onClick:X,className:`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-white bg-black dark:bg-white dark:text-black hover:opacity-90 active:scale-95 transition shadow-sm cursor-pointer`,title:`Ejecutar código (Ctrl+Enter)`,children:[(0,l.jsx)(r,{name:`play`,size:13}),(0,l.jsx)(`span`,{children:m===`html`?`Actualizar Vista`:`Ejecutar`})]}),(0,l.jsxs)(`div`,{className:`hidden sm:flex bg-black/5 dark:bg-white/10 p-0.5 rounded-md border border-black/10 dark:border-white/15 text-[11px]`,children:[(0,l.jsx)(`button`,{type:`button`,onClick:()=>x(`split`),className:`px-2 py-0.5 rounded transition ${b===`split`?`bg-black text-white dark:bg-white dark:text-black font-semibold`:`text-neutral-500`}`,title:`Vista dividida (Editor + Terminal)`,children:`Dividido`}),(0,l.jsx)(`button`,{type:`button`,onClick:()=>x(`editor`),className:`px-2 py-0.5 rounded transition ${b===`editor`?`bg-black text-white dark:bg-white dark:text-black font-semibold`:`text-neutral-500`}`,title:`Maximizar editor`,children:`Editor`}),(0,l.jsx)(`button`,{type:`button`,onClick:()=>x(`terminal`),className:`px-2 py-0.5 rounded transition ${b===`terminal`?`bg-black text-white dark:bg-white dark:text-black font-semibold`:`text-neutral-500`}`,title:`Maximizar terminal`,children:`Terminal`}),m===`html`&&(0,l.jsx)(`button`,{type:`button`,onClick:()=>x(`preview`),className:`px-2 py-0.5 rounded transition ${b===`preview`?`bg-black text-white dark:bg-white dark:text-black font-semibold`:`text-neutral-500`}`,title:`Vista previa HTML/Canvas en vivo`,children:`Canvas`})]}),(0,l.jsxs)(`div`,{className:`flex bg-black/5 dark:bg-white/10 p-0.5 rounded-md border border-black/10 dark:border-white/15 text-[10px]`,children:[(0,l.jsx)(`button`,{type:`button`,onClick:()=>C(`xs`),className:`px-1.5 py-0.5 rounded ${S===`xs`?`bg-black text-white dark:bg-white dark:text-black`:`text-neutral-500`}`,title:`Fuente pequeña`,children:`A-`}),(0,l.jsx)(`button`,{type:`button`,onClick:()=>C(`sm`),className:`px-1.5 py-0.5 rounded ${S===`sm`?`bg-black text-white dark:bg-white dark:text-black`:`text-neutral-500`}`,title:`Fuente normal`,children:`A`}),(0,l.jsx)(`button`,{type:`button`,onClick:()=>C(`base`),className:`px-1.5 py-0.5 rounded ${S===`base`?`bg-black text-white dark:bg-white dark:text-black`:`text-neutral-500`}`,title:`Fuente grande`,children:`A+`})]}),(0,l.jsx)(`button`,{type:`button`,onClick:ne,className:`hidden md:flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer`,title:`Formatear sangría y código`,children:(0,l.jsx)(`span`,{children:`Formato`})}),(0,l.jsx)(`button`,{type:`button`,onClick:()=>N(e=>!e),className:`p-1.5 rounded-md transition cursor-pointer ${M?`bg-black text-white dark:bg-white dark:text-black`:`hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400`}`,title:`Buscar en código (Ctrl+F)`,children:(0,l.jsx)(r,{name:`search`,size:13})})]}),(0,l.jsxs)(`div`,{className:`flex items-center gap-1`,children:[n&&(0,l.jsxs)(`button`,{type:`button`,onClick:()=>$(),className:`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 border border-black/10 dark:border-white/15 transition cursor-pointer text-neutral-800 dark:text-neutral-200`,title:`Consultar al Agente sobre este código`,children:[(0,l.jsx)(r,{name:`sparkles`,size:13}),(0,l.jsx)(`span`,{className:`hidden sm:inline`,children:`Pedir al Agente`})]}),(0,l.jsxs)(`button`,{type:`button`,onClick:()=>W.current?.click(),className:`flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer`,title:`Abrir archivo desde dispositivo`,children:[(0,l.jsx)(r,{name:`upload`,size:13}),(0,l.jsx)(`span`,{className:`hidden md:inline`,children:`Abrir`})]}),(0,l.jsxs)(`button`,{type:`button`,onClick:ae,className:`flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer`,title:`Descargar script`,children:[(0,l.jsx)(r,{name:`download`,size:13}),(0,l.jsx)(`span`,{className:`hidden md:inline`,children:`Descargar`})]}),(0,l.jsxs)(`button`,{type:`button`,onClick:se,className:`flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer`,title:`Guardar código en Notas`,children:[(0,l.jsx)(r,{name:O?`check`:`copy`,size:13}),(0,l.jsx)(`span`,{className:`hidden md:inline`,children:O?`Guardado`:`Notas`})]}),(0,l.jsx)(`button`,{type:`button`,onClick:re,className:`flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer`,title:`Copiar código al portapapeles`,children:(0,l.jsx)(r,{name:E?`check`:`copy`,size:13})}),(0,l.jsx)(`button`,{type:`button`,onClick:()=>_(``),className:`p-1 rounded-md hover:bg-red-500/10 text-neutral-600 dark:text-neutral-400 hover:text-red-500 transition cursor-pointer`,title:`Limpiar editor`,children:(0,l.jsx)(r,{name:`trash`,size:13})})]})]}),M&&(0,l.jsxs)(`div`,{className:`shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 py-1.5 bg-neutral-100 dark:bg-neutral-900 border-b border-black/10 dark:border-white/10 text-xs`,children:[(0,l.jsxs)(`div`,{className:`flex items-center gap-2 flex-1`,children:[(0,l.jsx)(r,{name:`search`,size:13,className:`text-neutral-400`}),(0,l.jsx)(`input`,{type:`text`,value:P,onChange:e=>F(e.target.value),placeholder:`Buscar en el código...`,className:`bg-transparent flex-1 text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none font-mono`}),P&&(0,l.jsxs)(`span`,{className:`text-[11px] text-neutral-500`,children:[q,` `,q===1?`coincidencia`:`coincidencias`]})]}),(0,l.jsx)(`button`,{type:`button`,onClick:()=>{N(!1),F(``)},className:`text-neutral-400 hover:text-black dark:hover:text-white`,children:(0,l.jsx)(r,{name:`close`,size:13})})]}),(0,l.jsxs)(`div`,{className:`flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden`,children:[b!==`terminal`&&b!==`preview`&&(0,l.jsxs)(`div`,{className:`flex-1 flex flex-col min-h-[45%] md:min-h-0 border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10 relative overflow-hidden bg-white dark:bg-black`,children:[(0,l.jsxs)(`div`,{className:`flex-1 flex relative overflow-auto font-mono ${ce}`,children:[(0,l.jsx)(`div`,{className:`select-none py-3 px-2 text-right text-neutral-400 dark:text-neutral-600 bg-black/[0.02] dark:bg-white/[0.02] border-r border-black/5 dark:border-white/5 min-w-[38px]`,children:Array.from({length:K},(e,t)=>(0,l.jsx)(`div`,{children:t+1},t+1))}),(0,l.jsx)(`textarea`,{ref:H,value:g,onChange:e=>_(e.target.value),onKeyDown:te,spellCheck:!1,autoCapitalize:`off`,autoComplete:`off`,placeholder:`// Escribe código ${m.toUpperCase()} aquí...`,className:`flex-1 w-full h-full p-3 bg-transparent resize-none focus:outline-none text-neutral-900 dark:text-neutral-100 font-mono leading-relaxed`})]}),(0,l.jsxs)(`div`,{className:`shrink-0 flex items-center justify-between px-3 py-1 bg-black/[0.03] dark:bg-white/[0.03] border-t border-black/5 dark:border-white/5 text-[11px] text-neutral-500`,children:[(0,l.jsxs)(`span`,{children:[K,` líneas • `,g.length,` caracteres • `,m.toUpperCase()]}),(0,l.jsxs)(`span`,{children:[(0,l.jsx)(`kbd`,{className:`px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono`,children:`Ctrl+Enter`}),` para correr`]})]})]}),b===`preview`&&(0,l.jsxs)(`div`,{className:`flex-1 flex flex-col bg-neutral-950 p-2 overflow-hidden border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10`,children:[(0,l.jsxs)(`div`,{className:`shrink-0 flex items-center justify-between pb-1.5 text-[11px] text-neutral-400`,children:[(0,l.jsxs)(`span`,{className:`flex items-center gap-1.5`,children:[(0,l.jsx)(`span`,{className:`size-2 rounded-full bg-emerald-500 animate-pulse`}),(0,l.jsx)(`span`,{children:`Canvas / Iframe Render Live (Sandbox Offline)`})]}),(0,l.jsx)(`button`,{type:`button`,onClick:()=>x(`split`),className:`underline hover:text-white cursor-pointer`,children:`Volver al Editor`})]}),(0,l.jsx)(`iframe`,{ref:G,src:`/sandbox.html`,title:`Preview`,sandbox:`allow-scripts allow-modals`,onLoad:()=>{G.current?.contentWindow?.postMessage({type:`RENDER_HTML`,html:g},`*`)},className:`flex-1 w-full h-full rounded-lg bg-black border border-white/10 shadow-inner`})]}),b!==`preview`&&(0,l.jsxs)(`div`,{className:`flex-1 flex flex-col min-h-[40%] md:min-h-0 bg-neutral-950 text-neutral-100 font-mono text-xs overflow-hidden ${b===`terminal`?`w-full h-full`:``}`,children:[(0,l.jsxs)(`div`,{className:`shrink-0 flex items-center justify-between px-3 py-2 bg-black/60 border-b border-white/10`,children:[(0,l.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,l.jsx)(r,{name:`terminal`,size:14,className:`text-emerald-400`}),(0,l.jsx)(`span`,{className:`font-semibold text-neutral-200`,children:`Terminal & REPL`}),(0,l.jsxs)(`span`,{className:`flex items-center gap-1 text-[10px] text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20`,children:[(0,l.jsx)(`span`,{className:`size-1.5 rounded-full bg-emerald-400 animate-pulse`}),w?`Ejecutando...`:`Listo`]})]}),(0,l.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,l.jsx)(`button`,{type:`button`,onClick:ie,className:`text-[11px] text-neutral-400 hover:text-white transition cursor-pointer`,title:`Copiar salida de la terminal`,children:`Copiar`}),(0,l.jsx)(`button`,{type:`button`,onClick:()=>L([]),className:`text-[11px] text-neutral-400 hover:text-white transition cursor-pointer`,title:`Limpiar terminal (Ctrl+L)`,children:`Limpiar`})]})]}),(0,l.jsxs)(`div`,{className:`flex-1 p-3 overflow-y-auto space-y-2 select-text font-mono text-xs leading-relaxed`,children:[I.map(e=>(0,l.jsxs)(`div`,{className:`space-y-1`,children:[e.type===`system`&&(0,l.jsxs)(`div`,{className:`text-neutral-400 border-b border-white/5 pb-1 text-[11px] italic`,children:[`[SYS `,e.time,`] `,e.text]}),e.type===`input`&&(0,l.jsxs)(`div`,{className:`flex items-center gap-2 text-emerald-400 font-semibold pt-1`,children:[(0,l.jsx)(`span`,{className:`select-none text-emerald-500`,children:`jinx@edge:~$`}),(0,l.jsx)(`span`,{children:e.text.replace(/^>\s*/,``)}),(0,l.jsx)(`span`,{className:`ml-auto text-[10px] text-neutral-500 font-normal select-none`,children:e.time})]}),e.type===`info`&&(0,l.jsx)(`div`,{className:`bg-white/[0.03] p-1.5 rounded border border-white/5 text-neutral-300 whitespace-pre-wrap break-all`,children:e.text}),e.type===`bench`&&(0,l.jsx)(`div`,{className:`bg-emerald-950/40 p-2 rounded border border-emerald-500/30 text-emerald-300 font-semibold whitespace-pre-wrap break-all`,children:e.text}),e.type===`output`&&(0,l.jsxs)(`div`,{className:`bg-black/60 p-2 rounded border border-white/10 text-neutral-100 whitespace-pre-wrap break-all`,children:[e.text,e.durationMs!==void 0&&(0,l.jsxs)(`div`,{className:`text-[10px] text-neutral-500 text-right mt-1 select-none`,children:[`Completado en `,e.durationMs,`ms`]})]}),e.type===`error`&&(0,l.jsxs)(`div`,{className:`bg-rose-950/40 p-2 rounded border border-rose-500/30 text-rose-300 whitespace-pre-wrap break-all`,children:[(0,l.jsxs)(`div`,{className:`font-semibold flex items-center justify-between`,children:[(0,l.jsx)(`span`,{children:e.text}),n&&(0,l.jsx)(`button`,{type:`button`,onClick:()=>$(`Ocurrió el siguiente error en Code Studio Pro al ejecutar mi código (${m}):\n\n${e.text}\n\nCódigo actual:\n\`\`\`${m}\n${g}\n\`\`\`\n\n¿Cómo puedo solucionarlo?`),className:`text-[10px] px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 border border-rose-500/40 cursor-pointer ml-2`,children:`Resolver con IA`})]}),e.durationMs!==void 0&&(0,l.jsxs)(`div`,{className:`text-[10px] text-rose-400/60 text-right mt-1 select-none`,children:[`Fallo tras `,e.durationMs,`ms`]})]})]},e.id)),(0,l.jsx)(`div`,{ref:U})]}),(0,l.jsxs)(`form`,{onSubmit:Z,className:`shrink-0 flex items-center gap-2 p-2 bg-black/80 border-t border-white/10`,children:[(0,l.jsx)(`span`,{className:`text-emerald-400 font-bold select-none`,children:`>`}),(0,l.jsx)(`input`,{type:`text`,value:A,onChange:e=>j(e.target.value),onKeyDown:Q,placeholder:`REPL: Escribe un comando (help, run, clear, reset) o expresión JS/Py...`,className:`flex-1 bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none font-mono`}),(0,l.jsx)(`button`,{type:`submit`,className:`text-[11px] px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer`,children:`Eval`})]})]})]})]})}export{d as CodeView,d as default};