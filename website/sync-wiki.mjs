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
// the build. Escape angle-bracket tokens in prose, leaving genuine `<http…>` autolinks.
function escapeAngles(text) {
    return text.replace(/<[^>]*>?|>/g, tok => {
        if (/^<(?:https?:\/\/|mailto:)[^>]+>$/.test(tok)) return tok; // keep autolinks
        return tok.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    });
}

// Apply both passes line by line, skipping fenced code blocks entirely and inline code
// spans (odd segments when split on backticks) so example snippets render verbatim.
function rewrite(md) {
    let inFence = false;
    return md.split(/\r?\n/).map(line => {
        if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return line; }
        if (inFence) return line;
        const segs = rewriteLinks(line).split('`');
        for (let i = 0; i < segs.length; i += 2) segs[i] = escapeAngles(segs[i]);
        return segs.join('`');
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
console.log(`Synced ${pageCount} pages; ${groups.length} sidebar groups.`);
