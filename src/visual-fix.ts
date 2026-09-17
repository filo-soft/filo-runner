import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const originalRender = T.WebGLRenderer.prototype.render;
const composers = new WeakMap<T.WebGLRenderer, EffectComposer>();
const rendering = new WeakSet<T.WebGLRenderer>();
const preparedScenes = new WeakSet<T.Scene>();

const gradeShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.055 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
    void main(){
      vec4 c=texture2D(tDiffuse,vUv); vec2 p=vUv-.5; float vignette=1.0-smoothstep(.28,.78,dot(p,p))*amount;
      c.rgb*=vignette; c.rgb=mix(c.rgb,c.rgb*vec3(1.025,1.0,.975),.06);
      c.rgb=clamp(c.rgb,0.0,1.0); gl_FragColor=c;
    }`
};

function makeSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 8; canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#7896ad");
  g.addColorStop(.42, "#a9b9bd");
  g.addColorStop(.72, "#d5c7ac");
  g.addColorStop(1, "#ead9b9");
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function prepareScene(scene: T.Scene) {
  if (preparedScenes.has(scene)) return;
  preparedScenes.add(scene);

  scene.background = makeSkyTexture();
  scene.fog = new T.FogExp2("#cdbfa9", 0.0125);

  const lights = scene.children.filter(o => o instanceof T.Light);
  const hemi = lights.find(o => o instanceof T.HemisphereLight) as T.HemisphereLight | undefined;
  if (hemi) hemi.intensity = Math.min(hemi.intensity, 1.55);

  const sun = lights.find(o => o instanceof T.DirectionalLight) as T.DirectionalLight | undefined;
  if (sun) {
    sun.color.set("#ffe4b4");
    sun.intensity = 2.6;
    sun.position.set(-16, 25, -12);
    sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 30, bottom: -20, near: 1, far: 86 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.035;
  }

  scene.traverse(obj => {
    if (!(obj instanceof T.Mesh)) return;
    obj.castShadow = obj.castShadow || !obj.isInstancedMesh;
    if (obj.material instanceof T.MeshStandardMaterial) {
      const mat = obj.material;
      mat.roughness = Math.max(mat.roughness, 0.68);
      if (mat.color.r > .72 && mat.color.g > .68 && mat.color.b > .58) mat.roughness = Math.max(mat.roughness, .82);
      mat.needsUpdate = true;
    }
  });
}

function upgradeCoins(scene: T.Scene) {
  scene.traverse(obj => {
    if (!(obj instanceof T.Mesh)) return;
    if (!(obj.geometry instanceof T.CylinderGeometry)) return;
    const mat = obj.material;
    if (!(mat instanceof T.MeshStandardMaterial)) return;
    if (mat.color.b < .55 || mat.color.r > .35) return;
    const physical = new T.MeshPhysicalMaterial({
      color: mat.color.clone(),
      metalness: .62,
      roughness: .22,
      clearcoat: .28,
      clearcoatRoughness: .16,
      emissive: new T.Color("#273a9e"),
      emissiveIntensity: .65,
    });
    obj.material = physical;
    mat.dispose();
  });
}

T.WebGLRenderer.prototype.render = function(scene: T.Object3D, camera: T.Camera) {
  const renderer = this;
  if (rendering.has(renderer)) {
    originalRender.call(renderer, scene, camera);
    return;
  }
  if (!(scene instanceof T.Scene) || !(camera instanceof T.Camera)) {
    originalRender.call(renderer, scene, camera);
    return;
  }

  prepareScene(scene);
  upgradeCoins(scene);

  let composer = composers.get(renderer);
  if (!composer) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new T.Vector2(renderer.domElement.width, renderer.domElement.height), .38, .72, 1.18);
    composer.addPass(bloom);
    const grade = new ShaderPass(gradeShader);
    composer.addPass(grade);
    composers.set(renderer, composer);
  }

  rendering.add(renderer);
  composer.setSize(renderer.domElement.width, renderer.domElement.height);
  composer.render();
  rendering.delete(renderer);
};
