import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ModelConfig {
  name: string
  provider: string
  inputCostPer1M?: number
  outputCostPer1M?: number
  costPer1M?: number
  supportsVision?: boolean
  maxTokens?: number
  contextWindow?: number
  dimensions?: number
}

interface ModelsConfig {
  analysis: Record<string, ModelConfig>
  embeddings: Record<string, ModelConfig>
  chat: Record<string, ModelConfig>
}

let config: ModelsConfig | null = null

export function loadModelConfig(): ModelsConfig {
  if (config) return config

  const configPath = path.resolve(__dirname, "../../../../config/models.json")
  const rawConfig = fs.readFileSync(configPath, "utf-8")
  config = JSON.parse(rawConfig) as ModelsConfig

  return config
}

export function getAnalysisModel(modelName?: string): ModelConfig {
  const cfg = loadModelConfig()
  const name = modelName || process.env.ANALYSIS_MODEL || "gpt-4o-mini"
  
  const model = cfg.analysis[name]
  if (!model) {
    throw new Error(`Unknown analysis model: ${name}`)
  }
  
  return model
}

export function getEmbeddingModel(modelName?: string): ModelConfig {
  const cfg = loadModelConfig()
  const name = modelName || process.env.EMBEDDING_MODEL || "text-embedding-3-small"
  
  const model = cfg.embeddings[name]
  if (!model) {
    throw new Error(`Unknown embedding model: ${name}`)
  }
  
  return model
}

export function getChatModel(modelName?: string): ModelConfig {
  const cfg = loadModelConfig()
  const name = modelName || process.env.CHAT_MODEL || "gpt-4o-mini"
  
  const model = cfg.chat[name]
  if (!model) {
    throw new Error(`Unknown chat model: ${name}`)
  }
  
  return model
}

/**
 * Calculate cost based on token usage
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: ModelConfig
): number {
  if (!model.inputCostPer1M || !model.outputCostPer1M) {
    return 0
  }

  const inputCost = (inputTokens / 1_000_000) * model.inputCostPer1M
  const outputCost = (outputTokens / 1_000_000) * model.outputCostPer1M

  return inputCost + outputCost
}

/**
 * Calculate embedding cost based on token usage
 */
export function calculateEmbeddingCost(
  tokens: number,
  model: ModelConfig
): number {
  if (!model.costPer1M) {
    return 0
  }

  return (tokens / 1_000_000) * model.costPer1M
}

