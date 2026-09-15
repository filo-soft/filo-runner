import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildWorld = proto.buildWorld;
const originalStart = proto.start;
const originalStep = proto.step;
const originalDie = proto.die;

const PETE_URL = `${import.meta.env.BASE_URL}pete.glb`;

const findClip = (clips: T.AnimationClip[], pattern: RegExp) =>
  clips.find((clip) => pattern.test(clip.name)) ?? clips[0];

const addIvanName = (root: T.Object3D) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '900 92px Arial Black, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f4eee0';
  ctx.strokeStyle = '#463d32';
  ctx.lineWidth = 12;
  ctx.strokeText('ИВАН', 256, 72);
  ctx.fillText('ИВАН', 256, 72);

  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 2;
  const material = new T.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const badge = new T.Mesh(new T.PlaneGeometry(.86, .24), material);
  // Mixamo characters normally face -Z, so +Z is the back facing the player.
  badge.position.set(0, 1.35, .24);
  root.add(badge);
};

const normalizePete = (root: T.Object3D) => {
  const box = new T.Box3().setFromObject(root);
  const size = box.getSize(new T.Vector3());
  if (size.y > 0) {
    const scale = 2.0 / size.y;
    root.scale.setScalar(scale);
    const normalized = new T.Box3().setFromObject(root);
    root.position.y -= normalized.min.y;
  }
  root.traverse((object: T.Object3D) => {
    const mesh = object as T.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  addIvanName(root);
};

const loadPete = function () {
  if (this.__ivanLoaded || this.__ivanLoading) return;
  this.__ivanLoading = true;
  const loader = new GLTFLoader();
  loader.load(
    PETE_URL,
    (gltf) => {
      this.__ivanLoaded = true;
      this.__ivanLoading = false;
      this.__ivanModel = gltf.scene;
      normalizePete(this.__ivanModel);
      this.__ivanMixer = gltf.animations.length ? new T.AnimationMixer(this.__ivanModel) : undefined;
      this.__ivanClips = gltf.animations;
      if (this.__ivanChase) attachPete.call(this);
    },
    undefined,
    () => {
      this.__ivanLoading = false;
      // The binary is intentionally optional while the code is deployed. Missing
      // Pete must never block the game from loading.
      console.warn('[Filo Runner] Pete model is not installed yet:', PETE_URL);
    },
  );
};

const playRun = function () {
  const mixer = this.__ivanMixer as T.AnimationMixer | undefined;
  const clips = (this.__ivanClips as T.AnimationClip[] | undefined) ?? [];
  if (!mixer || !clips.length) return;
  const clip = findClip(clips, /run|jog|sprint|walk/i);
  if (!clip) return;
  if (this.__ivanAction?.getClip() === clip) return;
  this.__ivanAction?.stop();
  this.__ivanAction = mixer.clipAction(clip);
  this.__ivanAction.reset().setLoop(T.LoopRepeat, Infinity).play();
};

const attachPete = function () {
  if (!this.__ivanModel || this.__ivanAttached) return;
  this.__ivanAttached = true;
  this.scene.add(this.__ivanModel);
  this.__ivanModel.position.set(this.runner.position.x, 0, 5.2);
  playRun.call(this);
};

const hidePete = function () {
  const model = this.__ivanModel as T.Object3D | undefined;
  if (model) model.visible = false;
  this.__ivanChase = false;
  this.__ivanChaseTime = 0;
};

const startIvanChase = function () {
  if (this.mode !== 'playing') return;
  this.__ivanChase = true;
  this.__ivanChaseTime = 0;
  this.__ivanCaughtDistance = 0;
  attachPete.call(this);
  const model = this.__ivanModel as T.Object3D | undefined;
  if (model) {
    model.visible = true;
    model.position.x = this.runner.position.x;
    model.position.z = 4.8;
    playRun.call(this);
  }
  this.shake = Math.max(this.shake as number, .09);
  this.tone?.(180, .08, 95, 'triangle');
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(35);
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  loadPete.call(this);
};

// First collision: do not end the run. Ivan starts close behind.
// A second collision while Ivan is still close ends the run. If the player
// survives long enough, Ivan falls behind and the chase is cleared.
proto.die = function () {
  if (this.mode !== 'playing') return originalDie.call(this);
  if (!this.__ivanChase) {
    startIvanChase.call(this);
    return;
  }

  const model = this.__ivanModel as T.Object3D | undefined;
  const distance = model ? model.position.z - 1.2 : 999;
  if (distance <= 10.5) {
    hidePete.call(this);
    return originalDie.call(this);
  }

  // The player has already lost Ivan; another mistake starts a fresh chase.
  startIvanChase.call(this);
};

proto.start = function () {
  originalStart.call(this);
  this.__ivanChase = false;
  this.__ivanChaseTime = 0;
  const model = this.__ivanModel as T.Object3D | undefined;
  if (model) model.visible = false;
  loadPete.call(this);
};

proto.step = function (dt: number) {
  originalStep.call(this, dt);

  const mixer = this.__ivanMixer as T.AnimationMixer | undefined;
  if (mixer && this.mode === 'playing') mixer.update(dt);

  if (!this.__ivanChase || this.mode !== 'playing') return;
  const model = this.__ivanModel as T.Object3D | undefined;
  if (!model) return;

  this.__ivanChaseTime += dt;
  model.visible = true;

  // Ivan initially gains, then steadily loses ground. At roughly eight seconds
  // he is far enough back that the chase pressure is gone.
  const t = this.__ivanChaseTime as number;
  const targetZ = 4.8 + Math.min(10.5, t * 1.35);
  model.position.z = T.MathUtils.damp(model.position.z, targetZ, 7, dt);
  model.position.x = T.MathUtils.damp(model.position.x, this.runner.position.x, 12, dt);

  if (t >= 7.8 || model.position.z >= 14.5) hidePete.call(this);
};
