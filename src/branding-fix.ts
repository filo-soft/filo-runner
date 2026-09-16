import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildPrototypes = proto.buildPrototypes;

const addGreekRelief = (gate: T.Group) => {
  if (gate.userData.greekRoofRelief) return;
  const relief = new T.Group();
  relief.name = 'GreekRoofRelief';
  relief.position.set(0, 7.12, 1.055);
  const mat = new T.MeshStandardMaterial({ color: '#d8c7aa', roughness: .88, metalness: .02 });
  const barGeo = new T.BoxGeometry(.34, .07, .055);
  const verticalGeo = new T.BoxGeometry(.07, .34, .055);
  const step = .43;
  for (let i = -4; i <= 4; i++) {
    const x = i * step;
    const top = new T.Mesh(barGeo, mat); top.position.set(x, .18, 0); relief.add(top);
    const bottom = new T.Mesh(barGeo, mat); bottom.position.set(x, -.18, 0); relief.add(bottom);
    if (i < 4) { const right = new T.Mesh(verticalGeo, mat); right.position.set(x + .17, 0, 0); relief.add(right); }
  }
  relief.scale.set(1.65, 1, 1);
  relief.traverse((o: T.Object3D) => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  gate.add(relief);
  gate.userData.greekRoofRelief = true;
};

proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  const gate = this.prototypes.get('gate') as T.Group | undefined;
  if (gate) addGreekRelief(gate);
};

// ZHELEZNO branding remains on the houses; the distant temple/horizon building has no logo.
