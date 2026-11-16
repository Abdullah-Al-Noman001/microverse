import { TILE_TYPES, isWalkable, depleteGrass, updateGrassRegrowth, getRandomGrassSpawn, getRandomWalkableTile, isTileFreeOfEntities } from './world.js';
import { createRabbit, createWolf, RABBIT_CONFIG, WOLF_CONFIG, getEntityRenderPos, setIdCounters, sanitizeEntityPosition } from './entities.js';

const MAX_EVENTS = 120;
const MAX_HISTORY = 240;
const HISTORY_INTERVAL = 1.0;

export function createSimulation(world, options = {}) {
  const rabbits = options.initialRabbits ?? spawnInitialRabbits(world);
  const wolves = options.initialWolves ?? spawnInitialWolves(world, rabbits);
  const sim = {
    world,
    rabbits,
    wolves,
    stats: {
      rabbitBirths: 0, rabbitDeaths: 0,
      wolfBirths: 0, wolfDeaths: 0,
      successfulHunts: 0
    },
    time: 0,
    events: [],
    history: [],
    _historyTimer: 0,
    _eventSeq: 1,
    _regrowBatch: 0,
    _regrowFlush: 0
  };
  if (!options.skipWelcome) addEvent(sim, 'world', 'A new ecosystem begins.');
  recordHistory(sim, true);
  return sim;
}

export function resetSimulation(sim) {
  sim.rabbits.length = 0;
  sim.wolves.length = 0;
  sim.stats.rabbitBirths = 0; sim.stats.rabbitDeaths = 0;
  sim.stats.wolfBirths = 0; sim.stats.wolfDeaths = 0;
  sim.stats.successfulHunts = 0;
  sim.time = 0;
  sim.events.length = 0; sim._eventSeq = 1;
  sim.history.length = 0; sim._historyTimer = 0;
  sim._regrowBatch = 0; sim._regrowFlush = 0;
  const rabbits = spawnInitialRabbits(sim.world);
  const wolves = spawnInitialWolves(sim.world, rabbits);
  sim.rabbits.push(...rabbits);
  sim.wolves.push(...wolves);
  addEvent(sim, 'world', 'Simulation reset.');
  for (const r of rabbits) addEvent(sim, 'birth', `Rabbit #${r.id} entered the world.`);
  for (const w of wolves) addEvent(sim, 'birth', `Wolf #${w.id} entered the world.`);
  recordHistory(sim, true);
}

function spawnInitialRabbits(world) {
  const count = randInt(RABBIT_CONFIG.countMin, RABBIT_CONFIG.countMax);
  const rabbits = [];
  const used = new Set();
  let attempts = 0;
  while (rabbits.length < count && attempts < 700) {
    attempts++;
    const pos = getRandomGrassSpawn(world) || getRandomWalkableTile(world);
    if (!pos) break;
    const key = `${pos.x},${pos.y}`;
    if (used.has(key)) continue;
    used.add(key);
    rabbits.push(createRabbit(pos.x, pos.y));
  }
  return rabbits;
}

function spawnInitialWolves(world, rabbits) {
  const count = randInt(WOLF_CONFIG.countMin, WOLF_CONFIG.countMax);
  const wolves = [];
  const used = new Set(rabbits.map((r) => `${r.tileX},${r.tileY}`));
  let attempts = 0;
  while (wolves.length < count && attempts < 900) {
    attempts++;
    const pos = getRandomWalkableTile(world) || getRandomGrassSpawn(world);
    if (!pos) break;
    const key = `${pos.x},${pos.y}`;
    if (used.has(key)) continue;
    let tooClose = false;
    for (const r of rabbits) if (manhattan(pos.x, pos.y, r.tileX, r.tileY) < 3) { tooClose = true; break; }
    if (tooClose && attempts < 500) continue;
    used.add(key);
    wolves.push(createWolf(pos.x, pos.y));
  }
  return wolves;
}

