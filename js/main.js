import { createWorld, WORLD_PRESETS, getWorldStats, getTile, paintTile, eraseTile, canPaintTile, isWalkable, TILE_TYPES, getWorldRules } from './world.js';
import { createSimulation, resetSimulation, stepSimulation, addRabbit, addWolf, addRain, addBloom, addSanctuary, addEvent, serializeSimulation, hydrateSimulation } from './simulation.js';
import { setupCanvas, render } from './renderer.js';
import { getEntityRenderPos, getRabbitStatus, getWolfStatus, resetRabbitIds, resetWolfIds } from './entities.js';
import { loadPrefs, savePrefs, saveSlot, loadSlot, listSlots, deleteSlot } from './storage.js';

const TILE_SIZE = 16;
const WORLD_SIZES = {
  small: { id: 'small', name: 'Small', width: 32, height: 20 },
  standard: { id: 'standard', name: 'Standard', width: 40, height: 25 },
  wide: { id: 'wide', name: 'Wide', width: 48, height: 30 }
};
const CHALLENGE_SIZE = WORLD_SIZES.standard;
let nextWorldSizeId = 'standard';
let nextWorldPresetId = 'meadow';

function getSelectedWorldSize() {
  const sel = el('worldSizeSelect');
  if (sel && WORLD_SIZES[sel.value]) nextWorldSizeId = sel.value;
  return WORLD_SIZES[nextWorldSizeId] || WORLD_SIZES.standard;
}
function getSelectedWorldPreset() {
  const sel = el('worldPresetSelect');
  if (sel && WORLD_PRESETS[sel.value]) nextWorldPresetId = sel.value;
  return WORLD_PRESETS[nextWorldPresetId] ? nextWorldPresetId : 'meadow';
}
const FIXED_STEP = 1 / 30;
const MAX_FRAME_TIME = 0.25;
const ZOOM_MIN = 0.5, ZOOM_MAX = 4, ZOOM_STEP = 0.25;
let zoom = 1;

const defaultPrefs = { sound: false, animations: true, showGrid: false, showStats: true, speed: 1, tutorialDone: false };

const el = (id) => document.getElementById(id);
const canvas = el('worldCanvas');
const canvasWrap = el('canvasWrap');
const zoomLabel = el('zoomLabel');
const playPauseBtn = el('playPauseBtn');
const stepResetBtn = el('stepResetBtn');
const resetBtn = el('resetBtn');
const newWorldBtn = el('newWorldBtn');
const saveBtn = el('saveBtn');
const loadBtn = el('loadBtn');
const settingsBtn = el('settingsBtn');
const helpBtn = el('helpBtn');
const closeInspectorBtn = el('closeInspectorBtn');
const worldNameInput = el('worldNameInput');
const worldNameDisplay = el('worldNameDisplay');
const simTimeEl = el('simTime');
const simStatusEl = el('simStatus');
const worldSizeEl = el('worldSize');
const brushInfo = el('brushInfo');
const worldCharacterNameEl = el('worldCharacterName');
const worldTraitListEl = el('worldTraitList');
const tilePanelEls = { coord: el('tileCoord'), type: el('tileType'), walk: el('tileWalkable'), occ: el('tileOccupant') };
const creaturePanel = el('creaturePanel');
const tilePanel = el('tilePanel');
const insp = { title: el('inspectorTitle'), type: el('inspType'), id: el('inspId'), age: el('inspAge'), energy: el('inspEnergy'), hunger: el('inspHunger'), state: el('inspState'), huntsRow: el('inspHuntsRow'), hunts: el('inspHunts'), status: el('inspStatus') };
const statEls = { rabbits: el('statRabbits'), wolves: el('statWolves'), grass: el('statGrassAvail'), rBirths: el('statRabbitBirths'), rDeaths: el('statRabbitDeaths'), wBirths: el('statWolfBirths'), wDeaths: el('statWolfDeaths'), hunts: el('statHunts') };
const eventLogEl = el('eventLog');
const historyCanvas = el('historyChart');
const historyCtx = historyCanvas.getContext('2d');
const analyticsSection = el('analyticsSection');
const statsPanel = el('statsPanel');
const toastEl = el('toast');
const tutorialOverlay = el('tutorialOverlay');
const settingsOverlay = el('settingsOverlay');
const loadOverlay = el('loadOverlay');
const saveListEl = el('saveList');
const editHint = el('editHint');

let prefs = loadPrefs(defaultPrefs);
let generation = 1;
let ctx;
let sim;
let paused = true;
let speed = prefs.speed || 1;
let accumulator = 0;
let lastTime = 0;
let selected = null; // creature
let selectedTile = null;
let hoverTile = null;
const POWER_TOOLS = {
  rain: { label: 'Rain', brushSize: 3, brushShape: 'round', color: 'rgba(120,190,255,0.82)' },
  bloom: { label: 'Bloom', brushSize: 3, brushShape: 'round', color: 'rgba(255,170,210,0.82)' },
  sanctuary: { label: 'Sanctuary', brushSize: 3, brushShape: 'round', color: 'rgba(170,230,160,0.82)' }
};
function isPowerTool(tool) { return !!POWER_TOOLS[tool]; }
function isTerrainTool(tool) { return ['grass','dirt','tree','bush','rock','water','erase'].includes(tool); }
let brush = { tool: 'select', size: 1, shape: 'square', category: 'terrain' }; // terrain brushes use 1, 3, or 5 tile footprints
let isPainting = false;
let isPanning = false;
let panStart = null;
let lastPaintKey = null;
let lastPaintCenter = null;
let paintedStrokeTiles = new Set();
let toastTimer = null;
let audioCtx = null;
let activeChallenge = null;

