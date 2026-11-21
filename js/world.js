export const TILE_TYPES = {
  GRASS: 'grass',
  DIRT: 'dirt',
  WATER: 'water',
  TREE: 'tree',
  BUSH: 'bush',
  ROCK: 'rock'
};

export const WORLD_CONFIG = {
  grassRegrowTime: 18
};

export const WORLD_TRAITS = {
  rainy: { id: 'rainy', name: 'Rainy', description: 'Frequent showers keep the land green.', rules: ['Grass regrows 30% faster'], effects: { grassRegrowMult: 0.7 } },
  dry_spell: { id: 'dry_spell', name: 'Dry Spell', description: 'Water is scarce and grass recovers slowly.', rules: ['Grass regrows 35% slower'], effects: { grassRegrowMult: 1.35 } },
  lush_meadows: { id: 'lush_meadows', name: 'Lush Meadows', description: 'Plenty of cover and forage for rabbits.', rules: ['Start with 2 extra rabbits'], effects: { rabbitSpawnDelta: 2 } },
  sparse_forage: { id: 'sparse_forage', name: 'Sparse Forage', description: 'Food is harder to come by.', rules: ['Start with 2 fewer rabbits', 'Rabbits get hungry 15% faster'], effects: { rabbitSpawnDelta: -2, rabbitHungerMult: 1.15 } },
  sheltered_groves: { id: 'sheltered_groves', name: 'Sheltered Groves', description: 'Hidden thickets help prey stay calm.', rules: ['Rabbits get hungry 10% slower'], effects: { rabbitHungerMult: 0.9 } },
  wolf_country: { id: 'wolf_country', name: 'Wolf Country', description: 'Predators are well established here.', rules: ['Start with 1 extra wolf'], effects: { wolfSpawnDelta: 1 } },
  quiet_wilds: { id: 'quiet_wilds', name: 'Quiet Wilds', description: 'Predators are scarce and less far-seeing.', rules: ['Start with 1 fewer wolf', 'Wolf vision -1 tile'], effects: { wolfSpawnDelta: -1, wolfVisionDelta: -1 } }
};

const PRESET_TRAIT_POOLS = {
  meadow: ['rainy', 'lush_meadows', 'sheltered_groves', 'quiet_wilds', 'dry_spell'],
  wetland: ['rainy', 'lush_meadows', 'sheltered_groves', 'sparse_forage', 'quiet_wilds'],
  woodland: ['sheltered_groves', 'wolf_country', 'sparse_forage', 'dry_spell', 'quiet_wilds']
};

const TRAIT_INCOMPATIBLE = {
  rainy: new Set(['dry_spell']),
  dry_spell: new Set(['rainy']),
  lush_meadows: new Set(['sparse_forage']),
  sparse_forage: new Set(['lush_meadows', 'sheltered_groves']),
  sheltered_groves: new Set(['sparse_forage']),
  wolf_country: new Set(['quiet_wilds']),
  quiet_wilds: new Set(['wolf_country'])
};

export function pickWorldTraits(presetId, rng = Math.random) {
  const pool = (PRESET_TRAIT_POOLS[presetId] || PRESET_TRAIT_POOLS.meadow).slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const picked = [];
  for (const id of pool) {
    if (picked.length >= 2) break;
    if (picked.some(p => (TRAIT_INCOMPATIBLE[p] || new Set()).has(id))) continue;
    if (WORLD_TRAITS[id]) picked.push(id);
  }
  if (picked.length < 2) {
    for (const id of Object.keys(WORLD_TRAITS)) {
      if (picked.length >= 2) break;
      if (picked.includes(id)) continue;
      if (picked.some(p => (TRAIT_INCOMPATIBLE[p] || new Set()).has(id))) continue;
      picked.push(id);
    }
  }
  return picked;
}

export function getWorldTraitDetails(worldOrIds) {
  const ids = Array.isArray(worldOrIds) ? worldOrIds : (worldOrIds?.traits || []);
  return ids.map(id => WORLD_TRAITS[id]).filter(Boolean);
}