export function stepSimulation(sim, dt) {
  sim.time += dt;

  sim._regrowBatch = 0;
  updateGrassRegrowth(sim.world, dt, () => { sim._regrowBatch++; });
  if (sim._regrowBatch > 0) {
    sim._regrowFlush += sim._regrowBatch;
  }
  // aggregate regrow events to avoid log spam
  if (sim._regrowFlush >= 6 || (sim._regrowFlush > 0 && sim.time % 5 < dt)) {
    addEvent(sim, 'grass', `${sim._regrowFlush} grass tile${sim._regrowFlush === 1 ? '' : 's'} regrew.`);
    sim._regrowFlush = 0;
  }

  // update in type order but interactions resolved via shared arrays
  for (const rabbit of sim.rabbits) if (rabbit.alive) updateRabbit(rabbit, sim, dt);
  for (const wolf of sim.wolves) if (wolf.alive) updateWolf(wolf, sim, dt);

  handleRabbitReproduction(sim);
  handleWolfReproduction(sim);

  let rabbitDeaths = 0;
  for (let i = sim.rabbits.length - 1; i >= 0; i--) {
    if (!sim.rabbits[i].alive) {
      const r = sim.rabbits[i];
      if (r._deathLogged) { /* already counted in hunt */ }
      else { addEvent(sim, 'death', `Rabbit #${r.id} died.`); }
      sim.rabbits.splice(i, 1);
      rabbitDeaths++;
    }
  }
  if (rabbitDeaths) sim.stats.rabbitDeaths += rabbitDeaths;

  let wolfDeaths = 0;
  for (let i = sim.wolves.length - 1; i >= 0; i--) {
    if (!sim.wolves[i].alive) {
      const w = sim.wolves[i];
      if (!w._deathLogged) addEvent(sim, 'death', `Wolf #${w.id} died.`);
      sim.wolves.splice(i, 1);
      wolfDeaths++;
    }
  }
  if (wolfDeaths) sim.stats.wolfDeaths += wolfDeaths;

  sim._historyTimer += dt;
  if (sim._historyTimer >= HISTORY_INTERVAL) {
    sim._historyTimer = 0;
    recordHistory(sim);
  }
  return sim;
}

function updateRabbit(rabbit, sim, dt) {
  const { world } = sim;
  if (!rabbit.alive) return;
  rabbit.age += dt;
  rabbit.reproductionCooldown = Math.max(0, rabbit.reproductionCooldown - dt);
  rabbit.hunger = clamp(rabbit.hunger + rabbit.hungerRate * dt, 0, RABBIT_CONFIG.maxHunger);
  if (rabbit.hunger > RABBIT_CONFIG.hungerThreshold) {
    rabbit.energy -= RABBIT_CONFIG.energyDrainWhenHungry * dt * (rabbit.hunger / RABBIT_CONFIG.maxHunger);
  } else {
    rabbit.energy -= RABBIT_CONFIG.idleEnergyDrain * dt;
  }
  rabbit.energy = clamp(rabbit.energy, 0, RABBIT_CONFIG.maxEnergy);

  if (rabbit.age >= rabbit.maxAge || rabbit.energy <= 0) {
    killEntity(rabbit);
    return;
  }

  // if terrain under moving/stopped rabbit became invalid, stop safely
  if (!isWalkable(world, rabbit.tileX, rabbit.tileY) && !isMoving(rabbit)) {
    const safe = getRandomWalkableTile(world, { rabbits: sim.rabbits, wolves: sim.wolves }) || { x: rabbit.tileX, y: rabbit.tileY };
    placeEntityAt(rabbit, safe.x, safe.y);
  }

  if (rabbit.state === 'eating') {
    rabbit.eatTimer -= dt;
    if (rabbit.eatTimer <= 0) finishEating(rabbit, sim);
    return;
  }

  if (isMoving(rabbit)) {
    advanceMovement(rabbit, world, dt, speedForRabbit(rabbit));
    rabbit.energy -= (isRabbitFleeing(rabbit) ? RABBIT_CONFIG.fleeExtraDrain : 0) * dt;
    rabbit.energy = clamp(rabbit.energy, 0, RABBIT_CONFIG.maxEnergy);
    if (rabbit.energy <= 0) { snapToTile(rabbit); killEntity(rabbit); }
    return;
  }

  snapToTile(rabbit);
  if (!isWalkable(world, rabbit.tileX, rabbit.tileY)) {
    const safe = getRandomWalkableTile(world, { rabbits: sim.rabbits, wolves: sim.wolves });
    if (safe) placeEntityAt(rabbit, safe.x, safe.y);
  }

  const threat = findNearestWolf(sim.wolves, rabbit.tileX, rabbit.tileY, RABBIT_CONFIG.wolfDetectRadius);
  if (threat) {
    rabbit.state = 'fleeing';
    const step = chooseStepAway(rabbit, world, sim.rabbits, sim.wolves, threat.tileX, threat.tileY)
      || anyValidStep(rabbit, world, sim.rabbits, sim.wolves);
    if (step) beginMove(rabbit, step.x, step.y);
    else { rabbit.wanderPause = 0.2; }
    return;
  }

  const hungry = rabbit.hunger >= RABBIT_CONFIG.hungerThreshold || rabbit.energy < 55;
  if (hungry) {
    const food = findNearestFood(world, rabbit.tileX, rabbit.tileY, RABBIT_CONFIG.foodSearchRadius);
    if (food) {
      if (food.x === rabbit.tileX && food.y === rabbit.tileY) { startRabbitEating(rabbit); return; }
      rabbit.state = 'searching';
      const step = chooseStepToward(rabbit, world, sim.rabbits, sim.wolves, food.x, food.y);
      if (step) beginMove(rabbit, step.x, step.y); else wander(rabbit, world, sim.rabbits, sim.wolves, dt);
      return;
    }
  }

  rabbit.state = 'wandering';
  wander(rabbit, world, sim.rabbits, sim.wolves, dt);
}

