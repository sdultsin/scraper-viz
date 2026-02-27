# Scraper Visualization App - Specification

## Overview

A real-time web visualization of marketplace scrapers running in the background. Think "mission control for web scrapers" - a clean, dimensional 2D interface showing agents deploying workers, searches executing, and results flowing in. The vibe is an engineer's hobby project render - something you'd leave running on a second monitor because it looks cool.

---

## Architecture

### Communication Layer

**WebSocket Server** (runs alongside scrapers)
- Each scraper emits events to a central WebSocket server
- Events: `agent:spawn`, `worker:spawn`, `search:start`, `search:complete`, `listing:found`, `listing:filtered`, `listing:matched`, `error`
- Server broadcasts to all connected visualization clients

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ FameSwap Scraper│────▶│              │     │                 │
├─────────────────┤     │  WebSocket   │────▶│  Visualization  │
│ SWAPD Scraper   │────▶│    Server    │     │    (Browser)    │
├─────────────────┤     │   :3847      │     │                 │
│ Z2U Scraper     │────▶│              │     │                 │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

**Event Schema:**
```typescript
interface ScraperEvent {
  type: 'agent:spawn' | 'worker:spawn' | 'search:start' | 'search:complete' |
        'listing:found' | 'listing:filtered' | 'listing:matched' | 'cycle:start' | 'cycle:end';
  source: 'fameswap' | 'swapd' | 'z2u';
  timestamp: number;
  data: {
    id?: string;           // Worker/search ID
    parentId?: string;     // Parent agent ID
    label?: string;        // "twitter ai account", "Page 3", etc.
    status?: string;       // For progress updates
    listing?: object;      // For listing events
    reason?: string;       // For filtered listings (why rejected)
  };
}
```

### File Structure

```
tools/scraper-viz/
├── SPEC.md                 # This file
├── server/
│   ├── index.js            # WebSocket server + static file serving
│   └── package.json
├── client/
│   ├── index.html
│   ├── styles.css
│   ├── app.js              # Main visualization logic
│   ├── components/
│   │   ├── Canvas.js       # Node graph rendering
│   │   ├── Dashboard.js    # Stats sidebar
│   │   └── EventFeed.js    # Live event stream
│   └── utils/
│       ├── layout.js       # Force-directed graph positioning
│       └── animations.js   # Easing, transitions
└── lib/
    └── scraper-emitter.js  # Drop-in module for scrapers to emit events
```

---

## Visual Design

### Color Palette

```css
:root {
  /* Background layers */
  --bg-deep: #0a0a0f;           /* Deepest background */
  --bg-mid: #12121a;            /* Card backgrounds */
  --bg-surface: #1a1a24;        /* Elevated surfaces */

  /* Accent colors by scraper */
  --accent-fameswap: #6366f1;   /* Indigo */
  --accent-swapd: #22d3ee;      /* Cyan */
  --accent-z2u: #a855f7;        /* Purple */

  /* Status colors */
  --status-active: #22c55e;     /* Green - running */
  --status-pending: #eab308;    /* Yellow - waiting */
  --status-complete: #6366f1;   /* Indigo - done */
  --status-filtered: #ef4444;   /* Red - rejected */
  --status-matched: #10b981;    /* Emerald - success */

  /* Text */
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #475569;

  /* Effects */
  --glow-intensity: 0.6;
  --line-opacity: 0.3;
}
```

### Typography

- **Font:** Inter or SF Mono for that clean engineering aesthetic
- **Sizes:** 11px labels, 13px body, 16px headings, 32px hero numbers
- **Weight:** 400 regular, 500 medium for emphasis

### Depth & Dimension Effects

1. **Layered shadows** - Multiple box-shadows at different offsets create floating effect
2. **Subtle gradients** - Background has radial gradient from center (slightly lighter)
3. **Glow effects** - Active nodes emit soft colored glow matching their accent
4. **Glass morphism** - Dashboard cards have slight backdrop blur + transparency
5. **Connection lines** - Gradient lines with animated dashes flowing toward children

