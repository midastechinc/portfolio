# Midas Portfolio — Setup Guide

Get your investment dashboard live at **midastechinc.github.io/portfolio** in about 10 minutes.

---

## What You Need
- GitHub account (`midastechinc`) ✅
- Supabase account (free) — create at supabase.com
- 10 minutes

---

## Step 1 — Create GitHub Repository

1. Go to **github.com/midastechinc**
2. Click **New repository**
3. Repository name: `portfolio`
4. Set to **Public**
5. Click **Create repository**
6. Upload all 4 files from this folder:
   - `index.html`
   - `config.js`
   - `schema.sql`
   - `README.md`

---

## Step 2 — Enable GitHub Pages

1. In the repo, go to **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `root`
4. Click **Save**
5. Your URL will be: `https://midastechinc.github.io/portfolio`

---

## Step 3 — Create Supabase Project

1. Go to **supabase.com** → Sign up (free)
2. Click **New Project**
3. Name: `midas-portfolio`
4. Set a database password (save it somewhere)
5. Region: **US East** or **Canada** (closest to you)
6. Click **Create new project** — wait ~2 minutes

---

## Step 4 — Run the Database Schema

1. In your Supabase project, click **SQL Editor** (left sidebar)
2. Click **New query**
3. Open the `schema.sql` file from this folder
4. Copy the entire contents and paste into the editor
5. Click **Run**
6. You should see: *"Success. No rows returned"*

---

## Step 5 — Configure Auth (Magic Link)

1. In Supabase, go to **Authentication → URL Configuration**
2. Set **Site URL** to: `https://midastechinc.github.io/portfolio`
3. Under **Redirect URLs**, add: `https://midastechinc.github.io/portfolio`
4. Click **Save**

---

## Step 6 — Get Your API Keys

1. In Supabase, go to **Settings → API**
2. Copy your **Project URL** — looks like: `https://abcxyz.supabase.co`
3. Copy your **anon / public** key — starts with `eyJ...`

---

## Step 7 — Update config.js

Open `config.js` and replace the placeholder values:

```js
const SUPABASE_URL      = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI...';
```

Save the file and re-upload it to GitHub (or commit the change).

---

## Step 8 — Go Live!

1. Visit: **https://midastechinc.github.io/portfolio**
2. Enter your email → you'll get a magic link
3. Tap the link → you're signed in
4. Start adding holdings 🎉

---

## How It Works

| Feature | How |
|---|---|
| Auth | Supabase magic link (email) — no password |
| Holdings data | Supabase Postgres — syncs across all devices |
| Prices | Claude AI + web search — fetched on demand |
| News | Claude AI + web search — latest 48h headlines |
| AI Advice | Claude AI with BUY/HOLD/SELL recommendations |
| Hosting | GitHub Pages — free, always on |

---

## Accessing on Your Phone

1. Open **https://midastechinc.github.io/portfolio** in Safari/Chrome
2. Tap **Share → Add to Home Screen**
3. It'll appear as an app icon on your phone

---

## Security Notes

- Row Level Security (RLS) is enabled — your holdings are private
- Only your email can access your data
- The anon key in `config.js` is safe to be public — it only allows authenticated operations
- Never commit your database password

---

## Support

Ali Jaffar — Midas Tech Inc.  
📧 info@midastech.ca  
📞 905-787-2038  
🌐 www.midastech.ca
