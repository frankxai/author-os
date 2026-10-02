# Local text EPUB reading proof

From an AuthorOS project, run:

```sh
node /path/to/author-os/bin/author.js export epub
```

The command consumes the existing saved graph, or the normal `chapters/`
workflow. Local MCP `export_book` with `format: "epub"` uses the same implementation
and returns structured refusals for invalid/unsupported source. The existing
`export_epub_manifest` no longer reports success for an empty chapter spine.
The file workflow also reads `title`, `author` and `language`
from `authoros.json`. It produces an actual EPUB 3 ZIP with package metadata,
ordered chapters, linked contents, language labels and a reflowable stylesheet.
Emphasis, headings, lists, quotations, code and web/mail links use the pinned
Markdown renderer. Raw HTML is displayed as text. Same-chapter heading anchors
must resolve; relative cross-file links and images are refused explicitly.
This text exporter does not bundle fonts, images, covers, audio or scripts.

`output/book-<full edition SHA-256>.epub` and its `.source.json` receipt identify
the source files, hashes, filesystem timestamps, renderer, output checksum and
requested approval. Source timestamps supply EPUB's modified metadata. Touching
a source file therefore changes its snapshot identity even if its text is equal.
The source graph and Markdown files are never written by this EPUB command.
The Markdown command keeps its existing audit behavior; `publish epub` retains
the separately documented Pandoc path.

Rerunning unchanged inputs produces identical EPUB bytes and the same receipt.
Changing a source produces a distinct edition; earlier editions remain available.
Existing files with different bytes are refused, preserving manual replacements.
Writes use exclusive temporary files and an atomic no-overwrite hard link.
If the process stops after the EPUB but before its receipt, rerunning repairs the
receipt. Disk-full or unsupported hard links fail without replacing prior output.
Temporary files left by an abrupt process kill are not automatically deleted.
Filesystem power-loss durability and concurrent author edits after the final
source check are not transactionally guaranteed.

No edition is labelled current, published or approved by this path. A completed
file is an internal reading proof. EPUBCheck, two real readers, images/fonts,
accessibility certification, rights, editorial approval and distribution remain
the issue #2 acceptance gates. This patch does not close that issue or Arcanea's
release #280. The core package builder requires a stable identifier and an
explicit source timestamp; it does not insert the current time.

## Verification

```sh
node packages/core/tests/run-tests.js
node packages/core/tests/epub-tests.js
node packages/local/tests/epub-tests.js
```

The EPUB-specific tests verify stored ZIP entries/CRC/central directory,
metadata, navigation order, Markdown rendering, escaping, Unicode, input
immutability and denial cases. The local suite runs the real CLI, changes a
source, preserves old editions and tests interrupted receipt recovery.
These checks do not substitute for an EPUBCheck or reader verdict.
The PR workflow additionally generates the existing public sample graph's text
edition and checks it with EPUBCheck 5.4.0. Its official release archive is
SHA-256 pinned. A successful run establishes conformance for that sample at the
run's revision, not every manuscript, a real-reader result or accessibility
certification. The internal Arcanea edition is not uploaded by this workflow.

The alternative is the existing Pandoc CLI workflow, with its richer format
support. Pandoc is unavailable on the bounded local machine, so a fair timed
comparison and operator-effort claim are pending. This patch reuses the shared
AuthorOS kernel instead of introducing an Arcanea-specific publishing engine.
It depends on unmerged `codex/author-os-preview` at
`30d90432d84c526315985d806cd938c726b4271d`. Review the delta against that parent;
it does not approve or release the full preview product.
