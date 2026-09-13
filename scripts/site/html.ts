/**
 * Tiny HTML helpers for the prerendered pages. Plain strings, no framework: the pages are meant
 * for crawlers and people arriving from search, and link into the app for the interactive view.
 */
import { groupStyle } from '../../src/lib/groupColor.ts'

export function esc(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const STYLE = `
:root{color-scheme:light dark;--fg:#18181b;--muted:#71717a;--bg:#fafafa;--card:#fff;--line:#e4e4e7;--link:#0369a1}
@media(prefers-color-scheme:dark){:root{--fg:#fafafa;--muted:#a1a1aa;--bg:#09090b;--card:#18181b;--line:#27272a;--link:#38bdf8}}
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--fg);background:var(--bg)}
a{color:var(--link)}main{max-width:52rem;margin:0 auto;padding:1rem 1rem 3rem}
header.site{border-bottom:1px solid var(--line);background:var(--card)}header.site div{max-width:52rem;margin:0 auto;padding:.75rem 1rem;display:flex;gap:1rem;align-items:baseline;flex-wrap:wrap}
header.site a.brand{font-weight:700;text-decoration:none;color:var(--fg);font-size:1.1rem}header.site span{color:var(--muted);font-size:.9rem}
nav.crumbs{font-size:.9rem;color:var(--muted);margin:1rem 0 .5rem}nav.crumbs a{color:inherit}
h1{margin:.25rem 0 .5rem;font-size:1.75rem;line-height:1.2}h2{margin:2rem 0 .5rem;font-size:1.2rem}h3{margin:1.25rem 0 .25rem;font-size:1rem}
.facts{display:flex;flex-wrap:wrap;gap:.5rem 1rem;color:var(--muted);margin:0 0 1rem;padding:0;list-style:none}
.chip{display:inline-block;padding:.1rem .6rem;border-radius:999px;font-size:.85rem;font-weight:600;color:#fff}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin:1rem 0 1.5rem}
.actions a{display:inline-block;padding:.55rem 1rem;border-radius:.5rem;text-decoration:none;font-weight:600;border:1px solid var(--line);background:var(--card);color:var(--fg)}
.actions a.primary{background:var(--link);border-color:var(--link);color:#fff}
.card{background:var(--card);border:1px solid var(--line);border-radius:.75rem;padding:1rem 1.25rem;margin:1rem 0}
.card p:first-child{margin-top:0}.card p:last-child{margin-bottom:0}
table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:.35rem .5rem;border-bottom:1px solid var(--line);vertical-align:top}
ul.sessions{padding-left:1.25rem}ul.sessions li{margin:.15rem 0}ul.plain{list-style:none;padding:0}ul.plain li{padding:.35rem 0;border-bottom:1px solid var(--line)}
.muted{color:var(--muted)}footer{max-width:52rem;margin:0 auto;padding:1rem;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
address{font-style:normal}
`.trim()

export interface Layout {
  title: string
  description: string
  /** Absolute canonical URL of the page. */
  canonical: string
  /** Serialised `<script type="application/ld+json">` tag(s). */
  jsonLd: string
  /** Rendered `<main>` inner HTML. */
  body: string
  /** Extra `<head>` markup. */
  head?: string
  site: string
  generatedAt: string
}

export function breadcrumbs(items: { name: string; url?: string }[]): string {
  return `<nav class="crumbs" aria-label="Breadcrumb">${items
    .map((item) => (item.url ? `<a href="${esc(item.url)}">${esc(item.name)}</a>` : esc(item.name)))
    .join(' › ')}</nav>`
}

export function groupChip(group: string): string {
  return `<span class="chip" style="background:${groupStyle(group).hex}">${esc(group)}</span>`
}

export function layout(page: Layout): string {
  const ogImage = `${page.site}/og.png`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)} · covac</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${esc(page.canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="covac">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(page.canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:locale" content="en_CA">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
${page.head ?? ''}
<style>${STYLE}</style>
${page.jsonLd}
</head>
<body>
<header class="site"><div><a class="brand" href="${esc(page.site)}/">covac</a><span>City of Vancouver Active Communities</span><span><a href="${esc(page.site)}/centres/">Centres</a> · <a href="${esc(page.site)}/activities/">Activities</a></span></div></header>
<main>
${page.body}
</main>
<footer>Unofficial mirror of City of Vancouver recreation data published through ActiveNet. Activity data belongs to the Vancouver Board of Parks and Recreation; confirm details and register on ActiveNet before attending. Data as of ${esc(page.generatedAt.slice(0, 10))}. <a href="${esc(page.site)}/llms.txt">llms.txt</a> · <a href="https://github.com/patsissons/covac">Source</a></footer>
</body>
</html>
`
}
