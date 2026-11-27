import { TILE_TYPES } from './world.js';
import { getEntityRenderPos } from './entities.js';

export function setupCanvas(canvas, world) {
  canvas.width = world.width * world.tileSize;
  canvas.height = world.height * world.tileSize;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function render(ctx, state) {
  const { world, rabbits, wolves, rains, blooms, sanctuaries, selected, selectedTile, hoverTile, brush, settings, time } = state;
  renderWorld(ctx, world, time, settings);
  if (settings?.showGrid) drawGrid(ctx, world);
  drawRains(ctx, world, rains, time);
  drawBlooms(ctx, world, blooms, time);
  drawSanctuaries(ctx, world, sanctuaries, time);
  if (selectedTile) drawTileHighlight(ctx, selectedTile.x, selectedTile.y, world.tileSize, '#ffe08a', 2);
  if (hoverTile && brush && brush.tool) drawBrushPreview(ctx, world, hoverTile.x, hoverTile.y, brush, settings);
  renderEntities(ctx, world, rabbits, wolves, selected, time, settings);
}

function renderWorld(ctx, world, time, settings) {
  const { width, height, tileSize, tiles } = world;
  ctx.clearRect(0, 0, width * tileSize, height * tileSize);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) drawGroundTile(ctx, x, y, tileSize, tiles[y][x], time, settings);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (tiles[y][x] === TILE_TYPES.WATER) drawWaterTile(ctx, x, y, tileSize, tiles, width, height, time, settings);
  // subtle ambient particles/specks
  if (settings?.animations !== false) drawAmbient(ctx, world, time);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x];
      if (tile === TILE_TYPES.ROCK) drawRock(ctx, x, y, tileSize);
      else if (tile === TILE_TYPES.BUSH) drawBush(ctx, x, y, tileSize, time, settings);
      else if (tile === TILE_TYPES.TREE) drawTree(ctx, x, y, tileSize, time, settings);
    }
  }
}

