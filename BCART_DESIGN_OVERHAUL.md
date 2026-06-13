# B-Cart ERP — Design Overhaul Master Prompt
> **Version:** 1.0 · **Scope:** UI/UX Only · **Stack Assumed:** React + Vite (or similar) with plain CSS / Tailwind  
> **Do NOT touch:** backend routes, API handlers, form logic, event handlers, IDs, data attributes  
> **Output:** A visually premium "Artisanal Operations" aesthetic — vanilla light, editorial typography, refined data surfaces

---

## 0 · MISSION STATEMENT

You are a senior UI/UX engineer executing a **pure cosmetic overhaul** of B-Cart, a furniture manufacturing ERP. The backend is fully validated. Every route, endpoint, form submission, and piece of JavaScript logic must remain exactly as-is. Your job is to restyle the interface so it stops looking like a generic SaaS template and starts feeling like a bespoke, premium operations tool — think **Linear meets an artisan furniture studio**.

The visual language is defined by:
- Warm ivory-white surfaces (`#fbf9f9`)
- Editorial serif typography (EB Garamond) for display text and KPI numbers
- Clean utility sans-serif (Hanken Grotesk) for all data/table/label text
- Hyper-rounded cards (20–32px radius) with ambient shadows
- Pill-shaped interactive elements (buttons, badges, tabs)
- A "controlled clarity" aesthetic: generous whitespace, no decorative noise

---

## 1 · CRITICAL CONSTRAINTS (READ BEFORE TOUCHING ANY FILE)

### 1.1 DO NOT CHANGE

```
❌ Any route handler (e.g., /api/*, /products, /sales)
❌ Any form `action`, `method`, `name`, or `onSubmit` attribute
❌ Any `id=""` attribute on any DOM element
❌ Any `data-*` attribute
❌ Any JavaScript event listener or handler
❌ Any React component's props interface or state logic
❌ Any API call (fetch, axios, useSWR, react-query, etc.)
❌ Any backend model, controller, or middleware
❌ Database schema or migration files
❌ Environment variables or config files
❌ Authentication/session logic
```

### 1.2 YOU MAY CHANGE

```
✅ CSS files (globals.css, index.css, component.module.css, tailwind config)
✅ className strings (add/replace, but do NOT remove classes that have JS side effects)
✅ Inline style objects for purely visual properties
✅ HTML structure for PRESENTATION ONLY (wrapping divs for layout, never removing data-carrying elements)
✅ Adding new <style> blocks or CSS files
✅ Font import tags in index.html or equivalent entry
✅ Static SVG icons (replace ugly ones)
✅ Placeholder images with styled empty states
```

### 1.3 DANGER ZONES — DOUBLE-CHECK BEFORE EDITING

Before editing any file, grep for these patterns:
```bash
# Check if className is used in JS logic
grep -n "className" <file> | grep -E "(if|switch|includes|indexOf)"

# Check for getElementById or querySelector targeting that element
grep -rn "getElementById\|querySelector\|getByTestId" src/

# Verify no JS references the CSS class you're about to rename
grep -rn "classList\|className\." src/ --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx"
```

---

## 2 · AUDIT PROTOCOL (EXECUTE IN THIS ORDER)

Before writing a single CSS rule, complete this audit and build a reference map.

### Step 1: Map the Route → Page → Component tree

```bash
# Find all page-level components
find src/ -name "*.jsx" -o -name "*.tsx" | head -50

# Find the router config
grep -rn "Route\|createBrowserRouter\|useRoutes" src/ --include="*.jsx" --include="*.tsx" -l

# Find the main layout wrapper
grep -rn "Sidebar\|Layout\|Shell\|App" src/ --include="*.jsx" --include="*.tsx" -l
```

Document the result as:
```
/ Dashboard → <Dashboard /> in pages/Dashboard.jsx
/products → <Products /> in pages/Products.jsx
/sales → <Sales /> in pages/Sales.jsx
/purchase → <Purchase /> in pages/Purchase.jsx
/manufacturing → <Manufacturing /> in pages/Manufacturing.jsx
...etc
```

### Step 2: Locate the global stylesheet

```bash
find src/ -name "*.css" | head -20
cat src/index.css  # or src/globals.css or src/App.css
```

This is where you will inject the design system tokens.

### Step 3: Identify the component library (if any)

```bash
cat package.json | grep -E "tailwind|chakra|mui|antd|shadcn|radix"
```

- If **Tailwind**: extend `tailwind.config.js` with design tokens, do NOT override core utilities
- If **CSS Modules**: add a new `design-system.css` imported in `main.jsx`
- If **plain CSS**: inject tokens into `:root` in `globals.css`

### Step 4: Identify the sidebar + topbar components

These are the highest-impact files. Find them:
```bash
grep -rn "OPERATIONS\|TRANSACTIONS\|MASTER DATA\|INTELLIGENCE" src/ -l
grep -rn "B-cart\|bcart\|topbar\|navbar\|header" src/ -l --ignore-case
```

### Step 5: Identify the table components

```bash
grep -rn "<table\|<Table\|DataTable\|ListView" src/ -l
```

### Step 6: Identify form components

```bash
grep -rn "<form\|<Form\|onSubmit\|handleSubmit" src/ -l
```

### Step 7: Snapshot the current state

Take screenshots of every page before touching CSS. Label them `before-[page].png`. These are your rollback reference.

---

## 3 · DESIGN SYSTEM — TOKEN DEFINITIONS

### 3.1 Font Imports

Add to `index.html` `<head>`:

