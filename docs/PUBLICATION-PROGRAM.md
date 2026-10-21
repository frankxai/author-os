# Local publication programs

`author-os program` coordinates bounded book tasks and compiles explicitly selected chapter text to an accessible HTML proof. It makes no model calls, runs no remote workers, installs no scheduler and publishes nothing. It adds no backend and leaves the separate EPUB preview work untouched.

## Try the sample

```bash
node bin/author.js program validate templates/publication-program/program.json
node bin/author.js program ready templates/publication-program/program.json
node bin/author.js program compile templates/publication-program/program.json sample-book /tmp/author-proof opening
npm test
```

The sample is synthetic demonstration text. It has no public approval. The compile result is `LOCAL_PROOF_NOT_PUBLISHED` and its HTML has noindex/nofollow metadata. That metadata is not access control; keep private proofs off public hosts.

## Manifest

Schema version is `1`. A program has `id`, `title`, `budget`, `books` and `tasks`. IDs use lowercase letters, digits and hyphens, up to 80 characters.

- `budget`: nonnegative `usd_cap`, integer `tokens_cap` and `verification_reserve` between 0.25 and 1. Caps are declared budgets, not price quotations. No currency conversion or provider pricing is inferred.
- Each book: `id`, `title`, `author`, `language`, ordered `chapters`.
- Each chapter: `id`, `title`, relative `path`, `origin` (`human`, `ai`, `human_ai`), exact content `sha256`, `sources` and `claims` arrays. Historical provider/model identity is not inferred. Extra private fields are not exported.
- Sources: unique `id`, `visibility` (`public` or `private`) and `rights`. Public sources additionally require HTTPS `url` without credentials, query strings or fragments. `cleared` is a recorded rights verdict, not a legal verification by this tool.
- Claims: `id`, `status` (`verified`, `interpretation`, `fiction`, `unresolved`) and `source_ids`. Verified claims require at least one referenced source; metadata alone does not establish truth.
- Tasks: `id`, `book_id`, `role`, `state`, `depends_on`, integer `estimate_tokens` and `estimate_usd`. Roles: research, structure, draft, edit, design, verify, produce. Initial state is `queued`. A task becomes ready only after dependencies finish and reservations fit.

Tasks lock `book:BOOK_ID` by default, so two independent jobs cannot edit one manuscript concurrently. An optional nonempty `resources` array can name finer-grained exclusive scopes such as `chapter:opening` or `evidence:case-one`. Ready listings are candidates, not simultaneous grants; each claim rechecks resources and reservations under the manifest lock. Do not assign different resource labels to jobs that actually share a writable file.

Do not place private manuscripts or real personal source material in this public engine repository. Keep each program beside its source in the author's private project.

## Claims and receipts

```bash
author-os program claim /private/book/program.json develop worker-a 300
author-os program complete /private/book/program.json develop worker-a LEASE_TOKEN 4200 0.35 artifacts/development.md
author-os program fail /private/book/program.json develop worker-a LEASE_TOKEN 500 0.04
author-os program recover /private/book/program.json
```

`claim` returns a random lease token; pass it on completion or failure. A caller may supply a fourth argument to claim as an idempotency token. The lease lasts 30–3600 seconds. A live claim retried with the same worker/token is unchanged. Completed receipts retried exactly are unchanged; different worker, token, artifact or consumption fails. A spent token cannot begin a later attempt.

The estimates reserve capacity across concurrent tasks. Production cannot consume the verification fraction. Completion must remain within its declared task reservation; an overrun is refused rather than silently enlarging the budget. The record is worker-supplied consumption, not provider-verified billing. Unknown actuals must not be represented as zero; retain the task as running or recover it conservatively.

Recovery requeues expired leases but accounts for their full possible reservation with `kind=expired_lease_reservation`. It does not claim the provider actually spent that amount. The reservation remains charged against available budget until an operator reconciles it against actual evidence. A later mixed receipt remains marked as such. This can deliberately stop retries after timeouts. Failed tasks are terminal in this first version; an explicit reviewed program revision is needed to queue another task.

Writes use an exclusive local lock and replace the manifest via a same-directory rename. A crash may leave `.lock`; investigate the running process and file history before removing it. These are same-machine filesystem protections, not a distributed lease service, power-loss transaction guarantee or protection from an operator editing the JSON concurrently. Use isolated worktrees and one coordinating file owner.

## Compiling a selected edition

```bash
author-os program compile /private/book/program.json book-id /private/proofs chapter-2,chapter-1
```

Selection is explicit and order is preserved. Source hashes, traversal and real-path containment are checked. Output is an edition-hash directory with `reading.html` and `edition.json`. The same input produces the same output; missing files can be reconstructed, and a different existing file is never overwritten. The hash identifies inputs, not an author identity. The companion manifest records book identity, selected chapter hashes/origins and source/claim metadata without copying private source locators or chapter filesystem paths.

This first compiler supports plain paragraphs and single-line Markdown headings. Raw HTML and Markdown links/images render as text. It does not implement Markdown tables, footnotes, code highlighting, EPUB, PDF, print preflight, audio or remote media. There are no scripts or remote fonts. The HTML has semantic landmarks, keyboard-accessible chapter navigation, readable width, flexible text and print styles. Real-reader review remains separate.

`--public` additionally requires every selected chapter to carry a pre-existing `public_export` record:

```json
{
  "approved": true,
  "approved_sha256": "content SHA-256",
  "approved_scope_sha256": "approvalScope(book, chapter)",
  "rights": "cleared",
  "attestation_type": "operator_record",
  "reviewed_by": "recorded operator identity",
  "reviewed_at": "actual ISO timestamp"
}
```

The scope hash binds book identity, chapter title/origin/content hash, sources and claims. Do not fabricate an operator decision or use the compiler's successful output to imply human acceptance. Agents must preserve existing authorization evidence; they cannot self-attest human review. The CLI does not create approval records. They are editable metadata attestations, not signatures or verified identities. Public export also refuses private/uncleared sources, unresolved claims and conflicting shared source IDs. These checks cannot detect personal facts deliberately pasted into text, invented sources or a dishonest approval record; inspect the exact package before any public release.

## Search repair included

`author-os search "literal phrase"` now searches local Markdown literally without shell interpolation or a network call. It skips symlinks and returns line numbers. `--semantic` explicitly opts into the existing Python adapter using `search QUERY` as separate arguments. It requires an existing manuscript-scoped `memory/.index/vectors.db`, sets `MEMSEARCH_DB_DIR` to that directory and never falls back silently after an adapter error. Set the same environment directory while indexing. No indexing or embedding call ran during this change.

## Verification

`npm test` retains the existing quality-check self-test and adds real Node tests for graph validity, leases, budget/verification reservation, retries, expiry accounting, private/public boundaries, scope-hash invalidation, source changes, symlink escape, escaping, immutable proof repair, process locking, literal shell payloads and isolated semantic argv. These tests establish implementation behavior, not literary quality, source truth, rights clearance or publication success.
