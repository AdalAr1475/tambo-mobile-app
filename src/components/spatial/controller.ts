/**
 * Estado mutable del visor 3D fuera de React: gestos (PanResponder), render loop, cámara y GL.
 * `Viewer3D` crea una instancia por montaje y le pasa las props en cada render.
 */
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { Animated, type GestureResponderEvent, PanResponder, type PanResponderInstance, Platform } from 'react-native';
import * as THREE from 'three';
import type { CompareSet, Model3d } from '@/data/models3d';
import {
  addLights,
  animateSteam,
  type BuiltModel,
  buildModel,
  createRenderer,
  Disposer,
  easeInOut,
  easeOutBack,
  fitDistance,
  radialTexture,
} from './engine';

export type ViewerMode = 'studio' | 'ar';

export type LiveProps = {
  exploded: boolean;
  comparing: boolean;
  arScale: number;
  placed: boolean;
  paused: boolean;
  onPinchScale?: (factor: number) => void;
  onInteract?: () => void;
};

export type LabelAnim = { xy: Animated.ValueXY; opacity: Animated.Value; last: { x: number; y: number; o: number } };

const FOV_STUDIO = 35;
const FOV_AR = 55;
/** AR: el teléfono "a 55 cm" de la mesa, inclinado 38°. Así 1 cm se ve igual en todos los productos. */
const AR_DISTANCE = 55;
const AR_ELEVATION = THREE.MathUtils.degToRad(38);
const INITIAL = { yaw: 0.35, pitch: 0.12, zoom: 1 };
const ANIM_MS = 600;
/** Ancho del rótulo de pieza (px); `Viewer3D` usa el mismo valor. */
export const LABEL_W = 176;
const IDLE_MS = 2500;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const touchDistance = (e: GestureResponderEvent) => {
  const [a, b] = e.nativeEvent.touches;
  return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
};

export class ViewerController {
  readonly anims: LabelAnim[];
  readonly base = new Animated.ValueXY({ x: -999, y: -999 });
  readonly responder: PanResponderInstance;
  private props: LiveProps = { exploded: false, comparing: false, arScale: 1, placed: true, paused: false };
  private layout = { w: 1, h: 1 };
  private view = { ...INITIAL, yawT: INITIAL.yaw, pitchT: INITIAL.pitch, zoomT: INITIAL.zoom, idleSince: 0 };
  private loop: { start: () => void; stop: () => void } | null = null;
  private disposer: Disposer | null = null;
  private disposed = false;

  constructor(
    private readonly mode: ViewerMode,
    private readonly model: Model3d,
    private readonly compare: CompareSet | undefined,
    labelCount: number,
  ) {
    this.anims = Array.from({ length: labelCount }, () => ({
      xy: new Animated.ValueXY({ x: -999, y: -999 }),
      opacity: new Animated.Value(0),
      last: { x: -999, y: -999, o: 0 },
    }));
    this.responder = this.createResponder();
  }

  setProps(next: LiveProps) {
    const prev = this.props;
    const wasPaused = prev.paused;
    this.props = next;
    // Al abrir la vista explosiva o el comparador, el modelo gira al frente para que se lean los rótulos.
    if ((next.exploded && !prev.exploded) || (next.comparing && !prev.comparing)) this.faceFront();
    if (next.paused !== wasPaused) {
      if (next.paused) this.loop?.stop();
      else this.loop?.start();
    }
  }

  setLayout(w: number, h: number) {
    this.layout = { w, h };
  }

  /** Detiene el loop y libera geometrías, materiales, texturas y el renderer. */
  dispose() {
    this.disposed = true;
    this.loop?.stop();
    this.loop = null;
    this.disposer?.dispose();
    this.disposer = null;
  }