```html
<!-- Design System Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 3.2 CSS Custom Properties

Inject into `:root` in your global stylesheet:

```css
/* ===== ARTISANAL OPERATIONS — DESIGN TOKENS ===== */
:root {

  /* --- Surfaces --- */
  --surface:                  #fbf9f9;
  --surface-dim:              #dbd9da;
  --surface-bright:           #ffffff;
  --surface-container-lowest: #ffffff;
  --surface-container-low:    #f5f3f4;
  --surface-container:        #efedee;
  --surface-container-high:   #e9e8e8;
  --surface-container-highest:#e4e2e3;

  /* --- Typography on Surface --- */
  --on-surface:               #1b1c1c;
  --on-surface-variant:       #43474b;
  --inverse-surface:          #303031;
  --inverse-on-surface:       #f2f0f1;

  /* --- Borders --- */
  --outline:                  #73787b;
  --outline-variant:          #c3c7cb;

  /* --- Primary (Black) --- */
  --primary:                  #000000;
  --on-primary:               #ffffff;
  --primary-container:        #091e28;
  --on-primary-container:     #738793;
  --inverse-primary:          #b5c9d7;

  /* --- Secondary (Steel Blue) --- */
  --secondary:                #4e616e;
  --on-secondary:             #ffffff;
  --secondary-container:      #d1e5f5;
  --on-secondary-container:   #546774;

  /* --- Tertiary (Warm) --- */
  --tertiary:                 #000000;
  --on-tertiary:              #ffffff;
  --tertiary-container:       #2b1609;
  --on-tertiary-container:    #9e7d69;

  /* --- Semantic --- */
  --error:                    #ba1a1a;
  --on-error:                 #ffffff;
  --error-container:          #ffdad6;
  --on-error-container:       #93000a;

  /* --- Status Colors (badges) --- */
  --status-delivered-bg:      rgba(34, 197, 94, 0.12);
  --status-delivered-text:    #15803d;
  --status-delivered-border:  rgba(34, 197, 94, 0.25);

  --status-confirmed-bg:      rgba(59, 130, 246, 0.10);
  --status-confirmed-text:    #1d4ed8;
  --status-confirmed-border:  rgba(59, 130, 246, 0.20);

  --status-partial-bg:        rgba(234, 179, 8, 0.10);
  --status-partial-text:      #854d0e;
  --status-partial-border:    rgba(234, 179, 8, 0.20);

  --status-draft-bg:          rgba(115, 120, 123, 0.10);
  --status-draft-text:        #43474b;
  --status-draft-border:      rgba(115, 120, 123, 0.20);

  --status-late-bg:           rgba(186, 26, 26, 0.10);
  --status-late-text:         #93000a;
  --status-late-border:       rgba(186, 26, 26, 0.20);

  --status-blocked-bg:        rgba(249, 115, 22, 0.10);
  --status-blocked-text:      #9a3412;
  --status-blocked-border:    rgba(249, 115, 22, 0.20);

  /* --- Typography --- */
  --font-serif:               'EB Garamond', Georgia, serif;
  --font-sans:                'Hanken Grotesk', system-ui, sans-serif;

  /* --- Type Scale --- */
  --text-display-lg:          48px;
  --text-headline-lg:         32px;
  --text-headline-md:         24px;
  --text-body-lg:             18px;
  --text-body-md:             16px;
  --text-label-md:            14px;
  --text-label-sm:            12px;
  --text-numbers-lg:          36px;

  /* --- Spacing --- */
  --space-1:   0.25rem;  /* 4px */
  --space-2:   0.5rem;   /* 8px */
  --space-3:   0.75rem;  /* 12px */
  --space-4:   1rem;     /* 16px */
  --space-6:   1.5rem;   /* 24px */
  --space-8:   2rem;     /* 32px */
  --space-12:  3rem;     /* 48px */
  --space-16:  4rem;     /* 64px */

  /* --- Border Radius --- */
  --radius-sm:   0.25rem;   /* 4px  — micro chips */
  --radius-md:   0.5rem;    /* 8px  — inputs, small cards */
  --radius-lg:   0.75rem;   /* 12px — table rows hover */
  --radius-xl:   1rem;      /* 16px — standard cards */
  --radius-2xl:  1.5rem;    /* 24px — KPI cards, major panels */
  --radius-3xl:  2rem;      /* 32px — hero sections, featured cards */
  --radius-full: 9999px;    /* ∞    — pills, badges, FAB */

  /* --- Shadows --- */
  --shadow-xs:   0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm:   0 2px 4px rgba(0,0,0,0.06);
  --shadow-md:   0 4px 16px rgba(0,0,0,0.08);
  --shadow-lg:   0 8px 32px rgba(0,0,0,0.10);
  --shadow-xl:   0 16px 48px rgba(0,0,0,0.12);

  /* Button multi-layer shadow (tactile/lifted feel) */
  --shadow-btn-primary:
    0 1px 0 rgba(255,255,255,0.1) inset,
    0 2px 4px rgba(0,0,0,0.20),
    0 4px 12px rgba(0,0,0,0.15);

  /* --- Transitions --- */
  --transition-fast:   150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base:   250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow:   400ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-spring: 300ms cubic-bezier(0.34, 1.56, 0.64, 1);

  /* --- Sidebar width --- */
  --sidebar-width: 220px;
  --topbar-height: 56px;
}
```

### 3.3 Global Base Styles

```css
/* ===== BASE RESET ===== */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  font-family: var(--font-sans);
  font-size: var(--text-body-md);
  color: var(--on-surface);
  background-color: var(--surface);
  line-height: 1.5;
}

/* Serif for display elements */
h1, h2, h3,
.serif, .display, .kpi-number, .page-title {
  font-family: var(--font-serif);
}

/* Smooth focus rings */
:focus-visible {
  outline: 2px solid var(--secondary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Scrollbar refinement */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--outline-variant);
  border-radius: var(--radius-full);
}

