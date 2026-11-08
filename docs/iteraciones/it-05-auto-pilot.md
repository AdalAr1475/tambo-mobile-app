# Iteración 5 · Tambo Auto-Pilot (pedidos recurrentes)

**Ticket:** T14
**Objetivo:** pasar de la compra esporádica a la **compra por suscripción** (*retail-as-a-subscription*): "agua y pan de lunes a viernes a las 7:00 AM en mi oficina", configurado una vez y ejecutado solo.
**Valor de negocio:** el más alto del roadmap. Trae ingresos recurrentes y predecibles, demanda planificable (producción y stock), retención y más LTV. Además abre la puerta al canal B2B (oficinas).
**Esfuerzo:** M · **Dependencias nuevas:** ninguna · **Requiere:** It1 (`placeOrder`), It2 (puntos dobles) e It3 (destino Smart Locker).

## Honestidad técnica

En producción, la ejecución recurrente la hace el **servidor** (un cron por rutina con cobro tokenizado). Una app sola no puede crear pedidos con el teléfono apagado. En el prototipo se hace así:

- **"⚡ Simular disparo de las 7:00 AM"**: ejecuta la rutina en ese momento, que es lo que se muestra en la demo.
- **Ejecución al abrir la app:** si la app está abierta (o se abre) dentro de los 10 min siguientes a la hora programada y la rutina no corrió ese día, se ejecuta y avisa.
- Se dice en voz alta: *"en producción esto vive en el backend"*.

## Modelo (`src/store/routines.ts`, persistido en `tambo-routines`, agregado a `persisted`)

```ts
type Routine = {
  id: string;
  name: string;                 // "Desayuno oficina 7 AM"
  emoji?: IconName;
  items: CartItem[];
  days: number[];               // 0=Dom … 6=Sáb
  time: string;                 // "07:00"
  fulfillment: Fulfillment;
  addressId?: string;           // delivery
  storeId?: string;             // pickup
  pickupMethod?: 'locker' | 'counter';
  payment: 'yape-autopay' | 'card' | 'points';
  active: boolean;
  skipDates: string[];          // 'YYYY-MM-DD'
  lastRunDate?: string;
  createdAt: number;
};
```

`Order.routineId` permite listar el historial de cada rutina.

## Lógica (`src/lib/routines.ts`)

- `nextRun(routine, now) → Date | null`: el siguiente día de `days` cuya hora sea posterior a `now`, saltando las fechas de `skipDates`. Devuelve `null` si la rutina está inactiva.
- `runRoutine(routine, now)`:
  1. Valida el stock (el producto existe) y el saldo, si el pago es con puntos.
  2. Llama a `placeOrder({ lines, fulfillment, ..., routineId, schedule: { type: 'asap' }, payment, clearCart: false })`.
     - **No toca el carrito del usuario.**
     - Aplica `computeTotals(..., { routine: true })`: **10 % de descuento en productos + envío gratis**.
     - Usa `earnFor(..., { multiplier: 2 })`: puntos dobles.
  3. Marca `lastRunDate` y muestra el **banner in-app** "🔄 Tu Desayuno oficina va en camino · Ver pedido".
- **Notificación:** se usa el `toast()` existente con acción. Las push remotas no funcionan en Expo Go. Las notificaciones locales (`expo-notifications`) quedan como mejora opcional, previa verificación en la documentación de SDK 58 de que funcionan en Expo Go.
- **Plantillas en 1 toque**, con productos que existen en el catálogo:

  | Plantilla | Productos | Días y hora | Destino |
  | --- | --- | --- | --- |
  | 💼 Desayuno oficina | Café Americano + Pan con chicharrón + Agua San Luis | L-V, 07:00 | Delivery a "Oficina" |
  | 💧 Hidratación diaria | 2 × Agua San Luis | Todos los días, 08:00 | Smart Locker |
  | 📚 Noche de estudio | Monster (2x) + Morochas | L-J, 20:00 | Delivery a "Casa" |
  | 🎉 Viernes de patas | Pack Four Loko + Hielo 2 kg + Piqueo | V, 19:00 | Delivery (pasa el age gate al **crear** la rutina) |

## UI

