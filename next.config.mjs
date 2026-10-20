/** @type {import('next').NextConfig} */
// SVKM MyAttendance production Next.js configuration
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["playwright", "pdf-parse", "@sparticuz/chromium"],
    outputFileTracingIncludes: {
      "/api/auth/login": ["./node_modules/@sparticuz/chromium/bin/**/*"],
      "/api/sync": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    },
  },
};

export default nextConfig;
