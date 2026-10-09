/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_REPOSITORY != null;
const basePath = isGitHubPages
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}`
  : '';
const assetPrefix = basePath ? `${basePath}/` : undefined;

const nextConfig = {
  output: 'export',
  ...(basePath && { basePath }),
  ...(assetPrefix && { assetPrefix }),
  // Exposed for raw URLs that next/link does not prefix (meta refresh, <img>, rendered Markdown links).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