const CHALLENGES = {
  refuge: { name: 'Rabbit Refuge', duration: 180, rabbits: 6, wolves: 0, goal: 'Keep at least 3 rabbits alive for 3 minutes.' },
  balance: { name: 'Balanced Meadow', duration: 240, rabbits: 10, wolves: 3, goal: 'Keep at least 4 rabbits and 1 wolf alive for 4 minutes.' },
  hunt: { name: 'Wolf’s First Hunt', duration: 180, rabbits: 14, wolves: 4, goal: 'Help the wolves make 3 successful hunts within 3 minutes.' }
};

function ensureAudio() { if (!prefs.sound) return null; if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); } return audioCtx; }
function playTone(freq=440, dur=0.06, type='square', vol=0.03) {
  const ac = ensureAudio(); if (!ac) return;
  try {
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g).connect(ac.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.stop(ac.currentTime + dur);
  } catch {}
}
function sfx(kind) {
  if (!prefs.sound) return;
  if (kind==='place') playTone(660,0.05,'square',0.02);
  else if (kind==='hunt') { playTone(220,0.06,'sawtooth',0.03); setTimeout(()=>playTone(180,0.08,'sawtooth',0.025),40); }
  else if (kind==='birth') playTone(740,0.06,'triangle',0.025);
  else if (kind==='ui') playTone(520,0.04,'square',0.015);
}

function showToast(msg, ms=2200) {
  toastEl.textContent = msg; toastEl.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>toastEl.classList.add('hidden'), ms);
}