  private createResponder() {
    let lastDx = 0;
    let lastDy = 0;
    let pinchStart = 0;
    let pinchLast = 1;
    let zoomStart = 1;
    let downAt = 0;
    let moved = false;
    let lastTap = 0;
    const touch = () => {
      this.view.idleSince = Date.now();
      this.props.onInteract?.();
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        lastDx = 0;
        lastDy = 0;
        pinchStart = 0;
        moved = false;
        downAt = Date.now();
        touch();
      },
      onPanResponderMove: (e, g) => {
        touch();
        const v = this.view;
        if (e.nativeEvent.touches.length >= 2) {
          moved = true;
          const d = touchDistance(e);
          if (!pinchStart) {
            pinchStart = d;
            pinchLast = 1;
            zoomStart = v.zoomT;
            return;
          }
          const ratio = d / pinchStart;
          if (this.mode === 'ar') this.props.onPinchScale?.(ratio / pinchLast);
          else v.zoomT = clamp(zoomStart / ratio, 0.55, 2.2);
          pinchLast = ratio;
          return;
        }
        pinchStart = 0;
        const ddx = g.dx - lastDx;
        const ddy = g.dy - lastDy;
        lastDx = g.dx;
        lastDy = g.dy;
        if (Math.abs(g.dx) + Math.abs(g.dy) > 6) moved = true;
        v.yawT += ddx * 0.012;
        if (this.mode === 'studio') v.pitchT = clamp(v.pitchT + ddy * 0.008, -0.45, 0.9);
      },
      onPanResponderRelease: () => {
        const now = Date.now();
        if (!moved && now - downAt < 250) {
          if (now - lastTap < 320) {
            this.reset();
            lastTap = 0;
          } else lastTap = now;
        }
        touch();
      },
    });
  }

  /** Doble toque: vuelve a la vista inicial (sin dar una vuelta completa de más). */
  private reset() {
    this.faceFront();
    this.view.zoomT = INITIAL.zoom;
  }

  private faceFront() {
    const v = this.view;
    v.yawT = INITIAL.yaw + Math.round((v.yaw - INITIAL.yaw) / (Math.PI * 2)) * Math.PI * 2;
    v.pitchT = INITIAL.pitch;
  }

  private setLabel(i: number, x: number, y: number, o: number) {
    const a = this.anims[i];
    if (!a) return;
    if (Math.abs(a.last.x - x) > 0.5 || Math.abs(a.last.y - y) > 0.5) {
      a.xy.setValue({ x, y });
      a.last.x = x;
      a.last.y = y;
    }
    if (Math.abs(a.last.o - o) > 0.02 || (o === 0 && a.last.o !== 0)) {
      a.opacity.setValue(o);
      a.last.o = o;
    }
  }

  onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    if (this.disposed) return;
    const { mode, model, compare } = this;
    const disposer = new Disposer();
    this.disposer = disposer;
    const renderer = disposer.track(createRenderer(gl, true));
    const scene = new THREE.Scene();
    addLights(scene);
    const camera = new THREE.PerspectiveCamera(mode === 'ar' ? FOV_AR : FOV_STUDIO, 1, 0.5, 600);
    const sprites = {
      shadow: disposer.track(radialTexture(64, [20, 4, 18], 1.6)),
      steam: disposer.track(radialTexture(32, [255, 255, 255], 2)),
    };

    const main = buildModel(model, disposer, sprites);
    const mainPivot = new THREE.Group();
    mainPivot.add(main.inner);
    scene.add(mainPivot);

    let other: BuiltModel | undefined;
    const otherPivot = new THREE.Group();
    if (compare && mode === 'studio') {
      other = buildModel(compare.other, disposer, sprites);
      otherPivot.add(other.inner);
      otherPivot.visible = false;
      scene.add(otherPivot);
    }

    // Encuadres: dependen del aspecto (se recalculan si cambia el tamaño en web).
    const restCenter = main.rest.getCenter(new THREE.Vector3());
    const explodedCenter = main.exploded.getCenter(new THREE.Vector3());
    const explodedFrame = main.exploded.clone();
    const ex = explodedFrame.getSize(new THREE.Vector3());
    explodedFrame.expandByVector(new THREE.Vector3(ex.x * 0.12 + 3.5, 0, 0)); // margen para los rótulos
    let mainX = 0;
    let otherX = 0;
    let compareFrame: THREE.Box3 | undefined;
    if (other && compare) {
      const s = (main.rest.getSize(new THREE.Vector3()).x + other.rest.getSize(new THREE.Vector3()).x) / 4 + 1.6;
      mainX = compare.otherSide === 'left' ? s : -s;
      otherX = -mainX;
      compareFrame = main.rest.clone().translate(new THREE.Vector3(mainX, 0, 0));
      compareFrame.union(other.rest.clone().translate(new THREE.Vector3(otherX, 0, 0)));
      compareFrame.max.y += 3;
    }
    const compareCenterY = compareFrame ? compareFrame.getCenter(new THREE.Vector3()).y : 0;
    const fit = { rest: 1, exploded: 1, compare: 1 };
    const refit = (w: number, h: number) => {
      const aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      fit.rest = fitDistance(main.rest, FOV_STUDIO, aspect);
      fit.exploded = fitDistance(explodedFrame, FOV_STUDIO, aspect, 1.05);
      fit.compare = compareFrame ? fitDistance(compareFrame, FOV_STUDIO, aspect, 1.05) : fit.rest;
    };
    refit(gl.drawingBufferWidth, gl.drawingBufferHeight);

    const anim = { explodeP: 0, compareP: 0, placeP: 0 };
    const v3 = new THREE.Vector3();
    const center = new THREE.Vector3();
    const dpr = Platform.OS === 'web' && typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    let raf: number | null = null;
    let last = performance.now();
    this.view.idleSince = Date.now();

    const project = (world: THREE.Vector3) => {
      world.project(camera);
      return {
        x: ((world.x + 1) / 2) * this.layout.w,
        y: ((1 - world.y) / 2) * this.layout.h,
        visible: world.z < 1,
      };
    };

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = this.props;
      const v = this.view;

      if (Platform.OS === 'web') {
        const canvas = gl.canvas as HTMLCanvasElement;
        const cw = Math.round(canvas.clientWidth * dpr);
        const ch = Math.round(canvas.clientHeight * dpr);
        if (cw > 0 && ch > 0 && (canvas.width !== cw || canvas.height !== ch)) {
          renderer.setSize(cw, ch, false);
          refit(cw, ch);
        }
      }

      const k = dt / (ANIM_MS / 1000);
      anim.explodeP = clamp(anim.explodeP + (p.exploded && !p.comparing ? k : -k), 0, 1);
      anim.compareP = clamp(anim.compareP + (p.comparing && other ? k : -k), 0, 1);
      anim.placeP = clamp(anim.placeP + (p.placed ? dt / 0.45 : -dt / 0.2), 0, 1);
      const e = easeInOut(anim.explodeP);
      const c = easeInOut(anim.compareP);

      // Autorrotación solo en la vista normal (con rótulos, el modelo se queda quieto).
      if (!p.exploded && !p.comparing && Date.now() - v.idleSince > IDLE_MS) v.yawT += (mode === 'ar' ? 0.22 : 0.35) * dt;
      const follow = Math.min(1, dt * 10);
      v.yaw += (v.yawT - v.yaw) * follow;
      v.pitch += (v.pitchT - v.pitch) * follow;
      v.zoom += (v.zoomT - v.zoom) * follow;

      for (const part of main.parts) part.object.position.copy(part.base).addScaledVector(part.explode, e);
      for (const s of main.steam) {
        s.points.visible = e < 0.05;
        if (s.points.visible) animateSteam(s, dt);
      }

      if (mode === 'studio') {
        center.lerpVectors(restCenter, explodedCenter, e);
        center.lerp(v3.set(0, compareCenterY, 0), c);
        main.inner.position.copy(center).multiplyScalar(-1);
        mainPivot.position.set(mainX * c, 0, 0);
        mainPivot.rotation.set(v.pitch, v.yaw, 0);
        if (other) {
          otherPivot.visible = c > 0.01;
          otherPivot.position.set(otherX * c, 0, 0);
          otherPivot.rotation.copy(mainPivot.rotation);
          otherPivot.scale.setScalar(Math.max(0.001, c));
          other.inner.position.set(0, -compareCenterY, 0);
          if (otherPivot.visible) for (const s of other.steam) animateSteam(s, dt);
        }
        const dist =
          THREE.MathUtils.lerp(THREE.MathUtils.lerp(fit.rest, fit.exploded, e), fit.compare, c) * v.zoom;
        camera.position.set(0, dist * 0.2, dist);
        camera.lookAt(0, 0, 0);
      } else {
        const appear = anim.placeP > 0 ? easeOutBack(anim.placeP) : 0;
        mainPivot.visible = anim.placeP > 0.01;
        mainPivot.rotation.set(0, v.yaw, 0);
        mainPivot.scale.setScalar(Math.max(0.001, p.arScale * (0.55 + 0.45 * appear)));
        camera.position.set(0, AR_DISTANCE * Math.sin(AR_ELEVATION), AR_DISTANCE * Math.cos(AR_ELEVATION));
        camera.lookAt(0, model.heightCm * 0.3, 0);
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();

      // Rótulos proyectados (después del render: las matrices ya están al día).
      if (mode === 'studio') {
        let li = 0;
        const o = e * (1 - c);
        for (const part of main.parts) {
          if (!part.part.label) continue;
          if (o < 0.02) {
            this.setLabel(li++, -999, -999, 0);
            continue;
          }
          part.object.getWorldPosition(v3);
          const left = part.part.labelSide === 'left';
          v3.x += (left ? -1 : 1) * (part.radius + 0.5);
          const s = project(v3);
          // El rótulo nunca se sale del visor: si no entra, el punto se mete sobre la pieza.
          const x = left ? Math.max(LABEL_W - 4, s.x) : Math.min(this.layout.w - LABEL_W + 4, s.x);
          this.setLabel(li++, x, s.y, s.visible ? o : 0);
        }
        if (other) {
          for (const [built, top] of [
            [main, main.rest.max.y],
            [other, other.rest.max.y],
          ] as const) {
            if (c < 0.02) {
              this.setLabel(li++, -999, -999, 0);
              continue;
            }
            const s = project(built.inner.localToWorld(v3.set(0, top + 1.2, 0)));
            this.setLabel(li++, s.x, s.y, c);
          }
        }
      } else {
        const s = project(mainPivot.localToWorld(v3.set(0, 0, 0)));
        this.base.setValue({ x: s.x, y: s.y });
      }
    };

    const tick = (now: number) => {
      raf = null;
      if (!disposer.alive || this.props.paused) return;
      step(now);
      raf = requestAnimationFrame(tick);
    };
    this.loop = {
      start: () => {
        if (raf == null && disposer.alive) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      },
      stop: () => {
        if (raf != null) cancelAnimationFrame(raf);
        raf = null;
      },
    };
    if (!this.props.paused) this.loop.start();
  };
}
