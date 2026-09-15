import * as T from 'three';
import { RunnerGame } from './game';
import logoSvg from './assets/branding/logo железно.svg?url';

const proto = RunnerGame.prototype as any;
const originalBuildPrototypes = proto.buildPrototypes;
const originalBuildWorld = proto.buildWorld;

const logoTexture = (() => {
  const texture = new T.Texture();
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  const image = new Image();
  image.onload = () => {
    texture.image = image;
    texture.needsUpdate = true;
  };
  image.src = logoSvg;
  return texture;
})();

const makePanel = (width: number, height: number, backingColor = '#2457a6') => {
  const group = new T.Group();
  const backing = new T.Mesh(
    new T.BoxGeometry(width + .18, height + .18, .12),
    new T.MeshStandardMaterial({ color: backingColor, roughness: .7 })
  );
  backing.castShadow = true;
  backing.receiveShadow = true;
  group.add(backing);
  const panel = new T.Mesh(
    new T.PlaneGeometry(width, height),
    new T.MeshBasicMaterial({ map: logoTexture, transparent: true, side: T.DoubleSide })
  );
  panel.position.z = .071;
  group.add(panel);
  return group;
};

const addGateLogo = (gate: T.Group) => {
  if (gate.userData.zheleznoRoofSign) return;
  const sign = makePanel(3.55, .62);
  sign.name = 'ZheleznoGateRoofLogo';
  sign.position.set(0, 7.78, .89);
  gate.add(sign);
  gate.userData.zheleznoRoofSign = true;
};

const addDistantTempleLogo = (temple: T.Group) => {
  if (temple.userData.zheleznoFacadeLogo) return;
  const sign = makePanel(7.1, 1.02);
  sign.name = 'ZheleznoDistantTempleRoofLogo';
  sign.position.set(0, 11.05, 3.07);
  temple.add(sign);
  temple.userData.zheleznoFacadeLogo = true;
};

proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  const gate = this.prototypes.get('gate') as T.Group | undefined;
  if (gate) addGateLogo(gate);
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  const temple = this.templeGroup as T.Group | undefined;
  if (temple) addDistantTempleLogo(temple);
};