---

## Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌─────────────────────────────────────────────┐  ┌──────────────────┐ │
│  │                                             │  │                  │ │
│  │                                             │  │   STATS PANEL    │ │
│  │              NODE GRAPH                     │  │                  │ │
│  │           (Main Canvas)                     │  │  ┌────────────┐  │ │
│  │                                             │  │  │ Searches   │  │ │
│  │         ┌───┐                               │  │  │   47/120   │  │ │
│  │         │ O │ ← Orchestrator                │  │  └────────────┘  │ │
│  │         └─┬─┘                               │  │                  │ │
│  │      ┌────┼────┐                            │  │  ┌────────────┐  │ │
│  │    ┌─┴─┐┌─┴─┐┌─┴─┐                          │  │  │ Listings   │  │ │
│  │    │ F ││ S ││ Z │ ← Scraper Agents         │  │  │  Found: 89 │  │ │
│  │    └─┬─┘└─┬─┘└───┘                          │  │  │  Matched: 6│  │ │
│  │      │    │                                 │  │  └────────────┘  │ │
│  │    ┌─┴─┐┌─┴─┐                               │  │                  │ │
│  │    │ w ││ w │ ← Workers/Searches            │  │  ┌────────────┐  │ │
│  │    └───┘└───┘                               │  │  │ By Source  │  │ │
│  │                                             │  │  │ ━━━━━━━━━  │  │ │
│  │                                             │  │  └────────────┘  │ │
│  │                                             │  │                  │ │
│  └─────────────────────────────────────────────┘  └──────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ EVENT FEED (scrolling log of recent events)                         ││
│  │ ● SWAPD search:start "twitter ai account"                           ││
│  │ ○ FameSwap listing:filtered (blocked_category: crypto)              ││
│  │ ★ SWAPD listing:matched! @TechNewsDaily - 1.2k followers - $180     ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

**Proportions:**
- Canvas: 70% width
- Stats Panel: 30% width, right side
- Event Feed: 100% width, ~120px height, bottom

---

## Node Graph Specifications

### Node Types

| Type | Shape | Size | Visual |
|------|-------|------|--------|
| Orchestrator | Circle | 48px | Pulsing white glow, central position |
| Scraper Agent | Rounded rect | 40x28px | Source color, label inside |
| Worker | Circle | 20px | Dimmer version of parent color |
| Search | Pill | auto-width | Shows search term, animates when active |

### Node States

- **Idle:** Base color, no effects
- **Active:** Glowing border, subtle pulse animation
- **Complete:** Checkmark icon, fades slightly
- **Error:** Red tint, shake animation

### Connection Lines

- SVG paths with `stroke-dasharray` animation (flowing dots toward children)
- Color inherits from parent node
- Opacity: 0.3 idle, 0.6 when data flowing
- Bezier curves, not straight lines

### Layout Algorithm

Force-directed with constraints:
- Orchestrator pinned to top-center
- Scraper agents in horizontal row below
- Workers/searches fan out below their parent
- Smooth animated transitions when nodes added/removed

---

## Stats Dashboard Components

### 1. Progress Ring (Hero)
Large circular progress indicator showing overall completion.
- Percentage in center (big number)
- "47 of 120 searches" below
- Ring color matches overall status

### 2. Listings Counter
```
┌─────────────────────────┐
│  LISTINGS               │
│  ━━━━━━━━━━━━━━━━━━━━━ │
│  Found      89          │
│  Filtered   71          │
│  Matched     6  ★       │
└─────────────────────────┘
```

### 3. Source Breakdown
Mini bar chart or segmented bar:
```
FameSwap  ████████████░░░░  67%
SWAPD     ████████░░░░░░░░  45%
Z2U       ██░░░░░░░░░░░░░░  12%
```

### 4. Filter Breakdown (expandable)
What's getting filtered out:
```
blocked_category    34
low_niche_score     22
wtb_title            8
over_budget          5
service_content      2
```

