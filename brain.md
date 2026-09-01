# FClub Backend — Brain

> Football Club Management Platform — Backend API  
> GitHub: https://github.com/afsarRiyad/football-club-api-  
> Stack: Node.js, Express, MongoDB, Socket.io, Cloudinary, Zod, Redis, Docker

---

## 🏗️ Architecture

```
fclub-backend/
├── config/              # Database, Cloudinary, Socket.io config
├── middleware/           # Auth, RBAC, upload, validation, security, audit, rate limiter
├── modules/             # Feature modules (MVC pattern)
│   ├── academy/         # Youth academy management
│   ├── auth/            # Register, login, password reset
│   ├── club/            # Club info, branding, stadium
│   ├── competitions/    # Leagues, cups, tournaments
│   ├── gallery/         # Photo/video collections
│   ├── matches/         # Fixtures, results, live events
│   ├── members/         # Club memberships
│   ├── news/            # Articles, announcements
│   ├── players/         # Player profiles, transfers
│   ├── seasons/         # Season management
│   ├── statistics/      # Player/team stats, standings
│   ├── teams/           # Team squads, roster management
│   ├── training/        # Training sessions, attendance
│   ├── uploads/         # File upload endpoints
│   └── users/           # User CRUD, role management
├── scripts/             # Database seed scripts
├── utils/               # AppError, catchAsync, upload helpers, cache, email, pagination
├── tests/               # Jest test files
├── .github/workflows/   # GitHub Actions CI/CD
├── app.js               # Express app setup + route registration
├── server.js            # HTTP server + Socket.io + graceful shutdown
├── Dockerfile           # Production Docker image
├── docker-compose.yml   # Local dev (MongoDB + Redis + API)
└── package.json
```

### Module Structure (each module follows this pattern)

```
modules/<name>/
├── model/       # Mongoose schema + model
├── controller/  # Business logic (catchAsync wrapped)
├── routes/      # Express routes with auth + RBAC
├── validation/  # Zod schemas
└── service/     # (optional) complex business logic
```

---

## 🔧 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Express 4** | HTTP framework |
| **MongoDB + Mongoose** | Database + ODM |
| **JWT (jsonwebtoken)** | Authentication (cookie + header) |
| **bcryptjs** | Password hashing (12 rounds) |
| **Zod** | Request validation |
| **Cloudinary + Multer** | Image/video uploads |
| **Socket.io** | Real-time live match updates |
| **express-rate-limit** | API + auth rate limiting |
| **morgan** | HTTP request logging |
| **cors** | Cross-origin requests |
| **cookie-parser** | Cookie parsing |
| **helmet** | Security headers (XSS, clickjacking) |
| **compression** | Gzip response compression |
| **express-mongo-sanitize** | NoSQL injection protection |
| **hpp** | HTTP parameter pollution protection |
| **ioredis** | Redis caching (with in-memory fallback) |
| **nodemailer** | Email service (password resets, notifications) |
| **swagger-jsdoc + swagger-ui** | API documentation |
| **uuid** | Request ID tracing |
| **jest + supertest** | Testing framework |

---

## 🔐 Authentication & Authorization

### Auth Flow

1. User registers → creates User with hashed password
2. User logs in → returns JWT token (httpOnly cookie + response body)
3. Protected routes use `protect` middleware → verifies token from cookie or `Authorization: Bearer <token>`
4. Role-based access uses `authorize(...roles)` middleware after `protect`

### JWT Token

- **Secret:** `process.env.JWT_SECRET`
- **Expiry:** `process.env.JWT_EXPIRES_IN` (default: 7d)
- **Payload:** `{ id: user._id }` (Mongoose generates _id)
- **Cookie:** httpOnly, secure in production, 7-day expiry

### Role Hierarchy (RBAC)

```
SUPER_ADMIN
  └── CLUB_ADMIN
        └── TEAM_MANAGER
              └── COACH
                    └── SCORER
                          └── PLAYER
                                └── MEMBER
```