function drawGroundTile(ctx, tx, ty, size, tile, time, settings) {
  if (tile === TILE_TYPES.DIRT) drawDirtTile(ctx, tx, ty, size);
  else drawGrassTile(ctx, tx, ty, size, time, settings);
}
function drawGrassTile(ctx, tx, ty, size, time, settings) {
  const px = tx * size, py = ty * size;
  const base = pickVariant(tx, ty, ['#3f6b3a', '#446f3d', '#3b6536', '#487442']);
  ctx.fillStyle = base; ctx.fillRect(px, py, size, size);
  const accents = ['#4f7e46', '#355a31', '#5a8a4e'];
  const seed = hash(tx, ty);
  for (let i = 0; i < 3; i++) {
    if (((seed >> i) & 1) === 0) continue;
    let ax = px + ((seed + i * 7) % (size - 2)) + 1;
    let ay = py + ((seed + i * 11) % (size - 2)) + 1;
    if (settings?.animations !== false && (seed + i) % 3 === 0) {
      ax += Math.sin(time * 1.5 + seed * 0.1 + i) > 0.6 ? 1 : 0;
    }
    ctx.fillStyle = accents[(seed + i) % accents.length];
    ctx.fillRect(ax, ay, 1, 1);
  }
}
function drawDirtTile(ctx, tx, ty, size) {
  const px = tx * size, py = ty * size;
  const base = pickVariant(tx, ty, ['#5b4630', '#624d35', '#57432d', '#655038']);
  ctx.fillStyle = base; ctx.fillRect(px, py, size, size);
  const accents = ['#4a3927', '#736046', '#6a533c'];
  const seed = hash(tx + 101, ty + 53);
  for (let i = 0; i < 4; i++) {
    const ax = px + ((seed + i * 5) % (size - 2)) + 1;
    const ay = py + ((seed + i * 9) % (size - 2)) + 1;
    ctx.fillStyle = accents[(seed + i) % accents.length];
    ctx.fillRect(ax, ay, 1, 1);
  }
}
function drawWaterTile(ctx, tx, ty, size, tiles, width, height, time, settings) {
  const px = tx * size, py = ty * size;
  const isEdge = isWaterEdge(tx, ty, tiles, width, height);
  ctx.fillStyle = isEdge ? '#3f7fa8' : '#2f6f98'; ctx.fillRect(px, py, size, size);
  ctx.fillStyle = isEdge ? '#4d93be' : '#3a82ad'; ctx.fillRect(px, py, size, 2);
  const seed = hash(tx, ty);
  const anim = settings?.animations !== false;
  const shift = anim ? Math.floor((Math.sin(time * 2 + seed) + 1) * 1.5) : 0;
  ctx.fillStyle = '#8fd0e8';
  if ((seed % 3) === 0) ctx.fillRect(px + 3 + ((seed + shift) % 3), py + 4 + (seed % 2), 2, 1);
  if ((seed % 5) === 0) ctx.fillRect(px + 8 + (seed % 2), py + 9 + ((seed + shift) % 3), 2, 1);
  if ((seed % 7) === 0) ctx.fillRect(px + 5 + (shift % 2), py + 11, 1, 1);
  // edge foam/highlight
  if (isEdge) { ctx.fillStyle = 'rgba(220,245,255,0.25)'; ctx.fillRect(px, py, size, 1); }
}
function isWaterEdge(x, y, tiles, width, height) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dy === 0) continue;
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
    if (tiles[ny][nx] !== TILE_TYPES.WATER) return true;
  }
  return false;
}
function drawTree(ctx, tx, ty, size, time, settings) {
  const px = tx * size, py = ty * size;
  const sway = settings?.animations !== false ? Math.sin(time * 1.2 + hash(tx,ty)*0.05) * 0.5 : 0;
  const sx = Math.round(sway);
  ctx.fillStyle = '#5a3b22'; ctx.fillRect(px + 6, py + 9, 4, 6);
  ctx.fillStyle = '#7a5230'; ctx.fillRect(px + 7, py + 10, 1, 4);
  ctx.fillStyle = '#1f4a28'; ctx.fillRect(px + 2 + sx, py + 5, 12, 6);
  ctx.fillStyle = '#2f6a34'; ctx.fillRect(px + 3 + sx, py + 3, 10, 5);
  ctx.fillStyle = '#3f8a42'; ctx.fillRect(px + 4 + sx, py + 2, 8, 4);
  ctx.fillStyle = '#69b75a'; ctx.fillRect(px + 5 + sx, py + 3, 2, 1); ctx.fillRect(px + 9 + sx, py + 4, 2, 1);
  // soft shadow
  ctx.fillStyle = 'rgba(10,20,10,0.18)'; ctx.fillRect(px + 4, py + 14, 8, 1);
}
function drawBush(ctx, tx, ty, size, time, settings) {
  const px = tx * size, py = ty * size;
  const sway = settings?.animations !== false ? Math.sin(time * 1.6 + hash(tx,ty)*0.07) * 0.3 : 0;
  const sx = Math.round(sway);
  ctx.fillStyle = '#234d2b'; ctx.fillRect(px + 3 + sx, py + 8, 10, 5);
  ctx.fillStyle = '#2f6a34'; ctx.fillRect(px + 4 + sx, py + 6, 8, 5);
  ctx.fillStyle = '#4f9b4a'; ctx.fillRect(px + 5 + sx, py + 6, 3, 2); ctx.fillRect(px + 9 + sx, py + 7, 2, 1);
  ctx.fillStyle = '#3a2a1b'; ctx.fillRect(px + 5, py + 12, 6, 1);
  ctx.fillStyle = 'rgba(10,20,10,0.15)'; ctx.fillRect(px + 4, py + 13, 8, 1);
}
function drawRock(ctx, tx, ty, size) {
  const px = tx * size, py = ty * size;
  ctx.fillStyle = '#4a4f55'; ctx.fillRect(px + 3, py + 8, 10, 5);
  ctx.fillStyle = '#6b737a'; ctx.fillRect(px + 4, py + 7, 8, 4);
  ctx.fillStyle = '#8a939b'; ctx.fillRect(px + 5, py + 7, 3, 2);
  ctx.fillStyle = '#35393e'; ctx.fillRect(px + 4, py + 11, 8, 1);
  ctx.fillStyle = 'rgba(10,10,10,0.18)'; ctx.fillRect(px + 4, py + 13, 9, 1);
}
function drawAmbient(ctx, world, time) {
  const { width, height, tileSize } = world;
  ctx.fillStyle = 'rgba(235,255,220,0.08)';
  for (let i = 0; i < 12; i++) {
    const x = ((i * 97 + Math.floor(time * 8)) % (width * tileSize));
    const y = ((i * 53 + Math.floor(time * 5 + i * 13)) % (height * tileSize));
    if (((i + Math.floor(time)) % 7) === 0) ctx.fillRect(x, y, 1, 1);
  }
}
function drawGrid(ctx, world) {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= world.width; x++) { const px = x * world.tileSize + 0.5; ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px, world.height*world.tileSize); ctx.stroke(); }
  for (let y = 0; y <= world.height; y++) { const py = y * world.tileSize + 0.5; ctx.beginPath(); ctx.moveTo(0,py); ctx.lineTo(world.width*world.tileSize, py); ctx.stroke(); }
}
function drawTileHighlight(ctx, x, y, size, color, lw=2) {
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.strokeRect(x*size+1, y*size+1, size-2, size-2);
}
const PREVIEW_POWER_TOOLS = {
  rain: { size: 3, shape: 'round', color: 'rgba(120,190,255,0.82)' },
  bloom: { size: 3, shape: 'round', color: 'rgba(255,170,210,0.82)' },
  sanctuary: { size: 3, shape: 'round', color: 'rgba(170,230,160,0.82)' }
};

