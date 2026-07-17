# FrankX Book Design → Print → Bind Pipeline

**Date:** 2026-07-16  
**SSOT companions:** `FRANKX-AUTHOR-BRAND-OS-2026-07-16.md`, cover `*.spec.md`, KDP help center  
**Rule:** Master covers are **flat graphic design**. 3D hardcover photos are marketing only.

---

## 1. What bestselling authors actually use (cover “shots”)

| Type | What it is | Where it lives |
|------|------------|----------------|
| **A. Flat front cover (MASTER)** | Pure graphic design 1600×2560 (or higher), big type, one symbol | KDP ebook, web, ads |
| **B. Print wrap (MASTER for paper)** | Back + spine + front + 0.125" bleed | KDP paperback / Ingram |
| **C. Lifestyle mock** | Photo of printed book on desk / hand / shelf | Ads, homepage hero, social |
| **D. 3D render mock** | Photoshop/Blender book standing | Optional ads only |
| **E. Spine + stack series** | Matching spines for shelf brand | Series identity |

**You do not use C/D as the KDP upload.** That was why Book One v1 felt wrong: it was a lifestyle mock pretending to be the master.

### Cover archetypes that sell at thumbnail

1. **Big type + solid field** (Atomic Habits class)  
2. **One object / one mark on void** (Creative Act class)  
3. **Prestige typography only** (Knopf / Mendelsund restraint)  
4. **Series system** (same type + temperature shift per volume)

FrankX series DNA: void cloth field + gold foil Didone + **filament** motif. Book One = cool indigo unbroken filament. Book Two = warm charcoal + practice geometry.

---

## 2. Kindle / KDP technical specs

### Ebook cover (front only)

| Spec | Requirement |
|------|-------------|
| Ideal | **1600 × 2560 px** |
| Ratio | Height/width ≥ **1.6** |
| Color | RGB JPEG/TIFF |
| Size | < 50MB; avoid over-compression |
| Thumb test | Title readable ~100px wide |

Source: KDP ebook cover criteria (Amazon KDP Help).

### Paperback cover (wrap)

| Spec | Requirement |
|------|-------------|
| Formula | **Cover width = bleed + back + spine + front + bleed** |
| Bleed | **0.125" (3.2mm)** on outer edges |
| Spine text | Usually needs **≥ 79–80 pages** |
| Calculator | Always use **KDP Cover Calculator** with exact page count + paper (white/cream) + trim |
| Safe zone | Keep text **≥ 0.125"** inside trim; keep clear of spine fold |
| File | PDF/X preferred for print; flatten transparencies |

### Interior (body pages)

