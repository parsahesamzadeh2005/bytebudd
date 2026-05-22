/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost", "localhost:80"],
    },
  },
};

module.exports = nextConfig;
