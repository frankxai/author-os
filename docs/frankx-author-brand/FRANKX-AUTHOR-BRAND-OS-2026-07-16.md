# FrankX Author Brand OS — Iconic Books Plan
**Date:** 2026-07-16  
**Status:** operating plan (site link fixes + cover system + craft doctrine)  
**Repos:** frankx.ai books · AuthorOS · frankx.ai-vercel-website  
**Owner:** Frank Riemer · agent execution via AuthorOS + FrankX production site

---

## 0. Immediate diagnosis — why two Wordless Laws URLs?

### Intentional product design (not a bug in existence)

| URL | Role |
|-----|------|
| `/books/the-wordless-laws` | **Book One — Concealed.** Twelve forces shown through story; never named. Reader discovers. |
| `/books/the-wordless-laws-book-two` | **Book Two — The Practice.** Names every force, tradition + science, practice + DIY experiment. |

Registry truth: `frankx.ai-vercel-website/app/books/lib/books-registry.ts` (entries ~715–816). Live titles match this design.

This is a **series architecture** (mystery → mastery), not a duplicate page.

### What *is* broken / weak (homepage + packaging)

1. **Homepage only shows first 6 registry books with covers**  
   `app/page.tsx` → `getPublishedBooks().filter(cover).slice(0, 6)`.  
   Registry order leads with older flagships (Golden Age, Love & Poetry, Spartan, etc.). **Wordless Laws 1 & 2 do not appear on homepage** unless they climb into the first six.

2. **No series UX**  
   Book One and Book Two pages do not cross-link as a pair (“Start with Book One → Continue to Book Two”). Visitors landing on either URL feel like they found two disconnected books.

3. **Books hub copy is stale**  
   `/books` still says **“Six Books. One Voice.”** while registry ships many more published titles (Wordless, Secrets, Arcanea line, Fable, Great Transition, etc.).

4. **Covers fail the iconic test**  
   Current `the-wordless-laws-cover.png` and `…-book-two-cover.png` are **480×720 pure light-orbs** — no typography, no series mark, no material luxury. Classic AI wallpaper. Unreadable at thumbnail; unusable as brand assets.

5. **Nav discovery**  
   Main nav emphasizes Music / GenCreators / Learn / Build / Explore / Blog. Books are a homepage section + `/books`, not a first-class rail. Series gets buried.

### Fix pack (engineering — small, high leverage)

| Priority | Change | File(s) |
|----------|--------|---------|
| P0 | Curated `homepageFeaturedBooks` (not blind slice) — include Wordless pair + Golden Age + Fable or Secrets | `app/page.tsx`, new `data/homepage-featured-books.ts` |
| P0 | Series block on both Wordless pages: Book 1 ↔ Book 2 | `app/books/[bookSlug]/page.tsx` + registry `series` field |
| P0 | Replace hub hero copy: stop “Six Books” → dynamic count + series framing | `app/books/page.tsx` |
| P1 | Ship new covers from specs (1600×2560) + optional Satori text overlay | `public/images/books/*-cover.spec.md` + `generate-book-cover.mjs` |
| P1 | Canonical series landing `/books/the-wordless-laws-series` (optional) with both covers | new page |
| P2 | Nav: Learn dropdown → “Books & Writing” | site nav config |
| P2 | Journal sync strip: “Written in public · /journal + AuthorOS cockpit” | book layout footer |

---

## 1. Positioning — who Frank is on the shelf

### One-line positioning

> **Frank Riemer builds agentic operating systems for a beautiful human future — and writes the field manuals, poems, and practices so people he loves can run them.**

### Category of one (not “another self-help AI guy”)

