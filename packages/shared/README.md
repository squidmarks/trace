# @trace/shared

**Shared TypeScript types, contracts, and utilities** used across the Trace monorepo.

## 📦 What's Inside

- **`types.ts`** - Core TypeScript interfaces and types (User, Workspace, Document, Page, etc.)
- **`contracts.ts`** - Zod validation schemas for API requests/responses
- **`socket-events.ts`** - Socket.io event payload types for realtime communication
- **`index.ts`** - Main entry point that re-exports everything

## 🔧 Usage

Both the **Web App** and **Indexer Service** import from this package:

```typescript
// Import specific types
import type { Workspace, Document, Page } from "@trace/shared"

// Import validation schemas
import { createWorkspaceSchema } from "@trace/shared"

// Import socket event types
import type { IndexProgressEvent } from "@trace/shared"
```

## 📝 Adding New Types

1. **Add the type** to the appropriate file (`types.ts`, `contracts.ts`, or `socket-events.ts`)
2. **Export it** from `index.ts` (if not already using `export *`)
3. **No build step needed** - TypeScript imports directly from source

## ⚠️ Important

**This is the ONLY place types should be defined.** 

- ❌ Do NOT create duplicate type definitions in `/docs/`
- ❌ Do NOT create local types that should be shared
- ✅ DO add all shared types here
- ✅ DO use `@trace/shared` imports everywhere

## 🏗️ Monorepo Structure

```
trace/
├── apps/
│   ├── web/          → imports @trace/shared
│   └── indexer/      → imports @trace/shared
└── packages/
    └── shared/       ← YOU ARE HERE (single source of truth)
```

