import { searchChunks } from '../../rag/search'
import { listDocuments } from '../../rag/ingest'
import { summarizeDocument } from '../../rag/summarize'
import { calculate } from './calculator'
import { pythonRunner } from './pythonClient'
import { createNote, listNotes, searchNotes } from '../../db/repo'

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
    description: 'Gestiona notas personales en la base de datos local (crear, listar o buscar).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Acción a realizar',
          enum: ['create', 'list', 'search'],
        },
        title: {
          type: 'string',
          description: 'Título de la nota (solo para action="create")',
        },
        body: {
          type: 'string',
          description: 'Contenido de la nota (solo para action="create")',
        },
        query: {
          type: 'string',
          description: 'Término de búsqueda (solo para action="search")',
        },
      },
      required: ['action'],
    },
    execute: async ({ action, title, body, query }) => {
      if (action === 'create') {
        if (!title && !body) throw new Error('Se requiere título o contenido para crear una nota.')
        const id = await createNote(title || 'Sin título', body || '')
        return `Nota guardada exitosamente con ID ${id}: "${title || 'Sin título'}".`
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