function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec/60), s = sec%60;
  const h = Math.floor(m/60), mm = m%60;
  if (h>0) return `${h}:${String(mm).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(mm).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function currentWorldName() { return (worldNameInput.value || 'Untitled World').trim().slice(0,32) || 'Untitled World'; }

function applyZoom() {
  if (!canvas) return;
  canvas.style.width = (canvas.width * zoom) + 'px';
  canvas.style.height = (canvas.height * zoom) + 'px';
  canvas.style.maxWidth = 'none';
  canvas.style.maxHeight = 'none';
  if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
}

function setZoom(z) {
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z / ZOOM_STEP) * ZOOM_STEP));
  applyZoom();
}

function resetView() {
  zoom = 1;
  applyZoom();
  if (canvasWrap) { canvasWrap.scrollLeft = 0; canvasWrap.scrollTop = 0; }
}

function setupNewWorld(empty=false) {
  activeChallenge = null;
  updateChallengeUI();
  const size = getSelectedWorldSize();
  const presetId = getSelectedWorldPreset();
  const presetName = WORLD_PRESETS[presetId]?.name || 'Meadow';
  const world = createWorld(size.width, size.height, TILE_SIZE, { empty, preset: presetId });
  resetRabbitIds(); resetWolfIds();
  sim = createSimulation(world);
  if (!ctx || canvas.width !== world.width*TILE_SIZE || canvas.height !== world.height*TILE_SIZE) ctx = setupCanvas(canvas, world);
  resetView();
  selected = null; selectedTile = null; hoverTile = null;
  paused = true; accumulator = 0; updatePlayPauseUI();
  addEvent(sim, 'world', `New ${presetName.toLowerCase()} ${size.name.toLowerCase()} world created (${size.width}×${size.height}). Shape the land, then press Play.`);
  refreshAll();
}

function renderWorldCharacter() {
  if (!worldCharacterNameEl || !worldTraitListEl) return;
  const preset = WORLD_PRESETS[sim.world.preset]?.name || 'World';
  worldCharacterNameEl.textContent = `${preset} world`;
  const rules = getWorldRules(sim.world);
  worldTraitListEl.innerHTML = '';
  for (const trait of rules.traits) {
    const li = document.createElement('li');
    li.className = 'world-trait';
    const name = document.createElement('div');
    name.className = 'trait-name';
    name.textContent = trait.name;
    const desc = document.createElement('div');
    desc.className = 'trait-desc';
    desc.textContent = trait.description;
    const ruleList = document.createElement('ul');
    ruleList.className = 'trait-rules';
    for (const r of trait.rules) {
      const rli = document.createElement('li');
      rli.textContent = r;
      ruleList.appendChild(rli);
    }
    li.appendChild(name); li.appendChild(desc); li.appendChild(ruleList);
    worldTraitListEl.appendChild(li);
  }
  if (!rules.traits.length) {
    const li = document.createElement('li');
    li.className = 'world-trait';
    li.textContent = `Grass regrows in ${Number(sim.world.grassRegrowTime ?? 18).toFixed(1)}s.`;
    worldTraitListEl.appendChild(li);
  }
}

function updateChallengeUI(message = null) {
  const select = el('challengeSelect');
  const desc = el('challengeDescription');
  const progress = el('challengeProgress');
  const start = el('startChallengeBtn');
  if (!select || !desc || !progress || !start) return;
  const spec = CHALLENGES[select.value] || CHALLENGES.refuge;
  desc.textContent = spec.goal;
  progress.textContent = message || (activeChallenge ? getChallengeProgress() : 'Ready when you are.');
  start.textContent = activeChallenge ? 'Restart Challenge' : 'Start Challenge';
  progress.classList.toggle('complete', !!activeChallenge?.complete);
  progress.classList.toggle('failed', !!activeChallenge?.failed);
}

function getChallengeProgress() {
  if (!activeChallenge) return 'Ready when you are.';
  const spec = CHALLENGES[activeChallenge.id];
  if (activeChallenge.complete) return 'Challenge complete! Great work.';
  if (activeChallenge.failed) return 'Challenge ended. Try again with a new strategy.';
  const elapsed = Math.max(0, sim.time - activeChallenge.startedAt);
  const remaining = Math.max(0, Math.ceil(spec.duration - elapsed));
  if (activeChallenge.id === 'refuge') return `${sim.rabbits.length} rabbits · ${formatTime(remaining)} remaining`;
  if (activeChallenge.id === 'balance') return `${sim.rabbits.length} rabbits · ${sim.wolves.length} wolves · ${formatTime(remaining)} remaining`;
  return `${sim.stats.successfulHunts} / 3 successful hunts · ${formatTime(remaining)} remaining`;
}

function startChallenge() {
  const id = el('challengeSelect').value;
  const spec = CHALLENGES[id] || CHALLENGES.refuge;
  const world = createWorld(CHALLENGE_SIZE.width, CHALLENGE_SIZE.height, TILE_SIZE);
  resetRabbitIds(); resetWolfIds();
  sim = createSimulation(world, { initialRabbits: [], initialWolves: [] });
  let placedRabbits = 0, placedWolves = 0;
  for (let y = 0; y < CHALLENGE_SIZE.height && placedRabbits < spec.rabbits; y++) {
    for (let x = 0; x < CHALLENGE_SIZE.width && placedRabbits < spec.rabbits; x++) if (addRabbit(sim, x, y)) placedRabbits++;
  }
  for (let y = 0; y < CHALLENGE_SIZE.height && placedWolves < spec.wolves; y++) {
    for (let x = 0; x < CHALLENGE_SIZE.width && placedWolves < spec.wolves; x++) if (addWolf(sim, x, y)) placedWolves++;
  }
  ctx = setupCanvas(canvas, world);
  resetView();
  selected = null; selectedTile = null; hoverTile = null;
  worldNameInput.value = spec.name;
  activeChallenge = { id, startedAt: 0, complete: false, failed: false };
  addEvent(sim, 'world', `Challenge started: ${spec.name}. ${spec.goal}`);
  setPaused(true);
  setBrush('select');
  refreshAll();
  updateChallengeUI('Challenge ready. Press Play to begin!');
  showToast(`${spec.name} is ready.`);
}

function updateChallengeState() {
  if (!activeChallenge || activeChallenge.complete || activeChallenge.failed) return;
  const { id, startedAt } = activeChallenge;
  const elapsed = sim.time - startedAt;
  let won = false, failed = false;
  if (id === 'refuge') {
    won = elapsed >= 180 && sim.rabbits.length >= 3;
    failed = sim.rabbits.length < 3;
  } else if (id === 'balance') {
    won = elapsed >= 240 && sim.rabbits.length >= 4 && sim.wolves.length >= 1;
    failed = sim.rabbits.length < 4 || sim.wolves.length < 1;
  } else {
    won = sim.stats.successfulHunts >= 3;
    failed = elapsed >= 180 && !won;
  }
  if (won) {
    activeChallenge.complete = true; setPaused(true);
    addEvent(sim, 'birth', `Challenge complete: ${CHALLENGES[id].name}!`);
    sfx('birth'); showToast('Challenge complete!');
  } else if (failed) {
    activeChallenge.failed = true; setPaused(true);
    addEvent(sim, 'death', `Challenge failed: ${CHALLENGES[id].name}.`);
    showToast('Challenge failed. You can restart it anytime.');
  }
  updateChallengeUI();
}

function resetCurrentSim() {
  if (activeChallenge) { startChallenge(); return; }
  resetRabbitIds(); resetWolfIds();
  resetSimulation(sim);
  selected = null; refreshAll();
  showToast('Simulation reset on current terrain.');
  sfx('ui');
}

function setSpeed(v) {
  speed = Number(v) || 1; prefs.speed = speed; savePrefs(prefs);
  document.querySelectorAll('#speedButtons .speed-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.speed)===speed));
}
function setPaused(p) { paused = !!p; updatePlayPauseUI(); }
function updatePlayPauseUI() {
  playPauseBtn.textContent = paused ? 'Play' : 'Pause';
  simStatusEl.textContent = paused ? 'Paused' : 'Running';
  simStatusEl.classList.toggle('paused', paused);
  simStatusEl.classList.toggle('running', !paused);
  editHint.textContent = paused ? 'Editing enabled while paused' : 'Pause to edit terrain and place creatures';
}

function setBrush(tool) {
  brush.tool = tool;
  brush.category = isPowerTool(tool) ? 'power' : isTerrainTool(tool) ? 'terrain' : 'utility';
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  const label = ({select:'Select',grass:'Grass',dirt:'Dirt',tree:'Tree',bush:'Bush',rock:'Rock',water:'Water',erase:'Erase',rabbit:'Place Rabbit',wolf:'Place Wolf',rain:'Rain Power',bloom:'Bloom Power',sanctuary:'Sanctuary Power'})[tool] || tool;
  if (isPowerTool(tool)) {
    const p = POWER_TOOLS[tool];
    brushInfo.textContent = `${label} · ${p.brushSize}×${p.brushSize} ${p.brushShape}`;
  } else {
    const shapeLabel = brush.shape === 'round' ? ' Round' : '';
    brushInfo.textContent = ['select','rabbit','wolf'].includes(tool) ? label : `${label} · ${brush.size}×${brush.size}${shapeLabel}`;
  }
}

function setBrushSize(size) {
  brush.size = [1, 3, 5].includes(Number(size)) ? Number(size) : 1;
  document.querySelectorAll('.brush-size-btn').forEach(b => {
    const active = Number(b.dataset.size) === brush.size;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  setBrush(brush.tool);
}

function setBrushShape(shape) {
  brush.shape = shape === 'round' ? 'round' : 'square';
  document.querySelectorAll('.brush-shape-btn').forEach(b => {
    const active = b.dataset.shape === brush.shape;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  setBrush(brush.tool);
}

function canvasToTile(evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
  const x = (evt.clientX - rect.left) * scaleX; const y = (evt.clientY - rect.top) * scaleY;
  const ts = sim.world.tileSize || TILE_SIZE;
  const tx = Math.floor(x / ts), ty = Math.floor(y / ts);
  if (tx < 0 || ty < 0 || tx >= sim.world.width || ty >= sim.world.height) return null;
  return { x: tx, y: ty };
}

function findCreatureAt(wx, wy) {
  let picked = null, best = 0.85;
  const candidates = [];
  for (const w of sim.wolves) if (w.alive) candidates.push(w);
  for (const r of sim.rabbits) if (r.alive) candidates.push(r);
  for (const e of candidates) {
    const pos = getEntityRenderPos(e);
    const d = Math.hypot(pos.x + 0.5 - wx, pos.y + 0.5 - wy);
    const bias = e.type === 'wolf' ? -0.02 : 0;
    if (d + bias < best) { best = d + bias; picked = e; }
  }
  return picked;
}

function occupantAt(x,y) {
  for (const w of sim.wolves) if (w.alive && w.tileX===x && w.tileY===y) return `Wolf #${w.id}`;
  for (const r of sim.rabbits) if (r.alive && r.tileX===x && r.tileY===y) return `Rabbit #${r.id}`;
  return 'None';
}