function composeTraitEffects(traitIds) {
  const effects = { grassRegrowMult: 1, rabbitSpawnDelta: 0, wolfSpawnDelta: 0, rabbitHungerMult: 1, wolfVisionDelta: 0 };
  for (const id of traitIds || []) {
    const eff = WORLD_TRAITS[id]?.effects || {};
    if (eff.grassRegrowMult) effects.grassRegrowMult *= eff.grassRegrowMult;
    if (eff.rabbitSpawnDelta) effects.rabbitSpawnDelta += eff.rabbitSpawnDelta;
    if (eff.wolfSpawnDelta) effects.wolfSpawnDelta += eff.wolfSpawnDelta;
    if (eff.rabbitHungerMult) effects.rabbitHungerMult *= eff.rabbitHungerMult;
    if (eff.wolfVisionDelta) effects.wolfVisionDelta += eff.wolfVisionDelta;
  }
  effects.rabbitSpawnDelta = Math.round(effects.rabbitSpawnDelta);
  effects.wolfSpawnDelta = Math.round(effects.wolfSpawnDelta);
  effects.grassRegrowMult = clamp(Number(effects.grassRegrowMult.toFixed(3)), 0.5, 2);
  effects.rabbitHungerMult = clamp(Number(effects.rabbitHungerMult.toFixed(3)), 0.5, 2);
  effects.wolfVisionDelta = Math.round(effects.wolfVisionDelta);
  return effects;
}

export function getWorldRules(world) {
  const grassTime = Number(world?.grassRegrowTime ?? WORLD_CONFIG.grassRegrowTime);
  const details = getWorldTraitDetails(world);
  return {
    grassRegrowTime: grassTime,
    traits: details,
    summary: [`Grass regrows in ${grassTime.toFixed(1)}s`, ...details.flatMap(t => t.rules)]
  };
}

export const WORLD_PRESETS = {
  meadow: {
    name: 'Meadow',
    pondCount: [1, 1], pondRadiusX: [3, 5], pondRadiusY: [2, 4],
    treeDensity: [0.018, 0.024], bushDensity: [0.024, 0.032], rockDensity: [0.010, 0.014],
    treePadding: 2, bushPadding: 1, rockPadding: 1
  },
  wetland: {
    name: 'Wetland',
    pondCount: [2, 3], pondRadiusX: [3, 6], pondRadiusY: [2, 4],
    treeDensity: [0.006, 0.012], bushDensity: [0.034, 0.046], rockDensity: [0.004, 0.008],
    treePadding: 2, bushPadding: 1, rockPadding: 1
  },
  woodland: {
    name: 'Woodland',
    pondCount: [0, 1], pondRadiusX: [2, 3], pondRadiusY: [1, 3],
    treeDensity: [0.055, 0.075], bushDensity: [0.014, 0.022], rockDensity: [0.012, 0.018],
    treePadding: 2, bushPadding: 1, rockPadding: 1
  }
};

export function createWorld(width, height, tileSize, options = {}) {
  const tiles = Array.from({ length: height }, () => Array(width).fill(TILE_TYPES.GRASS));
  const regrowTimers = Array.from({ length: height }, () => Array(width).fill(0));
  const occupied = Array.from({ length: height }, () => Array(width).fill(false));
  const empty = options.empty === true;
  const presetId = WORLD_PRESETS[options.preset] ? options.preset : 'meadow';
  const preset = WORLD_PRESETS[presetId];
  const traits = Array.isArray(options.traits) && options.traits.length
    ? options.traits.filter(id => WORLD_TRAITS[id]).slice(0, 3)
    : pickWorldTraits(presetId, options.rng);
  const traitEffects = composeTraitEffects(traits);
  const grassRegrowTime = clamp(Number((WORLD_CONFIG.grassRegrowTime * traitEffects.grassRegrowMult).toFixed(2)), 6, 60);

  if (!empty) {
    generateTerrain(tiles, occupied, width, height, preset);
  }

  return { width, height, tileSize, tiles, regrowTimers, preset: presetId, traits, grassRegrowTime, traitEffects };
}

