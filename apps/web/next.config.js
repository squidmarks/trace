/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@trace/shared"],
  output: "standalone", // Enable standalone output for Docker
}

module.exports = nextConfig

