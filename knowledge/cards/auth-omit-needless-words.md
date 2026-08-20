---
id: auth-omit-needless-words
type: mechanism
domain: author
license: public-domain
public_ok: true
hitl_status: pending_human_review
source:
  title: The Elements of Style (Strunk)
  url: https://www.gutenberg.org/files/37134/37134-h/37134-h.htm
  retrieved: "2026-08-21"
  sha256: "10f45203f74e12d572b7f8015fc940804f9161b764449d082010e2f1c100ff70"
  quote: >-
    Omit needless words. Vigorous writing is concise. A sentence should
    contain no unnecessary words, a paragraph no unnecessary sentences,
    for the same reason that a drawing should have no unnecessary lines
    and a machine no unnecessary parts. This requires not that the writer
    make all his sentences short, or that he avoid all detail and treat
    his subjects only in outline, but that he make every word tell.
failure_modes:
  - Cutting sensory detail in the name of brevity
  - Padding with throat-clearing clauses (“it is important to remember that”)
agent_directive: >-
  Flag filler openers and duplicate modifiers. Do not delete concrete
  detail that carries plot or character. Score concision by wasted words,
  not by sentence length.
---

# Every word must tell

Strunk’s rule 13 is an engineering metaphor: no spare parts. He
explicitly **rejects** “make all sentences short.”

**Agent use:** line-edit passes should delete empty stems, not flatten
rhythm. Pair with `evals/anti-sludge.json`.
