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

**Línea base (2026-11-08, It. 1):** typecheck, lint y `expo-doctor` (20/20) pasan sin errores. Ya se corrió `npx expo install --fix`.

**Planificación:** el roadmap por iteraciones está en [docs/](docs/README.md). Antes de implementar algo, lee el archivo de su iteración en `docs/iteraciones/`.

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
- **Agregar al carrito:** para un producto suelto usa `useAddToCart()` (`src/lib/useAddToCart.ts`); aplica el *age gate* (+18) a productos con `alcoholic: true`, haptic y toast. Con `{ redeem }` agrega un canje y valida el saldo de puntos. Para varios productos a la vez (combos de Tambo IA, "Arma tu plan", "Agregar todos" de favoritos) usa `useAddManyToCart()` (age gate + "Deshacer"). Excepción: "volver a pedir" usa `useReorder()` (`src/lib/useReorder.tsx`) sin gate; el checkout vuelve a verificar la mayoría de edad al confirmar. Si tocas el age gate, revisa los tres sitios (`useAddToCart`, `useAddManyToCart`, checkout).
- **Tambo Auto-Pilot (rutinas):** store `useRoutines` + lógica en `src/lib/routines.ts` (`nextRun`, `dueRoutines`, `runRoutine`, plantillas). Un pedido de rutina se crea con `placeOrder({ routineId, clearCart: false })`, que aplica el beneficio (10 % en productos + envío gratis vía `computeTotals(..., { routine: true })`) y puntos dobles. Nunca toca el carrito del usuario. `useRoutineRunner` (montado en `_layout.tsx`) ejecuta rutinas solo con la app abierta, en una ventana de 10 min tras la hora; en producción esto iría en el servidor. Las rutinas con alcohol pasan el age gate al **crearlas**.
- **Mapas y geo:** mapa real = `<SmartMap>` (`src/components/map/`): Leaflet + tiles CARTO/OSM en `react-native-webview`; en web, sin conexión o si no carga en 6 s cae al `fallback` (p. ej. `TrackingMap` SVG). Coordenadas reales en `src/data/places.json` (Nominatim, una sola vez); rutas reales precalculadas en `src/data/routes.json` con `node scripts/build-routes.mjs` (OSRM); **la app nunca llama APIs de mapas/ruteo en runtime** y no se inventan coordenadas. Utilidades en `src/lib/geo.ts` (`haversine`, `deliveryStoreFor`, `deliveryRoute`, `walkingRoute`). El delivery lo despacha la tienda más cercana a la dirección. Ubicación: `useUserLocation()` (demo fija por defecto; GPS real opcional en `/demo`).
- **SafeDrop (delivery):** pedidos con `safeDrop: true` solo se completan al verificar el QR/PIN (`verifiedAt`); al llegar quedan en `arrived`. Los pedidos antiguos sin el flag se entregan por tiempo. "Simular recorrido GPS" usa el reloj simulado `order.sim` (`useOrders.simulate`).
- **Tambo IA:** motor local y explicable en `src/lib/recommender.ts` (`forYou`, `upsell`, `buildPlan`), funciones puras sin red. Montos siempre con `computeTotals`/`lineTotal`. UI en `src/components/ai.tsx` y `/ia/plan`. No lo presentes como LLM: es un recomendador híbrido (historial + hora + promos + presupuesto).
- **Volver a pedir:** siempre con `useReorder()` (renderiza su `sheet` una vez por pantalla). Si el carrito tiene productos pregunta *Reemplazar / Sumar / Cancelar*; nunca reemplaces el carrito en silencio. `useCart().replace` limpia el cupón.
- **Crear y cancelar pedidos:** siempre con `placeOrder()` / `cancelOrder()` (`src/lib/placeOrder.ts`). `placeOrder` calcula totales, guarda el pedido, registra puntos canjeados y ganados, marca el cupón y vacía el carrito (`clearCart: false` para pedidos automáticos); lanza `InsufficientPointsError` si no alcanza el saldo. `cancelOrder` revierte puntos y libera el cupón. No repitas esos pasos en pantallas.
- **Modalidad:** Delivery / Para llevar se elige solo en `DeliveryPointSheet` (`FulfillmentToggle` no se usa en otro lugar). En el resto, muéstrala con `FulfillmentBadge` + un acceso que abra ese sheet.
- **Controles de demo:** todo botón "Simular…" va dentro de `<DemoOnly>` (solo visible con el Modo Presentador).
- **Retiro "Para llevar" (Smart Lockers):** `Order.pickupMethod` (`'locker'` por defecto si la tienda tiene `lockers.free > 0`, o `'counter'`). El retiro se completa **solo** verificando el QR dinámico (`useOrders.verify` → `verifiedAt`): tótem `/locker/[id]` o "Simular escaneo en caja". No existe confirmación manual. Casilleros, PIN y "telemetría" se derivan del pedido en `src/lib/lockers.ts`; el QR (SHA-256 por ventana de 30 s, `expo-crypto`) en `src/lib/token.ts`; el dibujo en `<QrCode>` (`src/components/qr.tsx`). Es demostrativo: no hay secreto de servidor.
- **Precios:** nunca recalcular a mano; usar `computeTotals`, `lineTotal`, `lineCash`, `checkCoupon` de `@/lib/pricing`. Soportan `multiBuy` (2 x S/ 13.90, 2x1), cupones `fixed`/`percent`/`shipping`, envío gratis desde S/ 40, delivery S/ 4.50, líneas canjeadas con puntos y la opción `pointsToUse`. El cupón y el envío gratis se miden sobre el `subtotal` **en soles** (sin la parte canjeada). Redondeo con `round2`.
- **Tambo Lover Puntos:** reglas en `@/lib/points` (10 pts por S/ 1 pagado en productos, 1 pt = S/ 0.01, niveles por puntos históricos). El saldo es la suma del ledger de `useWallet`; nunca lo modifiques fuera de `placeOrder`/`cancelOrder`/`demoTopUp`. Un producto canjeable tiene `Product.redeem`; en el carrito la línea lleva `redeem: 'points' | 'mixed'` (identidad = `productId + redeem`). Formatea puntos con `pts()`/`formatPoints()`.
- **Web:** la app se centra a `MAX_APP_WIDTH` (480) en web; usa `useContentWidth()` para medidas dependientes del ancho. Las sombras pasan por `elevation` (que ya ramifica web/nativo).

