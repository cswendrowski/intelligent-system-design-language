import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pulls the ISDL wiki's markdown into this VitePress site.
 *
 * The wiki stays the single source of truth — nothing here is committed to the repo
 * (content/ and sidebar.json are gitignored). Run before every dev/build:
 *   - local preview: `WIKI_SRC=../../intelligent-system-design-language.wiki npm run dev`
 *   - CI:            clones `WIKI_REPO` fresh on each run
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(here, 'content');
const vpDir = path.join(here, '.vitepress');

// 1. Resolve the wiki source: a local dir (fast preview) or a shallow clone (CI default).
let src = process.env.WIKI_SRC;
let tmp;
if (!src) {
    const repo = process.env.WIKI_REPO
        || 'https://github.com/cswendrowski/intelligent-system-design-language.wiki.git';
    tmp = mkdtempSync(path.join(os.tmpdir(), 'isdl-wiki-'));
    console.log(`Cloning wiki: ${repo}`);
    execSync(`git clone --depth 1 "${repo}" "${tmp}"`, { stdio: 'inherit' });
    src = tmp;
}
console.log(`Wiki source: ${src}`);

const mdFiles = readdirSync(src).filter(f => f.endsWith('.md'));
const pageNames = new Set(mdFiles.map(f => f.replace(/\.md$/, '')));

// Index any wiki images we've self-hosted (public/assets/att-<uuid>.<ext>) so the markdown's
// GitHub user-attachments URLs — which don't hotlink (signed, 5-min-expiry, 403 anonymously) —
// can be rewritten to load locally and on Pages. Drop more att-<uuid>.<ext> files in to migrate
// more images; refs without a matching local file are left as-is (and still work on github.com).
const assetsDir = path.join(here, 'public', 'assets');
const assetByUuid = new Map();
if (existsSync(assetsDir)) {
    for (const f of readdirSync(assetsDir)) {
        const m = /^att-([0-9a-f-]{36})\./.exec(f);
        if (m) assetByUuid.set(m[1], f);
    }
}
let localized = 0;
// Rewrite every self-hosted GitHub user-attachments URL — covers markdown ![]()/[]() and raw
// <img src>/<a href> alike — to its local /assets/ copy. Refs we haven't downloaded are left.
function localizeAttachments(md) {
    return md.replace(/https:\/\/github\.com\/user-attachments\/assets\/([0-9a-f-]{36})/g, (m, uuid) => {
        if (assetByUuid.has(uuid)) { localized++; return `/assets/${assetByUuid.get(uuid)}`; }
        return m;
    });
}

// Convert GitHub-wiki links ([text](Page) / [text](Page#anchor)) into VitePress relative
// .md links so cross-references resolve. Only real wiki pages are touched — image paths,
// external URLs and bare #anchors are left alone.
function rewriteLinks(line) {
    return line.replace(/(\]\()([^)\s]+)(\))/g, (m, open, target, close) => {
        if (/^(https?:|mailto:|\/|#)/.test(target)) return m;
        const hash = target.indexOf('#');
        const page = decodeURIComponent(hash >= 0 ? target.slice(0, hash) : target).replace(/\.md$/, '');
        const anchor = hash >= 0 ? target.slice(hash) : '';
        if (page === 'Home') return `${open}./index.md${anchor}${close}`;
        if (!pageNames.has(page)) return m;
        return `${open}./${page}.md${anchor}${close}`;
    });
}

// VitePress compiles markdown as a Vue template, so bare angle brackets in prose (ISDL's
// `choice<string>` / `table<ItemType>` notation) are read as unclosed HTML tags and break
// the build. Escape angle-bracket tokens in prose — but preserve genuine HTML tags (the wiki
// embeds raw <img>, <details>, etc.) and `<http…>` autolinks.
const HTML_TAGS = new Set(['a', 'img', 'br', 'hr', 'sub', 'sup', 'b', 'i', 'u', 's', 'em', 'strong',
    'code', 'pre', 'kbd', 'mark', 'small', 'details', 'summary', 'div', 'span', 'p', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td',
    'th', 'caption', 'blockquote', 'video', 'audio', 'source', 'picture', 'figure', 'figcaption', 'iframe',
    'abbr', 'cite', 'q', 'center']);
