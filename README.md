# DukkanAi

Business co-pilot for chhoti Indian dukaanon ke liye — kirana store, tailor, freelancer. Owners log sales/expenses/stock/udhaar in free text, and the app turns it into structured numbers and plain-language insights.

**Golden rule:** the AI (Gemini) never calculates a number. All math (totals, %, balances, projections) is plain JS on numbers already in the database — Gemini only ever narrates numbers it's handed.

---

## 1. What you need to sign up for

Two free things are required before running this locally:

1. **MongoDB Atlas (free tier)** — the database.
   - Go to https://www.mongodb.com/cloud/atlas/register, create a free account.
   - Create a free (M0) cluster.
   - Under **Database Access**, create a database user (username + password).
   - Under **Network Access**, add your current IP (or `0.0.0.0/0` for quick local testing).
   - Click **Connect → Drivers**, copy the connection string — it looks like:
     `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/dukkanai`

2. **Google Gemini API key (free)** — powers quick-add parsing, greetings, summaries, and alert phrasing.
   - Go to https://aistudio.google.com/app/apikey
   - Sign in with a Google account, click **Create API key**, copy it.

The app runs fully with just those two. Two more are **optional**, only needed if you want udhaar reminders to actually deliver over SMS/email instead of just drafting the message on-screen:

3. **TextBee (free)** — turns a spare Android phone into an SMS gateway, used for the "Send Reminder" SMS channel.
   - Go to https://textbee.dev, create a free account, and follow their app setup to register a device.
   - Copy your API key and device ID from the TextBee dashboard.

4. **Gmail API OAuth credentials (free)** — sends the "Send Reminder" email channel over HTTPS (not SMTP, so it works on hosts that block SMTP ports).
   - In Google Cloud Console, create a project, enable the Gmail API, and create an OAuth 2.0 Client ID.
   - Grant it the `https://www.googleapis.com/auth/gmail.send` scope and generate a refresh token for the mailbox you want to send from (e.g. via Google's OAuth 2.0 Playground).

If you skip 3 and 4, the app still works normally — the reminder draft still shows on-screen, and "Send Reminder" will just report that channel as not configured instead of crashing.

---

## 2. Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/dukkanai
JWT_SECRET=some_long_random_string_you_make_up
JWT_EXPIRES_IN=7d
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
NODE_ENV=development
```

- `JWT_SECRET` can be any long random string (e.g. run `openssl rand -hex 32` and paste the output).
- `GEMINI_MODEL` is optional — defaults to `gemini-2.0-flash` if omitted.

**Optional — only needed for SMS/email udhaar reminders** (see item 3/4 above):

```
TEXTBEE_API_KEY=your_textbee_api_key
TEXTBEE_DEVICE_ID=your_textbee_device_id
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REFRESH_TOKEN=your_google_oauth_refresh_token
GMAIL_SENDER_EMAIL=the_gmail_address_you_send_from
```

The frontend needs no `.env` for local dev (it talks to `http://localhost:5000` by default via Vite's dev proxy / fetch base URL already set up in `frontend/src`). For a real deployment, see Section 5.

---

## 3. Setup & run locally

```bash
# Backend
cd backend
npm install
npm run dev          # starts on http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev           # starts on http://localhost:5173
```

Open http://localhost:5173, register a shop, and start using the dashboard.

---

## 4. Running tests

```bash
cd backend
npm test
```

This runs the full Jest suite (`jest --runInBand`). Expected passing output looks like:

```
PASS  tests/analyticsMath.test.js
PASS  tests/stockMath.test.js
PASS  tests/udhaarMath.test.js
PASS  tests/reportMath.test.js
PASS  tests/validateQuickAdd.test.js
PASS  tests/auth.test.js
PASS  tests/tenantIsolation.test.js

Test Suites: 7 passed, 7 total
Tests:       XX passed, XX total
```

**What each file covers:**

| File | Covers | Needs Mongo? |
|---|---|---|
| `analyticsMath.test.js` | Dashboard/analytics math: totals, % change, margins, daily series, top categories, date-range windows | No — pure JS |
| `stockMath.test.js` | Stock status thresholds, usage-velocity averaging, restock-due projections, sidebar badge counts | No — pure JS |
| `udhaarMath.test.js` | Udhaar (credit) balance derivation, per-customer totals, outstanding-balance summary | No — pure JS |
| `reportMath.test.js` | Custom date-range report totals/category breakdown, CSV escaping/export | No — pure JS |
| `validateQuickAdd.test.js` | Sanitizing/validating Gemini's quick-add output before it ever reaches the database | No — pure JS |
| `auth.test.js` | Register/login/JWT issuing, protected-route rejection | Yes — `mongodb-memory-server` (auto-downloads an in-memory Mongo binary on first run; needs internet the first time) |
| `tenantIsolation.test.js` | Tenant B can never read Tenant A's data via the real HTTP API, even guessing IDs | Yes — same as above |

> Note: `mongodb-memory-server` downloads a small MongoDB binary the first time you run tests, so the very first `npm test` needs an internet connection. After that it's cached locally and runs offline.

---

## 5. Free deployment (Vercel + Render + Atlas)

**Database** — already done in Section 1 (Atlas free tier).

**Backend → Render (free web service)**
1. Push this repo to GitHub.
2. On https://render.com, click **New → Web Service**, connect the repo, set root directory to `backend`.
3. Build command: `npm install` — Start command: `npm start`.
4. Add the same environment variables from Section 2 under Render's **Environment** tab.
5. Deploy — Render gives you a URL like `https://dukkanai-backend.onrender.com`.

**Frontend → Vercel (free)**
1. On https://vercel.com, click **Add New → Project**, import the same repo, set root directory to `frontend`.
2. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
3. Add an environment variable pointing the frontend at your Render backend URL (e.g. `VITE_API_URL=https://dukkanai-backend.onrender.com`) if your frontend reads it from `import.meta.env` — otherwise update the API base URL constant in `frontend/src` before building.
4. Deploy — Vercel gives you a live URL.

**Verify**
- Visit `/system-health` on your deployed backend URL (public, no login) to confirm tenant isolation, password hashing, JWT validity, and duplicate-user prevention all report pass.

---

## 6. Project structure

```
backend/
  src/
    config/      # DB connection
    models/      # Tenant, User, Entry, StockItem, UdhaarCustomer, UdhaarTransaction, Alert
    middleware/   # requireAuth, tenantScope (the tenant-isolation helper)
    services/     # ALL pure math + Gemini wrapper live here
    controllers/  # request handling, wires services together
    routes/       # Express routers
    jobs/         # nightly alert cron
  tests/          # Jest + Supertest

frontend/
  src/            # React + Vite + Tailwind + Recharts
```
