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
  __ivanVisual?: T.Group;
  __ivanMixer?: T.AnimationMixer;
  __ivanModelReady?: boolean;
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

const ownMaterial = (source: T.MeshStandardMaterial, color: T.ColorRepresentation, roughness = source.roughness, metalness = source.metalness) => {
  const material = source.clone();
  material.color.set(color);
  material.map = source.map || null;
  material.roughness = roughness;
  material.metalness = metalness;
  return material;
};

const buildFallbackIvan = (game: IvanGame) => {
  const fallback = new T.Group();
  fallback.name = 'IvanFallback';

  const marbleSource = (game as any).marble as T.MeshStandardMaterial;
  const blueSource = (game as any).blue as T.MeshStandardMaterial;
  const marble = ownMaterial(marbleSource, '#f2eee3', .7, .05);
  const blue = ownMaterial(blueSource, '#38309e', .4, .25);
  const skin = ownMaterial(marbleSource, '#d5c2ac', .82, .02);

  const mesh = (geo: T.BufferGeometry, mat: T.Material, parent: T.Object3D, x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const body = new T.Group();
  body.name = 'IvanBody';
  fallback.add(body);

  mesh(new T.CapsuleGeometry(.34, .72, 8, 18), marble, body, 0, 1.28, 0);
  const shoulder = mesh(new T.SphereGeometry(.43, 18, 12), marble, body, 0, 1.67, .02);
  shoulder.scale.set(1, .62, .72);

  mesh(new T.SphereGeometry(.29, 20, 16), skin, body, 0, 2.18, .02);
  const hair = mesh(new T.SphereGeometry(.305, 16, 10, 0, Math.PI * 2, 0, Math.PI * .48), marble, body, 0, 2.3, .005);
  hair.scale.set(1.02, .72, 1.02);

  const nose = mesh(new T.ConeGeometry(.07, .16, 8), skin, body, 0, 2.17, -.285);
  nose.rotation.x = Math.PI / 2;

  const leftLeg = new T.Group();
  const rightLeg = new T.Group();
  leftLeg.position.set(-.16, .84, 0);
  rightLeg.position.set(.16, .84, 0);
  fallback.add(leftLeg, rightLeg);
  mesh(new T.CapsuleGeometry(.095, .48, 6, 10), blue, leftLeg, 0, -.26, 0);
  mesh(new T.CapsuleGeometry(.095, .48, 6, 10), blue, rightLeg, 0, -.26, 0);

  const leftArm = new T.Group();
  const rightArm = new T.Group();
  leftArm.name = 'IvanLeftArm';
  rightArm.name = 'IvanRightArm';
  leftArm.position.set(-.42, 1.62, 0);
  rightArm.position.set(.42, 1.62, 0);
  fallback.add(leftArm, rightArm);
  mesh(new T.CapsuleGeometry(.085, .42, 6, 10), marble, leftArm, 0, -.25, 0);
  mesh(new T.CapsuleGeometry(.085, .42, 6, 10), marble, rightArm, 0, -.25, 0);
  mesh(new T.SphereGeometry(.1, 12, 8), skin, leftArm, 0, -.55, 0);
  mesh(new T.SphereGeometry(.1, 12, 8), skin, rightArm, 0, -.55, 0);

  const drape = mesh(new T.PlaneGeometry(.95, 1.45, 10, 12), blue, body, .08, 1.32, -.25);
  drape.rotation.set(.04, 0, -.08);
  drape.scale.set(1, 1, .9);
  drape.castShadow = true;
  drape.receiveShadow = true;

  fallback.userData.ivanParts = { leftLeg, rightLeg, leftArm, rightArm };
  fallback.traverse((o: T.Object3D) => {
    if (o instanceof T.Mesh) o.frustumCulled = false;
  });

  return fallback;
};

const fitModel = (model: T.Object3D) => {
  const box = new T.Box3().setFromObject(model);
  const size = new T.Vector3();
  box.getSize(size);
  if (size.y <= .01) return;
  model.scale.setScalar(IVAN_MODEL_HEIGHT / size.y);
  const fitted = new T.Box3().setFromObject(model);
  model.position.y -= fitted.min.y;
};

const setupAnimation = (game: IvanGame, model: T.Object3D, animation: GLTF | undefined) => {
  const clip = animation?.animations?.[0];
  if (!clip) return;
  const bones = new Set<string>();
  model.traverse((o: T.Object3D) => { if (o instanceof T.Bone) bones.add(o.name); });
  const targets = [...new Set(clip.tracks.map(t => t.name.split('.')[0].split(':')[0]))];
  if (targets.some(name => !bones.has(name))) return;
  const mixer = new T.AnimationMixer(model);
  const action = mixer.clipAction(clip);
  action.reset();
  action.setLoop(T.LoopRepeat, Infinity);
  action.play();
  game.__ivanMixer = mixer;
};

const animateFallback = (game: IvanGame) => {
  const fallback = game.__ivanVisual;
  if (!fallback || fallback.userData.kind !== 'fallback') return;
  const parts = fallback.userData.ivanParts as {
    leftLeg: T.Group; rightLeg: T.Group; leftArm: T.Group; rightArm: T.Group;
  } | undefined;
  if (!parts) return;
  const phase = Number((game as any).phase) || 0;
  const stride = Math.sin(phase) * .65;
  parts.leftLeg.rotation.x = stride;
  parts.rightLeg.rotation.x = -stride;
  parts.leftArm.rotation.x = -stride * .8;
  parts.rightArm.rotation.x = stride * .8;
};

const installFallback = (game: IvanGame) => {
  const root = new T.Group();
  root.name = 'IvanWorldRoot';
  const visual = buildFallbackIvan(game);
  visual.userData.kind = 'fallback';
  root.add(visual);
  root.position.set(0, groundOf(game), PLAYER_Z + IVAN_START_GAP);
  root.rotation.y = Math.PI;
  root.visible = false;
  game.scene.add(root);
  game.__ivanRoot = root;
  game.__ivanVisual = visual;
};

const replaceFallbackWithGlb = (game: IvanGame, modelGltf: GLTF) => {
  const root = game.__ivanRoot;
  if (!root) return;
  const old = game.__ivanVisual;
  const model = modelGltf.scene;
  model.name = 'IvanGLBModel';
  model.userData.kind = 'glb';
  fitModel(model);
  model.traverse((o: T.Object3D) => {
    const mesh = o as T.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });
  root.add(model);
  game.__ivanVisual = model as T.Group;
  game.__ivanModelReady = true;
  if (old) root.remove(old);
};

const loadGlb = async (game: IvanGame) => {
  const loader = new GLTFLoader();
  try {
    const modelGltf = await loader.loadAsync(assetUrl('ivan1.glb'));
    replaceFallbackWithGlb(game, modelGltf);
    try {
      const animationGltf = await loader.loadAsync(assetUrl('Slow Run1.glb'));
      if (game.__ivanVisual) setupAnimation(game, game.__ivanVisual, animationGltf);
    } catch (error) {
      console.warn('[IVAN] Run animation unavailable; model remains active.', error);
    }
  } catch (error) {
    console.warn('[IVAN] GLB unavailable; using built-in fallback character.', error);
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
  animateFallback(game);

  game.__ivanGap = Math.min(IVAN_BASE_GAP, (game.__ivanGap ?? IVAN_START_GAP) + IVAN_RECOVERY_RATE * dt);
  if ((game.__ivanGap ?? 0) >= IVAN_BASE_GAP) game.__ivanComboHits = 0;

  const currentLane = game.__ivanLaneX ?? runner.position.x;
  game.__ivanLaneX = currentLane + ((runner.position.x - currentLane) / IVAN_LANE_LAG) * dt;
  game.__ivanIntro = Math.min(1, (game.__ivanIntro ?? 0) + dt / 1.25);

  const stateGap = game.__ivanGap ?? IVAN_START_GAP;
  const easedGap = game.__ivanIntro < 1 ? T.MathUtils.lerp(IVAN_START_GAP, stateGap, game.__ivanIntro) : stateGap;
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
  const game = this as IvanGame;
  installFallback(game);
  void loadGlb(game);
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
  if (game.__ivanRoot) game.__ivanRoot.visible = true;
  void loadGlb(game);
};

proto.die = function () {
  return previousDie.call(this);
};

proto.step = function (dt: number) {
  const game = this as IvanGame;
  const wasPlaying = game.mode === 'playing';
  const checkedBefore = new Set<any>();
  if (wasPlaying) {
    for (const item of (((game as any).items || []) as any[])) {
      if (item?.checked) checkedBefore.add(item);
    }
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
    game.mode = 'playing';
    const nextCombo = (game.__ivanComboHits || 0) + 1;
    game.__ivanComboHits = nextCombo;
    game.__ivanGap = Math.max(0, (game.__ivanGap ?? IVAN_START_GAP) - IVAN_HIT_PENALTY * (1 + nextCombo * IVAN_COMBO_MULT));

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
