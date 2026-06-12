import {
    ClassExpression, Column, Document, Entry, Layout, Page, Row, Section,
    isActor, isItem, isPage, isSection, isRow, isColumn,
    isProperty, isAction, isFunctionDefinition, isHookHandler, isStatusProperty,
    isLabelParam, LabelParam,
    isAttributeExp, isResourceExp, isTrackerExp, isNumberExp, isStringExp,
    isBooleanExp, isHtmlExp, isDamageTrackExp, isTableField, isInventoryField,
    isDamageBonusesField, isDamageResistancesField, isImageField, isPaperDollExp,
    isRollVisualizerField, isDateExp, isDateTimeExp, isTimeExp, isDiceField, isDieField,
    isDocumentChoiceExp, isDocumentChoicesExp, isSingleDocumentExp,
    isStringChoiceField, isStringChoicesField, isMoneyField, isMeasuredTemplateField,
    isMacroField, isDamageTypeChoiceField, isPinnedField,
} from '../../language/generated/ast.js';
import { getAllOfType } from './utils.js';

// ── Layout JSON v2 ──────────────────────────────────────────────────────────
// A tree per document per page that mirrors the sheet's AST structure
// (pages → sections/rows/columns → fields), written by the in-Foundry Design
// Mode and consumed by the sheet generator on the next regeneration.

export type LayoutSize = 'single' | 'double' | 'full';

export interface LayoutThemeOverride {
    background?: string;   // CSS color
    text?: string;         // CSS color
    border?: { color?: string; width?: string; radius?: string };  // width/radius like "2px"
    width?: { min?: string; max?: string };
    height?: { min?: string; max?: string };
    /** Containers: spacing between children / inner padding, e.g. "8px". */
    gap?: string;
    padding?: string;
    /** Rows: cross-axis alignment and main-axis distribution. */
    align?: 'start' | 'center' | 'end';
    justify?: 'start' | 'center' | 'space-between';
}

export interface LayoutFieldOverrides {
    size?: LayoutSize;
    hideLabel?: boolean;
    color?: string;
    icon?: string;
    hidden?: boolean;
    theme?: LayoutThemeOverride;
    /** Display-label override (sheet-side; localization passthrough renders it verbatim). */
    label?: string;
}

export interface LayoutFieldNode extends LayoutFieldOverrides {
    kind: 'field';
    name: string;
}

export interface LayoutContainerNode {
    kind: 'section' | 'row' | 'column';
    /** Section name (lowercase), or positional id for anonymous containers: __row_0, __column_1 (page-global, document order). */
    id: string;
    /** Sections only: hide the title bar. */
    hideLabel?: boolean;
    /** Layout theme overrides for this container. */
    theme?: LayoutThemeOverride;
    /** True when this container was created in Design Mode and has no AST counterpart. */
    synthetic?: boolean;
    children: LayoutNode[];
}

export interface LayoutStaticNode {
    kind: 'static';
    /** Stable id generated at insert time: "__static_<timestamp>" */
    id: string;
    staticType: 'heading' | 'paragraph' | 'hr';
    /** Display text for heading/paragraph; absent for hr. */
    text?: string;
    /** Text styling for heading/paragraph, e.g. "18px" / "#c0d8f0". */
    fontSize?: string;
    color?: string;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
    fontFamily?: string;
    /** Vertical spacing, e.g. "12px". */
    marginTop?: string;
    marginBottom?: string;
}

export type LayoutNode = LayoutFieldNode | LayoutContainerNode | LayoutStaticNode;

export interface DocLayoutV2 {
    pages: Record<string, { children: LayoutNode[] }>;
}

export interface SystemLayoutV2 {
    version: 2;
    actors: Record<string, DocLayoutV2>;
    items: Record<string, DocLayoutV2>;
}

export function isLayoutV2(layout: unknown): layout is SystemLayoutV2 {
    return !!layout && typeof layout === 'object' && (layout as { version?: unknown }).version === 2;
}