function applyToolAt(tile, isDrag=false) {
  if (!tile) return;
  const key = `${brush.tool}:${tile.x},${tile.y}`;
  if (isDrag && key === lastPaintKey) return;
  if (brush.tool === 'select') {
    selectedTile = { x: tile.x, y: tile.y };
    // prefer creature under cursor on click (not every drag move)
    if (!isDrag) {
      const creature = findCreatureAt(tile.x + 0.5, tile.y + 0.5);
      selected = creature ? { type: creature.type, id: creature.id } : null;
    }
    updateInspectors();
    return;
  }
  if (!paused) { showToast('Pause the simulation to edit the world.'); return; }

  if (brush.tool === 'rabbit' || brush.tool === 'wolf') {
    if (isDrag) return; // place once per click
    const fn = brush.tool === 'rabbit' ? addRabbit : addWolf;
    const made = fn(sim, tile.x, tile.y);
    if (made) { showToast(`${brush.tool === 'rabbit' ? 'Rabbit' : 'Wolf'} placed.`); sfx('place'); selected = { type: made.type, id: made.id }; selectedTile = {x:tile.x,y:tile.y}; }
    else showToast('Cannot place there (invalid tile or at population limit).');
    lastPaintKey = key; refreshAll();
    return;
  }

  if (isPowerTool(brush.tool)) {
    if (isDrag) return;
    selectedTile = { x: tile.x, y: tile.y };
    if (brush.tool === 'rain') {
      const rain = addRain(sim, tile.x, tile.y);
      if (rain) { showToast(`Rain cloud placed (${rain.duration}s).`); sfx('place'); }
      else showToast('Could not place rain there.');
    }
    if (brush.tool === 'bloom') {
      const bloom = addBloom(sim, tile.x, tile.y);
      if (bloom) { showToast(`Bloom patch placed (${bloom.duration}s).`); sfx('place'); }
      else showToast('Could not place bloom there.');
    }
    if (brush.tool === 'sanctuary') {
      const sanctuary = addSanctuary(sim, tile.x, tile.y);
      if (sanctuary) { showToast(`Sanctuary placed (${sanctuary.duration}s).`); sfx('place'); }
      else showToast('Could not place sanctuary there.');
    }
    lastPaintKey = key; refreshAll();
    return;
  }

  const entities = sim;
  let changed = false;
  const radius = Math.floor(brush.size / 2);
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (brush.shape === 'round' && dx*dx + dy*dy > radius*radius) continue;
    const x = tile.x + dx, y = tile.y + dy;
    const strokeTileKey = `${x},${y}`;
    if (isDrag && paintedStrokeTiles.has(strokeTileKey)) continue;
    paintedStrokeTiles.add(strokeTileKey);
    let tileChanged = false;
    if (brush.tool === 'erase') tileChanged = eraseTile(sim.world, x, y, entities);
    else if (Object.values(TILE_TYPES).includes(brush.tool) && canPaintTile(sim.world, x, y, brush.tool, entities)) {
      tileChanged = paintTile(sim.world, x, y, brush.tool, entities);
    }
    if (tileChanged) { changed = true; selectedTile = { x, y }; }
  }
  if (changed && Math.random() < 0.15) sfx('place');
  lastPaintKey = key;
  if (!isDrag || changed) { updateInspectors(); updateStatsOnly(); }
}

