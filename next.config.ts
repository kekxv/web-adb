import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // 强制末尾斜杠，这对静态托管非常友好
  trailingSlash: true,
  // 如果在 GitHub Actions 中构建，使用仓库名作为基础路径
  basePath: process.env.GITHUB_ACTIONS ? '/web-adb' : '',
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
};

export default nextConfig;