// ── Effective tree ──────────────────────────────────────────────────────────
// The merge of (AST, saved layout): ordered tree whose leaves reference AST
// elements. The sheet generator walks this instead of raw `.body` arrays.

export interface EffectiveFieldNode {
    kind: 'field';
    name: string;
    element: ClassExpression;
    overrides: LayoutFieldOverrides;
}

export interface EffectiveContainerNode {
    kind: 'section' | 'row' | 'column';
    id: string;
    /** AST element, or null for synthetic containers created in Design Mode. */
    element: Section | Row | Column | null;
    /** Layout override for a section's hideLabel (title bar). undefined = use AST param. */
    hideTitle?: boolean;
    /** Layout theme overrides applied on top of (or instead of) AST theme params. */
    themeOverride?: LayoutThemeOverride;
    /** True when this container was created in Design Mode (no AST counterpart). */
    synthetic?: boolean;
    children: EffectiveNode[];
}

export interface EffectiveStaticNode {
    kind: 'static';
    id: string;
    staticType: 'heading' | 'paragraph' | 'hr';
    text?: string;
    fontSize?: string;
    color?: string;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
    fontFamily?: string;
    marginTop?: string;
    marginBottom?: string;
}

export type EffectiveNode = EffectiveFieldNode | EffectiveContainerNode | EffectiveStaticNode;

export interface EffectiveDocTree {
    /** Keyed by page key: the main page uses the document name (lowercase), explicit pages their name (lowercase). */
    pages: Map<string, EffectiveNode[]>;
}

// ── Field metadata helpers (shared with the dev module generator) ──────────

export function humanizeFieldName(name: string): string {
    return name
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')
        .replace(/^./, s => s.toUpperCase());
}

export function getTypeLabel(el: unknown): string {
    if (isAttributeExp(el)) return 'attribute';
    if (isResourceExp(el)) return 'resource';
    if (isTrackerExp(el)) return 'tracker';
    if (isNumberExp(el)) return 'number';
    if (isStringExp(el)) return 'text';
    if (isBooleanExp(el)) return 'checkbox';
    if (isHtmlExp(el)) return 'html';
    if (isDamageTrackExp(el)) return 'damage-track';
    if (isTableField(el)) return 'table';
    if (isInventoryField(el)) return 'inventory';
    if (isSection(el)) return 'section';
    if (isAction(el)) return 'action';
    if (isPinnedField(el)) return 'pinned';
    if (isDamageBonusesField(el)) return 'bonuses';
    if (isDamageResistancesField(el)) return 'resistances';
    if (isImageField(el)) return 'image';
    if (isPaperDollExp(el)) return 'paperdoll';
    if (isRollVisualizerField(el)) return 'roll-viz';
    if (isDateExp(el)) return 'date';
    if (isDateTimeExp(el)) return 'datetime';
    if (isTimeExp(el)) return 'time';
    if (isDiceField(el)) return 'dice';
    if (isDieField(el)) return 'die';
    if (isDocumentChoiceExp(el)) return 'doc-choice';
    if (isDocumentChoicesExp(el)) return 'doc-choices';
    if (isSingleDocumentExp(el)) return 'document';
    if (isStringChoiceField(el)) return 'choice';
    if (isStringChoicesField(el)) return 'choices';
    if (isMoneyField(el)) return 'money';
    if (isMeasuredTemplateField(el)) return 'template';
    if (isMacroField(el)) return 'macro';
    if (isDamageTypeChoiceField(el)) return 'dmg-choice';
    return 'field';
}

/** Types whose base component renders double-wide (flex: 2). */
const DOUBLE_WIDE_TYPES = new Set(['tracker', 'doc-choice', 'doc-choices', 'macro', 'resistances']);

/** Types that don't participate in the single/double flex sizing (block/tab/full-width components). */
const SIZE_LOCKED_TYPES = new Set([
    'html', 'table', 'inventory', 'damage-track', 'paperdoll', 'roll-viz',
    'pinned', 'template', 'image',
]);

