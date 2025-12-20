# Event/Message System Architecture

## Overview
Replaced ad hoc Socket.io handling with a systematic, type-safe event messaging system.

## Key Components

### 1. **Shared Event Types** (`packages/shared/socket-events.ts`)
- Defined TypeScript interfaces for all events
- Event name constants for type safety
- Matches actual emitted data structures

```typescript
export interface IndexProgressEvent {
  workspaceId: string
  phase: "processing"
  currentDocument?: { id: string; filename: string; current: number; total: number }
  totalDocuments: number
  processedDocuments: number
  totalPages: number
  processedPages: number
  analyzedPages: number
  message?: string
  etaSeconds?: number
}

export const ServerEvents = {
  INDEX_PROGRESS: "index:progress",
  INDEX_COMPLETE: "index:complete",
  INDEX_ERROR: "index:error",
  ...
} as const
```

### 2. **Event Context Provider** (`apps/web/contexts/EventContext.tsx`)
- Manages Socket.io connection lifecycle
- Provides subscription API for components
- Automatic workspace room joining/leaving

```typescript
<EventProvider>
  <YourApp />
</EventProvider>
```

### 3. **Event Hooks** (Frontend)

#### `useIndexEvents(workspaceId, callbacks)`
Subscribe to all index events for a workspace:

```typescript
useIndexEvents(workspaceId, {
  onProgress: (data) => {
    // Handle progress updates
    setProgress(data)
  },
  onComplete: (data) => {
    // Handle completion
    showSuccess()
  },
  onError: (data) => {
    // Handle errors
    showError(data.error)
  },
})
```

#### Individual hooks available:
- `useIndexProgress(workspaceId, onProgress?)` - Subscribe to progress
- `useIndexComplete(workspaceId, onComplete?)` - Subscribe to completion
- `useIndexError(workspaceId, onError?)` - Subscribe to errors
- `useEvents()` - Low-level access to subscribe/unsubscribe

### 4. **Type-Safe Emitting** (Backend)
Indexer uses typed event interfaces:

```typescript
import { ServerEvents, IndexProgressEvent } from "@trace/shared"

io.to(`workspace:${workspaceId}`).emit(
  ServerEvents.INDEX_PROGRESS,
  {
    workspaceId,
    phase: "processing",
    message: "Analyzing document...",
    etaSeconds: 120,
    // ... TypeScript ensures all required fields
  } as IndexProgressEvent
)
```

## Benefits

### Before (Ad Hoc)
- ❌ Manual Socket.io setup in each component (100+ lines)
- ❌ No type safety
- ❌ Event names as magic strings
- ❌ Data structures inconsistent
- ❌ Duplicate connection logic
- ❌ Hard to debug

### After (Systematic)
- ✅ Single line hook: `useIndexEvents(id, callbacks)`
- ✅ Full TypeScript type safety
- ✅ Centralized connection management
- ✅ Consistent data structures
- ✅ Easy to add new events
- ✅ Self-documenting
- ✅ Testable

## Usage Examples

### Simple Progress Display
```typescript
function MyComponent({ workspaceId }: Props) {
  const { progress } = useIndexEvents(workspaceId, {
    onComplete: () => alert("Done!"),
  })

  return <div>{progress?.message}</div>
}
```

### Complex Event Handling
```typescript
function DocumentsPage({ workspaceId }: Props) {
  const [status, setStatus] = useState("idle")
  
  useIndexEvents(workspaceId, {
    onProgress: (data) => {
      setStatus(`${data.message} (${data.analyzedPages}/${data.totalPages})`)
    },
    onComplete: (data) => {
      setStatus(`Indexed ${data.pageCount} pages`)
      refetchDocuments()
    },
    onError: (data) => {
      setStatus(`Error: ${data.error}`)
    },
  })

  return <div>{status}</div>
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Browser)                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐     ┌──────────────────────────────┐  │
│  │ Component A │────▶│     EventContext             │  │
│  └─────────────┘     │  (Socket.io Manager)         │  │
│                      │                               │  │
│  ┌─────────────┐     │  - Connection lifecycle      │  │
│  │ Component B │────▶│  - Event dispatcher          │  │
│  └─────────────┘     │  - Room management           │  │
│                      └──────────────────────────────┘  │
│  ┌─────────────┐              │                         │
│  │ Component C │──────────────┘                         │
│  └─────────────┘                                        │
│                                                           │
└────────────────────────┬─────────────────────────────────┘
                         │
                    Socket.io
                         │
┌────────────────────────▼─────────────────────────────────┐
│                 Indexer Service (Backend)                 │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Indexing Processor                                 │ │
│  │                                                     │ │
│  │  io.emit("index:progress", {                       │ │
│  │    workspaceId,                                     │ │
│  │    message: "Analyzing...",                         │ │
│  │    etaSeconds: 120,                                 │ │
│  │    ...                                              │ │
│  │  })                                                 │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

## Files Changed

### Created
- `apps/web/contexts/EventContext.tsx` - Event provider and hooks
- `apps/web/components/Providers.tsx` - App-level providers wrapper
- `EVENT-SYSTEM-ARCHITECTURE.md` - This documentation

### Modified
- `packages/shared/socket-events.ts` - Fixed event types to match reality
- `apps/web/app/layout.tsx` - Wrapped app with EventProvider
- `apps/web/app/(dashboard)/workspaces/[id]/documents/page.tsx` - Uses new hooks

### To Be Deprecated
- `apps/web/lib/socket.ts` - Old manual Socket.io handling (can be deleted)

## Next Steps

1. **Test the new system** - Verify events work correctly
2. **Update indexer** - Use typed event names from `@trace/shared`
3. **Delete old socket.ts** - Remove deprecated code
4. **Add more events** - Chat events, document events, etc.
5. **Add event monitoring** - DevTools panel for debugging events

## Migration Guide

### Old Way (Manual)
```typescript
// 100+ lines of code
useEffect(() => {
  const socket = io(url)
  socket.on("connect", () => { ... })
  socket.on("index:progress", (data) => { ... })
  socket.on("index:complete", (data) => { ... })
  socket.on("index:error", (data) => { ... })
  return () => {
    socket.off(...)
    socket.disconnect()
  }
}, [])
```

### New Way (Hooks)
```typescript
// 10 lines of code
useIndexEvents(workspaceId, {
  onProgress: (data) => setProgress(data),
  onComplete: (data) => handleComplete(data),
  onError: (data) => handleError(data),
})
```

## Scalability

This architecture makes it trivial to add new event types:

1. Add event interface to `socket-events.ts`
2. Add event name to constants
3. Create hook in `EventContext.tsx` (optional)
4. Emit from backend with type safety

**No more hunting through components to update Socket.io listeners!**
