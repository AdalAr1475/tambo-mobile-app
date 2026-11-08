# Iteración 6 · Geo real: telemetría, SafeDrop, cobertura y "Cómo llegar"

**Tickets:** T07 (telemetría + SafeDrop), T06 (mapa de tiendas con cobertura), T08 (ruta peatonal + "Cómo llegar")
**Objetivo:** reemplazar el mapa estilizado por **calles reales de Lima** (OpenStreetMap + Leaflet), con la moto avanzando sobre una ruta real, la **entrega confirmada con QR/PIN** (SafeDrop), el selector de tiendas sobre el mapa con radio de cobertura y la navegación a pie para el retiro.
**Por qué después del corte:** es la iteración más cara y la única que depende de internet. El seguimiento ya tiene un mapa animado funcional (ver [roadmap](../02-roadmap.md#por-qué-el-geo-queda-detrás-del-corte-si-el-docente-lo-pidió)).
**Esfuerzo:** L · **Dependencias nuevas:** `react-native-webview` y `expo-location` · **Requiere:** It3 (`token.ts`, `<QrCode>`, `verifiedAt`, reloj por pedido).

Orden interno: `6.1 base geo → 6.2 T07 → 6.3 T08 → 6.4 T06`. T07 va primero porque es el mayor "wow". T08 y T06 reutilizan todo lo de 6.1.

---

## 6.1 · Base geográfica y `SmartMap`

**Datos**

- `LatLng = { lat: number; lng: number }`.
- `Store.coords` en las tiendas actuales. Se suman sedes para que el mapa no se vea vacío y cubra lo que pidió el equipo: Los Olivos, San Isidro, Miraflores (×2), Magdalena, Surco, Lince y Jesús María, cada una con `lockers`.
  - Las coordenadas se toman **una sola vez** de OpenStreetMap (buscando la dirección en openstreetmap.org) y se escriben en `src/data/stores.ts`.
  - **No se inventan coordenadas**: si una sede no existe en la realidad, se marca como "sede demo" en un comentario.
- `Address.coords` en las direcciones semilla. `districtCentroids` sirve de respaldo para las direcciones creadas con `AddressForm` (centroide del distrito + un pequeño desplazamiento determinista).
- **Ubicación de demo:** una coordenada fija en Miraflores, configurable en `/demo`.
- **Rutas precalculadas** (`src/data/routes.ts`), generadas por el script `scripts/build-routes.mjs` (Node, se corre a mano una vez):
  - consulta el servidor OSRM público de FOSSGIS (`routing.openstreetmap.de`, perfiles *car* y *foot*; verificar su URL y su uso aceptable antes de correrlo);
  - recorre los pares tienda → dirección semilla y tienda → ubicación demo;
  - guarda polilíneas simplificadas (~30-60 puntos), distancia y duración.
  - **En tiempo de ejecución no se llama a ninguna API de ruteo.** Si falta un par, se usa una polilínea en "L" generada por `geo.ts`.

**`src/lib/geo.ts`:** `haversine(a, b)`, `polylineLength(pts)`, `pointAlong(pts, t)` (posición y rumbo), `remainingMeters(pts, t)`, `walkingMinutes(m)` (75 m por min) y `lShapeRoute(a, b)`.

**`src/lib/useUserLocation.ts`:**

- Si la demo usa una ubicación fija → la devuelve.
- Si no:
  1. pide permiso con `expo-location` (`requestForegroundPermissionsAsync`, revisar la API en la documentación de SDK 58);
  2. obtiene la posición actual;
  3. si está a más de 15 km de toda tienda, o se negó el permiso → ubicación de demo con la etiqueta "Ubicación aproximada".

**`src/components/map/LeafletMap.tsx`:**

- `WebView` con HTML inline. Carga Leaflet desde CDN **con versión fija** (por ejemplo, `leaflet@1.9.4` de unpkg) y tiles de CARTO *light*.
- Muestra la **atribución OSM/CARTO visible**.
- Props declarativas: `center`, `zoom`, `markers[]` (`kind: 'store' | 'user' | 'home' | 'rider'`), `polylines[]` (`style: 'route' | 'walk' | 'travelled'`), `circles[]`, `interactive` y `fitBounds`.
- **Puente RN → web:** `injectJavaScript(window.update(json))` para cambiar marcadores y rutas sin recargar. La moto se mueve con interpolación dentro de la página (requestAnimationFrame), así se ve fluida aunque se actualice cada 1 s.
- **Puente web → RN:** `onMessage` para avisar `tilesloaded`, `markerPress:{id}` y `error`.
- Marcadores `divIcon` con los colores del tema (berry para las tiendas, azul pulsante para el usuario, moto con rumbo).

**`src/components/map/SmartMap.tsx`:**

- Elige el mapa según dos condiciones:
  - Plataforma web → `TrackingMap` (SVG). Un `iframe` es una mejora opcional.
  - En el teléfono → `LeafletMap`, con un *timeout* de 5 s esperando `tilesloaded`. Si no llega o hay error → `TrackingMap` y el chip "Mapa sin conexión".
- `TrackingMap` se mantiene intacto como respaldo.

---

## 6.2 · T07 · Telemetría en vivo + SafeDrop

**Telemetría**

- `route = routes[storeId→addressId]`. En la fase *en camino*: `progress = (t − onTheWay) / (delivered − onTheWay)`, con `t` tomado de `getOrderStatus`.
- Se muestra:
  - la moto en `pointAlong(route, progress)`;
  - el tramo recorrido sólido y el que falta punteado;
  - una píldora `🛵 Carlos · a 850 m · 3 min`, con el ETA = metros restantes / velocidad (moto a 25 km/h, escalada al reloj de demo).
- **Pantalla completa:** "Ver rastreo en vivo" abre el mapa a pantalla completa, con una tarjeta inferior del repartidor y llamar/chat (ya existen).
- **"▶️ Simular recorrido GPS rápido (15 s)"** (`<DemoOnly>`): pone el pedido en el inicio de *en camino* y acelera **solo ese pedido** para que el tramo dure unos 15 s.
  - Se extiende el reloj por pedido: `simClock?: { at: number; t: number; rate: number }` → `t = simClock.t + (now − simClock.at) × rate`.
  - `useOrders.simulate(id, { t, rate })` reemplaza a `fastForward` (que queda como un caso particular).

**SafeDrop**

- `orderProgress` (delivery): al llegar a `delivered`, el estado **ya no es "Entregado"**. Pasa a `arrived`: "Tu repartidor llegó · muestra tu código" (paso 3 con `progress: 1`). Solo con `verifiedAt` es "Entregado con éxito". Ver [arquitectura §5](../03-arquitectura.md#5-estado-del-pedido-reloj-por-pedido).
- **Tarjeta "Seguridad de entrega · Tambo SafeDrop":**
  - aparece cuando faltan menos de 50 m (`remainingMeters < 50`) o en `arrived`;
  - muestra el QR dinámico (`token.ts`, el mismo de It3) y el **PIN de 4 dígitos** grande, más la línea "Solo así se marca como entregado";
  - en `<DemoOnly>`, **"📷 Simular escaneo del motorizado"**: una animación de lectura, `verifyToken` real, el check verde a pantalla completa y `verify(id)`. El paso 4 pasa a "Entregado con éxito" y aparece el RateCard.
- **Opcional:** handshake con un segundo dispositivo, igual que en It3, usando la ruta `/repartidor` en la laptop.
- **Migración `useOrders` v3:** los pedidos delivery no semilla que ya pasaron `delivered` reciben `verifiedAt`, para que no queden en `arrived` para siempre.

---

## 6.3 · T08 · Seguimiento "Para llevar" con ruta peatonal

- `SmartMap` con la tienda y el usuario (`useUserLocation`), la ruta **a pie punteada** (`routes` *foot*, o una L) y `fitBounds`.
- Píldora sobre el mapa: `🚶 A 450 m de ti · 6 min caminando`.
- Botón **"📍 Cómo llegar"** en la esquina del mapa, que abre un `Sheet` con:
  - indicaciones simples: si la ruta precalculada trae pasos se usan; si no, "Camina 450 m hacia el sur por Av. Larco" a partir del rumbo y la distancia;
  - **"Abrir en Google Maps"**: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=walking`;
  - **"Abrir en Waze"**: `https://waze.com/ul?ll={lat},{lng}&navigate=yes`;
  - ambos con `Linking.openURL`.
- Se integra con el panel de locker de It3: el mapa arriba y el panel abajo.

---

## 6.4 · T06 · Selector de tiendas sobre el mapa con cobertura

En `DeliveryPointSheet`, pestaña Para llevar:

- **Mapa de unos 220 px:**
  - el pin azul pulsante del usuario;
  - un **círculo morado translúcido de 1.5 km** (cobertura inmediata);
  - los pines de las tiendas con un mini badge `🔒 4`.
  - Tocar un pin selecciona la tienda y resalta su tarjeta.
- **Lista ordenada por `haversine` real:**
  - la distancia calculada reemplaza a `distanceKm` fijo;
  - badge `🔒 Smart Locker · 4 libres` o `Sin casilleros`;
  - las tiendas fuera de los 1.5 km llevan la etiqueta "Más lejos" sin bloquearlas.
- **Pestaña Delivery:** cada dirección muestra la tienda que la atiende (la más cercana) y, si está a más de 4 km, el aviso "Fuera de cobertura delivery".
- **Checkout:** el mapa estático `map-lima.jpg` pasa a ser un `SmartMap` no interactivo de 120 px con el pin de la dirección.

---

## Criterios de aceptación

- [ ] Con internet, el seguimiento delivery muestra calles reales, la ruta tienda → casa y la moto moviéndose suavemente. Con "Simular recorrido" llega en unos 15 s.
- [ ] Los metros restantes y el ETA bajan de forma coherente. Bajo 50 m aparece SafeDrop con QR (cambia cada 30 s) y PIN.
- [ ] "Simular escaneo del motorizado" completa el pedido. **Sin** escaneo, el pedido queda en "Tu repartidor llegó" y no se completa por tiempo.
- [ ] En pickup: el mapa con usuario y tienda, la ruta a pie, la píldora de distancia y tiempo, y "Cómo llegar" abre Google Maps con el destino correcto.
- [ ] El selector de tiendas muestra el mapa con el círculo de 1.5 km y las tiendas ordenadas por distancia real, con casilleros libres.
- [ ] **Modo avión:** en 5 s aparece el mapa SVG con el chip "Mapa sin conexión" y el resto del flujo (SafeDrop incluido) funciona.
- [ ] Al negar el permiso de ubicación se usa la ubicación de demo sin errores.
- [ ] En web, todo abre con el mapa SVG y sin errores.

## Prompt para el agente

```
Iteración 6 de docs/iteraciones/it-06-geo-telemetria.md (T07, T08, T06). Haz los sub-tickets en orden
6.1 → 6.2 → 6.3 → 6.4 y detente después de cada uno para que lo pruebe en Expo Go.
Antes de codificar, lee en https://docs.expo.dev/versions/v58.0.0/ las páginas de react-native-webview
y expo-location; instala con `npx expo install react-native-webview expo-location`.
6.1) Tipos LatLng, Store.coords, Address.coords, districtCentroids; script scripts/build-routes.mjs
     (Node, fetch a routing.openstreetmap.de, escribe src/data/routes.ts); src/lib/geo.ts;
     src/lib/useUserLocation.ts; src/components/map/LeafletMap.tsx (WebView + Leaflet con versión
     fija desde CDN, tiles CARTO light con atribución, API declarativa, puente injectJavaScript /
     onMessage, interpolación de la moto con requestAnimationFrame) y SmartMap.tsx (fallback a
     TrackingMap en web, en error o si no llega 'tilesloaded' en 5 s). NO inventes coordenadas:
     déjame placeholders marcados TODO si no puedes verificarlas.
6.2) Telemetría en seguimiento delivery + pantalla completa; simClock por pedido y
     useOrders.simulate(); fase 'arrived' y verifiedAt para delivery en orderProgress (useOrders
     version 3 con migrate); tarjeta SafeDrop con <QrCode> y token.ts de It3; "Simular recorrido" y
     "Simular escaneo del motorizado" en <DemoOnly>.
6.3) Seguimiento pickup: ruta a pie, píldora, Sheet "Cómo llegar" con enlaces a Google Maps/Waze.
6.4) DeliveryPointSheet: mapa con cobertura de 1.5 km, pines con casilleros, lista ordenada por
     haversine; aviso de cobertura en delivery; mini-mapa en checkout en lugar de map-lima.jpg.
Typecheck + lint en cada paso.
```
