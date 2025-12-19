import type { NextConfig } from "next";

// 初始化 OpenNext Cloudflare 开发环境
// 这使得在本地开发时可以模拟 Cloudflare Workers 环境
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