function updateWolf(wolf, sim, dt) {
  const { world, rabbits } = sim;
  if (!wolf.alive) return;
  wolf.age += dt;
  wolf.reproductionCooldown = Math.max(0, wolf.reproductionCooldown - dt);
  wolf.huntEffectTimer = Math.max(0, wolf.huntEffectTimer - dt);
  wolf.hunger = clamp(wolf.hunger + wolf.hungerRate * dt, 0, WOLF_CONFIG.maxHunger);
  if (wolf.hunger > WOLF_CONFIG.hungerThreshold) {
    wolf.energy -= WOLF_CONFIG.energyDrainWhenHungry * dt * (wolf.hunger / WOLF_CONFIG.maxHunger);
  } else {
    wolf.energy -= WOLF_CONFIG.idleEnergyDrain * dt;
  }
  wolf.energy = clamp(wolf.energy, 0, WOLF_CONFIG.maxEnergy);

  if (wolf.age >= wolf.maxAge || wolf.energy <= 0) {
    killEntity(wolf);
    return;
  }

  if (!isWalkable(world, wolf.tileX, wolf.tileY) && !isMoving(wolf)) {
    const safe = getRandomWalkableTile(world, { rabbits: sim.rabbits, wolves: sim.wolves });
    if (safe) placeEntityAt(wolf, safe.x, safe.y);
  }

  if (wolf.state === 'eating') {
    wolf.eatTimer -= dt;
    if (wolf.eatTimer <= 0) {
      wolf.state = 'resting';
      wolf.restTimer = rand(WOLF_CONFIG.restDurationMin, WOLF_CONFIG.restDurationMax);
    }
    return;
  }
  if (wolf.state === 'resting') {
    wolf.restTimer -= dt;
    if (wolf.restTimer <= 0) wolf.state = 'wandering';
    return;
  }

  if (isMoving(wolf)) {
    const chasing = wolf.state === 'chasing' || wolf.state === 'hunting';
    advanceMovement(wolf, world, dt, speedForWolf(wolf));
    wolf.energy -= (chasing ? WOLF_CONFIG.chaseExtraDrain : 0) * dt;
    wolf.energy = clamp(wolf.energy, 0, WOLF_CONFIG.maxEnergy);
    if (chasing) tryCatchTarget(wolf, sim);
    if (wolf.energy <= 0) { snapToTile(wolf); killEntity(wolf); }
    return;
  }

  snapToTile(wolf);
  if (wolf.state === 'chasing' || wolf.state === 'hunting') tryCatchTarget(wolf, sim);
  if (!wolf.alive || wolf.state === 'eating') return;

  const target = resolveWolfTarget(wolf, rabbits);
  if (target) {
    wolf.targetRabbitId = target.id;
    const posT = getEntityRenderPos(target);
    const posW = getEntityRenderPos(wolf);
    const d = euclid(posW.x, posW.y, posT.x, posT.y);
    if (d <= WOLF_CONFIG.catchDistance) { doCatch(wolf, target, sim); return; }
    wolf.state = d <= 1.35 ? 'hunting' : 'chasing';
    const step = chooseStepToward(wolf, world, sim.wolves, [], Math.round(posT.x), Math.round(posT.y));
    if (step) beginMove(wolf, step.x, step.y); else wander(wolf, world, sim.wolves, [], dt);
    return;
  }

  wolf.targetRabbitId = null;
  wolf.state = (wolf.hunger > WOLF_CONFIG.hungerThreshold || wolf.energy < 60) ? 'searching' : 'wandering';
  wander(wolf, world, sim.wolves, [], dt);
}

