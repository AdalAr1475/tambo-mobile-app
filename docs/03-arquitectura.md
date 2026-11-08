# 03 · Arquitectura

La arquitectura actual (Expo Router + zustand persistido + estado de pedido **derivado** del reloj) es sólida y **se conserva**. Este documento define qué se agrega y dónde, para que cada iteración encaje sin reescrituras.

Las reglas de [CLAUDE.md](../CLAUDE.md) siguen vigentes:

- importar con `@/…`;
- `StyleSheet` + tokens del tema;
- `Txt`, `Tap` y `Button`;
- calcular precios solo con `@/lib/pricing`;
- instalar con `npx expo install`;
- no tocar `ios/` ni `android/`.

## 1. Mapa de módulos (actual → objetivo)

```
src/
  app/
    (tabs)/index.tsx            Home: píldora de contexto + puntos (It1/2), "Para ti" IA (It4), rutinas (It5)
    carrito.tsx                 upsell IA (It4), canje con puntos (It2)
    checkout.tsx                sin toggle (It1), Yape OTP (It1), slots de 20 min (It1), locker/mostrador (It3),
                                Auto-Pilot (It5), Party Split (It8)
    pedido/seguimiento/[id].tsx CTAs por estado (It1), panel locker (It3), Leaflet + SafeDrop (It6)
    puntos.tsx                  NUEVO (It2): billetera, ledger, zona de canje
    rutinas/index.tsx           NUEVO (It5): mis rutinas
    rutinas/[id].tsx            NUEVO (It5): crear/editar rutina
    ia/plan.tsx                 NUEVO (It4): "Arma tu plan"
    locker/[id].tsx             NUEVO (It3): simulador de tótem (modal)
    visor/[id].tsx              NUEVO (It7): visor 3D / AR (modal a pantalla completa)
    demo.tsx                    NUEVO (It1): Modo Presentador
  components/
    map/LeafletMap.tsx          NUEVO (It6): WebView + Leaflet (OSM)
    map/SmartMap.tsx            NUEVO (It6): elige LeafletMap o TrackingMap (fallback SVG)
    qr.tsx                      NUEVO (It3): <QrCode value size />
    otp.tsx                     NUEVO (It1): <OtpInput length={6} />
    points.tsx                  NUEVO (It2): <PointsPill />, <RedeemSheet />
    locker.tsx                  NUEVO (It3): panel del locker, cuadrícula del tótem
    ai.tsx                      NUEVO (It4): tarjetas "Para ti" y upsell
    routines.tsx                NUEVO (It5): tarjeta de rutina, selector de días
    DemoOnly.tsx                NUEVO (It1): renderiza sus hijos solo con el Modo Presentador activo
  lib/
    placeOrder.ts               NUEVO (It1): transacción única de cierre (checkout, Auto-Pilot)
    useReorder.ts               NUEVO (It1): volver a pedir con confirmación
    useAddManyToCart.ts         NUEVO (It4): agregar varios productos con el age gate
    slots.ts                    NUEVO (It1): slots dinámicos
    points.ts                   NUEVO (It2): reglas de acumulación y canje (constantes + helpers puros)
    token.ts                    NUEVO (It3): QR dinámico (hash de pedido + PIN + ventana de 30 s)
    lockers.ts                  NUEVO (It3): asignación de casillero y "telemetría" simulada
    recommender.ts              NUEVO (It4): motor de recomendación local
    routines.ts                 NUEVO (It5): próxima ejecución, disparo
    geo.ts                      NUEVO (It6): haversine, interpolación de polilínea, ETA
    split.ts                    NUEVO (It8): reparto de montos con round2
    pricing.ts                  EXTENDER: canje con puntos (It2), beneficio Auto-Pilot (It5)
    orderProgress.ts            EXTENDER: reloj por pedido, locker, SafeDrop
  store/
    cart.ts                     EXTENDER: CartItem.redeem (It2)
    session.ts                  EXTENDER: se va `points` (pasa a wallet); campo coords en Address (It6)
    orders.ts                   EXTENDER: clockOffset por pedido, campos nuevos en Order
    wallet.ts                   NUEVO (It2): saldo + ledger  [persistido]
    routines.ts                 NUEVO (It5): rutinas         [persistido]
    demo.ts                     NUEVO (It1): Modo Presentador [persistido]
  data/
    stores.ts                   EXTENDER: coords, lockers por tienda, más sedes (It3/It6)
    rewards.ts                  NUEVO (It2): catálogo de canje (reemplaza REWARDS de perfil.tsx)
    routes.ts                   NUEVO (It6): polilíneas precalculadas tienda→dirección
    models3d.ts                 NUEVO (It7): descripción procedural de modelos 3D
```