function drawBlooms(ctx, world, blooms, time) {
  if (!Array.isArray(blooms) || blooms.length === 0) return;
  const size = world.tileSize;
  for (const bloom of blooms) {
    const radius = Math.max(0, Math.round(Number(bloom.radius) || 1));
    const shape = bloom.shape === 'round' ? 'round' : 'square';
    const cells = [];
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (shape === 'round' && dx * dx + dy * dy > radius * radius) continue;
      const x = bloom.x + dx, y = bloom.y + dy;
      if (inBounds(world, x, y)) cells.push({ x, y });
    }

    ctx.save();
    ctx.fillStyle = 'rgba(255,170,210,0.18)';
    for (const c of cells) ctx.fillRect(c.x * size, c.y * size, size, size);
    ctx.strokeStyle = 'rgba(255,205,225,0.72)';
    ctx.lineWidth = 1;
    const cellKeys = new Set(cells.map(c => `${c.x},${c.y}`));
    ctx.beginPath();
    for (const c of cells) {
      if (!cellKeys.has(`${c.x},${c.y - 1}`)) { ctx.moveTo(c.x * size + 1.5, c.y * size + 1.5); ctx.lineTo((c.x + 1) * size - 1.5, c.y * size + 1.5); }
      if (!cellKeys.has(`${c.x + 1},${c.y}`)) { ctx.moveTo((c.x + 1) * size - 1.5, c.y * size + 1.5); ctx.lineTo((c.x + 1) * size - 1.5, (c.y + 1) * size - 1.5); }
      if (!cellKeys.has(`${c.x},${c.y + 1}`)) { ctx.moveTo((c.x + 1) * size - 1.5, (c.y + 1) * size - 1.5); ctx.lineTo(c.x * size + 1.5, (c.y + 1) * size - 1.5); }
      if (!cellKeys.has(`${c.x - 1},${c.y}`)) { ctx.moveTo(c.x * size + 1.5, (c.y + 1) * size - 1.5); ctx.lineTo(c.x * size + 1.5, c.y * size + 1.5); }
    }
    ctx.stroke();

    for (const c of cells) {
      const seed = hash(c.x + (bloom.id || 0) * 11, c.y + (bloom.id || 0) * 17);
      for (let i = 0; i < 3; i++) {
        const px = c.x * size + 3 + ((seed + i * 5) % 10);
        const py = c.y * size + 3 + ((seed + i * 7) % 10);
        const pulse = settingsLikePulse(time, seed + i);
        ctx.fillStyle = i % 2 ? '#ffd9a8' : '#f4a6ca';
        ctx.fillRect(Math.round(px - pulse), Math.round(py), 2, 2);
        ctx.fillStyle = '#fff1a6';
        ctx.fillRect(Math.round(px), Math.round(py - pulse), 1, 1);
      }
    }
    ctx.restore();

    drawTimerBadge(ctx, (bloom.x + 0.5) * size, (bloom.y + 0.5) * size - 0.5, `${Math.max(0, Math.ceil(Number(bloom.remaining) || 0))}s`, 'rgba(92,45,72,0.78)', 'rgba(255,215,235,0.9)');
  }
}