/* Page-load animation */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-in {
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* Staggered list animation */
.stagger-item:nth-child(1)  { animation-delay: 0.00s; }
.stagger-item:nth-child(2)  { animation-delay: 0.05s; }
.stagger-item:nth-child(3)  { animation-delay: 0.10s; }
.stagger-item:nth-child(4)  { animation-delay: 0.15s; }
.stagger-item:nth-child(5)  { animation-delay: 0.20s; }
.stagger-item:nth-child(6)  { animation-delay: 0.25s; }
.stagger-item:nth-child(7)  { animation-delay: 0.30s; }
.stagger-item:nth-child(8)  { animation-delay: 0.35s; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## 4 · TOPBAR / HEADER REDESIGN

### Current State
Dark purple/plum background (`~#6B5B7B`), white text, search bar, LIVE indicator.

### Target State
White/warm-surface background, black sans-serif brand wordmark, subtle bottom border, pill search.

```css
/* ===== TOPBAR ===== */
.topbar,
[class*="topbar"],
[class*="header"],
header.main-header {
  height: var(--topbar-height);
  background: var(--surface-container-lowest);
  border-bottom: 1px solid var(--outline-variant);
  box-shadow: var(--shadow-xs);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-8);
  position: sticky;
  top: 0;
  z-index: 100;

  /* Remove any legacy purple */
  color: var(--on-surface) !important;
}

/* Brand/logo wordmark */
.topbar .brand,
.topbar .logo,
[class*="brand-name"] {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
  color: var(--primary);
  letter-spacing: -0.01em;
  user-select: none;
}

/* Page title in topbar */
.topbar .page-title,
.topbar h1,
[class*="topbar-title"] {
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  font-weight: 600;
  color: var(--on-surface-variant);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

/* Search bar */
.topbar input[type="search"],
.topbar .search-input,
[class*="global-search"] {
  height: 36px;
  padding: 0 var(--space-4);
  padding-left: 36px;  /* icon space */
  background: var(--surface-container-low);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  color: var(--on-surface);
  width: 300px;
  transition: all var(--transition-fast);
}

.topbar input[type="search"]:focus,
.topbar .search-input:focus {
  background: var(--surface-container-lowest);
  border-color: var(--secondary);
  box-shadow: 0 0 0 3px rgba(78, 97, 110, 0.12);
  outline: none;
  width: 360px;
}

.topbar input::placeholder {
  color: var(--outline);
  font-size: var(--text-label-md);
}

/* LIVE indicator — keep the dot, restyle text */
.live-indicator,
[class*="live-badge"] {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  font-weight: 600;
  color: #15803d;
  letter-spacing: 0.05em;
}

/* User avatar */
.topbar .user-avatar,
[class*="avatar"] {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--primary-container);
  color: var(--inverse-primary);
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.topbar .user-avatar:hover { opacity: 0.85; }
```

---

## 5 · SIDEBAR / NAVIGATION REDESIGN

### Current State
Plain white sidebar with grey text, icon + label layout, section labels in caps.

### Target State
Warm `#f5f3f4` surface, clean grouping with dot-separator labels, active item with left accent bar, hover with subtle fill.

```css
/* ===== SIDEBAR ===== */
.sidebar,
[class*="sidebar"],
nav.main-nav {
  width: var(--sidebar-width);
  min-height: 100vh;
  background: var(--surface-container-low);
  border-right: 1px solid var(--outline-variant);
  padding: var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  overflow-y: auto;
  overflow-x: hidden;
}

/* Section Labels (OPERATIONS, TRANSACTIONS, etc.) */
.sidebar .nav-section-label,
[class*="nav-section"] > span,
[class*="sidebar-section-title"] {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--outline);
  padding: var(--space-4) var(--space-3) var(--space-2);
  display: block;
}

/* Add a subtle rule above each section (except first) */
.sidebar .nav-section-label:not(:first-child),
[class*="sidebar-section"]:not(:first-child) .nav-section-label {
  margin-top: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--outline-variant);
}

/* Nav Items */
.sidebar .nav-item,
.sidebar a,
[class*="nav-link"],
[class*="sidebar-item"] {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  font-weight: 500;
  color: var(--on-surface-variant);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  text-decoration: none;
  position: relative;
}

.sidebar .nav-item:hover,
.sidebar a:hover,
[class*="nav-link"]:hover {
  background: var(--surface-container);
  color: var(--on-surface);
}

/* Active state */
.sidebar .nav-item.active,
.sidebar a.active,
[class*="nav-link"].active,
[class*="active"][class*="nav"] {
  background: var(--surface-container-highest);
  color: var(--primary);
  font-weight: 600;
}

/* Active left bar accent */
.sidebar .nav-item.active::before,
.sidebar a.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  background: var(--primary);
  border-radius: 0 var(--radius-full) var(--radius-full) 0;
}

/* Nav icon sizing */
.sidebar .nav-item svg,
.sidebar a svg,
[class*="nav-icon"] {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.7;
}

.sidebar .nav-item.active svg {
  opacity: 1;
}
```

---

## 6 · BUTTONS REDESIGN

```css
/* ===== BUTTONS ===== */

/* Primary Button (Black pill, tactile shadow) */
.btn-primary,
button.btn[data-variant="primary"],
[class*="btn-primary"],
.new-button /* ← the "New" button in topbar */ {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-6);
  background: var(--primary);
  color: var(--on-primary);
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  font-weight: 600;
  letter-spacing: 0.02em;
  border: none;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-btn-primary);
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
  white-space: nowrap;
}

.btn-primary:hover {
  background: #1a1a1a;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: var(--shadow-xs);
}

/* Secondary / Outline button */
.btn-secondary,
button.btn[data-variant="secondary"],
[class*="btn-secondary"],
[class*="btn-outline"] {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-6);
  background: transparent;
  color: var(--on-surface);
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  font-weight: 600;
  border: 1.5px solid var(--outline-variant);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-secondary:hover {
  background: var(--surface-container);
  border-color: var(--outline);
}

/* Icon button (square with icon, rounded) */
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--surface-container);
  border: 1.5px solid var(--outline-variant);
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-icon:hover {
  background: var(--surface-container-high);
  border-color: var(--outline);
}

/* Grid/List toggle buttons */
[class*="view-toggle"],
[class*="toggle-btn"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1.5px solid var(--outline-variant);
  border-radius: var(--radius-xl);
  cursor: pointer;
  color: var(--on-surface-variant);
  transition: all var(--transition-fast);
}

[class*="view-toggle"].active,
[class*="toggle-btn"].active {
  background: var(--surface-container-high);
  color: var(--on-surface);
  border-color: var(--outline);
}
```

---

## 7 · STATUS BADGES REDESIGN

```css
/* ===== STATUS BADGES ===== */

/* Base badge */
.badge,
[class*="status-badge"],
[class*="badge"] {
  display: inline-flex;
  align-items: center;
  padding: 3px var(--space-3);
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  font-weight: 600;
  letter-spacing: 0.04em;
  border: 1px solid transparent;
  white-space: nowrap;
}

/* Delivered */
.badge-delivered,
[class*="badge"][class*="delivered"],
[class*="status-delivered"],
td [class*="delivered"] {
  background: var(--status-delivered-bg);
  color: var(--status-delivered-text);
  border-color: var(--status-delivered-border);
}

/* Confirmed */
.badge-confirmed,
[class*="badge"][class*="confirmed"],
[class*="status-confirmed"],
td [class*="confirmed"] {
  background: var(--status-confirmed-bg);
  color: var(--status-confirmed-text);
  border-color: var(--status-confirmed-border);
}

/* Partial */
.badge-partial,
[class*="badge"][class*="partial"],
[class*="status-partial"],
td [class*="partial"] {
  background: var(--status-partial-bg);
  color: var(--status-partial-text);
  border-color: var(--status-partial-border);
}

/* Draft */
.badge-draft,
[class*="badge"][class*="draft"],
[class*="status-draft"],
td [class*="draft"] {
  background: var(--status-draft-bg);
  color: var(--status-draft-text);
  border-color: var(--status-draft-border);
}

/* Late */
.badge-late,
[class*="badge"][class*="late"],
[class*="status-late"],
td [class*="late"] {
  background: var(--status-late-bg);
  color: var(--status-late-text);
  border-color: var(--status-late-border);
}

/* Blocked */
.badge-blocked,
[class*="badge"][class*="blocked"],
[class*="status-blocked"] {
  background: var(--status-blocked-bg);
  color: var(--status-blocked-text);
  border-color: var(--status-blocked-border);
}
```

---

## 8 · DATA TABLES REDESIGN

### Visual Target
No vertical borders. Horizontal separators only. Serif column headers in uppercase label style. Row hover with warm fill. Monospace/tabular numbers aligned right.

```css
/* ===== DATA TABLES ===== */

.data-table,
[class*="data-table"],
table.main-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-sans);
  font-size: var(--text-body-md);
}

/* Table wrapper card */
.table-card,
[class*="table-container"],
[class*="table-wrapper"] {
  background: var(--surface-container-lowest);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--outline-variant);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

/* Column headers */
.data-table thead tr,
table.main-table thead tr {
  background: var(--surface-container-low);
  border-bottom: 1px solid var(--outline-variant);
}

.data-table thead th,
table.main-table thead th {
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--on-surface-variant);
  white-space: nowrap;
  text-align: left;
  cursor: default;
  user-select: none;
}

/* Right-align numeric columns */
.data-table thead th.col-number,
.data-table thead th.col-price,
.data-table thead th.col-amount,
.data-table thead th:last-child,
th[class*="price"],
th[class*="amount"],
th[class*="total"],
th[class*="qty"],
th[class*="on-hand"],
th[class*="stock"] {
  text-align: right;
}

/* Body rows */
.data-table tbody tr,
table.main-table tbody tr {
  border-bottom: 1px solid var(--outline-variant);
  transition: background var(--transition-fast);
  cursor: pointer;
}

.data-table tbody tr:last-child,
table.main-table tbody tr:last-child {
  border-bottom: none;
}

.data-table tbody tr:hover,
table.main-table tbody tr:hover {
  background: var(--surface-container-low);
}

/* Body cells */
.data-table tbody td,
table.main-table tbody td {
  padding: var(--space-4);
  font-size: var(--text-body-md);
  color: var(--on-surface);
  vertical-align: middle;
}

/* Numeric cells — right align, tabular figures */
.data-table tbody td.col-number,
.data-table tbody td.col-price,
td[class*="price"],
td[class*="amount"],
td[class*="total"],
td[class*="qty"],
td[class*="on-hand"],
td[class*="stock"] {
  text-align: right;
  font-family: var(--font-serif);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

/* SKU / REF chip */
.sku-chip,
td[class*="sku"],
td[class*="ref"] {
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  font-weight: 600;
  color: var(--on-surface-variant);
  letter-spacing: 0.04em;
}

/* Product name cell */
td[class*="product-name"],
.product-name-cell {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-weight: 500;
  color: var(--on-surface);
}

/* Product image thumbnail (in table) */
.product-thumb,
[class*="product-img"],
[class*="product-image"] {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  background: var(--surface-container);
  border: 1px solid var(--outline-variant);
  object-fit: cover;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* "No Image" placeholder state */
.product-thumb.no-image,
[class*="no-img"] {
  background: var(--surface-container-high);
  color: var(--outline);
  font-size: 9px;
  font-family: var(--font-sans);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Category tag (in table) */
.category-tag,
td[class*="category"] span {
  display: inline-flex;
  padding: 2px var(--space-2);
  background: var(--surface-container);
  border-radius: var(--radius-sm);
  font-size: var(--text-label-sm);
  color: var(--on-surface-variant);
  font-weight: 500;
}
```

---

## 9 · FILTER TABS / SEGMENTED CONTROL REDESIGN

These appear above the Sales Orders, Purchase Orders, and Manufacturing tables.

```css
/* ===== FILTER TABS ===== */

.filter-tabs,
[class*="filter-tabs"],
[class*="status-tabs"] {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* Individual tab/pill */
.filter-tab,
[class*="filter-tab"],
[class*="status-tab"] {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-4);
  background: transparent;
  border: 1.5px solid var(--outline-variant);
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  font-weight: 500;
  color: var(--on-surface-variant);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-tab:hover {
  background: var(--surface-container);
  border-color: var(--outline);
  color: var(--on-surface);
}

/* Active state */
.filter-tab.active,
[class*="filter-tab"].active,
[class*="status-tab"].active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
  font-weight: 600;
}

/* Count badge inside tab */
.filter-tab .count,
[class*="tab-count"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: rgba(255,255,255,0.2);
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 700;
}

.filter-tab:not(.active) .count {
  background: var(--surface-container-high);
  color: var(--on-surface);
}
```

---

## 10 · CARDS & KPI STRIPS REDESIGN

### KPI Cards (Dashboard)

```css
/* ===== KPI CARDS ===== */

.kpi-strip,
[class*="kpi-strip"],
[class*="stats-row"] {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

@media (max-width: 1024px) {
  .kpi-strip { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .kpi-strip { grid-template-columns: 1fr; }
}

.kpi-card,
[class*="kpi-card"],
[class*="stat-card"] {
  background: var(--surface-container-lowest);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--outline-variant);
  box-shadow: var(--shadow-md);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  animation: fadeInUp 0.4s ease forwards;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Card eyebrow label */
.kpi-card .kpi-label,
[class*="kpi-label"] {
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--on-surface-variant);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Big metric number */
.kpi-card .kpi-value,
[class*="kpi-value"],
[class*="kpi-number"] {
  font-family: var(--font-serif);
  font-size: var(--text-numbers-lg);
  font-weight: 400;
  color: var(--on-surface);
  line-height: 1;
  letter-spacing: -0.01em;
}

/* Sub-label */
.kpi-card .kpi-sub,
[class*="kpi-sub"] {
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  color: var(--on-surface-variant);
}

/* Alert-colored KPI value */
.kpi-card .kpi-value.danger,
[class*="kpi-value"].danger {
  color: var(--error);
}

/* General panels/cards */
.card,
[class*="-card"],
[class*="panel"] {
  background: var(--surface-container-lowest);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--outline-variant);
  box-shadow: var(--shadow-md);
  padding: var(--space-6);
}
```

---

## 11 · DASHBOARD HERO REDESIGN

The hero already has a good image background. Refine the text treatment.

```css
/* ===== DASHBOARD HERO ===== */

.dashboard-hero,
[class*="hero"],
[class*="greeting-banner"] {
  position: relative;
  border-radius: var(--radius-3xl);
  overflow: hidden;
  min-height: 220px;
  display: flex;
  align-items: flex-end;
  padding: var(--space-8);
  background-color: var(--primary-container); /* fallback */
}

/* Gradient overlay on the image */
.dashboard-hero::before,
[class*="hero"]::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    rgba(0,0,0,0.72) 0%,
    rgba(0,0,0,0.55) 55%,
    rgba(0,0,0,0.20) 100%
  );
  z-index: 1;
}

.dashboard-hero .hero-content,
[class*="hero-content"],
[class*="greeting-content"] {
  position: relative;
  z-index: 2;
  max-width: 520px;
}

/* "SYSTEM LIVE · 9S AGO" tag */
.hero-system-tag,
[class*="system-live"],
[class*="system-tag"] {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.75);
  margin-bottom: var(--space-3);
}

/* "Good morning, Admin." */
.hero-greeting,
[class*="hero-title"],
[class*="greeting-title"] {
  font-family: var(--font-serif);
  font-size: 40px;
  font-weight: 500;
  color: #ffffff;
  line-height: 1.15;
  margin-bottom: var(--space-3);
  letter-spacing: -0.01em;
}

/* Subtitle */
.hero-subtitle,
[class*="hero-sub"],
[class*="greeting-sub"] {
  font-family: var(--font-sans);
  font-size: var(--text-body-md);
  color: rgba(255,255,255,0.80);
  line-height: 1.5;
}

/* Active Alerts / System Status cards on hero */
.hero-stats,
[class*="hero-stats"] {
  position: absolute;
  right: var(--space-8);
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  display: flex;
  gap: var(--space-4);
}

.hero-stat-card {
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.20);
  border-radius: var(--radius-xl);
  padding: var(--space-4) var(--space-6);
  text-align: center;
}

.hero-stat-card .stat-label {
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.70);
  margin-bottom: var(--space-2);
}

.hero-stat-card .stat-value {
  font-family: var(--font-serif);
  font-size: 36px;
  font-weight: 400;
  color: #ffffff;
  line-height: 1;
}

.hero-stat-card .stat-value.optimal {
  color: #4ade80;
  font-size: var(--text-body-lg);
  font-family: var(--font-sans);
  font-weight: 700;
}
```

---

## 12 · PRODUCTS PAGE — GRID CARD VIEW (NEW PATTERN)

**This is the highest-impact change.** The Products page should default to a **card grid** like Flipkart/Amazon product listings, with a toggle to fall back to the original table.

### Implementation Strategy
1. DO NOT remove the existing `<table>` markup
2. Add a CSS class `.view-grid` to the container; when active, hide the table and show the grid
3. The grid renders a new card for each product row (can be generated via a map over the same data)

If the codebase already has a React component that renders products, add a `viewMode` state:

```jsx
// In your Products component, ADD this state (do not modify existing state)
const [viewMode, setViewMode] = React.useState('grid'); // 'grid' | 'list'
```

```css
/* ===== PRODUCTS GRID VIEW ===== */

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-4);
  padding: var(--space-6) 0;
  animation: fadeInUp 0.4s ease forwards;
}

/* Product Card */
.product-card {
  background: var(--surface-container-lowest);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--outline-variant);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base);
  display: flex;
  flex-direction: column;
}

.product-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
  border-color: var(--outline);
}

/* Product image area */
.product-card__image {
  width: 100%;
  aspect-ratio: 4/3;
  background: var(--surface-container);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.product-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.product-card:hover .product-card__image img {
  transform: scale(1.03);
}

/* "No Image" state in card */
.product-card__image--empty {
  flex-direction: column;
  gap: var(--space-2);
  color: var(--outline);
}

.product-card__image--empty svg {
  width: 40px;
  height: 40px;
  opacity: 0.4;
}

.product-card__image--empty span {
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  color: var(--outline);
  letter-spacing: 0.05em;
}

/* SKU chip overlaid on image */
.product-card__sku {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  background: rgba(0,0,0,0.72);
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
}

/* Card body */
.product-card__body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}

/* Product name */
.product-card__name {
  font-family: var(--font-sans);
  font-size: var(--text-body-md);
  font-weight: 600;
  color: var(--on-surface);
  line-height: 1.3;
}

/* Category tag */
.product-card__category {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  background: var(--secondary-container);
  color: var(--on-secondary-container);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  font-weight: 600;
  width: fit-content;
}

/* Price row */
.product-card__pricing {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  margin-top: auto;
  padding-top: var(--space-3);
  border-top: 1px solid var(--outline-variant);
}

.product-card__sales-price {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 500;
  color: var(--on-surface);
  letter-spacing: -0.01em;
}

.product-card__cost-price {
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  color: var(--on-surface-variant);
  text-decoration: line-through;
}

/* Stock pill */
.product-card__stock {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  color: var(--on-surface-variant);
}

.product-card__stock-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: #22c55e;
  flex-shrink: 0;
}

.product-card__stock-dot.low { background: #f97316; }
.product-card__stock-dot.critical { background: var(--error); }
```

### Grid/Table Toggle (add to Products page header)

```jsx
// JSX addition — add this toggle control near the "New" button
// It DOES NOT replace any existing functionality; it only controls CSS class on container

<div className="view-toggle-group">
  <button
    className={`btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
    onClick={() => setViewMode('grid')}
    title="Grid view"
    aria-label="Grid view"
  >
    {/* Grid icon SVG */}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  </button>
  <button
    className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
    onClick={() => setViewMode('list')}
    title="List view"
    aria-label="List view"
  >
    {/* List icon SVG */}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  </button>
</div>
```

```css
.view-toggle-group {
  display: flex;
  gap: var(--space-1);
  background: var(--surface-container);
  padding: 3px;
  border-radius: var(--radius-xl);
}
```

---

## 13 · FORMS REDESIGN

All forms (New Sales Order, New Product, New Purchase Order, etc.) need to feel premium and artisanal, not generic Bootstrap.

### Visual Target
- Label **above** the field, not inside as placeholder
- Warm surface background for the form card
- Rounded inputs (12px) with subtle border
- Focus state: `secondary` color outline with soft glow
- Section grouping inside the form with subtle dividers
- Submit/save button pinned to bottom-right of form

```css
/* ===== FORMS ===== */

/* Form wrapper card */
.form-card,
[class*="form-card"],
form.main-form {
  background: var(--surface-container-lowest);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--outline-variant);
  box-shadow: var(--shadow-md);
  padding: var(--space-8);
  max-width: 800px;
}

/* Form section grouping */
.form-section,
[class*="form-section"] {
  padding: var(--space-6) 0;
  border-bottom: 1px solid var(--outline-variant);
}

.form-section:last-child {
  border-bottom: none;
}

.form-section-title,
[class*="form-section-title"] {
  font-family: var(--font-serif);
  font-size: var(--text-headline-md);
  font-weight: 500;
  color: var(--on-surface);
  margin-bottom: var(--space-4);
}

/* Grid layout for form fields */
.form-grid,
[class*="form-grid"] {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

@media (max-width: 640px) {
  .form-grid { grid-template-columns: 1fr; }
}

/* Field wrapper */
.form-field,
[class*="form-field"],
.field-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Label */
.form-field label,
[class*="form-label"],
label.field-label {
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  font-weight: 600;
  color: var(--on-surface);
  letter-spacing: 0.01em;
}

/* Required asterisk */
.form-field label .required,
label .required {
  color: var(--error);
  margin-left: 2px;
}

/* Hint text */
.form-field .hint,
[class*="field-hint"] {
  font-size: var(--text-label-sm);
  color: var(--on-surface-variant);
  margin-top: var(--space-1);
}

/* Text inputs, selects, textareas */
.form-field input,
.form-field select,
.form-field textarea,
input.field-input,
select.field-input,
textarea.field-input {
  height: 44px;
  padding: 0 var(--space-4);
  background: var(--surface-container-low);
  border: 1.5px solid var(--outline-variant);
  border-radius: var(--radius-lg); /* 12px — precision feel */
  font-family: var(--font-sans);
  font-size: var(--text-body-md);
  color: var(--on-surface);
  width: 100%;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
  appearance: none;
}

.form-field textarea {
  height: auto;
  min-height: 100px;
  padding: var(--space-3) var(--space-4);
  resize: vertical;
  line-height: 1.5;
}

/* Input focus */
.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  background: var(--surface-container-lowest);
  border-color: var(--secondary);
  box-shadow: 0 0 0 3px rgba(78, 97, 110, 0.14);
  outline: none;
}

/* Input error */
.form-field input.error,
.form-field input[aria-invalid="true"] {
  border-color: var(--error);
}

.form-field input.error:focus {
  box-shadow: 0 0 0 3px rgba(186, 26, 26, 0.12);
}

/* Error message */
.form-field .error-msg,
[class*="field-error"] {
  font-size: var(--text-label-sm);
  color: var(--error);
  font-weight: 500;
}

/* Select arrow */
.form-field select {
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2373787b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--space-3) center;
  padding-right: 40px;
}

