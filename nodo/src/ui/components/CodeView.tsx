import { useState, useRef, useEffect } from 'react'
import { Icon } from './Icon'
import { executeSandboxCode, stopCurrentExecution, globalSandboxSession } from '../../core/agent/tools/codeRunner'
import { createNote } from '../../core/db/repo'
import { activeNativeModel } from '../../core/native/bridge'

interface CodeViewProps {
  onBack: () => void
  onSendToChat?: (promptText: string) => void
  initialCode?: string
  initialLang?: Language
  autoRun?: boolean
}

type Language = 'javascript' | 'python' | 'html'
type LayoutMode = 'split' | 'editor' | 'terminal' | 'preview'
type FontSize = 'xs' | 'sm' | 'base'

interface TerminalEntry {
  id: string
  type: 'input' | 'output' | 'error' | 'info' | 'bench' | 'system'
  text: string
  time: string
  durationMs?: number
}

interface Template {
  label: string
  lang: Language
  code: string
}

const TEMPLATES: Record<string, Template> = {
  benchmark: {
    label: 'Benchmark: Búsqueda Binaria vs Lineal',
    lang: 'javascript',
    code: `// Benchmark de Alto Rendimiento en Sandbox
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
};`,
  },

  python_montecarlo: {
    label: 'Python: Estimación Monte Carlo de Pi',
    lang: 'python',
    code: `# Simulación Monte Carlo para calcular Pi 100% offline
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

return { "pi_estimado": pi_estimado, "error": error_porcentual }`,
  },

  canvas_visual: {
    label: 'Visual: Canvas Animado de Partículas',
    lang: 'html',
    code: `<!DOCTYPE html>
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
  </script>
</body>
</html>`,
  },

  quicksort: {
    label: 'Algoritmos: QuickSort con Métricas',
    lang: 'javascript',
    code: `// Algoritmo QuickSort In-Place con análisis estadístico
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

return { benchmark: benchRes, stats };`,
  },

  crypto_security: {
    label: 'Seguridad: Hashes SHA-256 & UUID',
    lang: 'javascript',
    code: `// Utilidades criptográficas y seguridad local
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
};`,
  },

  primes: {
    label: 'Criba de Eratóstenes y Estadísticas',
    lang: 'javascript',
    code: `// Criba de Eratóstenes usando el namespace nativo de Jinx
const max = 500;
const primos = jinx.primes(max);

console.log("Números primos menores a " + max + ":", primos.length);
console.log("Primeros 15:", primos.slice(0, 15).join(", "));

const stats = jinx.stats(primos);
console.log("Estadísticas de la distribución de primos:");
console.log("• Media:", stats.mean);
console.log("• Mediana:", stats.median);
console.log("• Desviación Estándar:", stats.stdDev);

return stats;`,
  },

  mock_data: {
    label: 'Generador de Datos Mock y Análisis',
    lang: 'javascript',
    code: `// Generación de datos sintéticos estructurados
const usuarios = jinx.mockData('users', 10);
const metricas = jinx.mockData('metrics', 8);

console.log("Usuarios generados:", usuarios.length);
usuarios.forEach(u => console.log(\`• [\${u.id}] \${u.name} - \${u.role} (Score: \${u.score})\`));

const scores = usuarios.map(u => u.score);
const statsScores = jinx.stats(scores);
console.log("Estadísticas de puntuación:", statsScores);

return { usuarios, statsScores };`,
  },

  generate_pdf: {
    label: 'Generador de Documento PDF Profesional',
    lang: 'javascript',
    code: `// Generador de Documento PDF Profesional 100% Offline
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
return res;`,
  },

  generate_qr_csv: {
    label: 'Generador de Código QR y Hoja CSV',
    lang: 'javascript',
    code: `// Generación de Código QR y Hoja de Cálculo CSV 100% Offline
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
return { qrSvgLength: qrSvg.length, csv };`,
  },
}

