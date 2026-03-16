# 🤖 LinkedAI — Intelligent LinkedIn Automation Platform

> A production-grade, multi-agent AI platform that autonomously searches LinkedIn jobs, submits Easy Apply applications, sends personalised connection requests, manages your content studio, and tracks everything in real-time — powered by Playwright, React 18, Firebase, and Groq AI (LLaMA 3.3).

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Data Flow](#data-flow)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Prerequisites](#prerequisites)
7. [Installation & Setup](#installation--setup)
8. [Running the Application](#running-the-application)
9. [Features & Pages](#features--pages)
10. [API Endpoints](#api-endpoints)
11. [Agent Pipeline](#agent-pipeline)
12. [Security & Rate Limits](#security--rate-limits)
13. [Bug Fixes & Changelog](#bug-fixes--changelog)
14. [Troubleshooting](#troubleshooting)
15. [Environment Variables](#environment-variables)

---

## Overview

LinkedAI is a full-stack automation platform built on a **multi-agent architecture**. It consists of:

- A **React 18 single-page application** (frontend) that provides the UI, authentication, real-time dashboard, and pipeline controls.
- A **Node.js / Express backend** that hosts all automation agents, streams results via Server-Sent Events (SSE), and writes data to Firestore using the Firebase Admin SDK.
- **Playwright (Chromium)** for headless/headed browser automation on LinkedIn.
- **Groq AI (LLaMA 3.3-70b)** for intelligent job-match scoring and personalised message generation.
- **Firebase** (Auth + Firestore + Storage) for user authentication, real-time data sync, and file storage.
- **Telegram Bot API** (optional) for push notifications on pipeline events.

---

## System Architecture

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        LINKEDAI — SYSTEM ARCHITECTURE                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│                         BROWSER  (React SPA)                                │
│                                                                             │
│  ┌──────────────┐  ┌──────────────────────────────────────────────────┐    │
│  │ AuthContext  │  │                  AppContext                       │    │
│  │              │  │  (global state: jobs, stats, applications,        │    │
│  │ Firebase Auth│  │   connections, resumes, settings, notifications)  │    │
│  │  Email/Google│  └──────────────┬───────────────────────────────────┘    │
│  └──────┬───────┘                 │ React Context API                       │
│         │ Auth Gate               │                                         │
│         ▼                         ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         App.js (Router)                              │   │
│  │                                                                      │   │
│  │  Dashboard │ Jobs │ Applications │ Resumes │ Networking │ Settings   │   │
│  │  ManagerAgent │ ContentStudio │ InterviewCoach │ ChatBot │ AdminPanel│   │
│  └──────────────────────────┬───────────────────────────────────────────┘  │
│                             │                                               │
│  ┌──────────────────────────▼───────────────────────────────────────────┐  │
│  │                     Frontend Agents                                   │  │
│  │                                                                       │  │
│  │  managerAgent.js          pipelineRunner.js                           │  │
│  │  ┌──────────────────┐     ┌────────────────────────────────────────┐ │  │
│  │  │  RateLimiter     │     │  XHR-based SSE Client                  │ │  │
│  │  │  Security Caps   │     │  POST /api/agent/run                   │ │  │
│  │  │  Prompt Injection│     │  Streams events: ping, login, scout,   │ │  │
│  │  │  Detection       │     │  applier, networker, analyst, complete  │ │  │
│  │  │  Startup Checklist│    └────────────────────────────────────────┘ │  │
│  │  └──────────────────┘                                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               Firebase Client SDK (reads)                             │  │
│  │                                                                       │  │
│  │  firebaseService.js ──► Firestore                                     │  │
│  │    listenJobs()           /jobs                                       │  │
│  │    listenApplications()   /applications                               │  │
│  │    listenStats()          /stats/{userId}  (real-time listener)       │  │
│  │    listenConnections()    /connections                                │  │
│  │    getResumes()           /resumes                                    │  │
│  │    getUserSettings()      /settings/{userId}                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                          ▲
         │  HTTP POST (SSE stream)                  │  Firestore real-time
         │  /api/agent/run                          │  listeners (onSnapshot)
         │  /api/content/sync                       │
         │  /api/chat/message                       │
         ▼                                          │
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NODE.JS / EXPRESS BACKEND  (port 4000)                   │
│                                                                             │
│  server.js                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  CORS (all origins, SSE-safe)  │  express.json (10mb limit)          │  │
│  │  /api/health                   │  404 + global error handlers        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         ROUTE MODULES                                │  │
│  │                                                                      │  │
│  │  /api/agent    → routes/agent.js                                     │  │
│  │  /api/content  → routes/content.js                                   │  │
│  │  /api/chat     → routes/chat.js                                      │  │
│  │  /api/telegram → routes/telegram.js                                  │  │
│  │  /api/status   → routes/status.js                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      AGENT PIPELINE  (pipeline.js)                   │  │
│  │                                                                      │  │
│  │  Phase 1: LOGIN     → linkedin.loginLinkedIn()                       │  │
│  │  Phase 2: SCOUT     → linkedin.searchJobs()  +  groq.scoreJobMatch() │  │
│  │  Phase 3: APPLIER   → linkedin.easyApply()                           │  │
│  │  Phase 4: NETWORKER → linkedin.searchProfiles()                      │  │
│  │                     → groq.generateConnectionNote()                  │  │
│  │                     → linkedin.sendConnectionRequest()               │  │
│  │  Phase 5: ANALYST   → aggregates + emits insights                    │  │
│  │                                                                      │  │
│  │  SSE events emitted at each phase back to pipelineRunner.js          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │  linkedin.js │  │   groq.js    │  │  telegram.js  │  │contentLinked │  │
│  │              │  │              │  │               │  │In.js         │  │
│  │  Playwright  │  │  Groq API    │  │  Telegram Bot │  │  Playwright  │  │
│  │  Chromium    │  │  LLaMA 3.3   │  │  3 strategies:│  │  (Content    │  │
│  │  automation  │  │  - scoreJob  │  │  1. Direct    │  │   Studio)    │  │
│  │  - login     │  │  - connNote  │  │  2. CF relay  │  │  - posts     │  │
│  │  - searchJobs│  │              │  │  3. TLS bypass│  │  - leads     │  │
│  │  - easyApply │  └──────────────┘  └───────────────┘  │  - publish   │  │
│  │  - profiles  │                                        └──────────────┘  │
│  │  - connect   │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                   │
│  ┌──────▼───────────────────────────────────────────────────────────────┐  │
│  │              Firebase Admin SDK  (firebase/admin.js)                  │  │
│  │                                                                       │  │
│  │  Writes directly to Firestore from Node — no browser session needed  │  │
│  │                                                                       │  │
│  │  incrementStats()   → /stats/{userId}                                 │  │
│  │  saveJobs()         → /jobs/{jobId}                                   │  │
│  │  saveApplication()  → /applications                                   │  │
│  │  saveConnection()   → /connections                                    │  │
│  │  logActivity()      → /activityFeed                                   │  │
│  │                                                                       │  │
│  │  Init priority:                                                       │  │
│  │    1. FIREBASE_SERVICE_ACCOUNT_JSON env var (CI / cloud deploy)       │  │
│  │    2. serviceAccountKey.json on disk         (local dev)              │  │
│  │    3. Application Default Credentials        (GCP hosted)             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FIREBASE (Google Cloud)                                 │
│                                                                             │
│  ┌──────────────┐  ┌──────────────────────────────────────────────────┐   │
│  │ Firebase Auth│  │                    Firestore                      │   │
│  │              │  │                                                   │   │
│  │  Email/Pass  │  │  /users/{uid}          User profiles + roles     │   │
│  │  Google OAuth│  │  /stats/{uid}          Aggregated pipeline stats │   │
│  │  Admin SDK   │  │  /jobs/{jobId}         Scanned job listings      │   │
│  │  (role lock) │  │  /applications         Applied job records       │   │
│  └──────────────┘  │  /connections          Sent connection requests  │   │
│                    │  /activityFeed         Live event log            │   │
│  ┌──────────────┐  │  /resumes              Resume metadata           │   │
│  │ Firebase     │  │  /settings/{uid}       User preferences          │   │
│  │ Storage      │  │  /meta/adminConfig     Admin role lock           │   │
│  │              │  └──────────────────────────────────────────────────┘   │
│  │  Resume PDFs │                                                          │
│  │  Upload      │                                                          │
│  └──────────────┘                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                                     │
│                                                                             │
│  LinkedIn.com          Groq API              Telegram Bot API              │
│  (automation target)   api.groq.com          api.telegram.org              │
│                        LLaMA 3.3-70b         + Cloudflare Worker relay     │
│                        job scoring           (ISP block fallback)          │
│                        connection notes                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Pipeline Run (Full Mode)

```
User clicks "Run Pipeline"
        │
        ▼
pipelineRunner.js
  XHR POST /api/agent/run
        │
        ▼
routes/agent.js
  Validates credentials + keywords
  Sets SSE headers (text/event-stream)
  Starts 20s keepalive heartbeat
        │
        ▼
pipeline.js → runPipeline()
        │
        ├─► PHASE 1: LOGIN
        │     linkedin.loginLinkedIn(email, password)
        │     ← SSE: { phase: "login", message: "✅ Logged in" }
        │     Firebase: logActivity()
        │
        ├─► PHASE 2: SCOUT  [skipped if maxApps === 0]
        │     linkedin.searchJobs(keywords, location)
        │       Uses f_LF=f_AL filter → Easy Apply only
        │       JS-based card extraction (left panel only)
        │     groq.scoreJobMatch() × batch of 5
        │       LLaMA scores 0–100 + reason string
        │     Firebase Admin: saveJobs() + incrementStats()
        │     ← SSE: { phase: "scout", jobs: [...], statsUpdate }
        │
        ├─► PHASE 3: APPLIER  [skipped if maxApps === 0]
        │     Filters jobs by minMatchScore threshold
        │     For each job (up to applyLimit cap):
        │       linkedin.easyApply(jobUrl)
        │         ├─ Navigate to job page
        │         ├─ Detect + click Easy Apply button (4 strategies)
        │         ├─ Detect external redirect → skip if not native modal
        │         ├─ fillCurrentStep() — fills all form fields
        │         │    phone, selects, text/number inputs, textareas, radios
        │         ├─ hasValidationErrors() → fillEmptyRequiredFields()
        │         └─ fillAndSubmit() loop (up to 25 steps)
        │              tries Submit → Next → Review → Submit
        │     Firebase Admin: saveApplication() + incrementStats()
        │     Telegram: notifyJobApplied()
        │     ← SSE: { phase: "applier_success", application, statsUpdate }
        │
        ├─► PHASE 4: NETWORKER
        │     linkedin.searchProfiles(keywords, limit)
        │     groq.generateConnectionNote(name, title, goal)
        │     linkedin.sendConnectionRequest(profileUrl, note)
        │     Firebase Admin: saveConnection() + incrementStats()
        │     Telegram: notifyConnectionSent()
        │     ← SSE: { phase: "networker_success", connection, statsUpdate }
        │
        └─► PHASE 5: ANALYST
              Aggregates results → insights array
              Firebase Admin: logActivity()
              Telegram: notifyPipelineComplete()
              n8n webhook (optional)
              ← SSE: { phase: "complete", results: finalPayload }

SSE stream ends → XHR onreadystatechange fires → pipelineRunner onComplete()
                                                        │
                                                        ▼
                                              React UI updates stats
                                              Firestore listeners push
                                              fresh data to Dashboard
```

### Real-Time Dashboard Sync

```
Firebase Admin SDK (backend)          Firebase Client SDK (browser)
        │                                        │
        │  incrementStats(userId, delta)          │
        │  ──► Firestore /stats/{userId}          │
        │                                        │◄── listenStats() (onSnapshot)
        │                                        │    debounced 300ms
        │                                        ▼
        │                               setStats() in AppContext
        │                                        │
        │                                        ▼
        │                               Dashboard re-renders
        │                               (jobsFound, applied,
        │                                connections counters)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend Framework | React 18 | SPA, component tree, hooks |
| Routing | React Context (page-based) | No React Router — page key in AppContext |
| State Management | React Context API | AppContext + AuthContext |
| Styling | CSS Variables + custom CSS | Dark theme, responsive layout |
| Animations | Framer Motion | Page transitions, UI animations |
| Charts | Recharts | Dashboard stats visualisation |
| Icons | Lucide React | UI iconography |
| Backend Runtime | Node.js 18+ | Server runtime |
| Backend Framework | Express 4 | HTTP server, route modules |
| Streaming | Server-Sent Events (SSE) | Real-time pipeline updates to browser |
| Browser Automation | Playwright (Chromium) | LinkedIn automation |
| AI / LLM | Groq API — LLaMA 3.3-70b | Job scoring, connection notes, chatbot |
| Database | Firebase Firestore | Real-time NoSQL document store |
| Authentication | Firebase Auth | Email/password + Google OAuth |
| File Storage | Firebase Storage | Resume PDF uploads |
| Backend DB writes | Firebase Admin SDK | Server-side Firestore writes |
| Notifications | Telegram Bot API | Pipeline event push notifications |
| Deployment (frontend) | Vercel | Static hosting + CDN |
| Deployment (backend) | HuggingFace Spaces | Containerised Node backend |

---

## Project Structure

```
Production1/
│
├── public/                         # Static assets
│
├── src/                            # React frontend
│   │
│   ├── App.js                      # Root: AuthProvider → AuthGate → AppProvider → AppContent
│   │                               # Contains: ErrorBoundary, PageRouter, AuthGate
│   │
│   ├── index.js                    # React DOM entry point
│   ├── index.css                   # Global CSS variables, dark theme, base styles
│   │
│   ├── context/
│   │   ├── AuthContext.js          # Firebase Auth: sign-up, sign-in (email + Google),
│   │   │                           # sign-out, password reset, admin role locking
│   │   │                           # Anti-tampering: verifyRole() checks /meta/adminConfig
│   │   │
│   │   └── AppContext.js           # Global app state provider:
│   │                               # - jobs, applications, connections, resumes, stats
│   │                               # - Firestore real-time listeners (debounced 300ms)
│   │                               # - forceRefreshStats(), optimisticStatUpdate()
│   │                               # - pushOptimisticApplication/Connection()
│   │                               # - persistSettings(), applyToJob()
│   │
│   ├── firebase/
│   │   ├── config.js               # Firebase client SDK init (Auth, Firestore, Storage)
│   │   └── firebaseService.js      # Firestore CRUD helpers:
│   │                               # listenJobs, listenApplications, listenStats,
│   │                               # listenConnections, getResumes, getUserSettings,
│   │                               # saveSettings, addApplication, markJobApplied,
│   │                               # incrementStat, logActivity, setDefaultResume, deleteResume
│   │
│   ├── agents/
│   │   ├── managerAgent.js         # Frontend security layer:
│   │   │                           # - HARD_CAPS (daily limits)
│   │   │                           # - RateLimiter (localStorage + in-memory fallback)
│   │   │                           # - sanitizeExternalData() / INJECTION_PATTERNS
│   │   │                           # - redactSecrets() / logSecurityEvent()
│   │   │                           # - checkLoop() / humanDelay()
│   │   │                           # - runStartupChecklist()
│   │   │                           # - SUB_AGENTS registry (scout, applier, networker, analyst)
│   │   │
│   │   └── pipelineRunner.js       # XHR SSE client:
│   │                               # - startPipeline(params, callbacks)
│   │                               # - SSE parser (split on \n\n, JSON.parse each event)
│   │                               # - stopPipeline() / isPipelineRunning()
│   │                               # - REACT_APP_BACKEND_URL env var support
│   │                               # - 10-minute timeout
│   │
│   ├── components/
│   │   ├── Sidebar.js              # Navigation sidebar (responsive, mobile hamburger)
│   │   ├── Topbar.js               # Top navigation bar (notifications, user menu)
│   │   └── FirebaseStatus.js       # Firebase connection status indicator
│   │
│   └── pages/
│       ├── AuthPage.js             # Login + Sign-up + Google OAuth page
│       ├── Dashboard.js            # Stats cards, activity feed, pipeline summary
│       ├── Jobs.js                 # Job search results (demo + live scanned jobs)
│       ├── Applications.js         # Kanban board + table view of applications
│       ├── Resumes.js              # Resume upload, manage, set default
│       ├── Networking.js           # LinkedIn connections + networking bot controls
│       ├── Settings.js             # LinkedIn credentials, search config, preferences
│       ├── ManagerAgent.js         # Pipeline orchestration UI + live SSE log
│       ├── ContentStudio.js        # LinkedIn content sync, post publish, lead management
│       ├── InterviewCoach.js       # AI-powered interview practice
│       ├── ChatBot.js              # AI chatbot (Groq-powered via /api/chat/message)
│       ├── AdminPanel.js           # Admin-only user management panel
│       └── FigmaIntegration.js     # Figma design integration page
│
├── backend/                        # Node.js backend
│   │
│   ├── server.js                   # Express app entry point:
│   │                               # - CORS (all origins, SSE-safe)
│   │                               # - Route registration
│   │                               # - /api/health endpoint
│   │                               # - 404 + global error handlers
│   │                               # - PORT from env (default 4000)
│   │
│   ├── routes/
│   │   ├── agent.js                # POST /api/agent/run
│   │   │                           # - Validates email, password, keywords
│   │   │                           # - Sets SSE headers + keepalive heartbeat (20s)
│   │   │                           # - Calls runPipeline() → streams events back
│   │   │                           # GET  /api/agent/status
│   │   │
│   │   ├── content.js              # POST /api/content/sync   — full LinkedIn data sync
│   │   │                           # POST /api/content/leads  — refresh engaged leads only
│   │   │                           # POST /api/content/post   — publish post to LinkedIn
│   │   │                           # POST /api/content/message — send DM to a lead
│   │   │                           # All routes stream SSE + optional n8n webhook
│   │   │
│   │   ├── chat.js                 # POST /api/chat/message
│   │   │                           # - Groq LLaMA 3.3-70b chatbot
│   │   │                           # - Accepts systemPrompt + messages array
│   │   │
│   │   ├── telegram.js             # Telegram webhook/test routes
│   │   │
│   │   └── status.js               # GET /api/status — health check JSON
│   │
│   ├── agents/
│   │   ├── pipeline.js             # Main pipeline orchestrator:
│   │   │                           # - runPipeline(params, res, isAborted)
│   │   │                           # - Phases: login → scout → applier → networker → analyst
│   │   │                           # - HARD_CAPS: MAX_APPLICATIONS=10, MAX_CONNECTIONS=10
│   │   │                           # - networkingOnly mode (maxApps === 0): skips scout+applier
│   │   │                           # - SSE emit() helper with writableEnded guard
│   │   │                           # - n8n webhook ping on completion
│   │   │
│   │   ├── linkedin.js             # ⭐ Playwright browser automation (v13.1 — BUG FIXED)
│   │   │                           # - launchBrowser() / closeBrowser()
│   │   │                           # - loginLinkedIn(email, password)
│   │   │                           # - searchJobs(keywords, location, max)
│   │   │                           #     f_LF=f_AL Easy Apply filter
│   │   │                           #     JS-based card extraction (left panel only)
│   │   │                           #     Multi-keyword split search
│   │   │                           # - easyApply(jobUrl)
│   │   │                           #     4-strategy button detection
│   │   │                           #     External tab detection + skip
│   │   │                           #     fillCurrentStep() — fills all form fields
│   │   │                           #     hasValidationErrors() + fillEmptyRequiredFields()
│   │   │                           #     fillAndSubmit() loop (≤25 steps)
│   │   │                           #     ✅ FIX: notice period '0' → '1' (decimal > 0.0)
│   │   │                           # - searchProfiles(keywords, max)
│   │   │                           # - sendConnectionRequest(profileUrl, note)
│   │   │                           # - humanMouseClick() / humanDelay()
│   │   │                           # - screenshot() debug helper
│   │   │
│   │   ├── contentLinkedIn.js      # Playwright: Content Studio automation
│   │   │                           # - loginLinkedIn(), fetchProfileStats()
│   │   │                           # - fetchMyPosts(), fetchPostComments()
│   │   │                           # - fetchEngagedLeads(), postLinkedInUpdate()
│   │   │                           # - sendMessage(profileUrl, text)
│   │   │
│   │   ├── groq.js                 # Groq API helpers:
│   │   │                           # - groqChat(systemPrompt, userMessage, maxTokens)
│   │   │                           # - scoreJobMatch(title, company, description, goal)
│   │   │                           #     Returns { score: 0-100, reason: string }
│   │   │                           # - generateConnectionNote(name, title, goal)
│   │   │                           #     Returns ≤300 char personalised note
│   │   │
│   │   └── telegram.js             # Telegram Bot notifications:
│   │                               # - sendTelegram(token, chatId, text)
│   │                               #     3 fallback strategies:
│   │                               #     1. Direct api.telegram.org
│   │                               #     2. Cloudflare Worker relay
│   │                               #     3. TLS-bypass (rejectUnauthorized: false)
│   │                               # - notifyPipelineComplete()
│   │                               # - notifyJobApplied()
│   │                               # - notifyConnectionSent()
│   │                               # - testTelegramBot()
│   │
│   ├── firebase/
│   │   ├── admin.js                # Firebase Admin SDK:
│   │   │                           # - initAdmin() with 3-priority bootstrap
│   │   │                           # - incrementStats(userId, deltas)
│   │   │                           # - saveJobs(userId, jobs[])
│   │   │                           # - saveApplication(userId, app)
│   │   │                           # - saveConnection(userId, conn)
│   │   │                           # - logActivity(userId, event)
│   │   │
│   │   └── serviceAccountKey.json  # ⚠️ YOU MUST ADD THIS (see Setup Step 1)
│   │
│   ├── debug_screenshots/          # Auto-generated Playwright screenshots
│   │                               # Named: modal_open_*, step_1_*, review_stuck_*
│   │
│   ├── .env                        # Backend environment variables (see below)
│   ├── package.json                # Backend dependencies
│   ├── Dockerfile                  # Docker container definition
│   └── server.js                   # Entry point
│
├── .env.local                      # Frontend environment variables
├── package.json                    # Frontend dependencies
├── vercel.json                     # Vercel deployment config
├── firebase.json                   # Firebase hosting config
├── firestore.rules                 # Firestore security rules
├── firestore.indexes.json          # Firestore composite indexes
├── storage.rules                   # Firebase Storage security rules
├── setup_backend.bat               # One-click Windows backend setup script
└── HOW_TO_RUN.txt                  # Legacy quick-start guide
```

---

## Prerequisites

- **Node.js 18+** — https://nodejs.org (includes npm)
- **Firebase project** — already configured as `linkedin-6fea9`
- **Groq API key** — already set in `backend/.env`
- **LinkedIn account** — with valid credentials
- **Windows, macOS, or Linux** — Playwright supports all three

---

## Installation & Setup

### Step 1 — Firebase Service Account (One-Time, Required)

The backend writes to Firestore using the Firebase Admin SDK. It needs a service account key.

1. Go to https://console.firebase.google.com
2. Select project: **linkedin-6fea9**
3. Click ⚙️ **Project Settings → Service Accounts tab**
4. Click **"Generate new private key"** → download the JSON
5. Rename it to `serviceAccountKey.json`
6. Place it at: `Production1/backend/firebase/serviceAccountKey.json`

> Without this file the backend starts but all Firestore writes are silently skipped. Stats will stay at 0 on the Dashboard.

---

### Step 2 — Install Dependencies

**Option A — Easiest (Windows only):** Double-click `setup_backend.bat`

**Option B — Manual:**

```bash
# Install backend dependencies + Playwright browser
cd Production1/backend
npm install
npx playwright install chromium

# Install frontend dependencies (separate terminal)
cd Production1
npm install
```

---

### Step 3 — Configure Settings in the App

1. Start the app (see Running below)
2. Sign in or create an account
3. Go to **Settings** page and fill in:

| Field | Example |
|---|---|
| LinkedIn Email | `your@email.com` |
| LinkedIn Password | `yourpassword` |
| Search Keywords | `React Developer, Frontend Engineer` |
| Search Location | `India` or `Bangalore, Mumbai, Remote` |
| Career Goal | `Senior Frontend Engineer at a product startup` |
| Max Applications/Day | `5` (recommended: 5–10) |
| Max Connections/Day | `10` (recommended: 10–20) |
| Min Match Score | `70` (0–100, filters low-relevance jobs) |

4. Click **Save Settings**

---

## Running the Application

You need **two terminals** running simultaneously.

### Terminal 1 — Backend

```bash
cd Production1/backend
node server.js
```

Expected output:
```
🚀 LinkedAI Backend running on http://localhost:4000
🔥 Firebase Admin: initialised via serviceAccountKey.json
```

### Terminal 2 — Frontend

```bash
cd Production1
npm start
```

App opens at: **http://localhost:3000**

> If you see `CI=false` in package.json build script — this is intentional to suppress non-fatal ESLint warnings during build.

---

## Features & Pages

| Page | Route Key | Description |
|---|---|---|
| **Dashboard** | `dashboard` | Live stats (jobs found, applied, connections), activity feed, pipeline summary |
| **Jobs** | `jobs` | 15 curated demo jobs + real-time scanned jobs from Scout agent |
| **Applications** | `applications` | Kanban board and table view of all applied jobs |
| **Resumes** | `resumes` | Upload, manage, and set default resume for applications |
| **Networking** | `networking` | Sent connections list + networking-only bot controls |
| **Settings** | `settings` | LinkedIn credentials, search preferences, Telegram config |
| **Manager Agent** | `manager` | Full pipeline run controls, live SSE log, agent phase stepper |
| **Content Studio** | `content` | Sync LinkedIn posts/comments, manage leads, publish posts, send DMs |
| **Interview Coach** | `interview` | AI-powered interview question practice and feedback |
| **ChatBot** | `chatbot` | Conversational AI assistant (Groq LLaMA 3.3) |
| **Admin Panel** | `admin` | User management (admin-only, role-locked) |
| **Figma Integration** | `figma` | Design integration page |

---

## API Endpoints

All endpoints are served from `http://localhost:4000`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| GET | `/api/status` | Version + uptime status |
| POST | `/api/agent/run` | **Main pipeline** — streams SSE events for all 5 phases |
| GET | `/api/agent/status` | Agent status check |
| POST | `/api/content/sync` | Full LinkedIn content sync (posts, comments, leads, stats) |
| POST | `/api/content/leads` | Refresh engaged leads only |
| POST | `/api/content/post` | Publish a post to LinkedIn |
| POST | `/api/content/message` | Send a DM to a lead's LinkedIn profile |
| POST | `/api/chat/message` | Groq chatbot message (systemPrompt + messages) |

### SSE Event Phases (`/api/agent/run`)

| Phase | Meaning |
|---|---|
| `ping` | Stream connected |
| `login` | LinkedIn login attempt/result |
| `scout` | Job search + AI scoring progress |
| `applier` | Application form fill + submit progress |
| `applier_success` | Single application confirmed submitted |
| `networker` | Profile search + connection request progress |
| `networker_success` | Single connection request confirmed sent |
| `analyst` | Insights generation |
| `complete` | Pipeline finished — includes full `results` payload |
| `warning` | Non-fatal warning (e.g. missing userId) |
| `error` | Fatal error — pipeline stopped |

---

## Agent Pipeline

### Full Mode (maxApps > 0)

```
Login → Scout → Applier → Networker → Analyst
```

### Networking-Only Mode (maxApps = 0)

```
Login → Networker → Analyst
```
Scout and Applier are completely skipped — networking starts immediately.

### Applier Form-Fill Logic (`linkedin.js — fillCurrentStep`)

The Applier automatically fills every field in LinkedIn's Easy Apply modal:

| Form Field Type | Detection Method | Value Used |
|---|---|---|
| Phone number | `input[type="tel"]`, `id*=phoneNumber` | `profile.phone` |
| Years of experience | Label contains `year` + `experience` | `profile.yearsExperience` |
| Months of experience | Label contains `month` + `experience` | `profile.additionalMonthsExperience` |
| Current city | Label contains `city` or `location` | `profile.currentCity` |
| Current country | Label contains `country` | `profile.currentCountry` |
| Notice period / How soon can you join | Label contains `notice`, `days`, `how soon`, or `join` | `'1'` (decimal > 0.0) ✅ fixed |
| Expected salary / CTC | Label contains `salary`, `ctc`, `compensation` | `profile.expectedSalary` |
| Variable pay / bonus | Label contains `variable`, `bonus`, `incentive` | `profile.variablePay` |
| RSU / Stock | Label contains `rsu`, `stock`, `esop` | `profile.stockRsuValue` |
| LinkedIn URL | Label contains `linkedin`, `profile url` | `profile.linkedinProfileUrl` |
| Portfolio / GitHub | Label contains `portfolio`, `website`, `github` | `profile.portfolioUrl` |
| Cover letter (textarea) | Any `<textarea>` | `profile.coverLetter` |
| Yes/No radio buttons | `<fieldset>` radios | Selects "Yes" or first option |
| Dropdowns (selects) | `<select>` elements | Smart match against label |

---

## Security & Rate Limits

### Hard Daily Caps (managerAgent.js + pipeline.js)

| Action | Limit |
|---|---|
| Applications per day | 50 (frontend) / 10 (backend per run) |
| Connections per day | 30 (frontend) / 10 (backend per run) |
| Messages per day | 20 (frontend) |
| Actions per minute | 15 |
| Same job visits | 3 max (loop detection) |

### Human-Like Behaviour

- All clicks use randomised mouse trajectories (`humanMouseClick`)
- All actions include randomised delays: 2,500ms – 7,000ms
- Between applications: 3,000ms – 5,000ms additional wait
- Between connection requests: 4,000ms – 7,000ms additional wait
- Browser launched with `--disable-blink-features=AutomationControlled`
- Custom `userAgent` string matches real Chrome 124

### Authentication Security (AuthContext.js)

- The first user to sign up is permanently locked as **admin** (`/meta/adminConfig`)
- All subsequent users are assigned the `member` role
- On every login, `verifyRole()` cross-checks the user's stored role against `adminConfig` — any tampered admin role is silently reverted to `member`
- Admin panel is only accessible when `isAdmin === true`

### Prompt Injection Detection (managerAgent.js)

All external data from LinkedIn is sanitised through `sanitizeExternalData()` which blocks patterns including: `ignore previous instructions`, `system prompt`, `you are now`, `forget everything`, etc.

---

## Bug Fixes & Changelog

### v13.1 — ✅ Critical: Application Submission Fix

**Problem:** The agent was getting stuck on the LinkedIn Easy Apply **Review page** and never submitting applications. Debug screenshots (`review_stuck_4_*.png`) confirmed the issue.

**Root Cause:** In `backend/agents/linkedin.js`, the **"How soon can you join?"** field was being filled with the string `'0'`. LinkedIn validates this field as a **decimal number strictly greater than 0.0** and rejects `0`, displaying:

```
⛔ Enter a decimal number larger than 0.0
```

This validation error blocked the form from advancing past the Review step, causing the `fillAndSubmit()` loop to exhaust all 25 steps and return `{ success: false }` every time.

**Fix — two locations in `linkedin.js`:**

```js
// fillCurrentStep() — BEFORE (broken):
else if (label.includes('notice') || label.includes('days to join'))
  value = profile.noticePeriod === 'Immediately' ? '0' : '30';

// fillCurrentStep() — AFTER (fixed):
else if (label.includes('notice') || label.includes('days to join')
      || label.includes('how soon') || label.includes('join'))
  value = profile.noticePeriod === 'Immediately' ? '1' : '30';

// fillEmptyRequiredFields() — BEFORE (broken):
else if (label.includes('notice') || label.includes('days'))
  value = '0';

// fillEmptyRequiredFields() — AFTER (fixed):
else if (label.includes('notice') || label.includes('days')
      || label.includes('how soon') || label.includes('join'))
  value = '1';
```

**Additional improvement:** Added `'how soon'` and `'join'` to the label detection keywords — these match LinkedIn's exact field label ("How soon can you join?") which was not being caught by the previous `'notice'`/`'days'` patterns.

---

### Previous Versions

| Version | Key Changes |
|---|---|
| v13 | Easy Apply filter (`f_LF=f_AL`) in search URLs; JS-based left-panel-only card extraction; multi-keyword split search; updated 2024/2025 LinkedIn CSS selectors for profile search |
| v4.1 (pipeline) | Networking-only mode when `maxApps=0`; `applyLimit=0` guard; `REACT_APP_BACKEND_URL` env var replaces hardcoded URL |
| v4.2 (AppContext) | Fixed infinite re-render loop; auth-gated Firestore reads; 300ms debounced stats listener; stable `forceRefreshStats` identity |
| v4.0 | Multi-agent architecture; Firebase Admin SDK direct writes; full rate limiter with localStorage + in-memory fallback |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Stats stuck at 0 | Missing `serviceAccountKey.json` | Add the file to `backend/firebase/` and restart the backend |
| `Cannot reach backend` | Backend not running | Run `cd backend && node server.js` in a terminal and keep it open |
| `Login failed — check email/password` | Wrong credentials | Verify credentials in Settings; try logging into linkedin.com manually first |
| `LinkedIn requires verification` | LinkedIn triggered CAPTCHA | Complete the challenge in the Playwright browser window, then re-run |
| `Easy Apply modal never opened` | Job does not use LinkedIn's native modal | Expected — job is skipped. Only native Easy Apply modals are supported |
| Agent stuck on Review / never submits | ✅ Fixed in v13.1 | Update to v13.1 — was caused by `'0'` in the notice period field |
| `Firebase Admin: ALL PATHS failed` | No credentials found | Add `serviceAccountKey.json` OR set `FIREBASE_SERVICE_ACCOUNT_JSON` env var |
| Telegram messages not sending | ISP blocks api.telegram.org | The agent tries 3 fallback strategies automatically; set `HTTPS_PROXY` in `.env` as a last resort |
| `userId missing` warning in backend | User not signed in when pipeline runs | Sign in before running the pipeline |
| Frontend ESLint build warnings | Known issue | Already handled via `CI=false` in package.json build script |
| Debug screenshots filling up disk | Normal operation | Delete files in `backend/debug_screenshots/` periodically |

---

## Environment Variables

### `backend/.env`

```env
# Server
PORT=4000

# Groq AI (LLaMA 3.3)
GROQ_API_KEY=your_groq_api_key_here

# LinkedIn credentials (used as fallback defaults — prefer Settings page)
LINKEDIN_EMAIL=your@email.com
LINKEDIN_PASSWORD=yourpassword

# Firebase Admin (alternative to serviceAccountKey.json — use for cloud deployments)
# FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}

# Firebase project ID (used for Application Default Credentials fallback)
# FIREBASE_PROJECT_ID=linkedin-6fea9

# Optional: n8n workflow automation webhook
# N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/xxx
# N8N_CONTENT_WEBHOOK_URL=https://your-n8n-instance.com/webhook/yyy

# Optional: bypass ISP blocks on api.telegram.org
# HTTPS_PROXY=http://your-proxy:port

# Optional: disable TLS verification (not recommended for production)
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### `.env.local` (frontend root)

```env
# Backend URL (defaults to http://localhost:4000 if not set)
REACT_APP_BACKEND_URL=http://localhost:4000
```

---

*LinkedAI — Built for intelligent, safe, and rate-limited LinkedIn automation.*
