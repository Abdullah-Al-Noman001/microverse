let nextRabbitId = 1;
let nextWolfId = 1;

export const RABBIT_CONFIG = {
  countMin: 8,
  countMax: 12,
  maxAge: 120,
  moveSpeedMin: 0.8,
  moveSpeedMax: 1.4,
  fleeSpeedBonus: 0.45,
  maxEnergy: 100,
  maxHunger: 100,
  hungerRateMin: 2.5,
  hungerRateMax: 4.0,
  hungerThreshold: 35,
  energyDrainWhenHungry: 3.5,
  idleEnergyDrain: 0.4,
  moveEnergyDrain: 0.8,
  fleeExtraDrain: 0.25,
  energyRestoreEat: 35,
  hungerReduceEat: 45,
  eatDuration: 1.2,
  foodSearchRadius: 7,
  wolfDetectRadius: 5.5,
  reproduceCooldown: 20,
  reproduceMinAge: 18,
  reproduceMinEnergy: 55,
  reproduceMaxHunger: 45,
  reproduceDistance: 1.6,
  reproduceCost: 18
};

export const WOLF_CONFIG = {
  countMin: 2,
  countMax: 4,
  maxAge: 170,
  moveSpeedMin: 1.1,
  moveSpeedMax: 1.45,
  chaseSpeedBonus: 0.55,
  maxEnergy: 100,
  maxHunger: 100,
  hungerRateMin: 1.4,
  hungerRateMax: 2.2,
  hungerThreshold: 30,
  energyDrainWhenHungry: 2.0,
  idleEnergyDrain: 0.25,
  moveEnergyDrain: 0.6,
  chaseExtraDrain: 0.4,
  energyRestoreEat: 55,
  hungerReduceEat: 65,
  eatDuration: 1.8,
  restDurationMin: 0.8,
  restDurationMax: 1.8,
  visionRange: 7,
  loseTargetRange: 9,
  catchDistance: 0.6,
  reproduceCooldown: 30,
  reproduceMinAge: 24,
  reproduceMinEnergy: 55,
  reproduceMaxHunger: 40,
  reproduceDistance: 1.7,
  reproduceCost: 20
};

export function resetRabbitIds() {
  nextRabbitId = 1;
}

export function resetWolfIds() {
  nextWolfId = 1;
}

export function createRabbit(x, y, opts = {}) {
  const moveSpeed = opts.moveSpeed ?? rand(RABBIT_CONFIG.moveSpeedMin, RABBIT_CONFIG.moveSpeedMax);
  const hungerRate = opts.hungerRate ?? rand(RABBIT_CONFIG.hungerRateMin, RABBIT_CONFIG.hungerRateMax);
  return {
    type: 'rabbit',
    id: opts.id ?? nextRabbitId++,
    x, y, tileX: x, tileY: y,
    prevX: x, prevY: y, targetX: x, targetY: y,
    moveProgress: 1,
    direction: opts.direction ?? pick(['up', 'down', 'left', 'right']),
    energy: clampNum(opts.energy ?? rand(70, 100), 0, RABBIT_CONFIG.maxEnergy),
    hunger: clampNum(opts.hunger ?? rand(5, 25), 0, RABBIT_CONFIG.maxHunger),
    age: opts.age ?? rand(0, 10),
    reproductionCooldown: opts.reproductionCooldown ?? rand(5, 12),
    state: opts.state ?? 'wandering',
    alive: opts.alive ?? true,
    moveSpeed, hungerRate,
    maxAge: opts.maxAge ?? rand(RABBIT_CONFIG.maxAge * 0.85, RABBIT_CONFIG.maxAge * 1.1),
    eatTimer: opts.eatTimer ?? 0,
    wanderPause: opts.wanderPause ?? rand(0, 1.5),
    animOffset: opts.animOffset ?? Math.random() * Math.PI * 2
  };
}

export function createWolf(x, y, opts = {}) {
  const moveSpeed = opts.moveSpeed ?? rand(WOLF_CONFIG.moveSpeedMin, WOLF_CONFIG.moveSpeedMax);
  const hungerRate = opts.hungerRate ?? rand(WOLF_CONFIG.hungerRateMin, WOLF_CONFIG.hungerRateMax);
  return {
    type: 'wolf',
    id: opts.id ?? nextWolfId++,
    x, y, tileX: x, tileY: y,
    prevX: x, prevY: y, targetX: x, targetY: y,
    moveProgress: 1,
    direction: opts.direction ?? pick(['up', 'down', 'left', 'right']),
    energy: clampNum(opts.energy ?? rand(75, 100), 0, WOLF_CONFIG.maxEnergy),
    hunger: clampNum(opts.hunger ?? rand(10, 35), 0, WOLF_CONFIG.maxHunger),
    age: opts.age ?? rand(0, 12),
    reproductionCooldown: opts.reproductionCooldown ?? rand(10, 20),
    state: opts.state ?? 'wandering',
    alive: opts.alive ?? true,
    moveSpeed, hungerRate,
    visionRange: opts.visionRange ?? rand(WOLF_CONFIG.visionRange - 1, WOLF_CONFIG.visionRange + 1),
    maxAge: opts.maxAge ?? rand(WOLF_CONFIG.maxAge * 0.85, WOLF_CONFIG.maxAge * 1.1),
    eatTimer: opts.eatTimer ?? 0,
    restTimer: opts.restTimer ?? 0,
    wanderPause: opts.wanderPause ?? rand(0, 1.5),
    targetRabbitId: opts.targetRabbitId ?? null,
    successfulHunts: opts.successfulHunts ?? 0,
    huntEffectTimer: opts.huntEffectTimer ?? 0,
    animOffset: opts.animOffset ?? Math.random() * Math.PI * 2
  };
}

export function setIdCounters(rabbitMaxId, wolfMaxId) {
  nextRabbitId = Math.max(1, (rabbitMaxId || 0) + 1);
  nextWolfId = Math.max(1, (wolfMaxId || 0) + 1);
}

export function sanitizeEntityPosition(entity, world) {
  entity.tileX = Math.max(0, Math.min(world.width - 1, Math.round(entity.tileX ?? entity.x ?? 0)));
  entity.tileY = Math.max(0, Math.min(world.height - 1, Math.round(entity.tileY ?? entity.y ?? 0)));
  entity.x = entity.tileX; entity.y = entity.tileY;
  entity.prevX = entity.tileX; entity.prevY = entity.tileY;
  entity.targetX = entity.tileX; entity.targetY = entity.tileY;
  entity.moveProgress = 1;
}

export function getEntityRenderPos(entity) {
  const t = clamp(entity.moveProgress, 0, 1);
  return {
    x: entity.prevX + (entity.targetX - entity.prevX) * t,
    y: entity.prevY + (entity.targetY - entity.prevY) * t
  };
}

export function getRabbitRenderPos(rabbit) { return getEntityRenderPos(rabbit); }
export function getWolfRenderPos(wolf) { return getEntityRenderPos(wolf); }

export function getRabbitStatus(rabbit) {
  if (!rabbit.alive) return 'dead';
  if (rabbit.energy <= 20) return 'weak';
  if (rabbit.hunger >= 70) return 'hungry';
  return 'healthy';
}

export function getWolfStatus(wolf) {
  if (!wolf.alive) return 'dead';
  if (wolf.energy <= 20) return 'weak';
  if (wolf.hunger >= 70) return 'hungry';
  return 'healthy';
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function clampNum(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return clamp(n, min, max);
}
