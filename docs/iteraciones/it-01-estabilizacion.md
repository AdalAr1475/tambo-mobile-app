# Iteración 1 · Estabilización del core + Modo Presentador

**Tickets:** T01, T03, T02, T04, T05 y el padding de T15. Además, preparación técnica y el Modo Presentador.
**Objetivo:** que el flujo Inicio → Carrito → Checkout → Confirmado → Seguimiento → Inicio no tenga **ninguna** fricción, y dejar la base técnica (transacción de cierre, versionado, panel de demo) que usan las iteraciones siguientes.
**Esfuerzo:** M · **Dependencias nuevas:** ninguna.

Orden de trabajo: `1.0 → 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6`. Cada sub-ticket cabe en una sesión con el agente.

---

## 1.0 · Preparación técnica y Modo Presentador

**Por qué:** las iteraciones 2 a 8 agregan estado persistido y botones de simulación. Sin versionado ni "Reiniciar demo", el teléfono de la presentación puede arrastrar datos inconsistentes.

**Alcance**

1. **Commit aparte:** ejecutar `npx expo install --fix` y verificar con `npx expo-doctor` (resuelve el 1/20 de la línea base de CLAUDE.md).
2. **Versionado:** agregar `version: 1` + `migrate` (identidad) a `useCart`, `useSession` y `useOrders`. Esto no cambia ninguna forma de estado, solo deja preparada la base.
3. **`useDemo`** (`src/store/demo.ts`, persistido en `tambo-demo`): `enabled`, `fastClock: 1 | 3`. Se agrega a `persisted` en `_layout.tsx`.
4. **`<DemoOnly>`** (`src/components/DemoOnly.tsx`): renderiza sus hijos solo si `enabled`, dentro de un contenedor con borde punteado dorado y el rótulo "Modo demo".
5. **Pantalla `/demo`**, a la que se entra manteniendo presionado 2 s el avatar de Perfil:
   - interruptor de Modo demo;
   - reloj ×1 / ×3 (multiplica el `t` de `getOrderStatus`);
   - **Reiniciar demo**: `persist.clearStorage()` + `setState(getInitialState(), true)` en cada store persistido, y luego `router.replace('/')`;
   - "Crear pedido de prueba" (delivery activo / pickup listo), usando `placeOrder` (1.1) con el ítem semilla.