Higher roles inherit permissions of lower roles. For example, `CLUB_ADMIN` can access anything `TEAM_MANAGER`, `COACH`, etc. can access.

### User Roles

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Full system access, manage all clubs |
| `CLUB_ADMIN` | Admin of a specific club |
| `TEAM_MANAGER` | Manages a specific team |
| `COACH` | Coaches players, training sessions |
| `SCORER` | Updates match scores and events |
| `PLAYER` | Player profile (can be linked to user) |
| `MEMBER` | Club member (default on registration) |

---

## 📡 API Endpoints

### Base URL

```
http://localhost:5000/api
```

### Health Check

```
GET /api/health
```

---

### Auth (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | Public | Register new user (default: MEMBER) |
| POST | `/login` | Public | Login with email/password |
| POST | `/logout` | Public | Clear JWT cookie |
| GET | `/me` | Protected | Get current user + membership data |
| PATCH | `/update-password` | Protected | Change own password |
| POST | `/forgot-password` | Public | Request password reset token |
| POST | `/reset-password` | Public | Reset password with token |

---

### Users (`/api/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Admin | List all users (paginated) |
| GET | `/:id` | Protected | Get user by ID |
| PATCH | `/:id` | Protected | Update own profile (or admin) |
| PATCH | `/:id/role` | Super Admin | Change user role |
| PATCH | `/:id/deactivate` | Admin | Deactivate user |
| PATCH | `/:id/activate` | Admin | Activate user |
| DELETE | `/:id` | Super Admin | Delete user |

---

### Clubs (`/api/clubs`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List all clubs |
| GET | `/:id` | Public | Get club by ID |
| POST | `/` | Admin | Create club |
| PATCH | `/:id` | Admin | Update club |
| DELETE | `/:id` | Admin | Delete club |

---

### Players (`/api/players`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List all players (filterable) |
| GET | `/:id` | Public | Get player by ID |
| POST | `/` | Admin, Manager, Coach | Create player |
| PATCH | `/:id` | Admin, Manager, Coach | Update player |
| DELETE | `/:id` | Admin | Delete player |
| POST | `/bulk-import` | Admin | Import up to 50 players |
| POST | `/:id/transfer` | Admin | Transfer player to another club |
| POST | `/:id/link-user` | Admin | Link player to user account |
| DELETE | `/:id/unlink-user` | Admin | Unlink player from user |

---

### Teams (`/api/teams`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List all teams |
| GET | `/:id` | Public | Get team with squad |
| POST | `/` | Admin | Create team |
| PATCH | `/:id` | Admin, Manager | Update team |
| DELETE | `/:id` | Admin | Delete team |
| POST | `/:id/players` | Admin, Manager | Add player to team |
| DELETE | `/:id/players/:playerId` | Admin, Manager | Remove player from team |

---

### Matches (`/api/matches`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List all matches |
| GET | `/live` | Public | Get live matches with viewer counts |
| GET | `/:id` | Public | Get match details |
| GET | `/:id/viewers` | Public | Get viewer count for match |
| POST | `/` | Admin, Manager | Create match |
| PATCH | `/:id` | Admin, Manager, Scorer | Update match (score, status) |
| DELETE | `/:id` | Admin | Delete match |
| POST | `/:id/events` | Admin, Manager, Scorer | Add match event (goal, card) |
| DELETE | `/:id/events/:eventIndex` | Admin, Manager, Scorer | Remove match event |

---

### Competitions (`/api/competitions`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List all competitions |
| GET | `/:id` | Public | Get competition details |
| POST | `/` | Admin | Create competition |
| PATCH | `/:id` | Admin | Update competition |
| DELETE | `/:id` | Admin | Delete competition |
| POST | `/:id/teams` | Admin | Add team to competition |
| DELETE | `/:id/teams/:teamId` | Admin | Remove team from competition |

---

### Seasons (`/api/seasons`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List all seasons |
| GET | `/:id` | Public | Get season details |
| POST | `/` | Admin | Create season |
| PATCH | `/:id` | Admin | Update season |
| DELETE | `/:id` | Admin | Delete season |

