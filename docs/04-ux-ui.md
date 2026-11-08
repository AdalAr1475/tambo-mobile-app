# 04 · UX / UI

## Principios

1. **Una decisión, un lugar.** La modalidad (Delivery / Para llevar), la dirección o tienda y el método de retiro se eligen **solo** en el sheet "¿Cómo quieres tu pedido?" (`DeliveryPointSheet`). En el resto de la app solo se **muestra** el contexto, con un acceso "Cambiar" que abre ese sheet.
2. **El CTA depende del estado del pedido.**
   - Con el pedido activo: *rastrear* o *mostrar código* + *volver al inicio*.
   - Con el pedido terminado: *calificar* + *volver a pedir*.
   - Nunca se ofrece "Volver a pedir" a quien acaba de pagar.
3. **Nada cambia el carrito sin permiso.** Toda acción que reemplaza o agrega varios productos pide confirmación si el carrito tiene ítems, y avisa con un toast que se puede deshacer.
4. **La demo es parte del producto, pero discreta.** Los botones "⚡ Simular…" existen solo con el **Modo Presentador** activo, agrupados bajo un rótulo "Modo demo" con borde punteado dorado. La app no se ve como un prototipo cuando el modo está apagado.
5. **Explicar la tecnología en la UI.** Cada función disruptiva lleva una línea de "cómo funciona" (ⓘ) que el presentador puede leer en voz alta. Por ejemplo: *"Tu QR cambia cada 30 s y solo abre tu casillero"*.
6. **Accesibilidad.** La observación de T01 ("un ciego como yo…") se toma en serio:
   - `accessibilityLabel` en los badges ("3 productos en tu carrito") y en los CTAs;
   - áreas táctiles de 44 px o más;
   - contraste AA del dorado sobre blanco: el texto dorado va sobre `colors.ink` o se usa un dorado oscurecido.
7. **Consistencia con el sistema de diseño.** Primario berry `#6B1464`, CTA de conversión dorado `#FFBE3B`, tarjetas con radio 16, sheets con radio 20 y 80 px de margen inferior en vistas con scroll. Los tokens están en `@/theme/tokens`; si falta alguno, se agrega ahí.

## Navegación (objetivo)

```
(tabs)
├─ Inicio ─────────┬─ /carrito (modal) ─ /checkout ─ /pedido/confirmado/[id] ─ /pedido/seguimiento/[id]
│                  ├─ /puntos              (It2, también desde la píldora de puntos)
│                  ├─ /ia/plan             (It4)
│                  ├─ /rutinas, /rutinas/[id] (It5)
│                  └─ /visor/[id] (modal)  (It7, también desde producto y combos)
├─ Categorías ─ /categoria/[id] ─ /producto/[id]
├─ Descuentos ── "Zona de canje" (It2)
├─ Órdenes ───── En curso │ Historial │ Rutinas (It5)
└─ Perfil ────── Club Tambo Lover → /puntos (It2) … /demo (It1, acceso oculto)
/pedido/seguimiento/[id] ─ /locker/[id] (modal tótem, It3)
```

Acceso al Modo Presentador: **mantener presionado 2 s el logo o el avatar de Perfil** abre `/demo`. No aparece en ningún menú.

## Cambios por pantalla

### Inicio (`(tabs)/index.tsx` + `LocationHeader`)

| Antes | Después |
| --- | --- |
| Kicker "ENTREGAR EN" + dirección + toggle grande Delivery │ Para llevar + bolsa | **Píldora de contexto** de una línea: `🛵 Delivery · Av. Larco 400 · 25-35 min ⌄` o `🏪 Recoges en Tambo Juan de Aliaga · 15-25 min ⌄`. Al tocarla se abre `DeliveryPointSheet`. A la derecha: **píldora dorada de puntos** `✪ 1,200` (It2) y la bolsa con su badge. |
| Franja dorada con ETA | Se mantiene, pero se vuelve contextual. En pickup: `🔒 Smart Locker disponible · 4 libres` (It3). |
| — | **Tarjeta Auto-Pilot** (It5) bajo el carrusel: `🔄 Próxima entrega: mañana 7:00 AM · Desayuno oficina` con `[Saltar]` y `[Ver]`. Si no hay rutinas: CTA "Crea tu rutina". |
| "Tu último pedido" con ⟲ que reemplaza el carrito sin avisar | Mismo diseño. ⟲ usa `useReorder()` (confirma si hay carrito). |
| — | **"✨ Para ti · Tambo IA"** (It4) debajo de "Tu último pedido": carrusel de 3 tarjetas combo con `98 % match`, razón ("Porque pediste Four Loko Gold") y "+ Agregar combo". Debajo, el acceso "🪄 Arma tu plan". |
| Ofertas y combos | Se mantienen. Los combos llevan el chip `🥽 Ver en 3D` (It7) y, si aplica, `✪ Canjeable` (It2). |

