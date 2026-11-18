# Copilot instructions

Personal blog (hamzamasood.dev) built on the `multiterm-astro` theme: Astro 5 static
site, Tailwind CSS v4, MDX, Expressive Code, Pagefind search, deployed to GitHub Pages.

## Commands

```bash
npm run dev       # local dev server (Pagefind search is disabled in dev)
npm run build     # astro build + postbuild `pagefind --site dist`
npm run preview   # serve dist/ (use this to test search, social cards, RSS)
npm run format    # prettier --write .
npx astro check   # type-check .astro/.ts (no separate lint or test suite exists)
```

There is no test framework. "Verifying a change" means `npm run build` succeeding, plus
`npm run preview` for anything touching search, social cards, or theming.

## Architecture

- `src/site.config.ts` is the single source of truth for site metadata, nav links,
  social links, Giscus config, bundled Shiki themes, and the `characters` map. It is
  imported by `astro.config.mjs`, layouts, and generated routes — change it rather than
  hardcoding values in components.
- **Theming is derived from Shiki/Expressive Code themes.** `resolveThemeColorStyles()`
  in `src/utils.ts` maps TextMate scopes (e.g. `heading.1.markdown`,
  `terminal.ansiBlue`) to semantic keys in `src/types.ts` (`accent`, `heading1`, `note`,
  `tip`, ...). Those become `--theme-*` CSS variables consumed by the `@theme` block in
  `src/styles/global.css`, so the whole UI — not just code blocks — is recolored by the
  active theme. Theme switching happens client-side via the `data-theme` attribute on
  `<html>` persisted in `localStorage` (`SelectThemeLoader.astro` /
  `LightDarkAutoThemeLoader.astro`). `src/pages/giscus/[theme].css.ts` generates one
  stylesheet per theme so the comment widget matches.
- **Markdown pipeline.** Most site behavior lives in remark/rehype plugins registered in
  `astro.config.mjs` and implemented in `src/plugins/`. Plugin order matters; add new
  ones there rather than per-page. Notable ones: `remark-description` (auto-generates
  `description` frontmatter, 200 chars), `remark-reading-time`,
  `remark-character-dialogue`, `remark-admonitions`, `remark-spoiler`,
  `remark-github-card`, `remark-unknown-directives` (warns on unrecognized `:::`),
  `rehype-title-figure`, `rehype-pixelated`.
- **Content collections** are defined in `src/content.config.ts`: `posts`
  (`src/content/posts/**/*.{md,mdx}`), plus single-file `home` and `addendum`
  collections. Posts are never queried with raw `getCollection` in pages — use
  `getSortedPosts()`, `SeriesGroup.build()`, `TagsGroup.build()`, and
  `getPostSequenceContext()` from `src/utils.ts`. `getSortedPosts()` filters
  `draft: true` only in production builds.
- **Generated routes** all use `getStaticPaths`: `posts/[slug]`, paginated
  `posts/[...page]` and `tags/[tag]/[...page]` (page size from `siteConfig.pageSize`),
  `series/[slug]`, `rss.xml.ts`, `robots.txt.ts`, and `social-cards/[slug].png.ts`
  (Satori + resvg; requires `socialCardAvatarImage` to be a square **JPEG**).

## Conventions

- Import with the `~/*` alias (`~/utils`, `~/site.config`, `~/types`), not relative
  paths.
- Prettier: no semicolons, single quotes, trailing commas, width 90. Markdown under
  `src/content/` has its own `.prettierrc`: width 75 with `proseWrap: always`.
- Post frontmatter: `title`, `published` (date), optional `draft`, `description`,
  `author`, `series`, `tags`, `coverImage` ({ src, alt }), `toc` (default true).
  `series` and `tags` strings are slugged to build the `/series` and `/tags` routes, so
  reuse exact existing strings.
- Container directives are the main authoring primitive:
  - Admonitions: `:::note`, `:::tip`, `:::important`, `:::caution`, `:::warning`.
  - Character dialogue: `:::duck`, `:::me`, etc. — any key in `siteConfig.characters`.
    Inline form is `::me{align="right"}`. New characters need a small `.webp` in
    `public/` plus an entry in `site.config.ts`.
  - `:::spoiler[Summary text]` for collapsible content; `::github{repo="owner/name"}`
    for repo cards.
  - Directives in posts are wrapped in `<!-- prettier-ignore-start -->` /
    `<!-- markdownlint-disable -->` comment pairs so formatting doesn't break them —
    follow that pattern when adding new ones.
- Append `#pixelated` to an image's alt text to render it with pixelated scaling.
- `dev/` is theme-development reference data only and is not part of the build.
- Deployment is automatic on push to `main` via `.github/workflows/astro.yml` (Node 20,
  `npm ci`, astro build, Pagefind, GitHub Pages).
