# 09 - UI Routes & Screens

This document outlines the frontend routes, key screens, and UX flows for the Trace web application.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **UI Library**: React 18+
- **Styling**: Tailwind CSS
- **State Management**: React Context + hooks
- **Realtime**: Socket.io client (connected to Indexer)
- **Auth**: NextAuth (Google OAuth)

---

## Route Structure

```
/                           → Landing page (public)
/signin                     → Sign in with Google (public)
/workspaces                 → Workspace list (authenticated)
/workspaces/new             → Create workspace (authenticated)
/workspaces/:id             → Workspace detail (authenticated)
  ├─ /documents             → Documents tab (default)
  ├─ /index                 → Indexing tab
  ├─ /explore               → Search/explore tab
  ├─ /chat                  → Chat tab
  ├─ /ontology              → Ontology view tab
  └─ /settings              → Workspace settings tab
/workspaces/:id/pages/:pageId  → Page viewer modal/page
```

---

## Public Routes

### Landing Page `/`

**Purpose**: Marketing page and entry point

**Components**:
- Hero section with product description
- Key features showcase
- "Get Started" CTA → `/signin`
- Example screenshots/demo

**UX Notes**:
- Responsive design
- Fast load time
- Clear value proposition

---

### Sign In `/signin`

**Purpose**: Authentication entry point

**Components**:
- "Sign in with Google" button
- Privacy policy link
- Terms of service link

**Flow**:
1. User clicks "Sign in with Google"
2. Redirects to Google OAuth
3. User authorizes
4. Redirects back to `/workspaces`

**Error Handling**:
- OAuth failure → Show error message with retry button
- Account not found → Auto-create user account

---

## Authenticated Routes

All routes below require active NextAuth session. Unauthenticated users are redirected to `/signin`.

### Workspace List `/workspaces`

**Purpose**: Browse and manage workspaces

**Layout**:
```
┌─────────────────────────────────────┐
│ [Trace Logo]  [User Menu ▾]         │
├─────────────────────────────────────┤
│ My Workspaces                       │
│ [+ New Workspace]                   │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📁 Electrical Schematics        │ │
│ │ Owner • 142 pages • Updated 2h  │ │
│ │ Status: Ready ✓                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📁 Legal Documents              │ │
│ │ Viewer • 89 pages • Updated 1d  │ │
│ │ Status: Processing... 45%       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Features**:
- Grid/list view toggle
- Sort by: name, updated, created
- Filter by: owned, shared
- Search workspaces by name
- Click workspace → navigate to workspace detail

**User Menu**:
- Profile info
- Settings (future)
- Sign out

---

### Create Workspace `/workspaces/new`

**Purpose**: Create new workspace

**Form Fields**:
- Name (required)
- Description (optional, multiline)

**Actions**:
- Cancel → back to list
- Create → POST to API → navigate to new workspace

**Validation**:
- Name: 1-100 characters
- Description: 0-500 characters

---

### Workspace Detail `/workspaces/:id`

**Purpose**: Main workspace interface with tabbed layout

**Layout**:
```
┌──────────────────────────────────────────────────┐
│ [← Back] Electrical Schematics     [User Menu ▾] │
├──────────────────────────────────────────────────┤
│ [Documents] [Index] [Explore] [Chat] [Ontology] [Settings] │
├──────────────────────────────────────────────────┤
│                                                  │
│              Tab Content Area                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Tabs**:
1. **Documents** (default) - Manage documents
2. **Index** - View index status and trigger re-indexing
3. **Explore** - Search and browse pages
4. **Chat** - AI assistant chat
5. **Ontology** - View workspace ontology
6. **Settings** - Manage workspace and permissions

**Permissions Display**:
- Owner: All tabs visible
- Viewer: Settings tab hidden

---

## Documents Tab `/workspaces/:id/documents`

**Purpose**: Upload and manage documents

