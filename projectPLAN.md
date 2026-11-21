# Microverse Project Plan

## Product direction

**Microverse is a cozy, story-generating nature sandbox.** Players shape a small living world, introduce species, and gently intervene while ecosystems change in surprising ways. The fun comes from watching cause and effect, discovering a world's personality, and creating little stories worth sharing.

Microverse can use the broad, playful god-sandbox loop of making a world, adding life, observing it, and intervening. Its identity should come from what the world cares about: habitats, seasonal pressure, animal memory, ecological relationships, and the stories those systems produce. Civilizations, wars, and a large catalogue of destructive powers are not the central fantasy.

## Creative identity

### Design pillars

1. **Nature is the main character.** Habitats, food webs, weather, and migration should drive the simulation. Animals are participants in a living landscape, not just units to spawn.
2. **Small actions create visible ripples.** A patch of rain should change plant growth, which can change where animals gather, which can change predator behavior. The player should be able to see and understand the chain.
3. **The world remembers.** Meaningful places and events can leave visible traces: a grove animals return to, a burned patch recovering, or a waterhole that becomes a meeting place.
4. **The player is a caretaker and experimenter.** Offer nurturing, curious, and chaotic interventions. Avoid making destruction the only exciting form of control.
5. **Stories emerge from systems.** The game should summarize interesting events in plain language and let players jump from a story to the place where it happened.
6. **Cozy presentation, honest simulation.** Keep the pixel-art warmth, but make population changes and consequences legible instead of hiding them behind opaque randomness.

### The Microverse play loop

**Shape → Seed → Nudge → Witness → Remember → Remix**

- Shape a habitat with terrain and brush tools.
- Seed it with animals and plants.
- Nudge conditions with a small set of nature powers.
- Witness populations, movement, and habitats change.
- Remember what happened through world marks, timelines, and story cards.
- Remix the world, save it, or share a scenario with someone else.

### What makes it distinct

- Make ecological relationships and recovery the main source of drama.
- Let local conditions influence behavior and, later, gradual adaptation.
- Give each generated world a few understandable quirks that affect play.
- Turn simulation data into memorable, spatial stories.
- Build a calm-to-chaotic range of interventions, from rain and sanctuary to fire and harsh weather.
- Use original names, visual language, interface layout, art, and rules. Treat other god sandboxes as genre references, not templates to reproduce.

## Current foundation

Microverse currently has a 40×25 pixel-art world, terrain painting, rabbits and wolves, autonomous predator-prey behavior, grass depletion and regrowth, simulation speed and pause controls, an event log, population history, saves, and three ecosystem challenges. Terrain brush sizes of 1×1, 3×3, and 5×5 are the first step toward broader world-shaping tools.

The project is plain HTML, CSS, and JavaScript modules with no build step. Keep that lightweight setup while it remains useful. Introduce new modules only when a system has enough behavior to deserve a clear boundary.

## Current implementation handoff

This section is the source of truth for an agent resuming work. Check the repository and this section before making changes; do not assume earlier chat context is available.

### Implemented now

- The app is a static HTML/CSS/vanilla JavaScript project. `index.html` loads `js/main.js` as an ES module.
- The default world is 40×25 tiles with 16-pixel tiles. World dimensions are currently fixed by `WIDTH` and `HEIGHT` in `js/main.js`.
- Terrain tools paint grass, dirt, water, trees, bushes, and rocks; there are also erase and single-tile rabbit/wolf placement tools.
- Terrain brush sizes are 1×1, 3×3, and 5×5. Shapes are Square and Round. Round brushes include tile offsets whose squared distance from the center is at most the squared radius: 3×3 Round covers 5 cells, and 5×5 Round covers 13.
- Terrain brush stroke de-duplication uses `paintedStrokeTiles` in `js/main.js`; previews are drawn by `drawBrushPreview` in `js/renderer.js`.
- Rabbits and wolves, grass regrowth, simulation controls, event log, analytics, local saves, and three challenge scenarios already exist.

### Immediate handoff: build item 7

Status: **items 2–6, 44 complete (item 6 user-verified 2026-11-21).**

**2026-11-21 progress:**
- **Item 6 complete (user-verified):** Meadow/Wetland/Woodland presets with named/bounded terrain/resource params and next-world preset selector; visible distinction across sizes, next-world-only behavior, save/load/challenges unaffected.

Next agent should: build **item 7 (world character card)** — give each generated world 2–3 readable traits (e.g., Rainy/Sparse grass/Sheltered groves) and make those traits affect actual simulation values; show which rules each trait changes. Keep item 45 (any-screen support) in scope.

Relevant files: `js/world.js`, `js/main.js`, `js/simulation.js`, `index.html`, `style.css`, `projectPLAN.md`.

### Instructions for future agents

