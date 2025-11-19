# Project Plan: AI Daily Notes App

This document outlines the plan for building an AI-powered daily notes application with cross-platform support (Web & Mobile).

## 1. Project Goal

To create a personal chat-like daily notes application where users can:
- Record notes throughout the day in a messaging interface (similar to WhatsApp/WeChat)
- Access notes from any device (Web or Mobile) with real-time synchronization
- View history in a sidebar navigation showing past daily summaries
- Trigger AI-powered daily summaries only when clicking "End Day" button
- Browse historical summaries by date

## 2. Technology Stack

### Architecture Decision
**Full-stack Next.js with Supabase** - No separate backend framework (NestJS/Express) needed.

**Why Next.js is sufficient:**
- Simple CRUD operations
- Built-in API Routes handle all backend logic
- Supabase handles database, auth, and real-time sync
- One-person development team
- Fast iteration and deployment
- Can scale to tens of thousands of users

### Web Application
- **Framework**: Next.js 15 (App Router) - handles both frontend and backend
- **UI Components**: shadcn/ui
- **Styling**: TailwindCSS
- **Icons**: Lucide React
- **Authentication**: Supabase Auth
- **Database Client**: Supabase Client (replaces Prisma for most operations)
- **Real-time Sync**: Supabase Realtime (PostgreSQL subscriptions)

### Mobile Application
- **Framework**: React Native with Expo
- **UI Components**: React Native Paper or NativeWind
- **Navigation**: React Navigation
- **Backend**: Shares same Next.js API routes

### Backend & Data
- **Database**: Supabase PostgreSQL (500MB free tier)
- **ORM**: Supabase Client for queries, Prisma for migrations (optional)
- **Real-time Sync**: Supabase Realtime (WebSocket-based, built-in)
- **Authentication**: Supabase Auth (JWT-based)
- **Row Level Security**: PostgreSQL RLS for data isolation
- **AI Service**: OpenAI GPT-4 or Google Gemini 

## 3. Environment Setup

Create a `.env.local` file with the following variables:

```env
# Supabase (get from https://supabase.com/dashboard/project/_/settings/api)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # For admin operations

# AI Service (choose one)
OPENAI_API_KEY=sk-...
# or
GEMINI_API_KEY=AIza...
```

## 4. Database Schema

### Database Design (Supabase PostgreSQL)

Create tables directly in Supabase SQL Editor:

```sql
-- 1. Temporary notes (today's chat messages)
CREATE TABLE temporary_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Daily summaries (historical records)
CREATE TABLE summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  date DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 3. Indexes for performance
CREATE INDEX idx_temporary_notes_user_date 
  ON temporary_notes(user_id, created_at DESC);
  
CREATE INDEX idx_summaries_user_date 
  ON summaries(user_id, date DESC);

-- 4. Enable Row Level Security
ALTER TABLE temporary_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies - users can only access their own data
CREATE POLICY "Users can view own notes" 
  ON temporary_notes FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" 
  ON temporary_notes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" 
  ON temporary_notes FOR DELETE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own summaries" 
  ON summaries FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own summaries" 
  ON summaries FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
```

### Data Flow

1. **During the day**: Notes stored in `temporary_notes` table
2. **End of day**: 
   - AI generates summary from all temporary notes
   - Summary saved to `summaries` table
   - All temporary notes deleted
3. **Next day**: Start fresh with empty `temporary_notes`

## 5. Real-time Synchronization Strategy

### Supabase Realtime (Chosen Solution)

Supabase provides built-in real-time subscriptions using PostgreSQL's replication features.

**How it works:**
```typescript
// Subscribe to real-time changes
const channel = supabase
  .channel('notes-changes')
  .on(
    'postgres_changes',
    {
      event: '*',  // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'temporary_notes',
    },
    (payload) => {
      // Automatically update UI when data changes
      console.log('Change received:', payload)
    }
  )
  .subscribe()
```

**Advantages:**
- ✅ **Zero configuration** - Built into Supabase
- ✅ **True real-time** - WebSocket-based, millisecond latency
- ✅ **Free** - Included in Supabase free tier
- ✅ **Automatic reconnection** - Handles network issues
- ✅ **Multi-device sync** - All devices get updates instantly
- ✅ **Works on Vercel** - No custom server needed

**Use cases:**
- When user adds note on Web → Mobile app updates instantly
- When user adds note on Mobile → Web browser updates instantly
- When "End Day" is clicked → All devices clear notes simultaneously

## 6. User Interface Design

### Main Layout (Desktop)

