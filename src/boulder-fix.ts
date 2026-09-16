import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const BOULDER_INTERVAL = 90;
const BOULDER_START_Z = -108;
const BOULDER_SPEED = 42;
const BOULDER_RADIUS = 1.45;
const BOULDER_HIT_REACH = 3.2;
// Only ordinary obstacles are breakable. The large roofed temple/gate is architectural scenery.
const BREAKABLE = new Set(['block', 'pillar', 'arch']);
const COLLECTIBLES = new Set(['coin', 'bonusCoin']);

type Debris = { mesh: T.Mesh; velocity: T.Vector3; spin: T.Vector3; life: number; };

const makeMarbleTexture = () => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!; c.fillStyle = '#eeeae0'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 11; i++) {
    c.beginPath(); c.moveTo(-20, 18 + i * 25);
    for (let x = 0; x <= 290; x += 10) c.lineTo(x, 18 + i * 25 + Math.sin(x * .045 + i * 1.7) * 8 + Math.sin(x * .013 + i) * 14);
    c.strokeStyle = i % 3 === 0 ? '#77756f38' : '#a3a09930'; c.lineWidth = i % 3 === 0 ? 1.4 : .8; c.stroke();
  }
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.anisotropy = 4; return texture;
};

const originalBuildPrototypes = proto.buildPrototypes;
proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  if (this.prototypes.has('boulder')) return;
  const boulder = new T.Group();
  const marbleMat = new T.MeshStandardMaterial({ color: '#f1eee5', map: makeMarbleTexture(), roughness: .38, metalness: .02 });
  const rock = new T.Mesh(new T.IcosahedronGeometry(BOULDER_RADIUS, 2), marbleMat); rock.scale.set(1, .92, 1.05); rock.castShadow = true; rock.receiveShadow = true; boulder.add(rock);
  const seamMat = new T.MeshStandardMaterial({ color: '#7e7a72', roughness: .48, metalness: .01 });
  const seam = new T.Mesh(new T.TorusGeometry(1.01, .028, 7, 32), seamMat); seam.rotation.set(Math.PI * .5, .42, .18); seam.scale.set(1.02, .76, 1); boulder.add(seam);
  const seam2 = new T.Mesh(new T.TorusGeometry(.73, .022, 7, 28), seamMat); seam2.rotation.set(1.08, -.65, .42); seam2.scale.set(.92, .78, 1.08); boulder.add(seam2);
  this.prototypes.set('boulder', boulder); this.resources.push(boulder);
};

function ensureBoulder(game: any) {
  if (game.__boulderGroup) return game.__boulderGroup;
  const prototype = game.prototypes.get('boulder') as T.Group | undefined; if (!prototype) return undefined;
  const boulder = prototype.clone(true); boulder.visible = false; game.scene.add(boulder);
  game.__boulderGroup = boulder; game.__boulderLane = 0; game.__boulderZ = BOULDER_START_Z; game.__boulderActive = false; game.__boulderNextAt = BOULDER_INTERVAL; game.__boulderDebris = [] as Debris[]; game.__boulderDustAt = 0; return boulder;
}

function getMaterial(item: any): T.Material {
  let material: T.Material | undefined;
  item.mesh?.traverse?.((obj: any) => { if (!material && obj.isMesh && obj.material) material = Array.isArray(obj.material) ? obj.material[0] : obj.material; });
  return material || new T.MeshStandardMaterial({ color: '#d7c8ad', roughness: .85 });
}

function shatterObstacle(game: any, item: any, impact: T.Vector3, lane: number) {
  const type = item.type; if (!BREAKABLE.has(type)) return;
  const box = new T.Box3().setFromObject(item.mesh); const size = box.getSize(new T.Vector3()); const center = box.getCenter(new T.Vector3());
  const debris: Debris[] = game.__boulderDebris || (game.__boulderDebris = []);
  // Smaller, shorter-lived fragments keep the camera readable even when a pillar/arch breaks.
  const count = type === 'pillar' ? 7 : type === 'arch' ? 9 : 6;
  for (let i = 0; i < count; i++) {
    const scale = .13 + Math.random() * .17;
    const sx = Math.max(.11, size.x * scale * (.7 + Math.random() * .45));
    const sy = Math.max(.10, size.y * scale * (.65 + Math.random() * .55));
    const sz = Math.max(.11, size.z * scale * (.7 + Math.random() * .45));
    const mesh = new T.Mesh(new T.BoxGeometry(sx, sy, sz), getMaterial(item).clone());
    mesh.position.set(center.x + (Math.random() - .5) * size.x * .55, Math.max(.12, center.y + (Math.random() - .5) * size.y * .5), center.z + (Math.random() - .5) * size.z * .55);
    mesh.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2); mesh.castShadow = true; mesh.receiveShadow = true;
    const awayX = mesh.position.x - impact.x; const awayZ = mesh.position.z - impact.z; mesh.userData.baseLane = lane;
    debris.push({ mesh, velocity: new T.Vector3(awayX * 1.1 + (Math.random() - .5) * 2.8, 2.2 + Math.random() * 3.4, awayZ * .65 + (Math.random() - .5) * 2.0 + 2.2), spin: new T.Vector3((Math.random() - .5) * 7, (Math.random() - .5) * 7, (Math.random() - .5) * 7), life: .45 + Math.random() * .45 });
    game.scene.add(mesh);
  }
  game.burst(impact, true, 9);
}

