# Archive extraction compatibility adapter

The xNFT CLI uses `download@7`, which requires the unmaintained CommonJS
`decompress` package. The root Yarn resolution routes that import through this
adapter to `@xhmikosr/decompress@10.2.2`, preserving its promise-based API.
Node.js 18 or newer is required.

The maintained extractor fixes CVE-2026-101894:
https://github.com/XhmikosR/decompress/security/advisories/GHSA-hrh2-vp3x-79xf

The local version identifies this adapter; it is not an upstream release.
Remove the adapter when the CLI no longer depends on the legacy extractor.