function drawSanctuaries(ctx, world, sanctuaries, time) {
  if (!Array.isArray(sanctuaries) || sanctuaries.length === 0) return;
  const size = world.tileSize;
  for (const sanctuary of sanctuaries) {
    const radius = Math.max(0, Math.round(Number(sanctuary.radius) || 1));
    const shape = sanctuary.shape === 'round' ? 'round' : 'square';
    const cells = [];
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (shape === 'round' && dx * dx + dy * dy > radius * radius) continue;
      const x = sanctuary.x + dx, y = sanctuary.y + dy;
      if (inBounds(world, x, y)) cells.push({ x, y });
    }

    ctx.save();
    ctx.fillStyle = 'rgba(150,220,140,0.14)';
    for (const c of cells) ctx.fillRect(c.x * size, c.y * size, size, size);
    ctx.strokeStyle = 'rgba(200,245,185,0.72)';
    ctx.lineWidth = 1;
    const cellKeys = new Set(cells.map(c => `${c.x},${c.y}`));
    ctx.beginPath();
    for (const c of cells) {
      if (!cellKeys.has(`${c.x},${c.y - 1}`)) { ctx.moveTo(c.x * size + 1.5, c.y * size + 1.5); ctx.lineTo((c.x + 1) * size - 1.5, c.y * size + 1.5); }
      if (!cellKeys.has(`${c.x + 1},${c.y}`)) { ctx.moveTo((c.x + 1) * size - 1.5, c.y * size + 1.5); ctx.lineTo((c.x + 1) * size - 1.5, (c.y + 1) * size - 1.5); }
      if (!cellKeys.has(`${c.x},${c.y + 1}`)) { ctx.moveTo((c.x + 1) * size - 1.5, (c.y + 1) * size - 1.5); ctx.lineTo(c.x * size + 1.5, (c.y + 1) * size - 1.5); }
      if (!cellKeys.has(`${c.x - 1},${c.y}`)) { ctx.moveTo(c.x * size + 1.5, (c.y + 1) * size - 1.5); ctx.lineTo(c.x * size + 1.5, c.y * size + 1.5); }
    }
    ctx.stroke();

    for (const c of cells) {
      const seed = hash(c.x + (sanctuary.id || 0) * 19, c.y + (sanctuary.id || 0) * 23);
      if ((seed + Math.floor(time * 2)) % 5 !== 0) continue;
      const px = c.x * size + 4 + (seed % 8);
      const py = c.y * size + 4 + ((seed >> 3) % 8);
      ctx.fillStyle = 'rgba(235,255,225,0.75)';
      ctx.fillRect(px, py, 1, 1);
      ctx.fillRect(px - 1, py, 1, 1);
      ctx.fillRect(px + 1, py, 1, 1);
      ctx.fillRect(px, py - 1, 1, 1);
      ctx.fillRect(px, py + 1, 1, 1);
    }
    ctx.restore();

    drawTimerBadge(ctx, (sanctuary.x + 0.5) * size, (sanctuary.y + 0.5) * size - 0.5, `${Math.max(0, Math.ceil(Number(sanctuary.remaining) || 0))}s`, 'rgba(40,70,35,0.78)', 'rgba(210,245,200,0.9)');
  }
}

