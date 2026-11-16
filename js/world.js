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

export function createWorld(width, height, tileSize, options = {}) {
  const tiles = Array.from({ length: height }, () => Array(width).fill(TILE_TYPES.GRASS));
  const regrowTimers = Array.from({ length: height }, () => Array(width).fill(0));
  const occupied = Array.from({ length: height }, () => Array(width).fill(false));
  const empty = options.empty === true;

  if (!empty) {
    placePond(tiles, occupied, width, height);
    placeObjects(tiles, occupied, width, height, TILE_TYPES.TREE, randInt(18, 28), 2);
    placeObjects(tiles, occupied, width, height, TILE_TYPES.BUSH, randInt(20, 35), 1);
    placeObjects(tiles, occupied, width, height, TILE_TYPES.ROCK, randInt(10, 18), 1);
  }

  return { width, height, tileSize, tiles, regrowTimers };
}

export function cloneWorld(world) {
  return {
    width: world.width,
    height: world.height,
    tileSize: world.tileSize,
    tiles: world.tiles.map((row) => row.slice()),
    regrowTimers: world.regrowTimers.map((row) => row.slice())
  };
}

function placePond(tiles, occupied, width, height) {
  const centerX = randInt(6, width - 7);
  const centerY = randInt(5, height - 6);
  const radiusX = randInt(3, 6);
  const radiusY = randInt(2, 4);
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
  if (type === TILE_TYPES.DIRT) world.regrowTimers[y][x] = WORLD_CONFIG.grassRegrowTime;
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
  world.regrowTimers[y][x] = WORLD_CONFIG.grassRegrowTime;
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
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
