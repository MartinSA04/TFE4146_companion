import { defineConfig } from "astro/config";
import studyCompanion from "study-companion";

// The integration injects all pages, the MDX+KaTeX pipeline, and the Pagefind
// search index. The only thing a course declares here is its canonical origin
// (served at root via the custom domain in public/CNAME) — used for the
// canonical link, Open Graph / Twitter cards and the sitemap.
export default defineConfig({
  site: "https://halvleder.martinsundal.no",
  integrations: [studyCompanion()],
});
