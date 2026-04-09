# Agent Arch — Backend

A code architecture analysis tool that lets users provide code in multiple ways and get back an interactive dependency graph with AI-generated explanations for each module.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Framework | Hono (TypeScript) |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Cache + Queue | Redis |
| Job Queue | BullMQ |
| Code Parser | web-tree-sitter (WASM) + regex fallback |
| Graph Engine | graphology |
| Auth | Better Auth (email/password + GitHub OAuth) |
| AI | Google Gemini 2.0 Flash |

## Quick Start

### 1. Prerequisites

- [Bun](https://bun.sh) v1.x
- [Docker](https://docker.com) + Docker Compose (for PostgreSQL + Redis)
- [Google AI Studio](https://aistudio.google.com) API key (free tier)
- [GitHub OAuth App](https://github.com/settings/developers) (optional)

### 2. Clone and install

```bash
git clone <repo>
cd agent-arch-main
bun install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `GEMINI_API_KEY` — Get free key at https://aistudio.google.com/apikey
- `BETTER_AUTH_SECRET` — Generate with: `openssl rand -hex 32`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth (optional)

### 4. Start infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL (port 5432) and Redis (port 6379).

### 5. Run database migrations

```bash
bun run db:generate   # generate migration files
bun run db:migrate    # apply migrations
# OR for development:
bun run db:push       # push schema directly (no migration files)
```

### 6. Start the server

```bash
bun run dev           # development with hot reload
# or
bun run start         # production
```

Server runs at http://localhost:8080

---

## API Reference

### Authentication

All project and analysis routes require authentication. Use Better Auth's built-in endpoints:

```
POST /api/auth/sign-up/email      — Register with email/password
POST /api/auth/sign-in/email      — Sign in with email/password
POST /api/auth/sign-out           — Sign out
GET  /api/auth/session            — Get current session
GET  /api/auth/sign-in/github     — GitHub OAuth
GET  /health                      — Health check (no auth)
```

### Projects

#### Create Project — `POST /api/projects`

Accepts 6 different input modes, auto-detected from the request:

**1. Zip folder upload:**
```bash
curl -X POST http://localhost:8080/api/projects \
  -F "folder=@./myproject.zip"
```

**2. Single file upload:**
```bash
curl -X POST http://localhost:8080/api/projects \
  -F "file=@./main.py"
```

**3. Multiple files upload:**
```bash
curl -X POST http://localhost:8080/api/projects \
  -F "files[]=@./src/index.ts" \
  -F "files[]=@./src/utils.ts"
```

**4. Multiple folders as zip** (same as zip upload, folder contains subdirectories)

**5. Folder path (desktop app mode):**
```bash
curl -X POST http://localhost:8080/api/projects \
  -H "Content-Type: application/json" \
  -d '{"folderPath": "/absolute/path/to/project"}'
```

**6. Multiple folder paths:**
```bash
curl -X POST http://localhost:8080/api/projects \
  -H "Content-Type: application/json" \
  -d '{"folderPaths": ["/path/one", "/path/two"]}'
```

**Response:**
```json
{
  "projectId": "uuid",
  "jobId": "bullmq-job-id",
  "detectedMode": "zip|files|folder_path|multi_folder",
  "fileCount": 42
}
```

#### Other endpoints:
```
GET    /api/projects                     — List user's projects
GET    /api/projects/:id                 — Get project with files, edges, analyses
DELETE /api/projects/:id                 — Delete project
POST   /api/projects/:id/reanalyze       — Re-trigger analysis
GET    /api/analysis/:projectId/status   — Analysis progress (0-100%)
WS     ws://localhost:8080/ws/:projectId — Real-time events
```

### WebSocket Events

Connect to `ws://localhost:8080/ws/:projectId` to receive:

```json
{ "type": "file_done", "fileId": "uuid", "relativePath": "src/index.ts", "progress": 45 }
{ "type": "analysis_complete", "projectId": "uuid", "progress": 100 }
{ "type": "error", "message": "..." }
```

Send `ping` to receive `{ "type": "pong" }`.

---

## Architecture

```
src/
├── index.ts                  # Server entry point
├── db/
│   ├── schema.ts             # Drizzle schema (users, projects, files, edges, analyses)
│   └── index.ts              # DB connection
├── auth/
│   └── index.ts              # Better Auth configuration
├── routes/
│   ├── auth.ts               # /api/auth/* → Better Auth handler
│   ├── projects.ts           # CRUD + upload for projects
│   ├── analysis.ts           # Status polling endpoint
│   └── ws.ts                 # WebSocket server (ws package)
├── workers/
│   └── analysis.worker.ts    # BullMQ worker: parse → graph → AI
├── lib/
│   ├── ingest.ts             # Input normalization (all 6 modes)
│   ├── parser.ts             # web-tree-sitter + regex fallback
│   ├── graph.ts              # graphology graph builder
│   ├── ai.ts                 # Gemini 2.0 Flash abstraction
│   ├── redis.ts              # Redis singleton + pub/sub
│   └── hash.ts               # SHA256 utility
└── middleware/
    └── auth.ts               # Session validation middleware
```

### Input Limits
- Max file size: 500KB per file (larger files are skipped)
- Max files per project: 500
- Supported extensions: `.js .ts .jsx .tsx .py .go .rs .java .cpp .c .cs`

### AI Caching
Results from Gemini are cached in the `analyses` table. Files with the same `fileHash` analyzed within the last 24 hours skip the AI call.

---

## Development

```bash
# Database studio (visual DB browser)
bun run db:studio

# Type check
bun run typecheck

# Generate new migration after schema changes
bun run db:generate
bun run db:migrate
```

## Docker Compose Services

| Service | Port | Credentials |
|---|---|---|
| PostgreSQL | 5432 | `agentarch:agentarch@agentarch` |
| Redis | 6379 | none |
