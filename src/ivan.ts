import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RunnerGame } from './game';

const IVAN_BASE_GAP = 14;
const IVAN_START_GAP = 7;
const IVAN_CATCH_GAP = 1;
const IVAN_HIT_PENALTY = 2.8;
const IVAN_COMBO_MULT = 0.4;
const IVAN_RECOVERY_RATE = 0.6;
const IVAN_LANE_LAG = 3.2;
const IVAN_VISIBLE_GAP = 7.5;
const IVAN_MODEL_HEIGHT = 2.45;
const IVAN_DAMP = 10;
const PLAYER_Z = 1.2;

type IvanReason = 'hit' | 'ivan';
type IvanGame = RunnerGame & {
  __ivanRoot?: T.Group;
  __ivanMixer?: T.AnimationMixer;
  __ivanLoaded?: boolean;
  __ivanLoadFailed?: boolean;
  __ivanGap?: number;
  __ivanComboHits?: number;
  __ivanLaneX?: number;
  __ivanIntro?: number;
  __ivanReason?: IvanReason;
};

type GLTF = Awaited<ReturnType<GLTFLoader['loadAsync']>>;

const proto = RunnerGame.prototype as any;
const previousBuildWorld = proto.buildWorld;
const previousMenu = proto.menu;
const previousStart = proto.start;
const previousStep = proto.step;
const previousDie = proto.die;

const runnerOf = (game: IvanGame) => (game as any).runner as T.Group;
const groundOf = (game: IvanGame) => Number((game as any).groundY) || 0;
const assetUrl = (name: string) => new URL(`./ivan/${name}`, document.baseURI).href;

const materialsOf = (root: T.Object3D) => {
  const out: T.Material[] = [];
  root.traverse((o: T.Object3D) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (m && !out.includes(m)) out.push(m);
    }
  });
  return out;
};

const applyPalette = (game: IvanGame, root: T.Object3D) => {
  const mats = materialsOf(root);
  const allNeutral = mats.length > 0 && mats.every(m => {
    const color = (m as T.MeshStandardMaterial).color;
    if (!color) return false;
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    return hsl.s < .08;
  });
  if (!allNeutral) return;

  const marble = (game as any).marble as T.MeshStandardMaterial | undefined;
  const blue = (game as any).blue as T.MeshStandardMaterial | undefined;
  if (!marble || !blue) return;

  let index = 0;
  root.traverse((o: T.Object3D) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    const name = mesh.name.toLowerCase();
    const bluePart = /(shirt|jacket|suit|tie|pants|trouser|shoe|brief|case|bag|accent)/i.test(name) || index % 6 === 0;
    const replacement = bluePart ? blue : marble;
    mesh.material = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(() => replacement.clone());
    index++;
  });
};

const setupAnimation = (game: IvanGame, model: T.Object3D, animation: GLTF | undefined) => {
  const clip = animation?.animations?.[0] || (model as any).animations?.[0];
  if (!clip) {
    console.warn('[IVAN] No run animation clip available.');
    return;
  }

  const bones = new Set<string>();
  model.traverse((o: T.Object3D) => { if (o instanceof T.Bone) bones.add(o.name); });
  const targets = [...new Set(clip.tracks.map(t => t.name.split('.')[0].split(':')[0]))];
  const missing = targets.filter(name => !bones.has(name));
  console.log('[IVAN] animation:', { name: clip.name, duration: clip.duration, boneCount: bones.size, missing });
  if (missing.length) {
    console.warn('[IVAN] Slow Run1.glb is not directly compatible with ivan1.glb; keeping the model visible without retargeting.');
    return;
  }

  const mixer = new T.AnimationMixer(model);
  const action = mixer.clipAction(clip);
  action.reset();
  action.setLoop(T.LoopRepeat, Infinity);
  action.play();
  game.__ivanMixer = mixer;
};

const loadIvan = async (game: IvanGame) => {
  if (game.__ivanLoaded || game.__ivanLoadFailed) return;
  game.__ivanLoaded = true;
  const loader = new GLTFLoader();

  let modelGltf: GLTF;
  try {
    modelGltf = await loader.loadAsync(assetUrl('ivan1.glb'));
  } catch (error) {
    game.__ivanLoadFailed = true;
    console.error('[IVAN] Model load failed:', assetUrl('ivan1.glb'), error);
    return;
  }

  const runner = runnerOf(game);
  const root = new T.Group();
  root.name = 'IvanWorldRoot';
  const model = modelGltf.scene;
  model.name = 'IvanGLBModel';
  root.add(model);

  const box = new T.Box3().setFromObject(model);
  const size = new T.Vector3();
  box.getSize(size);
  if (size.y > .01) {
    const scale = IVAN_MODEL_HEIGHT / size.y;
    model.scale.setScalar(scale);
    model.position.y = -box.min.y * scale;
  }

  root.position.set(runner.position.x, groundOf(game), runner.position.z + IVAN_START_GAP);
  root.rotation.y = Math.PI;
  root.visible = false;
  root.traverse((o: T.Object3D) => {
    const mesh = o as T.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; }
  });
  applyPalette(game, root);
  game.scene.add(root);
  game.__ivanRoot = root;

  try {
    const animationGltf = await loader.loadAsync(assetUrl('Slow Run1.glb'));
    setupAnimation(game, model, animationGltf);
  } catch (error) {
    console.warn('[IVAN] Run animation failed to load; model stays active:', assetUrl('Slow Run1.glb'), error);
  }

  if (game.mode === 'playing') {
    root.visible = true;
    root.position.set(runner.position.x, groundOf(game), runner.position.z + IVAN_START_GAP);
  }
};