---

### News (`/api/news`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List published articles |
| GET | `/:id` | Public | Get article (increments views) |
| POST | `/` | Admin | Create article |
| PATCH | `/:id` | Admin | Update article |
| DELETE | `/:id` | Admin | Delete article |
| PATCH | `/:id/publish` | Admin | Publish article |
| PATCH | `/:id/unpublish` | Admin | Unpublish article |

---

### Gallery (`/api/gallery`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List galleries |
| GET | `/:id` | Public | Get gallery with media |
| POST | `/` | Admin | Create gallery |
| PATCH | `/:id` | Admin | Update gallery |
| DELETE | `/:id` | Admin | Delete gallery |
| POST | `/:id/media` | Admin | Add media to gallery |
| DELETE | `/:id/media/:mediaId` | Admin | Remove media from gallery |

---

### Academy (`/api/academy`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List all academies |
| GET | `/:id` | Public | Get academy details |
| POST | `/` | Admin | Create academy |
| PATCH | `/:id` | Admin | Update academy |
| DELETE | `/:id` | Admin | Delete academy |
| POST | `/:id/players` | Admin, Coach | Add player to academy |
| DELETE | `/:id/players/:playerId` | Admin, Coach | Remove player from academy |

---

### Training (`/api/training`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Public | List training sessions |
| GET | `/:id` | Public | Get session with attendance |
| POST | `/` | Admin, Manager, Coach | Create session |
| PATCH | `/:id` | Admin, Manager, Coach | Update session |
| DELETE | `/:id` | Admin, Manager | Delete session |
| POST | `/:id/attendance` | Admin, Manager, Coach | Mark attendance |

---

### Members (`/api/members`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Admin | List all members |
| GET | `/:id` | Protected | Get member details |
| POST | `/` | Admin | Create membership |
| PATCH | `/:id` | Admin | Update membership |
| DELETE | `/:id` | Admin | Remove membership |
| PATCH | `/:id/upgrade` | Admin | Upgrade membership tier |

---

### Statistics (`/api/statistics`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/top-scorers` | Public | Get top scorers |
| GET | `/standings` | Public | Get team standings |
| GET | `/` | Admin, Manager, Coach | List all statistics |
| GET | `/:id` | Admin, Manager, Coach | Get statistic details |
| POST | `/` | Admin, Manager, Coach | Create statistic |
| PATCH | `/:id` | Admin, Manager, Coach | Update statistic |
| DELETE | `/:id` | Admin | Delete statistic |

---

### Uploads (`/api/uploads`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | Admin, Manager, Coach | Single file upload |
| POST | `/multiple` | Admin, Manager | Multiple file upload (max 10) |
| POST | `/avatar` | Protected | Upload profile photo |
| POST | `/club-logo/:clubId` | Admin | Upload club logo |
| POST | `/club-cover/:clubId` | Admin | Upload club cover image |
| POST | `/player-photo/:playerId` | Admin, Manager | Upload player photo |
| POST | `/news-cover/:newsId` | Admin | Upload news cover image |
| DELETE | `/` | Admin | Delete file from Cloudinary |

---

## 🔌 Socket.io — Live Match Updates

### Connection

```javascript
const socket = io("http://localhost:5000", {
  auth: { token: "jwt_token_here" } // optional
});
```

### Events (Client → Server)

| Event | Payload | Auth Required | Description |
|-------|---------|---------------|-------------|
| `match:join` | `matchId` | No | Join a match viewing room |
| `match:leave` | `matchId` | No | Leave a match viewing room |
| `match:updateScore` | `{ matchId, homeScore, awayScore }` | Yes (Admin/Scorer) | Update match score |
| `match:addEvent` | `{ matchId, event }` | Yes (Admin/Scorer) | Add match event |
| `match:updateStatus` | `{ matchId, status }` | Yes (Admin/Manager) | Change match status |
| `match:chat` | `{ message }` | No | Send chat message |

