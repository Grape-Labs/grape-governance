# Dependency security update

The reported packages are patched or removed in `yarn.lock`. Regression checks are in `tests/dependency-security.test.cjs`.

- Removed the legacy `@coral-xyz/xnft-cli` development dependency and its three `xnft-*` scripts. This removes `git-clone` (no patched release) and the obsolete `download`/`got` chain. Normal Parcel build scripts remain available.
- Updated JSDoc to 4.0.5 to remove `taffydb`, and resolve-url-loader to 5.0.0 to remove PostCSS 7. PostCSS 8, JSON5 2, GraphQL 16, socks, and semver were refreshed within compatible ranges. The updated socks dependency removes `ip` entirely.
- Pinned patched transitive versions in `resolutions`, including Axios 1.21.0, JSON Web Token 9.0.3, Undici 6.29.1, and Webpack 5.112.2. These include major upgrades required by legacy consumers; authentication and HTTP smoke tests exercise their public interfaces. Full integration with external services still requires runtime validation.
- Kept node-fetch 3 for its existing consumer and scoped node-fetch 2 fixes to cross-fetch. Kept newer tough-cookie consumers on their own major version.
- Vendored decode-uri-component 0.5.1 with its MIT license and only a CommonJS export conversion. The upstream release is ESM; existing query-string consumers require a synchronous CommonJS function. Tests cover malformed input, long encoded input, and query-string integration.
- Updated the Parcel packages together from 2.10.0 to 2.16.4 because the old resolver rejects `main: false` metadata in newly resolved dependencies. Added the required `vm-browserify` and `assert` polyfills explicitly and refreshed `crypto-browserify` to the supported patch. Disabled scope hoisting on both production targets to avoid a bundle-graph stack overflow with this dependency graph.
- Retained the local decompress adapter as an explicit development dependency so its existing archive-security tests continue to run after removal of the xNFT download helper.

## Verification

The npm bulk advisory endpoint reports no advisories for the 26 package names supplied in the issue. Yarn's audit endpoint returned HTTP 500, so npm's current advisory data was checked directly against all locked package versions. This is not a clean repository-wide audit: 80 other package names remain flagged and require separate dependency modernization.

The test command is `node --test --experimental-test-module-mocks tests/*.test.cjs tests/*.test.mjs`. Two grant-provider tests fail identically with the original HEAD versions of both the tests and provider implementation; they expect single-key behavior while the current implementation uses fallback keys.

Final checks: 157 tests pass, with the two independently reproduced pre-existing failures above. Both client and server production bundles pass with scope hoisting disabled. Frozen-lockfile installation and `git diff --check` pass.

Use a clean Parcel cache after the toolchain upgrade. Cache reuse caused native crashes during verification; clean-cache builds completed successfully. The standard client build script already cleans `.parcel-cache`.
