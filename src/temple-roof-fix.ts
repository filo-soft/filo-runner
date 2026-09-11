import * as T from 'three';
import { RunnerGame } from './game';

const proto = RunnerGame.prototype as any;
const originalBuildPrototypes = proto.buildPrototypes;
const originalBuildWorld = proto.buildWorld;

// The templeGroup is the distant background temple. The temples the runner
// actually passes under are the sideTemple landmarks spawned on the track.
proto.buildPrototypes = function () {
  originalBuildPrototypes.call(this);
  const temple = this.prototypes.get('sideTemple') as T.Group | undefined;
  if (!temple || temple.userData.roofRaised) return;

  // Match the ordinary roadside columns exactly: the old sideTemple used
  // short 3.7-unit columns, which made the roof hang into the mobile view.
  // Rebuild those three column meshes as full roadside-height columns.
  for (let i = 1; i <= 3; i++) {
    const oldColumn = temple.children[i];
    if (!oldColumn) continue;
    const x = oldColumn.position.x;
    const z = oldColumn.position.z;
    temple.remove(oldColumn);
    oldColumn.traverse((child: T.Object3D) => {
      const mesh = child as T.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    const column = this.makeColumn(6.6);
    column.position.set(x, .3, z);
    temple.add(column);
  }

  // Put the entablature directly on the taller columns.
  const entablature = temple.children[4];
  const roof = temple.children[5];
  if (entablature) entablature.position.y = 6.95;
  if (roof) {
    roof.position.y = 7.12;
    // Keep the same triangular footprint, but flatten the triangle vertically.
    // This keeps it clearly visible as a temple roof without dropping into the
    // mobile camera's main play area.
    roof.scale.y = .62;
  }

  temple.userData.roofRaised = true;
};

// difficulty.ts still contains an older background-temple adjustment. Undo
// that adjustment here so only the sideTemple landmarks get the roof fix.
proto.buildWorld = function () {
  originalBuildWorld.call(this);
  const temple = this.templeGroup as T.Group | undefined;
  if (!temple) return;

  temple.scale.set(1, 1, 1);
  temple.position.y = 0;
  temple.children.forEach((child: T.Object3D) => {
    if (child.position.y > 8.4) child.position.y -= 4.5;
  });
};
