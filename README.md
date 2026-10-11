# MyAttendance — Automated College Attendance Dashboard

A personal, secure college attendance tracking web application built with **Next.js 14**, **PostgreSQL**, **Prisma ORM**, **Tailwind CSS**, and **Playwright**.

---

## Architecture Overview

```
                      ┌────────────────────────┐
                      │   PostgreSQL Database  │
                      │ (Docker on port 5433)  │
                      └───────────▲────────────┘
                                  │ Prisma ORM
                      ┌───────────┴────────────┐
                      │    Next.js Backend     │
                      │  (Services & API/Cron) │
                      └───────────▲────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
┌────────┴────────┐      ┌────────┴────────┐      ┌────────┴────────┐
│ MockPortalAdapter│      │PlaywrightAdapter│      │ Report Fallback │
│   (Demo Mode)   │      │(SVKM SAP Portal)│      │  (CSV / HTML)   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

### Key Security Safeguards
- **Zero Plaintext Storage**: Portal credentials (username, password) are encrypted using **AES-256-GCM** with 96-bit random IVs and 128-bit authentication tags.
- **Key Separation**: Encryption secret (`PORTAL_ENCRYPTION_SECRET`) lives exclusively in environment variables and is never committed or exposed to the client.
- **SSRF Allowlisting**: Browser automation navigation is strictly constrained to configured institutional hostnames (`sdc-sppap1.svkm.ac.in`).

---

## Prerequisites

- **Node.js**: v20+ (v24.14 recommended)
- **Docker**: For running the local PostgreSQL container

---

## Quickstart Setup

### 1. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your `DATABASE_URL` points to the PostgreSQL container:
```env
DATABASE_URL="postgresql://postgres:myattendance_password@localhost:5433/myattendance?schema=public"
PORTAL_ENCRYPTION_SECRET="f3b9c7e14a82d06f15e8b4c29a73d51806f4e2a9b7c1d3e5f8a0b2c4d6e8f1a3"
AUTH_SECRET="a84c20fe791b8d52364c1e09af3218de92bc87e510fa3492"
PORTAL_URL="https://sdc-sppap1.svkm.ac.in:50001/irj/portal"
```

### 2. Start PostgreSQL Container
```bash
docker compose up -d
```
The database will be healthy and accessible on `localhost:5433`.

### 3. Initialize Database Schema
```bash
npx prisma db push
```

### 4. Seed Demo Data
Populate the database with a demo student user (`student@svkm.ac.in`), 6 subjects, and 60 days of historical attendance:
```bash
npm run db:seed
```

---

## Testing

Run unit tests for cryptographic operations and attendance calculations:
```bash
# Test AES-256-GCM encryption, decryption, and integrity checking
npx ts-node tests/crypto.test.ts

# Test attendance percentage, bunk buffer, and recovery classes formulas
npx ts-node tests/attendance-calculator.test.ts
```

---

## SVKM SAP NetWeaver Portal Investigation Summary

- **Portal URL**: `https://sdc-sppap1.svkm.ac.in:50001/irj/portal`
- **Application Server**: SAP NetWeaver Application Server 7.53 / AS Java 7.50
- **User-Agent Requirement**: SAP iViews enforce browser validation. Standard desktop Chrome User-Agent header bypasses this restriction.
- **Authentication**: Form POST with dynamic `j_salt`, `#logonuidfield` (User), and `#logonpassfield` (Password).
- **Captcha**: 6-character client-side JavaScript canvas captcha (`ValidCaptcha()`). The plain text code is stored in `window.code` on the client page, allowing automated fill during headless sessions.