### Events (Server → Client)

| Event | Payload | Description |
|-------|---------|-------------|
| `match:joined` | `{ matchId, viewers }` | Confirmation of joining |
| `match:viewerCount` | `count` | Updated viewer count |
| `match:scoreUpdate` | `{ matchId, score, timestamp }` | Real-time score update |
| `match:newEvent` | `{ matchId, event, score, timestamp }` | New match event |
| `match:statusChange` | `{ matchId, status, timestamp }` | Match status changed |
| `match:chatMessage` | `{ matchId, user, message, timestamp }` | Chat message |

### Controller Helpers

```javascript
const { emitToMatch, getMatchViewerCount } = require("../../../config/socket");

// Emit from controller
emitToMatch(matchId, "match:scoreUpdate", { matchId, score });

// Get viewer count
const viewers = getMatchViewerCount(matchId);
```

---

## 📤 File Uploads

### Supported Formats

- **Images:** JPEG, PNG, GIF, WebP, SVG
- **Videos:** MP4, MPEG, MOV, WebM
- **Max size:** 50 MB

### How It Works

1. Client sends file via `multipart/form-data`
2. Multer stores file in memory (no disk)
3. File is streamed to Cloudinary
4. Returns `{ url, publicId, type, format, bytes }`

### Cloudinary Config

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=fclub
```

---

## 🗃️ Database Models

### User

```javascript
{
  name: String (required, max 100),
  email: String (required, unique, lowercase),
  password: String (required, min 8, select: false),
  role: Enum ["SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH", "SCORER", "PLAYER", "MEMBER"],
  photo: String,
  isActive: Boolean (default: true),
  lastLogin: Date,
  passwordResetToken: String (select: false),
  passwordResetExpires: Date (select: false),
  timestamps: true
}
```

### Club

```javascript
{
  name: String (required, max 150),
  slug: String (unique, auto-generated),
  description: String,
  founded: Number,
  logo: String,
  coverImage: String,
  primaryColor: String,
  secondaryColor: String,
  stadium: { name, capacity, address },
  contact: { email, phone, website, social: { facebook, twitter, instagram, youtube } },
  location: { city, country },
  isActive: Boolean,
  admin: ObjectId → User,
  timestamps: true
}
```

### Player

```javascript
{
  user: ObjectId → User (optional, for linking),
  club: ObjectId → Club (required),
  firstName: String (required),
  lastName: String (required),
  number: Number (1-99),
  position: Enum ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"],
  subPosition: Enum ["CENTRE_BACK", "LEFT_BACK", etc.],
  dateOfBirth: Date,
  nationality: String,
  height: Number (cm),
  weight: Number (kg),
  preferredFoot: Enum ["LEFT", "RIGHT", "BOTH"],
  photo: String,
  bio: String (max 1000),
  joinDate: Date,
  contractEnd: Date,
  status: Enum ["ACTIVE", "INJURED", "SUSPENDED", "LOANED", "INACTIVE"],
  isActive: Boolean,
  timestamps: true
}
// Virtuals: fullName, age
// Compound unique index: { club, number }
```

### Team

```javascript
{
  club: ObjectId → Club (required),
  name: String (required),
  slug: String (unique),
  category: Enum ["SENIOR", "JUNIOR", "WOMEN", "ACADEMY", "RESERVE"],
  division: String,
  logo: String,
  description: String,
  manager: ObjectId → User,
  coach: ObjectId → User,
  players: [ObjectId → Player],
  captain: ObjectId → Player,
  isActive: Boolean,
  timestamps: true
}
```

### Match

```javascript
{
  club: ObjectId → Club (required),
  competition: ObjectId → Competition,
  season: ObjectId → Season,
  homeTeam: ObjectId → Team (required),
  awayTeam: ObjectId → Team (required),
  matchDate: Date (required),
  kickoff: String (default: "15:00"),
  venue: { name, address },
  status: Enum ["SCHEDULED", "LIVE", "HT", "FT", "POSTPONED", "CANCELLED"],
  score: { home: Number, away: Number },
  events: [{ type, minute, player, assist, description }],
  attendance: Number,
  referee: String,
  notes: String,
  timestamps: true
}
// Event types: GOAL, OWN_GOAL, YELLOW_CARD, RED_CARD, SUBSTITUTION, PENALTY_MISSED, INJURY
```

### Competition

```javascript
{
  club: ObjectId → Club (required),
  name: String (required),
  slug: String (unique),
  type: Enum ["LEAGUE", "CUP", "TOURNAMENT", "FRIENDLY"],
  logo: String,
  country: String,
  description: String,
  season: ObjectId → Season,
  teams: [ObjectId → Team],
  format: Enum ["ROUND_ROBIN", "KNOCKOUT", "GROUP_STAGE", "PLAYOFF"],
  isActive: Boolean,
  timestamps: true
}
```

### Season

```javascript
{
  club: ObjectId → Club (required),
  name: String (required),
  year: Number (required),
  startDate: Date,
  endDate: Date,
  isActive: Boolean,
  timestamps: true
}
// Compound unique index: { club, year }
```

### News

```javascript
{
  club: ObjectId → Club (required),
  author: ObjectId → User (required),
  title: String (required, max 200),
  slug: String (unique),
  excerpt: String (max 500),
  content: String (required),
  coverImage: String,
  category: Enum ["GENERAL", "MATCH_REPORT", "TRANSFER", "INJURY", "EVENT", "ANNOUNCEMENT"],
  tags: [String],
  isPublished: Boolean,
  publishedAt: Date,
  views: Number (default: 0),
  timestamps: true
}
// Text index on title, content, excerpt
```

### Gallery

```javascript
{
  club: ObjectId → Club (required),
  title: String (required),
  description: String,
  category: Enum ["MATCH", "TRAINING", "EVENT", "CELEBRATION", "OTHER"],
  coverImage: String,
  media: [{ url, type, caption, uploadedBy, timestamps }],
  isPublished: Boolean,
  timestamps: true
}
```

### Academy

```javascript
{
  club: ObjectId → Club (required),
  name: String (required),
  description: String,
  ageGroup: Enum ["U8", "U10", "U12", "U14", "U16", "U18", "U21"],
  headCoach: ObjectId → User,
  players: [ObjectId → Player],
  schedule: { trainingDays: [String], trainingTime: String },
  isActive: Boolean,
  timestamps: true
}
```

### Training

```javascript
{
  club: ObjectId → Club (required),
  team: ObjectId → Team (required),
  title: String (required),
  date: Date (required),
  startTime: String,
  endTime: String,
  location: String,
  type: Enum ["TACTICAL", "PHYSICAL", "TECHNICAL", "RECOVERY", "MIXED"],
  description: String,
  coach: ObjectId → User,
  attendance: [{ player, status, notes }],
  status: Enum ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  timestamps: true
}
// Attendance statuses: PRESENT, ABSENT, LATE, EXCUSED
```

### Member

```javascript
{
  user: ObjectId → User (required),
  club: ObjectId → Club (required),
  membershipType: Enum ["FREE", "BASIC", "PREMIUM", "VIP"],
  memberNumber: String (auto-generated: MEM-00001),
  joinDate: Date,
  expiryDate: Date,
  isActive: Boolean,
  preferences: { notifications: Boolean, newsletter: Boolean },
  timestamps: true
}
// Compound unique index: { user, club }
```

### Statistic

```javascript
{
  club: ObjectId → Club (required),
  player: ObjectId → Player,
  team: ObjectId → Team,
  season: ObjectId → Season,
  competition: ObjectId → Competition,
  type: Enum ["PLAYER_SEASON", "TEAM_SEASON", "TEAM_MATCH"],
  matchesPlayed: Number,
  goals: Number,
  assists: Number,
  cleanSheets: Number,
  yellowCards: Number,
  redCards: Number,
  minutesPlayed: Number,
  saves: Number,
  winRate: Number,
  draws: Number,
  losses: Number,
  goalsFor: Number,
  goalsAgainst: Number,
  points: Number,
  position: Number,
  extra: Mixed,
  timestamps: true
}
// Indexes: { club, type, season }, { player, season }, { team, season }
```

---

## 🛡️ Middleware

### `protect`

Verifies JWT from cookie or `Authorization: Bearer <token>`. Attaches decoded payload to `req.user`.

### `authorize(...roles)`

Checks if `req.user.role` is in the allowed roles list (with hierarchy inheritance).

### `validate(schema, source)`

Validates `req.body`, `req.params`, or `req.query` against a Zod schema. Replaces with parsed/stripped values.

### `upload` + `uploadToCloudinary`

Multer memory storage → stream to Cloudinary. Attaches `req.uploadedFile` or `req.uploadedFiles`.

### `apiLimiter`

100 requests per 15 minutes per IP.

### `authLimiter`

20 requests per 15 minutes per IP (stricter for login/register).

### `applySecurity(app)`

Applies all security middleware at once:
- **Helmet** — Security headers (XSS, clickjacking, MIME sniffing)
- **Compression** — Gzip responses > 1KB
- **mongo-sanitize** — Strips `$` and `.` from req.body/query/params
- **HPP** — Prevents HTTP parameter pollution
- **Request ID** — UUID-based `X-Request-Id` header on every request
- **Additional headers** — X-Content-Type-Options, X-Frame-Options, etc.

### `auditMiddleware`

Logs user actions to `AuditLog` collection. Attach audit data to `req.audit`:
```javascript
req.audit = { action: "CREATE", resource: "Player", resourceId: player._id };
```

### `cacheMiddleware(ttlSeconds)`

Caches GET responses in Redis (or in-memory fallback). Usage:
```javascript
router.get("/", cacheMiddleware(300), controller.getAll);
```

### `errorHandler`

- **Development:** Full error + stack trace
- **Production:** Operational errors only, generic message for others
- Handles: CastError, duplicate fields, validation errors, JWT errors

---

## 📚 API Documentation (Swagger)

Access Swagger UI at: `http://localhost:5000/api-docs`

