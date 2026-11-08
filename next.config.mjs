import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));

// Preserve the existing browser-public env convention. Never copy server env wholesale.
const publicEnv = Object.fromEntries(Object.entries(process.env)
  .filter(([key]) => key.startsWith('REACT_APP_')));
for (const key of ['APP_GITHUB_CLIENT_ID', 'APP_JUP_API_KEY', 'APP_SANCTUM_API_KEY']) {
  if (process.env[key]) publicEnv[key] = process.env[key];
}

export default {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {...publicEnv, NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED:
    process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED || (process.env.VERCEL === '1' ? 'true' : 'false')},
  // The previous build also transpiled without checking the legacy application's types.
  typescript: {ignoreBuildErrors: true},
  serverExternalPackages: ['firebase-admin', '@vercel/og'],
  experimental: {cpus: 2, webpackBuildWorker: true},
  webpack(config, {isServer, webpack}) {
    config.resolve.alias['/src'] = path.join(root, 'src');
    config.resolve.alias.src = path.join(root, 'src');
    const imageRule = config.module.rules.find(rule => rule.test?.test?.('.png'));
    if (imageRule) imageRule.resourceQuery = {not: [/url/]};
    config.module.rules.push({
      test: /\.(png|jpg|jpeg|gif|webp|svg)$/i, resourceQuery: /url/,
      type: 'asset/resource', generator: {filename: 'static/media/[name].[contenthash:8][ext]'},
    });
    config.module.rules.push({test: /\.txt$/, type: 'asset/resource', generator: {filename: 'static/media/[name].[contenthash:8][ext]'}});
    if (!isServer) {
      const polyfills = {crypto: 'crypto-browserify', stream: 'stream-browserify', buffer: 'buffer/',
        assert: 'assert/', http: 'stream-http', https: 'https-browserify', os: 'os-browserify/browser',
        path: 'path-browserify', url: 'url/', util: 'util/', vm: 'vm-browserify', zlib: 'browserify-zlib'};
      config.resolve.fallback = {...config.resolve.fallback,
        ...Object.fromEntries(Object.entries(polyfills).map(([key, module]) => [key, require.resolve(module)])),
        fs: false, net: false, tls: false, dns: false, child_process: false};
      config.plugins.push(new webpack.ProvidePlugin({Buffer: ['buffer', 'Buffer']}));
    }
    return config;
  },
  async headers() {
    return [
      {source: '/serviceWorker.js', headers: [{key: 'Cache-Control', value: 'no-cache'}]},
      {source: '/manifest.webmanifest', headers: [{key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate'}]},
    ];
  },
};