function destroyAt(game: any, lane: number, z: number) {
  const items = (game.items || []) as any[];
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]; if (!item || item.lane !== lane) continue;
    const type = item.type; if (!BREAKABLE.has(type) && !COLLECTIBLES.has(type)) continue;
    const itemZ = Number(item.mesh?.position?.z); if (!Number.isFinite(itemZ) || Math.abs(itemZ - z) > BOULDER_HIT_REACH) continue;
    const impact = item.mesh.position.clone(); if (BREAKABLE.has(type)) shatterObstacle(game, item, impact, lane); else game.burst(impact, true, 6);
    game.recycle(item); items.splice(i, 1);
  }
}

function clearDebris(game: any) {
  for (const d of (game.__boulderDebris || []) as Debris[]) { game.scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); }
  game.__boulderDebris = [];
}

function updateDebris(game: any, dt: number) {
  const debris = (game.__boulderDebris || []) as Debris[]; const worldSpeed = Math.min(21, 10.5 + Number(game.stats?.time || 0) * .12);
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.life -= dt; d.velocity.y -= 15 * dt; d.mesh.position.x += d.velocity.x * dt; d.mesh.position.y += d.velocity.y * dt; d.mesh.position.z += (worldSpeed + d.velocity.z) * dt; d.mesh.rotation.x += d.spin.x * dt; d.mesh.rotation.y += d.spin.y * dt; d.mesh.rotation.z += d.spin.z * dt;
    if (d.life <= 0 || d.mesh.position.y < -.5 || d.mesh.position.z > 18) { game.scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); debris.splice(i, 1); }
  }
}

function advanceBoulder(game: any, dt: number) {
  const boulder = game.__boulderGroup as T.Group | undefined; if (!boulder || !game.__boulderActive || game.mode !== 'playing') return;
  const lane = game.__boulderLane as number; const prevZ = game.__boulderZ as number; const z = prevZ + BOULDER_SPEED * dt; game.__boulderZ = z;
  boulder.position.x = lane * 2.2 + game.bendOff(z); boulder.position.y = game.groundY + BOULDER_RADIUS - .05; boulder.position.z = z;
  const roll = BOULDER_SPEED * dt / BOULDER_RADIUS; boulder.rotation.x -= roll; boulder.rotation.z += roll * .035;

  // A boulder is a hard game-over hazard: unlike normal obstacles, jumping/sliding does not save the run.
  // The normal RunnerGame.die() path is used so the existing 2000-coin second-life revive can rescue it.
  const runner = game.runner as T.Group | undefined;
  if (runner && prevZ < 1.2 && z >= 1.2 && Math.abs(boulder.position.x - runner.position.x) < 1.35) {
    game.die();
    return;
  }

  const items = (game.items || []) as any[];
  for (const item of [...items]) { if (!item || item.lane !== lane) continue; const type = item.type; if (!BREAKABLE.has(type) && !COLLECTIBLES.has(type)) continue; const itemZ = Number(item.mesh?.position?.z); if (!Number.isFinite(itemZ)) continue; if (itemZ >= prevZ - 1.2 && itemZ <= z + BOULDER_HIT_REACH) destroyAt(game, lane, itemZ); }
  game.__boulderDustAt -= dt; if (game.__boulderDustAt <= 0) { game.__boulderDustAt = .045; game.burst(new T.Vector3(boulder.position.x, game.groundY + .08, z - BOULDER_RADIUS * .8), true, 3); }
  if (z > 15) { boulder.visible = false; game.__boulderActive = false; game.__boulderNextAt = game.stats.time + BOULDER_INTERVAL; }
}

const originalStep = proto.step;
proto.step = function (dt: number) {
  const game = this as any; const wasPlaying = game.mode === 'playing'; const boulder = ensureBoulder(game);
  if (!wasPlaying) { if (boulder) boulder.visible = false; clearDebris(game); game.__boulderActive = false; game.__boulderNextAt = BOULDER_INTERVAL; return originalStep.call(this, dt); }
  if (!game.__boulderActive && game.stats.time >= game.__boulderNextAt) { game.__boulderActive = true; game.__boulderLane = Math.floor(Math.random() * 3) - 1; game.__boulderZ = BOULDER_START_Z; game.__boulderDustAt = 0; boulder.visible = true; boulder.position.set(game.__boulderLane * 2.2 + game.bendOff(BOULDER_START_Z), game.groundY + BOULDER_RADIUS - .05, BOULDER_START_Z); boulder.rotation.set(0, 0, 0); game.onToast('КАТИТСЯ ВАЛУН!'); game.tone(95, .45, 45, 'triangle'); }
  advanceBoulder(game, dt); originalStep.call(this, dt); updateDebris(game, dt);
};