**Layout**:
```
┌────────────────────────────────────┐
│ Documents                          │
│ [+ Upload PDF] [+ Add from URL]    │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 📄 schematic-main.pdf          │ │
│ │ 24 pages • Uploaded 2h ago     │ │
│ │ Status: Ready                  │ │
│ │                      [⋮ Menu]  │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 📄 floor-plans.pdf             │ │
│ │ 18 pages • Uploaded 1d ago     │ │
│ │ Status: Ready                  │ │
│ │                      [⋮ Menu]  │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Features**:
- Document list with metadata
- Upload button (opens file picker)
- Add from URL button (opens modal)
- Document menu: View, Delete (owner only)
- Empty state when no documents

**Upload Flow**:
1. User clicks "Upload PDF"
2. File picker opens
3. User selects PDF(s)
4. Upload progress bar
5. Success → Document appears in list
6. Toast: "Document uploaded. Start indexing to process."

**Add from URL Flow**:
1. User clicks "Add from URL"
2. Modal with URL input field
3. User pastes URL, clicks "Add"
4. Fetch progress indicator
5. Success → Document appears in list

**Permissions**:
- Owner: Can upload, add from URL, delete
- Viewer: View only

---

## Index Tab `/workspaces/:id/index`

**Purpose**: Monitor and control indexing

**Layout (Idle State)**:
```
┌─────────────────────────────────────┐
│ Indexing                            │
│                                     │
│ Status: Not indexed                 │
│ Documents: 3 ready                  │
│ Pages: 0 indexed                    │
│                                     │
│ [Start Indexing]                    │
│                                     │
│ Note: Indexing will process all    │
│ documents and extract searchable   │
│ content using AI.                  │
└─────────────────────────────────────┘
```

**Layout (Processing State)**:
```
┌─────────────────────────────────────┐
│ Indexing                            │
│                                     │
│ Status: Processing                  │
│ Phase: Analyzing pages...           │
│                                     │
│ Progress: ████████░░░░░░░ 45%      │
│                                     │
│ Documents: 1/3 complete             │
│ Pages: 15/42 processed              │
│                                     │
│ Estimated time: 3 minutes           │
└─────────────────────────────────────┘
```

**Layout (Ready State)**:
```
┌─────────────────────────────────────┐
│ Indexing                            │
│                                     │
│ Status: Ready ✓                     │
│ Last indexed: 2 hours ago           │
│ Pages indexed: 42                   │
│                                     │
│ [Re-index]                          │
│                                     │
│ Warning: Re-indexing will delete    │
│ the current index and process all   │
│ documents from scratch.             │
└─────────────────────────────────────┘
```

**Features**:
- Real-time progress updates (via Socket.io from Indexer)
- Phase indicator (fetch, render, analyze, embed, ontology, finalize)
- Progress bar with percentage
- Documents/pages counters
- Estimated time remaining
- Re-index button (owner only)

**States**:
- `idle`: Not indexed yet
- `queued`: Job queued, not started
- `processing`: Actively indexing
- `ready`: Indexing complete
- `failed`: Indexing failed (show error)

**Re-index Confirmation**:
- Modal: "Are you sure? This will delete the current index."
- Checkbox: "I understand this cannot be undone"
- [Cancel] [Re-index]

**Permissions**:
- Owner: Can trigger indexing
- Viewer: View only (no buttons)

---

## Explore Tab `/workspaces/:id/explore`

**Purpose**: Search and browse indexed pages

**Layout**:
```
┌─────────────────────────────────────────────┐
│ [Search: transformer protection    🔍]      │
├─────────────────────────────────────────────┤
│ 12 results                                  │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 📄 schematic-main.pdf - Page 5          │ │
│ │ [Thumbnail]                             │ │
│ │ Shows transformer T-101 with            │ │
│ │ protection relay 51-T...                │ │
│ │ Topics: transformer, protection, relay  │ │
│ │ Score: 0.92                             │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 📄 schematic-main.pdf - Page 12         │ │
│ │ [Thumbnail]                             │ │
│ │ Distribution transformer lineup...      │ │
│ │ Topics: transformer, distribution       │ │
│ │ Score: 0.87                             │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Load More]                                 │
└─────────────────────────────────────────────┘
```

**Features**:
- Search input with autocomplete suggestions
- Results list with thumbnails
- Match highlights (topics, entities)
- Click result → open page viewer
- Infinite scroll / pagination
- Filter by document (dropdown)
- Sort by: relevance, page number

**Empty States**:
- No index: "Index your documents first"
- No results: "No pages found. Try different keywords."
- Index in progress: "Indexing... Search will be available soon."

**Page Result Card**:
- Document name + page number
- Thumbnail (clickable)
- Summary snippet (first 150 chars)
- Matched topics (badges)
- Matched entities (badges)
- Similarity score (debug mode only)

**Permissions**:
- Owner & Viewer: Full access

---

## Chat Tab `/workspaces/:id/chat`

**Purpose**: Converse with AI assistant about workspace content

**Layout**:
```
┌───────────────────────────────────────────────┐
│ [Session List ▾]                              │
├───────────────────────────────────────────────┤
│                                               │
│   You: What protection is used for T-101?    │
│                                               │
│   Assistant:                                  │
│   Transformer T-101 uses overcurrent          │
│   protection relay 51-T with pickup at 150%   │
│   FLA, time delay 0.5s.                       │
│                                               │
│   📎 Page 5 • schematic-main.pdf              │
│                                               │
│ ┌─────────────────────────────────────────┐   │
│ │ Type your message...                    │   │
│ │                                  [Send] │   │
│ └─────────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