/* Number input */
input[type="number"] {
  font-family: var(--font-serif);
  font-variant-numeric: tabular-nums;
}

/* Price input with currency symbol */
.price-field {
  position: relative;
}

.price-field .currency-symbol {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  font-family: var(--font-serif);
  color: var(--on-surface-variant);
  pointer-events: none;
}

.price-field input {
  padding-left: 32px;
}

/* Form action bar */
.form-actions,
[class*="form-actions"] {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-6);
  margin-top: var(--space-4);
  border-top: 1px solid var(--outline-variant);
}

/* Image upload area */
.image-upload,
[class*="image-upload"],
[class*="drop-zone"] {
  width: 100%;
  aspect-ratio: 16/9;
  max-height: 180px;
  border: 2px dashed var(--outline-variant);
  border-radius: var(--radius-2xl);
  background: var(--surface-container-low);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.image-upload:hover {
  border-color: var(--secondary);
  background: var(--secondary-container);
}

.image-upload svg {
  width: 36px;
  height: 36px;
  color: var(--outline);
}

.image-upload span {
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  color: var(--on-surface-variant);
  font-weight: 500;
}

/* Inline items table (inside Sales Order form for line items) */
.line-items-table {
  width: 100%;
  border-radius: var(--radius-xl);
  overflow: hidden;
  border: 1px solid var(--outline-variant);
  margin-top: var(--space-4);
}
```

---

## 14 · CONTROL TOWER / ALERT CARDS

```css
/* ===== CONTROL TOWER PANEL ===== */

.control-tower,
[class*="control-tower"] {
  background: var(--surface-container-lowest);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--outline-variant);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.control-tower__header,
[class*="control-tower-header"] {
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--outline-variant);
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  font-weight: 700;
  color: var(--on-surface);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Alert cards inside control tower */
.alert-card,
[class*="alert-card"],
[class*="control-alert"] {
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--outline-variant);
  border-left: 3px solid var(--secondary);
  background: var(--surface-container-lowest);
  transition: background var(--transition-fast);
}