| Spec | Guidance |
|------|----------|
| Trim common | 5×8, 5.5×8.5, 6×9 inches (choose one series-wide) |
| Margins | KDP min depends on page count; design **larger** for prestige (0.75–1" outer) |
| Images | **300 DPI** at print size; CMYK conversion for offset; RGB ok for KDP POD often |
| Fonts | Embed all; body 10–12pt; leading generous for literary |
| Bleed interiors | Only if art goes to edge; +0.125" |

### Binding options

| Binding | Use |
|---------|-----|
| **Perfect bound paperback** | Default KDP / IngramSpark |
| **Hardcover case laminate** | Premium T2 house books |
| **Cloth + foil stamp** | Ultra premium short runs (not pure KDP DIY) |
| **Saddle stitch** | Only short booklets |

Spine width ≈ `pageCount × paperThickness` (calculator, never guess).

---

## 3. Can everything stay Markdown?

| Output | Markdown-first? | Reality |
|--------|-----------------|---------|
| Web reader (frankx.ai) | **Yes** | MD/MDX → Next.js (current) |
| EPUB | **Mostly yes** | Pandoc / softcover / custom pipeline |
| Kindle KPF/MOBI | **Via EPUB** | Kindle Create or KDP convert |
| Print interior PDF | **Yes with engine** | Pandoc + WeasyPrint / Prince / Paged.js / Typst / LaTeX |
| Print cover wrap | **No pure MD** | Needs layout tool or HTML→PDF full-bleed template |
| Foil / cloth physical | **No** | Printer + designer |

**Honest stack:**

```
Markdown (SSOT prose)
   ├─► Web (Next.js books platform)          [already]
   ├─► EPUB (Pandoc)                         [automate]
   ├─► Print interior PDF (Typst or Prince)  [automate]
   └─► Cover masters (Figma/Canva/Affinity + gen backgrounds)
            └─► KDP wrap PDF (template + calculator dims)
```

Markdown is the **manuscript SSOT**. It is not the **print cover SSOT**.

---

## 4. Software map (what you actually need)

### Minimum viable (indie, fast)

| Job | Tool |
|-----|------|
| Prose | Markdown + git (AuthorOS) |
| Flat cover | **Canva Pro** or **Affinity Designer** + generative bg |
| Type-perfect overlay | Figma or Affinity (if gen text mushy) |
| Ebook upload | KDP |
| Print wrap | Canva KDP template **or** Affinity Publisher |
| Interior PDF | **Typst** or Pandoc→PDF |

### Professional / house-grade

| Job | Tool |
|-----|------|
| Cover system | **Adobe InDesign** or Affinity Publisher |
| Brand type | Adobe Fonts / licensed Didone |
| Color | Soft-proof CMYK; printer ICC |
| 3D mock only | Photoshop / Blender / Smartmockups |
| Series bible | Figma library (colors, type, filament token) |

### Agent-native (FrankX)

| Job | Tool |
|-----|------|
| Background concepts | Gemini/NB via `generate-book-cover.mjs` |
| Exact type | Satori/HTML renderer or Figma API |
| Web | Existing books platform |
| QA | Thumbnail script + 30-point visual gate |

**You do not need InDesign on day one.** You need: MD SSOT + flat 1600×2560 masters + one print template + calculator discipline.

---

## 5. Asset pipeline (one book)

```
0. Brief
   title, thesis, imprint, series DNA, trim size, page estimate

1. Cover concept (3 flat variants)
   *.spec.md → generate → human pick

2. Type lock
   if AI type fails QA → overlay exact title/author in Figma/Canva

3. Export masters
   cover-front-rgb-1600x2560.jpg
   cover-front-print-300dpi.tif
   cover-thumb-400x640.jpg
   cover-og-1200x630.jpg
   cover-wrap-kdp.pdf          (when page count known)

4. Interior
   content/books/<slug>/*.md
   → build epub
   → build print PDF (styles: chapter openers, running heads, page #)

5. Mock pack (marketing only)
   hardcover lifestyle, paperback hand, shelf spine trio

6. QA gates
   thumb legibility, claims, voice, 30-pt visual, KDP previewer

7. Publish
   T1: web + email PDF
   T2: KDP/Ingram + house edit
```

### Folder convention

```
public/images/books/
  <slug>-cover.jpg              # MASTER web/ebook
  <slug>-cover.spec.md
  <slug>-cover-v2.jpg           # alts
  <slug>-cover.LEGACY.*         # retired

print/<slug>/
  interior.pdf
  wrap.pdf
  kdp-calculator.json           # page count, trim, paper, spine in
  checklist.md
```

---

## 6. Series production batch (next 14 days)

| Day | Output |
|-----|--------|
| 1 | Lock Book One flat master (filament) — **done path** |
| 2 | Align Book Two type system to same Didone/gold |
| 3 | Secrets + Golden Age flat rebuilds |
| 4 | Typst/Pandoc interior style for Wordless |
| 5 | EPUB build script |
| 6–7 | KDP calculator + wrap template once page count frozen |
| 8–10 | Voice + scar pass remaining Wordless chapters |
| 11–12 | Series landing + homepage already curated |
| 13–14 | Mock pack + email PDF redesign |

---

## 7. Binding & print vendors (when T2)

1. **KDP** — POD, slow quality, fine for test  
2. **IngramSpark** — better bookstore path  
3. **Short-run offset / local EU printer** — cloth + foil for flagship (Golden Age / Wordless box)  
4. Always order **physical proof** before campaign spend  

---

## 8. Non-negotiable QA

- [ ] Flat master, not 3D book photo  
- [ ] Title legible at 100px width  
- [ ] Series temperature grammar holds  
- [ ] No unreadable foil-on-dark at thumb  
- [ ] Interior margins pass KDP previewer  
- [ ] Spine width matches calculator  
- [ ] Claims + Oracle disclaimer where needed  
- [ ] Voice guardian clean  

---

*Part of FrankX Author Brand OS / AuthorOS publishing layer.*
