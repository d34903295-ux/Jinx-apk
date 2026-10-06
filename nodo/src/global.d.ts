// Extensiones de tipos para APIs del navegador que TypeScript todavía no incluye.
declare global {
  interface Navigator {
    /** RAM aproximada en GB (Chrome/Edge; limitada a 8). */
    deviceMemory?: number
    userAgentData?: { mobile: boolean }
  }
}

declare module 'mammoth' {
  interface ExtractRawTextOptions {
    arrayBuffer?: ArrayBuffer
    buffer?: Buffer
    path?: string
  }
  interface Result {
    value: string
    messages: Array<{ type: string; message: string }>
  }
  export function extractRawText(options: ExtractRawTextOptions): Promise<Result>
  export function convertToHtml(options: ExtractRawTextOptions): Promise<Result>
}

declare module '*?url' {
  const src: string
  export default src
}

export {}