## 2. Transacción de cierre: `placeOrder()`

Hoy la lógica de cierre vive dentro de `confirm` en [checkout.tsx:122-188](../src/app/checkout.tsx#L122). Auto-Pilot (It5) necesita crear pedidos **sin** esa pantalla, y el canje de puntos (It2) agrega pasos. Por eso se extrae a `src/lib/placeOrder.ts`:

```ts
type PlaceOrderInput = {
  lines: CartLine[];                // con modo de canje si aplica
  fulfillment: Fulfillment;
  storeId: string;
  address?: Address;
  schedule: Order['schedule'];
  payment: Order['payment'];
  couponCode?: string;
  pickupMethod?: 'locker' | 'counter';  // It3
  routineId?: string;                    // It5
  split?: SplitInfo;                     // It8
  clearCart?: boolean;                   // true desde el checkout, false desde Auto-Pilot
};

export function placeOrder(input: PlaceOrderInput): Order {
  // 1. totals = computeTotals(...)          ← única fuente de verdad de montos
  // 2. order  = { ...campos, pointsEarned, pointsRedeemed, locker?, safeDrop? }
  // 3. useOrders.getState().place(order)
  // 4. useWallet.getState().apply([...earn, ...redeem], order.id)   (It2)
  // 5. useSession.getState().markCouponUsed(couponCode)
  // 6. if (clearCart) useCart.getState().clear()
  // 7. return order
}
```

Su inversa es `cancelOrder(id)`: llama a `cancel()`, revierte los puntos ganados y canjeados (ledger) y libera el cupón.

> Usa `getState()` en lugar de hooks: es lógica de dominio llamable desde cualquier lugar, igual que ya hace `AgeGateHost`.

## 3. Modelo de datos

### `Order` ([types.ts:105-122](../src/data/types.ts#L105)): campos nuevos, **todos opcionales**

Que sean opcionales mantiene compatibles los pedidos semilla y los ya persistidos.

```ts
type Order = {
  // ...existentes
  pointsEarned?: number;            // It2
  pointsRedeemed?: number;          // It2
  pickupMethod?: 'locker' | 'counter';                                   // It3
  locker?: { code: string; zone: 'cold' | 'hot' | 'ambient'; tempC: number; holdMin: number }; // It3
  pin?: string;                     // It3/It6: 4 dígitos, base del QR dinámico
  clockOffsetMs?: number;           // reloj por pedido (ver §5)
  verifiedAt?: number;              // It3/It6: retiro o entrega verificados por QR
  routineId?: string;               // It5
  split?: { parts: { name: string; amount: number; paidAt?: number }[] }; // It8
};
```

`payment.method` suma `'points'` cuando el total en soles es S/ 0.00 (It2). `payment.label` deja de decir "QR": pasa a `'Yape · Código de aprobación'` (It1).

### `CartItem` ([cart.ts:9](../src/store/cart.ts#L9))

```ts
type CartItem = { productId: string; qty: number; redeem?: 'points' | 'mixed' };   // It2
```

Un mismo producto puede aparecer dos veces: una línea normal y una de canje. La identidad de la línea pasa a ser `productId + redeem`. Hay que actualizar `add`, `setQty`, `remove` y `useCartQty` para usar esa clave.

### `Store` ([types.ts:47-54](../src/data/types.ts#L47))

```ts
type Store = { /* existentes */ coords?: LatLng; lockers?: { total: number; free: number }; hours?: string };
```

`distanceKm` se mantiene como respaldo. En It6 la distancia se calcula con `haversine(userCoords, store.coords)`.

### `Address`

Suma `coords?: LatLng` (It6). Las direcciones sin coordenadas, creadas con `AddressForm`, toman el centroide del distrito desde una tabla `districtCentroids` en `data/stores.ts`.

### `Product` ([types.ts:19-45](../src/data/types.ts#L19))

```ts
redeem?: { points?: number; mixed?: { points: number; cash: number } };  // It2: canje CMR
model3d?: string;                                                        // It7: id en data/models3d.ts
```

## 4. Stores nuevos y cambios en los existentes

| Store | Clave | Persistido | Estado | Iteración |
| --- | --- | :-: | --- | :-: |
| `useDemo` | `tambo-demo` | ✅ | `enabled`, `showSimulators`, `fastClock` (×1 / ×3), `demoLocation?` | 1 |
| `useWallet` | `tambo-wallet` | ✅ | `balance`, `ledger: { id, at, delta, kind: 'earn'│'redeem'│'revert'│'bonus'│'demo', orderId?, note }[]` | 2 |
| `useRoutines` | `tambo-routines` | ✅ | `routines: Routine[]` (ver it-05) | 5 |

- Cada store persistido nuevo **se agrega** al array `persisted` de [_layout.tsx:21](../src/app/_layout.tsx#L21).
- `useWallet` reemplaza a `useSession.points`. El nivel (Fan / Lover / Gold / Pro) se **deriva** del total histórico ganado (suma de los `earn` del ledger), no del saldo. Así canjear no te baja de nivel.

## 5. Estado del pedido: reloj por pedido

La regla de oro se mantiene: **el estado se deriva, no se guarda**. Se agregan dos cosas.

**a) `clockOffsetMs` por pedido.** `getOrderStatus(order, now)` pasa a usar `t = now + (order.clockOffsetMs ?? 0) - order.createdAt`. Con esto:

- "Simular avance GPS" o "Adelantar a listo" llaman a `useOrders.fastForward(id, ms)`, que solo suma al offset.
- El Modo Presentador puede acelerar un pedido concreto sin tocar `DEMO_TIMELINE`.

**b) Verificación explícita como fin del flujo.**

