# course-template

A copyable starter for a **study-companion** course repo. It contains the three
thin files, a `content/` folder with an annotated `course.yaml` and one worked
example section per archetype, and a `public/` with a minimal canvas simulation —
everything a course needs and nothing more.

## Create a course from it

```bash
npx degit MartinSA04/StudyCompanion/course-template course-mycode
cd course-mycode
pnpm install
pnpm dev
```

Then:

1. Edit `package.json` → set `name` and pin the framework tag. Use the **newest**
   `vX.Y.Z` tag, and keep it current — bump it to pick up new widgets and fixes.
2. Set `site` in `astro.config.mjs` to your public origin (needed for the
   canonical link, social cards and the sitemap).
3. Edit `content/course.yaml` → identity, accent, `courseUrl`, `institution`,
   exam, formulas, glossary.
4. Replace the example sections under `content/sections/` with your modules.
5. Drop your favicon, figures, sims and any vendored exam PDFs into `public/`.

## Local framework development

To author against a local checkout of the framework instead of a pinned tag,
swap the dependency in `package.json`:

```jsonc
"study-companion": "link:../study-companion"
```

## Where the guidance lives

- **`CLAUDE.md`** (here) — the rules + workflow for an authoring agent.
- **`AUTHORING.md`** (framework repo) — the full author's guide: archetypes,
  widget decision guide, conventions, and the per-section definition-of-done.
- **`README.md`** (framework repo) — the widget/`course.yaml` reference.
- **`SECTION-BRIEF.md`** (here) — a one-pager to plan each module before writing.
