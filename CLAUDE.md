@AGENTS.md

# Tambo+ — contexto del proyecto

Prototipo funcional (sin backend) de la app de delivery de Tambo (tienda de conveniencia, Lima, Perú). Proyecto universitario (9no ciclo). Expo SDK 58 · React Native 0.88 · React 19 · TypeScript estricto · Expo Router · zustand + AsyncStorage. Todo el catálogo, tiendas, cupones y pedidos son datos de prueba locales; no hay API, auth real, pagos reales ni mapas reales.

`AGENTS.md` (importado arriba) trae las reglas generales de Expo: usar `npx expo install`, leer docs versionadas porque SDK 58 es posterior a lo que recuerdas, no tocar `ios/`/`android/`. **Aquí solo va lo específico de este repo.**

## Idioma y dominio

- **Copy de UI, comentarios y mensajes de commit en español (Perú)**. Moneda en soles: `S/ 14.90` vía `money()` de `src/lib/format.ts`. Los nombres de rutas son en español (`/carrito`, `/pedido/seguimiento/[id]`, `/perfil/direcciones`); el código (variables, funciones, tipos) en inglés.
- "Delivery" y "Para llevar" (`Fulfillment = 'delivery' | 'pickup'`) cambian costo de envío, flujo de seguimiento y textos.

## Comandos

Gestor de paquetes: **npm** (hay `package-lock.json`, no hay `bun.lock`), así que `npx`, no `bunx`.

```bash
npm ci                 # instalar desde lockfile
npx expo start         # QR para Expo Go; `--web` para versión web
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint (solo lintea src/)
npx expo-doctor
```

Antes de dar una tarea por terminada: `npm run typecheck` y `npm run lint`. No hay tests automatizados ni CI.

**Línea base (2026-11-08):** typecheck y lint pasan sin errores. `expo-doctor` falla 1/20 por desfase de parches con SDK 58 (`expo`, `expo-router`, `expo-constants`, `expo-linking`, `expo-splash-screen` y `react-native-safe-area-context` en minor). Se arregla con `npx expo install --fix`; no se ha hecho para no mezclarlo con cambios de funcionalidad.

Formato: `.prettierrc.json` (comillas simples, 110 columnas, trailing commas). Prettier **no** está como dependencia: respeta ese estilo a mano.

## Arquitectura

```
src/app/         rutas Expo Router (solo pantallas y _layout)
  _layout.tsx      raíz: fuentes + hidratación + Stack con rutas protegidas
  (tabs)/          Inicio, Categorías, Descuentos, Órdenes, Perfil (tab bar propia)
  carrito.tsx      carrito = ruta `transparentModal` (bottom sheet), no un Sheet interno
  checkout.tsx     pantalla más grande (~800 líneas): entrega, horario, pago, validación
  pedido/…         [id] detalle/boleta, confirmado/[id], seguimiento/[id]
  perfil/…         direcciones, pagos, cupones, favoritos, notificaciones, ayuda, legal, editar
src/components/  UI compartida (ui.tsx = Txt, Tap, Button, Card, Chip, Badge…; layout.tsx; product.tsx; delivery.tsx; tracking.tsx; Sheet.tsx…)
src/data/        catálogo, categorías, promos, tiendas/cupones/dirección semilla, pedidos semilla, types.ts
src/lib/         format, pricing (totales y cupones), orderProgress (simulación), hooks sueltos
src/store/       zustand: cart, session, orders (persistidos) y ui (efímero)
src/theme/       tokens.ts (colores, tipografía Inter, radios, sombras)
stitch_app_delivery_tambo/   diseños fuente (code.html + screen.png por pantalla) y DESIGN.md
```

Alias `@/*` → `src/*`. Importa siempre con `@/…`.

### Convenciones que hay que respetar