**Features**:
- Message thread (scrollable)
- Input field with send button
- Session dropdown (switch sessions)
- New session button
- Citations displayed as cards (clickable → page viewer)
- Loading indicator during AI response
- Auto-scroll to latest message

**Message Types**:
- User message: Right-aligned, blue background
- Assistant message: Left-aligned, gray background
- System message: Centered, italic (e.g., "Session started")

**Citation Card**:
```
┌───────────────────────────────────┐
│ 📄 Page 5 • schematic-main.pdf    │
│ [Thumbnail]                       │
│ Shows transformer T-101 with...  │
│ [View Page]                       │
└───────────────────────────────────┘
```

**Session Management**:
- Session dropdown shows recent sessions
- Each session has auto-generated title (first message or AI summary)
- Delete session option (trash icon)
- Sessions persist across page reloads

**Empty State**:
- No index: "Index your documents to start chatting"
- New session: "Ask me anything about your documents"

**Permissions**:
- Owner & Viewer: Full access

---

## Ontology Tab `/workspaces/:id/ontology`

**Purpose**: View workspace knowledge graph structure

**Layout**:
```
┌─────────────────────────────────────────────┐
│ Workspace Ontology                          │
├─────────────────────────────────────────────┤
│ Entity Types (12)                           │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Transformer (24 instances)              │ │
│ │ Electrical device that transfers        │ │
│ │ energy between circuits                 │ │
│ │ Examples: T-101, T-102, TX-Main         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Protection Relay (18 instances)         │ │
│ │ Device that detects faults and trips    │ │
│ │ Examples: 51-T, 87-T, REL-1             │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Relation Types (8)                          │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ protects (15 instances)                 │ │
│ │ Entity protects another entity          │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ connected_to (42 instances)             │ │
│ │ Physical or logical connection          │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Features**:
- List of entity types with descriptions
- Instance counts
- Example entity names
- List of relation types with descriptions
- Collapsible sections
- Search/filter ontology

**Empty State**:
- No ontology: "Index your documents to generate ontology"

**Future Enhancements**:
- Graph visualization
- Click entity type → show all instances
- Click relation type → show all relations

**Permissions**:
- Owner & Viewer: Full access (read-only)

---

## Settings Tab `/workspaces/:id/settings`

**Purpose**: Manage workspace configuration and sharing

**Requires**: Owner role only (tab hidden for viewers)

**Sections**:

### General Settings

```
┌─────────────────────────────────────┐
│ General                             │
│                                     │
│ Name: [Electrical Schematics     ]  │
│                                     │
│ Description:                        │
│ [2024 facility drawings          ]  │
│ [                                ]  │
│                                     │
│ [Save Changes]                      │
└─────────────────────────────────────┘
```

### Members & Sharing

```
┌─────────────────────────────────────┐
│ Members                             │
│                                     │
│ Owner                               │
│ • john@example.com (you)            │
│                                     │
│ Viewers (2)                         │
│ • alice@example.com    [Remove]     │
│   Added 3 days ago                  │
│ • bob@example.com      [Remove]     │
│   Added 1 week ago                  │
│                                     │
│ [+ Add Viewer]                      │
└─────────────────────────────────────┘
```

**Add Viewer Flow**:
1. Click "+ Add Viewer"
2. Modal with email input
3. Enter email, click "Add"
4. API call → success toast
5. User appears in viewer list

### Danger Zone

```
┌─────────────────────────────────────┐
│ Danger Zone                         │
│                                     │
│ Delete Workspace                    │
│ This action cannot be undone.       │
│ [Delete Workspace]                  │
└─────────────────────────────────────┘
```

**Delete Flow**:
1. Click "Delete Workspace"
2. Confirmation modal:
   - "Are you sure? All data will be permanently deleted."
   - Input: "Type DELETE to confirm"
   - [Cancel] [Delete]
3. On confirm → API call → redirect to `/workspaces`

---

## Page Viewer `/workspaces/:id/pages/:pageId`

**Purpose**: View full page with metadata

**Can be rendered as**:
- Modal overlay (preferred for quick view)
- Full page route (for deep linking)

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ [← Back]  Page 5 of schematic-main.pdf          │
├─────────────────────────────────────────────────┤
│                                                 │
│                [Page Image]                     │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│ Summary                                         │
│ Shows transformer T-101 with protection relay   │
│ 51-T and associated control circuits...         │
│                                                 │
│ Topics: transformer, protection, relay          │
│                                                 │
│ Entities: T-101 (transformer), 51-T (relay),    │
│           CB-5 (circuit breaker)                │
│                                                 │
│ Relations:                                      │
│ • 51-T protects T-101                           │
│ • CB-5 connected_to T-101                       │
└─────────────────────────────────────────────────┘
```