export function getDefaultSize(typeClass: string): LayoutSize {
    return DOUBLE_WIDE_TYPES.has(typeClass) ? 'double' : 'single';
}

export function isSizable(typeClass: string): boolean {
    return !SIZE_LOCKED_TYPES.has(typeClass);
}

// ── Default tree from AST ───────────────────────────────────────────────────

function isRenderableField(el: unknown): el is ClassExpression {
    const node = el as { name?: string; modifier?: string };
    if (!node?.name) return false;
    if (isPage(el) || isFunctionDefinition(el) || isHookHandler(el) || isStatusProperty(el)) return false;
    if (isProperty(el) && node.modifier === 'hidden') return false;
    return isProperty(el) || isAction(el);
}

interface PositionCounters { row: number; column: number; }

function buildDefaultChildren(body: (ClassExpression | Layout)[], counters: PositionCounters): EffectiveNode[] {
    const out: EffectiveNode[] = [];
    for (const el of body ?? []) {
        if (isPage(el)) continue;
        if (isSection(el)) {
            out.push({ kind: 'section', id: el.name.toLowerCase(), element: el, children: buildDefaultChildren(el.body, counters) });
        } else if (isRow(el)) {
            out.push({ kind: 'row', id: `__row_${counters.row++}`, element: el, children: buildDefaultChildren(el.body, counters) });
        } else if (isColumn(el)) {
            out.push({ kind: 'column', id: `__column_${counters.column++}`, element: el, children: buildDefaultChildren(el.body, counters) });
        } else if (isRenderableField(el)) {
            out.push({ kind: 'field', name: (el as { name: string }).name.toLowerCase(), element: el, overrides: {} });
        }
    }
    return out;
}

// ── Merge (drift-tolerant) ──────────────────────────────────────────────────

function pickOverrides(node: LayoutFieldNode): LayoutFieldOverrides {
    const out: LayoutFieldOverrides = {};
    if (node.size === 'single' || node.size === 'double' || node.size === 'full') out.size = node.size;
    if (typeof node.hideLabel === 'boolean') out.hideLabel = node.hideLabel;
    if (typeof node.color === 'string' && node.color.length > 0) out.color = node.color;
    if (typeof node.icon === 'string' && node.icon.length > 0) out.icon = node.icon;
    if (node.hidden === true) out.hidden = true;
    if (node.theme && typeof node.theme === 'object') {
        const t = node.theme;
        const tv: LayoutThemeOverride = {};
        if (typeof t.background === 'string') tv.background = t.background;
        if (typeof t.text === 'string') tv.text = t.text;
        if (t.border && typeof t.border === 'object') {
            const b: LayoutThemeOverride['border'] = {};
            if (typeof t.border.color === 'string') b.color = t.border.color;
            if (typeof t.border.width === 'string') b.width = t.border.width;
            if (typeof t.border.radius === 'string') b.radius = t.border.radius;
            if (Object.keys(b).length > 0) tv.border = b;
        }
        if (t.width && typeof t.width === 'object') {
            const w: LayoutThemeOverride['width'] = {};
            if (typeof t.width.min === 'string') w.min = t.width.min;
            if (typeof t.width.max === 'string') w.max = t.width.max;
            if (Object.keys(w).length > 0) tv.width = w;
        }
        if (t.height && typeof t.height === 'object') {
            const h: LayoutThemeOverride['height'] = {};
            if (typeof t.height.min === 'string') h.min = t.height.min;
            if (Object.keys(h).length > 0) tv.height = h;
        }
        if (typeof t.gap === 'string') tv.gap = t.gap;
        if (typeof t.padding === 'string') tv.padding = t.padding;
        if (t.align === 'start' || t.align === 'center' || t.align === 'end') tv.align = t.align;
        if (t.justify === 'start' || t.justify === 'center' || t.justify === 'space-between') tv.justify = t.justify;
        if (Object.keys(tv).length > 0) out.theme = tv;
    }
    if (typeof node.label === 'string' && node.label.length > 0) out.label = node.label;
    return out;
}

