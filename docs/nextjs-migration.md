# Next.js migration

## Runtime and routing

Next.js 16.4.5 now owns the production build, HTTP server, static files, and API routing. React 18 is retained for the existing MUI and wallet dependencies; Next 16 supports it but emits a deprecation notice. A React 19 upgrade is separate work before moving to Next 17.

The Pages Router entry `src/pages/[[...path]].tsx` loads the current governance interface with `next/dynamic` and `ssr: false`. The existing React Router screens and wallet transaction logic are preserved. This is a framework/build migration, not a rewrite of every screen into Next route components or React Server Components.

Proposal and embedded-proposal requests use `getServerSideProps` to load the existing on-chain preview data and send title, canonical, Open Graph, and Twitter metadata in the initial HTML. Existing cache/fallback behavior is preserved. `/api/proposal-preview` is a compatibility redirect; no server route depends on a static Parcel HTML shell.

`src/pages/api/` exposes the existing API handlers without changing their business logic. The optional catch-all v1 route preserves `/api/v1` and nested paths, query handling, authentication, and limits. Notification endpoints preserve their existing controls. No notification schedule is added.

## Assets, CSS, and environment

- Explicit `?url` imports return image URLs rather than Next's static-image objects. They preserve the header logo, local asset replacements, and the Arweave Gist banner mapping.
- The production build verifies that the active browser chunks reference emitted logo/icon/banner files.
- Global CSS is loaded once in `_app.tsx`. Fonts remain bundled from the existing CSS paths.
- `bin/prepare-next-public.cjs` prepares public assets, icon paths, translations, the web manifest, and a service worker with only its Firebase browser configuration injected. The worker cache namespace changes to purge the old application caches.
- Existing browser-public `REACT_APP_*` variables remain supported. The pre-existing browser-used `APP_GITHUB_CLIENT_ID`, `APP_JUP_API_KEY`, and `APP_SANCTUM_API_KEY` are explicitly supported as well. Never place server secrets in those browser-visible variables. Other server variables are not copied into the client config.
- Vercel Analytics is enabled by default only on Vercel builds. Other hosts can opt in with `NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED=true` when they provide its endpoint.
- Firebase messaging initializes lazily only after checking browser support, so unsupported browsers do not crash the app at import time.

## Deployment

Vercel now uses the `nextjs` framework with `yarn build`. Any project dashboard override that publishes `dist` must be cleared; Next uses `.next` automatically. Existing custom domains and environment variables can be retained. The grant-tracking API keeps its 30-second duration configuration.

For a conventional Node host, run `yarn build` then `yarn start`, with the host's port supplied through `PORT` or `next start -p`. The app needs a server; a static-only export cannot provide API endpoints and server-rendered proposal metadata.

## Checks and limitations

- `yarn build` compiles the production app and verifies emitted image URLs.
- `yarn test` runs the existing regression suite with Node's experimental module mocking enabled. Existing grant-provider tests expecting one key conflict with the unchanged provider fallback implementation.
- `node bin/smoke-next.cjs http://127.0.0.1:3100` checks a running production server: direct client routes, API/auth routing, proposal HTML metadata, compatibility redirect, manifest, worker, and logo. It performs no wallet transactions or notification sends.
- `node bin/smoke-next-client.cjs http://127.0.0.1:3100` boots the compiled client in an isolated DOM harness and checks that the header logo renders without startup exceptions; external service requests are disabled. This supplements, rather than replaces, a real browser/wallet check.
- As with the previous transpile-only build, legacy TypeScript errors are not build-blocking (`typescript.ignoreBuildErrors`). Fixing those across the existing application is separate from this migration.
- Wallet signing and live notification delivery require manual verification with the corresponding browser/account setup. No signed transaction is submitted by the migration checks.

## Verified result

The production Next build and emitted-image check pass. Production HTTP smoke checks pass for direct links, native API/auth routing, proposal and embedded-proposal metadata, rendered PNG preview images, redirects, missing assets, manifest, worker, and SVG logo. The compiled client boots with its logo and navigation present and no startup exceptions in the isolated DOM harness.

The regression suite reports 173 passes and the two independently confirmed, pre-existing grant-provider failures. Frozen-lockfile installation and diff checks pass. The current npm advisory check returned no advisories for Next.js, the newly explicit build/test dependencies, or the six recently patched dependency names.

The browser automation host was unavailable during this migration, so visual browser review and actual wallet signing were not performed. No deployment or domain cutover has been made.
