// Regresión: "this.tokenizer is not a function" al importar documentos.
// Causa raíz: el modelo empaquetado carecía de tokenizer_config.json, por lo que
// transformers.js no construía un tokenizer invocable. Ejecuta: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const modelsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/models')
const MODEL = 'all-MiniLM-L6-v2'

test('el modelo de embeddings incluye todos los ficheros necesarios', () => {
  for (const f of ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx']) {
    assert.ok(existsSync(path.join(modelsDir, MODEL, f)), `falta ${f}`)
  }
})

test('el pipeline offline produce vectores 384-d normalizados', async () => {
  const t = await import('@huggingface/transformers')
  t.env.allowRemoteModels = false
  t.env.allowLocalModels = true
  t.env.localModelPath = modelsDir + path.sep
  const extractor = await t.pipeline('feature-extraction', MODEL, { dtype: 'q8' })
  assert.equal(typeof extractor.tokenizer, 'function')
  const out = await extractor(['hola mundo', 'segundo fragmento'], { pooling: 'mean', normalize: true })
  assert.deepEqual(out.dims, [2, 384])
  const norm = Math.hypot(...Array.from(out.data.slice(0, 384)))
  assert.ok(Math.abs(norm - 1) < 1e-3)
})