function resolveWolfTarget(wolf, rabbits) {
  let target = wolf.targetRabbitId != null ? rabbits.find((r) => r.id === wolf.targetRabbitId && r.alive) : null;
  if (target) {
    const d = euclid(wolf.tileX, wolf.tileY, target.tileX, target.tileY);
    if (d > WOLF_CONFIG.loseTargetRange) target = null;
  }
  if (!target) target = findNearestRabbit(rabbits, wolf.tileX, wolf.tileY, wolf.visionRange);
  return target;
}

function tryCatchTarget(wolf, sim) {
  const target = sim.rabbits.find((r) => r.id === wolf.targetRabbitId && r.alive);
  if (!target) return;
  const wp = getEntityRenderPos(wolf);
  const rp = getEntityRenderPos(target);
  if (euclid(wp.x, wp.y, rp.x, rp.y) <= WOLF_CONFIG.catchDistance) {
    doCatch(wolf, target, sim);
  }
}

function doCatch(wolf, rabbit, sim) {
  if (!rabbit.alive || wolf.state === 'eating') return;
  killEntity(rabbit);
  rabbit._deathLogged = true;
  wolf.state = 'eating';
  wolf.eatTimer = WOLF_CONFIG.eatDuration;
  wolf.targetRabbitId = null;
  wolf.successfulHunts += 1;
  wolf.huntEffectTimer = 0.7;
  wolf.energy = clamp(wolf.energy + WOLF_CONFIG.energyRestoreEat, 0, WOLF_CONFIG.maxEnergy);
  wolf.hunger = clamp(wolf.hunger - WOLF_CONFIG.hungerReduceEat, 0, WOLF_CONFIG.maxHunger);
  sim.stats.successfulHunts += 1;
  snapToTile(wolf);
  addEvent(sim, 'hunt', `Wolf #${wolf.id} caught Rabbit #${rabbit.id}.`);
}

function startRabbitEating(rabbit) {
  rabbit.state = 'eating';
  rabbit.eatTimer = RABBIT_CONFIG.eatDuration;
}

function finishEating(rabbit, sim) {
  const ate = depleteGrass(sim.world, rabbit.tileX, rabbit.tileY);
  if (ate) {
    rabbit.energy = clamp(rabbit.energy + RABBIT_CONFIG.energyRestoreEat, 0, RABBIT_CONFIG.maxEnergy);
    rabbit.hunger = clamp(rabbit.hunger - RABBIT_CONFIG.hungerReduceEat, 0, RABBIT_CONFIG.maxHunger);
    if (Math.random() < 0.12) addEvent(sim, 'grass', `Rabbit #${rabbit.id} grazed grass.`);
  }
  rabbit.state = 'wandering';
  rabbit.eatTimer = 0;
}

function wander(entity, world, sameSpecies, otherSpecies, dt) {
  entity.wanderPause -= dt;
  if (entity.wanderPause > 0) return;
  const dirs = shuffle(cardinalFrom(entity.tileX, entity.tileY));
  for (const d of dirs) {
    if (canEntityMoveTo(entity, world, sameSpecies, otherSpecies, d.x, d.y)) {
      beginMove(entity, d.x, d.y);
      entity.wanderPause = rand(0.2, 1.2);
      return;
    }
  }
  entity.wanderPause = rand(0.4, 1.0);
}

function beginMove(entity, tx, ty) {
  entity.prevX = entity.tileX; entity.prevY = entity.tileY;
  entity.targetX = tx; entity.targetY = ty;
  entity.moveProgress = 0;
  entity.direction = directionFrom(entity.prevX, entity.prevY, tx, ty);
}

function advanceMovement(entity, world, dt, speed) {
  entity.energy -= (entity.type === 'wolf' ? WOLF_CONFIG.moveEnergyDrain : RABBIT_CONFIG.moveEnergyDrain) * dt;
  entity.moveProgress += dt * speed;
  if (entity.moveProgress >= 1) {
    entity.moveProgress = 1;
    snapToTileTarget(entity);
  } else {
    entity.x = entity.prevX + (entity.targetX - entity.prevX) * entity.moveProgress;
    entity.y = entity.prevY + (entity.targetY - entity.prevY) * entity.moveProgress;
  }
}

