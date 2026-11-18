# Microverse

Microverse is a cozy pixel-art ecosystem sandbox built with HTML, CSS, vanilla JavaScript, and the HTML Canvas API. Create and edit a small grassland world, introduce rabbits and wolves, then watch autonomous predator-prey dynamics unfold.

## Features
- **World editing (paused):** Select tiles, inspect terrain, paint grass/dirt/trees/bushes/rocks/water, erase to grass, and click-drag to paint with brush preview.
- **Brush sizes:** Paint terrain with 1×1, 3×3, or 5×5 brushes; the canvas preview shows the active area.
- **Creature interaction:** Place rabbits/wolves on valid land tiles, select creatures or tiles for inspection, view energy/hunger/age/state/status and wolf hunt counts.
- **Simulation controls:** Play/pause, reset simulation on current terrain, new/regenerated worlds, 1x/2x/4x speeds (fixed-timestep simulation), live time and status.
- **Ecosystem mechanics:** Rabbits graze/regrow-dependent survival, flee predators, reproduce and age; wolves search/chase/hunt/eat/rest/reproduce and age; grass depletes and regrows over time.
- **Analytics:** Population/grass history graph (canvas), readable capped event log, ecosystem totals (populations, births, deaths, successful hunts).
- **Ecosystem challenges:** Rabbit Refuge, Balanced Meadow, and Wolf’s First Hunt scenarios with live progress, win/fail conditions, and one-click restart.
- **Save & load:** LocalStorage world saves with naming, overwrite confirmation, load/delete, and safe handling of invalid/outdated data.
- **UX polish:** Tutorial overlay, settings (sound, animations, grid, stats/analytics, default speed), tooltips, toasts, crisp pixel rendering, and subtle environmental/creature animations.

## Live deployment

Play Microverse at [https://abdullah-al-noman001.github.io/microverse/](https://abdullah-al-noman001.github.io/microverse/). The site is deployed from the repository root on the `main` branch with GitHub Pages.

The deployment serves the project as a static site. Keep `index.html`, `style.css`, and the `js/` ES modules at their current relative paths. Each push to `main` triggers a Pages build and deployment; check the repository Actions tab for its status.

## Run locally
No build step or dependencies required.

1. Open the project folder in VS Code.
2. Start **Live Server** (recommended) from `index.html`.
   - You can also serve it with any simple static file server.
3. Play in a desktop browser.

> Note: ES modules are used, so opening `index.html` directly via `file://` may not work in all browsers.

## Controls
- **Select tool:** Click tiles/creatures to inspect.
- **Terrain/creature tools:** Pause simulation, choose a brush, click or drag on canvas to edit/place.
- **Brush size:** Choose 1×1, 3×3, or 5×5 for terrain painting; creature placement remains single-tile.
- **Playback:** Play/Pause, 1x/2x/4x speed, Reset Sim (keeps terrain), New/Reset world actions in top bar.
- **Shortcuts:** `Space` play/pause, `1/2/4` speed, `G` toggle grid, `Esc` close overlays/clear selection.

## Save data
Saves and preferences are stored in browser LocalStorage (`microverse.saves.v1`, `microverse.prefs.v1`). Clearing site data removes them.

## Project structure
- `index.html` — UI layout and overlays
- `style.css` — visual styling
- `js/main.js` — app orchestration, UI/input, rendering loop, save/load/settings
- `js/world.js` — terrain generation, tile rules, editing, regrowth
- `js/entities.js` — rabbit/wolf definitions and helpers
- `js/simulation.js` — fixed-step simulation, AI, interactions, events/history, serialization
- `js/renderer.js` — canvas rendering and visual effects
- `js/storage.js` — LocalStorage persistence helpers

## Notes
- Sound effects are simple generated tones (no external/copyrighted audio).
- Populations and resources are balanced for fluctuation but outcomes depend on player edits and chance.
