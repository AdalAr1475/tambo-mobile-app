# Iteración 3 · Tambo Smart Lockers (IoT + QR dinámico)

**Ticket:** T09 (y crea la infraestructura QR que usa SafeDrop en It6)
**Objetivo:** el retiro en tienda deja de depender de que el usuario diga "Ya recogí". El pedido queda en un **casillero inteligente climatizado**. El usuario muestra un **QR dinámico** que cambia cada 30 s, el tótem lo valida y la puerta se abre: el retiro queda **verificado por el sistema**.
**Valor de negocio:** cero colas en caja, menos personal en el mostrador, retiro 24/7 y trazabilidad (prueba de retiro). **Disrupción:** IoT + phygital, la estrella del docente.
**Esfuerzo:** M · **Dependencias nuevas:** `expo-crypto`, una librería de QR en JS puro y, opcionalmente, `expo-camera`.

## Estado actual

- "Ya recogí mi pedido" ([seguimiento/[id].tsx:201-218](../../src/app/pedido/seguimiento/%5Bid%5D.tsx#L201)) llama a `complete()`. Sin ese toque, el pedido pickup queda para siempre en "Listo para recoger".
- Las tiendas no tienen casilleros. El checkout no distingue cómo se retira el pedido.

## Diseño funcional

1. **Checkout (pickup):** método de retiro con dos opciones.
   - `⚡ Tambo Smart Locker · Retiro autónomo con QR, sin colas`: opción por defecto si `store.lockers.free > 0`. Badge `4 libres`.
   - `🧑‍💼 Mostrador express`.
2. **Asignación** (`src/lib/lockers.ts`, determinista por `order.id`):
   - **Zona** según el contenido:
     - con bebidas frías o lácteos → `cold` (4.2 °C ± 0.3);
     - con cafetería o comida lista → `hot` (58-62 °C);
     - sin ninguna de las anteriores → `ambient`.
   - **Pedido mixto** (frío + caliente): se asignan **dos compartimentos contiguos** (`B04` frío + `B05` térmico) y se muestran los dos. Es un detalle que luce mucho en la demo.
   - **Código:** columna `A`-`C` + fila `01`-`12`.
   - **Reserva:** 45 min desde que el pedido está listo, coherente con la garantía de It1.
3. **Seguimiento (pickup + locker)**, con la fase "listo":
   - **Panel "Tambo Smart Locker":**
     - número de casillero grande;
     - telemetría en vivo (`❄️ Cámara fría 4.2 °C` con un *sparkline* de los últimos 10 valores);
     - estado de la puerta `🔒 Cerrado`;
     - temporizador "Guardado hasta 4:45 PM";
     - la tienda.
   - **QR dinámico:** `token = sha256(orderId│pin│floor(now/30s))` truncado. Se redibuja cada 30 s con un anillo de progreso que muestra cuánto falta para el cambio. Abajo, el PIN de 4 dígitos como respaldo.
   - **CTA "Abrir casillero"**, que abre `/locker/[id]` (el tótem).
   - Se **elimina** "Ya recogí mi pedido".
   - Antes de que esté listo: "Te asignaremos un casillero cuando tu pedido esté listo".
4. **Simulador del tótem** (`/locker/[id]`, modal a pantalla completa, para mostrarlo en el proyector):
   - Mitad superior: una **cuadrícula de 3 × 12 casilleros**, con los ocupados en gris y el del pedido **parpadeando en morado y dorado**. Cada casillero muestra su temperatura.
   - Mitad inferior: el lector. El botón **"📲 Escanear QR en el casillero"** dispara:
     1. una línea láser animada recorre el QR (Reanimated);
     2. `verifyToken()` corre de verdad: no es un `setTimeout` vacío. Si el token venció, se muestra error.
     3. la puerta del casillero se abre en la cuadrícula: `🔓 Casillero #B04 abierto`;
     4. a los 1.5 s, el sensor de peso marca *"Sensor de peso detectó retiro de bolsa"* y la puerta se cierra;
     5. `useOrders.verify(id)` marca `verifiedAt`. El paso 4 del pedido pasa a **"Recogido y verificado por IoT"** y se dispara haptic `success`.
   - Este botón **no** va dentro de `<DemoOnly>`: es la simulación del dispositivo físico y forma parte de la experiencia.
5. **Mostrador express:** el código grande + un QR (mismo token) con "Muéstralo en caja". En `<DemoOnly>`: "Simular escaneo en caja", que hace la misma verificación.

### Mejora opcional: escaneo real con un segundo dispositivo

Para que el docente vea un **escaneo con cámara de verdad**, sin backend:

- **Ruta `/locker/totem`**, abierta en la laptop (web) o en un segundo teléfono: el presentador escribe el código del pedido (`TB-45625`) y su PIN, y la pantalla muestra el QR que *el tótem espera*.
- En el teléfono del cliente, "Abrir casillero" abre la cámara (`expo-camera`, `CameraView` con `barcodeScannerSettings: { barcodeTypes: ['qr'] }`), escanea el QR del tótem y lo valida localmente con `verifyToken`. Luego sigue el mismo flujo de apertura.
- Es **un handshake real entre dos dispositivos** sin servidor, porque ambos derivan el token de los mismos datos.
- Plan B: si la cámara falla, se usa el botón de simulación.

## Modelo y estado

- `Store.lockers = { total, free }` en las 4 tiendas. Por ejemplo, Aliaga `{ total: 36, free: 4 }`.
- `Order`: `pickupMethod`, `locker` (o `lockers[]` para pedidos mixtos), `pin`, `verifiedAt`. Ver [arquitectura §3](../03-arquitectura.md#3-modelo-de-datos).
- `orderProgress.ts`, para pickup:
  - completado ⇔ `seeded || verifiedAt || completedAt` (por compatibilidad);
  - el paso 4 se titula "Recogido y verificado" cuando hay `verifiedAt`;
  - un locker expirado (más de 45 min sin retirar) muestra "Reserva vencida · acércate a caja".
- `useOrders` v2: `verify(id)`. La `migrate` copia `completedAt` → `verifiedAt` en los pedidos pickup.
- **Componente reutilizable `<QrCode value size />`** (`src/components/qr.tsx`): matriz con `qrcode-generator` dibujada con `react-native-svg`. El logo de Tambo+ va al centro con corrección de errores H.

## Criterios de aceptación

- [ ] El checkout pickup muestra Locker (por defecto) y Mostrador. La boleta dice "Retiro: Smart Locker #B04".
- [ ] Al estar listo aparece el panel con casillero, temperatura que varía, temporizador y un QR que **cambia cada 30 s**.
- [ ] En el tótem, escanear abre la puerta, registra el retiro y el pedido queda completado **sin** que exista "Ya recogí".
- [ ] Un pedido con café y gaseosa muestra **dos compartimentos** (frío y térmico).
- [ ] Desde `/demo` se puede adelantar el pedido a "listo" en 1 toque (`fastForward`).
- [ ] Los pedidos pickup antiguos (con `completedAt`) siguen apareciendo como recogidos.

## Prompt para el agente

```
Iteración 3 de docs/iteraciones/it-03-smart-lockers.md (T09). Lee docs/03-arquitectura.md §3, §5, §7 y §8.
Antes de usar APIs, consulta https://docs.expo.dev/versions/v58.0.0/sdk/crypto/ (y /sdk/camera/ si
haces la mejora opcional). Instala con `npx expo install expo-crypto` y `npm i qrcode-generator`
(JS puro; verifica que tenga tipos o declara un módulo .d.ts mínimo).
1) src/components/qr.tsx: <QrCode value size logo? /> dibujado con react-native-svg.
2) src/lib/token.ts (dynamicToken/verifyToken, ventana de 30 s, acepta la actual y la anterior) y
   src/lib/lockers.ts (assignLocker determinista por order.id con zonas por categoría,
   compartimentos dobles para pedidos mixtos, y el hook useLockerTelemetry con oscilación ±0.3 °C).
3) Modelo: Store.lockers en src/data/stores.ts; Order.pickupMethod/locker(s)/pin/verifiedAt;
   useOrders version 2 con verify(id) y migrate completedAt→verifiedAt en pickup; actualiza
   getOrderStatus (pickup completado con verifiedAt; título del paso 4; reserva vencida a los 45 min).
4) Checkout pickup: RadioCard Locker (por defecto si hay libres) / Mostrador; pásalo a placeOrder.
5) Seguimiento pickup: panel Smart Locker + QR dinámico + PIN + temporizador; CTA "Abrir casillero"
   → nueva ruta modal src/app/locker/[id].tsx (tótem: cuadrícula 3×12, casillero parpadeando, láser
   animado con Reanimated, verifyToken real, apertura, sensor de peso, verify(id), haptic.success).
   ELIMINA "Ya recogí mi pedido". Mostrador: QR + código + "Simular escaneo en caja" en <DemoOnly>.
6) Agrega a /demo "Adelantar a listo" para el pedido pickup activo.
Copy de docs/04-ux-ui.md. Typecheck + lint. (Opcional, aparte: /locker/totem + escaneo con
expo-camera según la sección "Mejora opcional".)
```

## Checklist de cierre

- [ ] Los criterios de aceptación.
- [ ] Ensayar el paso 5 del [guion](../05-guion-demo.md) con un pedido pickup creado desde `/demo`.
- [ ] Regresión de It1 e It2: canje + pickup + locker en el mismo pedido.