function snapToTile(entity) { entity.tileX = entity.targetX; entity.tileY = entity.targetY; entity.x = entity.targetX; entity.y = entity.targetY; }
function snapToTileTarget(entity) { snapToTile(entity); }
function isMoving(entity) { return entity.moveProgress < 1 || entity.tileX !== entity.targetX || entity.tileY !== entity.targetY; }

function canEntityMoveTo(entity, world, sameSpecies, otherSpecies, x, y) {
  if (!inBounds(world, x, y) || !isWalkable(world, x, y)) return false;
  for (const other of sameSpecies) {
    if (other === entity || !other.alive) continue;
    // prevent target collisions and strong overlap on same species
    if (other.targetX === x && other.targetY === y) return false;
    if (other.tileX === x && other.tileY === y && other.moveProgress < 0.75) return false;
  }
  // avoid stepping into tiles currently occupied by the other species to reduce overlap
  for (const other of otherSpecies || []) {
    if (!other || !other.alive) continue;
    if (other.targetX === x && other.targetY === y) return false;
    if (other.tileX === x && other.tileY === y && other.moveProgress < 0.5) return false;
  }
  return true;
}

function chooseStepToward(entity, world, sameSpecies, otherSpecies, goalX, goalY) {
  const options = cardinalFrom(entity.tileX, entity.tileY).filter((o) => canEntityMoveTo(entity, world, sameSpecies, otherSpecies, o.x, o.y));
  if (options.length === 0) return null;
  options.sort((a, b) => manhattan(a.x, a.y, goalX, goalY) - manhattan(b.x, b.y, goalX, goalY));
  if (options.length > 1 && Math.random() < 0.12) return options[1];
  return options[0];
}

function chooseStepAway(entity, world, sameSpecies, otherSpecies, threatX, threatY) {
  const options = cardinalFrom(entity.tileX, entity.tileY).filter((o) => canEntityMoveTo(entity, world, sameSpecies, otherSpecies, o.x, o.y));
  if (options.length === 0) return null;
  const cur = manhattan(entity.tileX, entity.tileY, threatX, threatY);
  options.sort((a, b) => manhattan(b.x, b.y, threatX, threatY) - manhattan(a.x, a.y, threatX, threatY));
  // if no improving step, pick any valid to avoid getting stuck in corners
  const improving = options.filter((o) => manhattan(o.x, o.y, threatX, threatY) >= cur);
  const pool = improving.length ? improving : options;
  if (pool.length > 1 && Math.random() < 0.12) return pool[1];
  return pool[0];
}

function anyValidStep(entity, world, sameSpecies, otherSpecies) {
  const options = cardinalFrom(entity.tileX, entity.tileY).filter((o) => canEntityMoveTo(entity, world, sameSpecies, otherSpecies, o.x, o.y));
  return options.length ? options[0] : null;
}

function findNearestFood(world, x, y, radius) {
  let best = null, bestDist = Infinity;
  const minX = Math.max(0, x - radius), maxX = Math.min(world.width - 1, x + radius);
  const minY = Math.max(0, y - radius), maxY = Math.min(world.height - 1, y + radius);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (world.tiles[ty][tx] !== TILE_TYPES.GRASS) continue;
      const d = manhattan(x, y, tx, ty);
      if (d < bestDist) { bestDist = d; best = { x: tx, y: ty }; }
    }
  }
  return best;
}

function findNearestWolf(wolves, x, y, radius) {
  let best = null, bestD = Infinity;
  for (const w of wolves) {
    if (!w.alive) continue;
    const d = euclid(x, y, w.tileX, w.tileY);
    if (d <= radius && d < bestD) { bestD = d; best = w; }
  }
  return best;
}

function findNearestRabbit(rabbits, x, y, radius) {
  let best = null, bestD = Infinity;
  for (const r of rabbits) {
    if (!r.alive) continue;
    const d = euclid(x, y, r.tileX, r.tileY);
    if (d <= radius && d < bestD) { bestD = d; best = r; }
  }
  return best;
}

