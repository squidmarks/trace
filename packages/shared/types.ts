/**
 * Shared TypeScript types for Trace application
 * 
 * These types should be imported by both Web and Indexer services
 * to ensure type consistency across the system.
 */

import type { ObjectId } from "mongodb"

// ============================================================================
// User
// ============================================================================

export interface User {
  _id: ObjectId
  googleId: string
  email: string
  name: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// Workspace
// ============================================================================

export type IndexStatus = "idle" | "queued" | "processing" | "ready" | "failed"

export type IndexPhase = 
  | "fetch" 
  | "render" 
  | "analyze" 
  | "embed" 
  | "ontology" 
  | "finalize"

export interface WorkspaceMember {
  userId: ObjectId
  role: "viewer"
  addedAt: Date
  addedBy: ObjectId
}

export interface IndexProgress {
  phase: IndexPhase
  docsDone: number
  docsTotal: number
  pagesDone: number
  pagesTotal: number
  updatedAt: Date
}

export interface WorkspaceConfig {
  indexing: {
    renderDpi: 100 | 150 | 200          // Image resolution for PDF rendering
    renderQuality: 75 | 85 | 95          // JPEG quality (1-100)
    analysisModel: string                // OpenAI model for page analysis
    analysisTemperature: number          // AI temperature (0.0-1.0)
    analysisDetail: "low" | "auto" | "high"  // Vision API detail level
  }
  search?: {
    maxResults: number                   // Max search results to return
    minConfidence: number                // Min confidence threshold (0.0-1.0)
  }
  chat?: {
    model: string                        // OpenAI model for chat
    temperature: number                  // AI temperature (0.0-1.0)
    maxTokens: number                    // Max response tokens
  }
}

export interface Workspace {
  _id: ObjectId
  ownerId: ObjectId
  name: string
  description?: string
  members: WorkspaceMember[]
  indexStatus: IndexStatus
  indexProgress?: IndexProgress
  config?: WorkspaceConfig             // Workspace-level configuration
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// Document
// ============================================================================

export type DocumentSourceType = "upload" | "url"

export type DocumentStatus = "queued" | "processing" | "ready" | "failed"

export interface Document {
  _id: ObjectId
  workspaceId: ObjectId
  uploadedBy: ObjectId
  filename: string
  sourceType: DocumentSourceType
  sourceUrl?: string
  pdfData?: string  // base64-encoded PDF (only for uploads, optional)
  pdfHash?: string  // SHA-256 hash (optional, used for deduplication)
  pageCount?: number
  status: DocumentStatus
  error?: string
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// Page & Analysis
// ============================================================================

export interface BoundingBox {
  x: number  // normalized 0.0-1.0
  y: number
  w: number
  h: number
}

export interface Anchor {
  id: string
  label?: string
  type: string
  bbox?: BoundingBox
  confidence: number
}

export interface Entity {
  type: string
  value: string
  canonicalValue?: string
  bbox?: BoundingBox
  confidence: number
}

export type RelationSourceTargetKind = "anchor" | "entity" | "page"

export interface RelationSourceTarget {
  kind: RelationSourceTargetKind
  id?: string
  value?: string
  pageNumber?: number
}

export interface Relation {
  type: string
  source: RelationSourceTarget
  target: RelationSourceTarget
  confidence: number
  note?: string
}

export interface PageAnalysis {
  summary: string
  topics: string[]
  anchors: Anchor[]
  entities: Entity[]
  relations: Relation[]
  confidence: number
  modelVersion: string
  promptVersion: string
  analyzedAt: Date
}

export interface Page {
  _id: ObjectId
  workspaceId: ObjectId
  documentId: ObjectId
  pageNumber: number
  imageData: string  // base64-encoded JPEG
  imageHash: string  // SHA-256 hash
  analysis: PageAnalysis
  embedding: number[]  // 1536-dimensional vector
  embeddingText: string
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// Ontology
// ============================================================================

export interface EntityType {
  name: string
  description: string
  examples: string[]
  count: number
}

export interface RelationType {
  name: string
  description: string
  count: number
}

export interface Alias {
  from: string
  to: string
}

export interface Ontology {
  _id: ObjectId
  workspaceId: ObjectId
  entityTypes: EntityType[]
  relationTypes: RelationType[]
  aliases: Alias[]
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// Chat
// ============================================================================

export type MessageRole = "user" | "assistant" | "system"

export interface Citation {
  documentId: ObjectId
  pageNumber: number
}

export interface ToolCall {
  tool: string
  args: any
  result: any
}

export interface ChatMessage {
  role: MessageRole
  content: any
  createdAt: Date
  citations?: Citation[]
  toolCalls?: ToolCall[]
}

export interface ChatSession {
  _id: ObjectId
  workspaceId: ObjectId
  userId: ObjectId
  title?: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// API Request/Response Types
// ============================================================================
// NOTE: Most API request/response types are defined in contracts.ts as Zod schemas
// and inferred types. Only non-validated types are defined here.

// Search (not yet validated with Zod)
export interface SearchMatch {
  vector: number
  topics: string[]
  entities: string[]
}

export interface SearchResult {
  page: Page
  score: number
  matches: SearchMatch
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
}

// Chat (not yet validated with Zod)
export interface ChatResponse {
  sessionId: string
  message: {
    role: "assistant"
    content: string
    citations: Citation[]
    createdAt: Date
  }
}

// ============================================================================
// Indexer Types
// ============================================================================

export type IndexJobStatus = "queued" | "in-progress" | "complete" | "failed" | "cancelled"

export interface IndexJobProgress {
  totalDocuments: number
  processedDocuments: number
  totalPages: number
  processedPages: number
  analyzedPages: number
}

export interface IndexJobCost {
  inputTokens: number
  outputTokens: number
  totalCost: number // USD
}

export interface IndexJob {
  _id: ObjectId
  workspaceId: ObjectId
  status: IndexJobStatus
  progress: IndexJobProgress
  cost: IndexJobCost
  documentIds?: ObjectId[] // If specified, only index these documents
  renderDpi: number
  renderQuality: number
  modelConfig: {
    analysis: string // Model name from config/models.json
    analysisDetail: "low" | "auto" | "high" // Vision API detail level
    embeddings?: string
  }
  startedAt: Date
  completedAt?: Date
  error?: string
  createdAt: Date
  updatedAt: Date
}

// StartIndexJobRequest/Response are defined in contracts.ts

// ============================================================================
// Utility Types
// ============================================================================

export type Role = "owner" | "viewer"

export interface WorkspaceWithRole extends Workspace {
  role: Role
}

export interface PageWithImageUrl extends Omit<Page, "imageData"> {
  imageUrl: string  // data URL for browser display
}
