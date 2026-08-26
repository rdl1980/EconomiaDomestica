import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // I package del monorepo sono TypeScript non compilato: Next li transpila.
  transpilePackages: ['@ed/core', '@ed/db'],
  typedRoutes: true,
  experimental: {
    // Le server action ricevono foto di scontrini: il default di 1 MB è troppo basso.
    serverActions: { bodySizeLimit: '12mb' },
  },
};

export default nextConfig;