function generateTerrain(tiles, occupied, width, height, preset) {
  const area = width * height;
  const pondCount = clamp(randIntIn(preset.pondCount), 0, 4);
  for (let i = 0; i < pondCount; i++) {
    const rx = clamp(randIntIn(preset.pondRadiusX), 2, Math.max(2, Math.floor(width / 4)));
    const ry = clamp(randIntIn(preset.pondRadiusY), 1, Math.max(2, Math.floor(height / 4)));
    placePond(tiles, occupied, width, height, rx, ry);
  }
  const trees = clamp(Math.round(randInRange(preset.treeDensity) * area), 0, Math.floor(area * 0.20));
  const bushes = clamp(Math.round(randInRange(preset.bushDensity) * area), 0, Math.floor(area * 0.20));
  const rocks = clamp(Math.round(randInRange(preset.rockDensity) * area), 0, Math.floor(area * 0.15));
  placeObjects(tiles, occupied, width, height, TILE_TYPES.TREE, trees, preset.treePadding);
  placeObjects(tiles, occupied, width, height, TILE_TYPES.BUSH, bushes, preset.bushPadding);
  placeObjects(tiles, occupied, width, height, TILE_TYPES.ROCK, rocks, preset.rockPadding);
}

export function cloneWorld(world) {
  return {
    width: world.width,
    height: world.height,
    tileSize: world.tileSize,
    tiles: world.tiles.map((row) => row.slice()),
    regrowTimers: world.regrowTimers.map((row) => row.slice()),
    preset: world.preset || 'meadow',
    traits: Array.isArray(world.traits) ? world.traits.slice() : [],
    grassRegrowTime: Number(world.grassRegrowTime ?? WORLD_CONFIG.grassRegrowTime),
    traitEffects: world.traitEffects && typeof world.traitEffects === 'object' ? { ...world.traitEffects } : {}
  };
}

function placePond(tiles, occupied, width, height, radiusX, radiusY) {
  const minX = radiusX + 2, maxX = width - radiusX - 3;
  const minY = radiusY + 2, maxY = height - radiusY - 3;
  if (maxX < minX || maxY < minY) return;
  let centerX = randInt(minX, maxX), centerY = randInt(minY, maxY);
  for (let attempt = 0; attempt < 20; attempt++) {
    if (tiles[centerY][centerX] !== TILE_TYPES.WATER) break;
    centerX = randInt(minX, maxX); centerY = randInt(minY, maxY);
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      const noise = (Math.random() - 0.5) * 0.35;
      if (dx * dx + dy * dy + noise <= 1) {
        tiles[y][x] = TILE_TYPES.WATER;
        occupied[y][x] = true;
      }
    }
  }
}

function placeObjects(tiles, occupied, width, height, type, count, padding) {
  let placed = 0, attempts = 0;
  const maxAttempts = count * 40;
  while (placed < count && attempts < maxAttempts) {
    attempts++;
    const x = randInt(padding, width - 1 - padding);
    const y = randInt(padding, height - 1 - padding);
    if (!isAreaFree(occupied, x, y, padding, width, height)) continue;
    if (tiles[y][x] !== TILE_TYPES.GRASS) continue;
    tiles[y][x] = type;
    markOccupied(occupied, x, y, padding, width, height);
    placed++;
  }
}

function isAreaFree(occupied, x, y, padding, width, height) {
  for (let dy = -padding; dy <= padding; dy++) {
    for (let dx = -padding; dx <= padding; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false;
      if (occupied[ny][nx]) return false;
    }
  }
  return true;
}

function markOccupied(occupied, x, y, padding, width, height) {
  for (let dy = -padding; dy <= padding; dy++) {
    for (let dx = -padding; dx <= padding; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) occupied[ny][nx] = true;
    }
  }
}