| Pole | Steal from | Frank’s twist |
|------|------------|---------------|
| **Beautiful future** | Dario Amodei — *Machines of Loving Grace* | Concrete upside of powerful AI (biology, mind, economy, peace, meaning) **plus lived agent systems you can inspect** |
| **New Rich / experiments** | Tim Ferriss | Lifestyle design **agentically driven**: RPM-style outcomes + personal AI CoE, not just 4HWW hacks |
| **Holistic human OS** | Tony Robbins (RPM, state, body/mind/emotion/business) | Same whole-person scope, **less stadium rhetoric**, more engineering + poetry |
| **Blunt truth** | Mark Manson | Anti-slop honesty; kill empty manifestation clichés; name tradeoffs |
| **Creator business clarity** | Pat Flynn | Transparent builds, free-first teaching, products that trust |
| **Existential AI depth** | Nick Bostrom (adjacent; not “Nick Rubin”) | Risk literacy without doomer cosplay; pair with Amodei-style constructive vision |
| **Craft of making** | Rick Rubin *The Creative Act*, Pressfield, Bayles & Orland | Daily creative process as sacred + shippable |
| **Systems elegance** | Donella Meadows, James Clear (habit systems not hustle porn) | Agentic loops, feedback, evidence journals |

**Also recommend adjacent voices for craft study:**  
Cal Newport (deep work), Annie Duke (decision quality), Naval (leverage), Derek Sivers (briefness), Austin Kleon (show your work), Mary Oliver / Rilke (poet spine), Yuval Noah Harari (civilizational framing — sparingly), Mustafa Suleyman (containment + institutions), Francois Chollet / research essays (intelligence nuance).

### The FrankX author triangle

```
        MACHINES OF LOVING GRACE
         (civilizational upside)
                  ▲
                  │
   NEW AGENTIC RICH ─────── HOLISTIC HUMAN RPM
   (Ferriss × agents)       (Robbins × body/mind/soul/biz)
                  │
                  ▼
            POET + MAKER
     (music, Arcanea, daily process)
```

Every flagship book should sit on **at least two vertices**. Pure manifestation books without systems, or pure tech books without soul, are off-brand.

### Voice law (anti-AI-generic)

Steal from site voice + raise the bar:

1. **Show, don’t sermonize.** Numbers, scenes, experiments, receipts.
2. **First person with skin in the game.** Magdeburg B.A. (macro/micro, game theory, cashflow, law), Oracle AI architecture, music, family, agents in the open.
3. **Name the source.** Hill, James, Buddhist/Stoic roots, lab science — then **test it**.
4. **Kill the thesaurus glow.** Banned energy: “delve,” “tapestry,” “in today’s rapidly evolving,” “embark,” “unlock your potential,” purple gradient metaphors without objects.
5. **One sharp sentence per page that only Frank would write.**
6. **Poetry earns its place** — never wallpaper.

---

## 2. Library architecture — hundreds of books without generic sludge

### Three publishing tiers (non-negotiable)

| Tier | Name | % of output | Gate | Surface |
|------|------|-------------|------|---------|
| **T0** | **Field Notes / Open Lab** | ~70% | Voice + truth only | free web, `/journal`, blog, public drafts |
| **T1** | **Studio Books** | ~25% | AuthorOS 7-pass + integrity-guard | free online books + PDF lead magnet |
| **T2** | **House Books** | ~5% | Human editor + design + marketing squad + legal | paid print/ebook via publishing house or premium imprint |

**Rule:** Agents may draft widely. **Only T1/T2 get covers, ads, and “I wrote a book” identity claims.** T0 is compost and proof of life.

### Six imprints (series lines)

1. **Loving Grace Tech** — civilizational AI upside + architecture (*Golden Age*, *Fable*, *Great Transition*, CoE books)  
2. **Wordless / Practice** — concealed wisdom → named practice (*Wordless Laws* 1–2, future Books 3+ experimental logs)  
3. **Maker’s Secrets** — craft of shipping (*Book of Secrets*, music production, design)  
4. **Human OS** — body, mind, emotion, capital, circle, legacy (Self-Development pillars; Velora/fitness crossover)  
5. **Arcanea** — mythic creative universe (canon-locked; separate design language)  
6. **Poetry & Hope** — *Hoffnung*, Fire Horse, love books — the poet spine

### Curriculum map from your degree + life (book farm, not random list)

Map modules → book seeds (T0 first, promote winners):

| Domain | Example T0 → T1 titles |
|--------|-------------------------|
| Macro / globalization | *The Great Transition* (exists); *Currency of Attention*; *Sovereign Small Nations of One* |
| Micro / game theory | *Payoff Tables for a Good Life*; *Cooperation Under Agents* |
| Cashflow / portfolio | *Agentic Money OS* field manual; *Personal Balance Sheet of Meaning* |
| Business law / entities | *Contracts for Creators*; *ZZP → BV as Life Design* (NL-specific) |
| Human behavior | *The State That Attracts* (already Book Two chapter) expanded |
| Mathematics of leverage | *20 Watts*; *Compounding Non-Linear Lives* |
| Music + creative process | daily journal → *The Making* |
| Agentic OS / multi-agent | *Personal AI CoE*; *Swarm of One* |