Raw JSON spec: `http://localhost:5000/api-docs.json`

All endpoints are documented with request/response schemas.

---

## 📧 Email Service

Uses Nodemailer for:
- **Password reset emails** — `sendPasswordResetEmail(email, token, url)`
- **Welcome emails** — `sendWelcomeEmail(email, name)`

Development: Uses Ethereal test accounts (preview URLs in console)
Production: Configure SMTP via environment variables

```javascript
const { sendPasswordResetEmail, sendWelcomeEmail } = require("../utils/email");

await sendPasswordResetEmail(user.email, resetToken, resetURL);
await sendWelcomeEmail(user.email, user.name);
```

---

## ⚡ Redis Caching

Falls back to in-memory cache if Redis is unavailable.

```javascript
const { cacheGet, cacheSet, cacheDel, cacheMiddleware } = require("../utils/cache");

// Manual caching
await cacheSet("players:club123", players, 300); // TTL: 5 min
const cached = await cacheGet("players:club123");
await cacheDel("players:*"); // Delete by pattern

// Middleware caching
router.get("/", cacheMiddleware(300), controller.getAll);
```

---

## 🐳 Docker

### Quick Start

```bash
npm run docker:up    # Starts MongoDB + Redis + API
npm run docker:down  # Stops all containers
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| API | 5000 | Express backend |
| MongoDB | 27017 | Database |
| Redis | 6379 | Cache |

---

## 🧪 Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Test Files

- `tests/health.test.js` — Health check endpoint
- `tests/auth.test.js` — Register, login, profile

---

## 🔄 CI/CD (GitHub Actions)

Located at `.github/workflows/ci.yml`

**Pipeline:**
1. Checkout code
2. Setup Node.js 20
3. Install dependencies
4. Run tests against MongoDB service
5. Deploy notification (on main branch push)

---

## 🔒 Graceful Shutdown

`server.js` handles SIGTERM/SIGINT signals:
1. Stops accepting new HTTP connections
2. Closes Socket.io connections
3. Closes MongoDB connection
4. Waits up to 30s before force exit

---

## 📄 Audit Logging

Tracks all user actions in `AuditLog` collection.

```javascript
const { logAudit } = require("../middleware/auditLog");

