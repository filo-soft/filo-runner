import * as T from 'three';
import { RunnerGame } from './game';

type IvanState = 'hidden' | 'retreat' | 'chase';
type IvanGame = RunnerGame & { __ivanGuardRoot?: T.Group; __ivanGuardState?: IvanState; __ivanGuardGap?: number; __ivanGuardLaneX?: number; __ivanGuardFovTarget?: number; __ivanIntroRemaining?: number; __ivanRealHits?: number; __actualHitItem?: any; };
const proto = RunnerGame.prototype as any;
const previousStep = proto.step;
const previousStart = proto.start;
const previousMenu = proto.menu;
const PLAYER_Z = 1.2;
const IVAN_START_GAP = 3.8;
const IVAN_MAX_GAP = 8.0;
const IVAN_RETREAT_SPEED = .65;
const IVAN_CHASE_SPEED = 8.2;
const IVAN_CATCH_GAP = .72;
const IVAN_INTRO_SECONDS = 5.6;
const IVAN_POST_HIT_VISIBLE_SECONDS = 5.6;
const IVAN_CHASE_START_GAP = 7.0;
const IVAN_FOV_NORMAL = 47;
const IVAN_FOV_IVAN = 60;
const IVAN_CAMERA_RESPONSE = 5;
const IVAN_LANE_RESPONSE = 9;
const cloneBlueGuard = (game: IvanGame) => {
  if (game.__ivanGuardRoot) return;
  const player = (game as any).runner as T.Group;
  const blue = (game as any).blue as T.MeshStandardMaterial | undefined;
  if (!player || !blue) return;
  const root = player.clone(true);
  root.name = 'IVANGuard';
  root.position.set(player.position.x, (game as any).groundY, PLAYER_Z + IVAN_START_GAP);
  root.rotation.copy(player.rotation);
  root.visible = false;
  const guardMeshes: T.Mesh[] = [];
  root.traverse((o: T.Object3D) => { const m = o as T.Mesh; if (m.isMesh) guardMeshes.push(m); });
  for (const mesh of guardMeshes) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const green = mats.some((mat: any) => { const color = mat?.color; if (!color) return false; const hsl = { h: 0, s: 0, l: 0 }; color.getHSL(hsl); return hsl.h > .18 && hsl.h < .30 && hsl.s > .18 && hsl.l < .7; });
    if (green) { mesh.removeFromParent(); continue; }
    const next = mats.map((mat: any) => { const color = mat?.color; if (!color) return mat; const hsl = { h: 0, s: 0, l: 0 }; color.getHSL(hsl); if (color.getHex() === 0xe2ddcf || (hsl.s < .12 && hsl.l > .78 && hsl.l < .95)) return blue.clone(); return mat.clone ? mat.clone() : mat; });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
    mesh.castShadow = true; mesh.receiveShadow = true;
  }
  const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.font = '900 340px Arial, Helvetica, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = blue.color.getStyle(); ctx.fillText('IVAN', 1024, 256);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8; texture.needsUpdate = true;
    const label = new T.Mesh(new T.PlaneGeometry(.9, .225), new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: T.DoubleSide }));
    label.name = 'IVANBackLabel'; label.position.set(0, 1.72, -.285); label.rotation.set(0, Math.PI, 0); root.add(label);
  }
  (game as any).scene.add(root); game.__ivanGuardRoot = root;
};
const collectBones = (root: T.Object3D) => { const bones: T.Bone[] = []; root.traverse((o: T.Object3D) => { if (o instanceof T.Bone) bones.push(o); }); return bones; };
const copyRunningPose = (game: IvanGame) => { const root = game.__ivanGuardRoot; const player = (game as any).runner as T.Group | undefined; if (!root || !player) return; const source = collectBones(player); const target = collectBones(root); const count = Math.min(source.length, target.length); for (let i = 0; i < count; i++) { target[i].position.copy(source[i].position); target[i].quaternion.copy(source[i].quaternion); target[i].scale.copy(source[i].scale); } root.rotation.y = player.rotation.y; root.rotation.z = player.rotation.z; };
const setIvanState = (game: IvanGame, state: IvanState) => { game.__ivanGuardState = state; if (state === 'hidden') { if (game.__ivanGuardRoot) game.__ivanGuardRoot.visible = false; game.__ivanGuardGap = IVAN_START_GAP; game.__ivanGuardFovTarget = IVAN_FOV_NORMAL; return; } if (game.__ivanGuardRoot) game.__ivanGuardRoot.visible = true; game.__ivanGuardFovTarget = IVAN_FOV_IVAN; };
const showIntroIvan = (game: IvanGame) => { cloneBlueGuard(game); if (!game.__ivanGuardRoot) return; game.__ivanIntroRemaining = IVAN_INTRO_SECONDS; game.__ivanGuardGap = IVAN_START_GAP; game.__ivanGuardLaneX = (game as any).runner.position.x; game.__ivanGuardRoot.position.set(game.__ivanGuardLaneX, (game as any).groundY, PLAYER_Z + IVAN_START_GAP); setIvanState(game, 'retreat'); };
const showHitIvan = (game: IvanGame) => { cloneBlueGuard(game); if (!game.__ivanGuardRoot) return; game.__ivanIntroRemaining = IVAN_POST_HIT_VISIBLE_SECONDS; game.__ivanGuardGap = IVAN_START_GAP; game.__ivanGuardLaneX = (game as any).runner.position.x; game.__ivanGuardRoot.position.set(game.__ivanGuardLaneX, (game as any).groundY, PLAYER_Z + IVAN_START_GAP); setIvanState(game, 'retreat'); };
const updateIvan = (game: IvanGame, dt: number) => {
  const root = game.__ivanGuardRoot; const player = (game as any).runner as T.Group; if (!root || !player || game.mode !== 'playing') return;
  const state = game.__ivanGuardState || 'hidden'; if (state === 'hidden') return; copyRunningPose(game);
  if ((game.__ivanIntroRemaining ?? 0) > 0) game.__ivanIntroRemaining = Math.max(0, (game.__ivanIntroRemaining ?? 0) - dt);
  const gap = Number.isFinite(game.__ivanGuardGap) ? game.__ivanGuardGap! : IVAN_START_GAP;
  if (state === 'retreat') { game.__ivanGuardGap = Math.min(IVAN_MAX_GAP, gap + IVAN_RETREAT_SPEED * dt); if ((game.__ivanIntroRemaining ?? 0) <= 0 && game.__ivanGuardGap >= IVAN_MAX_GAP) { setIvanState(game, 'hidden'); return; } }
  else if (state === 'chase') { game.__ivanGuardGap = Math.max(IVAN_CATCH_GAP, gap - IVAN_CHASE_SPEED * dt); if (game.__ivanGuardGap <= IVAN_CATCH_GAP) { root.visible = false; (game as any).die(); return; } }
  const desiredX = player.position.x; const currentX = game.__ivanGuardLaneX ?? desiredX; const response = state === 'chase' ? IVAN_LANE_RESPONSE * 1.6 : IVAN_LANE_RESPONSE; game.__ivanGuardLaneX = T.MathUtils.damp(currentX, desiredX, response, dt);
  const targetZ = player.position.z + game.__ivanGuardGap; root.position.x = game.__ivanGuardLaneX; root.position.y = (game as any).groundY; root.position.z = T.MathUtils.damp(root.position.z, targetZ, IVAN_CAMERA_RESPONSE, dt); root.visible = true;
  const camera = (game as any).camera as T.PerspectiveCamera; const targetFov = game.__ivanGuardFovTarget ?? IVAN_FOV_IVAN; camera.fov = T.MathUtils.damp(camera.fov, targetFov, IVAN_CAMERA_RESPONSE, dt); camera.updateProjectionMatrix();
};
proto.start = function () { previousStart.call(this); const game = this as IvanGame; game.__ivanRealHits = 0; cloneBlueGuard(game); showIntroIvan(game); const camera = (game as any).camera as T.PerspectiveCamera; camera.fov = IVAN_FOV_NORMAL; camera.updateProjectionMatrix(); };
proto.menu = function () { previousMenu.call(this); const game = this as IvanGame; game.__ivanRealHits = 0; game.__ivanIntroRemaining = 0; setIvanState(game, 'hidden'); };
proto.step = function (dt: number) { const game = this as IvanGame; const wasPlaying = game.mode === 'playing'; previousStep.call(this, dt); if (wasPlaying && game.mode === 'playing') { const actualHit = game.__actualHitItem; delete game.__actualHitItem; if (actualHit) { const hits = (game.__ivanRealHits ?? 0) + 1; game.__ivanRealHits = hits; if (hits === 1) showHitIvan(game); else if (hits >= 2) { setIvanState(game, 'chase'); game.__ivanIntroRemaining = 0; game.__ivanGuardGap = Math.max(IVAN_CHASE_START_GAP, (game.__ivanGuardGap ?? IVAN_START_GAP) * 1.15); if (game.onToast) game.onToast('Иван догоняет'); } } } if (game.mode === 'playing') updateIvan(game, dt); else if (game.mode === 'menu' || game.mode === 'paused' || game.mode === 'over') { if (game.__ivanGuardState !== 'hidden') setIvanState(game, 'hidden'); const camera = (game as any).camera as T.PerspectiveCamera; camera.fov = T.MathUtils.damp(camera.fov, IVAN_FOV_NORMAL, IVAN_CAMERA_RESPONSE, dt); camera.updateProjectionMatrix(); } };
