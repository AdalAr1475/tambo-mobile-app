# 01 · Diagnóstico: observaciones del equipo vs. código real

Cada observación del PDF se revisó contra el código (revisado el 2026-11-08, commit `f259707`). En varios casos **la causa real no es la que supone el PDF**. Implementar el prompt del PDF al pie de la letra no resolvería el problema, o duplicaría algo que ya existe.

Leyenda: ✅ el PDF acierta · ⚠️ acierta en parte o hay que matizar · ❌ la causa es otra.

## Resumen

| Ticket | Observación | Veredicto | Causa real |
| --- | --- | --- | --- |
| T01 | El carrito conserva los productos tras pagar | ❌ | El checkout **sí** vacía el carrito. Lo vuelve a llenar en silencio "Volver a pedir". |
| T02 | Switch Delivery/Para llevar triplicado | ⚠️ | El estado ya es único (`useSession.fulfillment`). Lo duplicado es **la UI**: 3 toggles visibles. |
| T03 | "¿Me obligas a volver a pedir?" | ✅ | En seguimiento, "Volver a pedir" es el único CTA cuando termina el pedido. La boleta lo muestra **siempre**. |
| T04 | Yape con QR desde el mismo celular | ⚠️ | No hay modal QR. Solo existe la etiqueta `'Yape (QR Aprobado)'` y un texto de "solicitud de pago". Falta el flujo OTP. |
| T05 | Bloques de 1 hora rígidos | ✅ | `buildSlots()` genera bloques fijos de 1 h y además 5 bloques fijos para mañana. |
| T06 | Tiendas fijas, sin mapa | ✅ | 4 tiendas sin coordenadas y una lista plana con `distanceKm` fijo. |
| T07 | Mapa de seguimiento estático | ⚠️ | No es una imagen: es un mapa **SVG estilizado** con la moto animada. Pero no tiene calles reales ni handshake de entrega. |
| T08 | El mapa de "Para llevar" solo muestra la tienda | ✅ | `TrackingMap` con `pickup` oculta la ruta y el destino. |
| T09 | "Ya recogí mi pedido" lo confirma el usuario | ✅ | Además, los pedidos *pickup* **nunca se completan solos**: dependen de ese botón. |
| T10 | AR / 3D | — | No existe nada. No hay `expo-gl`, `three` ni `expo-camera`. |
| T11 | Recomendaciones por historial | — | No existe. Sí hay insumos: `pairsWith` por producto, historial en `useOrders` y `promoTags`. |
| T12 | Party Split | — | No existe. |
| T13 | Los puntos no se guardan ni se pueden usar | ⚠️ | **Ya existen** `session.points` (450) y un sheet "Club Tambo Lover" con 4 canjes. Los puntos sí se guardan; lo que falta es el canje real en el carrito, el ledger y que la UI sea visible. |
| T14 | Pedidos recurrentes | — | No existe. Sí existen pedidos programados de una sola vez (`schedule.type = 'scheduled'`). |
| T15 | Productos sin foto + barra que tapa productos | ⚠️ | 19 de 38 productos no tienen foto. El padding de 112 px **ya existe**: hay que reproducir el caso de la captura. |

---

## T01 · Carrito "no se limpia" → la causa es "Volver a pedir"