function onCanvasDown(e) {
  if (e && e.button === 1 && canvasWrap) {
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY, sl: canvasWrap.scrollLeft, st: canvasWrap.scrollTop };
    canvasWrap.style.cursor = 'grabbing';
    if (e.preventDefault) e.preventDefault();
    return;
  }
  const t = canvasToTile(e); if (!t) return;
  isPainting = true; lastPaintKey = null; lastPaintCenter = t; paintedStrokeTiles = new Set();
  applyToolAt(t, false);
}
function onCanvasMove(e) {
  if (isPanning && panStart && canvasWrap) {
    canvasWrap.scrollLeft = panStart.sl - (e.clientX - panStart.x);
    canvasWrap.scrollTop = panStart.st - (e.clientY - panStart.y);
    return;
  }
  const t = canvasToTile(e); hoverTile = t;
  if (isPainting && t) {
    if (['select','rabbit','wolf'].includes(brush.tool) || isPowerTool(brush.tool)) return;
    const from = lastPaintCenter || t;
    for (const p of interpolateTiles(from.x, from.y, t.x, t.y)) {
      if (p.x === from.x && p.y === from.y && lastPaintCenter) continue;
      applyToolAt(p, true);
    }
    lastPaintCenter = t;
  }
}
function onCanvasUp() {
  if (isPanning) {
    isPanning = false; panStart = null;
    if (canvasWrap) canvasWrap.style.cursor = '';
    return;
  }
  isPainting = false; lastPaintKey = null; lastPaintCenter = null; paintedStrokeTiles.clear();
}
function onCanvasLeave() { hoverTile = null; if (!isPanning) onCanvasUp(); }

function interpolateTiles(x0, y0, x1, y1) {
  const points = [];
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return points;
}

function getSelectedCreature() {
  if (!selected) return null;
  if (selected.type === 'rabbit') return sim.rabbits.find(r=>r.id===selected.id && r.alive) || null;
  if (selected.type === 'wolf') return sim.wolves.find(w=>w.id===selected.id && w.alive) || null;
  return null;
}

function updateInspectors() {
  if (selectedTile) {
    const t = getTile(sim.world, selectedTile.x, selectedTile.y);
    tilePanelEls.coord.textContent = `${selectedTile.x}, ${selectedTile.y}`;
    tilePanelEls.type.textContent = t || '-';
    tilePanelEls.walk.textContent = t ? (isWalkable(sim.world, selectedTile.x, selectedTile.y) ? 'Yes' : 'No') : '-';
    tilePanelEls.occ.textContent = occupantAt(selectedTile.x, selectedTile.y);
  } else {
    tilePanelEls.coord.textContent = 'None'; tilePanelEls.type.textContent='-'; tilePanelEls.walk.textContent='-'; tilePanelEls.occ.textContent='-';
  }

  const creature = getSelectedCreature();
  if (!creature) { selected = null; creaturePanel.classList.add('hidden'); creaturePanel.classList.remove('rabbit','wolf'); return; }
  creaturePanel.classList.remove('hidden');
  creaturePanel.classList.toggle('rabbit', creature.type==='rabbit');
  creaturePanel.classList.toggle('wolf', creature.type==='wolf');
  insp.title.textContent = creature.type==='wolf' ? 'Wolf Inspector' : 'Rabbit Inspector';
  insp.type.textContent = creature.type;
  insp.id.textContent = `#${creature.id}`;
  insp.age.textContent = `${creature.age.toFixed(1)}s`;
  insp.energy.textContent = `${Math.max(0,creature.energy).toFixed(0)} / 100`;
  insp.hunger.textContent = `${Math.min(100,creature.hunger).toFixed(0)} / 100`;
  insp.state.textContent = creature.state;
  if (creature.type === 'wolf') {
    insp.huntsRow.classList.remove('hidden'); insp.hunts.textContent = String(creature.successfulHunts); insp.status.textContent = getWolfStatus(creature);
  } else {
    insp.huntsRow.classList.add('hidden'); insp.hunts.textContent = '-'; insp.status.textContent = getRabbitStatus(creature);
  }
}