const resetIvan = (game: IvanGame) => {
  const runner = runnerOf(game);
  game.__ivanGap = IVAN_START_GAP;
  game.__ivanComboHits = 0;
  game.__ivanLaneX = runner.position.x;
  game.__ivanIntro = 0;
  game.__ivanReason = undefined;
  if (game.__ivanRoot) {
    game.__ivanRoot.visible = game.mode === 'playing';
    game.__ivanRoot.position.set(runner.position.x, groundOf(game), runner.position.z + IVAN_START_GAP);
    game.__ivanRoot.rotation.y = Math.PI;
  }
};

const hideIvan = (game: IvanGame) => {
  if (game.__ivanRoot) game.__ivanRoot.visible = false;
};

const tickIvan = (game: IvanGame, dt: number) => {
  const root = game.__ivanRoot;
  if (!root || game.mode !== 'playing') return;
  const runner = runnerOf(game);
  if (game.__ivanMixer) game.__ivanMixer.update(dt);

  game.__ivanGap = Math.min(IVAN_BASE_GAP, (game.__ivanGap ?? IVAN_START_GAP) + IVAN_RECOVERY_RATE * dt);
  if ((game.__ivanGap ?? 0) >= IVAN_BASE_GAP) game.__ivanComboHits = 0;

  const currentLane = game.__ivanLaneX ?? runner.position.x;
  game.__ivanLaneX = currentLane + ((runner.position.x - currentLane) / IVAN_LANE_LAG) * dt;
  game.__ivanIntro = Math.min(1, (game.__ivanIntro ?? 0) + dt / 1.25);

  const stateGap = game.__ivanGap ?? IVAN_START_GAP;
  const easedGap = game.__ivanIntro! < 1 ? T.MathUtils.lerp(IVAN_START_GAP, stateGap, game.__ivanIntro!) : stateGap;
  const visibleGap = Math.min(easedGap, IVAN_VISIBLE_GAP);
  const targetZ = runner.position.z + visibleGap;

  root.position.x = T.MathUtils.damp(root.position.x, game.__ivanLaneX, IVAN_DAMP, dt);
  root.position.y = T.MathUtils.damp(root.position.y, groundOf(game), IVAN_DAMP, dt);
  root.position.z = T.MathUtils.damp(root.position.z, targetZ, IVAN_DAMP, dt);
  root.visible = true;
};

const freshObstacleHit = (game: IvanGame, checkedBefore: Set<any>) => {
  const items = (((game as any).items || []) as any[]);
  const runner = runnerOf(game);
  for (const item of items) {
    if (!item?.checked || checkedBefore.has(item)) continue;
    if (item.type !== 'pillar' && item.type !== 'block' && item.type !== 'arch') continue;
    const z = Number(item.mesh?.position?.z);
    if (!Number.isFinite(z) || Math.abs(z - PLAYER_Z) > .7) continue;
    const x = Number(item.mesh?.position?.x || 0);
    if (Math.abs(x - runner.position.x) > .95) continue;
    return item;
  }
  return undefined;
};

const emitOver = (game: IvanGame, reason: IvanReason) => {
  game.__ivanReason = reason;
  game.onOver?.({ ...game.stats, __ivanReason: reason } as any);
};

proto.buildWorld = function () {
  previousBuildWorld.call(this);
  void loadIvan(this as IvanGame);
};

proto.menu = function () {
  const game = this as IvanGame;
  previousMenu.call(this);
  resetIvan(game);
  hideIvan(game);
};

proto.start = function () {
  const game = this as IvanGame;
  previousStart.call(this);
  resetIvan(game);
  void loadIvan(game);
};

proto.die = function () {
  return previousDie.call(this);
};

proto.step = function (dt: number) {
  const game = this as IvanGame;
  const wasPlaying = game.mode === 'playing';
  const checkedBefore = new Set<any>();
  if (wasPlaying) {
    for (const item of (((game as any).items || []) as any[])) if (item?.checked) checkedBefore.add(item);
  }

  const originalOnOver = game.onOver;
  if (wasPlaying) game.onOver = (() => {}) as any;
  try {
    previousStep.call(this, dt);
  } finally {
    game.onOver = originalOnOver;
  }

  const collision = wasPlaying && game.mode === 'over' ? freshObstacleHit(game, checkedBefore) : undefined;
  if (collision) {
    const hits = (game.__ivanComboHits || 0) + 1;
    game.__ivanComboHits = hits;
    game.__ivanGap = Math.max(0, (game.__ivanGap ?? IVAN_START_GAP) - IVAN_HIT_PENALTY * (1 + hits * IVAN_COMBO_MULT));
    game.mode = 'playing';
    game.__ivanIntro = 1;

    if ((game.__ivanGap ?? 0) <= IVAN_CATCH_GAP) {
      previousDie.call(this);
      game.mode = 'over';
      emitOver(game, 'ivan');
      hideIvan(game);
      return;
    }
  } else if (wasPlaying && game.mode === 'over') {
    emitOver(game, 'hit');
    hideIvan(game);
    return;
  }

  if (game.mode === 'playing') tickIvan(game, dt);
  else if (game.mode === 'over' || game.mode === 'menu') hideIvan(game);
};