**Lo que hace hoy el checkout** ([checkout.tsx:122-188](../src/app/checkout.tsx#L122)):

```ts
place(order);                                          // L181
session.addPoints(Math.floor(totals.total));           // L182
...
router.replace(`/pedido/confirmado/${order.id}`);      // L186
clearCart();                                           // L187 → items: [], couponCode: undefined
```

Por lo tanto, el carrito **se vacía** al confirmar.

**La secuencia que reproduce lo que vio el equipo** (encaja con la Figura 1, donde "Tu último pedido" coincide con los 3 ítems del carrito):

1. El usuario confirma y la app abre *Pedido confirmado*. Desde ahí va a *Seguir mi pedido*.
2. A los 75 s el delivery pasa a **completado** ([orderProgress.ts:75](../src/lib/orderProgress.ts#L75)). El único botón principal pasa a ser **"Volver a pedir"** ([seguimiento/[id].tsx:382-384](../src/app/pedido/seguimiento/%5Bid%5D.tsx#L382)).
3. El usuario lo toca creyendo que es el paso siguiente (justo la queja de T03). El botón ejecuta `useCart.replace(items)` y navega a `/carrito` ([seguimiento/[id].tsx:87-92](../src/app/pedido/seguimiento/%5Bid%5D.tsx#L87)).
4. Cierra el carrito y vuelve a Inicio. El badge marca 3 y aparece la barra "Ver pedido actual".

El mismo efecto silencioso ocurre en otros tres lugares:

- El botón ⟲ de "Tu último pedido" en Home ([index.tsx:243-286](../src/app/(tabs)/index.tsx#L243)).
- La boleta ([pedido/[id].tsx:45-50 y 183](../src/app/pedido/%5Bid%5D.tsx#L183)).
- El historial ([ordenes.tsx:303-310](../src/app/(tabs)/ordenes.tsx#L303)).

Problemas adicionales:

- `replace()` **pisa** lo que hubiera en el carrito sin preguntar.
- `replace()` **no limpia el cupón** ([cart.ts:56](../src/store/cart.ts#L56)), así que un cupón viejo puede quedar aplicado al re-pedido.
- La transacción de cierre está **dentro del componente** del checkout y no es reutilizable. Auto-Pilot (T14) necesitará crear pedidos sin pasar por esa pantalla.

**Conclusión:** T01 y T03 se resuelven juntos.

1. Primero se reproduce el caso en Expo Go.
2. Un hook único `useReorder()` pide confirmación si el carrito no está vacío (*Reemplazar / Agregar / Cancelar*) y limpia el cupón.
3. Se reordenan los CTAs del seguimiento.
4. La transacción de cierre se extrae a una función `placeOrder()`.

Los criterios de aceptación del PDF (badge y barra ocultos con carrito vacío) **ya se cumplen**: `FloatingCartBar` devuelve `null` con `count === 0` ([FloatingCartBar.tsx:15](../src/components/FloatingCartBar.tsx#L15)), y el badge sale de `useCartCount()`.

## T02 · Selector de modalidad

- **Estado:** hay uno solo, `useSession.fulfillment` ([session.ts:21](../src/store/session.ts#L21)). No hace falta "unificar estado".
- **UI duplicada:**
  1. `LocationHeader`, en Home y Descuentos ([delivery.tsx:301](../src/components/delivery.tsx#L301)).
  2. `DeliveryPointSheet`, el sheet "¿Cómo quieres tu pedido?" ([delivery.tsx:132](../src/components/delivery.tsx#L132)), al que se entra desde el carrito.
  3. El checkout ([checkout.tsx:207](../src/app/checkout.tsx#L207)).
- El carrito ([carrito.tsx:100-135](../src/app/carrito.tsx#L100)) **no tiene toggle propio**: su tarjeta "Punto de entrega" abre el sheet. La Figura 2C muestra justo ese sheet.
- En Home, cambiar la modalidad cambia la cabecera y la franja de ETA, pero no el catálogo. Por eso el toggle grande del Home no aporta.

**Conclusión:** el sheet `DeliveryPointSheet` queda como **único lugar** donde se elige la modalidad. En Home se muestra una píldora compacta de contexto que abre el sheet. En el checkout se quita el toggle y se deja "Cambiar modalidad", que abre el mismo sheet.

## T03 · Navegación post-compra

- `pedido/confirmado/[id]` **ya está bien**: tiene "Seguir mi pedido" e "Ir al Inicio" ([confirmado/[id].tsx:218-230](../src/app/pedido/confirmado/%5Bid%5D.tsx#L218)).
- Seguimiento:
  - Mientras el pedido está activo, solo hay "Compartir seguimiento" y "Cancelar".
  - **No hay "Volver al inicio"**. Solo está la flecha atrás, que con `router.replace` puede llevar a un lugar inesperado.
  - Al completar, "Volver a pedir" queda como CTA morado principal, junto con `RateCard`.
- La boleta ([pedido/[id].tsx:183](../src/app/pedido/%5Bid%5D.tsx#L183)) muestra "Volver a pedir" **incluso con el pedido en curso**.
- El badge "Sumaste puntos Tambo Lover con esta compra" ([seguimiento/[id].tsx:455](../src/app/pedido/seguimiento/%5Bid%5D.tsx#L455)) es texto fijo: no dice cuántos puntos se sumaron, y también aparece en los pedidos semilla.

## T04 · Yape

- Hoy, la opción Yape/Plin solo muestra: *"Al confirmar te llegará una solicitud de pago a tu app Yape"* ([checkout.tsx:363](../src/app/checkout.tsx#L363)).
- La etiqueta guardada en el pedido es `'Yape (QR Aprobado)'` ([checkout.tsx:136](../src/app/checkout.tsx#L136)) y se ve en la boleta y en el seguimiento. De ahí viene la confusión con el "QR".
- Falta el flujo real de Yape para e-commerce: celular de 9 dígitos + **código de aprobación de 6 dígitos**, sin QR.

## T05 · Horarios

[checkout.tsx:26-37](../src/app/checkout.tsx#L26):

```ts
for (let h = now.getHours() + 1; h < 23 && slots.length < 4; h++)
  slots.push(`Hoy: ${fmt(h)} - ${fmt(h + 1)}`);
for (const h of [9, 11, 13, 18, 20]) slots.push(`Mañana: ...`);
```

- Son bloques de 1 hora y se calculan **una sola vez por montaje** (`useMemo`). Si la pantalla queda abierta, los bloques se vuelven viejos.
- En "Para llevar" el subtítulo dice "Elige el momento de **entrega**".
- No se comunica la garantía de cuánto tiempo se guarda el pedido.

## T06 / T07 / T08 · Mapas

- **Tiendas** ([stores.ts:3-36](../src/data/stores.ts#L3)): son 4 (Juan de Aliaga, Larco 400, Benavides, Camino Real), **sin lat/lng**, con `distanceKm` fijo.
- **Direcciones** ([stores.ts:40-54](../src/data/stores.ts#L40)): tampoco tienen coordenadas. `AddressForm` no geocodifica.
- **`TrackingMap`** ([tracking.tsx:45-180](../src/components/tracking.tsx#L45)):
  - Es un mapa SVG estilizado (parques, calles y avenida dibujados) con una ruta fija en coordenadas normalizadas.
  - La moto se anima con Reanimated.
  - Con `pickup` oculta la ruta y el destino.
- **Checkout:** usa `map-lima.jpg` como imagen estática de 120 px ([checkout.tsx:24](../src/app/checkout.tsx#L24)).
- **Dependencias:** no están `react-native-webview` ni `expo-location`.
- **Completado del delivery:** depende **solo del reloj** (75 s). No hay confirmación del receptor.

## T09 · Retiro en tienda

- "Ya recogí mi pedido" aparece cuando `phase === 'active' && step === 2` y llama a `complete(order.id)` ([seguimiento/[id].tsx:201-218](../src/app/pedido/seguimiento/%5Bid%5D.tsx#L201)).
- Sin ese toque, el pedido *pickup* se queda para siempre en "Listo para recoger" ([orderProgress.ts:41-66](../src/lib/orderProgress.ts#L41)).
- Las tiendas no tienen ningún modelo de casilleros.

## T13 · Puntos

Lo que **ya existe**:

- `useSession.points` empieza en 450 y `addPoints(n)` está en [session.ts:73](../src/store/session.ts#L73).
- Se suma `floor(total)` al comprar ([checkout.tsx:182](../src/app/checkout.tsx#L182)), es decir, **1 pt por S/ 1**.
- `perfil.tsx` tiene:
  - niveles (Fan menos de 300, Lover desde 300, Pro desde 1000);
  - el sheet "Club Tambo Lover";
  - 4 canjes (150 a 600 pts) que solo descuentan puntos y muestran un código en un toast ([perfil.tsx:17-41, 214-264](../src/app/(tabs)/perfil.tsx#L17)).

Lo que **falta**:

- La billetera visible en la cabecera.
- El canje dentro del carrito: 100 % puntos o puntos + soles.
- Guardar los puntos en el `Order` (`pointsEarned` / `pointsRedeemed`).
- Un ledger de movimientos.
- Revertir los puntos al cancelar (hoy no se revierten ni los puntos ni el cupón usado).
- El monto real en el badge del seguimiento.

**Cambio de escala:** el PDF propone 10 pts por S/ 1 y canjes de 350 a 1,100 pts. Eso cambia el **significado** del campo persistido, así que requiere `version` + `migrate` (ver arquitectura).

## T15 · Catálogo e imágenes

- **19 de 38** productos se muestran con un ícono en lugar de foto:
  - Bebidas: `agua-sanluis`.
  - Snacks: `doritos`, `sublime`, `halls`.
  - Comida: `hot-dog`, `aji-gallina`.
  - Cafetería: `cafe-americano`, `capuccino`, `croissant`.
  - Lácteos: `leche-gloria`, `yogurt-fresa`.
  - Abarrotes: `hielo-2kg`, `ajinomen`, `arroz-costeno`.
  - Limpieza: `clorox`, `ariel`.
  - Cuidado: `colgate`, `alcohol-gel`, `panadol`.
- **Cafetería** tiene 3 productos y **ninguno** con foto. La subcategoría *Postres* ([categories.ts:33](../src/data/categories.ts#L33)) está vacía.
- `hielo-2kg` sin foto aparece en varios `pairsWith`. Eso es importante para el upsell de IA (T11).
- `categoria/[id].tsx` ya aplica `paddingBottom: count > 0 ? 112 : space.xxl` ([categoria/[id].tsx:150](../src/app/categoria/%5Bid%5D.tsx#L150)) y la barra va con `bottom={space.lg}` (L212). Aun así, la Figura 6 muestra la superposición.
  - Hipótesis: la cuadrícula de 2 columnas deja la última fila incompleta y la tarjeta es más alta de lo que cubre el padding, o el inset inferior del dispositivo suma.
  - **Hay que reproducir el caso en el mismo teléfono** antes de cambiar el número. La solución robusta es calcular el padding a partir de la altura real de la barra + el inset.
- Las imágenes `fourloko-thumb.jpg` y `lays-thumb.jpg` existen pero no se usan.

## Riesgos transversales

1. **Persistencia sin versionado.** `useCart`, `useSession` y `useOrders` usan `persist` **sin `version` ni `migrate`**. Casi todas las iteraciones agregan campos.
   - Los campos nuevos de primer nivel funcionan, porque zustand hace un merge superficial con el estado inicial.
   - En cambio, **cambiar el significado o la forma** de un campo deja datos inconsistentes en el teléfono de la demo. Ejemplos: la escala de puntos, `CartItem` con modo de canje, o los pedidos delivery que ahora requieren handshake.
   - La It. 1 introduce el versionado y un "Reiniciar demo".
2. **Desfase de versiones.** `expo-doctor` falla 1 de 20 por desfase de parches con SDK 58. Hay que corregirlo **antes** de instalar dependencias nuevas, en un commit aparte.
3. **Dependencias que faltan:** `react-native-webview`, `expo-location`, `expo-camera`, `expo-crypto`, `expo-gl`, `three` y una librería de QR. Las nativas vienen en Expo Go, pero hay que instalarlas con `npx expo install` y comprobar su API en la documentación de SDK 58.
4. **La demo depende del reloj.** `DEMO_TIMELINE` hace avanzar todo solo. Los nuevos flujos (locker, SafeDrop, "Simular avance GPS") necesitan **adelantar el reloj de un pedido** sin romper la derivación de estado. Ver arquitectura → `orderProgress`.
5. **Regla del age gate.** CLAUDE.md pide revisar los tres sitios del age gate. La IA ("agregar combo completo") y Auto-Pilot añaden **dos sitios más** que agregan varios productos a la vez. Conviene centralizarlo en un helper `useAddManyToCart()`.