- **Pickup** (It3): el paso 4 se llama "Recogido y verificado por IoT" y se completa con `verifiedAt`, que se marca al escanear en el tótem. `completedAt` se conserva por compatibilidad: los pedidos viejos con `completedAt` cuentan como completados.
- **Delivery** (It6): al llegar a `DEMO_TIMELINE.delivered`, el estado ya no es "Entregado". Pasa a **"Tu repartidor llegó · muestra tu código SafeDrop"** (paso 3 con `progress: 1`). Solo con `verifiedAt` se marca "Entregado con éxito".
  - Para no romper los pedidos ya persistidos, la `migrate` de `useOrders` marca `verifiedAt = createdAt + delivered` en todos los pedidos delivery no semilla que ya pasaron ese tiempo.
  - Plan B si no hay It6: delivery sigue completándose por tiempo, como hoy.

`StepProgress` y `useActiveOrders` siguen funcionando sin cambios de forma.

## 6. Persistencia y migraciones

Hoy ningún `persist` tiene `version`. A partir de It1:

```ts
persist(creator, {
  name: 'tambo-session',
  storage: persistStorage,
  version: 1,
  migrate: (persisted, from) => {
    const s = persisted as any;
    if (from < 1) { /* transformar */ }
    return s;
  },
});
```

| Store | v1 (It1) | v2 | v3 |
| --- | --- | --- | --- |
| `useCart` | sin cambios (fija la base de versionado) | It2: `CartItem.redeem` (compatible, opcional) | — |
| `useSession` | sin cambios | It2: quitar `points` (lo inicializa `useWallet`) | It6: `coords` en las direcciones semilla |
| `useOrders` | sin cambios | It3: `completedAt` → `verifiedAt` en pickup | It6: `verifiedAt` en delivery pasados |

**"Reiniciar demo"** (Modo Presentador) es la red de seguridad:

1. Llama a `persist.clearStorage()` de cada store.
2. Restablece el estado inicial con `setState(initial, true)`.
3. Navega a `/`.

Se usa antes de cada ensayo y antes de la demo real.

## 7. Módulos de dominio (resumen; el detalle está en cada iteración)