6. **Reloj por pedido:** `clockOffsetMs?` en `Order`, `useOrders.fastForward(id, ms)` y su uso en `getOrderStatus`. Ver [arquitectura §5](../03-arquitectura.md#5-estado-del-pedido-reloj-por-pedido).

**Criterios de aceptación**

- [ ] `npx expo-doctor` pasa 20/20.
- [ ] Mantener presionado el avatar abre `/demo`. No hay ningún acceso visible a esa pantalla.
- [ ] "Reiniciar demo" deja la app igual que una instalación limpia: carrito vacío, pedidos semilla, sesión inicial.
- [ ] Con el Modo demo apagado no se ve ningún `<DemoOnly>`.
- [ ] `fastForward(id, 30_000)` sobre un pedido pickup recién creado lo pone en "Listo para recoger".

**Prompt para el agente**

```
Iteración 1.0 de docs/iteraciones/it-01-estabilizacion.md. Lee también docs/03-arquitectura.md §5 y §6.
1) Ejecuta `npx expo install --fix`, verifica con `npx expo-doctor` y detente para que yo haga un commit aparte.
2) Agrega `version: 1` y un `migrate` identidad a los persist de src/store/cart.ts, session.ts y orders.ts.
3) Crea src/store/demo.ts (zustand + persist con persistStorage, clave 'tambo-demo') con `enabled` y
   `fastClock: 1 | 3`, y agrégalo al array `persisted` de src/app/_layout.tsx.
4) Crea src/components/DemoOnly.tsx (contenedor con borde punteado `colors.gold`, rótulo "Modo demo",
   oculto si !enabled).
5) Crea la ruta src/app/demo.tsx con ScreenHeader y: Switch de modo demo, selector de reloj ×1/×3,
   "Reiniciar demo" (pide confirmación con Sheet; usa persist.clearStorage() y
   setState(getInitialState(), true) en cada store persistido; luego router.replace('/')), y
   "Crear pedido de prueba" (delivery / pickup). Regístrala en el Stack de _layout.tsx.
   Acceso: onLongPress (delayLongPress 2000) en el avatar de src/app/(tabs)/perfil.tsx.
6) Agrega `clockOffsetMs?: number` a Order (src/data/types.ts), la acción `fastForward(id, ms)` en
   useOrders, y en getOrderStatus (src/lib/orderProgress.ts) usa
   t = (now - createdAt) * fastClock + (clockOffsetMs ?? 0). No cambies DEMO_TIMELINE.
Respeta CLAUDE.md (tokens, Txt/Tap/Button, copy es-PE). Cierra con npm run typecheck y npm run lint.
```

---

## 1.1 · T01 + T03 (raíz): `placeOrder()` y `useReorder()`

**Diagnóstico:** el checkout **sí** vacía el carrito ([checkout.tsx:187](../../src/app/checkout.tsx#L187)). Lo que lo vuelve a llenar es "Volver a pedir", que hace `useCart.replace()` sin confirmar y sin limpiar el cupón. Ese código está repetido en 4 sitios. Ver el [diagnóstico de T01](../01-diagnostico.md#t01--carrito-no-se-limpia--la-causa-es-volver-a-pedir).

**Solución**

1. **Reproducir primero** en Expo Go: comprar → seguir → esperar 75 s → "Volver a pedir" → cerrar el carrito → Inicio. Anotar si el caso coincide. Si el carrito queda con ítems **sin** tocar "Volver a pedir", investigar otra causa antes de seguir. Por ejemplo, la hidratación: AsyncStorage podría escribir el estado viejo después del `clear()`.
2. **`src/lib/placeOrder.ts`:** extraer de `confirm` en `checkout.tsx` los pasos de crear el pedido, guardarlo, sumar puntos, marcar el cupón y limpiar el carrito. Ver [arquitectura §2](../03-arquitectura.md#2-transacción-de-cierre-placeorder). El checkout queda a cargo solo de validar, el age gate, la espera simulada, `placeOrder()` y navegar.
3. **`src/lib/useReorder.ts`:** `reorder(order)` hace lo siguiente:
   - si el carrito está vacío: `replace(items)`, `setCoupon(undefined)`, toast y `/carrito`;
   - si tiene ítems: abre un `Sheet` con *Reemplazar* / *Sumar al carrito* / *Cancelar*. "Sumar" usa `add` por ítem, respetando `MAX_QTY`;
   - los productos que ya no existen en el catálogo se omiten con aviso.
4. Usar `useReorder` en los 4 sitios: [index.tsx:243](../../src/app/(tabs)/index.tsx#L243), [ordenes.tsx:303](../../src/app/(tabs)/ordenes.tsx#L303), [pedido/[id].tsx:45](../../src/app/pedido/%5Bid%5D.tsx#L45) y [seguimiento/[id].tsx:87](../../src/app/pedido/seguimiento/%5Bid%5D.tsx#L87).

**Criterios de aceptación** (incluyen los del PDF)

- [ ] Después de confirmar, el badge de la bolsa no se ve y la barra "Ver pedido actual" no aparece en Inicio, Categorías, Descuentos ni en el listado de categoría.
- [ ] "Tu último pedido" muestra la compra recién hecha.
- [ ] "Volver a pedir" con el carrito vacío lo llena y abre el carrito. Con ítems, pregunta antes de hacer nada.
- [ ] Ningún re-pedido hereda un cupón viejo.
- [ ] `checkout.tsx` ya no llama directamente a `place`, `addPoints` ni `clear`.

**Casos borde:** un re-pedido con un producto alcohólico pasa por el age gate en el checkout, igual que hoy. Si un ítem del re-pedido supera `MAX_QTY` al sumarse, se recorta a 20 con un toast.

**Prompt para el agente**

```
Iteración 1.1 de docs/iteraciones/it-01-estabilizacion.md (T01 + raíz de T03).
Contexto: el checkout SÍ vacía el carrito (src/app/checkout.tsx:181-187); el bug lo provoca
"Volver a pedir", que hace useCart.replace() sin confirmar ni limpiar el cupón, en 4 sitios.
1) Crea src/lib/placeOrder.ts según docs/03-arquitectura.md §2 (por ahora sin puntos nuevos: conserva
   el addPoints actual). Usa getState() de los stores. Totales SOLO con computeTotals.
   Refactoriza `confirm` en checkout.tsx para usarlo (mantén la validación, el age gate, la espera de
   1400 ms y la navegación a /pedido/confirmado/[id]).
2) Crea src/lib/useReorder.ts: si el carrito está vacío, reemplaza + limpia el cupón + toast + push('/carrito');
   si no, muestra un Sheet "¿Reemplazamos tu carrito?" con Reemplazar / Sumar al carrito / Cancelar
   (copy en docs/04-ux-ui.md). Expón el Sheet como componente <ReorderSheet/> o similar para
   montarlo una vez por pantalla.
3) Reemplaza las 4 implementaciones de reorder: (tabs)/index.tsx, (tabs)/ordenes.tsx,
   pedido/[id].tsx y pedido/seguimiento/[id].tsx.
Typecheck + lint. Dime los pasos para reproducir el bug original y verificar el arreglo en Expo Go.
```

---

## 1.2 · T03 · CTAs del seguimiento y de la boleta

**Diagnóstico:** en seguimiento, mientras el pedido está activo, no hay "Volver al inicio". Al completarse, el único CTA principal es "Volver a pedir". La boleta muestra "Volver a pedir" **siempre**. El badge de puntos es texto fijo.

**Solución:** implementar la [matriz de acciones de 04-ux-ui](../04-ux-ui.md#seguimiento-pedidoseguimientoidtsx) en lo que aplica a esta iteración:

- Activo: primario "Ver rastreo en vivo" (delivery; hace scroll al mapa) o "Mostrar código de retiro" (pickup; hace scroll a la tarjeta del código). Secundario `Volver al inicio`, con `router.dismissTo('/')`.
- `RateCard` y "Volver a pedir" **solo** cuando el pedido está completado o cancelado.
- Boleta: "Volver a pedir" solo si `phase !== 'active'`.
- El badge de puntos muestra el monto si `order.pointsEarned` existe (It2). Si no existe, se oculta en los pedidos semilla.
- "Ya recogí mi pedido" **se mantiene** en esta iteración. Se elimina en It3.

**Criterios de aceptación**

- [ ] Un pedido recién pagado nunca muestra "Volver a pedir" ni estrellas.
- [ ] "Volver al inicio" lleva a Inicio sin dejar pantallas apiladas: el botón atrás de Android no regresa al seguimiento.
- [ ] Un pedido del historial muestra calificación + "Volver a pedir".

**Prompt para el agente**

```
Iteración 1.2 de docs/iteraciones/it-01-estabilizacion.md (T03). Implementa en
src/app/pedido/seguimiento/[id].tsx la matriz de CTAs de docs/04-ux-ui.md (sección Seguimiento),
solo las filas que no dependen de It3/It6: activo → primario "Ver rastreo en vivo" (delivery, scroll
al mapa con un ref de ScrollView) o "Mostrar código de retiro" (pickup), secundario "Volver al inicio"
con router.dismissTo('/'); completado/cancelado → RateCard + "Volver a pedir" (useReorder) +
"Ir al inicio". En src/app/pedido/[id].tsx muestra "Volver a pedir" solo si el pedido no está activo
(usa getOrderStatus). El Badge "Sumaste puntos…" solo se ve si order.pointsEarned está definido
(campo opcional nuevo en Order). No quites aún "Ya recogí mi pedido". Typecheck + lint.
```

---

## 1.3 · T02 · Una sola decisión de modalidad

**Diagnóstico:** el estado ya es único (`useSession.fulfillment`). Lo que sobra son los toggles visibles en Home/Descuentos y en el checkout.

**Solución**

1. **`LocationHeader`** ([delivery.tsx:254-306](../../src/components/delivery.tsx#L254)): se quita `FulfillmentToggle`.
   - La fila de ubicación se reemplaza por una **píldora de contexto** de una línea: ícono de modalidad + modo + dirección o tienda + ETA + ⌄. Al tocarla se abre `DeliveryPointSheet`.
   - A la derecha queda espacio reservado para la píldora de puntos (It2).
   - La cabecera debe quedar **más baja** que la actual.
2. **Checkout** ([checkout.tsx:207](../../src/app/checkout.tsx#L207)): se quita el toggle. La tarjeta de entrega/retiro lleva arriba un chip con la modalidad y el link **"Cambiar modalidad"**, que abre `DeliveryPointSheet`, el mismo que hoy abre "Cambiar".
3. **`DeliveryPointSheet`** sigue siendo el **único** lugar con `FulfillmentToggle`.
4. **Carrito:** agregar el chip de modalidad en la tarjeta "Punto de entrega". No hace falta otro cambio.

**Criterios de aceptación**

- [ ] `FulfillmentToggle` solo se usa en `DeliveryPointSheet`. Comprobar con `grep -r FulfillmentToggle src/`.
- [ ] Cambiar la modalidad desde el checkout actualiza el costo de envío, el horario, el pago en efectivo y los textos sin salir de la pantalla.
- [ ] La cabecera de Inicio ocupa menos alto que antes (comparar con una captura).

**Prompt para el agente**

```
Iteración 1.3 de docs/iteraciones/it-01-estabilizacion.md (T02). El estado de modalidad ya es único
(useSession.fulfillment); el problema es solo de UI.
1) En src/components/delivery.tsx, LocationHeader: elimina FulfillmentToggle y reemplaza la fila por
   una píldora de contexto de una línea ("🛵 Delivery · {address.line1} · {eta} ⌄" o
   "🏪 Recoges en {store.name} · {eta} ⌄", con Icon en lugar de emoji) que abre DeliveryPointSheet.
   Mantén la bolsa con badge a la derecha y deja un slot para una futura píldora de puntos.
   Agrega accessibilityLabel descriptivos.
2) En src/app/checkout.tsx quita el FulfillmentToggle superior (línea ~207); en la tarjeta
   Dirección/Tienda agrega un chip de modalidad y un link "Cambiar modalidad" que abre el mismo
   DeliveryPointSheet (pointOpen).
3) En src/app/carrito.tsx agrega el chip de modalidad en la tarjeta "Punto de entrega".
Verifica que FulfillmentToggle solo quede en DeliveryPointSheet. Usa tokens; nada hardcodeado.
Typecheck + lint.
```

---

## 1.4 · T04 · Yape con código de aprobación (OTP)

**Diagnóstico:** no hay QR en la UI. Lo que hay es la etiqueta `'Yape (QR Aprobado)'` ([checkout.tsx:136](../../src/app/checkout.tsx#L136)) y el texto "solicitud de pago" ([checkout.tsx:363](../../src/app/checkout.tsx#L363)). Hoy Yape y Plin comparten una opción.

**Solución**

1. Separar **Yape** y **Plin** en dos opciones si hoy están juntas. Plin conserva la "solicitud de pago".
2. **Yape:**
   - `TextField` del celular (9 dígitos, empieza con 9, precargado desde `profile.phone`);
   - **`OtpInput`** nuevo (`src/components/otp.tsx`): 6 casillas, foco automático, pegar el código completo, teclado numérico;
   - la microayuda del [copy de UX](../04-ux-ui.md#copy-de-referencia-es-pe);
   - el link **"Abrir Yape"**: `Linking.openURL('yape://')` dentro de un `try/catch`; si falla, toast "Instala Yape para continuar" (no se usa `canOpenURL`, porque en Expo Go no se pueden declarar *queries*);
   - en `<DemoOnly>`: **"⚡ Simular código Yape"**, que llena el celular y un OTP de 6 dígitos con una animación de dígitos y muestra "✓ Yape aprobado".
3. **Validación:** con Yape elegido, `CONFIRMAR PEDIDO` exige un celular válido y 6 dígitos. Se añade a `errors`.
4. **Al confirmar:** el texto de espera es "Validando código con Yape…". La etiqueta del pago pasa a `Yape · Código de aprobación`.
5. Revisar que **ningún texto** de la app diga "QR" para Yape.

**Criterios de aceptación**

- [ ] No queda la palabra "QR" asociada a Yape. Comprobar con `grep -ri "qr" src/` y revisar los resultados.
- [ ] No se puede confirmar con Yape sin 6 dígitos. El error se ve en rojo después del primer intento.
- [ ] "Simular código Yape" solo aparece en modo demo y permite confirmar en menos de 2 s.

**Prompt para el agente**

```
Iteración 1.4 de docs/iteraciones/it-01-estabilizacion.md (T04). En src/app/checkout.tsx, la opción
Yape hoy solo muestra un texto de "solicitud de pago" y guarda la etiqueta 'Yape (QR Aprobado)'.
1) Si Yape y Plin comparten opción, sepáralas (Plin conserva la solicitud de pago).
2) Crea src/components/otp.tsx (<OtpInput length={6} value onChange error />): casillas con TextInput
   oculto, keyboardType number-pad, textContentType oneTimeCode, soporte para pegar el código, tokens
   del tema.
3) Para Yape: TextField de celular (9 dígitos, empieza con 9, precargado desde profile.phone),
   OtpInput, la microayuda de docs/04-ux-ui.md, el link "Abrir Yape" (Linking.openURL('yape://') en
   try/catch → toast) y, dentro de <DemoOnly>, "⚡ Simular código Yape" (rellena con animación y
   marca aprobado).
4) Integra en `errors` (requiere celular válido + 6 dígitos) y cambia el label del pago a
   'Yape · Código de aprobación' y el texto de espera a "Validando código con Yape…".
Revisa que no quede "QR" asociado a Yape en ningún archivo. Typecheck + lint.
```

---

## 1.5 · T05 · Slots dinámicos

**Diagnóstico:** [checkout.tsx:26-37](../../src/app/checkout.tsx#L26) genera bloques fijos de 1 h y los memoiza una sola vez. En pickup dice "momento de entrega".

**Solución:** `src/lib/slots.ts` (función pura):

```ts
buildSlots(now: Date, fulfillment: Fulfillment): { id: string; day: 'hoy' | 'manana'; start: Date; end: Date; label: string }[]
```

- **Ventana:** 20 min en pickup y 30 min en delivery.
- **Primer slot:** `ceil(now + preparación, ventana)`, con 20 min de preparación en pickup y 35 min en delivery.
- **Hoy:** hasta las 23:00. **Mañana:** de 07:00 a 11:00 (o un rango representativo), máximo unos 8 slots por día.
- **Etiqueta:** `04:00 - 04:20 PM` (con `time12`).
- **Recálculo** cada 60 s con `useNow(60_000)`. Si el slot elegido se vence, se pasa al siguiente con un toast.
- **"Lo antes posible"** por defecto, con el subtítulo "Listo en 15-20 min" (pickup) o "Llega en 25-35 min" (delivery).
- La garantía de 45 min va debajo del slot elegido.
- **Textos según modalidad:** "Horario de entrega" / "Horario de recojo" y "Elige cuándo te lo llevamos" / "Elige cuándo lo recoges".
- `order.schedule.slot` guarda la etiqueta legible + `start` (número). Agregar `start?` y `end?` opcionales al tipo `schedule`.

**Criterios de aceptación**

- [ ] A las 15:52 en pickup, el primer slot es `04:20 - 04:40 PM` (15:52 + 20 min = 16:12 → redondeado a 16:20).
- [ ] Después de las 22:20 no hay slots de hoy: se muestra "Mañana" con un aviso.
- [ ] Los chips se agrupan con un subtítulo "Hoy" / "Mañana" y hacen scroll horizontal sin cortar texto.

**Prompt para el agente**

```
Iteración 1.5 de docs/iteraciones/it-01-estabilizacion.md (T05). Reemplaza buildSlots de
src/app/checkout.tsx (bloques de 1 h, memoizados una vez) por src/lib/slots.ts con la especificación
del documento (función pura buildSlots(now, fulfillment), ventanas de 20/30 min, redondeo hacia
arriba tras la preparación, hoy hasta 23:00 + mañana desde 07:00, labels con time12 de
src/lib/format.ts). En el checkout: recalcula con useNow(60_000), agrupa los chips por día, ajusta
los textos por modalidad, muestra la garantía de 45 min bajo el slot elegido y guarda start/end
opcionales en order.schedule (actualiza el tipo en src/data/types.ts). La boleta y el confirmado
siguen mostrando la etiqueta. Typecheck + lint.
```

---

## 1.6 · T15 (padding) · Barra flotante que tapa productos

**Diagnóstico:** ya existe `paddingBottom: count > 0 ? 112 : space.xxl` en 4 pantallas, pero la Figura 6 muestra que la barra tapa la última fila. **Hay que reproducirlo en el mismo teléfono** (Android con barra de navegación por botones, como en la captura).

**Solución robusta**

- Exportar desde `FloatingCartBar.tsx` una constante `FLOATING_CART_HEIGHT` (alto real de la barra) y un hook `useFloatingCartInset()`.
- El hook devuelve `count > 0 ? FLOATING_CART_HEIGHT + offsetInferior + space.lg : space.xxl`, considerando `insets.bottom` en las pantallas que no tienen tab bar (`categoria/[id]`).
- Usarlo en: `(tabs)/index.tsx`, `(tabs)/categorias.tsx`, `(tabs)/descuentos.tsx` y `categoria/[id].tsx`.
- Revisar también `ToastHost` (`bottomOffset` de 156) para que los toasts no queden sobre la barra.

**Criterios de aceptación**

- [ ] En Cafetería, con carrito, el último producto y su botón "+" se ven completos al final del scroll, en Android con botones y en iOS con home indicator.

**Prompt para el agente**

```
Iteración 1.6 de docs/iteraciones/it-01-estabilizacion.md (T15 padding). La barra FloatingCartBar
tapa la última fila de productos en categoria/[id].tsx pese al paddingBottom fijo de 112. Exporta
FLOATING_CART_HEIGHT y crea useFloatingCartInset() en src/components/FloatingCartBar.tsx (alto real
+ offset `bottom` + insets cuando no hay tab bar + space.lg). Reemplaza el 112 hardcodeado en
(tabs)/index.tsx, (tabs)/categorias.tsx, (tabs)/descuentos.tsx y categoria/[id].tsx.
Typecheck + lint, y dime cómo verificarlo en Cafetería.
```

---

## Checklist de cierre de la It. 1 (regresión del flujo base)

Ejecutar en Expo Go **después de "Reiniciar demo"**:

- [ ] Agregar Four Loko (pasa el age gate) + café → carrito → cupón `TAMBOAPP` → checkout.
- [ ] Cambiar a Para llevar desde "Cambiar modalidad": el envío pasa a S/ 0 y el horario dice "recojo".
- [ ] Programar un slot de 20 min → Yape → Simular código → Confirmar.
- [ ] Confirmado → "Ir al Inicio": carrito vacío y sin barra flotante.
- [ ] Órdenes → Rastrear: sin "Volver a pedir" mientras está activo. Completar (con `fastForward` desde `/demo`) → calificar → "Volver a pedir" con el carrito vacío → abre el carrito lleno.
- [ ] Agregar un producto y "Volver a pedir" desde el Home → pregunta *Reemplazar / Sumar*.
- [ ] Tarjeta nueva con datos inválidos → errores en rojo. Efectivo con monto menor al total → error.
- [ ] Cancelar un pedido en los primeros 15 s.
- [ ] Web (`npx expo start --web`): el flujo completo funciona.