function drawTimerBadge(ctx, lx, ly, label, bg, border) {
  ctx.save();
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.ceil(ctx.measureText(label).width) + 6;
  const h = 12;
  ctx.fillStyle = bg;
  ctx.fillRect(Math.round(lx - w / 2), Math.round(ly - h / 2), w, h);
  ctx.strokeStyle = border;
  ctx.strokeRect(Math.round(lx - w / 2) + 0.5, Math.round(ly - h / 2) + 0.5, w - 1, h - 1);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(15,30,45,0.85)';
  ctx.strokeText(label, lx, ly);
  ctx.fillStyle = 'rgba(245,252,255,0.98)';
  ctx.fillText(label, lx, ly);
  ctx.restore();
}

function settingsLikePulse(time, seed) {
  return Math.sin(time * 3 + seed * 0.2) > 0.7 ? 1 : 0;
}

function drawRains(ctx, world, rains, time) {
  if (!Array.isArray(rains) || rains.length === 0) return;
  const size = world.tileSize;
  for (const rain of rains) {
    const radius = Math.max(0, Math.round(Number(rain.radius) || 1));
    const shape = rain.shape === 'round' ? 'round' : 'square';
    const cells = [];
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (shape === 'round' && dx*dx + dy*dy > radius*radius) continue;
      const x = rain.x + dx, y = rain.y + dy;
      if (inBounds(world, x, y)) cells.push({ x, y });
    }
    ctx.save();
    ctx.fillStyle = 'rgba(120,190,255,0.16)';
    for (const c of cells) ctx.fillRect(c.x * size, c.y * size, size, size);
    ctx.strokeStyle = 'rgba(170,225,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const cellKeys = new Set(cells.map(c => `${c.x},${c.y}`));
    for (const c of cells) {
      if (!cellKeys.has(`${c.x},${c.y - 1}`)) { ctx.moveTo(c.x * size + 0.5, c.y * size + 0.5); ctx.lineTo((c.x + 1) * size - 0.5, c.y * size + 0.5); }
      if (!cellKeys.has(`${c.x + 1},${c.y}`)) { ctx.moveTo((c.x + 1) * size - 0.5, c.y * size + 0.5); ctx.lineTo((c.x + 1) * size - 0.5, (c.y + 1) * size - 0.5); }
      if (!cellKeys.has(`${c.x},${c.y + 1}`)) { ctx.moveTo((c.x + 1) * size - 0.5, (c.y + 1) * size - 0.5); ctx.lineTo(c.x * size + 0.5, (c.y + 1) * size - 0.5); }
      if (!cellKeys.has(`${c.x - 1},${c.y}`)) { ctx.moveTo(c.x * size + 0.5, (c.y + 1) * size - 0.5); ctx.lineTo(c.x * size + 0.5, c.y * size + 0.5); }
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    for (const c of cells) {
      const seed = hash(c.x + (rain.id || 0) * 7, c.y + (rain.id || 0) * 13);
      for (let i = 0; i < 2; i++) {
        const phase = (time * (7 + (seed % 4)) + (seed % 11) + i * 4.7) % 12;
        const px = c.x * size + 2 + ((seed + i * 5) % Math.max(1, size - 4));
        const py = c.y * size + (phase / 12) * (size - 2);
        const alpha = 0.25 + ((seed + i) % 5) * 0.08;
        ctx.fillStyle = `rgba(200,235,255,${alpha.toFixed(2)})`;
        ctx.fillRect(Math.round(px), Math.round(py), 1, 2);
        if ((seed + i) % 3 === 0) {
          ctx.fillStyle = 'rgba(235,250,255,0.35)';
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
      }
    }
    ctx.restore();

    drawTimerBadge(ctx, (rain.x + 0.5) * size, (rain.y + 0.5) * size - 0.5, `${Math.max(0, Math.ceil(Number(rain.remaining) || 0))}s`, 'rgba(20,45,70,0.72)', 'rgba(190,235,255,0.85)');
  }
}

function drawBrushPreview(ctx, world, x, y, brush, settings) {
  if (!inBounds(world,x,y)) return;
  const size = world.tileSize;
  const tool = brush.tool;
  const power = PREVIEW_POWER_TOOLS[tool];
  const brushSize = power ? power.size : (['select','rabbit','wolf'].includes(tool) ? 1 : Math.max(1, Number(brush.size) || 1));
  const radius = Math.floor(brushSize / 2);
  const shape = power ? power.shape : (['select','rabbit','wolf'].includes(tool) ? 'square' : brush.shape);
  const cells = [];
  const cellKeys = new Set();
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (shape === 'round' && dx*dx + dy*dy > radius*radius) continue;
    cells.push({ dx, dy });
    cellKeys.add(`${dx},${dy}`);
  }
  let color = 'rgba(255,255,255,0.6)';
  if (power) color = power.color;
  else if (tool === 'erase') color = 'rgba(255,120,120,0.7)';
  else if (tool === 'rabbit' || tool === 'wolf') color = 'rgba(120,220,255,0.75)';
  else color = 'rgba(120,255,160,0.7)';
  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = color;
  for (const cell of cells) ctx.fillRect((x+cell.dx)*size, (y+cell.dy)*size, size, size);
  ctx.restore();
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  for (const cell of cells) {
    const cx = x + cell.dx, cy = y + cell.dy;
    if (!cellKeys.has(`${cell.dx},${cell.dy-1}`)) { ctx.moveTo(cx*size, cy*size); ctx.lineTo((cx+1)*size, cy*size); }
    if (!cellKeys.has(`${cell.dx+1},${cell.dy}`)) { ctx.moveTo((cx+1)*size, cy*size); ctx.lineTo((cx+1)*size, (cy+1)*size); }
    if (!cellKeys.has(`${cell.dx},${cell.dy+1}`)) { ctx.moveTo((cx+1)*size, (cy+1)*size); ctx.lineTo(cx*size, (cy+1)*size); }
    if (!cellKeys.has(`${cell.dx-1},${cell.dy}`)) { ctx.moveTo(cx*size, (cy+1)*size); ctx.lineTo(cx*size, cy*size); }
  }
  ctx.stroke();
  ctx.fillStyle = color; ctx.fillRect(x*size + size/2 - 1, y*size + size/2 - 1, 2, 2);
}