**Promotion rule:** A T0 note becomes T1 only after 30 days of public use, 1 real experiment log, and a non-AI human reader score ≥8/10 on “felt like Frank.”

---

## 3. Writing craft OS — learn from the best, implement as agents

### Study canon (read with Library OS, not vibes)

| Author | Steal this mechanism | Agent skill name |
|--------|----------------------|------------------|
| Tim Ferriss | DE/experiment design, “minimum effective dose,” interviews as research | `ferriss-experiment-frame` |
| Tony Robbins | RPM (Result–Purpose–Massive action), state management, holistic pillars | `rpm-chapter-engine` |
| Mark Manson | Contrarian thesis first, values via subtraction, humor as truth serum | `manson-cut` |
| Pat Flynn | Transparent numbers, audience-first product, teach what you just did | `flynn-transparency` |
| Dario Amodei | Concrete scenarios, 5–10y timelines, anti-grandiosity + real upside | `loving-grace-scenario` |
| Rick Rubin | Reduce until only essence; environment as instrument | `rubin-reduce` |
| James Clear | Atomic units, identity-based habits | `atomic-unit` |
| Annie Duke | Decision quality vs outcome quality | `duke-decision` |
| Derek Sivers | Cut 50% after you think you’re done | `sivers-half` |

### Seven-Pass Revision Ritual (T1/T2 only)

1. **Structure** — argument spine / scene spine  
2. **Evidence** — sources, experiments, numbers  
3. **Voice** — Frank voice guardian (banned phrases)  
4. **Human scar** — add lived scene only Frank has  
5. **Cut** — Sivers half + Manson cliché purge  
6. **Music** — read aloud; rhythm, line breaks, silence  
7. **Maker≠checker** — different model/human signs off  

Wire into AuthorOS: `docs/AUTHORING_TEAM_OPERATING_SYSTEM.md` + cockpit.

### Chapter template (flagship nonfiction)

1. **Cold open scene** (concrete)  
2. **Named tension** (one sentence)  
3. **Old map / why it fails**  
4. **New mechanism** (diagram-worthy)  
5. **Experiment (≤7 days)**  
6. **Receipt / failure modes**  
7. **One line the reader keeps**

Wordless Book One may omit names; Book Two must include practice + experiment.

---

## 4. Cover & brand system — make you iconic

### Diagnosis of current covers

- Abstract orbs, no type → look like Midjourney defaults  
- 480×720 too small  
- No series grammar between Book One / Two  
- Homepage thumbnails unreadable  

### FrankX Book Cover System (FBC)

**Material language:** matte cloth void `#0a0a0b` / series temperature shift  
**Accent:** gold foil `#C9A84C` + filament `#E8B85C`  
**Type:** Didone for flagship titles; never random AI fonts  
**Law:** Background can be generative; **final title/author text is deterministic overlay** (Satori/HTML) if gen text fails  
**Size:** 1600×2560 minimum  
**Series spine:** one filament motif; Book N marked in small caps  

Specs written:

- `public/images/books/the-wordless-laws-cover.spec.md`  
- `public/images/books/the-wordless-laws-book-two-cover.spec.md`  
- Existing gold standard: `golden-age-of-intelligence-cover.spec.md`  

Render path:

```bash
# from frankx.ai-vercel-website
node scripts/generate-book-cover.mjs the-wordless-laws --variant 1
node scripts/generate-book-cover.mjs the-wordless-laws-book-two --variant 1
# if text mush: generate background-only + Satori title card
```

**30-point visual gate:** ship ≥26. Orbs alone = automatic restart.

### Brand marketing “genius team” (roles, not headcount)