await logAudit({
  action: "CREATE",
  resource: "Player",
  resourceId: player._id,
  req: req,
});
```

**Logged actions:** CREATE, UPDATE, DELETE, LOGIN, LOGOUT, REGISTER, PASSWORD_CHANGE, PASSWORD_RESET, ROLE_CHANGE, FILE_UPLOAD, FILE_DELETE, PLAYER_TRANSFER, BULK_IMPORT

---

## 📐 Pagination

```javascript
const { parsePagination, buildPagination } = require("../utils/pagination");

// In controller
const { page, limit, skip, sort } = parsePagination(req.query);
const total = await Model.countDocuments(filter);
const docs = await Model.find(filter).skip(skip).limit(limit).sort(sort);

res.json({
  success: true,
  ...buildPagination(total, page, limit),
  data: { docs },
});
```

**Query params:** `?page=1&limit=20&sort=-createdAt`

---

## 🌱 Seed Script

```bash
npm run seed        # Seed without dropping
npm run seed:drop   # Drop all collections first
```

### Default Login

```
Email: admin@fclub.com
Password: password123
```

### Seed Data Includes

- 11 users (all roles)
- 2 clubs
- 3 seasons
- 4 players
- 3 teams
- 2 competitions
- 3 matches (1 FT, 1 LIVE, 1 SCHEDULED)
- 3 news articles
- 2 galleries
- 2 academies
- 2 training sessions
- 2 members
- 3 statistics

---

## 🔌 Socket.io Helpers

```javascript
// In controllers:
const { emitToMatch, getMatchViewerCount } = require("../../../config/socket");

