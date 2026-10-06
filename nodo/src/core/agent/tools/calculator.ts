/**
 * Evaluador matemático seguro por descenso recursivo. Cero llamadas a `eval` o `Function`.
 * Soporta operaciones aritméticas básicas, potencias, paréntesis y funciones matemáticas comunes.
 */

export function calculate(expression: string): number {
  const sanitized = expression
    .replace(/\s+/g, '')
    .replace(/pi/gi, String(Math.PI))
    .replace(/e/gi, String(Math.E))

  let pos = 0

  function peek(): string {
    return sanitized[pos] ?? ''
  }

  function consume(): string {
    return sanitized[pos++] ?? ''
  }

  function parseNumber(): number {
    const start = pos
    if (peek() === '-' || peek() === '+') {
      consume()
    }
    while (/[0-9.]/.test(peek())) {
      consume()
    }
    const token = sanitized.slice(start, pos)
    const num = parseFloat(token)
    if (isNaN(num)) throw new Error(`Número inválido en posición ${start}: "${token}"`)
    return num
  }

  function parseFactor(): number {
    const char = peek()

    // Funciones matemáticas
    if (/[a-z]/i.test(char)) {
      let funcName = ''
      while (/[a-z]/i.test(peek())) {
        funcName += consume().toLowerCase()
      }
      if (consume() !== '(') throw new Error(`Se esperaba '(' después de ${funcName}`)
      const arg = parseExpression()
      if (consume() !== ')') throw new Error(`Se esperaba ')' después del argumento de ${funcName}`)

      switch (funcName) {
        case 'sqrt':
          if (arg < 0) throw new Error('No se puede calcular raíz de número negativo')
          return Math.sqrt(arg)
        case 'abs':
          return Math.abs(arg)
        case 'sin':
          return Math.sin(arg)
        case 'cos':
          return Math.cos(arg)
        case 'tan':
          return Math.tan(arg)
        case 'log':
        case 'ln':
          if (arg <= 0) throw new Error('Logaritmo solo definido para números positivos')
          return Math.log(arg)
        case 'exp':
          return Math.exp(arg)
        case 'round':
          return Math.round(arg)
        case 'floor':
          return Math.floor(arg)
        case 'ceil':
          return Math.ceil(arg)
        default:
          throw new Error(`Función desconocida: ${funcName}`)
      }
    }

    if (char === '(') {
      consume() // consume '('
      const val = parseExpression()
      if (consume() !== ')') throw new Error("Falta paréntesis de cierre ')'")
      return val
    }

    return parseNumber()
  }

  function parsePower(): number {
    let left = parseFactor()
    while (peek() === '^') {
      consume()
      const right = parsePower() // asociatividad a la derecha
      left = Math.pow(left, right)
    }
    return left
  }

  function parseTerm(): number {
    let left = parsePower()
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume()
      const right = parsePower()
      if (op === '*') left *= right
      else if (op === '/') {
        if (right === 0) throw new Error('División por cero')
        left /= right
      } else if (op === '%') {
        left %= right
      }
    }
    return left
  }

  function parseExpression(): number {
    let left = parseTerm()
    while (peek() === '+' || peek() === '-') {
      const op = consume()
      const right = parseTerm()
      if (op === '+') left += right
      else left -= right
    }
    return left
  }

  const result = parseExpression()
  if (pos < sanitized.length) {
    throw new Error(`Carácter inesperado en posición ${pos}: "${sanitized[pos]}"`)
  }
  return result
}
