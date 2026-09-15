import * as T from 'three';
import logoSvg from './assets/branding/logo железно.svg?url';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
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
    new T.BoxGeometry(width + .16, height + .16, .12),
    new T.MeshStandardMaterial({ color: backingColor, roughness: .7 })
  );
  backing.castShadow = true;
  backing.receiveShadow = true;
  group.add(backing);

  const panel = new T.Mesh(
    new T.PlaneGeometry(width, height),
    new T.MeshBasicMaterial({ map: logoTexture, transparent: true, side: T.DoubleSide, depthWrite: false })
  );
  panel.position.z = .081;
  group.add(panel);
  return group;
};

const addGreekRelief = (gate: T.Group) => {
  if (gate.userData.greekRoofRelief) return;

  const relief = new T.Group();
  relief.name = 'GreekRoofRelief';
  relief.position.set(0, 7.12, 1.055);

  const mat = new T.MeshStandardMaterial({
    color: '#d8c7aa',
    roughness: .88,
    metalness: .02
  });

  // Repeating Greek meander / geometric relief, kept shallow so it reads as carved stone.
  const barGeo = new T.BoxGeometry(.34, .07, .055);
  const verticalGeo = new T.BoxGeometry(.07, .34, .055);
  const step = .43;
  for (let i = -4; i <= 4; i++) {
    const x = i * step;
    const top = new T.Mesh(barGeo, mat);
    top.position.set(x, .18, 0);
    relief.add(top);

    const bottom = new T.Mesh(barGeo, mat);
    bottom.position.set(x, -.18, 0);
    relief.add(bottom);

    if (i < 4) {
      const right = new T.Mesh(verticalGeo, mat);
      right.position.set(x + .17, 0, 0);
      relief.add(right);
    }
  }

  relief.scale.set(1.65, 1, 1);
  relief.traverse((o: T.Object3D) => {
    if (o instanceof T.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  gate.add(relief);
  gate.userData.greekRoofRelief = true;
};

const addDistantTempleLogo = (temple: T.Group) => {
  if (temple.userData.zheleznoFacadeLogo) return;
  const sign = makePanel(7.1, 1.02);
  sign.name = 'ZheleznoDistantTempleRoofLogo';
  sign.position.set(0, 10.55, 3.18);
  temple.add(sign);
  temple.userData.zheleznoFacadeLogo = true;
};

proto.buildPrototypes = function () {
  // The old logo on the close temple/gate roof is intentionally replaced by Greek relief.
  const gate = this.prototypes.get('gate') as T.Group | undefined;
  if (gate) addGreekRelief(gate);
};

proto.buildWorld = function () {
  originalBuildWorld.call(this);
  const temple = this.templeGroup as T.Group | undefined;
  if (temple) addDistantTempleLogo(temple);
};
