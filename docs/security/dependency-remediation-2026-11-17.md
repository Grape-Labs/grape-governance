# Dependency security remediation — 2026-11-17

## Changes

Updated package.json and regenerated yarn.lock with Yarn 1.22.19. Security resolutions keep transitive copies on patched versions. The ws 7.x consumers remain on patched 7.x; ws 8.x remains on 8.x. The legacy cross-spawn 5.x consumer moves to the patched 6.x API, with 7.x consumers retained on patched 7.x. Old glob 7/8 API consumers retain their API; affected glob 10 consumers move to patched glob 14.0.6 through parent-specific resolutions.

Notable resolved versions:

| Package | Resolution |
| --- | --- |
| tar | 7.5.23 |
| @solana/web3.js | 1.98.4, including transitive copies |
| gh-pages | 6.3.0 |
| ws | 7.5.14 / 8.23.0 |
| fast-loops | 1.1.4 |
| elliptic | 6.6.1; separate unpatched advisory below |
| micromatch | 4.0.8 |
| cross-spawn | 6.0.6 / 7.0.6 |
| nanoid | 3.3.20 |
| bigint-buffer | Removed from dependency graph |
| @babel/runtime | 7.29.14 |
| base-x | 3.0.11 / 4.0.1 / 5.0.1 |
| formidable | 3.5.4 |
| pbkdf2 | 3.1.7 |
| tiny-secp256k1 | 1.1.7 |
| form-data | 3.0.5 / 4.0.6 |
| tmp | 0.2.7 |
| cipher-base | 1.0.7 |
| sha.js | 2.4.12 |
| min-document | 2.19.2 |
| glob (affected consumers) | 14.0.6 |
| mdast-util-to-hast | 13.2.2 |
| jws | 4.0.1 |
| qs | 6.17.1 |
| @remix-run/router | 1.23.4 |

The report's minimum tar 6.2.1 and ws 8.17.1 do not address the newer advisories. The selected versions account for these later fixes as well.

## Removing unpatched native bigint-buffer

web3.js 1.98.4 no longer depends on bigint-buffer. The remaining user was @solana/buffer-layout-utils 0.2.0. vendor/buffer-layout-utils preserves its published layouts, CJS/ESM entrypoints, types, and Apache-2.0 license, while replacing native bigint conversion with bounds-checked JavaScript. There are no native addons or install scripts. The local version suffix explicitly marks this as a modified copy. The package is included in the application's npm files list.

Integer codecs round-trip unsigned 64/128/192/256-bit boundary values and reject negative and overflowing values. Both module formats are tested. Omitted layout offsets default to zero to avoid current Node Buffer.write overload ambiguity.

## Remaining advisory (not suppressed)

A public npm bulk advisory check of the reported package names and their resolved versions returns one additional advisory: elliptic GHSA-848j-6mx2-7j84 / CVE-2025-14505, low severity, affecting all published elliptic versions through 6.6.1. No upstream patched version exists. The reported older critical elliptic versions were removed, but this separate advisory remains. Eliminating it requires replacing elliptic-dependent SDKs or separately reviewing a cryptographic implementation change. This update does not claim that the dependency graph is vulnerability-free.

https://github.com/advisories/GHSA-848j-6mx2-7j84

## Validation

Regression checks cover the reported vulnerable versions in every lockfile entry, Solana transaction signatures, SPL token encoding beyond JavaScript's safe-integer limit, bigint layouts in CJS/ESM, ECDSA compatibility, PBKDF2 vectors, process spawning, temporary directory cleanup, tar extraction/traversal rejection, glob matching/cancellation, JWT, HTTP handling, protobuf, Joi, forge, and source maps.

The full suite has two failures in tests/grant-provider.test.mjs: the tests expect backup Helius keys to be ignored, whereas the existing unchanged provider implementation accepts them. Those source/test files were not modified by this dependency update. Both failures were separately reproduced from the unchanged HEAD source and tests in /tmp.

Final clean-install verification: `yarn install --frozen-lockfile --ignore-scripts --offline` succeeded. The complete suite ran 228 tests: 226 passed and the same two unchanged grant-provider tests failed. No vulnerable bigint-buffer entry remains in yarn.lock, and the clean installation contains one web3.js version, 1.98.4. Installation lifecycle scripts were intentionally disabled; archive, crypto, SDK, HTTP, and process compatibility were exercised separately.

Production build (`npm run build`) passed against the clean installation, including emitted client-asset checks.