.alert-card:hover {
  background: var(--surface-container-low);
}

.alert-card:last-child {
  border-bottom: none;
}

.alert-card__title {
  font-family: var(--font-sans);
  font-size: var(--text-body-md);
  font-weight: 600;
  color: var(--on-surface);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.alert-card__body {
  font-size: var(--text-label-md);
  color: var(--on-surface-variant);
  margin-bottom: var(--space-2);
}

.alert-card__action {
  font-family: var(--font-sans);
  font-size: var(--text-label-sm);
  font-weight: 600;
  color: var(--secondary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  transition: gap var(--transition-spring);
}

.alert-card__action:hover {
  gap: var(--space-2);
}

/* Alert border color variants */
.alert-card.critical { border-left-color: var(--error); }
.alert-card.warning  { border-left-color: #f97316; }
.alert-card.info     { border-left-color: var(--secondary); }
```

---

## 15 · PAGE LAYOUT WRAPPER

```css
/* ===== APP SHELL ===== */

.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--surface);
}

.main-content,
[class*="main-content"],
.page-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.page-container,
[class*="page-content"],
.content-area {
  padding: var(--space-8) var(--space-8);
  flex: 1;
  max-width: 1440px;
  margin: 0 auto;
  width: 100%;
  animation: fadeInUp 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@media (max-width: 768px) {
  .page-container { padding: var(--space-4); }
}

/* Page-level header row */
.page-header,
[class*="page-header"] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
  gap: var(--space-4);
}

.page-header__title,
[class*="page-title"] {
  font-family: var(--font-serif);
  font-size: var(--text-headline-lg);
  font-weight: 500;
  color: var(--on-surface);
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.page-header__title .count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 var(--space-2);
  background: var(--surface-container-high);
  color: var(--on-surface-variant);
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  font-weight: 700;
  margin-left: var(--space-3);
  vertical-align: middle;
}

/* Section spacing */
.section-gap {
  margin-top: var(--space-8);
}
```

---

## 16 · OPERATIONS QUEUE TABS

```css
/* ===== OPERATIONS QUEUE ===== */

.ops-queue,
[class*="ops-queue"],
[class*="operations-queue"] {
  background: var(--surface-container-lowest);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--outline-variant);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.ops-queue__header {
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--outline-variant);
}

