/** @type {import('next').NextConfig} */
// SVKM MyAttendance production Next.js configuration
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["playwright", "pdf-parse"],
  },
};

export default nextConfig;
