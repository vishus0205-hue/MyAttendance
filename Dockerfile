# Multi-stage production container with Playwright & Chromium support
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install project dependencies
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

# Copy the rest of the application files
COPY . .

# Build Next.js
RUN npm run build

# Expose default port
EXPOSE 3000
ENV PORT=3000

# Push schema to PostgreSQL if updated, then start Next.js production server
CMD ["sh", "-c", "npx prisma db push && npm start"]
