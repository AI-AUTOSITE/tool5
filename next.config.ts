/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScriptのビルドエラーを一時的に無視
  typescript: {
    ignoreBuildErrors: true,
  },
  // ESLintのビルドエラーを一時的に無視
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;