function updateStatsOnly() {
  const wstats = getWorldStats(sim.world);
  worldNameDisplay.textContent = currentWorldName();
  worldSizeEl.textContent = `${sim.world.width} × ${sim.world.height}`;
  simTimeEl.textContent = formatTime(sim.time);
  statEls.rabbits.textContent = String(sim.rabbits.length);
  statEls.wolves.textContent = String(sim.wolves.length);
  statEls.grass.textContent = String(wstats.grass);
  statEls.rBirths.textContent = String(sim.stats.rabbitBirths);
  statEls.rDeaths.textContent = String(sim.stats.rabbitDeaths);
  statEls.wBirths.textContent = String(sim.stats.wolfBirths);
  statEls.wDeaths.textContent = String(sim.stats.wolfDeaths);
  statEls.hunts.textContent = String(sim.stats.successfulHunts);
}

let lastEventRenderCount = 0;
function renderEventLog(force=false) {
  const events = sim.events;
  if (!force && events.length === lastEventRenderCount) return;
  lastEventRenderCount = events.length;
  const recent = events.slice(-40).reverse();
  eventLogEl.innerHTML = '';
  for (const ev of recent) {
    const li = document.createElement('li');
    li.className = `kind-${ev.kind || 'info'}`;
    const t = document.createElement('span'); t.className='time'; t.textContent = formatTime(ev.time||0);
    const m = document.createElement('span'); m.className='msg'; m.textContent = ev.message || '';
    li.appendChild(t); li.appendChild(m); eventLogEl.appendChild(li);
  }
}

function renderHistoryChart() {
  if (!prefs.showStats) return;
  const c = historyCanvas; const g = historyCtx;
  const w = c.width, h = c.height;
  g.clearRect(0,0,w,h);
  g.fillStyle = '#0d1510'; g.fillRect(0,0,w,h);
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1;
  for (let i=1;i<4;i++){ const y = Math.round((h*i)/4)+0.5; g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); }
  const hist = sim.history.slice(-120);
  if (hist.length < 2) return;
  const maxR = Math.max(5, ...hist.map(p=>p.rabbits));
  const maxW = Math.max(5, ...hist.map(p=>p.wolves));
  const maxG = Math.max(10, ...hist.map(p=>p.grass));
  const maxPop = Math.max(maxR, maxW, 10);
  const plot = (key, color, maxVal) => {
    g.strokeStyle = color; g.lineWidth = 1.5; g.beginPath();
    hist.forEach((p,i)=>{
      const x = (i/(hist.length-1)) * (w-6) + 3;
      const val = p[key] || 0;
      const y = h - 4 - (val / maxVal) * (h - 10);
      if (i===0) g.moveTo(x,y); else g.lineTo(x,y);
    });
    g.stroke();
  };
  plot('grass', '#6fbf73', maxG);
  plot('rabbits', '#efe6d6', maxPop);
  plot('wolves', '#7fd0ff', maxPop);
}

function refreshAll() {
  updatePlayPauseUI();
  updateInspectors();
  updateStatsOnly();
  renderWorldCharacter();
  renderEventLog(true);
  renderHistoryChart();
}

function saveGame() {
  const name = currentWorldName();
  const payload = serializeSimulation(sim, name);
  const saves = listSlots();
  if (saves.some(s => s.name === name)) {
    if (!confirm(`Overwrite saved world "${name}"?`)) return;
  }
  const ok = saveSlot(name, payload);
  if (ok) { showToast(`Saved "${name}".`); sfx('ui'); }
  else showToast('Save failed (storage unavailable or full).');
}
function openLoadDialog() {
  const saves = listSlots();
  saveListEl.innerHTML = '';
  const note = document.createElement('li');
  note.className = 'hint small';
  note.textContent = 'Saves are stored in this browser (LocalStorage). Clearing site data or storage limits can remove them.';
  saveListEl.appendChild(note);
  if (saves.length === 0) {
    const li = document.createElement('li'); li.className='hint small'; li.textContent='No saved worlds yet.'; saveListEl.appendChild(li);
  }
  for (const slot of saves) {
    const li = document.createElement('li'); li.className='save-item';
    const meta = document.createElement('div'); meta.className='meta';
    const nm = document.createElement('div'); nm.className='name'; nm.textContent = slot.name;
    const ver = Number(slot?.payload?.version);
    const verLabel = Number.isFinite(ver) ? `v${ver}` : 'unknown version';
    const sub = document.createElement('div'); sub.className='sub';
    sub.textContent = `${slot.savedAt ? new Date(slot.savedAt).toLocaleString() : 'Unknown time'} · ${verLabel}`;
    meta.appendChild(nm); meta.appendChild(sub);
    const actions = document.createElement('div'); actions.className='actions';
    const loadB = document.createElement('button'); loadB.className='top-btn'; loadB.textContent='Load';
    loadB.onclick = () => { doLoad(slot.name); };
    const delB = document.createElement('button'); delB.className='top-btn danger'; delB.textContent='Delete';
    delB.onclick = () => { if(confirm(`Delete saved world "${slot.name}"?`)) { deleteSlot(slot.name); openLoadDialog(); } };
    actions.appendChild(loadB); actions.appendChild(delB);
    li.appendChild(meta); li.appendChild(actions); saveListEl.appendChild(li);
  }
  loadOverlay.classList.remove('hidden');
}