- **Estilos:** `StyleSheet` + tokens de `@/theme/tokens` (`colors`, `space`, `radius`, `type`, `fonts`, `elevation`). No hardcodees colores, espaciados ni fuentes; si falta un token, agrégalo ahí. Los tokens espejan `stitch_app_delivery_tambo/tambo_digital_retail_system/DESIGN.md` (primario berry `#6B1464`, CTA de conversión dorado `#FFBE3B`, tarjetas radio 16, sheets radio 20, tab bar 64 px, 80 px de margen inferior en vistas con scroll).
- **Componentes base:** usa `Txt` (nunca `Text` suelto), `Tap` (Pressable con feedback), `Button` (variantes `gold`/`brand`/`ghost`/`outline`/`danger`/`soft`), `Icon` (MaterialCommunityIcons). `Tap` con `hasNestedControls` cuando una superficie pulsable contiene otros botones (en web evita `<button>` anidado).
- **Iconos:** tipo `IconName` de `@/components/Icon`.
- **Feedback:** `toast()` de `@/store/ui` para avisos; `haptic.tap/success/warning` de `@/lib/feedback` (ya es no-op en web).
- **Agregar al carrito:** para un producto suelto usa `useAddToCart()` (`src/lib/useAddToCart.ts`); aplica el *age gate* (+18) a productos con `alcoholic: true`, haptic y toast. Excepciones existentes: "Agregar todos" en `perfil/favoritos.tsx` repite esa lógica a mano, y "volver a pedir" (`pedido/[id].tsx`, `(tabs)/ordenes.tsx`) usa `useCart().replace` sin gate; el checkout vuelve a verificar la mayoría de edad al confirmar. Si tocas el age gate, revisa los tres sitios.
- **Precios:** nunca recalcular a mano; usar `computeTotals`, `lineTotal`, `checkCoupon` de `@/lib/pricing`. Soportan `multiBuy` (2 x S/ 13.90, 2x1), cupones `fixed`/`percent`/`shipping`, envío gratis desde S/ 40, delivery S/ 4.50. Redondeo con `round2`.
- **Web:** la app se centra a `MAX_APP_WIDTH` (480) en web; usa `useContentWidth()` para medidas dependientes del ancho. Las sombras pasan por `elevation` (que ya ramifica web/nativo).

### Estado y persistencia (puntos delicados)

- Stores persistidos: `useCart` (`tambo-cart`), `useSession` (`tambo-session`), `useOrders` (`tambo-orders`), vía `persistStorage` (AsyncStorage). `useUi` no persiste.
- **Gate de hidratación** en `_layout.tsx`: el array `persisted` decide cuándo se oculta el splash. **Si creas un store persistido nuevo, agrégalo ahí.**
- Los `persist` **no tienen `version` ni `migrate`**. Cambiar la forma de un estado persistido rompe instalaciones/navegadores con datos viejos. Si cambias esquemas, agrega `version` + `migrate`, o avisa que hay que borrar los datos de la app (en web, `localStorage`).
- `useSession.loggedIn` arranca en **`true`** a propósito (prototipo): `login` es una pantalla de demo (cualquier email válido + contraseña ≥ 6). El guard es `Stack.Protected` en `_layout.tsx`; `logout` te lleva a `/login`.
- **El estado del pedido no se guarda: se deriva.** `getOrderStatus(order, now)` (`src/lib/orderProgress.ts`) calcula fase/paso/ETA a partir de `createdAt` y el reloj (`useNow`). Tiempos acelerados en `DEMO_TIMELINE`: preparado 15 s, en camino 25 s, entregado 75 s; pickup listo a 30 s; cancelable los primeros 15 s. Los pedidos `seeded: true` salen como entregados. Para cambiar el ritmo de la demo toca solo `DEMO_TIMELINE`.
- `carrito.tsx` es una ruta modal transparente; en iOS monta su propio `ToastHost` para que los toasts queden sobre el modal.

## Lo que NO existe todavía (no asumas que está)

Backend/API, autenticación real, pasarela de pago, mapa real (el seguimiento usa una imagen `map-lima.jpg` con moto animada), notificaciones push, tests, CI, `eas.json`, variables de entorno. La app corre en **Expo Go** sin módulos nativos propios; si agregas uno con código nativo, necesitarás development build (ver AGENTS.md).

## Flujo de trabajo sugerido

1. Antes de tocar APIs de Expo/RN, confirma versión en `package.json` y consulta docs de SDK 58 (`https://docs.expo.dev/versions/v58.0.0/`); no confíes en memoria.
2. Para una pantalla nueva o rediseño, mira primero el diseño en `stitch_app_delivery_tambo/<pantalla>/screen.png` y `code.html`, y reutiliza componentes de `src/components/` antes de crear otros.
3. Datos de prueba para verificar a mano (cupones `TAMBOAPP`, `TAMBOYA10`, `ENVIOGRATIS`, comportamiento de la simulación, productos con alcohol): ver [README.md](README.md).
4. Cierra con `npm run typecheck` y `npm run lint`. Si el cambio es visual, levanta `npx expo start --web` y revísalo.
5. No hagas commit/push salvo que se pida. Historial actual: `Initial commit`, `1ra iteración - 29/10`.