export function CodeView({ onBack, onSendToChat, initialCode, initialLang, autoRun }: CodeViewProps) {
  const [lang, setLang] = useState<Language>(initialLang || 'javascript')
  const [code, setCode] = useState(initialCode ?? TEMPLATES.benchmark!.code)
  const [selectedTemplate, setSelectedTemplate] = useState('benchmark')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initialLang === 'html' || autoRun ? 'preview' : 'split')
  const [fontSize, setFontSize] = useState<FontSize>('sm')
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const [replInput, setReplInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Terminal interactiva y comandos CLI
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([
    {
      id: 'init-1',
      type: 'system',
      text: 'Jinx Code Studio Pro Terminal v2.4 [Listo]. Escribe "help" para ver los comandos disponibles.',
      time: new Date().toLocaleTimeString(),
    },
  ])
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const terminalEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewIframeRef = useRef<HTMLIFrameElement>(null)

  const lineCount = code.split('\n').length
  const matchCount = searchQuery.trim()
    ? (code.match(new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length
    : 0

  // Si llegan propiedades iniciales (p.ej. desde intención codegen del agente o chat)
  useEffect(() => {
    if (initialCode !== undefined && initialCode !== null) {
      setCode(initialCode)
      const targetLang = initialLang || 'html'
      setLang(targetLang)
      if (targetLang === 'html' || autoRun) {
        setLayoutMode('preview')
      } else {
        setLayoutMode('split')
      }
    }
  }, [initialCode, initialLang, autoRun])

  // Escuchar logs y errores del iframe del preview en vivo o scripts ejecutados
  useEffect(() => {
    const handleWindowMessage = (e: MessageEvent) => {
      const data = e.data
      if (data && data.type === 'SANDBOX_LOG' && data.text) {
        addTerminalEntry({
          type: data.level === 'error' ? 'error' : 'output',
          text: data.text,
        })
      }
    }
    window.addEventListener('message', handleWindowMessage)
    return () => window.removeEventListener('message', handleWindowMessage)
  }, [])

  // Actualizar el iframe de preview cada vez que cambia el código HTML y estamos en preview
  useEffect(() => {
    if (layoutMode === 'preview' && previewIframeRef.current?.contentWindow) {
      previewIframeRef.current.contentWindow.postMessage({ type: 'RENDER_HTML', html: code }, '*')
    }
  }, [code, layoutMode])

  // Autoscroll de terminal cada vez que se agrega una entrada
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [terminalEntries])

  const addTerminalEntry = (entry: Omit<TerminalEntry, 'id' | 'time'>) => {
    const newEntry: TerminalEntry = {
      ...entry,
      id: 'entry-' + Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
    }
    setTerminalEntries((prev) => [...prev, newEntry])
  }

  const handleStopExecution = () => {
    stopCurrentExecution()
    setRunning(false)
    addTerminalEntry({
      type: 'info',
      text: '✕ Ejecución detenida manualmente por el usuario.',
    })
  }

  const handleRun = async () => {
    setRunning(true)
    const t0 = performance.now()
    try {
      if (lang === 'html') {
        setLayoutMode('preview')
        previewIframeRef.current?.contentWindow?.postMessage({ type: 'RENDER_HTML', html: code }, '*')
        addTerminalEntry({
          type: 'info',
          text: '✓ Vista previa HTML/Canvas actualizada en pestaña Live Render.',
        })
        return
      }

      addTerminalEntry({
        type: 'input',
        text: `run [${lang.toUpperCase()}] (${lineCount} líneas)`,
      })

      const res = await executeSandboxCode(
        code,
        lang === 'python' ? 'python' : 'javascript',
        8000,
        undefined,
        (liveLog) => addTerminalEntry({ type: 'output', text: liveLog })
      )
      const durationMs = Math.round(performance.now() - t0)

      if (res.benchmark && res.benchmark.length > 0) {
        res.benchmark.forEach((b) => {
          addTerminalEntry({
            type: 'bench',
            text: `⏱ [BENCHMARK] "${b.name}": ${b.iterations} iteraciones en ${b.totalTimeMs}ms (${b.opsPerSec.toLocaleString()} ops/s)`,
          })
        })
      }

      if (res.result !== undefined && res.result !== '') {
        addTerminalEntry({
          type: 'output',
          text: `<<< ${res.result}`,
          durationMs,
        })
      }

      if (res.error) {
        addTerminalEntry({
          type: 'error',
          text: `✕ Error: ${res.error}`,
          durationMs,
        })
      } else if ((!res.logs || res.logs.length === 0) && res.result === undefined) {
        addTerminalEntry({
          type: 'info',
          text: `✓ Ejecutado con éxito (${durationMs}ms, sin retorno)`,
          durationMs,
        })
      }
    } catch (e: any) {
      addTerminalEntry({
        type: 'error',
        text: `✕ Excepción no controlada: ${e.message || String(e)}`,
      })
    } finally {
      setRunning(false)
    }
  }

  const handleRunRepl = async (e: React.FormEvent) => {
    e.preventDefault()
    const query = replInput.trim()
    if (!query) return

    // Guardar en historial de comandos
    setCommandHistory((prev) => [...prev, query])
    setHistoryIndex(-1)
    setReplInput('')

    addTerminalEntry({ type: 'input', text: `> ${query}` })

    // Manejo de comandos integrados del CLI Terminal
    const lower = query.toLowerCase()
    if (lower === 'help' || lower === '?') {
      addTerminalEntry({
        type: 'info',
        text: `Comandos Disponibles en la Terminal:
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
• <expresión>  - Cualquier expresión JS se evalúa directamente con memoria de sesión`,
      })
      return
    }

    if (lower === 'clear' || lower === 'cls') {
      setTerminalEntries([])
      return
    }

    if (lower === 'reset') {
      for (const k of Object.keys(globalSandboxSession)) delete globalSandboxSession[k]
      addTerminalEntry({ type: 'info', text: '✓ Variables y memoria de sesión reiniciadas con éxito.' })
      return
    }

    if (lower === 'history') {
      addTerminalEntry({
        type: 'info',
        text: commandHistory.length
          ? commandHistory.map((cmd, i) => `  ${i + 1}. ${cmd}`).join('\n')
          : '(Historial vacío)',
      })
      return
    }

    if (lower === 'run') {
      void handleRun()
      return
    }

    if (lower === 'bench') {
      const t0 = performance.now()
      let acc = 0
      for (let i = 0; i < 100000; i++) acc += (i * 3) ^ 7
      const t = Math.round((performance.now() - t0) * 100) / 100
      addTerminalEntry({
        type: 'bench',
        text: `⏱ CPU Stress Benchmark: 100,000 operaciones en ${t}ms (${Math.round((100000 / (t || 0.001)) * 1000).toLocaleString()} ops/s). Checksum: ${acc}`,
      })
      return
    }

    if (lower === 'models') {
      const active = activeNativeModel()
      addTerminalEntry({
        type: 'info',
        text: `Modelo Nativo Activo: ${active || 'Ninguno cargado (descarga desde pestaña Modelos: MiniCPM, Gemma, Qwen)'}`,
      })
      return
    }

    if (lower === 'date') {
      addTerminalEntry({ type: 'info', text: new Date().toLocaleString() })
      return
    }

    if (lower === 'stats') {
      addTerminalEntry({
        type: 'info',
        text: `Métricas:
• Lenguaje: ${lang.toUpperCase()}
• Líneas de código: ${lineCount}
• Caracteres: ${code.length}
• Variables en sesión: ${Object.keys(globalSandboxSession).length} (${Object.keys(globalSandboxSession).join(', ') || 'ninguna'})`,
      })
      return
    }

    if (lower === 'theme') {
      const isDark = document.documentElement.classList.contains('dark')
      if (isDark) {
        document.documentElement.classList.remove('dark')
        addTerminalEntry({ type: 'info', text: 'Tema cambiado a: Claro' })
      } else {
        document.documentElement.classList.add('dark')
        addTerminalEntry({ type: 'info', text: 'Tema cambiado a: Oscuro' })
      }
      return
    }

    if (lower.startsWith('echo ')) {
      addTerminalEntry({ type: 'output', text: query.slice(5) })
      return
    }

    // Evaluación en Sandbox con persistencia de variables
    const isPyCmd = lower.startsWith('py ')
    const evalTarget = isPyCmd ? query.slice(3) : lower.startsWith('eval ') ? query.slice(5) : query
    const evalLang = isPyCmd ? 'python' : 'javascript'

    const t0 = performance.now()
    const res = await executeSandboxCode(evalTarget, evalLang)
    const durationMs = Math.round(performance.now() - t0)

    if (res.logs && res.logs.length > 0) {
      res.logs.forEach((log) => addTerminalEntry({ type: 'output', text: log }))
    }

    if (res.result !== undefined && res.result !== '') {
      addTerminalEntry({ type: 'output', text: `< ${res.result}`, durationMs })
    }

    if (res.error) {
      addTerminalEntry({ type: 'error', text: `✕ ${res.error}`, durationMs })
    }
  }

  // Navegación en historial de comandos mediante teclas Flecha Arriba / Abajo
  const handleReplKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length === 0) return
      const nextIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(nextIndex)
      setReplInput(commandHistory[nextIndex] || '')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex === -1) return
      const nextIndex = historyIndex + 1
      if (nextIndex >= commandHistory.length) {
        setHistoryIndex(-1)
        setReplInput('')
      } else {
        setHistoryIndex(nextIndex)
        setReplInput(commandHistory[nextIndex] || '')
      }
    }
  }

  const handleTemplateChange = (key: string) => {
    setSelectedTemplate(key)
    const t = TEMPLATES[key]
    if (t) {
      setLang(t.lang)
      setCode(t.code)
      if (t.lang === 'html') setLayoutMode('preview')
      addTerminalEntry({
        type: 'info',
        text: `Plantilla cargada: "${t.label}" (${t.lang.toUpperCase()})`,
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newCode = code.substring(0, start) + '  ' + code.substring(end)
      setCode(newCode)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleRun()
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault()
      setTerminalEntries([])
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      setShowSearch((prev) => !prev)
    }
  }

  const handleFormatCode = () => {
    try {
      const lines = code.split('\n')
      let indentLevel = 0
      const formatted = lines.map((raw) => {
        const trimmed = raw.trim()
        if (!trimmed) return ''
        if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
          indentLevel = Math.max(0, indentLevel - 1)
        }
        const lineWithIndent = '  '.repeat(indentLevel) + trimmed
        if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
          indentLevel++
        }
        return lineWithIndent
      })
      setCode(formatted.join('\n'))
      addTerminalEntry({ type: 'info', text: '✓ Código formateado con sangría de 2 espacios.' })
    } catch {
      // Ignorar
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyTerminal = () => {
    const text = terminalEntries.map((e) => `[${e.time}] ${e.text}`).join('\n')
    navigator.clipboard.writeText(text)
    addTerminalEntry({ type: 'info', text: '✓ Registros de la terminal copiados al portapapeles.' })
  }

  const handleDownloadFile = () => {
    const ext = lang === 'javascript' ? 'js' : lang === 'python' ? 'py' : 'html'
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `script_${selectedTemplate}_${Date.now()}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    addTerminalEntry({ type: 'info', text: `📄 Archivo descargado: ${a.download}` })
  }

  const handleImportFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (content !== undefined) {
        setCode(content)
        const name = file.name.toLowerCase()
        if (name.endsWith('.py')) setLang('python')
        else if (name.endsWith('.html') || name.endsWith('.htm')) {
          setLang('html')
          setLayoutMode('preview')
        } else {
          setLang('javascript')
        }
        addTerminalEntry({ type: 'info', text: `✓ Archivo cargado con éxito: "${file.name}"` })
      }
    }
    reader.readAsText(file)
  }

  const handleSaveNote = async () => {
    try {
      const title = `Snippet [${lang.toUpperCase()}]: ${TEMPLATES[selectedTemplate]?.label || 'Código Jinx'}`
      await createNote(title, `\`\`\`${lang}\n${code}\n\`\`\`\n\nGuardado desde Code Studio Pro`)
      setNoteSaved(true)
      addTerminalEntry({ type: 'info', text: `✓ Código guardado en el gestor de Notas.` })
      setTimeout(() => setNoteSaved(false), 2500)
    } catch {
      // Ignorar
    }
  }

  const handleAskAgent = (customPrompt?: string) => {
    if (!onSendToChat) return
    const prompt =
      customPrompt ||
      `Analiza, optimiza o explica este código (${lang}) desarrollado en Code Studio Pro:\n\n\`\`\`${lang}\n${code}\n\`\`\``
    onSendToChat(prompt)
  }

  const fontSizeClass =
    fontSize === 'xs'
      ? 'text-[11px] leading-relaxed'
      : fontSize === 'base'
      ? 'text-sm md:text-base leading-relaxed'
      : 'text-xs md:text-sm leading-relaxed'

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-black text-black dark:text-white transition-colors duration-200">
      {/* Input oculto para abrir archivos locales */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".js,.ts,.py,.html,.css,.json,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImportFile(file)
          e.target.value = ''
        }}
      />

      {/* Top Header */}
      <header className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 border-b border-black/10 dark:border-white/10 backdrop-blur-xl bg-white/70 dark:bg-black/70 z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer"
            title="Volver"
          >
            <Icon name="chevronDown" className="rotate-90" size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/15">
              <Icon name="code" size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-semibold tracking-tight leading-tight">Code Studio Pro</h1>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  IDE v2.4
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Sandbox JS • Python • Live Canvas • Offline</p>
            </div>
          </div>
        </div>

        {/* Layout & Language selector */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Lenguajes */}
          <div className="flex bg-black/5 dark:bg-white/10 p-0.5 rounded-full border border-black/10 dark:border-white/15 text-[11px]">
            {(['javascript', 'python', 'html'] as Language[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLang(l)
                  if (l === 'html') setLayoutMode('preview')
                  else if (layoutMode === 'preview') setLayoutMode('split')
                }}
                className={`px-2 py-0.5 rounded-full uppercase font-medium transition cursor-pointer ${
                  lang === l
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                    : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                {l === 'javascript' ? 'JS' : l === 'python' ? 'PY' : 'UI'}
              </button>
            ))}
          </div>

          {/* Plantillas Selector */}
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="text-xs py-1 px-2 rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-black dark:text-white focus:outline-none max-w-[140px] sm:max-w-none truncate"
          >
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <option key={key} value={key} className="bg-white dark:bg-neutral-900 text-black dark:text-white">
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Action Toolbar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-1.5 px-3 sm:px-4 py-1.5 bg-neutral-50 dark:bg-neutral-950/70 border-b border-black/5 dark:border-white/5 text-xs">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Botón Ejecutar o Detener */}
          {running ? (
            <button
              type="button"
              onClick={handleStopExecution}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition shadow-sm cursor-pointer"
              title="Detener ejecución inmediatamente"
            >
              <Icon name="close" size={13} />
              <span>Detener</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRun}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-white bg-black dark:bg-white dark:text-black hover:opacity-90 active:scale-95 transition shadow-sm cursor-pointer"
              title="Ejecutar código (Ctrl+Enter)"
            >
              <Icon name="play" size={13} />
              <span>{lang === 'html' ? 'Actualizar Vista' : 'Ejecutar'}</span>
            </button>
          )}

          {/* Selector de Modos de Vista */}
          <div className="hidden sm:flex bg-black/5 dark:bg-white/10 p-0.5 rounded-md border border-black/10 dark:border-white/15 text-[11px]">
            <button
              type="button"
              onClick={() => setLayoutMode('split')}
              className={`px-2 py-0.5 rounded transition ${
                layoutMode === 'split' ? 'bg-black text-white dark:bg-white dark:text-black font-semibold' : 'text-neutral-500'
              }`}
              title="Vista dividida (Editor + Terminal)"
            >
              Dividido
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('editor')}
              className={`px-2 py-0.5 rounded transition ${
                layoutMode === 'editor' ? 'bg-black text-white dark:bg-white dark:text-black font-semibold' : 'text-neutral-500'
              }`}
              title="Maximizar editor"
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('terminal')}
              className={`px-2 py-0.5 rounded transition ${
                layoutMode === 'terminal' ? 'bg-black text-white dark:bg-white dark:text-black font-semibold' : 'text-neutral-500'
              }`}
              title="Maximizar terminal"
            >
              Terminal
            </button>
            {lang === 'html' && (
              <button
                type="button"
                onClick={() => setLayoutMode('preview')}
                className={`px-2 py-0.5 rounded transition ${
                  layoutMode === 'preview' ? 'bg-black text-white dark:bg-white dark:text-black font-semibold' : 'text-neutral-500'
                }`}
                title="Vista previa HTML/Canvas en vivo"
              >
                Canvas
              </button>
            )}
          </div>

          {/* Tamaño de fuente */}
          <div className="flex bg-black/5 dark:bg-white/10 p-0.5 rounded-md border border-black/10 dark:border-white/15 text-[10px]">
            <button
              type="button"
              onClick={() => setFontSize('xs')}
              className={`px-1.5 py-0.5 rounded ${fontSize === 'xs' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-neutral-500'}`}
              title="Fuente pequeña"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize('sm')}
              className={`px-1.5 py-0.5 rounded ${fontSize === 'sm' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-neutral-500'}`}
              title="Fuente normal"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSize('base')}
              className={`px-1.5 py-0.5 rounded ${fontSize === 'base' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-neutral-500'}`}
              title="Fuente grande"
            >
              A+
            </button>
          </div>

          {/* Formatear código */}
          <button
            type="button"
            onClick={handleFormatCode}
            className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer"
            title="Formatear sangría y código"
          >
            <span>Formato</span>
          </button>

          {/* Buscador de código */}
          <button
            type="button"
            onClick={() => setShowSearch((prev) => !prev)}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              showSearch
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400'
            }`}
            title="Buscar en código (Ctrl+F)"
          >
            <Icon name="search" size={13} />
          </button>
        </div>

        {/* Acciones de Guardar / Exportar / Importar / Chat */}
        <div className="flex items-center gap-1">
          {onSendToChat && (
            <button
              type="button"
              onClick={() => handleAskAgent()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 border border-black/10 dark:border-white/15 transition cursor-pointer text-neutral-800 dark:text-neutral-200"
              title="Consultar al Agente sobre este código"
            >
              <Icon name="sparkles" size={13} />
              <span className="hidden sm:inline">Pedir al Agente</span>
            </button>
          )}

          {/* Cargar archivo local */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer"
            title="Abrir archivo desde dispositivo"
          >
            <Icon name="upload" size={13} />
            <span className="hidden md:inline">Abrir</span>
          </button>

          {/* Descargar script */}
          <button
            type="button"
            onClick={handleDownloadFile}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer"
            title="Descargar script"
          >
            <Icon name="download" size={13} />
            <span className="hidden md:inline">Descargar</span>
          </button>

          {/* Guardar en Notas */}
          <button
            type="button"
            onClick={handleSaveNote}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer"
            title="Guardar código en Notas"
          >
            <Icon name={noteSaved ? 'check' : 'copy'} size={13} />
            <span className="hidden md:inline">{noteSaved ? 'Guardado' : 'Notas'}</span>
          </button>

          {/* Copiar código */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition cursor-pointer"
            title="Copiar código al portapapeles"
          >
            <Icon name={copied ? 'check' : 'copy'} size={13} />
          </button>

          {/* Limpiar código */}
          <button
            type="button"
            onClick={() => setCode('')}
            className="p-1 rounded-md hover:bg-red-500/10 text-neutral-600 dark:text-neutral-400 hover:text-red-500 transition cursor-pointer"
            title="Limpiar editor"
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda Desplegable */}
      {showSearch && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 py-1.5 bg-neutral-100 dark:bg-neutral-900 border-b border-black/10 dark:border-white/10 text-xs">
          <div className="flex items-center gap-2 flex-1">
            <Icon name="search" size={13} className="text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en el código..."
              className="bg-transparent flex-1 text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none font-mono"
            />
            {searchQuery && (
              <span className="text-[11px] text-neutral-500">
                {matchCount} {matchCount === 1 ? 'coincidencia' : 'coincidencias'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowSearch(false)
              setSearchQuery('')
            }}
            className="text-neutral-400 hover:text-black dark:hover:text-white"
          >
            <Icon name="close" size={13} />
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Editor de Código (Visible en modos 'split' y 'editor') */}
        {layoutMode !== 'terminal' && layoutMode !== 'preview' && (
          <div className="flex-1 flex flex-col min-h-[45%] md:min-h-0 border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10 relative overflow-hidden bg-white dark:bg-black">
            <div className={`flex-1 flex relative overflow-auto font-mono ${fontSizeClass}`}>
              {/* Números de línea */}
              <div className="select-none py-3 px-2 text-right text-neutral-400 dark:text-neutral-600 bg-black/[0.02] dark:bg-white/[0.02] border-r border-black/5 dark:border-white/5 min-w-[38px]">
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i + 1}>{i + 1}</div>
                ))}
              </div>

              {/* Textarea del editor */}
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                placeholder={`// Escribe código ${lang.toUpperCase()} aquí...`}
                className="flex-1 w-full h-full p-3 bg-transparent resize-none focus:outline-none text-neutral-900 dark:text-neutral-100 font-mono leading-relaxed"
              />
            </div>

            {/* Barra de estado inferior del editor */}
            <div className="shrink-0 flex items-center justify-between px-3 py-1 bg-black/[0.03] dark:bg-white/[0.03] border-t border-black/5 dark:border-white/5 text-[11px] text-neutral-500">
              <span>
                {lineCount} líneas • {code.length} caracteres • {lang.toUpperCase()}
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">Ctrl+Enter</kbd> para correr
              </span>
            </div>
          </div>
        )}

        {/* Vista Previa HTML / Canvas (Si está activa) */}
        {layoutMode === 'preview' && (
          <div className="flex-1 flex flex-col bg-neutral-950 p-2 overflow-hidden border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10">
            <div className="shrink-0 flex items-center justify-between pb-1.5 text-[11px] text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Canvas / Iframe Render Live (Sandbox Offline)</span>
              </span>
              <button
                type="button"
                onClick={() => setLayoutMode('split')}
                className="underline hover:text-white cursor-pointer"
              >
                Volver al Editor
              </button>
            </div>
            <iframe
              ref={previewIframeRef}
              src="/sandbox.html"
              title="Preview"
              sandbox="allow-scripts allow-modals"
              onLoad={() => {
                previewIframeRef.current?.contentWindow?.postMessage({ type: 'RENDER_HTML', html: code }, '*')
              }}
              className="flex-1 w-full h-full rounded-lg bg-black border border-white/10 shadow-inner"
            />
          </div>
        )}

        {/* Terminal & Output Console (Visible en 'split' y 'terminal') */}
        {layoutMode !== 'preview' && (
          <div
            className={`flex-1 flex flex-col min-h-[40%] md:min-h-0 bg-neutral-950 text-neutral-100 font-mono text-xs overflow-hidden ${
              layoutMode === 'terminal' ? 'w-full h-full' : ''
            }`}
          >
            {/* Header de la Terminal */}
            <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-black/60 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Icon name="terminal" size={14} className="text-emerald-400" />
                <span className="font-semibold text-neutral-200">Terminal & REPL</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {running ? 'Ejecutando...' : 'Listo'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyTerminal}
                  className="text-[11px] text-neutral-400 hover:text-white transition cursor-pointer"
                  title="Copiar salida de la terminal"
                >
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={() => setTerminalEntries([])}
                  className="text-[11px] text-neutral-400 hover:text-white transition cursor-pointer"
                  title="Limpiar terminal (Ctrl+L)"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Cuerpo de la Terminal interactiva con logs y registros */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2 select-text font-mono text-xs leading-relaxed">
              {terminalEntries.map((entry) => (
                <div key={entry.id} className="space-y-1">
                  {entry.type === 'system' && (
                    <div className="text-neutral-400 border-b border-white/5 pb-1 text-[11px] italic">
                      [SYS {entry.time}] {entry.text}
                    </div>
                  )}

                  {entry.type === 'input' && (
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold pt-1">
                      <span className="select-none text-emerald-500">jinx@edge:~$</span>
                      <span>{entry.text.replace(/^>\s*/, '')}</span>
                      <span className="ml-auto text-[10px] text-neutral-500 font-normal select-none">
                        {entry.time}
                      </span>
                    </div>
                  )}

                  {entry.type === 'info' && (
                    <div className="bg-white/[0.03] p-1.5 rounded border border-white/5 text-neutral-300 whitespace-pre-wrap break-all">
                      {entry.text}
                    </div>
                  )}

                  {entry.type === 'bench' && (
                    <div className="bg-emerald-950/40 p-2 rounded border border-emerald-500/30 text-emerald-300 font-semibold whitespace-pre-wrap break-all">
                      {entry.text}
                    </div>
                  )}

                  {entry.type === 'output' && (
                    <div className="bg-black/60 p-2 rounded border border-white/10 text-neutral-100 whitespace-pre-wrap break-all">
                      {entry.text}
                      {entry.durationMs !== undefined && (
                        <div className="text-[10px] text-neutral-500 text-right mt-1 select-none">
                          Completado en {entry.durationMs}ms
                        </div>
                      )}
                    </div>
                  )}

                  {entry.type === 'error' && (
                    <div className="bg-rose-950/40 p-2 rounded border border-rose-500/30 text-rose-300 whitespace-pre-wrap break-all">
                      <div className="font-semibold flex items-center justify-between">
                        <span>{entry.text}</span>
                        {onSendToChat && (
                          <button
                            type="button"
                            onClick={() =>
                              handleAskAgent(
                                `Ocurrió el siguiente error en Code Studio Pro al ejecutar mi código (${lang}):\n\n${entry.text}\n\nCódigo actual:\n\`\`\`${lang}\n${code}\n\`\`\`\n\n¿Cómo puedo solucionarlo?`
                              )
                            }
                            className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 border border-rose-500/40 cursor-pointer ml-2"
                          >
                            Resolver con IA
                          </button>
                        )}
                      </div>
                      {entry.durationMs !== undefined && (
                        <div className="text-[10px] text-rose-400/60 text-right mt-1 select-none">
                          Fallo tras {entry.durationMs}ms
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>

            {/* Prompt interactivo de la Terminal / REPL */}
            <form
              onSubmit={handleRunRepl}
              className="shrink-0 flex items-center gap-2 p-2 bg-black/80 border-t border-white/10"
            >
              <span className="text-emerald-400 font-bold select-none">&gt;</span>
              <input
                type="text"
                value={replInput}
                onChange={(e) => setReplInput(e.target.value)}
                onKeyDown={handleReplKeyDown}
                placeholder="REPL: Escribe un comando (help, run, clear, reset) o expresión JS/Py..."
                className="flex-1 bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none font-mono"
              />
              <button
                type="submit"
                className="text-[11px] px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer"
              >
                Eval
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default CodeView
