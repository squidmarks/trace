# Page Picker Feature

## Overview
Users can now explicitly add specific document pages to their chat queries using a visual page picker interface.

## User Experience

### Adding Pages
1. Click the **[+]** button next to the Send button in chat
2. A modal opens with:
   - **Document selector dropdown** at the top
   - **Page viewer** showing current page with zoom/pan
   - **Navigation controls** (Previous/Next buttons)
   - **"Add Page" button** to select current page
3. Selected pages appear as **pills** above the chat input
4. Pills show: document name + page number
5. Pills are:
   - **Clickable** to view full page in modal
   - **Removable** via X button
6. Multiple pages can be added
7. Pages are cleared after message is sent

### UI Layout

```
┌─────────────────────────────────────────────┐
│ [📄 doc1.pdf p.44 ✕] [📄 doc2.pdf p.12 ✕]  │
│ ┌─────────────────────────────────────┐     │
│ │ Ask about your documents...          │ [+] │
│ └─────────────────────────────────────┘ [📤]│
└─────────────────────────────────────────────┘
```

## Technical Implementation

### New Components

#### `PagePicker.tsx`
- Modal for browsing and selecting pages
- Document dropdown selector
- Page viewer with navigation
- "Add Page" button

#### `SelectedPagePill.tsx`
- Visual representation of selected pages
- Clickable to view page
- Removable with X button

### Backend Changes

#### Schema Update (`packages/shared/contracts.ts`)
```typescript
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  explicitPageIds: z.array(z.string()).optional() // NEW
})
```

#### API Changes (`/api/workspaces/[id]/chat/[sessionId]/messages/route.ts`)
1. **Fetch explicit pages** when provided
2. **Prepend context** to user message:
   ```
   [EXPLICIT PAGE REFERENCES FROM USER]
   The user has explicitly selected these pages:
   - Page 44 from "doc.pdf"
     Summary: ...
     Topics: ...
   [END EXPLICIT REFERENCES]
   ```
3. **Add to citations** automatically so they appear in the UI

### Benefits

1. **Precise Control**: Users can reference exact pages
2. **Visual Selection**: Browse pages visually rather than typing names
3. **Context Anchoring**: AI knows exactly which pages to prioritize
4. **Better Answers**: Explicit context leads to more relevant responses
5. **No Typing**: No need to type document names or remember page numbers

### Use Cases

- **Follow-up questions**: "Based on the schematic on page 44..."
- **Comparison**: Add multiple pages to compare information
- **Clarification**: Reference specific diagram or section
- **Cross-document**: Select pages from different documents
- **Complex queries**: Provide additional context the AI should consider

## API Flow

1. **Frontend** sends:
   ```json
   {
     "content": "How does this work?",
     "explicitPageIds": ["abc123", "def456"]
   }
   ```

2. **Backend**:
   - Fetches pages from DB
   - Augments user message with page summaries
   - Adds pages to citations array
   - Passes augmented message to AI

3. **AI** receives context and responds based on explicit pages

4. **UI** displays:
   - AI response
   - Citations (including explicit pages) as clickable thumbnails

## Future Enhancements

- Add page number input field (quick jump to page)
- Thumbnail grid view instead of single page viewer
- Persist selected pages across messages (optional)
- Drag-and-drop reordering of selected pages
- Batch add multiple pages at once
- Keyboard shortcuts (e.g., ⌘+K to open picker)

