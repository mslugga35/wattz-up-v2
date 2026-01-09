# Wattz Up v2

**Real-time wait time estimates for 65,000+ EV charging stations**

A simplified rebuild of the original Wattz Up app. Single Next.js 14 app with PWA support.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Mobile | PWA (installable) |
| Database | Supabase (PostgreSQL + PostGIS) |
| ORM | Drizzle |
| UI | Tailwind + Shadcn/ui |
| Maps | Mapbox GL |
| State | Zustand |

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment

```bash
cp .env.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL` - From Supabase dashboard
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - From Supabase dashboard
- `DATABASE_URL` - Supabase connection pooler URL
- `NEXT_PUBLIC_MAPBOX_TOKEN` - From Mapbox account
- `AFDC_API_KEY` - From NREL developer portal

### 3. Set up database

```bash
# Generate migrations
pnpm drizzle-kit generate

# Push to database
pnpm drizzle-kit push
```

**Important:** Enable PostGIS extension in Supabase:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 4. Run development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## vs Original

| Aspect | Original | v2 |
|--------|----------|-----|
| Packages | 6 (monorepo) | 1 (single app) |
| Mobile | React Native | PWA |
| API | Fastify | Next.js API routes |
| Workers | Separate services | Vercel Cron |
| Admin | Separate app | Same app (/admin) |
| Complexity | 8/10 | 2/10 |

## Deployment

```bash
vercel deploy
```

## License

MIT