### Estado y persistencia (puntos delicados)

- Stores persistidos: `useCart` (`tambo-cart`, v2), `useSession` (`tambo-session`, v3), `useOrders` (`tambo-orders`, v2), `useDemo` (`tambo-demo`, Modo Presentador), `useWallet` (`tambo-wallet`, ledger de puntos), `useRoutines` (`tambo-routines`), vía `persistStorage` (AsyncStorage). `useUi` no persiste.
- **Gate de hidratación** en `_layout.tsx`: el array `persisted` decide cuándo se oculta el splash. **Si creas un store persistido nuevo, agrégalo ahí** (y, si guarda datos de la demo, en `resetDemoData()` de `src/lib/demo.ts`).
- Todos los `persist` tienen **`version: 1` + `migrate`** (identidad). Si cambias la forma o el significado de un estado persistido, sube la `version` y transforma los datos en `migrate`; agregar campos opcionales no lo requiere.
- **Modo Presentador** (`/demo`, se abre manteniendo presionada 2 s la foto de Perfil): activa los controles `<DemoOnly>`, reloj ×1/×3, pedidos de prueba, adelantar pedidos y **Reiniciar demo**.
- `useSession.loggedIn` arranca en **`true`** a propósito (prototipo): `login` es una pantalla de demo (cualquier email válido + contraseña ≥ 6). El guard es `Stack.Protected` en `_layout.tsx`; `logout` te lleva a `/login`.
- **El estado del pedido no se guarda: se deriva.** `getOrderStatus(order, now)` (`src/lib/orderProgress.ts`) calcula fase/paso/ETA a partir de `createdAt` y el reloj (`useNow`). Tiempos acelerados en `DEMO_TIMELINE`: preparado 15 s, en camino 25 s, entregado 75 s; pickup listo a 30 s; cancelable los primeros 15 s. Los pedidos `seeded: true` salen como entregados. Para cambiar el ritmo de la demo toca solo `DEMO_TIMELINE`. El tiempo de cada pedido pasa por `orderClock()`: multiplicador global `useDemo.fastClock` + adelanto propio `order.clockOffsetMs` (`useOrders.fastForward`).
- `carrito.tsx` es una ruta modal transparente; en iOS monta su propio `ToastHost` para que los toasts queden sobre el modal.

## Lo que NO existe todavía (no asumas que está)

Backend/API, autenticación real, pasarela de pago, GPS real del repartidor (la moto se simula sobre una ruta real), geocodificación en tiempo real, notificaciones push, tests, CI, `eas.json`, variables de entorno. La app corre en **Expo Go** sin módulos nativos propios; si agregas uno con código nativo, necesitarás development build (ver AGENTS.md).

## Flujo de trabajo sugerido

1. Antes de tocar APIs de Expo/RN, confirma versión en `package.json` y consulta docs de SDK 58 (`https://docs.expo.dev/versions/v58.0.0/`); no confíes en memoria.
2. Para una pantalla nueva o rediseño, mira primero el diseño en `stitch_app_delivery_tambo/<pantalla>/screen.png` y `code.html`, y reutiliza componentes de `src/components/` antes de crear otros.
3. Datos de prueba para verificar a mano (cupones `TAMBOAPP`, `TAMBOYA10`, `ENVIOGRATIS`, comportamiento de la simulación, productos con alcohol): ver [README.md](README.md).
4. Cierra con `npm run typecheck` y `npm run lint`. Si el cambio es visual, levanta `npx expo start --web` y revísalo.
5. No hagas commit/push salvo que se pida. Historial actual: `Initial commit`, `1ra iteración - 29/10`.