function escapeAngles(text) {
    return text.replace(/<[^>]*>?|>/g, tok => {
        if (/^<(?:https?:\/\/|mailto:)[^>]+>$/.test(tok)) return tok; // keep autolinks
        const tag = /^<\/?\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(tok);
        if (tag && HTML_TAGS.has(tag[1].toLowerCase())) return tok; // keep real HTML tags
        return tok.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    });
}

// GitHub blockquote alerts (> [!NOTE] / [!TIP] / [!IMPORTANT] / [!WARNING] / [!CAUTION])
// aren't understood by VitePress, which uses ::: containers instead. Convert each alert
// block, preserving the label as the container title.
function convertAlerts(md) {
    const ALERT = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i;
    const TYPE = { NOTE: 'info', TIP: 'tip', IMPORTANT: 'info', WARNING: 'warning', CAUTION: 'danger' };
    const lines = md.split(/\r?\n/);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const m = ALERT.exec(lines[i]);
        if (!m) { out.push(lines[i]); continue; }
        const kind = m[1].toUpperCase();
        const title = (m[2] || '').trim() || kind[0] + kind.slice(1).toLowerCase();
        const body = [];
        for (i++; i < lines.length && /^>/.test(lines[i]); i++) body.push(lines[i].replace(/^>\s?/, ''));
        i--; // step back so the outer loop's i++ lands on the next unprocessed line
        out.push(`::: ${TYPE[kind]} ${title}`, ...body, ':::');
    }
    return out.join('\n');
}

// Apply all passes: alert conversion (block level), then link rewriting + angle escaping
// line by line, skipping fenced code blocks and inline code spans so snippets stay verbatim.
function rewrite(md) {
    md = convertAlerts(md);
    md = localizeAttachments(md);
    let inFence = false;
    return md.split(/\r?\n/).map(line => {
        if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return line; }
        if (inFence) return line;
        // Preserve a leading blockquote marker (> or nested > >) so its structural '>' isn't
        // escaped to &gt; — which would turn the blockquote into a literal paragraph.
        const bq = line.match(/^\s*(?:>\s?)+/);
        const prefix = bq ? bq[0] : '';
        const rest = prefix ? line.slice(prefix.length) : line;
        const segs = rewriteLinks(rest).split('`');
        for (let i = 0; i < segs.length; i += 2) segs[i] = escapeAngles(segs[i]);
        return prefix + segs.join('`');
    }).join('\n');
}

// 2. Refill the content dir (Home.md becomes the VitePress home at /).
rmSync(contentDir, { recursive: true, force: true });
mkdirSync(contentDir, { recursive: true });
let pageCount = 0;
for (const f of mdFiles) {
    if (f.startsWith('_')) continue; // _Sidebar/_Footer drive config, they aren't pages
    const out = f === 'Home.md' ? 'index.md' : f;
    writeFileSync(path.join(contentDir, out), rewrite(readFileSync(path.join(src, f), 'utf8')));
    pageCount++;
}

// 3. Translate _Sidebar.md (`#` = group, `## [text](Page)` = item) into a VitePress
//    sidebar so navigation mirrors the wiki exactly.
const sidebar = [];
const sbPath = path.join(src, '_Sidebar.md');
if (existsSync(sbPath)) {
    let group = null;
    for (const line of readFileSync(sbPath, 'utf8').split(/\r?\n/)) {
        const g = /^#\s+(.+)/.exec(line);
        const it = /^##\s+\[([^\]]+)\]\(([^)]+)\)/.exec(line);
        if (g) { group = { text: g[1].trim(), items: [] }; sidebar.push(group); }
        else if (it && group) {
            const text = it[1].trim();
            const link = it[2].trim();
            if (/^https?:/.test(link)) {
                group.items.push({ text, link });
            } else {
                const p = link.replace(/\.md$/, '');
                group.items.push({ text, link: p === 'Home' ? '/' : `/${p}` });
            }
        }
    }
}
mkdirSync(vpDir, { recursive: true });
const groups = sidebar.filter(g => g.items.length);
writeFileSync(path.join(vpDir, 'sidebar.json'), JSON.stringify(groups, null, 2));

if (tmp) rmSync(tmp, { recursive: true, force: true });
console.log(`Synced ${pageCount} pages; ${groups.length} sidebar groups; ${localized} self-hosted image refs.`);
