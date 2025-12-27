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
  indexing?: {
    renderDpi?: 100 | 150 | 200 | 300    // Image resolution for PDF rendering
    renderQuality?: 75 | 85 | 95         // JPEG quality (1-100)
    analysisModel?: string               // OpenAI model for page analysis
    analysisTemperature?: number         // AI temperature (0.0-1.0)
    analysisDetail?: "low" | "auto" | "high"  // Vision API detail level
    customAnalysisPrompt?: string        // Custom prompt override for page analysis
  }
  search?: {
    maxResults?: number                  // Max search results to return
    minConfidence?: number               // Min confidence threshold (0.0-1.0)
  }
  chat?: {
    model?: string                       // OpenAI model for chat
    maxTokens?: number                   // Max response tokens
    customSystemPrompt?: string          // Custom system prompt override for chat
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
  indexedAt?: Date  // When the document was last successfully indexed
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

export interface Entity {
  type: string
  value: string
  canonicalValue?: string
  bbox?: BoundingBox
  confidence: number
}

// Connections that link to/from other pages (wires, hydraulic lines, mechanical linkages, etc.)
export interface Connection {
  label: string                    // Connection label (e.g., "LP", "LLO", "TTA", "H1", "M-LINK")
  specification?: string           // Full specification (e.g., "L-SSF 16 Y", "3/8 hydraulic line", "3mm linkage")
  direction: "incoming" | "outgoing" | "bidirectional"
  connectedComponent?: string      // Component this connection links to on this page
  bbox?: BoundingBox
  confidence: number
}

// New: Reference markers (triangles, circles) that point to other pages/sections
export interface ReferenceMarker {
  value: string                    // The marker value (e.g., "1", "2", "A")
  markerType: "triangle" | "circle" | "square" | "other"
  description?: string             // What this marker represents
  referencedPage?: number          // If known, the page this references
  referencedSection?: string       // Section or diagram name
  bbox?: BoundingBox
  confidence: number
}

// New: Connector/terminal details with pin assignments
export interface ConnectorPin {
  connectorName: string            // Connector identifier (e.g., "J-EE", "J-FF")
  pinNumber?: string               // Pin number or position
  wireSpec?: string                // Wire specification (e.g., "L-SSF 16 Y")
  signalName?: string              // Signal or function name
  connectedTo?: string             // What this pin connects to
  bbox?: BoundingBox
  confidence: number
}

export interface PageAnalysis {
  summary: string
  topics: string[]
  entities: Entity[]
  connections?: Connection[]             // Labeled connections linking to other pages (wires, hydraulic lines, mechanical linkages, etc.)
  referenceMarkers?: ReferenceMarker[]   // Cross-reference markers
  connectorPins?: ConnectorPin[]         // Detailed pin/terminal information
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
  imageData: string  // base64-encoded JPEG (full size)
  thumbnailData?: string  // base64-encoded JPEG (256x256px thumbnail)
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

export type MessageRole = "user" | "assistant" | "system" | "tool"

export interface Citation {
  pageId: ObjectId         // Reference to Page._id
  documentId: ObjectId     // Reference to Document._id
  documentName?: string    // Document filename for display
  pageNumber: number       // For display
  excerpt?: string         // Optional text excerpt that was relevant
}

export interface ToolCall {
  id: string               // Unique ID for this tool call (from OpenAI)
  name: string             // Tool name ("searchPages" | "getPage")
  arguments: Record<string, any>  // Tool arguments (parsed JSON)
  result?: any             // Tool execution result
}

export interface ChatMessage {
  _id?: string             // Optional ID for message tracking
  role: MessageRole        // Message role
  content: string          // Message content (text)
  createdAt: Date          // When message was created
  
  // Assistant-specific fields
  citations?: Citation[]   // Pages referenced in response
  toolCalls?: ToolCall[]   // Tools called by assistant
  
  // Tool response fields (for role: "tool")
  toolCallId?: string      // Links tool response to tool call
  
  // Metadata
  model?: string           // OpenAI model used (for assistant messages)
  finishReason?: string    // Why generation stopped
  tokenUsage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  cost?: number            // USD cost of this message
}

export interface ChatSession {
  _id: ObjectId
  workspaceId: ObjectId
  userId: ObjectId
  title?: string           // Optional custom title (defaults to first message)
  messages: ChatMessage[]  // All messages in conversation
  totalCost: number        // Total USD cost of all messages
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
    customAnalysisPrompt?: string // Custom prompt override
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