export function inBounds(world, x, y) {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

export function getTile(world, x, y) {
  if (!inBounds(world, x, y)) return null;
  return world.tiles[y][x];
}

export function setTile(world, x, y, type) {
  if (!inBounds(world, x, y)) return false;
  if (!Object.values(TILE_TYPES).includes(type)) return false;
  world.tiles[y][x] = type;
  world.regrowTimers[y][x] = 0;
  return true;
}

export function canPaintTile(world, x, y, type, entities = null) {
  if (!inBounds(world, x, y)) return false;
  if (!Object.values(TILE_TYPES).includes(type)) return false;
  if (entities && !isTileFreeOfEntities(entities, x, y) && !isWalkableType(type)) return false;
  return true;
}

export function paintTile(world, x, y, type, entities = null) {
  if (!canPaintTile(world, x, y, type, entities)) return false;
  // if placing non-walkable over occupied tile, disallow unless no entities
  if (entities && !isTileFreeOfEntities(entities, x, y) && !isWalkableType(type)) return false;
  setTile(world, x, y, type);
  if (type === TILE_TYPES.DIRT) world.regrowTimers[y][x] = Number(world.grassRegrowTime ?? WORLD_CONFIG.grassRegrowTime);
  return true;
}

export function eraseTile(world, x, y, entities = null) {
  return paintTile(world, x, y, TILE_TYPES.GRASS, entities);
}

export function isWalkableType(type) {
  return type === TILE_TYPES.GRASS || type === TILE_TYPES.DIRT || type === TILE_TYPES.BUSH;
}

export function isTileFreeOfEntities(entities, x, y) {
  if (!entities) return true;
  const list = Array.isArray(entities) ? entities : [...(entities.rabbits || []), ...(entities.wolves || [])];
  for (const e of list) {
    if (!e || !e.alive) continue;
    if (e.tileX === x && e.tileY === y) return false;
    if (e.targetX === x && e.targetY === y) return false;
  }
  return true;
}

export function getWorldStats(world) {
  const stats = { grass: 0, dirt: 0, trees: 0, water: 0, rocks: 0, bushes: 0 };
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const tile = world.tiles[y][x];
      if (tile === TILE_TYPES.GRASS) stats.grass++;
      else if (tile === TILE_TYPES.DIRT) stats.dirt++;
      else if (tile === TILE_TYPES.TREE) stats.trees++;
      else if (tile === TILE_TYPES.WATER) stats.water++;
      else if (tile === TILE_TYPES.ROCK) stats.rocks++;
      else if (tile === TILE_TYPES.BUSH) stats.bushes++;
    }
  }
  return stats;
}

export function isWalkable(world, x, y) {
  if (!inBounds(world, x, y)) return false;
  return isWalkableType(world.tiles[y][x]);
}

export function depleteGrass(world, x, y) {
  if (!inBounds(world, x, y)) return false;
  if (world.tiles[y][x] !== TILE_TYPES.GRASS) return false;
  world.tiles[y][x] = TILE_TYPES.DIRT;
  world.regrowTimers[y][x] = Number(world.grassRegrowTime ?? WORLD_CONFIG.grassRegrowTime);
  return true;
}

export function updateGrassRegrowth(world, dt, onRegrow = null) {
  let regrown = 0;
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (world.tiles[y][x] !== TILE_TYPES.DIRT) continue;
      world.regrowTimers[y][x] -= dt;
      if (world.regrowTimers[y][x] <= 0) {
        world.tiles[y][x] = TILE_TYPES.GRASS;
        world.regrowTimers[y][x] = 0;
        regrown++;
        if (onRegrow) onRegrow(x, y);
      }
    }
  }
  return regrown;
}

export function getRandomGrassSpawn(world) {
  for (let i = 0; i < 400; i++) {
    const x = randInt(0, world.width - 1);
    const y = randInt(0, world.height - 1);
    if (world.tiles[y][x] === TILE_TYPES.GRASS) return { x, y };
  }
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (world.tiles[y][x] === TILE_TYPES.GRASS) return { x, y };
    }
  }
  return null;
}

export function getRandomWalkableTile(world, avoid = null) {
  for (let i = 0; i < 500; i++) {
    const x = randInt(0, world.width - 1);
    const y = randInt(0, world.height - 1);
    if (!isWalkable(world, x, y)) continue;
    if (avoid && !isTileFreeOfEntities(avoid, x, y)) continue;
    return { x, y };
  }
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (!isWalkable(world, x, y)) continue;
      if (avoid && !isTileFreeOfEntities(avoid, x, y)) continue;
      return { x, y };
    }
  }
  return null;
}

function randInt(min, max) {
  if (max < min) max = min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randInRange(range) {
  const [min, max] = range;
  return min + Math.random() * (max - min);
}
function randIntIn(range) { return randInt(range[0], range[1]); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