```
┌────────────────────────────────────────────────────────┐
│  Daily Notes                            [@User] [⚙️]   │
├──────────────┬─────────────────────────────────────────┤
│              │  Today - Nov 18, 2025          [3 notes]│
│  📅 History  ├─────────────────────────────────────────┤
│              │                                          │
│ ┌──────────┐│  ┌────────────────────────┐             │
│ │ Nov 18   ││  │ meeting      │ 9:30       │
│ │ 3 notes  ││  └────────────────────────┘             │
│ └──────────┘│                                          │
│              │  ┌────────────────────────┐             │
│ ┌──────────┐│  │ lunch ramen    │ 12:15      │
│ │ Nov 17   ││  └────────────────────────┘             │
│ │ 5 notes  ││                                          │
│ └──────────┘│  ┌────────────────────────┐             │
│              │  │ completed functionality │ 15:45      │
│ ┌──────────┐│  └────────────────────────┘             │
│ │ Nov 16   ││                                          │
│ │ 2 notes  ││                                          │
│ └──────────┘├─────────────────────────────────────────┤
│              │ [输入框: 记录点什么...          ] [→]  │
│  [🔍 Search] │         [🌙 End Day & Summarize]        │
└──────────────┴─────────────────────────────────────────┘
```

### Key Features

1. **Chat-like Interface** - Similar to messaging apps
2. **Sidebar Navigation** - Browse history by date
3. **Real-time Updates** - See changes across all devices instantly
4. **Mobile Responsive** - Drawer-style sidebar on mobile

## 7. Complete Workflow

### Daily Usage Flow

**Morning (9:00 AM)**
```
User opens app → Sees empty chat interface for today
```

**Throughout the day**
```
9:30 - Types "important meeting" → Press Enter
       → Saved to temporary_notes table
       → All devices update instantly via Realtime

12:15 - On mobile, types "eat ramen"
        → Web browser shows it immediately

15:45 - Back on web, types "completed core functionality"
        → Mobile app updates in real-time
```

**End of day (22:00)**
```
User clicks "End Day & Summarize" button
→ Confirmation dialog: "确定要结束今天吗？将生成摘要并清空3条记录"
→ User confirms
→ API call to /api/summarize
→ AI analyzes all 3 notes
→ Summary saved to summaries table
→ All temporary notes deleted
→ Sidebar shows new entry "Nov 18 - 3 notes"
→ Chat interface clears for tomorrow
```

**Next day**
```
User opens app → Fresh empty chat interface
Sidebar shows "Nov 18" entry → Click to view yesterday's summary
```

### Technical Flow

**Adding a Note:**
1. User types message and presses Enter
2. Supabase Client inserts into `temporary_notes`
3. Supabase Realtime broadcasts INSERT event
4. All connected devices receive update and display new note

**Viewing History:**
1. Sidebar loads recent summaries from `summaries` table
2. User clicks on a date (e.g., "Nov 17")
3. Navigate to `/dashboard/history/2024-11-17`
4. Display that day's summary

**Generating Summary:**
1. User clicks "End Day" button
2. Next.js API route `/api/summarize` is called
3. Fetch all notes from `temporary_notes` for current user
4. Send to OpenAI/Gemini for summarization
5. Save summary to `summaries` table with note count
6. Delete all temporary notes for current user
7. Return summary to client

## 8. Error Handling & User Experience

### Error Handling Strategy
- **Network Errors**: Show toast notifications, retry failed requests
- **Auth Errors**: Redirect to login, clear invalid sessions
- **AI Service Errors**: Fallback message, allow retry
- **Validation Errors**: Inline form validation feedback

### Loading States
- Skeleton loaders for note lists
- Spinner/progress indicator for AI summary generation
- Optimistic UI updates for adding notes

### UI/UX Best Practices
- Use shadcn/ui components for consistent design
- Implement toast notifications for user feedback
- Add empty states for no notes
- Confirm before "End Day" action (deletes temporary notes)

## 9. Future Features

### Phase 1 Extensions (After MVP)

1. **Search Functionality**
   - Full-text search across all summaries
   - Filter by date range
   - Search API endpoint

