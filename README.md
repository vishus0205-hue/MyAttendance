<div align="center">

<img src="docs/banner.png" alt="MyAttendance Banner" width="100%" />

# MyAttendance

**Never manually check your SVKM SAP portal again.**  
Attendance syncs automatically every night while you sleep. 🌙

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Playwright](https://img.shields.io/badge/Playwright-1.49-45ba4b?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-Nightly_Sync-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-a855f7?style=for-the-badge)](LICENSE)

</div>

---

## 🌟 What is MyAttendance?

**MyAttendance** is a personal, automated attendance tracking dashboard for students of **SVKM institutes** (NMIMS, MPSTME, etc.). It securely logs into the SVKM SAP portal on your behalf every night at **4:00 AM IST**, pulls your latest attendance data, and presents it in a clean, easy-to-understand dashboard.

> 💡 **No more stale data. No more manual checks. Just open your dashboard and know.**

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| 🌙 **Nightly Auto-Sync** | GitHub Actions triggers a sync every night at 4:00 AM IST via Playwright browser automation |
| 🔐 **Zero Plaintext Credentials** | Your portal password is encrypted with AES-256-GCM before being stored — never saved as plain text |
| 📊 **Smart Analytics** | Visual attendance charts, bunk counter, recovery class calculator, and subject-wise breakdown |
| ⚡ **14-Day Incremental Sync** | Only fetches new records since your last sync — fast, efficient, and avoids timeouts |
| 🌗 **Dark / Light Mode** | Persisted theme preference with an anti-flicker script so there is no flash on load |
| 👤 **Multi-User Support** | Each user's credentials and data are isolated and independently synced |
| 📱 **Responsive UI** | Works beautifully on mobile, tablet, and desktop |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Actions                        │
│              (Cron: 4:00 AM IST Daily)                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  Next.js Backend                         │
│             (Vercel Serverless)                          │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐  │
│  │  Auth Layer  │    │  Sync API    │    │  Settings │  │
│  └──────┬───────┘    └──────┬───────┘    └─────┬─────┘  │
│         └──────────────┬────┘                   │        │
│                        ▼                        │        │
│           ┌────────────────────────┐            │        │
│           │  Playwright Adapter    │            │        │
│           │  (SVKM SAP Portal)     │            │        │
│           └────────────┬───────────┘            │        │
└────────────────────────┼────────────────────────┘
                         │ Prisma ORM
                         ▼
             ┌───────────────────────────────────────────┐
             │           PostgreSQL Database              │
             │  Users · Subjects · AttendanceRecords      │
             └───────────────────────────────────────────┘
```

---

## 🔒 Security Design

MyAttendance was built with security as a first-class concern.

- **AES-256-GCM Encryption** — Your portal credentials are encrypted with a 256-bit key, a 96-bit random IV, and a 128-bit auth tag before being stored.
- **Key Separation** — The encryption key lives only in environment variables (`PORTAL_ENCRYPTION_SECRET`) and is never committed or exposed to the client.
- **SSRF Allowlisting** — Browser automation is strictly constrained to the SVKM portal hostname. No other URLs can be navigated.
- **Session Security** — Authentication sessions are signed using `AUTH_SECRET` and are server-only, never accessible from the browser.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind CSS |
| **Backend** | Next.js API Routes (Serverless), TypeScript |
| **Database** | PostgreSQL via Prisma ORM |
| **Automation** | Playwright (headless Chromium), GitHub Actions |
| **Charts** | Recharts |
| **Auth** | Custom session-based auth with bcryptjs |
| **Security** | Node.js `crypto` (AES-256-GCM) |
| **Deployment** | Vercel + Railway / Docker (DB) |

---

## ⚙️ Local Setup

### Prerequisites

- **Node.js** v20+
- **Docker** (for local PostgreSQL)
- **Playwright Chromium** for first-time SVKM portal login (`npx playwright install chromium`). The app only creates an SVKM account after the portal verifies its credentials; deploy first-time login on a runtime with Chromium available.

On Vercel, the login and sync functions bundle `@sparticuz/chromium` so portal verification can run in the serverless runtime. Local development and the Docker image continue to use Playwright's installed Chromium.

### 1. Clone the Repository

```bash
git clone https://github.com/vishus0205-hue/MyAttendance.git
cd MyAttendance
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# Database
DATABASE_URL="postgresql://postgres:myattendance_password@localhost:5433/myattendance?schema=public"

# Encryption key for storing portal credentials (64 hex chars = 32 bytes)
PORTAL_ENCRYPTION_SECRET="your_64_char_hex_key_here"

# Session signing secret
AUTH_SECRET="your_random_auth_secret_here"

# SVKM SAP Portal URL
PORTAL_URL="https://sdc-sppap1.svkm.ac.in:50001/irj/portal"

# GitHub token for triggering the nightly sync workflow
GITHUB_TOKEN="your_github_pat_here"
GITHUB_REPO_OWNER="vishus0205-hue"
GITHUB_REPO_NAME="MyAttendance"
```

> 🔑 **Generate a secure encryption key:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 4. Start the Database

```bash
docker compose up -d
```

### 5. Initialize the Schema

```bash
npx prisma db push
```

### 6. (Optional) Seed Demo Data

```bash
npm run db:seed
```

Creates a demo account (`student@svkm.ac.in`) with 6 subjects and 60 days of attendance history.

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 🌙 Nightly Sync Setup (GitHub Actions)

The nightly sync runs via a **GitHub Actions workflow** triggered at **4:00 AM IST** every day.

### Required GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions** and add:

| Secret Name | Description |
|---|---|
| `DATABASE_URL` | Your production PostgreSQL connection string |
| `PORTAL_ENCRYPTION_SECRET` | 64-char hex encryption key |
| `AUTH_SECRET` | Session signing secret |
| `PORTAL_URL` | SVKM SAP portal URL |

---

## 📁 Project Structure

```
MyAttendance/
├── .github/workflows/      # GitHub Actions (nightly sync)
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Demo data seeder
├── scripts/
│   └── nightly-sync.ts     # Nightly sync entry point
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── dashboard/      # Main attendance dashboard
│   │   ├── settings/       # User settings and credentials
│   │   └── api/            # API routes (sync, auth, settings)
│   ├── components/layout/  # Navbar, Footer
│   ├── lib/
│   │   ├── auth/           # Session management
│   │   └── security/       # AES-256-GCM crypto utilities
│   └── services/portal/    # Playwright portal adapter
├── tests/                  # Unit tests
├── docker-compose.yml
└── .env.example
```

---

## 🧪 Running Tests

```bash
# Test AES-256-GCM encryption and decryption
npx ts-node tests/crypto.test.ts

# Test attendance percentage, bunk buffer and recovery class formulas
npx ts-node tests/attendance-calculator.test.ts
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feat/amazing-feature`
5. Open a Pull Request

---

## ⚠️ Disclaimer

This project is built for **personal educational use only**. It automates interactions with the SVKM SAP portal using your own credentials. Please use responsibly and in accordance with your institution's policies.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">

Made with ❤️ for SVKM students

⭐ **If this helped you, give it a star!** ⭐

</div>
