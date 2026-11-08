/**
 * Motor del visor 3D (three r162 + expo-gl). Convierte los modelos de `@/data/models3d` en mallas,
 * carga texturas y libera todo al cerrar.
 *
 * `three` está fijado en 0.162.0: r163+ rechaza el contexto de expo-gl en Expo Go
 * ("WebGL 1 is not supported"). Ver docs/iteraciones/it-07-visor-3d-ar.md (spike 7.0).
 */
import { Asset } from 'expo-asset';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { Platform } from 'react-native';
import * as THREE from 'three';
import { type Model3d, type Part, type Shape, TEXTURES, type TextureId } from '@/data/models3d';

/** Canvas mínimo para que WebGLRenderer acepte el contexto de expo-gl en nativo. */
function canvasShim(gl: ExpoWebGLRenderingContext) {
  return {
    width: gl.drawingBufferWidth,
    height: gl.drawingBufferHeight,
    clientWidth: gl.drawingBufferWidth,
    clientHeight: gl.drawingBufferHeight,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  } as unknown as HTMLCanvasElement;
}

export function createRenderer(gl: ExpoWebGLRenderingContext, transparent: boolean) {
  const renderer = new THREE.WebGLRenderer({
    canvas: Platform.OS === 'web' ? (gl.canvas as HTMLCanvasElement) : canvasShim(gl),
    context: gl as unknown as WebGLRenderingContext,
    antialias: true,
    alpha: transparent,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

/** Junta todo lo que hay que liberar al desmontar (geometrías, materiales, texturas). */
export class Disposer {
  private items: { dispose: () => void }[] = [];
  alive = true;
  track<T extends { dispose: () => void }>(item: T): T {
    this.items.push(item);
    return item;
  }
  dispose() {
    this.alive = false;
    this.items.forEach((i) => i.dispose());
    this.items = [];
  }
}

/**
 * Textura desde un asset local. En nativo, expo-gl acepta `{ localUri }` como píxeles de
 * `texImage2D`: se marca como DataTexture para que three pase `image.data` tal cual (probado en el spike).
 */
async function loadTexture(id: TextureId): Promise<THREE.Texture> {
  const asset = Asset.fromModule(TEXTURES[id]);
  await asset.downloadAsync();
  let tex: THREE.Texture;
  if (Platform.OS === 'web') {
    tex = await new THREE.TextureLoader().loadAsync(asset.localUri ?? asset.uri);
  } else {
    tex = new THREE.Texture();
    tex.image = { data: asset, width: asset.width ?? 1024, height: asset.height ?? 512 };
    (tex as unknown as { isDataTexture: boolean }).isDataTexture = true;
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Degradado radial en alfa (sombra de contacto, partículas de vapor). Sin canvas: píxeles a mano. */
export function radialTexture(size = 64, rgb: [number, number, number] = [0, 0, 0], power = 1.8) {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(1, Math.hypot(x - c, y - c) / c);
      const i = (y * size + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = Math.round(Math.pow(1 - d, power) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function geometryFor(shape: Exclude<Shape, { kind: 'steam' }>): THREE.BufferGeometry {
  switch (shape.kind) {
    case 'cylinder':
      return new THREE.CylinderGeometry(
        shape.rTop,
        shape.rBottom,
        shape.height,
        shape.segments ?? 48,
        1,
        !!shape.open,
      );
    case 'dome': {
      const g = new THREE.SphereGeometry(shape.radius, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1, shape.height / shape.radius, 1);
      return g;
    }
    case 'torus':
      return new THREE.TorusGeometry(shape.radius, shape.tube, 12, 36);
    case 'box':
      return new THREE.BoxGeometry(shape.w, shape.h, shape.d);
  }
}

/** Materiales baratos (Phong/Lambert): se ven bien con luces simples y rinden en gama media. */
function materialFor(part: Part): THREE.Material {
  const color = new THREE.Color(part.color);
  switch (part.finish) {
    case 'metal':
      return new THREE.MeshPhongMaterial({ color, specular: 0xffffff, shininess: 90 });
    case 'label':
      return new THREE.MeshPhongMaterial({
        color,
        specular: 0x8a8a8a,
        shininess: 70,
        side: THREE.DoubleSide,
      });
    case 'liquid':
      return new THREE.MeshPhongMaterial({ color, specular: 0xffffff, shininess: 120 });
    case 'plastic':
      return new THREE.MeshPhongMaterial({ color, specular: 0x555555, shininess: 40 });
    default:
      return new THREE.MeshLambertMaterial({ color, side: part.texture ? THREE.DoubleSide : THREE.FrontSide });
  }
}

export type BuiltPart = {
  part: Part;
  object: THREE.Object3D;
  base: THREE.Vector3;
  explode: THREE.Vector3;
  /** Radio horizontal de la pieza (para ubicar el rótulo a su costado). */
  radius: number;
};

export type Steam = { points: THREE.Points; height: number; radius: number; speeds: Float32Array };

export type BuiltModel = {
  /** Contiene las piezas con la base del modelo en y = 0. */
  inner: THREE.Group;
  parts: BuiltPart[];
  steam: Steam[];
  rest: THREE.Box3;
  exploded: THREE.Box3;
};

function shapeRadius(shape: Shape) {
  switch (shape.kind) {
    case 'cylinder':
      return Math.max(shape.rTop, shape.rBottom);
    case 'dome':
      return shape.radius;
    case 'torus':
      return shape.radius + shape.tube;
    case 'box':
      return Math.max(shape.w, shape.d) / 2;
    case 'steam':
      return shape.radius;
  }
}

function buildSteam(shape: Extract<Shape, { kind: 'steam' }>, disposer: Disposer, sprite: THREE.Texture): Steam {
  const positions = new Float32Array(shape.count * 3);
  const speeds = new Float32Array(shape.count);
  for (let i = 0; i < shape.count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * shape.radius * 2;
    positions[i * 3 + 1] = Math.random() * shape.height;
    positions[i * 3 + 2] = (Math.random() - 0.5) * shape.radius * 2;
    speeds[i] = 1.2 + Math.random() * 1.4;
  }
  const geometry = disposer.track(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = disposer.track(
    new THREE.PointsMaterial({
      size: 2.8,
      map: sprite,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      color: 0xffffff,
    }),
  );
  return { points: new THREE.Points(geometry, material), height: shape.height, radius: shape.radius, speeds };
}

/** Sube las partículas de vapor y las recicla al llegar arriba. */
export function animateSteam(steam: Steam, dt: number) {
  const attr = steam.points.geometry.getAttribute('position') as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < steam.speeds.length; i++) {
    arr[i * 3 + 1] += steam.speeds[i] * dt;
    arr[i * 3] += Math.sin(arr[i * 3 + 1] * 1.3 + i) * 0.01;
    if (arr[i * 3 + 1] > steam.height) {
      arr[i * 3] = (Math.random() - 0.5) * steam.radius * 2;
      arr[i * 3 + 1] = 0;
      arr[i * 3 + 2] = (Math.random() - 0.5) * steam.radius * 2;
    }
  }
  attr.needsUpdate = true;
}

export function buildModel(model: Model3d, disposer: Disposer, sprites: { shadow: THREE.Texture; steam: THREE.Texture }): BuiltModel {
  const inner = new THREE.Group();
  const parts: BuiltPart[] = [];
  const steam: Steam[] = [];
  const rest = new THREE.Box3();
  const exploded = new THREE.Box3();

  for (const part of model.parts) {
    const base = new THREE.Vector3(...part.position);
    const explode = new THREE.Vector3(...part.explode);
    let object: THREE.Object3D;
    if (part.shape.kind === 'steam') {
      const s = buildSteam(part.shape, disposer, sprites.steam);
      steam.push(s);
      object = s.points;
    } else {
      const geometry = disposer.track(geometryFor(part.shape));
      const material = disposer.track(materialFor(part));
      if (part.texture) {
        const textureId = part.texture;
        loadTexture(textureId)
          .then((tex) => {
            if (!disposer.alive) return tex.dispose();
            disposer.track(tex);
            // La cara principal de la etiqueta (u = 0.25) queda mirando a la cámara.
            if (textureId.startsWith('label')) tex.offset.x = 0.25;
            const m = material as THREE.MeshPhongMaterial | THREE.MeshLambertMaterial;
            m.map = tex;
            m.needsUpdate = true;
          })
          .catch(() => {
            // Sin textura la pieza se ve con su color base: no rompe el visor.
          });
      }
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!.clone();
      if (part.rotation) box.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...part.rotation)));
      rest.union(box.clone().translate(base));
      exploded.union(box.clone().translate(base.clone().add(explode)));
      object = new THREE.Mesh(geometry, material);
    }
    object.position.copy(base);
    if (part.rotation) object.rotation.set(...part.rotation);
    inner.add(object);
    parts.push({ part, object, base, explode, radius: shapeRadius(part.shape) });
  }

  // Sombra de contacto: elipse difusa bajo el modelo (también en el estudio).
  const size = rest.getSize(new THREE.Vector3());
  const shadowGeo = disposer.track(new THREE.PlaneGeometry(1, 1));
  const shadowMat = disposer.track(
    new THREE.MeshBasicMaterial({ map: sprites.shadow, transparent: true, depthWrite: false, opacity: 0.6 }),
  );
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.scale.set(size.x * 1.7 + 2, size.z * 1.9 + 2, 1);
  shadow.renderOrder = -1;
  inner.add(shadow);

  return { inner, parts, steam, rest, exploded };
}

/** Luces del estudio y de la AR: llave cálida, contraluz dorado y relleno berry. */
export function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3d0638, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(4, 7, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd27a, 1.1);
  rim.position.set(-6, 3, -5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffd7f3, 0.5);
  fill.position.set(-5, 1, 6);
  scene.add(fill);
}

/** Distancia de cámara para que la caja entre completa (con margen) en el encuadre. */
export function fitDistance(box: THREE.Box3, fovDeg: number, aspect: number, margin = 1.12) {
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const vFov = THREE.MathUtils.degToRad(fovDeg);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  return (sphere.radius / Math.sin(Math.min(vFov, hFov) / 2)) * margin;
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