function mergePage(
    defaultChildren: EffectiveNode[],
    layoutChildren: LayoutNode[] | undefined,
    warn: (msg: string) => void,
): EffectiveNode[] {
    if (!layoutChildren) return defaultChildren;

    const fieldMap = new Map<string, EffectiveFieldNode>();
    const containerMap = new Map<string, EffectiveContainerNode>();
    (function index(nodes: EffectiveNode[]) {
        for (const n of nodes) {
            if (n.kind === 'field') fieldMap.set(n.name, n);
            else if (n.kind !== 'static') { containerMap.set(n.id, n); index(n.children); }
        }
    })(defaultChildren);

    const consumed = new Set<EffectiveNode>();

    function fromLayout(nodes: LayoutNode[]): EffectiveNode[] {
        const out: EffectiveNode[] = [];
        for (const ln of nodes ?? []) {
            if (ln.kind === 'field') {
                const def = fieldMap.get((ln.name ?? '').toLowerCase());
                if (!def) { warn(`layout field "${ln.name}" no longer exists — dropped`); continue; }
                if (consumed.has(def)) continue;
                consumed.add(def);
                out.push({ ...def, overrides: pickOverrides(ln) });
            } else if (ln.kind === 'section' || ln.kind === 'row' || ln.kind === 'column') {
                const def = containerMap.get(ln.id);
                // Synthetic containers (id starts with __dmrow_/__dmcol_ or has synthetic:true) have no
                // AST counterpart and are passed through with element:null, children resolved from fieldMap.
                if (!def) {
                    const isSynth = ln.synthetic === true || /^__dm(row|col)_/.test(ln.id ?? '');
                    if (!isSynth) { warn(`layout container "${ln.id}" no longer exists — dropped`); continue; }
                    // Drift-tolerant: count synthetic containers as "consumed" so they never re-appear
                    const synthNode: EffectiveContainerNode = {
                        kind: ln.kind,
                        id: ln.id,
                        element: null,
                        synthetic: true,
                        hideTitle: typeof ln.hideLabel === 'boolean' ? ln.hideLabel : undefined,
                        themeOverride: ln.theme,
                        children: fromLayout(ln.children ?? []),
                    };
                    out.push(synthNode);
                    continue;
                }
                if (consumed.has(def)) continue;
                consumed.add(def);
                const containerTheme = ln.theme;
                out.push({
                    ...def,
                    hideTitle: typeof ln.hideLabel === 'boolean' ? ln.hideLabel : undefined,
                    themeOverride: containerTheme,
                    children: fromLayout(ln.children),
                });
            } else if (ln.kind === 'static') {
                // Static nodes have no AST counterpart — always pass through as-is.
                out.push({
                    kind: 'static', id: ln.id, staticType: ln.staticType, text: ln.text,
                    fontSize: ln.fontSize, color: ln.color, align: ln.align, bold: ln.bold,
                    italic: ln.italic, fontFamily: ln.fontFamily, marginTop: ln.marginTop, marginBottom: ln.marginBottom,
                });
            }
        }
        return out;
    }

    const result = fromLayout(layoutChildren);

    // Drift pass: anything in the AST but absent from the saved layout (e.g. a field added to the
    // ISDL source after the layout was saved) is appended at the end of its original container so
    // it never silently vanishes.
    // Static nodes (kind='static') have no AST counterpart and are always already in the result —
    // they do not participate in the drift pass.
    const effectiveByDefault = new Map<EffectiveContainerNode, EffectiveContainerNode>();
    (function mapContainers(nodes: EffectiveNode[]) {
        for (const n of nodes) {
            // Static nodes have no AST counterpart and no children; skip them in the drift map.
            if (n.kind === 'field' || n.kind === 'static') continue;
            // n is now narrowed to EffectiveContainerNode
            const c = n as EffectiveContainerNode;
            const def = containerMap.get(c.id);
            if (def) effectiveByDefault.set(def, c);
            mapContainers(c.children);
        }
    })(result);

    // appendDrifted only operates on AST-derived nodes (defaultChildren) which never contain statics.
    // Parameter type is EffectiveNode[] to avoid unsafe casts; internally we only receive container or field nodes.
    function appendDrifted(defNodes: EffectiveNode[], fallbackTarget: EffectiveNode[]) {
        for (const dn of defNodes) {
            if (consumed.has(dn)) {
                if (dn.kind !== 'field' && dn.kind !== 'static') {
                    const c = dn as EffectiveContainerNode;
                    const eff = effectiveByDefault.get(c);
                    appendDrifted(c.children, eff ? eff.children : fallbackTarget);
                }
                continue;
            }
            consumed.add(dn);
            if (dn.kind === 'field') {
                fallbackTarget.push(dn);
            } else if (dn.kind !== 'static') {
                const c = dn as EffectiveContainerNode;
                const effContainer: EffectiveContainerNode = { ...c, children: [] };
                effectiveByDefault.set(c, effContainer);
                fallbackTarget.push(effContainer);
                appendDrifted(c.children, effContainer.children);
            }
        }
    }
    appendDrifted(defaultChildren, result);

    return result;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function buildEffectiveDocTree(doc: Document, layout: SystemLayoutV2 | null): EffectiveDocTree {
    const docKey = doc.name.toLowerCase();
    const category = isActor(doc) ? 'actors' : isItem(doc) ? 'items' : null;
    const docLayout = category ? layout?.[category]?.[docKey] : undefined;
    const warn = (m: string) => console.warn(`[isdl-layout] ${doc.name}: ${m}`);

    const pages = new Map<string, EffectiveNode[]>();

    // Main page: top-level document body (tab key = document name)
    const mainCounters: PositionCounters = { row: 0, column: 0 };
    const mainDefault = buildDefaultChildren(doc.body as (ClassExpression | Layout)[], mainCounters);
    pages.set(docKey, mergePage(mainDefault, docLayout?.pages?.[docKey]?.children, warn));

    // Explicit pages
    for (const page of getAllOfType<Page>(doc.body as (ClassExpression | Layout)[], isPage)) {
        const key = page.name.toLowerCase();
        const counters: PositionCounters = { row: 0, column: 0 };
        const def = buildDefaultChildren(page.body as (ClassExpression | Layout)[], counters);
        pages.set(key, mergePage(def, docLayout?.pages?.[key]?.children, warn));
    }

    return { pages };
}

/** Per-field layout overrides for a document, keyed by lowercase field name. */
export function collectFieldOverrides(tree: EffectiveDocTree): Map<string, LayoutFieldOverrides> {
    const map = new Map<string, LayoutFieldOverrides>();
    const walk = (nodes: EffectiveNode[]) => {
        for (const n of nodes) {
            if (n.kind === 'field') {
                if (Object.keys(n.overrides).length > 0) map.set(n.name, n.overrides);
            } else if (n.kind !== 'static') {
                walk(n.children);
            }
        }
    };
    for (const children of tree.pages.values()) walk(children);
    return map;
}

/** Per-section hideTitle overrides for a document, keyed by lowercase section name. */
export function collectSectionOverrides(tree: EffectiveDocTree): Map<string, { hideTitle: boolean }> {
    const map = new Map<string, { hideTitle: boolean }>();
    const walk = (nodes: EffectiveNode[]) => {
        for (const n of nodes) {
            if (n.kind === 'section') {
                if (typeof n.hideTitle === 'boolean') map.set(n.id, { hideTitle: n.hideTitle });
                walk(n.children);
            } else if (n.kind === 'row' || n.kind === 'column') {
                walk(n.children);
            }
            // 'field' and 'static' have no children to recurse into
        }
    };
    for (const children of tree.pages.values()) walk(children);
    return map;
}

// ── Serialization for the dev companion module ─────────────────────────────
// JSON-safe tree with display metadata, embedded into dev-tools.mjs as LAYOUT_TREE.

export interface ModuleFieldNode extends LayoutFieldOverrides {
    kind: 'field';
    name: string;
    /** Effective display label: the override when set, else the AST/derived default. */
    label: string;
    /** The AST/derived label — lets the editor detect "user actually renamed this". */
    defaultLabel: string;
    typeClass: string;
    defaultSize: LayoutSize;
    sizable: boolean;
    // hidden and theme are inherited from LayoutFieldOverrides
}

export interface ModuleContainerNode {
    kind: 'section' | 'row' | 'column';
    id: string;
    label?: string;
    hideLabel?: boolean;
    theme?: LayoutThemeOverride;
    synthetic?: boolean;
    children: ModuleLayoutNode[];
}

export interface ModuleStaticNode {
    kind: 'static';
    id: string;
    staticType: 'heading' | 'paragraph' | 'hr';
    text?: string;
    fontSize?: string;
    color?: string;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
    fontFamily?: string;
    marginTop?: string;
    marginBottom?: string;
}

export type ModuleLayoutNode = ModuleFieldNode | ModuleContainerNode | ModuleStaticNode;

function serializeNode(node: EffectiveNode): ModuleLayoutNode {
    if (node.kind === 'field') {
        const el = node.element as { name: string; params?: unknown[] };
        const labelParam = (el.params ?? []).find(p => isLabelParam(p)) as LabelParam | undefined;
        const typeClass = getTypeLabel(node.element);
        const defaultLabel = labelParam?.value ?? humanizeFieldName(el.name);
        const fieldOut: ModuleFieldNode = {
            kind: 'field',
            name: node.name,
            label: node.overrides.label ?? defaultLabel,
            defaultLabel,
            typeClass,
            defaultSize: getDefaultSize(typeClass),
            sizable: isSizable(typeClass),
            ...node.overrides,
        };
        return fieldOut;
    }
    if (node.kind === 'static') {
        return {
            kind: 'static', id: node.id, staticType: node.staticType, text: node.text,
            fontSize: node.fontSize, color: node.color, align: node.align, bold: node.bold,
            italic: node.italic, fontFamily: node.fontFamily, marginTop: node.marginTop, marginBottom: node.marginBottom,
        };
    }
    const containerOut: ModuleContainerNode = {
        kind: node.kind,
        id: node.id,
        label: node.kind === 'section' && node.element ? humanizeFieldName((node.element as Section).name) : undefined,
        hideLabel: node.hideTitle,
        children: node.children.map(serializeNode),
    };
    if (node.themeOverride) containerOut.theme = node.themeOverride;
    if (node.synthetic) containerOut.synthetic = true;
    return containerOut;
}

export interface ModuleDocTree {
    name: string;
    pages: Record<string, { children: ModuleLayoutNode[] }>;
}

export interface ModuleLayoutTree {
    actors: Record<string, ModuleDocTree>;
    items: Record<string, ModuleDocTree>;
}

export function serializeLayoutTree(entry: Entry, layout: SystemLayoutV2 | null): ModuleLayoutTree {
    const out: ModuleLayoutTree = { actors: {}, items: {} };
    for (const doc of entry.documents) {
        const category = isActor(doc) ? 'actors' : isItem(doc) ? 'items' : null;
        if (!category) continue;
        const tree = buildEffectiveDocTree(doc, layout);
        const pages: Record<string, { children: ModuleLayoutNode[] }> = {};
        for (const [key, children] of tree.pages) {
            pages[key] = { children: children.map(serializeNode) };
        }
        out[category][doc.name.toLowerCase()] = { name: doc.name, pages };
    }
    return out;
}
