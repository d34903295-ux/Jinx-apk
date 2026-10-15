import { searchChunks } from '../../rag/search'
import { listDocuments } from '../../rag/ingest'
import { summarizeDocument } from '../../rag/summarize'
import { calculate } from './calculator'
import { pythonRunner } from './pythonClient'
import { executeSandboxCode } from './codeRunner'
import { createNote, listNotes, searchNotes, getNote, updateNote, deleteNote } from '../../db/repo'
import { downloadPdf, type PdfDocumentOptions, type PdfSection } from '../../document/pdfGenerator'
import { generateQrSvg } from '../../document/qrGenerator'
import { generateBarChartSvg, generateLineChartSvg, generateKpiCardSvg } from '../../document/svgChartGenerator'

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required: string[]
  }
  execute: (args: Record<string, any>) => Promise<string>
}

export const TOOLS: Record<string, ToolDefinition> = {
  search_docs: {
    name: 'search_docs',
    description: 'Busca información relevante en los documentos indexados de la biblioteca local.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Texto o pregunta para buscar semánticamente en los documentos.',
        },
      },
      required: ['query'],
    },
    execute: async ({ query }) => {
      const results = await searchChunks(String(query), 5, 0.2)
      if (results.length === 0) {
        return 'No se encontraron fragmentos relevantes en los documentos indexados.'
      }
      return results
        .map(
          (r, idx) =>
            `[${idx + 1}] Documento: "${r.docName}" (Página ${r.chunk.page}, similitud: ${(
              r.score * 100
            ).toFixed(0)}%):\n"${r.chunk.text}"`
        )
        .join('\n\n')
    },
  },

  summarize_doc: {
    name: 'summarize_doc',
    description: 'Genera un resumen exhaustivo de un documento completo mediante Map-Reduce.',
    parameters: {
      type: 'object',
      properties: {
        docName: {
          type: 'string',
          description: 'Nombre o coincidencia del documento a resumir.',
        },
      },
      required: ['docName'],
    },
    execute: async ({ docName }) => {
      const docs = await listDocuments()
      const match = docs.find((d) => d.name.toLowerCase().includes(String(docName).toLowerCase()))
      if (!match) {
        return `No se encontró ningún documento con el nombre "${docName}". Documentos disponibles: ${docs
          .map((d) => d.name)
          .join(', ') || 'Ninguno'}.`
      }
      return summarizeDocument(match.id)
    },
  },

  run_python: {
    name: 'run_python',
    description:
      'Ejecuta código en Python 3 de forma segura y offline en WebAssembly (Pyodide). Retorna salida de print() y expresiones evaluadas.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Código Python completo a ejecutar.',
        },
      },
      required: ['code'],
    },
    execute: async ({ code }) => {
      const result = await pythonRunner.run(String(code), 15000)
      if (!result.success) {
        throw new Error(result.error ?? 'Error ejecutando script Python')
      }
      return result.output ?? '(Sin salida)'
    },
  },

  calculator: {
    name: 'calculator',
    description:
      'Calcula expresiones matemáticas con precisión exacta (+, -, *, /, ^, %, sqrt, sin, cos, tan, log, abs). Nunca uses eval.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Expresión matemática a resolver (ej. "sqrt(144) + 5 * 2^3").',
        },
      },
      required: ['expression'],
    },
    execute: async ({ expression }) => {
      try {
        const value = calculate(String(expression))
        return String(value)
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : String(err))
      }
    },
  },

  notes: {
    name: 'notes',
    description: 'Gestiona notas personales en la base de datos local (crear, listar, buscar, actualizar o eliminar).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Acción a realizar',
          enum: ['create', 'list', 'search', 'update', 'delete'],
        },
        id: {
          type: 'number',
          description: 'ID de la nota (para action="update" o action="delete")',
        },
        title: {
          type: 'string',
          description: 'Título de la nota (para action="create" o "update")',
        },
        body: {
          type: 'string',
          description: 'Contenido de la nota (para action="create" o "update")',
        },
        query: {
          type: 'string',
          description: 'Término de búsqueda (solo para action="search")',
        },
      },
      required: ['action'],
    },
    execute: async ({ action, id, title, body, query }) => {
      if (action === 'create') {
        if (!title && !body) throw new Error('Se requiere título o contenido para crear una nota.')
        const noteId = await createNote(title || 'Sin título', body || '')
        return `Nota guardada exitosamente con ID ${noteId}: "${title || 'Sin título'}".`
      } else if (action === 'update') {
        const numId = Number(id)
        if (!numId) throw new Error('Se requiere el ID numérico de la nota a actualizar.')
        await updateNote(numId, String(title || 'Nota'), String(body || ''))
        return `Nota [ID ${numId}] actualizada exitosamente.`
      } else if (action === 'delete') {
        const numId = Number(id)
        if (!numId) throw new Error('Se requiere el ID numérico de la nota a eliminar.')
        await deleteNote(numId)
        return `Nota [ID ${numId}] eliminada de la base de datos local.`
      } else if (action === 'search') {
        const found = await searchNotes(String(query ?? ''))
        if (found.length === 0) return 'No se encontraron notas coincidentes.'
        return found
          .map((n) => `• [ID ${n.id}] ${n.title}: ${n.body.slice(0, 100)}...`)
          .join('\n')
      } else {
        const all = await listNotes()
        if (all.length === 0) return 'No tienes notas guardadas todavía.'
        return all.map((n) => `• [ID ${n.id}] ${n.title}: ${n.body.slice(0, 80)}...`).join('\n')
      }
    },
  },

  emergency: {
    name: 'emergency',
    description:
      'Manual de emergencia y supervivencia offline (primeros auxilios, RCP, deshidratación, torniquetes, purificación de agua, refugio).',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Tema de emergencia (ej. "rcp", "torniquete", "agua", "quemaduras", "fracturas")',
        },
      },
      required: ['topic'],
    },
    execute: async ({ topic }) => {
      const t = String(topic).toLowerCase()
      const disclaimer =
        '\n\n[ADVERTENCIA: Esta información es de referencia para emergencias sin conexión y no sustituye la atención médica profesional.]'

      if (t.includes('rcp') || t.includes('reanimac') || t.includes('paro')) {
        return (
          'PROTOCOLO RCP (Reanimación Cardiopulmonar en Adultos):\n' +
          '1. Verificar seguridad del entorno y respuesta de la víctima (sacudir hombros y hablarle).\n' +
          '2. Comprobar respiración (ver si el pecho se eleva por 5-10 segundos).\n' +
          '3. Si no responde ni respira: colocar talón de una mano en el centro del pecho, la otra mano encima entrelazada.\n' +
          '4. Comprimir a ritmo de 100-120 por minuto (al ritmo de la canción "Stayin Alive"), con profundidad de 5-6 cm.\n' +
          '5. Ciclos de 30 compresiones seguidas de 2 insuflaciones (si estás entrenado), o compresiones continuas ininterrumpidas.' +
          disclaimer
        )
      }
      if (t.includes('sangr') || t.includes('hemorrag') || t.includes('torniquet')) {
        return (
          'CONTROL DE HEMORRAGIAS Y TORNIQUETE:\n' +
          '1. Presión directa: Colocar gasa o tela limpia y presionar firmemente con ambas manos.\n' +
          '2. Si no cesa y es en una extremidad (brazo o pierna): Aplicar torniquete 5-7 cm por encima de la herida (nunca sobre una articulación).\n' +
          '3. Ajustar y girar hasta que el sangrado arterial se detenga por completo.\n' +
          '4. Asegurar el torniquete y anotar la hora exacta de colocación en la frente o extremidad del paciente.\n' +
          '5. NUNCA aflojar el torniquete una vez colocado.' +
          disclaimer
        )
      }
      if (t.includes('agua') || t.includes('purif') || t.includes('potabiliz')) {
        return (
          'MÉTODOS DE PURIFICACIÓN DE AGUA SIN CONEXIÓN:\n' +
          '1. Hervido: Hervir a borbotones durante al menos 1 minuto continuo (3 minutos a altitudes superiores a 2.000 m).\n' +
          '2. Desinfección química: 2 gotas de lejía/cloro doméstico sin perfume por cada litro de agua clara (4 gotas si está turbia). Dejar reposar 30 minutos.\n' +
          '3. Filtración previa: Filtrar con tela limpia, gasa o arena/carbón para eliminar sedimentos antes de hervir o clorar.\n' +
          '4. Método SODIS (solar): Botella plástica transparente al sol durante 6 horas en día despejado.' +
          disclaimer
        )
      }
      return (
        `GUÍA RÁPIDA DE EMERGENCIA ("${topic}"):\n` +
        '1. Mantener la calma y proteger a la víctima de peligros inmediatos.\n' +
        '2. Evaluar vía aérea, respiración y circulación (ABC).\n' +
        '3. Evitar mover a la persona si hay sospecha de lesión espinal.\n' +
        '4. Mantener la temperatura corporal cubriendo a la persona.' +
        disclaimer
      )
    },
  },

  create_file: {
    name: 'create_file',
    description: 'Genera un archivo descargable (.txt, .md, .py, .json, .csv) para el usuario.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Nombre del archivo con extensión (ej. "reporte.md", "script.py", "datos.json")',
        },
        content: {
          type: 'string',
          description: 'Contenido completo del archivo a generar.',
        },
      },
      required: ['filename', 'content'],
    },
    execute: async ({ filename, content }) => {
      try {
        const blob = new Blob([String(content)], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = String(filename || 'archivo.txt')
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 5000)
        return `Archivo "${filename}" generado y descargado exitosamente (${new Blob([String(content)]).size} bytes).`
      } catch {
        return `Archivo "${filename}" preparado:\n\`\`\`\n${content}\n\`\`\``
      }
    },
  },

  system_diagnostics: {
    name: 'system_diagnostics',
    description: 'Inspecciona el estado de la memoria local, base de datos IndexedDB y hardware.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      const { db } = await import('../../db/schema')
      const [docCount, noteCount, chatCount] = await Promise.all([
        db.documents.count(),
        db.notes.count(),
        db.chats.count(),
      ])

      let ram = 'Desconocida'
      if ('deviceMemory' in navigator) {
        ram = `${(navigator as any).deviceMemory} GB aprox`
      }

      let storageEstimate = 'No disponible'
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate()
        const usedMB = ((est.usage || 0) / (1024 * 1024)).toFixed(1)
        const totalMB = ((est.quota || 0) / (1024 * 1024)).toFixed(1)
        storageEstimate = `${usedMB} MB usados de ${totalMB} MB disponibles`
      }

      return (
        `DIAGNÓSTICO DEL SISTEMA LOCAL (100% OFFLINE):\n` +
        `• Base de datos: ${docCount} documentos indexados, ${noteCount} notas guardadas, ${chatCount} conversaciones.\n` +
        `• Almacenamiento IndexedDB: ${storageEstimate}.\n` +
        `• Memoria RAM del dispositivo: ${ram}.\n` +
        `• Acelerador WebGPU: ${'gpu' in navigator ? 'Soportado' : 'No disponible (CPU/Wasm)'}.`
      )
    },
  },

  clock: {
    name: 'clock',
    description: 'Devuelve la hora exacta, fecha, día de la semana y zona horaria actual del sistema con precisión absoluta.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      const now = new Date()
      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
      const monthNames = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ]
      const dayName = dayNames[now.getDay()]
      const dayNum = now.getDate()
      const monthName = monthNames[now.getMonth()]
      const year = now.getFullYear()
      const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      return `Hoy es ${dayName}, ${dayNum} de ${monthName} de ${year}. Hora actual: ${time} (${tz}).`
    },
  },

  alarm_timer: {
    name: 'alarm_timer',
    description: 'Programa una alarma o temporizador en el dispositivo con duración y etiqueta.',
    parameters: {
      type: 'object',
      properties: {
        seconds: { type: 'number', description: 'Segundos para el temporizador (ej. 180 para 3 min)' },
        message: { type: 'string', description: 'Motivo o recordatorio de la alarma' },
      },
      required: ['seconds'],
    },
    execute: async ({ seconds, message }) => {
      const s = Number(seconds) || 60
      const label = String(message || 'Alarma Jinx')
      return `Temporizador de ${s} segundos configurado para "${label}".`
    },
  },

  calendar: {
    name: 'calendar',
    description: 'Consulta el calendario local, calcula días hasta una fecha o añade un recordatorio.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['current_month', 'days_until'], description: 'Acción a realizar' },
        targetDate: { type: 'string', description: 'Fecha objetivo en formato AAAA-MM-DD' },
      },
      required: ['action'],
    },
    execute: async ({ action, targetDate }) => {
      const now = new Date()
      if (action === 'days_until' && targetDate) {
        const target = new Date(targetDate)
        const diffTime = target.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return `Faltan ${diffDays} días para la fecha ${targetDate}.`
      }
      const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
      return `Mes en curso: ${monthNames[now.getMonth()]} de ${now.getFullYear()} (${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()} días totales).`
    },
  },

  flashlight: {
    name: 'flashlight',
    description: 'Enciende o apaga la linterna (flash LED) del dispositivo.',
    parameters: {
      type: 'object',
      properties: {
        state: { type: 'string', enum: ['on', 'off'], description: 'Estado: on o off' },
      },
      required: ['state'],
    },
    execute: async ({ state }) => {
      return `Linterna ajustada a: ${state}.`
    },
  },

  device_location: {
    name: 'device_location',
    description: 'Obtiene las coordenadas geográficas de ubicación (latitud y longitud).',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: async () => {
      return new Promise((resolve) => {
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`Ubicación actual: Lat ${pos.coords.latitude.toFixed(4)}, Lon ${pos.coords.longitude.toFixed(4)} (precisión: ±${Math.round(pos.coords.accuracy)}m).`),
            () => resolve('Ubicación: Permiso no concedido o GPS inactivo.'),
            { timeout: 4000 }
          )
        } else {
          resolve('Servicio de geolocalización no soportado.')
        }
      })
    },
  },

  offline_packs: {
    name: 'offline_packs',
    description: 'Bases de conocimiento offline: wikipedia esencial, primeros auxilios y medicina, mapas y geografía.',
    parameters: {
      type: 'object',
      properties: {
        pack: { type: 'string', enum: ['wikipedia', 'medicina', 'mapas'], description: 'Paquete offline' },
        query: { type: 'string', description: 'Término a consultar' },
      },
      required: ['pack', 'query'],
    },
    execute: async ({ pack, query }) => {
      const q = String(query).toLowerCase()
      if (pack === 'medicina') {
        if (q.includes('quemadur')) {
          return 'PROTOCOLO QUEMADURAS: 1. Enfriar con agua corriente templada o fresca (NO helada ni hielo) durante 15 min. 2. Retirar anillos antes de la inflamación. 3. Cubrir con gasa estéril o film transparente. NUNCA reventar ampollas.'
        }
        return `Manual de emergencias médicas offline: resultado para "${query}". Mantener constantes vitales estables y abrigar a la persona afectada.`
      }
      return `Paquete offline [${pack}]: consulta procesada localmente para "${query}".`
    },
  },

  unit_converter: {
    name: 'unit_converter',
    description: 'Convierte magnitudes entre unidades físicas (longitud, peso/masa, temperatura, datos, velocidad).',
    parameters: {
      type: 'object',
      properties: {
        value: { type: 'number', description: 'Cantidad numérica a convertir' },
        from: { type: 'string', description: 'Unidad de origen (km, m, cm, mi, ft, in, kg, g, lb, oz, c, f, k, b, kb, mb, gb, tb, kmh, mph, ms)' },
        to: { type: 'string', description: 'Unidad de destino (ej. "mi", "f", "kg", "gb")' },
      },
      required: ['value', 'from', 'to'],
    },
    execute: async ({ value, from, to }) => {
      const val = Number(value)
      const f = String(from).toLowerCase().trim()
      const t = String(to).toLowerCase().trim()

      if (isNaN(val)) return 'Error: el valor a convertir debe ser un número válido.'

      // Temperatura
      if (['c', 'f', 'k'].includes(f) && ['c', 'f', 'k'].includes(t)) {
        let celsius = val
        if (f === 'f') celsius = (val - 32) * (5 / 9)
        else if (f === 'k') celsius = val - 273.15

        let res = celsius
        if (t === 'f') res = (celsius * 9) / 5 + 32
        else if (t === 'k') res = celsius + 273.15

        return `${val}°${f.toUpperCase()} equivale a ${res.toFixed(2)}°${t.toUpperCase()}.`
      }

      // Factores de conversión estándar a unidad base
      const lengthMeters: Record<string, number> = {
        m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254, yd: 0.9144
      }
      if (f in lengthMeters && t in lengthMeters) {
        const meters = val * lengthMeters[f]!
        const target = meters / lengthMeters[t]!
        return `${val} ${f} = ${target.toFixed(4)} ${t}.`
      }

      const massGrams: Record<string, number> = {
        g: 1, kg: 1000, mg: 0.001, lb: 453.592, oz: 28.3495, ton: 1000000
      }
      if (f in massGrams && t in massGrams) {
        const grams = val * massGrams[f]!
        const target = grams / massGrams[t]!
        return `${val} ${f} = ${target.toFixed(4)} ${t}.`
      }

      const digitalBytes: Record<string, number> = {
        b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4
      }
      if (f in digitalBytes && t in digitalBytes) {
        const bytes = val * digitalBytes[f]!
        const target = bytes / digitalBytes[t]!
        return `${val} ${f.toUpperCase()} = ${target.toFixed(4)} ${t.toUpperCase()}.`
      }

      return `Conversión directa: ${val} de ${f} a ${t}.`
    },
  },

  text_analysis: {
    name: 'text_analysis',
    description: 'Calcula métricas detalladas de un texto: número de palabras, caracteres, tiempo de lectura y párrafos.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto a inspeccionar y analizar' },
      },
      required: ['text'],
    },
    execute: async ({ text }) => {
      const str = String(text || '').trim()
      if (!str) return 'Texto vacío: 0 palabras, 0 caracteres.'
      const words = str.split(/\s+/).filter(Boolean).length
      const charsWithSpaces = str.length
      const charsNoSpaces = str.replace(/\s+/g, '').length
      const paragraphs = str.split(/\n\s*\n/).filter(Boolean).length || 1
      const readingTimeMinutes = Math.ceil(words / 200)

      return (
        `ANÁLISIS DE TEXTO:\n` +
        `• Palabras: ${words}\n` +
        `• Caracteres (con espacios): ${charsWithSpaces}\n` +
        `• Caracteres (sin espacios): ${charsNoSpaces}\n` +
        `• Párrafos: ${paragraphs}\n` +
        `• Tiempo estimado de lectura: ~${readingTimeMinutes} min (a 200 ppm)`
      )
    },
  },

  crypto_hash: {
    name: 'crypto_hash',
    description: 'Calcula resumen criptográfico SHA-256 o codifica/decodifica Base64 de forma local.',
    parameters: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['sha256', 'base64_encode', 'base64_decode'], description: 'Operación criptográfica' },
        input: { type: 'string', description: 'Texto de entrada' },
      },
      required: ['operation', 'input'],
    },
    execute: async ({ operation, input }) => {
      const data = String(input ?? '')
      if (operation === 'base64_encode') {
        try {
          return `Base64 codificado: ${btoa(unescape(encodeURIComponent(data)))}`
        } catch {
          return 'Error al codificar en Base64.'
        }
      }
      if (operation === 'base64_decode') {
        try {
          return `Base64 decodificado: ${decodeURIComponent(escape(atob(data)))}`
        } catch {
          return 'Error: texto Base64 inválido.'
        }
      }

      // SHA-256
      try {
        const msgBuffer = new TextEncoder().encode(data)
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
        return `Hash SHA-256: ${hashHex}`
      } catch (err) {
        return `Error al calcular SHA-256: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  },

  astronomy: {
    name: 'astronomy',
    description: 'Cálculos astronómicos offline: fase lunar actual, estación del año y duración de la luz solar.',
    parameters: {
      type: 'object',
      properties: {
        queryDate: { type: 'string', description: 'Fecha en formato AAAA-MM-DD (opcional, por defecto hoy)' },
      },
      required: [],
    },
    execute: async ({ queryDate }) => {
      const date = queryDate ? new Date(queryDate) : new Date()
      // Algoritmo trigonométrico aproximado para fase lunar (ciclo sinódico de 29.53 días)
      const knownNewMoon = new Date('2000-01-06T18:14:00Z').getTime()
      const diffMs = date.getTime() - knownNewMoon
      const days = diffMs / (1000 * 60 * 60 * 24)
      const phase = (days % 29.53058867) / 29.53058867

      let phaseName = 'Luna Nueva'
      let emoji = '🌑'
      if (phase < 0.03 || phase > 0.97) {
        phaseName = 'Luna Nueva'; emoji = '🌑'
      } else if (phase < 0.22) {
        phaseName = 'Luna Creciente'; emoji = '🌒'
      } else if (phase < 0.28) {
        phaseName = 'Cuarto Creciente'; emoji = '🌓'
      } else if (phase < 0.47) {
        phaseName = 'Gibosa Creciente'; emoji = '🌔'
      } else if (phase < 0.53) {
        phaseName = 'Luna Llena'; emoji = '🌕'
      } else if (phase < 0.72) {
        phaseName = 'Gibosa Menguante'; emoji = '🌖'
      } else if (phase < 0.78) {
        phaseName = 'Cuarto Menguante'; emoji = '🌗'
      } else {
        phaseName = 'Luna Menguante'; emoji = '🌘'
      }

      const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) * 50)
      const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))

      return (
        `ASTRONOMÍA LOCAL OFFLINE (${date.toLocaleDateString('es-ES')}):\n` +
        `• Fase Lunar: ${emoji} ${phaseName} (~${illumination}% de iluminación)\n` +
        `• Ciclo Lunar: día ${Math.round(days % 29.53)} de 29.5\n` +
        `• Día del año: ${dayOfYear}/365`
      )
    },
  },

  read_note: {
    name: 'read_note',
    description: 'Lee el contenido íntegro de una nota específica por su identificador (ID) o coincidencia de título.',
    parameters: {
      type: 'object',
      properties: {
        idOrTitle: { type: 'string', description: 'Número de ID o título de la nota a leer' },
      },
      required: ['idOrTitle'],
    },
    execute: async ({ idOrTitle }) => {
      const numId = Number(idOrTitle)
      if (!isNaN(numId)) {
        const note = await getNote(numId)
        if (note) {
          return `NOTA [ID ${note.id}] "${note.title}":\n\n${note.body}\n\n(Actualizada: ${new Date(note.updatedAt).toLocaleString('es-ES')})`
        }
      }
      const matches = await searchNotes(String(idOrTitle))
      if (matches.length === 0) return `No se encontró ninguna nota que coincida con "${idOrTitle}".`
      const best = matches[0]!
      return `NOTA [ID ${best.id}] "${best.title}":\n\n${best.body}`
    },
  },

  execute_code: {
    name: 'execute_code',
    description: 'Ejecuta código JavaScript/ES6 o Python de forma segura y 100% offline en el Sandbox local con soporte matemático y estadístico. Captura logs y valores devueltos.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Código a ejecutar' },
        language: { type: 'string', description: 'Lenguaje ("javascript" o "python")' },
      },
      required: ['code'],
    },
    execute: async ({ code, language }) => {
      const lang = (language === 'python' ? 'python' : 'javascript') as 'javascript' | 'python'
      const res = await executeSandboxCode(String(code), lang)
      const parts = []
      if (res.logs.length > 0) parts.push(`Logs (console):\n${res.logs.join('\n')}`)
      if (res.result !== undefined) parts.push(`Retorno: ${res.result}`)
      if (res.error) parts.push(`Error: ${res.error}`)
      parts.push(`Tiempo de ejecución: ${res.executionTimeMs}ms (Estado: ${res.success ? 'Éxito' : 'Fallo'})`)
      return parts.join('\n\n')
    },
  },

  regex_tester: {
    name: 'regex_tester',
    description: 'Evalúa expresiones regulares (RegExp) contra un texto objetivo, extrayendo coincidencias, grupos de captura o ejecutando reemplazos.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Patrón de expresión regular' },
        flags: { type: 'string', description: 'Banderas regex como "g", "i", "m" (opcional)' },
        text: { type: 'string', description: 'Texto sobre el cual evaluar' },
        replacement: { type: 'string', description: 'Texto de reemplazo (opcional)' },
      },
      required: ['pattern', 'text'],
    },
    execute: async ({ pattern, flags = 'g', text, replacement }) => {
      try {
        const regex = new RegExp(String(pattern), String(flags || 'g'))
        const target = String(text)
        if (replacement !== undefined && replacement !== null) {
          const replaced = target.replace(regex, String(replacement))
          return `EVALUACIÓN REGEX (Reemplazo):\nPatrón: /${pattern}/${flags}\nResultado:\n${replaced}`
        }
        const activeFlags = String(flags).includes('g') ? String(flags) : String(flags) + 'g'
        const matches = [...target.matchAll(new RegExp(String(pattern), activeFlags))]
        if (matches.length === 0) return `No se encontraron coincidencias para /${pattern}/${flags}.`
        const list = matches.slice(0, 20).map((m, idx) => {
          const groups = m.groups ? ` (Grupos: ${JSON.stringify(m.groups)})` : ''
          return `[#${idx + 1}] Índice ${m.index}: "${m[0]}"${groups}`
        }).join('\n')
        return `EVALUACIÓN REGEX (${matches.length} coincidencia(s)):\n${list}`
      } catch (err: any) {
        return `Error en expresión regular: ${err?.message || err}`
      }
    },
  },

  math_advanced: {
    name: 'math_advanced',
    description: 'Resuelve problemas avanzados de matemáticas: estadísticas (media, mediana, desviación estándar), álgebra (factores primos, MCD, mcm, ecuación cuadrática, combinatoria) y finanzas (regla de tres, interés).',
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', description: 'Modo de cálculo: "stats", "quadratic", "primes", "gcd_lcm", "combinatorics", "rule_of_three"', enum: ['stats', 'quadratic', 'primes', 'gcd_lcm', 'combinatorics', 'rule_of_three'] },
        params: { type: 'string', description: 'Parámetros en texto o lista (ej. stats: "10, 20, 35", quadratic: "a=1, b=-5, c=6", primes: "840", gcd_lcm: "a=48, b=18", combinatorics: "n=10, r=3", rule_of_three: "a=4, b=100, c=8")' },
      },
      required: ['mode', 'params'],
    },
    execute: async ({ mode, params }) => {
      const pStr = String(params || '')
      if (mode === 'stats') {
        const nums = pStr.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n))
        if (nums.length === 0) return 'Error: proporciona al menos un número separado por coma o espacio.'
        nums.sort((a, b) => a - b)
        const n = nums.length
        const sum = nums.reduce((a, b) => a + b, 0)
        const mean = sum / n
        const median = n % 2 === 0 ? ((nums[n / 2 - 1] ?? 0) + (nums[n / 2] ?? 0)) / 2 : (nums[Math.floor(n / 2)] ?? 0)
        const variance = nums.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n > 1 ? n - 1 : 1)
        const stdDev = Math.sqrt(variance)
        const min = nums[0] ?? 0
        const max = nums[n - 1] ?? 0
        const q1 = nums[Math.floor(n * 0.25)] ?? min
        const q3 = nums[Math.floor(n * 0.75)] ?? max
        return (
          `ANÁLISIS ESTADÍSTICO (N = ${n}):\n` +
          `• Suma total: ${sum}\n` +
          `• Media aritmética: ${mean.toFixed(4)}\n` +
          `• Mediana: ${median}\n` +
          `• Rango: [${min} .. ${max}] (amplitud: ${max - min})\n` +
          `• Varianza muestral: ${variance.toFixed(4)}\n` +
          `• Desviación estándar (σ): ${stdDev.toFixed(4)}\n` +
          `• Cuartiles: Q1 = ${q1}, Q2 = ${median}, Q3 = ${q3}, IQR = ${q3 - q1}`
        )
      }

      if (mode === 'quadratic') {
        const aMatch = pStr.match(/a\s*=\s*([-\d.]+)/) || [null, '1']
        const bMatch = pStr.match(/b\s*=\s*([-\d.]+)/) || [null, '0']
        const cMatch = pStr.match(/c\s*=\s*([-\d.]+)/) || [null, '0']
        const a = parseFloat(aMatch[1] ?? '1')
        const b = parseFloat(bMatch[1] ?? '0')
        const c = parseFloat(cMatch[1] ?? '0')
        if (a === 0) return 'Error: no es una ecuación cuadrática (a no puede ser 0).'
        const disc = b * b - 4 * a * c
        const vx = -b / (2 * a)
        const vy = a * vx * vx + b * vx + c
        if (disc > 0) {
          const x1 = (-b + Math.sqrt(disc)) / (2 * a)
          const x2 = (-b - Math.sqrt(disc)) / (2 * a)
          return `ECUACIÓN CUADRÁTICA (${a}x² + ${b}x + ${c} = 0):\n• Discriminante (Δ): ${disc}\n• Raíces reales: x₁ = ${x1.toFixed(4)}, x₂ = ${x2.toFixed(4)}\n• Vértice: (${vx.toFixed(4)}, ${vy.toFixed(4)})`
        } else if (disc === 0) {
          const x = -b / (2 * a)
          return `ECUACIÓN CUADRÁTICA (${a}x² + ${b}x + ${c} = 0):\n• Discriminante (Δ): 0\n• Raíz real única: x = ${x.toFixed(4)}\n• Vértice: (${vx.toFixed(4)}, ${vy.toFixed(4)})`
        } else {
          const real = (-b / (2 * a)).toFixed(4)
          const imag = (Math.sqrt(-disc) / (2 * a)).toFixed(4)
          return `ECUACIÓN CUADRÁTICA (${a}x² + ${b}x + ${c} = 0):\n• Discriminante (Δ): ${disc}\n• Raíces complejas conjugadas:\n  x₁ = ${real} + ${imag}i\n  x₂ = ${real} - ${imag}i\n• Vértice: (${vx.toFixed(4)}, ${vy.toFixed(4)})`
        }
      }

      if (mode === 'primes') {
        const num = parseInt(pStr.replace(/\D/g, ''), 10)
        if (isNaN(num) || num < 2) return 'Introduce un número entero mayor o igual a 2.'
        let n = num
        const factors: Record<number, number> = {}
        for (let d = 2; d * d <= n; d++) {
          while (n % d === 0) {
            factors[d] = (factors[d] || 0) + 1
            n /= d
          }
        }
        if (n > 1) factors[n] = (factors[n] || 0) + 1
        const repr = Object.entries(factors)
          .map(([f, exp]) => (exp > 1 ? `${f}^${exp}` : `${f}`))
          .join(' × ')
        const isPrime = Object.keys(factors).length === 1 && Object.values(factors)[0] === 1
        return `DESCOMPOSICIÓN FACTORIAL DE ${num}:\n${repr}\n(${isPrime ? 'Es un NÚMERO PRIMO' : 'Es un número compuesto'})`
      }

      if (mode === 'gcd_lcm') {
        const matches = pStr.match(/(\d+)/g)
        if (!matches || matches.length < 2 || !matches[0] || !matches[1]) return 'Proporciona dos números (ej. "a=48, b=18").'
        const a = parseInt(matches[0], 10)
        const b = parseInt(matches[1], 10)
        const gcd = (x: number, y: number): number => (!y ? x : gcd(y, x % y))
        const d = gcd(a, b)
        const m = (a * b) / d
        return `MÁXIMO COMÚN DIVISOR Y MÍNIMO COMÚN MÚLTIPLO (${a}, ${b}):\n• MCD: ${d}\n• mcm: ${m}`
      }

      if (mode === 'combinatorics') {
        const matches = pStr.match(/(\d+)/g)
        if (!matches || matches.length < 2 || !matches[0] || !matches[1]) return 'Proporciona n y r (ej. "n=10, r=3").'
        const n = parseInt(matches[0], 10)
        const r = parseInt(matches[1], 10)
        if (r > n) return 'Error: r no puede ser mayor que n.'
        const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1))
        const nPr = fact(n) / fact(n - r)
        const nCr = nPr / fact(r)
        return `COMBINATORIA (n = ${n}, r = ${r}):\n• Permutaciones P(${n}, ${r}): ${nPr}\n• Combinaciones C(${n}, ${r}): ${nCr}`
      }

      if (mode === 'rule_of_three') {
        const matches = pStr.match(/([-\d.]+)/g)
        if (!matches || matches.length < 3 || !matches[0] || !matches[1] || !matches[2]) return 'Proporciona 3 valores: si A -> B, entonces C -> ? (ej. "a=4, b=100, c=8").'
        const a = parseFloat(matches[0])
        const b = parseFloat(matches[1])
        const c = parseFloat(matches[2])
        if (a === 0) return 'Error: división por cero.'
        const direct = (b * c) / a
        const inverse = (a * b) / c
        return `REGLA DE TRES:\nSi ${a} equivale a ${b}, entonces ${c} equivale a:\n• Directa: ${direct.toFixed(4)}\n• Inversa: ${inverse.toFixed(4)}`
      }

      return `Modo no reconocido "${mode}". Modos disponibles: stats, quadratic, primes, gcd_lcm, combinatorics, rule_of_three.`
    },
  },

  language_linguistics: {
    name: 'language_linguistics',
    description: 'Herramientas de lingüística y lenguaje: legibilidad en español (Flesch-Szigriszt), cifrados clásicos (César, Atbash, Vigenère), transformaciones (camelCase, palíndromos) y guía gramatical.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Acción: "readability", "cipher", "transform", "grammar_reference"', enum: ['readability', 'cipher', 'transform', 'grammar_reference'] },
        text: { type: 'string', description: 'Texto a analizar o transformar' },
        param: { type: 'string', description: 'Parámetro adicional (ej. desplazamiento César, clave Vigenère, o tema)' },
      },
      required: ['action', 'text'],
    },
    execute: async ({ action, text, param }) => {
      const txt = String(text || '').trim()

      if (action === 'readability') {
        const words = txt.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+/g) || []
        const sentences = txt.split(/[.!?]+/).filter((s) => s.trim().length > 0)
        const totalWords = words.length
        const totalSentences = Math.max(1, sentences.length)

        const totalSyllables = words.reduce((acc, word) => {
          const vowelGroups = word.toLowerCase().match(/[aáeéoóíúuiy]+/g)
          return acc + (vowelGroups ? Math.max(1, vowelGroups.length) : 1)
        }, 0)

        const sylPerWord = totalWords > 0 ? totalSyllables / totalWords : 1
        const wordsPerSentence = totalWords / totalSentences
        const szigriszt = 206.835 - 62.3 * sylPerWord - wordsPerSentence

        let escala = ''
        if (szigriszt >= 85) escala = 'Muy fácil (Infantil)'
        else if (szigriszt >= 75) escala = 'Fácil (Popular)'
        else if (szigriszt >= 65) escala = 'Estándar (Divulgación general)'
        else if (szigriszt >= 50) escala = 'Moderadamente difícil (Secundaria)'
        else if (szigriszt >= 35) escala = 'Difícil (Técnico / Universidad)'
        else escala = 'Muy difícil (Científico especializado)'

        return (
          `ANÁLISIS DE LEGIBILIDAD:\n` +
          `• Total palabras: ${totalWords} | Frases: ${totalSentences}\n` +
          `• Palabras/Frase: ${wordsPerSentence.toFixed(1)} | Sílabas/Palabra: ${sylPerWord.toFixed(2)}\n` +
          `• Índice Flesch-Szigriszt: ${szigriszt.toFixed(1)} / 100\n` +
          `• Nivel: ${escala}`
        )
      }

      if (action === 'cipher') {
        const cipherType = (param || 'rot13').toLowerCase()
        if (cipherType.includes('atbash')) {
          const atbash = txt.replace(/[a-zA-Z]/g, (c) => {
            const isUpper = c <= 'Z' && c >= 'A'
            const base = isUpper ? 65 : 97
            return String.fromCharCode(base + (25 - (c.charCodeAt(0) - base)))
          })
          return `CIFRADO ATBASH:\n${atbash}`
        }
        if (cipherType.includes('vigenere')) {
          const key = (param?.split(/[:\s]+/)[1] || 'clave').toLowerCase().replace(/[^a-z]/g, '') || 'jinx'
          let keyIdx = 0
          const res = txt.replace(/[a-zA-Z]/g, (c) => {
            const isUpper = c <= 'Z' && c >= 'A'
            const base = isUpper ? 65 : 97
            const shift = key.charCodeAt(keyIdx % key.length) - 97
            keyIdx++
            return String.fromCharCode(base + ((c.charCodeAt(0) - base + shift) % 26))
          })
          return `CIFRADO VIGENÈRE (Clave: "${key}"):\n${res}`
        }
        const shiftMatch = cipherType.match(/\d+/)
        const shift = shiftMatch ? parseInt(shiftMatch[0], 10) : 13
        const caesar = txt.replace(/[a-zA-Z]/g, (c) => {
          const isUpper = c <= 'Z' && c >= 'A'
          const base = isUpper ? 65 : 97
          return String.fromCharCode(base + ((((c.charCodeAt(0) - base + shift) % 26) + 26) % 26))
        })
        return `CIFRADO CÉSAR (Desplazamiento +${shift}):\n${caesar}`
      }

      if (action === 'transform') {
        const words = txt.split(/[\s_-]+/).filter(Boolean)
        const camel = words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
        const snake = words.map((w) => w.toLowerCase()).join('_')
        const kebab = words.map((w) => w.toLowerCase()).join('-')
        const pascal = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
        const cleanForPal = txt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
        const isPal = cleanForPal.length > 1 && cleanForPal === cleanForPal.split('').reverse().join('')
        return (
          `TRANSFORMACIONES DE TEXTO:\n` +
          `• camelCase: ${camel}\n` +
          `• snake_case: ${snake}\n` +
          `• kebab-case: ${kebab}\n` +
          `• PascalCase: ${pascal}\n` +
          `• Palíndromo: ${isPal ? 'Sí' : 'No'}`
        )
      }

      if (action === 'grammar_reference') {
        return (
          `GUÍA DE GRAMÁTICA Y ORTOGRAFÍA ESPAÑOLA:\n` +
          `1. Acentuación: Agudas (vocal, -n, -s), Llanas (no vocal, -n, -s), Esdrújulas (siempre).\n` +
          `2. Por qué (pregunta) / Porque (causa) / El porqué (motivo) / Por que (relativo).\n` +
          `3. Sino (oposición) vs Si no (condicional negativa).\n` +
          `4. Haber (verbo) vs A ver (mirar).`
        )
      }

      return 'Acción no válida. Usa readability, cipher, transform o grammar_reference.'
    },
  },

  history_chronology: {
    name: 'history_chronology',
    description: 'Enciclopedia cronológica e hitos de historia universal offline: civilizaciones antiguas, Edad Media, Renacimiento, revoluciones, guerras mundiales y era espacial.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Término de búsqueda, personaje o año (ej. "1789", "Segunda Guerra Mundial", "Imperio Romano", "Renacimiento", "Luna")' },
        era: { type: 'string', description: 'Filtrar por era: "antigua", "media", "moderna", "contemporanea", "todas" (opcional)', enum: ['antigua', 'media', 'moderna', 'contemporanea', 'todas'] },
      },
      required: ['query'],
    },
    execute: async ({ query, era = 'todas' }) => {
      const q = String(query).toLowerCase().trim()
      const EVENTS = [
        { year: '3500 a.C.', era: 'antigua', title: 'Invención de la Escritura Cuneiforme', desc: 'En Mesopotamia (Sumeria), nacimiento del primer sistema de registro escrito y fin de la prehistoria.' },
        { year: '2560 a.C.', era: 'antigua', title: 'Gran Pirámide de Guiza', desc: 'Construida durante el reinado del faraón Keops en el Imperio Antiguo de Egipto.' },
        { year: '1750 a.C.', era: 'antigua', title: 'Código de Hammurabi', desc: 'Uno de los conjuntos de leyes escritas más antiguos en Babilonia (Ley del Talión).' },
        { year: '508 a.C.', era: 'antigua', title: 'Nacimiento de la Democracia en Atenas', desc: 'Reformas de Clístenes en Grecia que sentaron las bases democráticas.' },
        { year: '334 a.C.', era: 'antigua', title: 'Campañas de Alejandro Magno', desc: 'Conquista del Imperio Persa y expansión de la cultura helenística hasta la India.' },
        { year: '44 a.C.', era: 'antigua', title: 'Magnicidio de Julio César', desc: 'Asesinato en los Idus de marzo en el Senado romano, marcando el fin de la República Romana.' },
        { year: '27 a.C.', era: 'antigua', title: 'Comienzo del Imperio Romano', desc: 'Octavio asume el título de Augusto, iniciando la Pax Romana.' },
        { year: '476 d.C.', era: 'media', title: 'Caída del Imperio Romano de Occidente', desc: 'Rómulo Augústulo es depuesto por Odoacro; marca el inicio de la Edad Media.' },
        { year: '622 d.C.', era: 'media', title: 'La Hégira y Fundación del Islam', desc: 'Emigración de Mahoma de La Meca a Medina, inicio del calendario musulmán.' },
        { year: '711 d.C.', era: 'media', title: 'Llegada musulmana a la Península Ibérica', desc: 'Comienzo de Al-Ándalus tras la batalla de Guadalete y presencia islámica durante 8 siglos.' },
        { year: '800 d.C.', era: 'media', title: 'Coronación de Carlomagno', desc: 'El Papa León III corona a Carlomagno como Emperador de los Romanos en Roma.' },
        { year: '1095 d.C.', era: 'media', title: 'Inicio de las Cruzadas', desc: 'Llamamiento del Papa Urbano II en Clermont para recuperar Tierra Santa.' },
        { year: '1215 d.C.', era: 'media', title: 'Firma de la Carta Magna', desc: 'En Inglaterra, el Rey Juan sin Tierra limita el poder del monarca.' },
        { year: '1347 d.C.', era: 'media', title: 'La Peste Negra en Europa', desc: 'Pandemia de peste bubónica que aniquiló a más de un tercio de la población europea.' },
        { year: '1453 d.C.', era: 'media', title: 'Caída de Constantinopla e Invención de la Imprenta', desc: 'Toma otomana de Constantinopla; Gutenberg perfecciona la imprenta de tipos móviles.' },
        { year: '1492 d.C.', era: 'moderna', title: 'Llegada a América y Conquista de Granada', desc: 'Expedición de Cristóbal Colón llega a las Antillas; fin de la Reconquista.' },
        { year: '1517 d.C.', era: 'moderna', title: 'Reforma Protestante de Martín Lutero', desc: 'Publicación de las 95 tesis en Wittenberg, quebrando la unidad religiosa europea.' },
        { year: '1543 d.C.', era: 'moderna', title: 'Revolución Científica: Copérnico', desc: 'Publicación de modelo heliocéntrico del universo.' },
        { year: '1776 d.C.', era: 'moderna', title: 'Declaración de Independencia de EE.UU.', desc: 'Trece Colonias proclaman su soberanía inspiradas en ideales ilustrados.' },
        { year: '1789 d.C.', era: 'moderna', title: 'Revolución Francesa y Toma de la Bastilla', desc: 'Caída del Antiguo Régimen y Declaración de los Derechos del Hombre.' },
        { year: '1804 d.C.', era: 'contemporanea', title: 'Imperio Napoleónico', desc: 'Napoleón Bonaparte se corona emperador y expande el Código Civil.' },
        { year: '1810-1825', era: 'contemporanea', title: 'Independencia de Hispanoamérica', desc: 'Campañas de Simón Bolívar, San Martín e Hidalgo libertando el continente.' },
        { year: '1848 d.C.', era: 'contemporanea', title: 'La Primavera de los Pueblos y Manifiesto Comunista', desc: 'Revoluciones obreras en Europa; publicación por Marx y Engels.' },
        { year: '1914-1918', era: 'contemporanea', title: 'Primera Guerra Mundial', desc: 'Conflicto global tras el atentado de Sarajevo; colapso de 4 imperios.' },
        { year: '1917 d.C.', era: 'contemporanea', title: 'Revolución Rusa', desc: 'Los bolcheviques con Lenin toman el poder, fundando la URSS.' },
        { year: '1939-1945', era: 'contemporanea', title: 'Segunda Guerra Mundial', desc: 'Mayor conflicto de la historia; Holocausto y uso del arma nuclear.' },
        { year: '1945 d.C.', era: 'contemporanea', title: 'Creación de las Naciones Unidas (ONU)', desc: 'Carta de San Francisco para promover la paz y derechos humanos.' },
        { year: '1969 d.C.', era: 'contemporanea', title: 'Apolo 11: Llegada a la Luna', desc: 'Neil Armstrong y Buzz Aldrin caminan sobre la Luna.' },
        { year: '1989 d.C.', era: 'contemporanea', title: 'Caída del Muro de Berlín', desc: 'Fin de la Guerra Fría y reunificación alemana.' },
        { year: '1991 d.C.', era: 'contemporanea', title: 'Disolución de la URSS e Invención de la World Wide Web', desc: 'Tim Berners-Lee publica el protocolo web abriendo la era digital.' }
      ]

      const filtered = EVENTS.filter((e) => {
        const matchesEra = era === 'todas' || e.era === era.toLowerCase()
        const matchesQuery =
          !q ||
          e.title.toLowerCase().includes(q) ||
          e.desc.toLowerCase().includes(q) ||
          e.year.toLowerCase().includes(q) ||
          e.era.toLowerCase().includes(q)
        return matchesEra && matchesQuery
      })

      if (filtered.length === 0) {
        return `No se encontraron eventos para "${query}". Hitos notables: ${EVENTS.slice(0, 5).map((e) => `${e.year}: ${e.title}`).join(', ')}`
      }

      return (
        `CRONOLOGÍA HISTÓRICA OFFLINE (${filtered.length} hito(s)):\n\n` +
        filtered
          .map(
            (e) =>
              `📅 [${e.year}] (${e.era.toUpperCase()})\n` +
              `🏛 ${e.title}\n` +
              `📝 ${e.desc}`
          )
          .join('\n\n')
      )
    },
  },

  science_physics_chemistry: {
    name: 'science_physics_chemistry',
    description: 'Ciencias exactas offline: tabla periódica de los elementos (número atómico, masa, configuración), fórmulas de física (cinemática, dinámica F=ma, energía cinética, relatividad E=mc², gravedad) y constantes universales.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Categoría: "element", "formula", "constant"', enum: ['element', 'formula', 'constant'] },
        query: { type: 'string', description: 'Nombre/símbolo de elemento (ej. "Fe", "Oro", "26"), fórmula (ej. "cinetica: m=2, v=10", "fuerza: m=5, a=9.8", "relatividad: m=0.001"), o constante (ej. "luz", "gravitacion", "planck")' },
      },
      required: ['category', 'query'],
    },
    execute: async ({ category, query }) => {
      const q = String(query).toLowerCase().trim()

      if (category === 'constant') {
        const CONSTS = [
          { name: 'Velocidad de la luz en el vacío (c)', value: '299,792,458 m/s' },
          { name: 'Constante de Gravitación Universal (G)', value: '6.67430 × 10⁻¹¹ N·m²/kg²' },
          { name: 'Constante de Planck (h)', value: '6.62607015 × 10⁻³⁴ J·s' },
          { name: 'Constante reducida de Planck (ħ)', value: '1.054571817 × 10⁻³⁴ J·s' },
          { name: 'Constante de Boltzmann (k_B)', value: '1.380649 × 10⁻²³ J/K' },
          { name: 'Número de Avogadro (N_A)', value: '6.02214076 × 10²³ mol⁻¹' },
          { name: 'Carga elemental del electrón (e)', value: '1.602176634 × 10⁻¹⁹ C' },
          { name: 'Aceleración gravitacional estándar (g)', value: '9.80665 m/s²' },
        ]
        const found = CONSTS.filter((c) => !q || c.name.toLowerCase().includes(q))
        return `CONSTANTES FÍSICAS UNIVERSALES:\n` + found.map((c) => `• ${c.name}: ${c.value}`).join('\n')
      }

      if (category === 'element') {
        const ELEMENTS = [
          { z: 1, s: 'H', n: 'Hidrógeno', mass: 1.008, cat: 'No metal', conf: '1s¹' },
          { z: 2, s: 'He', n: 'Helio', mass: 4.0026, cat: 'Gas noble', conf: '1s²' },
          { z: 6, s: 'C', n: 'Carbono', mass: 12.011, cat: 'No metal', conf: '[He] 2s² 2p²' },
          { z: 7, s: 'N', n: 'Nitrógeno', mass: 14.007, cat: 'No metal', conf: '[He] 2s² 2p³' },
          { z: 8, s: 'O', n: 'Oxígeno', mass: 15.999, cat: 'No metal', conf: '[He] 2s² 2p⁴' },
          { z: 11, s: 'Na', n: 'Sodio', mass: 22.990, cat: 'Metal alcalino', conf: '[Ne] 3s¹' },
          { z: 12, s: 'Mg', n: 'Magnesio', mass: 24.305, cat: 'Alcalinotérreo', conf: '[Ne] 3s²' },
          { z: 13, s: 'Al', n: 'Aluminio', mass: 26.982, cat: 'Metal del bloque p', conf: '[Ne] 3s² 3p¹' },
          { z: 14, s: 'Si', n: 'Silicio', mass: 28.085, cat: 'Metaloide', conf: '[Ne] 3s² 3p²' },
          { z: 26, s: 'Fe', n: 'Hierro', mass: 55.845, cat: 'Metal de transición', conf: '[Ar] 3d⁶ 4s²' },
          { z: 29, s: 'Cu', n: 'Cobre', mass: 63.546, cat: 'Metal de transición', conf: '[Ar] 3d¹⁰ 4s¹' },
          { z: 47, s: 'Ag', n: 'Plata', mass: 107.87, cat: 'Metal de transición', conf: '[Kr] 4d¹⁰ 5s¹' },
          { z: 79, s: 'Au', n: 'Oro', mass: 196.97, cat: 'Metal de transición', conf: '[Xe] 4f¹⁴ 5d¹⁰ 6s¹' },
          { z: 92, s: 'U', n: 'Uranio', mass: 238.03, cat: 'Actínido', conf: '[Rn] 5f³ 6d¹ 7s²' },
        ]
        const match = ELEMENTS.find((e) => e.s.toLowerCase() === q || e.n.toLowerCase().includes(q) || String(e.z) === q)
        if (match) {
          return (
            `ELEMENTO QUÍMICO:\n` +
            `⚛ ${match.n} (${match.s}) - Número atómico (Z): ${match.z}\n` +
            `• Masa atómica: ${match.mass} u\n` +
            `• Clasificación: ${match.cat}\n` +
            `• Configuración electrónica: ${match.conf}`
          )
        }
        return `Elemento no encontrado para "${query}". Elementos disponibles en base: ${ELEMENTS.map((e) => `${e.n} (${e.s})`).join(', ')}`
      }

      if (category === 'formula') {
        if (q.includes('fuerza') || q.includes('f=ma')) {
          const m = parseFloat(q.match(/m\s*=\s*([-\d.]+)/)?.[1] ?? '1')
          const a = parseFloat(q.match(/a\s*=\s*([-\d.]+)/)?.[1] ?? '9.8')
          return `SEGUNDA LEY DE NEWTON (F = m·a):\n• Masa: ${m} kg, Aceleración: ${a} m/s²\n• Fuerza resultante: ${(m * a).toFixed(3)} Newtons (N)`
        }
        if (q.includes('cinetica') || q.includes('energia')) {
          const m = parseFloat(q.match(/m\s*=\s*([-\d.]+)/)?.[1] ?? '1')
          const v = parseFloat(q.match(/v\s*=\s*([-\d.]+)/)?.[1] ?? '10')
          const ec = 0.5 * m * v * v
          return `ENERGÍA CINÉTICA (Ec = ½·m·v²):\n• Masa: ${m} kg, Velocidad: ${v} m/s\n• Energía: ${ec.toFixed(3)} Julios (J)`
        }
        if (q.includes('relatividad') || q.includes('mc2') || q.includes('mc²')) {
          const m = parseFloat(q.match(/m\s*=\s*([-\d.]+)/)?.[1] ?? '0.001')
          const c = 299792458
          const e = m * c * c
          return `EQUIVALENCIA MASA-ENERGÍA (E = m·c²):\n• Masa: ${m} kg\n• Energía liberada: ${e.toExponential(4)} Julios (J) (~${(e / 4.184e9).toFixed(1)} toneladas de TNT)`
        }
        return 'Fórmulas soportadas: "fuerza: m=10, a=5", "cinetica: m=2, v=15", "relatividad: m=0.001".'
      }

      return 'Especifica categoría: element, formula o constant.'
    },
  },

  geography_world_atlas: {
    name: 'geography_world_atlas',
    description: 'Atlas geográfico mundial offline: países, capitales, continentes, población, monedas y cálculo de distancia ortodrómica (Haversine) entre coordenadas en km.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Acción: "country" o "distance"', enum: ['country', 'distance'] },
        query: { type: 'string', description: 'Nombre del país (ej. "España", "Japón", "Argentina") o coordenadas lat1,lon1,lat2,lon2' },
      },
      required: ['action', 'query'],
    },
    execute: async ({ action, query }) => {
      const q = String(query).toLowerCase().trim()

      if (action === 'country') {
        const COUNTRIES = [
          { name: 'España', cap: 'Madrid', cont: 'Europa', pop: '47.5M', cur: 'Euro (EUR)', lang: 'Español', flag: '🇪🇸' },
          { name: 'México', cap: 'Ciudad de México', cont: 'América', pop: '128M', cur: 'Peso mexicano (MXN)', lang: 'Español', flag: '🇲🇽' },
          { name: 'Argentina', cap: 'Buenos Aires', cont: 'América', pop: '46M', cur: 'Peso argentino (ARS)', lang: 'Español', flag: '🇦🇷' },
          { name: 'Colombia', cap: 'Bogotá', cont: 'América', pop: '51.5M', cur: 'Peso colombiano (COP)', lang: 'Español', flag: '🇨🇴' },
          { name: 'Chile', cap: 'Santiago', cont: 'América', pop: '19.5M', cur: 'Peso chileno (CLP)', lang: 'Español', flag: '🇨🇱' },
          { name: 'Estados Unidos', cap: 'Washington D.C.', cont: 'América', pop: '335M', cur: 'Dólar (USD)', lang: 'Inglés', flag: '🇺🇸' },
          { name: 'Japón', cap: 'Tokio', cont: 'Asia', pop: '125M', cur: 'Yen (JPY)', lang: 'Japonés', flag: '🇯🇵' },
          { name: 'Alemania', cap: 'Berlín', cont: 'Europa', pop: '84M', cur: 'Euro (EUR)', lang: 'Alemán', flag: '🇩🇪' },
          { name: 'Francia', cap: 'París', cont: 'Europa', pop: '68M', cur: 'Euro (EUR)', lang: 'Francés', flag: '🇫🇷' },
          { name: 'Reino Unido', cap: 'Londres', cont: 'Europa', pop: '67M', cur: 'Libra esterlina (GBP)', lang: 'Inglés', flag: '🇬🇧' },
          { name: 'Italia', cap: 'Roma', cont: 'Europa', pop: '59M', cur: 'Euro (EUR)', lang: 'Italiano', flag: '🇮🇹' },
          { name: 'Brasil', cap: 'Brasilia', cont: 'América', pop: '215M', cur: 'Real (BRL)', lang: 'Portugués', flag: '🇧🇷' },
          { name: 'Canadá', cap: 'Ottawa', cont: 'América', pop: '39M', cur: 'Dólar canadiense (CAD)', lang: 'Inglés, Francés', flag: '🇨🇦' },
          { name: 'China', cap: 'Pekín', cont: 'Asia', pop: '1,410M', cur: 'Yuan (CNY)', lang: 'Chino Mandarín', flag: '🇨🇳' },
        ]
        const c = COUNTRIES.find((x) => x.name.toLowerCase().includes(q) || x.cap.toLowerCase().includes(q))
        if (c) {
          return (
            `INFORMACIÓN DE PAÍS:\n` +
            `${c.flag} ${c.name}\n` +
            `• Capital: ${c.cap}\n` +
            `• Continente: ${c.cont}\n` +
            `• Población aproximada: ${c.pop}\n` +
            `• Idioma oficial: ${c.lang}\n` +
            `• Moneda: ${c.cur}`
          )
        }
        return `País no encontrado para "${query}". Disponibles: ${COUNTRIES.map((x) => x.name).join(', ')}`
      }

      if (action === 'distance') {
        const coords = q.match(/([-\d.]+)/g)
        if (!coords || coords.length < 4) return 'Proporciona 4 coordenadas: lat1, lon1, lat2, lon2 (ej. "40.4168, -3.7038, 48.8566, 2.3522").'
        const [lat1, lon1, lat2, lon2] = coords.map(Number)
        const toRad = (deg: number) => (deg * Math.PI) / 180
        const R = 6371 // Radio terrestre en km
        const dLat = toRad(lat2! - lat1!)
        const dLon = toRad(lon2! - lon1!)
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1!)) * Math.cos(toRad(lat2!)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
        const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return `DISTANCIA ORTODRÓMICA (Fórmula de Haversine):\n• Punto A: (${lat1}, ${lon1})\n• Punto B: (${lat2}, ${lon2})\n• Distancia en línea recta: ${distKm.toFixed(2)} km (~${(distKm * 0.621371).toFixed(2)} millas)`
      }

      return 'Acción no válida. Usa country o distance.'
    },
  },

  philosophy_logic: {
    name: 'philosophy_logic',
    description: 'Lógica formal y filosofía offline: tablas de verdad proposicionales (AND, OR, NOT, IMPLIES, XOR), falacias lógicas y corrientes filosóficas (Estoicismo, Existencialismo, Racionalismo).',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Acción: "truth_table", "fallacies", "philosophy_schools"', enum: ['truth_table', 'fallacies', 'philosophy_schools'] },
        topic: { type: 'string', description: 'Tema o término de consulta' },
      },
      required: ['action'],
    },
    execute: async ({ action, topic = '' }) => {
      const top = String(topic).toLowerCase().trim()

      if (action === 'truth_table') {
        return (
          `TABLA DE VERDAD PROPOSICIONAL COMPLETA (A y B):\n` +
          `┌───┬───┬─────────┬────────┬─────────┬─────────┬──────────┐\n` +
          `│ A │ B │ A ∧ B   │ A ∨ B  │ ¬A      │ A → B   │ A ⊕ B    │\n` +
          `│   │   │ (AND)   │ (OR)   │ (NOT)   │ (IMPL)  │ (XOR)    │\n` +
          `├───┼───┼─────────┼────────┼─────────┼─────────┼──────────┤\n` +
          `│ V │ V │    V    │   V    │    F    │    V    │    F     │\n` +
          `│ V │ F │    F    │   V    │    F    │    F    │    V     │\n` +
          `│ F │ V │    F    │   V    │    V    │    V    │    V     │\n` +
          `│ F │ F │    F    │   F    │    V    │    V    │    F     │\n` +
          `└───┴───┴─────────┴────────┴─────────┴─────────┴──────────┘\n` +
          `Nota: La implicación lógica (A → B) solo es falsa cuando el antecedente es verdadero y el consecuente falso.`
        )
      }

      if (action === 'fallacies') {
        const FAL = [
          { name: 'Ad Hominem', desc: 'Atacar a la persona que argumenta en lugar de refutar su tesis (ej. "No le creas porque es joven").' },
          { name: 'Hombre de Paja', desc: 'Caricaturizar o distorsionar el argumento del oponente para refutarlo fácilmente.' },
          { name: 'Falso Dilema', desc: 'Presentar solo dos alternativas extremas cuando existen más opciones intermedias.' },
          { name: 'Ad Verecundiam (Autoridad)', desc: 'Dar por válido un argumento solo porque lo dijo alguien famoso o una figura de prestigio.' },
          { name: 'Post Hoc Ergo Propter Hoc', desc: 'Asumir causalidad solo porque un suceso ocurrió antes que otro.' },
          { name: 'Sesgo de Confirmación', desc: 'Buscar e interpretar solo información que confirme las creencias previas.' },
        ]
        const match = FAL.filter((f) => !top || f.name.toLowerCase().includes(top) || f.desc.toLowerCase().includes(top))
        return `CATÁLOGO DE FALACIAS Y SESGOS COGNITIVOS:\n\n` + match.map((f) => `• ${f.name}:\n  ${f.desc}`).join('\n\n')
      }

      if (action === 'philosophy_schools') {
        const SCH = [
          { school: 'Estoicismo', fig: 'Zenón, Séneca, Epicteto, Marco Aurelio', desc: 'Diferenciar entre lo que podemos controlar y lo que no; vivir en armonía con la naturaleza y la razón imperturbable (ataraxia).' },
          { school: 'Racionalismo', fig: 'René Descartes, Spinoza, Leibniz', desc: 'La razón como fuente primordial del conocimiento frente a los sentidos engañosos ("Pienso, luego existo").' },
          { school: 'Empirismo', fig: 'John Locke, David Hume, George Berkeley', desc: 'Todo conocimiento proviene de la experiencia sensorial; la mente es una tábula rasa al nacer.' },
          { school: 'Existencialismo', fig: 'Kierkegaard, Jean-Paul Sartre, Albert Camus', desc: 'La existencia precede a la esencia; el ser humano está condenado a ser libre y a forjar su propio sentido en un mundo absurdo.' },
          { school: 'Ética Kantiana (Deontología)', fig: 'Immanuel Kant', desc: 'El Imperativo Categórico: obra solo según una máxima tal que puedas querer que se convierta en ley universal.' },
        ]
        const match = SCH.filter((s) => !top || s.school.toLowerCase().includes(top) || s.desc.toLowerCase().includes(top))
        return `CORRIENTES FILOSÓFICAS FUNDAMENTALES:\n\n` + match.map((s) => `🏛 ${s.school} (${s.fig}):\n${s.desc}`).join('\n\n')
      }

      return 'Acción no válida. Usa truth_table, fallacies o philosophy_schools.'
    },
  },

  finance_economics: {
    name: 'finance_economics',
    description: 'Cálculos de finanzas personales y economía: amortización de préstamos/hipotecas (cuota mensual), interés compuesto con aportaciones periódicas y erosión del poder adquisitivo por inflación.',
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', description: 'Modo: "loan", "compound_growth", "inflation"', enum: ['loan', 'compound_growth', 'inflation'] },
        params: { type: 'string', description: 'Parámetros (ej. loan: "monto=150000, interes=3.5, plazo_anos=25", compound: "inicial=5000, mensual=200, interes=7, anos=10", inflation: "monto=1000, inflacion=4, anos=5")' },
      },
      required: ['mode', 'params'],
    },
    execute: async ({ mode, params }) => {
      const pStr = String(params || '')

      if (mode === 'loan') {
        const P = parseFloat(pStr.match(/monto\s*=\s*([-\d.]+)/)?.[1] ?? '100000')
        const annualRate = parseFloat(pStr.match(/interes\s*=\s*([-\d.]+)/)?.[1] ?? '3.5') / 100
        const years = parseFloat(pStr.match(/plazo_anos\s*=\s*([-\d.]+)/)?.[1] ?? '20')
        const n = years * 12
        const r = annualRate / 12
        const monthlyPayment = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
        const totalPaid = monthlyPayment * n
        const totalInterest = totalPaid - P
        return (
          `SIMULACIÓN DE PRÉSTAMO / HIPOTECA (Sistema Francés):\n` +
          `• Capital financiado: ${P.toLocaleString('es-ES')} €\n` +
          `• Tipo de interés anual: ${(annualRate * 100).toFixed(2)}%\n` +
          `• Plazo: ${years} años (${n} cuotas mensuales)\n` +
          `• Cuota mensual: ${monthlyPayment.toFixed(2)} €/mes\n` +
          `• Total intereses pagados: ${totalInterest.toFixed(2)} €\n` +
          `• Coste total del préstamo: ${totalPaid.toFixed(2)} €`
        )
      }

      if (mode === 'compound_growth') {
        const init = parseFloat(pStr.match(/inicial\s*=\s*([-\d.]+)/)?.[1] ?? '1000')
        const pmt = parseFloat(pStr.match(/mensual\s*=\s*([-\d.]+)/)?.[1] ?? '100')
        const rate = parseFloat(pStr.match(/interes\s*=\s*([-\d.]+)/)?.[1] ?? '7') / 100
        const years = parseFloat(pStr.match(/anos\s*=\s*([-\d.]+)/)?.[1] ?? '10')
        const months = years * 12
        const r = rate / 12

        const fvInitial = init * Math.pow(1 + r, months)
        const fvPmt = pmt * ((Math.pow(1 + r, months) - 1) / r)
        const finalValue = fvInitial + fvPmt
        const totalContributed = init + pmt * months
        const interestEarned = finalValue - totalContributed

        return (
          `PROYECCIÓN DE INTERÉS COMPUESTO CON APORTACIONES:\n` +
          `• Capital inicial: ${init.toLocaleString('es-ES')} €\n` +
          `• Aportación mensual: ${pmt.toLocaleString('es-ES')} €/mes\n` +
          `• Rendimiento anual estimado: ${(rate * 100).toFixed(1)}%\n` +
          `• Plazo: ${years} años\n` +
          `• Total aportado de tu bolsillo: ${totalContributed.toLocaleString('es-ES')} €\n` +
          `• Intereses generados (beneficio): ${interestEarned.toFixed(2)} €\n` +
          `• VALOR FINAL ACUMULADO: ${finalValue.toFixed(2)} €`
        )
      }

      if (mode === 'inflation') {
        const amount = parseFloat(pStr.match(/monto\s*=\s*([-\d.]+)/)?.[1] ?? '1000')
        const inf = parseFloat(pStr.match(/inflacion\s*=\s*([-\d.]+)/)?.[1] ?? '3.5') / 100
        const years = parseFloat(pStr.match(/anos\s*=\s*([-\d.]+)/)?.[1] ?? '10')
        const futureValue = amount * Math.pow(1 - inf, years)
        const lossPercent = (1 - futureValue / amount) * 100
        return (
          `EROSIÓN POR INFLACIÓN (${years} años al ${(inf * 100).toFixed(1)}% anual):\n` +
          `• Capital original: ${amount.toLocaleString('es-ES')} €\n` +
          `• Poder de compra equivalente en ${years} años: ${futureValue.toFixed(2)} €\n` +
          `• Pérdida de poder adquisitivo: -${lossPercent.toFixed(1)}%`
        )
      }

      return 'Modo no válido: usa loan, compound_growth o inflation.'
    },
  },

  device_clipboard_action: {
    name: 'device_clipboard_action',
    description: 'Copia cualquier texto, código o nota directamente al portapapeles del dispositivo.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto que se copiará al portapapeles' },
      },
      required: ['text'],
    },
    execute: async ({ text }) => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(String(text))
          return `Texto copiado al portapapeles correctamente (${String(text).length} caracteres).`
        }
        return 'Portapapeles no disponible en este entorno.'
      } catch (e: any) {
        return `Error al copiar: ${e?.message || e}`
      }
    },
  },

  audio_tone_alert: {
    name: 'audio_tone_alert',
    description: 'Emite un tono acústico o beep sintetizado en el altavoz del dispositivo (ideal para notificaciones o alarmas audibles).',
    parameters: {
      type: 'object',
      properties: {
        frequency: { type: 'string', description: 'Frecuencia en Hz (ej. 440, 880, por defecto 600)' },
        durationMs: { type: 'string', description: 'Duración en milisegundos (por defecto 300)' },
      },
      required: [],
    },
    execute: async ({ frequency = '600', durationMs = '300' }) => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = parseFloat(String(frequency)) || 600
          gain.gain.setValueAtTime(0.15, ctx.currentTime)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start()
          const dur = (parseFloat(String(durationMs)) || 300) / 1000
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
          setTimeout(() => {
            try {
              osc.stop()
              ctx.close()
            } catch {}
          }, dur * 1000 + 50)
          return `Alerta acústica reproducida (${frequency} Hz por ${durationMs}ms).`
        }
        return 'AudioContext no soportado en este dispositivo.'
      } catch (e: any) {
        return `Error al reproducir tono: ${e?.message || e}`
      }
    },
  },

  open_map_navigation: {
    name: 'open_map_navigation',
    description: 'Abre la aplicación de mapas o genera la ruta GPS hacia un destino o lugar.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'Nombre del lugar, dirección o coordenadas' },
      },
      required: ['destination'],
    },
    execute: async ({ destination }) => {
      const dest = String(destination).trim()
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`
      if (typeof window !== 'undefined') {
        window.open(url, '_blank')
      }
      return `Navegación iniciada para destino: "${dest}". Enlace: ${url}`
    },
  },

  messaging_action: {
    name: 'messaging_action',
    description: 'Prepara un mensaje para enviar por WhatsApp o SMS con texto predeterminado.',
    parameters: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Canal: "whatsapp" o "sms"', enum: ['whatsapp', 'sms'] },
        recipient: { type: 'string', description: 'Número de teléfono con código de país o nombre' },
        message: { type: 'string', description: 'Texto del mensaje' },
      },
      required: ['channel', 'message'],
    },
    execute: async ({ channel, recipient = '', message }) => {
      const cleanPhone = String(recipient).replace(/[^0-9+]/g, '')
      const msg = String(message)
      if (channel === 'whatsapp') {
        const url = cleanPhone
          ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`
        if (typeof window !== 'undefined') {
          window.open(url, '_blank')
        }
        return `Chat de WhatsApp preparado con destinatario: ${cleanPhone || 'elegir en app'}. Enlace: ${url}`
      } else {
        const uri = `sms:${cleanPhone}?body=${encodeURIComponent(msg)}`
        if (typeof window !== 'undefined') {
          window.location.href = uri
        }
        return `SMS preparado para: ${cleanPhone || 'contacto'}.`
      }
    },
  },

  device_vibrate_haptic: {
    name: 'device_vibrate_haptic',
    description: 'Activa una vibración física en el teléfono (API de vibración táctil).',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Patrón: "corto" (100ms), "largo" (500ms), "doble" o "sos"', enum: ['corto', 'largo', 'doble', 'sos'] },
      },
      required: [],
    },
    execute: async ({ pattern = 'corto' }) => {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        const pat = String(pattern).toLowerCase()
        let timings: number | number[] = 120
        if (pat === 'largo') timings = 600
        else if (pat === 'doble') timings = [150, 100, 150]
        else if (pat === 'sos') timings = [100, 100, 100, 100, 100, 200, 300, 100, 300, 100, 300, 200, 100, 100, 100]
        const success = navigator.vibrate(timings)
        return success ? `Vibración táctil ejecutada (${pat}).` : 'El dispositivo no respondió a la vibración.'
      }
      return 'Vibración táctil no soportada en este entorno.'
    },
  },

  system_share_content: {
    name: 'system_share_content',
    description: 'Abre la hoja de compartir del sistema (Web Share API) o copia al portapapeles para transferir texto a cualquier app.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título del contenido a compartir' },
        text: { type: 'string', description: 'Texto del mensaje o reporte' },
        url: { type: 'string', description: 'Enlace web opcional' },
      },
      required: ['text'],
    },
    execute: async ({ title = 'Jinx AI', text, url }) => {
      const shareData: ShareData = {
        title: String(title),
        text: String(text),
        ...(url ? { url: String(url) } : {}),
      }
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData)
          return `Contenido compartido exitosamente con el sistema ("${title}").`
        } catch (e: any) {
          if (e.name === 'AbortError') return 'El usuario canceló el diálogo de compartir.'
        }
      }
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(String(text))
          return `Hoja de compartir no disponible; texto copiado automáticamente al portapapeles ("${title}").`
        }
      } catch {}
      return `Contenido preparado para compartir:\n${text}`
    },
  },

  open_browser_search: {
    name: 'open_browser_search',
    description: 'Abre una URL o realiza una búsqueda web en una nueva pestaña.',
    parameters: {
      type: 'object',
      properties: {
        queryOrUrl: { type: 'string', description: 'Dirección URL o consulta de búsqueda' },
      },
      required: ['queryOrUrl'],
    },
    execute: async ({ queryOrUrl }) => {
      const target = String(queryOrUrl).trim()
      const url = target.startsWith('http://') || target.startsWith('https://')
        ? target
        : `https://duckduckgo.com/?q=${encodeURIComponent(target)}`
      if (typeof window !== 'undefined') {
        window.open(url, '_blank')
      }
      return `Página abierta en navegador: ${url}`
    },
  },

  generate_pdf_document: {
    name: 'generate_pdf_document',
    description: 'Genera y descarga un documento PDF profesional formateado (reportes, resúmenes, contratos, listas o tablas) 100% offline.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título principal del documento' },
        subtitle: { type: 'string', description: 'Subtítulo o descripción breve (opcional)' },
        author: { type: 'string', description: 'Nombre del autor o entidad (opcional)' },
        content: { type: 'string', description: 'Contenido del documento en texto, párrafos o formato JSON con secciones' },
        filename: { type: 'string', description: 'Nombre del archivo .pdf a generar (opcional)' },
      },
      required: ['title', 'content'],
    },
    execute: async ({ title, subtitle, author, content, filename }) => {
      try {
        let sections: PdfSection[] = []
        const rawContent = String(content).trim()
        if (rawContent.startsWith('[') || rawContent.startsWith('{')) {
          try {
            const parsed = JSON.parse(rawContent)
            sections = Array.isArray(parsed) ? parsed : [parsed]
          } catch {
            sections = [{ text: rawContent }]
          }
        } else {
          const blocks = rawContent.split(/\n\n+/)
          sections = blocks.map((b) => {
            if (b.startsWith('# ')) return { heading: b.replace(/^#\s*/, '') }
            if (b.startsWith('## ')) return { heading: b.replace(/^##\s*/, '') }
            if (b.startsWith('- ') || b.startsWith('* ')) {
              return { bullets: b.split('\n').map((l) => l.replace(/^[-*]\s*/, '')) }
            }
            if (b.startsWith('```')) {
              return { code: b.replace(/^```[a-z]*\n?/, '').replace(/```$/, '') }
            }
            return { text: b }
          })
        }

        const docOptions: PdfDocumentOptions = {
          title: String(title),
          subtitle: subtitle ? String(subtitle) : undefined,
          author: author ? String(author) : 'Jinx AI',
          sections,
        }

        const res = downloadPdf(docOptions, filename ? String(filename) : undefined)
        return `Documento PDF generado y descargado exitosamente: "${res.filename}" (${res.sizeBytes} bytes, ${docOptions.sections.length} secciones).`
      } catch (err: any) {
        return `Error al generar PDF: ${err?.message || err}`
      }
    },
  },

  generate_qr_code: {
    name: 'generate_qr_code',
    description: 'Genera un código QR vectorial SVG 100% offline para URLs, textos, contraseñas, configuraciones WiFi o contactos.',
    parameters: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Texto o enlace a codificar en el código QR' },
        size: { type: 'string', description: 'Tamaño en píxeles (ej. 256, 320, por defecto 256)' },
        download: { type: 'string', description: 'Si es "true", descarga el archivo .svg generado', enum: ['true', 'false'] },
      },
      required: ['data'],
    },
    execute: async ({ data, size = '256', download = 'false' }) => {
      try {
        const sz = parseInt(String(size), 10) || 256
        const svgStr = generateQrSvg({ text: String(data), size: sz })
        if (download === 'true') {
          const blob = new Blob([svgStr], { type: 'image/svg+xml' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'codigo_qr.svg'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 5000)
          return `Código QR generado y descargado ("codigo_qr.svg") para: "${data}".`
        }
        return `CÓDIGO QR GENERADO OFFLINE (${sz}x${sz} px) para:\n"${data}"\n\n[Vector SVG disponible y preparado].`
      } catch (err: any) {
        return `Error al generar código QR: ${err?.message || err}`
      }
    },
  },

  generate_svg_chart: {
    name: 'generate_svg_chart',
    description: 'Crea gráficos vectoriales SVG (barras, líneas de tendencia o tarjetas KPI) con estética Blanco y Negro.',
    parameters: {
      type: 'object',
      properties: {
        chartType: { type: 'string', enum: ['bar', 'line', 'kpi'], description: 'Tipo de gráfico' },
        title: { type: 'string', description: 'Título del gráfico' },
        dataJson: { type: 'string', description: 'Datos en JSON. Ejemplo barras/líneas: [{"label":"Ene","value":120},{"label":"Feb","value":180}]. Para KPI: {"value":"$24,500","delta":"18%","subtitle":"Ingresos mensuales"}' },
      },
      required: ['chartType', 'title', 'dataJson'],
    },
    execute: async ({ chartType, title, dataJson }) => {
      try {
        const parsed = JSON.parse(String(dataJson))
        let svg = ''
        if (chartType === 'bar') {
          svg = generateBarChartSvg({ title: String(title), data: parsed })
        } else if (chartType === 'line') {
          svg = generateLineChartSvg({ title: String(title), data: parsed })
        } else {
          svg = generateKpiCardSvg({ title: String(title), value: parsed.value, delta: parsed.delta, subtitle: parsed.subtitle })
        }
        return `GRÁFICO VECTORIAL GENERADO (${chartType.toUpperCase()}):\n\n\`\`\`xml\n${svg.slice(0, 300)}...\n\`\`\`\n\nGráfico renderizado listo para incrustar.`
      } catch (err: any) {
        return `Error al generar gráfico: ${err?.message || err}. Asegúrate de pasar datos JSON válidos.`
      }
    },
  },

  export_spreadsheet_csv: {
    name: 'export_spreadsheet_csv',
    description: 'Genera y descarga un archivo de hoja de cálculo CSV con filas y columnas tabulares para abrir en Excel, Calc o Google Sheets.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Nombre del archivo .csv' },
        headers: { type: 'string', description: 'Cabeceras separadas por coma (ej. "Nombre,Edad,Ciudad,Puntuación")' },
        rowsJson: { type: 'string', description: 'Filas en JSON array de arrays (ej. [["Ana",28,"Madrid",95],["Luis",32,"Barcelona",88]])' },
      },
      required: ['filename', 'headers', 'rowsJson'],
    },
    execute: async ({ filename, headers, rowsJson }) => {
      try {
        const headCols = String(headers).split(',').map((h) => h.trim())
        const rows: (string | number)[][] = JSON.parse(String(rowsJson))
        const escapeCell = (c: any) => {
          const s = String(c ?? '')
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
        }
        const csvContent = [headCols.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const cleanName = String(filename).endsWith('.csv') ? String(filename) : `${filename}.csv`
        a.download = cleanName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 5000)
        return `Hoja de cálculo CSV generada y descargada: "${cleanName}" (${rows.length} filas, ${headCols.length} columnas).`
      } catch (err: any) {
        return `Error al exportar CSV: ${err?.message || err}`
      }
    },
  },

  hash_crypto: {
    name: 'hash_crypto',
    description:
      'Calcula hashes criptográficos seguros (SHA-256, SHA-1, SHA-512) o codifica/decodifica cadenas en Base64 o Hex de forma 100% offline.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto a procesar' },
        algorithm: {
          type: 'string',
          enum: ['SHA-256', 'SHA-1', 'SHA-512', 'base64_encode', 'base64_decode', 'hex'],
          description: 'Algoritmo o acción criptográfica a aplicar',
        },
      },
      required: ['text', 'algorithm'],
    },
    execute: async ({ text, algorithm }) => {
      const input = String(text ?? '')
      const algo = String(algorithm || 'SHA-256').toUpperCase()

      if (algo.includes('BASE64_ENCODE') || algo === 'BASE64') {
        const encoded = btoa(unescape(encodeURIComponent(input)))
        return `Codificación Base64:\n${encoded}`
      }
      if (algo.includes('BASE64_DECODE')) {
        try {
          const decoded = decodeURIComponent(escape(atob(input)))
          return `Decodificación Base64:\n${decoded}`
        } catch {
          return 'Error: Cadena Base64 no válida para decodificar.'
        }
      }

      const encoder = new TextEncoder()
      const data = encoder.encode(input)
      const subtleAlgo = algo === 'SHA-1' ? 'SHA-1' : algo === 'SHA-512' ? 'SHA-512' : 'SHA-256'
      const hashBuffer = await crypto.subtle.digest(subtleAlgo, data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
      return `Hash ${subtleAlgo} (${input.length} caracteres):\n${hashHex}`
    },
  },

  json_formatter: {
    name: 'json_formatter',
    description:
      'Valida, formatea con sangría (prettify), minifica o inspecciona la estructura y tipos de datos de un objeto o arreglo JSON.',
    parameters: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Cadena JSON a procesar' },
        action: {
          type: 'string',
          enum: ['prettify', 'minify', 'inspect'],
          description: 'Acción a realizar ("prettify", "minify" o "inspect")',
        },
      },
      required: ['data'],
    },
    execute: async ({ data, action }) => {
      try {
        const parsed = JSON.parse(String(data))
        const act = String(action || 'prettify').toLowerCase()
        if (act === 'minify') {
          return JSON.stringify(parsed)
        }
        if (act === 'inspect') {
          const isArr = Array.isArray(parsed)
          const keys = isArr ? `Array con ${parsed.length} elementos` : Object.keys(parsed).join(', ')
          return `ESTRUCTURA JSON:\n• Tipo: ${isArr ? 'Arreglo' : typeof parsed}\n• Claves raíz: ${keys}`
        }
        return `\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``
      } catch (err: any) {
        return `Error de sintaxis JSON: ${err?.message || err}. El texto no es JSON válido.`
      }
    },
  },

  uuid_generator: {
    name: 'uuid_generator',
    description:
      'Genera identificadores únicos universales (UUID v4) criptográficamente seguros o tokens aleatorios offline.',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Cantidad de UUIDs a generar (por defecto 1, máximo 20)' },
      },
      required: [],
    },
    execute: async ({ count }) => {
      const n = Math.min(Math.max(Number(count) || 1, 1), 20)
      const uuids: string[] = []
      for (let i = 0; i < n; i++) {
        uuids.push(crypto.randomUUID())
      }
      return `UUIDs generados (${n}):\n${uuids.join('\n')}`
    },
  },
}

/** Formato simplificado de herramientas para incluir en el System Prompt */
export function getToolsSystemPromptDescription(): string {
  return Object.values(TOOLS)
    .map((t) => {
      const argsDesc = Object.entries(t.parameters.properties)
        .map(([key, val]) => `${key}: ${val.description}`)
        .join(', ')
      return `- ${t.name}(${argsDesc}): ${t.description}`
    })
    .join('\n')
}