function getSaveLoadErrorMessage(err) {
  const msg = String(err?.message || err || '');
  if (/Unsupported save version/i.test(msg)) return 'This save version is not supported by this build.';
  if (/Invalid world data|Invalid save data/i.test(msg)) return 'Save data is invalid or corrupted.';
  return 'Could not load save. It may be invalid or outdated.';
}
function doLoad(name) {
  const slot = loadSlot(name); if (!slot || !slot.payload) { showToast('Could not load save.'); return; }
  try {
    const newSim = hydrateSimulation(slot.payload);
    sim = newSim;
    activeChallenge = null; updateChallengeUI();
    const ts = sim.world.tileSize || TILE_SIZE;
    if (!ctx || canvas.width !== sim.world.width*ts || canvas.height !== sim.world.height*ts) ctx = setupCanvas(canvas, sim.world);
    resetView();
    worldNameInput.value = slot.payload.worldName || name;
    selected = null; selectedTile = null; paused = true; accumulator = 0;
    addEvent(sim, 'world', `Loaded "${worldNameInput.value}".`);
    loadOverlay.classList.add('hidden');
    refreshAll();
    showToast(`Loaded "${worldNameInput.value}".`);
    sfx('ui');
  } catch (e) {
    console.error(e); showToast(getSaveLoadErrorMessage(e));
  }
}

function newWorldFlow() {
  if (!confirm('Create a new world? Unsaved changes to the current world will be lost.')) return;
  const presetId = getSelectedWorldPreset();
  const presetName = WORLD_PRESETS[presetId]?.name || 'Meadow';
  worldNameInput.value = `${presetName} ${generation+1}`; generation++;
  const size = getSelectedWorldSize();
  setupNewWorld(false);
  showToast(`New ${presetName.toLowerCase()} ${size.name.toLowerCase()} world (${size.width}×${size.height}).`);
}
function resetSimFlow() {
  if (!confirm('Reset simulation on current terrain? Creature and history stats will restart.')) return;
  resetCurrentSim();
}

function applyPrefsToUI() {
  el('setSound').checked = !!prefs.sound;
  el('setAnimations').checked = !!prefs.animations;
  el('setGrid').checked = !!prefs.showGrid;
  el('setStats').checked = !!prefs.showStats;
  el('setSpeed').value = String(prefs.speed || 1);
  analyticsSection.classList.toggle('hidden', !prefs.showStats);
  statsPanel.classList.toggle('hidden', !prefs.showStats);
}
function openSettings() { applyPrefsToUI(); settingsOverlay.classList.remove('hidden'); }
function closeSettings() {
  prefs.sound = el('setSound').checked;
  prefs.animations = el('setAnimations').checked;
  prefs.showGrid = el('setGrid').checked;
  prefs.showStats = el('setStats').checked;
  const sp = Number(el('setSpeed').value)||1; prefs.speed = sp; setSpeed(sp);
  savePrefs(prefs); applyPrefsToUI(); settingsOverlay.classList.add('hidden'); renderHistoryChart();
}
function showTutorial() { tutorialOverlay.classList.remove('hidden'); }
function closeTutorial() { tutorialOverlay.classList.add('hidden'); if (!prefs.tutorialDone) { prefs.tutorialDone = true; savePrefs(prefs); } }

let uiAccum = 0;
function loop(ts) {
  if (!lastTime) lastTime = ts;
  let frame = (ts - lastTime) / 1000; lastTime = ts;
  if (frame > MAX_FRAME_TIME) frame = MAX_FRAME_TIME;

  if (!paused) {
    accumulator += frame * speed;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 400) { // cap to avoid spiral
      const prevHunts = sim.stats.successfulHunts;
      const prevRB = sim.stats.rabbitBirths, prevWB = sim.stats.wolfBirths;
      stepSimulation(sim, FIXED_STEP);
      if (sim.stats.successfulHunts > prevHunts) sfx('hunt');
      else if (sim.stats.rabbitBirths > prevRB || sim.stats.wolfBirths > prevWB) sfx('birth');
      accumulator -= FIXED_STEP; steps++;
    }
  }

  const nowSec = ts / 1000;
  render(ctx, { world: sim.world, rabbits: sim.rabbits, wolves: sim.wolves, rains: sim.rains, blooms: sim.blooms, sanctuaries: sim.sanctuaries, selected, selectedTile, hoverTile, brush, settings: prefs, time: nowSec });
  uiAccum += frame;
  if (uiAccum > 0.12) {
    uiAccum = 0;
    if (selected && !getSelectedCreature()) selected = null;
    updateChallengeState(); updateInspectors(); updateStatsOnly(); renderEventLog(); renderHistoryChart();
  }
  requestAnimationFrame(loop);
}

