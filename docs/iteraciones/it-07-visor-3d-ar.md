# Iteración 7 · Tambo Spatial: visor 3D y AR ligera

**Ticket:** T10
**Objetivo:** que el usuario rote un producto o combo en 3D, vea su "vista explosiva" (capas e ingredientes), compare tamaños y lo proyecte sobre la mesa con la cámara antes de comprar.
**Por qué al final:** es el mayor "wow", pero tiene el **menor valor de negocio** en conveniencia y el **mayor riesgo técnico** (ver [roadmap](../02-roadmap.md#por-qué-el-3dar-es-la-penúltima)).
**Esfuerzo:** L · **Dependencias nuevas:** `expo-gl`, `three` y `expo-camera` (si no se instaló en It3). Opcionales: `expo-sensors` y `react-native-gesture-handler`.

## Límites y honestidad

- **AR con detección de superficies** (ARKit/ARCore) **no es posible en Expo Go**. Requiere un *development build* con módulos nativos (por ejemplo, ViroReact). Queda **fuera de alcance** y se menciona como el paso a producción.
- Lo que sí se hace es **AR ligera**: el feed de la cámara real de fondo, el modelo 3D superpuesto con sombra, una retícula animada, un control de escala y un "anclaje" aproximado con los sensores del teléfono.
- Los modelos son **procedurales** (geometría generada en código: cilindros, conos, capas). No hay archivos .glb que conseguir ni licenciar.

## 7.0 · Spike de compatibilidad (1 sesión, obligatorio)

1. `npx expo install expo-gl` + `npm i three` (y `@types/three`). Revisar `expo-gl` en la documentación de SDK 58.
2. Una pantalla de prueba con `GLView` + `THREE.WebGLRenderer({ context: gl, canvas: shim })` que dibuje un cubo girando. Probar en Expo Go (Android **y** el teléfono de la demo) y en web.
3. Probar **texturas**: cargar `fourloko-gold.jpg` como textura de un cilindro. En nativo suele requerir `expo-asset` + `gl.texImage2D` con `{ localUri }`, o un helper.
4. **Decisión:**
   - ✅ Si funciona → **Nivel A** (3D real).
   - ❌ Si no funciona o rinde a menos de 30 fps → **Nivel B** (2.5D). No se pierde más de 1 sesión.

### Resultado del spike (2026-11-08) → ✅ Nivel A

| Plataforma | GPU / GL | fps | WebGL2 | Textura `fourloko-gold.jpg` |
| --- | --- | --- | --- | --- |
| Android (Expo Go, celular real) | Mali-G57 MC2 · OpenGL ES 3.2 | **83** | sí | ok, orientación correcta |
| Web (Chrome, render por software) | SwiftShader | 60 | sí | ok |

- **`three` fijado en `0.162.0` (y `@types/three` igual). No subir.** Con r187 Expo Go lanzaba `THREE.WebGLRenderer: WebGL 1 is not supported since r163` aunque el celular soporta ES 3.2: el `gl` de expo-gl en Expo Go pasa `instanceof WebGLRenderingContext` y three r163+ lo rechaza. r162 es la última versión sin ese chequeo.
- Textura en nativo: `Asset` + `texture.image = { data: asset, width, height }` + `isDataTexture = true` (expo-gl acepta `{ localUri }` en `texImage2D`). En web, `TextureLoader` con la URI del asset.
- `fourloko-gold.jpg` es una foto de latas en un estante: envuelta en el cilindro se ve el estante. Para la lata hace falta una etiqueta propia (dibujada en código o un recorte de la etiqueta).
- En web el canvas toma su tamaño al crearse: el visor debe llamar `renderer.setSize` en `onLayout`.

### Implementación (2026-11-08) · Nivel A

- **Datos:** `src/data/models3d.ts` (piezas en cm con la base en y = 0, explosión y rótulos por pieza; `getModel3d(spec)` devuelve el modelo y el comparador). `Product.model3d` en `fourloko-gold` (`can473`), los dos packs (`pack2`), `cafe-americano` y `capuccino` (`cup12`) y `pan-chicharron` (`combo`: el producto ya es el combo pan + café).
- **Texturas:** etiquetas de lata (dorada y sandía), manga del vaso y foto de mesa en `assets/images/3d/` y `assets/images/ar-table.jpg`. Son diseños propios (SVG en `scripts/textures/`) rasterizados con `node scripts/build-textures.mjs` (Chrome headless). La foto de mesa es generada: sin licencia de terceros.
- **Componentes:** `src/components/spatial/` → `engine.ts` (three: geometrías, materiales Phong/Lambert, texturas, sombra, vapor), `controller.ts` (gestos, render loop, cámara, rótulos proyectados; fuera de React por las reglas del React Compiler), `Viewer3D.tsx`, `ArStage.tsx`, `View3DChip.tsx`.
- **Ruta:** `src/app/visor/[id].tsx`. Entra desde abajo pero **no** es modal nativo: así el age gate y los toasts (montados en `_layout.tsx`) quedan encima también en iOS.
- **Vista explosiva / comparador:** 600 ms con *easing* dentro del render loop (no Reanimated: evita leer un shared value desde el hilo JS en cada frame). Al activarlos, el modelo gira al frente y se detiene la autorrotación.
- **AR:** cámara fija "a 55 cm, 38° de inclinación", así 1 cm se ve igual en todos los productos y el rótulo "Tamaño real ≈ X cm" tiene sentido. Pellizcar cambia la escala (el slider lo sigue). Sin `expo-sensors`.
- **CTA:** `useAddToCart(product.id)` (age gate en Four Loko). `useAddManyToCart` no hace falta: el combo es un solo producto.
- **Recursos:** `useFocusEffect` pausa el render loop y desmonta `CameraView` al perder el foco (p. ej. al abrir el carrito); al cerrar el visor se cancela el `requestAnimationFrame` y se liberan geometrías, materiales, texturas y renderer.

Verificado en web (Chrome). En el celular lo prueba el equipo (Expo Go): ver criterios de aceptación abajo.

## Nivel A · Visor 3D con `three`

**`src/data/models3d.ts`:** descripción procedural por producto (`Product.model3d`).

| Modelo | Producto(s) | Geometría | Vista explosiva | Comparador |
| --- | --- | --- | --- | --- |
| `can473` | Four Loko Gold / Sandía | Cilindro de 6.6 × 15.7 cm con la textura de la etiqueta y tapas metálicas | Lata, anillo y etiqueta separados, con cotas en cm | Lata de 355 ml vs. 473 ml |
| `pack2` | Packs Four Loko | 2 latas + faja de cartón | Separa las latas | — |
| `cup12` / `cup16` | Café Americano, Capuccino | Cono truncado + tapa + manga de cartón; partículas de vapor | Vaso, café (con la temperatura `~70 °C`), espuma (capuccino) y tapa | **12 oz vs. 16 oz** lado a lado |
| `sandwich` | Pan con chicharrón | Capas: pan inferior, chicharrón, camote, sarsa criolla, pan superior (cajas redondeadas o cilindros aplanados con colores del tema) | Capas separadas verticalmente, cada una con su etiqueta | — |
| `combo` | Combo sanguchero (`pan-chicharron` + `cafe-americano`) | Composición de `sandwich` + `cup12` | Las dos piezas se separan | — |

**Visor `/visor/[id]`** (modal a pantalla completa, fondo oscuro con un degradado berry):

- **Pestaña "Vista 3D / 360°":**
  - arrastrar rota (PanResponder);
  - pellizcar hace zoom;
  - doble toque reinicia;
  - autorrotación lenta cuando el usuario no toca;
  - botones `Vista explosiva` (animación de 600 ms con Reanimated, que alimenta un uniforme o una posición en el render loop) y `Comparar tamaño`;
  - las etiquetas de las capas son overlays de RN ubicados con `vector.project(camera)`.
- **Pestaña "Proyectar en tu mesa (AR)":**
  - de fondo, `CameraView` (`expo-camera`) a pantalla completa; si no hay permiso o es web, una **foto de mesa de respaldo** (`assets/images/ar-table.jpg`, con licencia libre);
  - encima, un `GLView` transparente con el modelo y una sombra elíptica, más una **retícula** que "busca superficie" durante 1.2 s y luego "fija";
  - slider de escala con el rótulo "Tamaño real ≈ 15.7 cm";
  - opcional: `expo-sensors` (`DeviceMotion`) para compensar la inclinación y simular el anclaje.
- **CTA fijo:** "🛒 Agregar al carrito · S/ 14.90". Usa `useAddToCart` o `useAddManyToCart` en los combos, **con age gate**.

## Nivel B · Plan B en 2.5D (sin WebGL)

- **Rotación:** se usan capas SVG (`react-native-svg`) o imágenes con `transform: [{ perspective }, { rotateY }]` controladas por el arrastre, más un brillo que se desplaza. Para las latas, la textura de la etiqueta se desplaza en X para simular el giro del cilindro.
- **Vista explosiva:** ilustraciones SVG por capa que se separan con Reanimated.
- **AR ligera:** se mantiene igual (cámara o foto de mesa) con la imagen 2.5D superpuesta.
- La UI y el CTA son **idénticos**: el cambio de nivel no afecta al resto de la app.

## Puntos de entrada

- Chip **`🥽 Ver en 3D`** en `ProductCard` cuando `product.model3d` existe. Va en los combos del Home, en la categoría Cafetería y en Comida lista.
- Botón en el detalle de producto, debajo de la galería.
- En el carrusel del Home, el banner de Four Loko lleva "Ver en 3D".

## Criterios de aceptación

- [ ] El spike está documentado (en este archivo o en el commit) con la decisión Nivel A o B y sus fps.
- [ ] Desde el Home → combo → "Ver en 3D": se rota con el dedo, hay zoom y la vista explosiva muestra las capas con sus nombres.
- [ ] El café permite comparar 12 oz con 16 oz.
- [ ] La pestaña AR muestra la cámara real (con permiso) y el modelo con sombra, escalable. Si se niega el permiso, aparece la foto de mesa **sin errores**.
- [ ] "Agregar al carrito" respeta el age gate en Four Loko.
- [ ] El visor se cierra y libera la cámara y el contexto GL (sin consumo de batería después de cerrarlo).
- [ ] Fluido en el teléfono de la demo (≥ 30 fps a simple vista).

## Prompt para el agente

```
Iteración 7 de docs/iteraciones/it-07-visor-3d-ar.md (T10). EMPIEZA por el spike 7.0 y detente con un
informe (funciona o no, fps aproximados, problemas con texturas) antes de seguir; consulta
expo-gl y expo-camera en https://docs.expo.dev/versions/v58.0.0/ e instala con npx expo install
(three con npm i three @types/three).
Si el spike pasa → Nivel A: src/data/models3d.ts (modelos procedurales de la tabla), Product.model3d,
src/components/spatial/ (Viewer3D con GLView+three, gestos con PanResponder, vista explosiva y
comparador animados, etiquetas proyectadas), ruta modal src/app/visor/[id].tsx con las pestañas
"Vista 3D / 360°" y "Proyectar en tu mesa (AR)" (CameraView de fondo, foto de respaldo
assets/images/ar-table.jpg, retícula, escala, sombra) y el CTA con useAddToCart/useAddManyToCart.
Si no pasa → Nivel B con la misma API de componentes, usando transforms + SVG.
Entradas: chip "Ver en 3D" en ProductCard (si model3d), en el detalle de producto y en el banner del
Home. Limpia los recursos GL y de cámara al desmontar. Typecheck + lint.
```
