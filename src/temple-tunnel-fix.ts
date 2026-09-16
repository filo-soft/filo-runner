import * as T from 'three';
import { RunnerGame } from './game';

type Tunnel = {
  root: T.Group;
  z: number;
  length: number;
};

type TempleGame = RunnerGame & {
  __templeTunnels?: Tunnel[];
  __templeNextAt?: number;
  __templeRampY?: number;
};

const proto = RunnerGame.prototype as any;
const previousStart = proto.start;
const previousStep = proto.step;
const TUNNEL_LENGTH = 34;
const TUNNEL_INTERVAL = 125;
const FIRST_TUNNEL_AT = 78;
const TUNNEL_START_Z = -128;
const TUNNEL_ROOF_Y = 4.7;
const RAMP_HEIGHT = .95;

const makeTunnel = (game: any, variant: number): T.Group => {
  const root = new T.Group();
  root.name = `TempleTunnel_${variant}`;

  const stone = game.stone?.clone?.() || new T.MeshStandardMaterial({ color: '#e2d4bc', roughness: .91 });
  const trim = game.trim?.clone?.() || new T.MeshStandardMaterial({ color: '#f5e8d1', roughness: .82 });
  const marble = game.marble?.clone?.() || stone;

  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: T.Material) => {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  // A real roofed temple corridor, wide enough for the three running lanes.
  box(0, TUNNEL_ROOF_Y, 0, 7.2, .48, TUNNEL_LENGTH, trim);
  box(-3.45, 2.35, 0, .28, 4.7, TUNNEL_LENGTH, stone);
  box(3.45, 2.35, 0, .28, 4.7, TUNNEL_LENGTH, stone);

  // Same classical columns as the roadside columns, alternating left/right down the center.
  for (let i = 0; i < 6; i++) {
    const column = game.makeColumn(3.65) as T.Object3D;
    column.position.set(i % 2 === 0 ? -1.12 : 1.12, 0, -12.5 + i * 5);
    root.add(column);
  }

  // Low side ramps let the runner climb to a raised edge lane instead of jumping.
  const rampMat = marble;
  for (const side of [-1, 1]) {
    const ramp = new T.Mesh(new T.BoxGeometry(1.75, .22, 7.2), rampMat);
    ramp.position.set(side * 2.55, RAMP_HEIGHT * .5, 0);
    ramp.rotation.x = side * .13;
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    root.add(ramp);

    const rail = box(side * 3.18, RAMP_HEIGHT + .12, 0, .12, .24, 7.4, trim);
    rail.rotation.x = side * .13;
  }

  // Temple entrance/exit lintels make the tunnel read as a distinct architectural section.
  box(0, 4.05, -17.0, 6.9, .35, .55, trim);
  box(0, 4.05, 17.0, 6.9, .35, .55, trim);
  for (const x of [-3.0, 3.0]) {
    const col = game.makeColumn(4.0) as T.Object3D;
    col.position.set(x, 0, -17.0);
    root.add(col);
  }

  return root;
};

const ensureState = (game: TempleGame) => {
  if (!game.__templeTunnels) game.__templeTunnels = [];
  if (!Number.isFinite(game.__templeNextAt)) game.__templeNextAt = FIRST_TUNNEL_AT;
};

const clearTunnels = (game: TempleGame) => {
  for (const tunnel of game.__templeTunnels || []) game.scene.remove(tunnel.root);
  game.__templeTunnels = [];
};

const spawnTunnel = (game: TempleGame) => {
  ensureState(game);
  const variant = (game.__templeTunnels?.length || 0) % 2;
  const root = makeTunnel(game, variant);
  const z = TUNNEL_START_Z - variant * 38;
  root.position.set(game.bendOff?.(z) || 0, 0, z);
  game.scene.add(root);
  game.__templeTunnels!.push({ root, z, length: TUNNEL_LENGTH });
};

const updateTunnelGround = (game: TempleGame) => {
  game.__templeRampY = 0;
  const x = Number(game.runner?.position?.x || 0);
  const z = Number(game.runner?.position?.z || 1.2);
  for (const tunnel of game.__templeTunnels || []) {
    const localZ = z - tunnel.root.position.z;
    if (localZ < -17 || localZ > 17) continue;
    const onRamp = Math.abs(x) > 1.35;
    if (onRamp) {
      // Smoothly rise/fall at the tunnel ends so the runner actually travels up the side ramps.
      const edge = Math.max(0, 1 - Math.abs(localZ) / 17);
      game.__templeRampY = Math.max(game.__templeRampY, RAMP_HEIGHT * edge);
    }
  }
  if (game.__templeRampY > 0) game.groundY = Math.max(game.groundY, game.__templeRampY);
};

proto.start = function () {
  previousStart.call(this);
  const game = this as TempleGame;
  clearTunnels(game);
  game.__templeNextAt = FIRST_TUNNEL_AT;
  game.__templeRampY = 0;
};

proto.step = function (dt: number) {
  const game = this as TempleGame;
  const wasPlaying = game.mode === 'playing';

  if (!wasPlaying) {
    clearTunnels(game);
    game.__templeNextAt = FIRST_TUNNEL_AT;
    game.__templeRampY = 0;
    return previousStep.call(this, dt);
  }

  ensureState(game);
  const time = Number(game.stats?.time || 0);
  if (time >= (game.__templeNextAt || FIRST_TUNNEL_AT)) {
    spawnTunnel(game);
    game.__templeNextAt = time + TUNNEL_INTERVAL;
  }

  const speed = Math.min(21, 10.5 + time * .12);
  for (let i = (game.__templeTunnels?.length || 0) - 1; i >= 0; i--) {
    const tunnel = game.__templeTunnels![i];
    tunnel.z += speed * dt;
    tunnel.root.position.z = tunnel.z;
    tunnel.root.position.x = game.bendOff?.(tunnel.z) || 0;
    if (tunnel.z > 22) {
      game.scene.remove(tunnel.root);
      game.__templeTunnels!.splice(i, 1);
    }
  }

  const result = previousStep.call(this, dt);
  updateTunnelGround(game);
  return result;
};