function handleRabbitReproduction(sim) {
  const { world, rabbits, wolves, stats } = sim;
  if (rabbits.length >= RABBIT_CONFIG.maxPopulation) return;
  const candidates = rabbits.filter((r) => canRabbitReproduce(r));
  for (let i = 0; i < candidates.length; i++) {
    if (rabbits.length >= RABBIT_CONFIG.maxPopulation) break;
    const a = candidates[i];
    if (!a.alive || !canRabbitReproduce(a)) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      if (rabbits.length >= RABBIT_CONFIG.maxPopulation) break;
      const b = candidates[j];
      if (!b.alive || !canRabbitReproduce(b)) continue;
      if (entityDistance(a, b) <= RABBIT_CONFIG.reproduceDistance) {
        const babyPos = findBirthSpot(world, rabbits, wolves, a, b);
        if (babyPos) {
          const baby = createRabbit(babyPos.x, babyPos.y, { age: 0, energy: 75, hunger: 15, reproductionCooldown: 10 });
          rabbits.push(baby);
          stats.rabbitBirths += 1;
          applyReproCost(a, RABBIT_CONFIG); applyReproCost(b, RABBIT_CONFIG);
          a.state = 'wandering'; b.state = 'wandering';
          addEvent(sim, 'birth', `Rabbit #${baby.id} was born.`);
          break;
        }
      }
    }
  }
}

function handleWolfReproduction(sim) {
  const { world, rabbits, wolves, stats } = sim;
  if (wolves.length >= WOLF_CONFIG.maxPopulation) return;
  const candidates = wolves.filter((w) => canWolfReproduce(w));
  for (let i = 0; i < candidates.length; i++) {
    if (wolves.length >= WOLF_CONFIG.maxPopulation) break;
    const a = candidates[i];
    if (!a.alive || !canWolfReproduce(a)) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      if (wolves.length >= WOLF_CONFIG.maxPopulation) break;
      const b = candidates[j];
      if (!b.alive || !canWolfReproduce(b)) continue;
      if (entityDistance(a, b) <= WOLF_CONFIG.reproduceDistance) {
        const babyPos = findBirthSpot(world, wolves, rabbits, a, b);
        if (babyPos) {
          const baby = createWolf(babyPos.x, babyPos.y, { age: 0, energy: 78, hunger: 20, reproductionCooldown: 16 });
          wolves.push(baby);
          stats.wolfBirths += 1;
          applyReproCost(a, WOLF_CONFIG); applyReproCost(b, WOLF_CONFIG);
          a.state = 'wandering'; b.state = 'wandering';
          addEvent(sim, 'birth', `Wolf #${baby.id} was born.`);
          break;
        }
      }
    }
  }
}

function canRabbitReproduce(r) {
  return r.alive && r.age >= RABBIT_CONFIG.reproduceMinAge && r.energy >= RABBIT_CONFIG.reproduceMinEnergy && r.hunger <= RABBIT_CONFIG.reproduceMaxHunger && r.reproductionCooldown <= 0 && r.state !== 'eating' && r.state !== 'fleeing';
}
function canWolfReproduce(w) {
  return w.alive && w.age >= WOLF_CONFIG.reproduceMinAge && w.energy >= WOLF_CONFIG.reproduceMinEnergy && w.hunger <= WOLF_CONFIG.reproduceMaxHunger && w.reproductionCooldown <= 0 && (w.state === 'wandering' || w.state === 'searching' || w.state === 'resting');
}
function applyReproCost(e, cfg) { e.reproductionCooldown = cfg.reproduceCooldown; e.energy = Math.max(20, e.energy - cfg.reproduceCost); }

function findBirthSpot(world, primaryGroup, secondaryGroup, a, b) {
  const cx = Math.round((a.tileX + b.tileX) / 2);
  const cy = Math.round((a.tileY + b.tileY) / 2);
  for (let radius = 1; radius <= 3; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx, y = cy + dy;
        if (canEntityMoveTo({ tileX: -99, tileY: -99 }, world, primaryGroup, secondaryGroup, x, y)) return { x, y };
      }
    }
  }
  return null;
}

export function addRabbit(sim, x, y) {
  if (!isWalkable(sim.world, x, y) || !isTileFreeOfEntities(sim, x, y)) return null;
  if (sim.rabbits.length >= RABBIT_CONFIG.maxPopulation) return null;
  const r = createRabbit(x, y, { age: rand(0, 6), energy: rand(75, 100), hunger: rand(5, 20) });
  sim.rabbits.push(r);
  sim.stats.rabbitBirths += 1; // tracked as introduction/birth total; event clarifies
  addEvent(sim, 'birth', `Rabbit #${r.id} was introduced.`);
  recordHistory(sim, true);
  return r;
}