**Features**:
- Full-resolution page image
- Zoom controls (future: pinch-to-zoom)
- Navigation: [← Previous Page] [Next Page →]
- Metadata panel (collapsible on mobile)
- Copy page link button
- Download page image button

**Keyboard Shortcuts**:
- `←` / `→`: Previous/next page
- `Esc`: Close modal (if modal mode)

**Permissions**:
- Owner & Viewer: Full access

---

## Responsive Design

### Mobile Breakpoints

- **Desktop**: > 1024px
- **Tablet**: 768px - 1024px
- **Mobile**: < 768px

### Mobile Adaptations

**Workspace Detail**:
- Tabs → Bottom navigation bar
- Side-by-side → Stacked layout

**Explore**:
- Thumbnails smaller
- 1 column layout
- Filters in collapsible drawer

**Chat**:
- Full-screen interface
- Session list → Dropdown menu
- Input field sticky at bottom

**Page Viewer**:
- Full-screen modal
- Swipe to navigate pages
- Metadata in collapsible bottom sheet

---

## Loading States

### Skeleton Screens

Use skeleton loaders for:
- Workspace list
- Document list
- Search results
- Page thumbnails

### Spinners

Use spinners for:
- Button actions (e.g., "Saving...")
- Index progress (phase transitions)
- Chat message generation

### Progress Bars

Use progress bars for:
- Document upload
- Indexing progress (with percentage)
- Long-running operations

---

## Error States

### Global Errors

**Network Error**:
```
┌─────────────────────────────────┐
│ ⚠️ Connection Lost              │
│ Reconnecting...                 │
└─────────────────────────────────┘
```

**Auth Error**:
```
┌─────────────────────────────────┐
│ ⚠️ Session Expired              │
│ [Sign In Again]                 │
└─────────────────────────────────┘
```

### Inline Errors

**Form Validation**:
- Red border on invalid field
- Error message below field

**API Errors**:
- Toast notification (top-right)
- Dismissible after 5 seconds

**Example**:
```
┌─────────────────────────────────┐
│ ✕  Failed to upload document    │
│    File size exceeds 50MB       │
└─────────────────────────────────┘
```

---

## Accessibility

### Requirements

- **WCAG 2.1 Level AA** compliance
- Keyboard navigation for all features
- Screen reader support
- Focus indicators
- Semantic HTML
- ARIA labels where needed

### Keyboard Navigation

| Action | Shortcut |
|--------|----------|
| Navigate tabs | `Tab` / `Shift+Tab` |
| Submit form | `Enter` |
| Cancel modal | `Esc` |
| Search | `Cmd/Ctrl + K` |
| Previous page | `←` |
| Next page | `→` |

---

## Navigation

- **Previous**: [08-api-contracts.md](08-api-contracts.md)
- **Next**: [10-deployment.md](10-deployment.md)
- **Related**: [02-architecture.md](02-architecture.md) - System architecture
