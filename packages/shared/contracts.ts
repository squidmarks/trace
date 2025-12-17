/**
 * Zod validators for runtime validation
 * 
 * These validators ensure data integrity and type safety at runtime,
 * especially for API request/response validation.
 */

import { z } from "zod"

// ============================================================================
// Workspace Validators
// ============================================================================

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional()
})

// ============================================================================
// Document Validators
// ============================================================================

export const uploadDocumentSchema = z.object({
  filename: z.string().min(1).max(200),
  file: z.string()  // base64 string
})

export const addDocumentByUrlSchema = z.object({
  url: z.string().url(),
  filename: z.string().min(1).max(200).optional()
})

// ============================================================================
// Index Validators
// ============================================================================

export const indexParamsSchema = z.object({
  analysisModel: z.string().optional(),
  embeddingModel: z.string().optional(),
  renderDpi: z.number().int().min(72).max(300).optional(),
  renderQuality: z.number().int().min(1).max(100).optional()
})

export const triggerIndexSchema = z.object({
  params: indexParamsSchema.optional()
})

// ============================================================================
// Search Validators
// ============================================================================

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
})

// ============================================================================
// Chat Validators
// ============================================================================

export const chatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(10000),
  model: z.string().optional()
})

// ============================================================================
// Members Validators
// ============================================================================

export const addMemberSchema = z.object({
  email: z.string().email()
})

// ============================================================================
// Page Analysis Validators
// ============================================================================

export const boundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1)
})

export const anchorSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  type: z.string(),
  bbox: boundingBoxSchema.optional(),
  confidence: z.number().min(0).max(1)
})

export const entitySchema = z.object({
  type: z.string(),
  value: z.string(),
  canonicalValue: z.string().optional(),
  bbox: boundingBoxSchema.optional(),
  confidence: z.number().min(0).max(1)
})

export const relationSourceTargetSchema = z.object({
  kind: z.enum(["anchor", "entity", "page"]),
  id: z.string().optional(),
  value: z.string().optional(),
  pageNumber: z.number().int().min(1).optional()
})

export const relationSchema = z.object({
  type: z.string(),
  source: relationSourceTargetSchema,
  target: relationSourceTargetSchema,
  confidence: z.number().min(0).max(1),
  note: z.string().optional()
})

export const pageAnalysisSchema = z.object({
  summary: z.string(),
  topics: z.array(z.string()),
  anchors: z.array(anchorSchema),
  entities: z.array(entitySchema),
  relations: z.array(relationSchema),
  confidence: z.number().min(0).max(1),
  modelVersion: z.string(),
  promptVersion: z.string(),
  analyzedAt: z.date()
})

// ============================================================================
// Ontology Validators
// ============================================================================

export const entityTypeSchema = z.object({
  name: z.string(),
  description: z.string(),
  examples: z.array(z.string()),
  count: z.number().int().min(0)
})

export const relationTypeSchema = z.object({
  name: z.string(),
  description: z.string(),
  count: z.number().int().min(0)
})

export const aliasSchema = z.object({
  from: z.string(),
  to: z.string()
})

export const ontologySchema = z.object({
  entityTypes: z.array(entityTypeSchema),
  relationTypes: z.array(relationTypeSchema),
  aliases: z.array(aliasSchema)
})

// ============================================================================
// Indexer API Validators
// ============================================================================

export const startIndexJobSchema = z.object({
  workspaceId: z.string(),
  params: indexParamsSchema.optional()
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate and parse request body
 * Throws ZodError if validation fails
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data)
}

/**
 * Validate and parse request body (safe version)
 * Returns result with success flag
 */
export function safeValidateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): z.SafeParseReturnType<unknown, T> {
  return schema.safeParse(data)
}

// ============================================================================
// Type Exports
// ============================================================================

// Export inferred types for use in TypeScript
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceSchema>
export type UpdateWorkspaceRequest = z.infer<typeof updateWorkspaceSchema>
export type UploadDocumentRequest = z.infer<typeof uploadDocumentSchema>
export type AddDocumentByUrlRequest = z.infer<typeof addDocumentByUrlSchema>
export type TriggerIndexRequest = z.infer<typeof triggerIndexSchema>
export type SearchQuery = z.infer<typeof searchQuerySchema>
export type ChatRequest = z.infer<typeof chatRequestSchema>
export type AddMemberRequest = z.infer<typeof addMemberSchema>
export type PageAnalysis = z.infer<typeof pageAnalysisSchema>
export type Ontology = z.infer<typeof ontologySchema>
export type StartIndexJobRequest = z.infer<typeof startIndexJobSchema>