- Before editing, run `git status --short --branch` and inspect the existing implementation around the target feature. Preserve unrelated user edits.
- Work on one numbered roadmap item at a time. Do not skip an unchecked prerequisite. Make a small change, update its acceptance criteria, then summarize what changed and what was verified.
- A checked implementation task means the feature code is in place; it does not automatically mean the full UI verification matrix passed. Keep implementation tasks and verification tasks separate, and record any verification that is still pending.
- Keep saves compatible. `serializeSimulation` currently writes version 1 in `js/simulation.js`; when adding world metadata, introduce a deliberate version/migration path and retain old-save loading.
- Keep the project dependency-free unless a specific need justifies a dependency. Prefer small edits to the existing modules over a broad rewrite.
- The roadmap describes inspiration at the genre level. Do not copy another game's name, art, exact UI, lore, writing, or signature content. Build Microverse around habitats, animal relationships, recovery, and emergent nature stories.

## Roadmap

Each numbered item is intended to be a small build step. Finish and play with one step before beginning the next. A step is complete when its behavior is visible, understandable, saved correctly when relevant, and documented.

### Phase 1 — Make world shaping feel good

**Goal:** Let players make a world quickly and confidently before expanding the simulation.

- [x] **1. Adjustable terrain brushes.** Add 1×1, 3×3, and 5×5 terrain brushes with a matching canvas preview.
- [x] **2. Verify the complete brush matrix.** Verified by user on 2026-11-20 (local browser): all sizes/shapes at corners/edges, all terrain tools+erase, drag/overlap strokes, and occupied-animal behavior all passed.
- [x] **3. Brush shape options.** Square/Round controls and matching tile footprints are implemented and verified as part of item 2.
- [x] **4. World size choices.** Small (32×20), Standard (40×25, current default), and Wide (48×30) choices added for next New World only (current world unchanged). Challenges fixed to 40×25; tile size remains 16; size display reflects current world. Fix applied so selected size is read at New World time. User-verified 2026-11-20.
- [x] **5. Camera navigation.** Zoom (+/−/1:1, Ctrl+wheel) and middle-mouse pan added; hit-testing uses canvas buffer coords to preserve tile mapping/brush previews/inspection at zoom. User-verified 2026-11-20.
- [x] **6. World-generation presets.** Meadow, Wetland, and Woodland profiles with named/bounded terrain/resource parameters and next-world preset selector added. User-verified 2026-11-21: visible distinction across sizes, next-world-only behavior, save/load/challenges unaffected.
- [ ] **7. World character card.** Give each generated world two or three readable traits, such as “Rainy,” “Sparse grass,” or “Sheltered groves,” and make those traits affect actual simulation values. Show the player which rules each trait changes.
- [ ] **8. Save format preparation.** Version world data before adding more world-level state; preserve compatibility with existing local saves. Add a migration/default path for older version-1 saves and validate malformed dimensions and tile arrays.

**Checkpoint:** A player can make, navigate, name, save, and reload a world with a distinct habitat profile.

### Phase 2 — Add the first nature powers

**Goal:** Give the player interventions that create understandable ecological ripples.

- [ ] **9. Power-tool section.** Add a separate power category and a clear target/brush interaction without changing terrain tools.
- [ ] **10. Rain, first version.** Let the player place a temporary rain cloud over a small area. Show where it is active and how long it lasts.
- [ ] **11. Rain affects the world.** Have rain speed grass recovery in its area. Keep the first implementation limited to one visible, measurable effect.
- [ ] **12. Rain feedback.** Add simple rain particles, a short event-log entry, and a readable indicator for affected tiles.
- [ ] **13. Bloom.** Add a temporary flowering/food-rich patch that attracts rabbits and supports pollinators later.
- [ ] **14. Sanctuary.** Let the player mark a small habitat where predators avoid hunting. Make the tradeoff visible: prey gets refuge, predators must range farther.
- [ ] **15. One disruptive force.** Add a contained wildfire or drought as a counterpoint to nurturing powers. Make spread, damage, and recovery visible and tuneable.
- [ ] **16. Power undo or recovery tools.** Add a simple way to cancel an active effect or help a damaged habitat recover.

**Checkpoint:** Players can create at least one helpful and one risky cause-and-effect chain and understand why populations respond.

### Phase 3 — Make animals feel like individuals in a habitat

**Goal:** Deepen the existing animals before adding a large number of species.

- [ ] **17. Habitat preference.** Give rabbits and wolves a small number of preferred conditions and make those preferences affect movement and survival.
- [ ] **18. Place-based memory.** Let an animal remember one useful or dangerous location, such as a reliable food patch or recent predator encounter.
- [ ] **19. Group behavior.** Add simple clustering or shared alert behavior to rabbits, so a predator sighting can affect nearby animals.
- [ ] **20. Seasonal pressure.** Add a slow seasonal cycle that changes grass growth and habitat conditions, with a clear on-screen season indicator.
- [ ] **21. Migration.** When local food becomes scarce, let groups gradually move toward better habitat instead of waiting in place to die.
- [ ] **22. Habitat recovery.** Add a recovery timeline for disturbed terrain so the world can visibly heal after a harsh event.
- [ ] **23. A supporting species.** Add a pollinator or seed-carrying animal that changes plant distribution and gives the food web another relationship.