### 5. Recent Matches (mini cards)
Last 3-5 matched listings:
```
┌─────────────────────────┐
│ @TechNewsDaily          │
│ 1.2k followers · $180   │
│ SWAPD · 2m ago          │
└─────────────────────────┘
```

### 6. Session Timer
```
Running: 02:34:17
```

---

## Event Feed

Scrolling log at bottom. Each event is one line:

```
● [SWAPD] search:start "twitter ai account"
● [FameSwap] worker:spawn Page 3
○ [SWAPD] listing:filtered - blocked_category
★ [SWAPD] listing:matched @TechNewsDaily (1.2k, $180)
```

**Icons:**
- `●` = activity (search, spawn)
- `○` = filtered/rejected (dimmer)
- `★` = match (highlighted, accent color)
- `⚠` = error (red)

**Behavior:**
- Auto-scroll to bottom
- Max 50 visible entries
- Click to pause auto-scroll
- Hover on entry highlights corresponding node

---

## Animations

### Node Spawn
1. Node fades in from 0 opacity + slight scale up (0.8 → 1.0)
2. Connection line draws from parent (SVG path animation)
3. Duration: 300ms, ease-out

### Search Active
1. Pill node pulses (scale 1.0 → 1.05 → 1.0)
2. Glow intensity increases
3. Connection line opacity increases, dash animation speeds up

### Listing Found
1. Small particle bursts from search node
2. Particle travels toward stats panel
3. Stats counter increments with slight bounce

### Match Found
1. Larger particle burst (celebratory)
2. Node flashes bright
3. Stats panel "Matched" counter glows momentarily
4. Mini card slides in from right

### Data Flow
- Animated dashes on connection lines
- Speed indicates activity level
- Direction always parent → child

---

## Tech Stack

### Server
- **Node.js** + **ws** (WebSocket library)
- Static file serving with built-in http module (no Express needed)
- Port: 3847

### Client
- **Vanilla JS** (no framework - keeps it fast and simple)
- **Canvas 2D** for node graph (or SVG for easier styling)
- CSS animations for UI elements
- Optional: **D3.js** for force-directed layout math

### Scraper Integration
Drop-in module:
```javascript
// In each scraper, add at top:
import { emitter } from '../scraper-viz/lib/scraper-emitter.js';

// Then emit events:
emitter.spawn('worker', { id: 'page-3', label: 'Page 3' });
emitter.searchStart('twitter ai account');
emitter.listingFound({ title: '...', url: '...' });
emitter.listingMatched({ title: '...', price: 180, followers: 1200 });
emitter.searchComplete('twitter ai account');
```

---

## Implementation Order

1. **Server + Emitter Module** - Get events flowing
2. **Basic HTML/CSS** - Layout with placeholder content
3. **WebSocket Client** - Connect and log events
4. **Stats Dashboard** - Wire up counters
5. **Event Feed** - Scrolling log
6. **Node Graph** - Canvas/SVG rendering
7. **Animations** - Polish and effects
8. **Scraper Integration** - Add emitter calls to existing scrapers

---

## Nice-to-Haves (If Time)

- Sound effects (subtle blips for matches)
- Keyboard shortcut to toggle event feed
- Click node to filter event feed to that source
- Export session stats as JSON
- Dark/light theme toggle (but dark is primary)
- Fullscreen mode for presentations

---

## Running It

```bash
# Terminal 1: Start viz server
cd tools/scraper-viz/server
npm install
npm start
# Opens http://localhost:3847

# Terminal 2-4: Start scrapers (they auto-connect to viz)
cd tools/fameswap-scraper && npm start
cd tools/swapd-scraper && npm start
cd tools/z2u-scraper && npm start
```

---

## Reference Aesthetics

- Vercel's deployment graphs
- Linear's UI (depth, glass effects)
- Raycast's command palette (clean, dimensional)
- GitHub's contribution graph (data viz simplicity)
- Stripe's dashboard (typography, spacing)

The goal: Something you'd screenshot and post to Twitter because it looks cool.