| Módulo | Responsabilidad | Notas |
| --- | --- | --- |
| `slots.ts` | `buildSlots(now, fulfillment, store)` genera ventanas de 20 min (pickup) o 30 min (delivery) desde `ceil(now + prep, step)`, hasta el cierre, más la mañana siguiente. | Se recalcula con `useNow(60_000)`. Es puro y testeable. |
| `points.ts` | `EARN_PER_SOL = 10`, `POINT_VALUE_SOLES = 0.01`, `earnFor(total, opts)`, `levelFor(lifetime)` | Las constantes se ajustan en un solo lugar. |
| `pricing.ts` | `computeTotals(lines, fulfillment, coupon, opts?)` suma `pointsToRedeem` y `cashFromRedeem`. `opts.routine` aplica el 10 % y el envío gratis de Auto-Pilot. | **Nunca** calcular montos fuera de aquí. |
| `token.ts` | `dynamicToken(orderId, pin, now)` = hash de `orderId│pin│floor(now/30s)` en 8 caracteres. `verifyToken(...)` acepta la ventana actual y la anterior. | Usa `expo-crypto` (`digestStringAsync` SHA-256), incluido en Expo Go. Es **demostrativo, no seguridad real**. |
| `lockers.ts` | `assignLocker(order)`: la zona sale de las categorías (bebidas → frío 4 °C, cafetería/comida → térmico 58-62 °C, resto → ambiente). Genera el código `A01`-`C12`. `useLockerTelemetry(locker)` produce una temperatura que oscila ±0.3 °C. | Es determinista por `order.id` (siempre el mismo casillero). |
| `recommender.ts` | `forYou(orders, now)`, `upsell(cartLines)`, `buildPlan({budget, people, vibe})` | Ver it-04. Funciones puras con explicación ("porque…"). |
| `routines.ts` | `nextRun(routine, now)`, `runRoutine(routine)` → `placeOrder({ routineId, clearCart: false })` | Ver it-05. |
| `geo.ts` | `haversine`, `pointAlong(polyline, t)`, `remainingMeters`, `walkingMinutes(m)` | Ver it-06. |
| `split.ts` | `splitEqual(total, n)` reparte con `round2` y deja el residuo en el anfitrión. `splitByItems(...)` reparte por productos. | Ver it-08. |

## 8. Dependencias nuevas

**Siempre** se instalan con `npx expo install <pkg>`. Antes de usar su API, se lee la página correspondiente en `https://docs.expo.dev/versions/v58.0.0/`.

| Paquete | It. | ¿En Expo Go? | Web | Para qué |
| --- | :-: | :-: | :-: | --- |
| *(ninguna)* | 1, 2, 4, 5, 8 | — | — | Lógica pura + UI con lo que ya existe (`react-native-svg`, Reanimated) |
| `expo-crypto` | 3 | ✅ | ✅ | Hash del QR dinámico |
| Librería de QR (JS puro) | 3 | ✅ (JS) | ✅ | Matriz del QR. Opción preferida: `qrcode-generator` (sin dependencias) + render propio con `react-native-svg`. Alternativa: `react-native-qrcode-svg`. |
| `expo-camera` | 3 (opcional) / 7 | ✅ | parcial | Escaneo real de QR (`CameraView` + `barcodeScannerSettings`) y fondo de cámara para la AR ligera |
| `react-native-webview` | 6 | ✅ | ❌ (en web se usa `iframe` o se cae al SVG) | Leaflet + OSM |
| `expo-location` | 6 | ✅ | parcial | Ubicación real del usuario (permiso en primer plano) |
| `expo-gl` + `three` | 7 | ✅ (`expo-gl`) | ✅ (WebGL) | Visor 3D procedural. Requiere *spike* de compatibilidad. |
| `expo-sensors` | 7 (opcional) | ✅ | parcial | Inclinación del teléfono (parallax / anclaje simulado en AR) |

**Fuera de alcance en Expo Go:** AR con detección de planos (ARKit/ARCore, ViroReact), notificaciones push remotas y ejecución en segundo plano. Se documentan como "producción" en la exposición.

## 9. Compatibilidad Expo Go vs. web

- Los componentes con dependencias nativas o WebView tienen variante por plataforma: `LeafletMap.tsx` / `LeafletMap.web.tsx`, o un `Platform.OS === 'web'` que cae al fallback.
- En web, las funciones que necesitan cámara, GPS o WebGL muestran su versión "Simular…" y una nota: *"Disponible en la app móvil"*.
- `haptic` ya no hace nada en web. Las sombras se siguen aplicando con `elevation`.

## 10. Datos externos y atribución

- **Tiles de OpenStreetMap:** la atribución "© OpenStreetMap contributors" es **obligatoria** y va visible en el mapa. Para no abusar del servidor público de tiles (su política de uso pide volumen bajo), se usan los tiles de CARTO *light* (`basemaps.cartocdn.com`), también con atribución.
- **Rutas:** se **precalculan una sola vez** con OSRM público para las combinaciones semilla (tienda → dirección y tienda → usuario de demo) y se guardan en `src/data/routes.ts`. En la demo no se llama a ninguna API de ruteo. Si falta una ruta, se usa una polilínea "en L" (Manhattan) entre los dos puntos.
- **Coordenadas de tiendas y direcciones:** se obtienen una sola vez de OSM (Nominatim) y se escriben a mano en `data/stores.ts`. No se geocodifica en tiempo real.