### Carrito (`carrito.tsx`)

- La tarjeta "Punto de entrega" muestra un **chip de modalidad** (Delivery / Para llevar) y "Cambiar".
- Las **líneas de canje** (It2) muestran `✪ 350 pts` en lugar del precio, o `✪ 400 pts + S/ 8.90`, con un fondo dorado suave.
- **Bloque "🤖 Complemento inteligente"** (It4), entre los productos y el cupón: 1 producto sugerido con su razón y "+ Agregar".
- **Resumen:** filas nuevas "Puntos a canjear" y "Ahorro con puntos". El botón del pie muestra `S/ 0.00 · ✪ 350 pts` si es 100 % canje.

### Checkout (`checkout.tsx`)

Orden de secciones:

1. **Tarjeta de entrega o retiro.** Ya **no** tiene el toggle superior. Título según la modalidad, más el link "Cambiar modalidad", que abre el sheet.
   - Delivery: dirección + referencia. El mapa estático pasa a ser un mini-mapa real en It6.
   - Pickup: la tienda + el **método de retiro** (It3), con dos `RadioCard`:
     - `⚡ Tambo Smart Locker · sin colas, con QR` (opción por defecto si la tienda tiene casilleros libres);
     - `🧑‍💼 Mostrador express`.
2. **Horario** (It1):
   - `Lo antes posible`, por defecto. "Llega en 25-35 min" en delivery o "Listo en 15-20 min" en pickup.
   - `Programar`: chips de 20 min (pickup) o 30 min (delivery) agrupados en "Hoy" y "Mañana".
   - Debajo del slot elegido va la garantía: *"⏱️ Estará listo al iniciar tu bloque y lo guardamos hasta 45 min (en tienda o Smart Locker climatizado)"*.
   - `🔄 Repetir este pedido (Auto-Pilot)` (It5): un tercer `RadioCard` que abre el configurador de rutina con el carrito precargado.
3. **Pago:**
   - **Yape** (It1):
     - celular de 9 dígitos, precargado con el del perfil;
     - `OtpInput` de 6 casillas;
     - la ayuda *"Encuéntralo en tu app Yape → menú → Código de aprobación"*;
     - el link "Abrir Yape";
     - en modo demo, `⚡ Simular código Yape`.
     - Al verificar: el check verde "Código aprobado".
   - **Plin:** se mantiene la solicitud de pago.
   - **Tarjeta y efectivo:** sin cambios.
   - **"✪ Usar mis puntos"** (It2): un toggle con un slider para elegir cuántos puntos, hasta el máximo canjeable.
   - **"👥 ¿Compras en mancha? Dividir pago"** (It8).
4. Resumen + cupón (sin cambios de diseño, con las filas nuevas de puntos).
5. Pie con `CONFIRMAR PEDIDO`. Queda deshabilitado con un mensaje claro mientras falte el OTP de Yape o falten pagos del split.

### Pedido confirmado (`pedido/confirmado/[id].tsx`)

Sin cambios de estructura. Se agrega:

- la fila `✪ +149 puntos Tambo Lover` (It2);
- en pickup con locker, la fila `🔒 Casillero asignado al estar listo` (It3).

### Seguimiento (`pedido/seguimiento/[id].tsx`)

Matriz de acciones:

| Estado | Contenido principal | CTA primario | CTA secundario | Otros |
| --- | --- | --- | --- | --- |
| Delivery activo | Mapa (SVG → Leaflet en It6) + ETA + pasos + repartidor | `Ver rastreo en vivo` (lleva al mapa a pantalla completa) | `Volver al inicio` | Cancelar (primeros 15 s), Compartir |
| Delivery, llegó (It6) | Tarjeta **SafeDrop**: QR dinámico + PIN de 4 dígitos | — (el repartidor escanea) | `Volver al inicio` | Demo: `📷 Simular escaneo del motorizado` |
| Pickup preparando | Mapa + pasos | `Cómo llegar` (It6) | `Volver al inicio` | Cancelar |
| Pickup listo (locker, It3) | **Panel Smart Locker**: `#B04`, `❄️ 4.2 °C`, temporizador de 45 min, QR dinámico | `Abrir casillero` (abre el tótem) | `Volver al inicio` | Se elimina "Ya recogí mi pedido" |
| Pickup listo (mostrador) | Código grande + QR | — (el cajero escanea) | `Volver al inicio` | Demo: `Simular escaneo en caja` |
| Completado | Resumen + **calificación** + `✪ Sumaste 149 puntos` (monto real) | `Volver a pedir` (con confirmación) | `Ir al inicio` | |
| Cancelado | Motivo + reembolso de puntos | `Volver a pedir` | `Ir al inicio` | |