**Checkpoint:** The ecosystem has observable routines, migration, and recovery; a player can point to reasons behind a major population shift.

### Phase 4 — Turn simulation into stories

**Goal:** Make interesting outcomes easy to notice, understand, revisit, and share.

- [ ] **24. Event significance.** Distinguish ordinary simulation notices from rare or consequential events.
- [ ] **25. Story cards.** Summarize events such as a migration, a local extinction, or the recovery of a habitat in a few plain sentences.
- [ ] **26. Jump to event location.** Clicking a story should select or center its location on the map.
- [ ] **27. World timeline.** Show a compact timeline of seasons, interventions, population peaks, and major events.
- [ ] **28. World scrapbook.** Let players save a named moment with a short note and a map snapshot.
- [ ] **29. Scenario sharing.** Add export/import for world setups and challenge scenarios so players can pass worlds around without depending on browser LocalStorage.

**Checkpoint:** A player can describe what happened, inspect where it happened, and preserve or share the world state.

### Phase 5 — Add depth without losing the cozy sandbox

**Goal:** Expand the toybox only where the new systems create new kinds of stories.

- [ ] **30. Trait inheritance experiment.** Let one simple trait, such as drought tolerance, vary slightly across generations and respond slowly to repeated conditions.
- [ ] **31. Biome transitions.** Let long-term moisture, plant cover, and disturbance shift local habitat types over time.
- [ ] **32. More species by role.** Add species to create new relationships—pollination, seed dispersal, scavenging, or competition—not just to increase the creature list.
- [ ] **33. Additional powers by interaction.** Choose each new power because it creates an interesting interaction with existing ecology. Avoid a long list of isolated effects.
- [ ] **34. Player-authored laws.** Add optional world rules that let players make a world gentler, stranger, or more challenging.
- [ ] **35. Challenge scenarios as tutorials.** Use short authored scenarios to teach systems, while leaving the main experience open-ended.

**Checkpoint:** New content deepens existing interactions and supports multiple play styles instead of adding disconnected buttons.

### Phase 6 — Polish, accessibility, and release readiness

- [ ] **36. Responsive controls.** Make world editing and inspection comfortable on smaller screens and touch devices.
- [ ] **37. Keyboard access.** Ensure all tools, overlays, and settings are reachable and understandable without a mouse.
- [ ] **38. Simulation controls and clarity.** Make pause, speed, active powers, selected tool, and world state obvious at a glance.
- [ ] **39. Performance.** Measure larger worlds and higher populations before optimizing; keep rendering and simulation responsive.
- [ ] **40. Save reliability.** Validate imported data, preserve older save versions, and explain storage limits in the UI.
- [ ] **41. First-play experience.** Teach the world loop through a short guided activity rather than a long instruction list.
- [ ] **42. Visual and sound identity.** Refine original terrain, creature silhouettes, animation language, ambient sound, and UI motifs around the caretaker/nature theme.
- [ ] **43. Playtest and tune.** Observe new players, identify confusing or uninteresting moments, and tune the systems before adding more scope.
- [x] **44. Remove animal population caps.** Removed artificial rabbit/wolf `maxPopulation` limits and reproduction/manual-placement cap checks (`js/entities.js`, `js/simulation.js`), 2026-11-20. Keep performance and balance considerations visible during playtest.
- [ ] **45. Any-screen support.** Ensure the game UI and world interaction work well on any screen size (desktop, laptop, tablet, phone), including responsive layout, readable controls, and usable canvas/touch interaction.

**Checkpoint:** New players can create a world, understand an ecological change, intervene, and save or share a memorable result.

## Exact next steps

1. Build **item 7**: world character card with 2–3 readable traits per generated world; connect each trait to a real simulation parameter and show the rule changes.
2. Build item 7: show generated world traits and connect each trait to a real simulation parameter.
3. Address item 45 (any-screen support) early as UI/layout work evolves, so new features remain usable on any screen size.
4. Continue Phase 2 (Rain power chain) after Phase 1 checkpoint.

After Phase 1, continue to the Rain power in Phase 2. Build it as a chain of small pieces: power selection and target footprint → temporary rain state with duration → grass regrowth effect → visible rain feedback and event note → playtest the rain → grass → rabbit response. Do not bundle every future power into the first implementation.

## Product guardrails

- Prefer a few interacting systems over a large catalogue of shallow powers.
- Make consequences visible in the world, not only in statistics.
- Keep meaningful recovery possible after player-caused damage.
- Avoid unexplained simulation outcomes; surface the causes in the event/story layer.
- Keep challenges optional and let free play remain the default.
- Use original artwork, writing, UI, names, mechanics details, and sound.
- Do not add multiplayer, complex kingdoms, or elaborate technology trees until the ecology-first loop is compelling on its own.

## How to use this plan

Treat the roadmap as a direction, not a promise to ship every item. At the end of each checkpoint, play the project and ask: **Did this create a new story or a more interesting choice?** If not, simplify or replace the feature before expanding further.