export function addWolf(sim, x, y) {
  if (!isWalkable(sim.world, x, y) || !isTileFreeOfEntities(sim, x, y)) return null;
  if (sim.wolves.length >= WOLF_CONFIG.maxPopulation) return null;
  const w = createWolf(x, y, { age: rand(0, 8), energy: rand(78, 100), hunger: rand(10, 25) });
  sim.wolves.push(w);
  sim.stats.wolfBirths += 1;
  addEvent(sim, 'birth', `Wolf #${w.id} was introduced.`);
  recordHistory(sim, true);
  return w;
}

export function addEvent(sim, kind, message) {
  const ev = { id: sim._eventSeq++, kind, message, time: sim.time };
  sim.events.push(ev);
  if (sim.events.length > MAX_EVENTS) sim.events.splice(0, sim.events.length - MAX_EVENTS);
  return ev;
}

export function recordHistory(sim, force = false) {
  const grass = countGrass(sim.world);
  const sample = { t: sim.time, rabbits: sim.rabbits.length, wolves: sim.wolves.length, grass };
  if (!force && sim.history.length) {
    const last = sim.history[sim.history.length - 1];
    if (last.rabbits === sample.rabbits && last.wolves === sample.wolves && last.grass === sample.grass && (sample.t - last.t) < 2) return;
  }
  sim.history.push(sample);
  if (sim.history.length > MAX_HISTORY) sim.history.splice(0, sim.history.length - MAX_HISTORY);
}

export function countGrass(world) {
  let g = 0;
  for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) if (world.tiles[y][x] === TILE_TYPES.GRASS) g++;
  return g;
}

export function serializeSimulation(sim, worldName = 'Microverse') {
  return {
    version: 1,
    worldName,
    time: sim.time,
    world: {
      width: sim.world.width, height: sim.world.height, tileSize: sim.world.tileSize,
      tiles: sim.world.tiles.map(r => r.slice()),
      regrowTimers: sim.world.regrowTimers.map(r => r.slice())
    },
    stats: { ...sim.stats },
    rabbits: sim.rabbits.map(serializeEntity),
    wolves: sim.wolves.map(serializeEntity),
    events: sim.events.slice(-60),
    history: sim.history.slice(-120),
    idCounters: {
      rabbit: sim.rabbits.reduce((m,e)=>Math.max(m,e.id),0),
      wolf: sim.wolves.reduce((m,e)=>Math.max(m,e.id),0)
    }
  };
}

export function hydrateSimulation(data) {
  if (!data || !data.world || !Array.isArray(data.world.tiles)) throw new Error('Invalid save data');
  const w = data.world;
  const world = { width: w.width, height: w.height, tileSize: w.tileSize, tiles: w.tiles.map(r => r.slice()), regrowTimers: (w.regrowTimers||[]).map(r => r.slice()) };
  // ensure regrowTimers shape
  if (world.regrowTimers.length !== world.height) world.regrowTimers = Array.from({length:world.height},()=>Array(world.width).fill(0));
  const sim = {
    world,
    rabbits: [], wolves: [],
    stats: { rabbitBirths: 0, rabbitDeaths: 0, wolfBirths: 0, wolfDeaths: 0, successfulHunts: 0, ...(data.stats||{}) },
    time: Number(data.time) || 0,
    events: Array.isArray(data.events) ? data.events.slice(-MAX_EVENTS) : [],
    history: Array.isArray(data.history) ? data.history.slice(-MAX_HISTORY) : [],
    _historyTimer: 0, _eventSeq: 1, _regrowBatch: 0, _regrowFlush: 0
  };
  setIdCounters(data.idCounters?.rabbit || 0, data.idCounters?.wolf || 0);
  for (const r of (data.rabbits||[])) {
    if (!r) continue;
    const e = createRabbit(clampInt(r.tileX??r.x,0,world.width-1), clampInt(r.tileY??r.y,0,world.height-1), r);
    Object.assign(e, safeEntityFields(r));
    e.type='rabbit'; sanitizeEntityPosition(e, world); if (!isWalkable(world,e.tileX,e.tileY)) { const s=getRandomWalkableTile(world); if(s) sanitizePlace(e,s.x,s.y); }
    if (e.energy>0 && e.age < e.maxAge) e.alive=true; else { e.alive=false; }
    if (e.alive) sim.rabbits.push(e);
  }
  for (const wEnt of (data.wolves||[])) {
    if (!wEnt) continue;
    const e = createWolf(clampInt(wEnt.tileX??wEnt.x,0,world.width-1), clampInt(wEnt.tileY??wEnt.y,0,world.height-1), wEnt);
    Object.assign(e, safeEntityFields(wEnt));
    e.type='wolf'; e.successfulHunts = Number(wEnt.successfulHunts)||0; e.targetRabbitId = wEnt.targetRabbitId ?? null;
    sanitizeEntityPosition(e, world); if (!isWalkable(world,e.tileX,e.tileY)) { const s=getRandomWalkableTile(world); if(s) sanitizePlace(e,s.x,s.y); }
    if (e.energy>0 && e.age < e.maxAge) e.alive=true; else { e.alive=false; }
    if (e.alive) sim.wolves.push(e);
  }
  // fix id counters to avoid collisions
  setIdCounters(
    sim.rabbits.reduce((m,e)=>Math.max(m,e.id), data.idCounters?.rabbit||0),
    sim.wolves.reduce((m,e)=>Math.max(m,e.id), data.idCounters?.wolf||0)
  );
  sim._eventSeq = sim.events.reduce((m,e)=>Math.max(m, e.id||0),0) + 1;
  if (!sim.history.length) recordHistory(sim, true);
  return sim;
}