// Emit event to match room
emitToMatch(matchId, "match:scoreUpdate", { score: { home: 2, away: 1 } });

// Get current viewer count
const viewers = getMatchViewerCount(matchId);
```

---

## 📋 Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/football-club

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=fclub

# Redis (optional - falls back to in-memory cache)
REDIS_URL=redis://localhost:6379

# Email (optional - uses Ethereal in development)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@example.com
SMTP_PASS=your_password
EMAIL_FROM=FClub <noreply@fclub.com>

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

---

## 🚀 Running

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production
npm start

# Seed database
npm run seed

# Seed with fresh database
npm run seed:drop

# Run tests
npm test
npm run test:watch    # Watch mode
npm run test:coverage # With coverage

# Docker
npm run docker:up     # Start MongoDB + Redis + API
npm run docker:down   # Stop containers
npm run docker:logs   # View logs
```

### Docker Quick Start

```bash
# Start everything with Docker
npm run docker:up

# API available at http://localhost:5000
# Swagger docs at http://localhost:5000/api-docs
# MongoDB at localhost:27017
# Redis at localhost:6379
```

---

## 📝 Conventions

1. **Error handling:** All controllers use `catchAsync` wrapper, throw `AppError` for operational errors
2. **Validation:** All write endpoints use Zod schemas via `validate` middleware
3. **Auth:** Protected routes use `protect` middleware, role-restricted routes use `authorize`
4. **Pagination:** List endpoints support `?page=1&limit=20` query params
5. **Filtering:** Endpoints support query params like `?club=<id>&status=ACTIVE&search=text`
6. **Response format:** `{ success: boolean, data?: object, message?: string, results?: number, total?: number }`
7. **Slugs:** Clubs, teams, competitions, and news auto-generate slugs from names
8. **Soft delete:** Most entities use `isActive` flag rather than hard delete
9. **File uploads:** Always go through Cloudinary, never saved to disk
