# Progress UX Improvements

## Overview
Enhanced the indexing progress feedback to provide accurate, detailed status updates and time-to-completion estimates.

## Changes Made

### 1. Upload Messaging Improvements
- **Removed MongoDB blame**: Changed from "10MB (MongoDB limit)" to "10MB for browser uploads"
- **Better error messages**: Now shows actual file size and suggests URL upload for larger files
- Example: "File size (54.2MB) exceeds the 10MB browser upload limit. Please use 'Add from URL' for larger files."

### 2. Detailed Progress Messages
Replaced generic "Processing document..." with specific phase messages:

#### Document Fetching (URL only)
- **"Downloading document..."** - When fetching from URL

#### PDF Rendering Phase  
- **"Preparing to parse..."** - Before PDF parsing begins
- **"Parsing document... (X/Y pages)"** - During page-by-page rendering
- Shows: Current/total pages, percentage, ETA

#### AI Analysis Phase
- **"Preparing for document analysis..."** - Before analysis begins
- **"Analyzing document... (X/Y pages)"** - During page-by-page analysis
- Shows: Current/total pages, percentage, ETA

### 3. Time-to-Completion Estimates
Added smart ETA calculations based on actual progress rates:

- **Rendering ETA**: Tracks time per page during PDF rendering
- **Analysis ETA**: Tracks time per page during AI analysis
- **Display format**: 
  - Under 60s: "~45s remaining"
  - Over 60s: "~2m 15s remaining"
- **Progressive accuracy**: ETA improves as more pages are processed

### 4. Technical Implementation

#### Backend (Indexer)
- Track start time for rendering phase
- Track start time for analysis phase
- Calculate average time per page
- Calculate remaining time: `(avg time × remaining pages) / 1000`
- Emit `message` and `etaSeconds` in progress events

#### Frontend (Web App)
- Display dynamic message from backend
- Format ETA into human-readable time
- Show ETA below progress bar
- Update in real-time as new progress events arrive

## User Experience

### Before
- Generic "Processing document..." message throughout
- No indication of current phase
- No time estimate
- User wondering what's happening

### After
- "Downloading document..." (URL only)
- "Preparing to parse..."
- "Parsing document... (15/171 pages)" + "Est. 2m 30s remaining"
- "Preparing for document analysis..."
- "Analyzing document... (45/171 pages)" + "Est. 5m 15s remaining"
- Clear phase transitions
- Accurate time estimates

## Benefits
1. **Transparency**: User knows exactly what's happening
2. **Expectations**: Time estimates help users plan
3. **Confidence**: Professional progress feedback builds trust
4. **Accuracy**: No misleading messages (e.g., "Processing" during download)
5. **Ownership**: Own the 10MB limit rather than blaming external services

## Files Modified
- `apps/web/components/DocumentUpload.tsx` - Upload messaging
- `apps/indexer/src/lib/indexing-processor.ts` - Progress messages + timing
- `apps/web/app/(dashboard)/workspaces/[id]/documents/page.tsx` - ETA display

