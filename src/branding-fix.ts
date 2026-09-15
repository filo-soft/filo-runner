import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildPrototypes = proto.buildPrototypes;
const originalBuildWorld = proto.buildWorld;

const makeLogoTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2457a6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Current ЖЕЛЕЗНО visual: blue field, light geometric emblem and wordmark.
  ctx.fillStyle = '#f2eee2';
  ctx.fillRect(46, 48, 224, 224);
  ctx.strokeStyle = '#2457a6';
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.moveTo(82, 232); ctx.lineTo(82, 88); ctx.lineTo(212, 88);
  ctx.moveTo(82, 160); ctx.lineTo(212, 160);
  ctx.moveTo(82, 232); ctx.lineTo(212, 88);
  ctx.stroke();

  ctx.fillStyle = '#f2eee2';
  ctx.font = '900 152px Arial Black, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ЖЕЛЕЗНО', 320, 164);

  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const makePanel = (texture: T.Texture, width: number, height: number, backingColor = '#ed8b2d') => {
  const group = new T.Group();
  const backing = new T.Mesh(
    new T.BoxGeometry(width + .3, height + .3, .18),
    new T.MeshStandardMaterial({ color: backingColor, roughness: .62 })
  );
  backing.castShadow = true;
  backing.receiveShadow = true;
  group.add(backing);

  const panel = new T.Mesh(
    new T.PlaneGeometry(width, height),
    new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide })
  );
  // The camera approaches from +Z, so the +Z-facing panel is the visible side.
  panel.position.z = .105;
  group.add(panel);
  return group;
};

const addGateLogo = (gate: T.Group, texture: T.Texture) => {
  if (gate.userData.zheleznoRoofSign) return;
  const sign = makePanel(texture, 5.35, 1.42);
  sign.name = 'ZheleznoGateFacadeLogo';
  // Put the logo on the front face of the pass-under gate, just under the roof,
  // rather than on top of the roof where the camera cannot see it.
  sign.position.set(0, 6.55, .97);
  sign.scale.setScalar(.92);
  gate.add(sign);
  gate.userData.zheleznoRoofSign = true;
};

const addDistantTempleLogo = (temple: T.Group, texture: T.Texture) => {
  if (temple.userData.zheleznoFacadeLogo) return;
  const sign = makePanel(texture, 7.7, 1.55, '#ed8b2d');
  sign.name = 'ZheleznoDistantTempleLogo';
  // Front facade of the distant sanctuary: visible toward the runner/camera.
  sign.position.set(0, 5.15, 3.6);
  temple.add(sign);
  temple.userData.zheleznoFacadeLogo = true;
};

proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  const gate = this.prototypes.get('gate') as T.Group | undefined;
  if (!gate) return;
  const texture = makeLogoTexture();
  if (!texture) return;
  addGateLogo(gate, texture);
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  const temple = this.templeGroup as T.Group | undefined;
  if (!temple) return;
  const texture = makeLogoTexture();
  if (!texture) return;
  addDistantTempleLogo(temple, texture);
};
