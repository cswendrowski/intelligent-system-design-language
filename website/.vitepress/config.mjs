import { defineConfig } from 'vitepress';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The sidebar is generated from the wiki's _Sidebar.md by sync-wiki.mjs.
const sidebarPath = fileURLToPath(new URL('./sidebar.json', import.meta.url));
const sidebar = existsSync(sidebarPath) ? JSON.parse(readFileSync(sidebarPath, 'utf8')) : [];

export default defineConfig({
    title: 'ISDL',
    description: 'Intelligent System Design Language — build Foundry VTT systems from a simple DSL.',
    // GitHub Pages project site lives under /<repo>/.
    base: '/intelligent-system-design-language/',
    srcDir: 'content',
    // Self-hosted wiki images live in website/public/ (served at the site root).
    vite: { publicDir: fileURLToPath(new URL('../public', import.meta.url)) },
    cleanUrls: true,
    lastUpdated: true,
    // PoC: the wiki uses GitHub-flavored links/anchors that don't all map 1:1 to VitePress.
    // Don't fail the build on the stragglers while we're proving the approach out.
    ignoreDeadLinks: true,
    themeConfig: {
        // Built-in, fully local full-text search (MiniSearch) — no external service.
        search: { provider: 'local' },
        sidebar,
        nav: [
            { text: 'How Do I…?', link: '/How-Do-I' },
            { text: 'Recipes', link: '/Recipes' },
            { text: 'Glossary', link: '/Glossary' },
            { text: 'GitHub', link: 'https://github.com/cswendrowski/intelligent-system-design-language' },
        ],
        socialLinks: [
            { icon: 'github', link: 'https://github.com/cswendrowski/intelligent-system-design-language' },
        ],
        editLink: {
            pattern: 'https://github.com/cswendrowski/intelligent-system-design-language/wiki',
            text: 'Edit this page in the wiki',
        },
    },
});
