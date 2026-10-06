/**
 * Worker del LLM. Todo el cómputo de WebLLM (WebGPU) ocurre aquí para no congelar la UI.
 * llmClient.ts se comunica con este worker mediante CreateWebWorkerMLCEngine.
 */
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

const handler = new WebWorkerMLCEngineHandler()

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg)
}