function bindEvents() {
  const worldSizeSelect = el('worldSizeSelect');
  if (worldSizeSelect) {
    worldSizeSelect.value = nextWorldSizeId;
    worldSizeSelect.addEventListener('change', () => {
      if (WORLD_SIZES[worldSizeSelect.value]) {
        nextWorldSizeId = worldSizeSelect.value;
        const s = WORLD_SIZES[nextWorldSizeId];
        showToast(`Next New World: ${s.name} (${s.width}×${s.height})`);
      }
    });
  }
  const worldPresetSelect = el('worldPresetSelect');
  if (worldPresetSelect) {
    worldPresetSelect.value = nextWorldPresetId;
    worldPresetSelect.addEventListener('change', () => {
      if (WORLD_PRESETS[worldPresetSelect.value]) {
        nextWorldPresetId = worldPresetSelect.value;
        showToast(`Next New World preset: ${WORLD_PRESETS[nextWorldPresetId].name}`);
      }
    });
  }
  el('challengeSelect').addEventListener('change', () => {
    activeChallenge = null;
    updateChallengeUI();
  });
  el('startChallengeBtn').onclick = startChallenge;
  playPauseBtn.onclick = () => { setPaused(!paused); sfx('ui'); };
  stepResetBtn.onclick = resetSimFlow;
  resetBtn.onclick = resetSimFlow;
  newWorldBtn.onclick = newWorldFlow;
  saveBtn.onclick = saveGame;
  loadBtn.onclick = () => { sfx('ui'); openLoadDialog(); };
  settingsBtn.onclick = () => { sfx('ui'); openSettings(); };
  helpBtn.onclick = () => { sfx('ui'); showTutorial(); };
  closeInspectorBtn.onclick = () => { selected = null; updateInspectors(); };
  el('closeTutorialBtn').onclick = () => { sfx('ui'); closeTutorial(); };
  el('closeSettingsBtn').onclick = () => { sfx('ui'); closeSettings(); };
  el('closeLoadBtn').onclick = () => loadOverlay.classList.add('hidden');
  el('resetTutorialBtn').onclick = () => { prefs.tutorialDone = false; savePrefs(prefs); showToast('Tutorial will show on next start.'); };
  document.querySelectorAll('#speedButtons .speed-btn').forEach(b => b.onclick = () => { setSpeed(Number(b.dataset.speed)); sfx('ui'); });
  document.querySelectorAll('.tool-btn').forEach(b => b.onclick = () => { setBrush(b.dataset.tool); sfx('ui'); });
  document.querySelectorAll('.brush-size-btn').forEach(b => b.onclick = () => { setBrushSize(b.dataset.size); sfx('ui'); });
  document.querySelectorAll('.brush-shape-btn').forEach(b => b.onclick = () => { setBrushShape(b.dataset.shape); sfx('ui'); });
  const zoomInBtn = el('zoomInBtn'), zoomOutBtn = el('zoomOutBtn'), zoomResetBtn = el('zoomResetBtn');
  if (zoomInBtn) zoomInBtn.onclick = () => { setZoom(zoom + ZOOM_STEP); sfx('ui'); };
  if (zoomOutBtn) zoomOutBtn.onclick = () => { setZoom(zoom - ZOOM_STEP); sfx('ui'); };
  if (zoomResetBtn) zoomResetBtn.onclick = () => { resetView(); sfx('ui'); };
  if (canvasWrap) canvasWrap.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  }, { passive: false });
  worldNameInput.addEventListener('input', () => { worldNameDisplay.textContent = currentWorldName(); });
  worldNameInput.addEventListener('change', () => { worldNameDisplay.textContent = currentWorldName(); });

  canvas.addEventListener('mousedown', onCanvasDown);
  window.addEventListener('mousemove', onCanvasMove);
  window.addEventListener('mouseup', onCanvasUp);
  canvas.addEventListener('mouseleave', onCanvasLeave);
  // touch basic support
  canvas.addEventListener('touchstart', (e)=>{ const t=e.changedTouches[0]; if(!t) return; onCanvasDown(t); e.preventDefault(); }, {passive:false});
  canvas.addEventListener('touchmove', (e)=>{ const t=e.changedTouches[0]; if(!t) return; onCanvasMove(t); e.preventDefault(); }, {passive:false});
  canvas.addEventListener('touchend', (e)=>{ onCanvasUp(); e.preventDefault(); }, {passive:false});

  window.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === ' '){ e.preventDefault(); setPaused(!paused); }
    if (e.key === '1') setSpeed(1); if (e.key === '2') setSpeed(2); if (e.key === '4') setSpeed(4);
    if (e.key === 'g' || e.key === 'G') { prefs.showGrid = !prefs.showGrid; savePrefs(prefs); showToast(`Grid ${prefs.showGrid?'on':'off'}`); }
    if (e.key === 'Escape') { settingsOverlay.classList.add('hidden'); loadOverlay.classList.add('hidden'); selected=null; updateInspectors(); }
  });

  [tutorialOverlay, settingsOverlay, loadOverlay].forEach(ov => ov.addEventListener('click', (e)=>{ if (e.target===ov) ov.classList.add('hidden'); }));
}

function init() {
  try {
    bindEvents();
    applyPrefsToUI();
    setSpeed(prefs.speed || 1);
    setBrush('select');
    worldNameInput.value = 'New Meadow';
    setupNewWorld(false);
    setPaused(true);
    if (!prefs.tutorialDone) showTutorial();
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    showToast('Failed to start Microverse. Check console for details.', 5000);
  }
}

init();
