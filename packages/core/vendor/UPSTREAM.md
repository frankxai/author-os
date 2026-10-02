# Markdown renderer provenance

`markdown-it.cjs` is the unchanged browser UMD bundle
`package/dist/browser/markdown-it.umd.min.js` from published markdown-it 15.0.2.
It is renamed for CommonJS loading. No parser was forked or generated here.

- Release: https://registry.npmjs.org/markdown-it/-/markdown-it-15.0.2.tgz
- Registry SHA-512 integrity: `sha512-q4IGxMv56jCqT4OCRCADBoDP3LO4MhmTXjFbphHPXs4g3j9Xg5RDnxqN8IF/3vIWEU+VCnUq+7JUg/cfy2E6Qw==`
- Bundle SHA-256: `635972b985228e8af9f0143647c68616b7a3bb09f6946e7e4a52e43dcf5e7be5`
- Upstream tag revision: `3c51991c32aaa2b002a52c009334ebe5752c84b3`.
- Official API: https://markdown-it.github.io/markdown-it/

The accompanying notices preserve markdown-it's MIT license and the upstream
lock's entities 8.0.0 (BSD-2-Clause), linkify-it 6.1.0, mdurl 2.1.0,
punycode.js 2.3.1, uc.micro 3.0.0 (MIT), and argparse 3.0.0 (Python-2.0).
These are conservative upstream dependency notices, not an assertion that the
CLI-only argparse is present in the browser bundle. Dependency versions come
from the upstream tag lock, not an independently reconstructed bundle build.

The published archive integrity was checked before extracting the bundle.
The core regression suite checks its exact SHA-256. This vendored release lets
the existing dependency-free core and local CLI render Markdown without a new
package install or changing the preview branch's lockfile. Upgrades require
fresh provenance, notices and rendering/security tests.
