import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const originalRender = T.WebGLRenderer.prototype.render;
const composers = new WeakMap<T.WebGLRenderer, EffectComposer>();
const rendering = new WeakSet<T.WebGLRenderer>();
const preparedScenes = new WeakSet<T.Scene>();
const preparedRenderers = new WeakSet<T.WebGLRenderer>();

const gradeShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.075 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
    void main(){
      vec4 c=texture2D(tDiffuse,vUv);
      vec2 p=vUv-.5;
      float vignette=1.0-smoothstep(.22,.80,dot(p,p))*amount;
      c.rgb*=vignette;
      c.rgb=mix(c.rgb,c.rgb*vec3(1.018,1.0,.982),.10);
      c.rgb=clamp(c.rgb,0.0,1.0);
      gl_FragColor=c;
    }`
};

function makeSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 8; canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#6f8da6");
  g.addColorStop(.38, "#a2b5bc");
  g.addColorStop(.70, "#d0c5b0");
  g.addColorStop(1, "#ead8b8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function prepareRenderer(renderer: T.WebGLRenderer) {
  if (preparedRenderers.has(renderer)) return;
  preparedRenderers.add(renderer);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
}

function prepareScene(scene: T.Scene) {
  if (preparedScenes.has(scene)) return;
  preparedScenes.add(scene);

  scene.background = makeSkyTexture();
  scene.fog = new T.FogExp2("#cdbfa9", 0.0125);

  const lights = scene.children.filter(o => o instanceof T.Light);

  let hemi = lights.find(o => o instanceof T.HemisphereLight) as T.HemisphereLight | undefined;
  if (!hemi) {
    hemi = new T.HemisphereLight("#b9cde0", "#8b735c", 1.05);
    scene.add(hemi);
  } else {
    hemi.color.set("#b9cde0");
    hemi.groundColor.set("#8b735c");
    hemi.intensity = Math.min(hemi.intensity, 1.05);
  }

  let sun = lights.find(o => o instanceof T.DirectionalLight) as T.DirectionalLight | undefined;
  if (!sun) {
    sun = new T.DirectionalLight("#ffe4b4", 2.0);
    scene.add(sun);
  }
  sun.color.set("#ffe4b4");
  sun.intensity = 2.0;
  sun.position.set(-16, 25, -12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -30,
    right: 30,
    top: 36,
    bottom: -24,
    near: 1,
    far: 100
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.028;

  scene.traverse(obj => {
    if (!(obj instanceof T.Mesh)) return;
    obj.castShadow = true;
    obj.receiveShadow = true;

    if (obj.material instanceof T.MeshStandardMaterial) {
      const mat = obj.material;
      mat.metalness = Math.min(mat.metalness, 0.08);
      mat.roughness = Math.max(mat.roughness, 0.72);
      if (mat.color.r > .62 && mat.color.g > .58 && mat.color.b > .50) {
        mat.roughness = Math.max(mat.roughness, .84);
      }
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
      metalness: .68,
      roughness: .20,
      clearcoat: .42,
      clearcoatRoughness: .12,
      emissive: new T.Color("#263dff"),
      emissiveIntensity: .55,
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

  prepareRenderer(renderer);
  prepareScene(scene);
  upgradeCoins(scene);

  let composer = composers.get(renderer);
  if (!composer) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new T.Vector2(renderer.domElement.width, renderer.domElement.height),
      0.28,
      0.68,
      1.15
    );
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