### Boleta (`pedido/[id].tsx`)

"Volver a pedir" **solo** cuando el pedido ya no está activo. Mientras está activo, el CTA es `Rastrear`, que ya existe en la tarjeta de estado.

### Órdenes (`(tabs)/ordenes.tsx`)

- Una tercera pestaña, **Rutinas** (It5), con la lista de rutinas, un toggle de activa/pausada, "Saltar próxima" y "Editar".
- Los pedidos generados por Auto-Pilot llevan el chip `🔄 Auto-Pilot`.

### Perfil y Descuentos

- **Perfil:** la tarjeta de usuario muestra el nivel y los puntos, y abre `/puntos`. El sheet "Club Tambo Lover" se reemplaza por esa pantalla.
- **Descuentos:** nuevo filtro **"🎁 Canjea con puntos"** que lista los productos con `redeem`.

### `/puntos` (nuevo, It2)

1. Cabecera dorada con el saldo, el nivel y una barra de progreso al siguiente nivel.
2. "Cómo ganar": 10 pts por S/ 1, doble con Auto-Pilot.
3. **Zona de canje** en una cuadrícula con dos precios por producto: `350 pts` o `200 pts + S/ 1.50`.
4. **Movimientos** (ledger).
5. En modo demo: `+ Recargar 1,000 pts`.

### `/demo` · Modo Presentador (nuevo, It1)

Interruptores y acciones:

- Modo demo (muestra los botones "Simular…").
- Reloj ×1 / ×3.
- Reiniciar demo (con confirmación).
- Recargar 1,000 puntos.
- Crear un pedido delivery activo / pickup listo en 1 toque.
- Ubicación de demo (Miraflores).
- Estado de conectividad (prueba de carga de los tiles).

## Copy de referencia (es-PE)

| Contexto | Texto |
| --- | --- |
| Confirmar reemplazo | **¿Reemplazamos tu carrito?** Tienes 3 productos. Puedes reemplazarlos por este pedido o sumarlos. · `Reemplazar` · `Sumar al carrito` · `Cancelar` |
| Yape, ayuda | Ingresa el código de aprobación de 6 dígitos. Lo encuentras en tu app Yape → menú → *Código de aprobación*. Vence en 2 minutos. |
| Yape, aprobado | ✓ Yape aprobado · S/ 44.70 |
| Garantía del slot | ⏱️ Estará listo al iniciar tu bloque y lo guardamos hasta 45 min. |
| Locker listo | Tu pedido está en el **casillero #B04** · ❄️ 4.2 °C · Guardado hasta las 4:45 PM |
| Locker abierto | 🔓 Casillero #B04 abierto. El sensor detectó el retiro de tu bolsa. ¡Buen provecho! |
| SafeDrop | Muestra este código al repartidor. Solo así se marca como entregado. |
| IA, razón | Porque sueles pedir **Four Loko Gold** los viernes por la noche |
| Auto-Pilot, beneficio | ✨ Beneficio Auto-Pilot: 10 % OFF + delivery gratis + puntos dobles |
| Puntos ganados | ✪ Sumaste **149 puntos** Tambo Lover |

## Componentes a reutilizar (no crear duplicados)

| Necesidad | Usar |
| --- | --- |
| Opciones excluyentes (horario, método de retiro, tipo de rutina) | `RadioCard` (`components/layout.tsx`) |
| Hojas modales (confirmar reemplazo, canje, configurador) | `Sheet` (`components/Sheet.tsx`) |
| Chips (slots, días de la semana, vibes de la IA) | `Chip` (`components/ui.tsx`) |
| Estados (Auto-Pilot, Canjeable, % match) | `Badge` con `tone` |
| Encabezados de pantallas nuevas | `ScreenHeader` |
| Campos | `TextField` |
| Imágenes de producto | `ProductImage` (`components/product.tsx`) |
| Precios | `PriceStack` + `money()` |
| Feedback | `toast()` y `haptic.*` |
| Agregar al carrito | `useAddToCart()` / el nuevo `useAddManyToCart()` (con age gate) |
