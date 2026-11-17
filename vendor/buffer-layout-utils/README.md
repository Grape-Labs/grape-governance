# Security-maintained buffer-layout-utils compatibility copy

Based on @solana/buffer-layout-utils 0.2.0 (Apache-2.0, upstream license included).
The published CJS/ESM layouts and TypeScript declarations are retained. This local
version removes the unpatched native bigint-buffer dependency (CVE-2025-3194)
and uses bounds-checked, pure JavaScript bigint conversion instead. There are no
native addons or install scripts. Layout wrappers default omitted offsets to zero,
avoiding ambiguous Buffer.write overloads on current Node releases. The package version suffix identifies the local
modification; it is not an upstream release. All other dependency versions are
resolved by the application's lockfile.