2. **Tags System**
   - Tag summaries (e.g., #work, #personal, #health)
   - Filter by tags
   - Tag cloud visualization

3. **Export Options**
   - Export to PDF
   - Export to Markdown
   - Email weekly digest

4. **Statistics Dashboard**
   - Notes per day trend
   - Most active days
   - Word cloud from summaries

### Multiple Summary Types

(This section remains valid and unchanged)
The system is designed to easily accommodate different summary types in the future (e.g., "Positive Feedback," "Analysis & Tips").

- **Frontend (Future)**: A UI element (like a dropdown) will let the user choose a summary type. This choice will be sent with the API request.
- **Backend (Now)**: The backend will be built with a "prompt manager" that maps a summary type to a specific AI instruction. It will default to 'standard' if no type is provided.

```javascript
// Example of the prompt manager on the backend
const promptTemplates = {
  'standard': "Summarize the following daily notes...",
  'positive_feedback': "Review the notes and provide a summary focusing on positive moments...",
  'analysis_and_tips': "Analyze the notes and provide actionable tips for tomorrow..."
};

const summaryType = request.body.summaryType || 'standard';
const selectedPrompt = promptTemplates[summaryType];
```

## 10. Development Roadmap

### Phase 1: Project Setup (Day 1)
- ✅ Initialize Next.js project with TypeScript and TailwindCSS
- ✅ Install shadcn/ui components (button, input, textarea, card, toast)
- ✅ Install Supabase packages (`@supabase/supabase-js`, `@supabase/ssr`)
- Create Supabase project at supabase.com
- Configure environment variables

### Phase 2: Database Setup (Day 1)
- Create tables in Supabase SQL Editor:
  - `temporary_notes` table
  - `summaries` table
- Set up indexes for performance
- Enable Row Level Security (RLS)
- Create RLS policies for data isolation
- Test database access

### Phase 3: Authentication (Day 2)
- Set up Supabase Client (client-side and server-side)
- Create login page (`/login`)
- Create signup page (`/signup`)
- Implement authentication flow
- Create protected route middleware
- Test auth on multiple devices

### Phase 4: Main Dashboard Layout (Day 2-3)
- Create dashboard layout with sidebar
- Implement responsive design (desktop/mobile)
- Build sidebar component:
  - History list
  - "Today" button
  - Search button (placeholder)
- Build top navigation bar
- Test responsive behavior

### Phase 5: Chat Interface (Day 3-4)
- Build chat-like note input interface
- Implement note display (message bubbles)
- Add auto-scroll to bottom
- Integrate Supabase Realtime:
  - Subscribe to `temporary_notes` changes
  - Handle INSERT events
  - Handle DELETE events
- Test real-time sync across devices

### Phase 6: AI Summary Feature (Day 4-5)
- Create `/api/summarize` API route
- Integrate OpenAI/Gemini API
- Implement summary generation logic:
  - Fetch all temporary notes
  - Call AI service
  - Save to summaries table
  - Delete temporary notes
- Add "End Day" button with confirmation
- Display summary to user
- Update sidebar with new entry

### Phase 7: History View (Day 5)
- Create history detail page (`/dashboard/history/[date]`)
- Load and display summary by date
- Add back navigation
- Style summary display
- Test navigation flow

### Phase 8: Polish & Testing (Day 6)
- Add loading states (skeletons, spinners)
- Add error handling and toast notifications
- Add empty states
- Implement optimistic UI updates
- Cross-browser testing
- Mobile testing
- Performance optimization

### Phase 9: Deployment (Day 6)
- Deploy to Vercel
- Configure environment variables in Vercel
- Test production build
- Set up custom domain (optional)

### Phase 10: Mobile App (Week 2+)
- Initialize React Native/Expo project
- Implement Supabase Auth
- Build mobile UI (reuse design)
- Integrate with same backend
- Test cross-platform sync
- Deploy to TestFlight/Play Store

## 11. Deployment

### Web Application
- **Platform**: Vercel (optimal for Next.js)
- **Build Command**: `next build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

**Environment Variables (Vercel Dashboard):**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
```

**Deployment Steps:**
1. Push code to GitHub
2. Connect repository to Vercel
3. Configure environment variables
4. Deploy (automatic on every push)

### Mobile Application
- **Platform**: Expo EAS
- **iOS**: TestFlight → App Store
- **Android**: Internal Testing → Play Store

**Deployment Steps:**
1. `eas build --platform ios`
2. `eas build --platform android`
3. `eas submit --platform ios`
4. `eas submit --platform android`

### Database
- **Hosting**: Supabase (managed PostgreSQL)
- **Backups**: Automatic daily backups (Supabase)
- **Scaling**: Upgrade Supabase plan when needed

### Pre-deployment Checklist
- [ ] All environment variables configured
- [ ] Database tables created with RLS enabled
- [ ] Supabase Auth configured
- [ ] OpenAI/Gemini API key tested
- [ ] Error tracking setup (optional: Sentry)
- [ ] Analytics configured (optional: Vercel Analytics)
- [ ] Custom domain configured (optional)

## 12. Project Structure

```
dailynote/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx              # Sidebar layout
│   │   ├── page.tsx                # Today's notes (chat interface)
│   │   └── history/
│   │       └── [date]/page.tsx     # Historical summary view
│   ├── api/
│   │   └── summarize/route.ts      # AI summary endpoint
│   ├── layout.tsx
│   └── page.tsx                    # Landing page
├── components/
│   ├── sidebar.tsx                 # History sidebar
│   ├── note-input.tsx              # Chat input
│   ├── note-list.tsx               # Message list
│   └── ui/                         # shadcn/ui components
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser client
│   │   └── server.ts               # Server client
│   └── utils.ts
├── PRDdocs/
│   └── dailynoteFirstInstruction.md
├── .env.local
├── next.config.js
├── tailwind.config.ts
└── package.json
```