function serializeEntity(e) {
  return {
    id: e.id, x: e.tileX, y: e.tileY, energy: e.energy, hunger: e.hunger, age: e.age,
    reproductionCooldown: e.reproductionCooldown, state: e.state, alive: e.alive,
    moveSpeed: e.moveSpeed, hungerRate: e.hungerRate, visionRange: e.visionRange, maxAge: e.maxAge,
    eatTimer: e.eatTimer, restTimer: e.restTimer, direction: e.direction, successfulHunts: e.successfulHunts
  };
}
function safeEntityFields(r) {
  return {
    energy: Number(r.energy), hunger: Number(r.hunger), age: Number(r.age),
    reproductionCooldown: Number(r.reproductionCooldown)||0, state: typeof r.state==='string'?r.state:'wandering',
    moveSpeed: Number(r.moveSpeed), hungerRate: Number(r.hungerRate), visionRange: r.visionRange!=null?Number(r.visionRange):undefined,
    maxAge: Number(r.maxAge), eatTimer: Number(r.eatTimer)||0, restTimer: Number(r.restTimer)||0,
    direction: typeof r.direction==='string'?r.direction:'down'
  };
}
function sanitizePlace(e,x,y){ e.tileX=x;e.tileY=y;e.x=x;e.y=y;e.prevX=x;e.prevY=y;e.targetX=x;e.targetY=y;e.moveProgress=1; }

function killEntity(e) { e.alive = false; e.energy = 0; if (e.state !== 'dead') e.state = 'dead'; }
function placeEntityAt(e,x,y){ e.tileX=x;e.tileY=y;e.x=x;e.y=y;e.prevX=x;e.prevY=y;e.targetX=x;e.targetY=y;e.moveProgress=1; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function clampInt(v,min,max){ v = Math.round(Number(v)); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max,v)); }

function speedForRabbit(r) { return r.moveSpeed + (isRabbitFleeing(r) ? RABBIT_CONFIG.fleeSpeedBonus : 0); }
function speedForWolf(w) { return w.moveSpeed + ((w.state === 'chasing' || w.state === 'hunting') ? WOLF_CONFIG.chaseSpeedBonus : 0); }
function isRabbitFleeing(r) { return r.state === 'fleeing'; }

function cardinalFrom(x, y) { return [ { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 } ]; }
function directionFrom(fx, fy, tx, ty) { if (tx > fx) return 'right'; if (tx < fx) return 'left'; if (ty > fy) return 'down'; return 'up'; }
function inBounds(world, x, y) { return x >= 0 && y >= 0 && x < world.width && y < world.height; }
function manhattan(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }
function euclid(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function entityDistance(a, b) { const pa = getEntityRenderPos(a), pb = getEntityRenderPos(b); return euclid(pa.x, pa.y, pb.x, pb.y); }
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