- **Puntos de entrada:**
  1. En el checkout, sección Horario: tercer `RadioCard`, **"🔄 Repetir este pedido (Auto-Pilot)"**, que abre el configurador con el carrito precargado. Al guardar, se confirma el pedido de hoy (opcional) y se crea la rutina.
  2. En Inicio: la tarjeta Auto-Pilot (próxima entrega o "Crea tu rutina").
  3. En Órdenes: la pestaña **Rutinas**.
- **Configurador `/rutinas/[id]`** (`[id] = 'nueva'` para crear):
  - plantillas en chips;
  - nombre;
  - productos (lista editable con stepper y "+ Agregar productos", que abre el buscador en modo selección);
  - días como chips `L M M J V S D`, con los presets *Lunes a viernes* / *Todos los días* / *Semanal*;
  - hora con chips de 30 min (06:00-22:00) o un picker simple sin dependencias nuevas;
  - destino y modalidad (reutiliza `DeliveryPointSheet` en modo selección, sin cambiar la sesión global);
  - pago automático;
  - **badge de beneficio** "✨ 10 % OFF + delivery gratis + puntos dobles";
  - **resumen por entrega**, calculado con `computeTotals` (con el beneficio aplicado) y la estimación mensual (para el desayuno: S/ 17.30 − 10 % = S/ 15.57 por entrega → "≈ 22 entregas/mes · S/ 342.54").
- **Tarjeta de rutina** (Inicio y Órdenes):
  - nombre y emoji;
  - `Próxima: mañana 7:00 AM · Oficina`;
  - cuenta regresiva;
  - productos;
  - toggle activa/pausada;
  - `Saltar próxima`, `Editar`;
  - en `<DemoOnly>`: **"⚡ Simular disparo de las 7:00 AM"**.
- Los pedidos generados llevan el chip `🔄 Auto-Pilot` en Órdenes y en el seguimiento.

## Criterios de aceptación

- [ ] Crear "Desayuno oficina" desde la plantilla en menos de 3 toques. Aparece en Inicio con la próxima entrega correcta (por ejemplo, un viernes a las 18 h muestra "Lunes 7:00 AM").
- [ ] "Simular disparo" crea un pedido delivery activo con el 10 % de descuento, envío S/ 0 y puntos dobles. El carrito del usuario **no cambia**. Aparece el banner con un enlace al seguimiento.
- [ ] "Saltar próxima" mueve la próxima entrega al siguiente día válido. Pausar oculta la cuenta regresiva.
- [ ] Una rutina con alcohol pide la verificación de edad al crearla, no al dispararse.
- [ ] Con la rutina en Smart Locker, el pedido disparado sigue el flujo de It3 (casillero y QR).
- [ ] La estimación mensual coincide con `computeTotals` × la cantidad de entregas.

## Prompt para el agente

```
Iteración 5 de docs/iteraciones/it-05-auto-pilot.md (T14). Requiere placeOrder (It1), puntos (It2) y
lockers (It3).
1) src/store/routines.ts (persist 'tambo-routines', agrégalo a `persisted` en _layout.tsx) con el tipo
   Routine del documento y acciones create/update/remove/toggle/skipNext/markRun.
2) src/lib/routines.ts: nextRun (puro), runRoutine (usa placeOrder con clearCart:false y routineId),
   las plantillas del documento (ids reales de src/data/products.ts) y monthlyEstimate.
   Extiende computeTotals con opts.routine (10% en productos + envío 0) y earnFor con multiplicador ×2;
   agrega Order.routineId.
3) Hook useRoutineRunner() montado en _layout.tsx: cada 60 s y al volver a primer plano (AppState),
   ejecuta las rutinas activas cuya hora pasó hace menos de 10 min y que no corrieron hoy; muestra
   toast() con acción "Ver pedido".
4) UI: src/components/routines.tsx (RoutineCard, DayPicker); rutas src/app/rutinas/index.tsx y
   src/app/rutinas/[id].tsx (configurador; 'nueva' crea); tarjeta en (tabs)/index.tsx; pestaña
   "Rutinas" en (tabs)/ordenes.tsx; tercer RadioCard en el horario de checkout.tsx que abre el
   configurador con el carrito precargado; chip "Auto-Pilot" en los pedidos con routineId.
   "Simular disparo de las 7:00 AM" dentro de <DemoOnly>. Age gate al crear una rutina con alcohol
   (useUi.openAgeGate).
Copy es-PE de docs/04-ux-ui.md. Typecheck + lint, y dame el guion de prueba.
```
