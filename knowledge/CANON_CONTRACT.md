# Author Craft Canon Contract

Status: `v0.1` — public-domain Golden Pack  
HITL: every card ships as `pending_human_review` until Frank accepts it

## Ground truth

1. Public-domain craft texts first (Strunk 1918, Aristotle *Poetics* via Gutenberg).
2. Copyrighted craft books (McKee, Snyder, King, Zinsser, Le Guin, Minto) are **private-cold**. Encode mechanisms only after a purchased copy and HITL — never paste chapters.
3. LLM = compiler, not stylist of record.
4. Arcanea mythos (`CANON_LOCKED.md` elsewhere) is a different canon. Craft cards must not invent lore.
5. Anti-sludge evals are allowed to contain **labeled synthetic** negative examples. Synthetic is never mixed into `rights.license = public-domain`.

## Quote rule

≤90 words, verbatim, Gutenberg URL + SHA-256 of the retrieved HTML.

## What agents must do

- Prefer concrete nouns and verbs over abstract atmosphere
- Treat plot/structure as first-class, character as second (Aristotle), unless the project explicitly inverts that
- Fail a draft that uses the banned sludge lexicon in `evals/anti-sludge.json`

## Validation

```bash
python knowledge/scripts/validate_canon.py
```