function renderEntities(ctx, world, rabbits, wolves, selected, time, settings) {
  const all = [];
  for (const r of rabbits) if (r.alive) all.push({ kind: 'rabbit', e: r, pos: getEntityRenderPos(r) });
  for (const w of wolves) if (w.alive) all.push({ kind: 'wolf', e: w, pos: getEntityRenderPos(w) });
  all.sort((a, b) => a.pos.y - b.pos.y || (a.kind === 'rabbit' ? -1 : 1));
  for (const item of all) {
    const px = item.pos.x * world.tileSize;
    const py = item.pos.y * world.tileSize;
    if (item.kind === 'wolf') drawWolfEntity(ctx, px, py, item.e, selected, time, settings);
    else drawRabbitEntity(ctx, px, py, item.e, selected, time, settings);
  }
}
function isSelected(selected, kind, id) { return selected && selected.type === kind && selected.id === id; }

function drawRabbitEntity(ctx, px, py, rabbit, selected, time, settings) {
  const anim = settings?.animations !== false;
  const hop = anim ? Math.sin(time * 8 + rabbit.animOffset) * (rabbit.moveProgress < 1 ? 1.2 : 0.2) : 0;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(px + 4, py + 13, 8, 1);
  if (isSelected(selected, 'rabbit', rabbit.id)) { ctx.strokeStyle = '#f4e06a'; ctx.lineWidth = 1; ctx.strokeRect(px + 1, py + 1, 14, 14); }
  if (rabbit.state === 'fleeing') { ctx.strokeStyle = 'rgba(255,120,120,0.7)'; ctx.strokeRect(px + 3, py + 3, 10, 10); }
  if (rabbit.state === 'eating' && anim) { ctx.fillStyle = 'rgba(170,220,120,0.5)'; ctx.fillRect(px + (rabbit.direction==='left'?1:12), py + 10, 2, 2); }
  drawRabbit(ctx, px, py - hop, rabbit.direction, rabbit.state);
}
function drawWolfEntity(ctx, px, py, wolf, selected, time, settings) {
  const anim = settings?.animations !== false;
  const bob = anim ? Math.sin(time * 7 + wolf.animOffset) * (wolf.moveProgress < 1 ? 0.9 : 0.15) : 0;
  const wy = py - bob;
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(px + 3, py + 13, 10, 1);
  if (isSelected(selected, 'wolf', wolf.id)) { ctx.strokeStyle = '#7fd0ff'; ctx.lineWidth = 1; ctx.strokeRect(px + 1, py + 1, 14, 14); }
  if (wolf.state === 'chasing' || wolf.state === 'hunting') {
    ctx.fillStyle = wolf.state === 'hunting' ? 'rgba(255,70,70,0.8)' : 'rgba(255,140,60,0.75)';
    ctx.fillRect(px + 7, py - 2, 2, 2);
    if (anim) { ctx.fillStyle = 'rgba(255,200,120,0.35)'; ctx.fillRect(px + 6, py - 1, 4, 1); }
  }
  if (wolf.huntEffectTimer > 0) {
    ctx.strokeStyle = `rgba(255,220,120,${Math.min(1, wolf.huntEffectTimer/0.7 + 0.2)})`;
    ctx.lineWidth = 1; ctx.strokeRect(px + 2, py + 2, 12, 12);
    ctx.fillStyle = 'rgba(255,240,180,0.35)'; ctx.fillRect(px + 7, py + 7, 2, 2);
  }
  if (wolf.state === 'eating' && anim) { ctx.fillStyle = 'rgba(255,180,120,0.45)'; ctx.fillRect(px + (wolf.direction==='left'?1:12), py + 10, 2, 2); }
  drawWolf(ctx, px, wy, wolf.direction, wolf.state);
}

