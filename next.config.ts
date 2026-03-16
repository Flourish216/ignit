import type { NextConfig } from "next";

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: isGitHubActions ? "/ignit" : "",
  assetPrefix: isGitHubActions ? "/ignit/" : undefined,
};

export default nextConfig;
