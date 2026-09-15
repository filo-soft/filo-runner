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
  panel.position.z = .105;
  group.add(panel);
  return group;
};

const addGateLogo = (gate: T.Group, texture: T.Texture) => {
  if (gate.userData.zheleznoRoofSign) return;
  // The pass-under gate's triangular pediment starts at y=6.15 and peaks at
  // y=8.25. Put the sign on that visible +Z-facing roof/pediment surface,
  // not above it and not behind the roof.
  const sign = makePanel(texture, 4.75, 1.08);
  sign.name = 'ZheleznoGateRoofLogo';
  sign.position.set(0, 7.12, .93);
  sign.scale.setScalar(1);
  gate.add(sign);
  gate.userData.zheleznoRoofSign = true;
};

const addDistantTempleLogo = (temple: T.Group, texture: T.Texture) => {
  if (temple.userData.zheleznoFacadeLogo) return;
  // The sanctuary pediment starts at y=9 and peaks at y=13. Place the logo
  // directly on its visible +Z-facing roof front.
  const sign = makePanel(texture, 7.4, 1.34);
  sign.name = 'ZheleznoDistantTempleRoofLogo';
  sign.position.set(0, 10.55, 3.08);
  sign.scale.setScalar(1);
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