function drawRabbit(ctx, px, py, direction, state) {
  const body = state === 'eating' ? '#e8dcc8' : (state === 'fleeing' ? '#f5efe2' : '#efe6d6');
  const shade = '#cbbfae', ear = '#f2dfd8', eye = '#2b241d', nose = '#d89aa0';
  ctx.fillStyle = body; ctx.fillRect(px + 4, py + 7, 8, 6);
  ctx.fillStyle = shade; ctx.fillRect(px + 4, py + 11, 8, 2);
  ctx.fillStyle = body;
  if (direction === 'left') {
    ctx.fillRect(px + 2, py + 5, 5, 5);
    ctx.fillStyle = ear; ctx.fillRect(px + 2, py + 2, 1, 3); ctx.fillRect(px + 4, py + 2, 1, 3);
    ctx.fillStyle = eye; ctx.fillRect(px + 3, py + 7, 1, 1);
    ctx.fillStyle = nose; ctx.fillRect(px + 2, py + 9, 1, 1);
    ctx.fillStyle = body; ctx.fillRect(px + 10, py + 8, 2, 2);
  } else if (direction === 'right') {
    ctx.fillRect(px + 9, py + 5, 5, 5);
    ctx.fillStyle = ear; ctx.fillRect(px + 11, py + 2, 1, 3); ctx.fillRect(px + 13, py + 2, 1, 3);
    ctx.fillStyle = eye; ctx.fillRect(px + 12, py + 7, 1, 1);
    ctx.fillStyle = nose; ctx.fillRect(px + 13, py + 9, 1, 1);
    ctx.fillStyle = body; ctx.fillRect(px + 4, py + 8, 2, 2);
  } else if (direction === 'up') {
    ctx.fillRect(px + 5, py + 4, 6, 5);
    ctx.fillStyle = ear; ctx.fillRect(px + 6, py + 1, 1, 3); ctx.fillRect(px + 9, py + 1, 1, 3);
    ctx.fillStyle = eye; ctx.fillRect(px + 7, py + 6, 1, 1); ctx.fillRect(px + 9, py + 6, 1, 1);
    ctx.fillStyle = body; ctx.fillRect(px + 6, py + 11, 4, 2);
  } else {
    ctx.fillRect(px + 5, py + 6, 6, 5);
    ctx.fillStyle = ear; ctx.fillRect(px + 6, py + 2, 1, 3); ctx.fillRect(px + 9, py + 2, 1, 3);
    ctx.fillStyle = eye; ctx.fillRect(px + 7, py + 8, 1, 1); ctx.fillRect(px + 9, py + 8, 1, 1);
    ctx.fillStyle = nose; ctx.fillRect(px + 8, py + 10, 1, 1);
  }
  ctx.fillStyle = shade; ctx.fillRect(px + 5, py + 13, 2, 1); ctx.fillRect(px + 9, py + 13, 2, 1);
}
function drawWolf(ctx, px, py, direction, state) {
  const fur = state === 'eating' ? '#8b9098' : '#6f757d';
  const dark = '#4a5058', light = '#a3aab2', eye = '#1f2328', nose = '#2b2f34';
  ctx.fillStyle = fur; ctx.fillRect(px + 3, py + 7, 10, 6);
  ctx.fillStyle = dark; ctx.fillRect(px + 3, py + 11, 10, 2);
  ctx.fillStyle = light; ctx.fillRect(px + 6, py + 9, 4, 3);
  if (direction === 'left') {
    ctx.fillStyle = fur; ctx.fillRect(px + 1, py + 6, 5, 5);
    ctx.fillStyle = dark; ctx.fillRect(px + 1, py + 4, 2, 2); ctx.fillRect(px + 3, py + 4, 2, 2);
    ctx.fillStyle = eye; ctx.fillRect(px + 2, py + 8, 1, 1);
    ctx.fillStyle = nose; ctx.fillRect(px + 1, py + 10, 1, 1);
    ctx.fillStyle = dark; ctx.fillRect(px + 12, py + 8, 3, 2);
  } else if (direction === 'right') {
    ctx.fillStyle = fur; ctx.fillRect(px + 10, py + 6, 5, 5);
    ctx.fillStyle = dark; ctx.fillRect(px + 11, py + 4, 2, 2); ctx.fillRect(px + 13, py + 4, 2, 2);
    ctx.fillStyle = eye; ctx.fillRect(px + 13, py + 8, 1, 1);
    ctx.fillStyle = nose; ctx.fillRect(px + 14, py + 10, 1, 1);
    ctx.fillStyle = dark; ctx.fillRect(px + 1, py + 8, 3, 2);
  } else if (direction === 'up') {
    ctx.fillStyle = fur; ctx.fillRect(px + 5, py + 4, 6, 5);
    ctx.fillStyle = dark; ctx.fillRect(px + 5, py + 3, 2, 2); ctx.fillRect(px + 9, py + 3, 2, 2);
    ctx.fillStyle = eye; ctx.fillRect(px + 7, py + 6, 1, 1); ctx.fillRect(px + 9, py + 6, 1, 1);
    ctx.fillStyle = nose; ctx.fillRect(px + 8, py + 8, 1, 1);
    ctx.fillStyle = dark; ctx.fillRect(px + 7, py + 12, 2, 2);
  } else {
    ctx.fillStyle = fur; ctx.fillRect(px + 5, py + 6, 6, 5);
    ctx.fillStyle = dark; ctx.fillRect(px + 5, py + 4, 2, 2); ctx.fillRect(px + 9, py + 4, 2, 2);
    ctx.fillStyle = eye; ctx.fillRect(px + 7, py + 8, 1, 1); ctx.fillRect(px + 9, py + 8, 1, 1);
    ctx.fillStyle = nose; ctx.fillRect(px + 8, py + 10, 1, 1);
    ctx.fillStyle = dark; ctx.fillRect(px + 7, py + 11, 2, 2);
  }
  ctx.fillStyle = dark; ctx.fillRect(px + 4, py + 13, 2, 1); ctx.fillRect(px + 10, py + 13, 2, 1);
}

function inBounds(world,x,y){ return x>=0&&y>=0&&x<world.width&&y<world.height; }
function pickVariant(x, y, variants) { return variants[hash(x, y) % variants.length]; }
function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return Math.abs(h ^ (h >> 16)); }
