# Wattz Up v2 - Setup Guide

## Quick Setup (5 minutes)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `wattz-up`
3. Choose a strong password (save it!)
4. Select region closest to your users

### 2. Get Your Credentials

**From Supabase Dashboard → Settings → API:**

| Key | Location |
|-----|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public key |
| `DATABASE_URL` | Settings → Database → Connection string (URI) → Use "Transaction" mode |

**Mapbox Token:**
1. Go to [mapbox.com](https://account.mapbox.com)
2. Create account → Access tokens → Create token
3. Copy the public token

**AFDC API Key:**
1. Go to [developer.nrel.gov/signup](https://developer.nrel.gov/signup/)
2. Fill form → Get API key via email

### 3. Set Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
DATABASE_URL=postgresql://postgres.YOUR-PROJECT:YOUR-PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-token
AFDC_API_KEY=your-nrel-api-key
CRON_SECRET=generate-random-string-here
```

### 4. Run Database Migration

**In Supabase Dashboard → SQL Editor:**

1. Click "New query"
2. Copy contents of `drizzle/0000_init.sql`
3. Paste and click "Run"

Or via CLI:
```bash
# If you have Supabase CLI installed
supabase db push
```

### 5. Generate PWA Icons

```bash
node scripts/generate-icons.js
```

### 6. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### 7. Import Station Data

Trigger the AFDC import (first run takes ~30 seconds):

```bash
# Local
curl -X POST http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer YOUR-CRON-SECRET"
```

---

## Deployment (Vercel)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:YOUR-USERNAME/wattz-up-v2.git
git push -u origin main
```

### 2. Deploy to Vercel

```bash
vercel deploy
```

Or connect via Vercel Dashboard → New Project → Import from GitHub

### 3. Add Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

Add all variables from `.env.local`

### 4. Configure Cron

The `vercel.json` already has cron configured for every 6 hours.

---

## Testing

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Get Nearby Stations
```bash
curl "http://localhost:3000/api/stations/nearby?latitude=37.7749&longitude=-122.4194&radiusKm=10"
```

### Register Device
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-device-123","platform":"web"}'
```

---

## Troubleshooting

### "supabaseUrl is required"
→ Check `.env.local` has correct Supabase URL

### "Failed to connect to database"
→ Use connection pooler URL (port 6543), not direct connection

### Map not showing
→ Check Mapbox token is set and valid

### No stations appearing
→ Run the ingest cron to import AFDC data

---

## Architecture

```
Browser/PWA
    ↓
Next.js App (Vercel Edge)
    ↓
Supabase (PostgreSQL + PostGIS)
    ↓
AFDC API (station data)
```

All in one codebase. No separate services to manage.