| Role | Job | Agent / human |
|------|-----|----------------|
| Publisher | tier gate T0/T1/T2 | Frank + AuthorOS router |
| Series architect | imprint map, reading order | strategy agent |
| Ghost craft lead | draft + 7-pass | book team |
| Voice guardian | ban list + score | `voice-guardian.py` |
| Visual director | covers, series DNA | brand-image-system |
| Editor (human) | T2 only | publishing house |
| Marketing lead | positioning, Dream100, launches | frankx content strategy |
| Distribution | free web, email PDF, retail | growth agent + human |
| Integrity guard | claims, legal, Oracle disclaimer | existing `@integrity-guard` |
| Journal sync | daily process → book compost | cron + `/journal` |

---

## 5. Open free vs publishing house

### Default: open core books

- Full text free online on frankx.ai  
- Email gate for designed PDF/EPUB  
- Transparent “how this was written” footer: swarm roles, models, human edits, date  

### House launch criteria (all required)

1. 90-day public draft performance (saves, email, completion)  
2. Human developmental edit complete  
3. Cover ≥26/30 + print spine mock  
4. Claims audit green  
5. Marketing narrative (who, transformation, proof)  
6. Budget + distribution plan signed by Frank  

Until then: stay T1 free, compound trust.

---

## 6. Journal + repo sync (creative process as asset)

### Surfaces

| Surface | Role |
|---------|------|
| `frankx.ai/journal` (or field notes / chronicle) | public daily process |
| Private repos + AuthorOS memory | raw + canon |
| `content/books/*` | T1 manuscripts |
| Queen reports / cockpit | production state |
| Music / Suno rituals | sonic twin of prose |

### Agent loop (daily)

1. Capture: sessions, commits, voice notes, music  
2. Distill: 1 insight + 1 scene + 1 experiment  
3. Route: which imprint / which open draft  
4. Weekly: promote or kill  
5. Monthly: cover + hub refresh for anything promoted  

---

## 7. 90-day execution roadmap

### Days 1–14 — Trust & packaging

- [ ] Ship homepage featured books (include Wordless pair)  
- [ ] Series cross-links Book One ↔ Two  
- [ ] Fix `/books` hub copy (dynamic count)  
- [ ] Render new covers from specs; replace orbs  
- [ ] Add “How this book was made” strip to Wordless  

### Days 15–45 — Craft elevation

- [ ] Voice-guardian pass on Wordless 1+2 + Golden Age  
- [ ] Add Ferriss-style experiment boxes to every Book Two chapter (if missing)  
- [ ] One Amodei-grade essay: *Machines of Loving Grace, Practiced* (bridge essay, not clone)  
- [ ] Journal → weekly “from the studio” digest  

### Days 46–90 — Identity lock

- [ ] Public Author Brand one-pager on site (`/writing` or `/books/about`)  
- [ ] Select 1 T2 candidate (likely Golden Age or Wordless pair as box set)  
- [ ] Dream100 outreach list for advance readers  
- [ ] AuthorOS cockpit shows live book pipeline statuses  

---

## 8. Success metrics

| Metric | Target 90d |
|--------|------------|
| Homepage → book CTR | measurable baseline + uplift after featured fix |
| Wordless Book One start rate | ↑ after series UX + cover |
| Email PDF converts | quality list growth |
| “Felt human / not AI” blind scores | ≥8/10 on 10 readers |
| Cover QA | ≥26/30 on flagships |
| T2 readiness | 1 manuscript at house gate |

---

## 9. Explicit non-goals

- Do not publish 100 thin AI books for catalog spam  
- Do not clone Amodei essay voice — **pair** his constructive specificity with your lived systems  
- Do not put Arcanea mythos covers on Wordless / Golden Age  
- Do not claim publisher prestige without human editorial  

---

## 10. Next agent actions (copy-paste)

```text
1. Implement homepage featured books + series links (prod repo frankx.ai-vercel-website).
2. node scripts/generate-book-cover.mjs the-wordless-laws --variant 1
3. node scripts/generate-book-cover.mjs the-wordless-laws-book-two --variant 1
4. Visual QA covers; overlay type if needed.
5. Voice-guardian + human scar pass on invitation.md + introduction.md.
6. Draft /books hub redesign copy (imprints, not “six books”).
```

---

*This document is the SSOT seed for FrankX author brand work inside AuthorOS. Site code SSOT remains `frankxai/frankx.ai-vercel-website`.*
