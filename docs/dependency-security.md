# Dependency security status — October 3, 2026

The root `package.json` resolutions and active `yarn.lock` apply these updates:

| Package | Resolved version | Status |
| --- | --- | --- |
| `@fastify/busboy` | 3.2.2 | Fixes prototype-named multipart header denial of service (GHSA-x8mw-p69m-v3mx). |
| `@grpc/grpc-js` | 1.14.5 | Fixes certificate authorization and malformed-message advisories (GHSA-m9gg-hp2v-232j, GHSA-5375-pq7m-f5r2, GHSA-99f4-grh7-6pcq). |
| `brace-expansion` | 2.1.7 | Fixes nested-group and comma-parser stack exhaustion, plus quadratic expansion (GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p, GHSA-q2hr-2g5m-vwhr). |
| `braces` | 3.0.3 | Fixes older resource exhaustion (GHSA-grv7-fg5c-xmjg); newer issue remains below. |
| `http-cache-semantics` | 4.2.0 | Removes the old 3.8.1 ReDoS exposure (GHSA-rc47-6667-2j5j); newer issue remains below. |
| `node-forge` | 1.4.0 | Already pinned to the latest published version; newer issue remains below. |

## Unresolved advisories

GitHub's public advisory data and npm release metadata list no patched release
for these issues as of the date above:

- [`http-cache-semantics`, GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp):
  cross-user cache disclosure through `max-stale`; affects all versions through 4.2.0.
- [`braces`, GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm):
  stack exhaustion from deeply nested patterns; affects all versions through 3.0.3.
- [`node-forge`, GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv):
  RSA signature verification accepts extra nested DigestAlgorithm elements;
  affects all versions through 1.4.0.

These upgrades do not resolve or justify dismissing those three alerts. Closing
them requires a future upstream fix or replacement of the affected dependencies.
The repository-specific Dependabot pages were inaccessible in this environment;
version ranges were checked against the public GitHub Advisory API instead.