.ops-queue__title {
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  font-weight: 700;
  color: var(--on-surface);
  letter-spacing: 0.01em;
}

/* Tab bar for Sales / Purchase / Manufacturing */
.ops-tabs,
[class*="ops-tabs"] {
  display: flex;
  border-bottom: 1px solid var(--outline-variant);
  padding: 0 var(--space-6);
}

.ops-tab,
[class*="ops-tab"] {
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  font-weight: 500;
  color: var(--on-surface-variant);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color var(--transition-fast), border-color var(--transition-fast);
  margin-bottom: -1px;
}

.ops-tab:hover {
  color: var(--on-surface);
}

.ops-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}
```

---

## 17 · FAB CHATBOT BUTTON

Add this component globally, outside the main content area (e.g., in `App.jsx` or `Layout.jsx`).

**IMPORTANT: Do NOT add inside any `<form>` element. Do NOT add event handlers that interfere with existing forms. This is purely additive.**

```jsx
// Add to App.jsx or Layout.jsx — outside the main routing/content area
// This is purely cosmetic and uses its own isolated state

function ChatbotFAB() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      {/* FAB Button */}
      <button
        className="chatbot-fab"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="Open AI assistant"
        title="AI Assistant"
        style={{ /* inline styles as fallback */ }}
      >
        {isOpen ? (
          /* Close icon */
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          /* Chat icon */
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z"/>
            <circle cx="8.5" cy="10" r="1.5"/><circle cx="12" cy="10" r="1.5"/><circle cx="15.5" cy="10" r="1.5"/>
          </svg>
        )}
      </button>

      {/* Chat popover */}
      {isOpen && (
        <div className="chatbot-popover">
          <div className="chatbot-popover__header">
            <span className="chatbot-popover__title">B-Cart Assistant</span>
            <div className="chatbot-popover__dot" />
          </div>
          <div className="chatbot-popover__body">
            <p className="chatbot-greeting">
              Ask me anything about your operations, inventory, or orders.
            </p>
          </div>
          <div className="chatbot-popover__input-row">
            <input
              type="text"
              placeholder="Ask something..."
              className="chatbot-input"
              onKeyDown={e => {
                /* placeholder — integrate real chatbot here */
                e.stopPropagation();
              }}
            />
            <button className="chatbot-send" aria-label="Send">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21L23 12 2 3v7l15 2-15 2v7z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

```css
/* ===== FAB CHATBOT ===== */

.chatbot-fab {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: var(--on-primary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 0 0 rgba(0,0,0,0.15),
    0 4px 16px rgba(0,0,0,0.25),
    0 8px 32px rgba(0,0,0,0.15);
  z-index: 1000;
  transition: transform var(--transition-spring), box-shadow var(--transition-base), background var(--transition-fast);
}

.chatbot-fab:hover {
  transform: scale(1.08) translateY(-2px);
  box-shadow:
    0 6px 24px rgba(0,0,0,0.30),
    0 12px 40px rgba(0,0,0,0.20);
}

.chatbot-fab:active {
  transform: scale(0.96);
}

/* Pulse ring animation when closed */
.chatbot-fab::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: var(--radius-full);
  border: 2px solid rgba(0,0,0,0.15);
  animation: fab-pulse 2.5s ease-in-out infinite;
}

@keyframes fab-pulse {
  0%, 100% { opacity: 0; transform: scale(1); }
  50%       { opacity: 1; transform: scale(1.1); }
}

/* Chat popover */
.chatbot-popover {
  position: fixed;
  bottom: calc(var(--space-6) + 64px);
  right: var(--space-6);
  width: 340px;
  background: var(--surface-container-lowest);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--outline-variant);
  box-shadow: var(--shadow-xl);
  z-index: 999;
  overflow: hidden;
  animation: fadeInUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.chatbot-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  background: var(--primary);
  color: var(--on-primary);
}

.chatbot-popover__title {
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 500;
}

.chatbot-popover__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: #4ade80;
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.6);
  animation: fab-pulse 2s ease-in-out infinite;
}

.chatbot-popover__body {
  padding: var(--space-4) var(--space-6);
  min-height: 180px;
  background: var(--surface-container-low);
}

.chatbot-greeting {
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  color: var(--on-surface-variant);
  line-height: 1.5;
}

.chatbot-popover__input-row {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--outline-variant);
}

.chatbot-input {
  flex: 1;
  height: 38px;
  padding: 0 var(--space-3);
  background: var(--surface-container);
  border: 1.5px solid var(--outline-variant);
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
  font-size: var(--text-label-md);
  color: var(--on-surface);
  transition: border-color var(--transition-fast);
}

.chatbot-input:focus {
  border-color: var(--secondary);
  outline: none;
}

.chatbot-send {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: var(--on-primary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity var(--transition-fast);
}

.chatbot-send:hover { opacity: 0.85; }
```

---

## 18 · PAGE-BY-PAGE IMPLEMENTATION NOTES

### 18.1 Dashboard
- Hero: wrap greeting text in `.hero-greeting` (EB Garamond). Keep background image as-is.
- KPI strip: wrap the 4 stat cards in a 4-col grid. Apply `.kpi-card` styling. Use EB Garamond for the numbers.
- Operations Queue: wrap in `.ops-queue`. The inner tabs (Sales/Purchase/Manufacturing) get `.ops-tabs/.ops-tab` treatment.
- Control Tower: wrap in `.control-tower`. Each alert item gets `.alert-card`.
- Row layout: the dashboard body should be a 2-column grid (`minmax(0, 1fr)` / `320px`) at desktop, stacking on mobile.

### 18.2 Products Page
- Add `viewMode` state, default to `'grid'`
- Add the grid/list toggle buttons to the page header
- Render `<div class="products-grid">` with product cards when `viewMode === 'grid'`
- Keep the existing `<table>` accessible but hidden when `viewMode !== 'list'` via CSS:
  ```css
  .products-table-wrapper { display: none; }
  .view-mode-list .products-grid { display: none; }
  .view-mode-list .products-table-wrapper { display: block; }
  ```
- Product cards: use `.product-card` structure. For products without images, show the SVG placeholder (camera icon + "Add Image" text).
- The "New" button remains fully functional.

### 18.3 Sales Orders Page
- Status filter tabs → `.filter-tab` pills
- The "All 3" active tab → `.filter-tab.active` with black background
- "My 0" pill on the right → secondary outlined pill
- Table: apply `.table-card` wrapper, `.data-table` styles
- Status badges: `Delivered` → `.badge-delivered`, `Partial` → `.badge-partial`, `Confirmed` → `.badge-confirmed`
- Count badge next to "Sales Orders" title → `.count-badge`

### 18.4 Purchase Orders Page
- Same table and badge treatment as Sales Orders
- Status variants may include: Draft, Ordered, Received, Cancelled

### 18.5 Manufacturing Page
- Same layout. Status variants: Draft, Confirmed, In Progress, Done, Blocked

### 18.6 Bills of Materials
- Table view with BOM line items
- Use `.category-tag` chips for product categories

### 18.7 Intelligence Pages (Smart Procurement, Vendor Scores, Bottleneck Radar, Stock Ledger, Product Passports)
- These pages are data-heavy; apply table styles consistently
- Vendor Scores: could use card-based scorecard layout (like KPI cards but for vendors)
- Bottleneck Radar: if it has a chart or visual, keep the chart untouched, only restyle the wrapper card

### 18.8 New/Edit Forms (all pages)
- `.form-card` wrapper
- Inputs get the redesigned field treatment
- Image upload area for products
- "Save" button → `.btn-primary` (pill, black, with shadow)
- "Cancel" / "Discard" → `.btn-secondary`

---

## 19 · IMPLEMENTATION ORDER

Follow this sequence to minimize risk of breaking things:

```
Phase 1 — Token Foundation (0 risk, fully additive)
  1. Add font imports to index.html
  2. Inject CSS custom properties (:root tokens) into globals.css
  3. Add base reset + scrollbar styles
  4. Add animation keyframes

Phase 2 — Global Layout (low risk)
  5. Restyle topbar (color, font, search shape)
  6. Restyle sidebar (background, active states, section labels)
  7. Add .page-container padding and animation

Phase 3 — Component Primitives (medium risk — test after each)
  8. Buttons (primary, secondary, icon)
  9. Status badges
  10. Filter tabs / segmented controls

Phase 4 — Data Surfaces (medium risk)
  11. Table wrapper card
  12. Table header styles
  13. Table row hover
  14. KPI cards

Phase 5 — High-Impact Pages (higher risk — test logic after each)
  15. Dashboard hero typography
  16. Products: add grid view (do NOT remove table)
  17. Sales Orders: badge + tab styling
  18. Purchase Orders: same
  19. Manufacturing: same

Phase 6 — Forms (test form submission after each)
  20. Form card wrapper
  21. Label styles
  22. Input field styles
  23. Form action bar

Phase 7 — Additions (fully additive, no risk)
  24. FAB chatbot component
  25. Control Tower / Alert cards
  26. Stagger animations on list items
```

---

## 20 · TAILWIND CONFIG EXTENSION (if using Tailwind)

If the project uses Tailwind CSS, add these to `tailwind.config.js` instead of or alongside CSS custom properties:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#fbf9f9',
          dim: '#dbd9da',
          bright: '#ffffff',
          'container-lowest': '#ffffff',
          'container-low': '#f5f3f4',
          container: '#efedee',
          'container-high': '#e9e8e8',
          'container-highest': '#e4e2e3',
        },
        primary: {
          DEFAULT: '#000000',
          container: '#091e28',
          'on-container': '#738793',
          'inv': '#b5c9d7',
        },
        secondary: {
          DEFAULT: '#4e616e',
          container: '#d1e5f5',
          'on-container': '#546774',
        },
        'on-surface': '#1b1c1c',
        'on-surface-variant': '#43474b',
        outline: '#73787b',
        'outline-variant': '#c3c7cb',
      },
      fontFamily: {
        serif: ['"EB Garamond"', 'Georgia', 'serif'],
        sans:  ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm:   '0.25rem',
        md:   '0.75rem',
        lg:   '1rem',
        xl:   '1.5rem',
        '2xl': '2rem',
        '3xl': '2.5rem',
      },
      boxShadow: {
        xs:  '0 1px 2px rgba(0,0,0,0.05)',
        sm:  '0 2px 4px rgba(0,0,0,0.06)',
        md:  '0 4px 16px rgba(0,0,0,0.08)',
        lg:  '0 8px 32px rgba(0,0,0,0.10)',
        xl:  '0 16px 48px rgba(0,0,0,0.12)',
        'btn': '0 1px 0 rgba(255,255,255,0.1) inset, 0 2px 4px rgba(0,0,0,0.20), 0 4px 12px rgba(0,0,0,0.15)',
      },
    },
  },
};
```

---

## 21 · QUALITY CHECKLIST (verify before marking complete)

```
[ ] Fonts: EB Garamond loads correctly for titles and KPI numbers
[ ] Fonts: Hanken Grotesk loads correctly for all body text and labels
[ ] Topbar: no longer dark purple, background is white/warm-white
[ ] Sidebar: warm surface background, active item has left accent
[ ] Buttons: "New" button is black pill with shadow, lifts on hover
[ ] Badges: Delivered=green, Confirmed=blue, Partial=amber, Draft=grey
[ ] Filter tabs: active tab is black pill, inactive are outlined pills
[ ] Tables: no vertical borders, header is slightly tinted, rows highlight on hover
[ ] KPI numbers: EB Garamond serif, large and elegant
[ ] Products: grid view is default, cards show image area, SKU chip, pricing in serif
[ ] Products: table view still works and is togglable
[ ] All forms: labels above inputs, focus state with soft blue glow
[ ] FAB: visible bottom-right, opens/closes chat panel, does not break any form
[ ] Dashboard hero: "Good morning, Admin." is EB Garamond serif, large
[ ] No layout breaks on 1280px, 1024px, 768px, 375px viewports
[ ] No JS errors in console after styling changes
[ ] All existing form submissions still work (Sales Order, Purchase, etc.)
[ ] All API calls still fire correctly (check Network tab)
[ ] All IDs, data attributes, and event handlers are untouched
[ ] Page transitions have fadeInUp animation
[ ] prefers-reduced-motion is respected (no animation glitches)
```

---

## 22 · REFERENCE IMAGES & INSPIRATION NOTES

When implementing, keep these visual references open:

| Element | Reference |
|---|---|
| Product card grid | Amazon / Flipkart product listing cards — image on top, name, category, price |
| KPI cards | Linear's sprint overview tiles — big number, small label below |
| Status badges | Vercel deployment status pills — minimal, color-coded, no heavy backgrounds |
| Form inputs | Stripe's checkout forms — clean label-above, gentle focus glow |
| Sidebar | Notion's sidebar — minimal, quiet, active item subtly highlighted |
| Topbar | Linear's command palette bar — white, single search, functional |
| Overall aesthetic | Artisan Furniture Studio × Premium SaaS — think Hem.com meets Linear |
| FAB | Google Material 3 FAB — circular, elevated, with spring animation |

---

## 23 · NOTES ON "VANILLA LIGHT THEMED"

The user specifically wants **vanilla light** — this means:
- No dark mode toggle (skip it entirely)
- No heavy gradients or glassmorphism (only in hero overlay and FAB pulse)
- No bright accent colors dominating the page (black is the "brand" color)
- Warmth comes from `#fbf9f9` and `#f5f3f4` surfaces, not from yellow/orange accents
- White space is generous — do not cram elements together
- Tables should feel "editorial" (like a well-designed newspaper layout), not like Excel

---

*End of B-Cart Design Overhaul Master Prompt · v1.0*
*Authored for Artisanal Operations design system · June 2026*
