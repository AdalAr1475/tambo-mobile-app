# Iteración 2 · Tambo Lover Puntos (canje al estilo CMR)

**Ticket:** T13
**Objetivo:** convertir los puntos, hoy casi invisibles, en una **billetera transaccional**. Se acumulan en cada compra, se ven en la cabecera, se canjean dentro del carrito (100 % puntos o puntos + soles) y se revierten si el pedido se cancela.
**Por qué ahora:** la base ya existe, así que es barato. Es la mejora con más valor de retención y es **fundación** de Auto-Pilot (puntos dobles) y de la IA (sugerencias canjeables).
**Esfuerzo:** M · **Dependencias nuevas:** ninguna · **Requiere:** It1 (`placeOrder`, versionado, `<DemoOnly>`).

## Estado actual

Ver [diagnóstico T13](../01-diagnostico.md#t13--puntos).

- `useSession.points` empieza en 450.
- Se acumula **1 pt por S/ 1** ([checkout.tsx:182](../../src/app/checkout.tsx#L182)).
- El sheet "Club Tambo Lover" de [perfil.tsx:214-264](../../src/app/(tabs)/perfil.tsx#L214) tiene 4 "canjes" que solo restan puntos y muestran un código en un toast.

## Reglas del programa (`src/lib/points.ts`)

| Regla | Valor | Comentario |
| --- | --- | --- |
| Acumulación | **10 pts por S/ 1** pagado en productos (sin envío) | Lo que pide el PDF |
| Valor del punto | **S/ 0.01** (100 pts = S/ 1) | Así, café 350 pts ≈ S/ 3.50, coherente con el PDF |
| Retorno efectivo | 10 % | ⚠️ Es generoso. Los programas reales en Perú devuelven entre 1 % y 3 %. Para la demo se queda en 10 % y se menciona en la exposición que es un **parámetro de negocio** que se ajusta en `points.ts`. |
| Multiplicador Auto-Pilot | ×2 | Lo usa It5 |
| Niveles (por puntos **históricos** ganados, no por saldo) | Fan menos de 1,000 · **Lover** desde 1,000 · **Gold** desde 5,000 · **Pro** desde 15,000 | Canjear no te baja de nivel |
| Saldo inicial de la demo | **1,200 pts**, con historial semilla coherente (nivel Gold) | Lo que pide el PDF |
| Cuándo se acreditan | Al confirmar (demo) | En producción se acreditan al entregar. Se menciona como decisión. |

## Catálogo de canje (`Product.redeem` en `src/data/products.ts`)

| Producto (id) | 100 % puntos | Puntos + soles |
| --- | --- | --- |
| Café Americano 12 oz (`cafe-americano`, S/ 3.50) | 350 pts | 200 pts + S/ 1.50 |
| Capuccino 12 oz (`capuccino`, S/ 5.90) | 590 pts | 300 pts + S/ 2.90 |
| Croissant de jamón y queso (`croissant`, S/ 5.50) | 450 pts | 250 pts + S/ 2.50 |
| Empanada de carne (`empanada-carne`, S/ 4.00) | 400 pts | — |
| Pan con chicharrón (`pan-chicharron`, S/ 11.90) | 1,000 pts | 500 pts + S/ 5.90 |
| Pack Four Loko Sandía (`fourloko-sandia-pack`, S/ 14.90) | — | 400 pts + S/ 8.90 (pasa el age gate) |
| Piqueo Snax (`piqueo-snax`, S/ 7.90) | 700 pts | 350 pts + S/ 3.90 |
| Hielo 2 kg (`hielo-2kg`, S/ 3.50) | 300 pts | — |

Además del canje por producto: **"Usar mis puntos"** en el checkout, un descuento libre a S/ 0.01 por punto, hasta el total en soles de los productos.

## Diseño técnico

1. **`src/store/wallet.ts`** (persistido en `tambo-wallet`, agregado a `persisted`):
   - Estado: `ledger: LedgerEntry[]`.
   - Selectores: `useBalance()` (suma de `delta`) y `useLifetime()` (suma de `earn` y `bonus`).
   - Acciones: `apply(entries)`, `revertOrder(orderId)` y `demoTopUp(1000)`.
2. **`useSession` v2:** se elimina `points` y `addPoints`. La `migrate` lo descarta, porque la billetera arranca con su propio estado semilla. Hay que actualizar todos los usos: `grep -rn "points\|addPoints" src/`.
3. **`CartItem.redeem?: 'points' | 'mixed'`.** La identidad de la línea pasa a ser `productId + redeem`. `useCart` v2 hace un `migrate` identidad (el campo es opcional).
4. **`pricing.ts`:**
   - `lineTotal` y `computeTotals` respetan `redeem`:
     - `'points'` → cash 0, puntos = `redeem.points × qty`;
     - `'mixed'` → cash = `mixed.cash × qty`.
   - `CartTotals` suma `pointsFromLines`, `pointsDiscount` (lo que se usa del slider), `pointsToRedeem` (total) y `redeemValue` (ahorro en S/).
   - El cupón y el umbral de envío gratis se calculan sobre el **subtotal en soles**.
   - `computeTotals(lines, fulfillment, coupon, { usePoints })`.
5. **`placeOrder`:**
   - Valida `pointsToRedeem ≤ balance`.
   - Registra `redeem` (negativo) y `earn` = `floor(cashProductos × 10 × multiplicador)` en el ledger.
   - Guarda `order.pointsEarned` y `order.pointsRedeemed`.
   - Si `total === 0`: `payment = { method: 'points', label: 'Canje Tambo Lover Puntos' }`, sin pasarela.
6. **`cancelOrder`:** `revertOrder(orderId)`. Se ven dos asientos `revert` en el ledger.
7. **`useAddToCart(product, { redeem })`:** el age gate aplica igual.

## UI

Ver [04-ux-ui](../04-ux-ui.md).

- **`<PointsPill>`** dorada en `LocationHeader`: `✪ 1,200`. Lleva a `/puntos`. Cuando el saldo cambia, anima el número contando.
- **`/puntos`:** cabecera con saldo, nivel y progreso; "Cómo ganar"; zona de canje; movimientos; `<DemoOnly>` "+ Recargar 1,000 pts".
- **Producto con `redeem`:** chip `✪ Canjeable`. En el detalle, un selector *Pagar con soles · 100 % puntos · Puntos + soles*.
- **Descuentos:** filtro **"🎁 Canjea con puntos"**.
- **Carrito y checkout:** líneas de canje en dorado; filas "Puntos a canjear" y "Ahorro con puntos". En el checkout, el toggle "✪ Usar mis puntos" con slider. Si el saldo no alcanza, error en rojo y CTA deshabilitado.
- **Confirmado y seguimiento:** `✪ Sumaste 149 puntos` (monto real). El RateCard ya no usa el texto fijo.
- **Perfil:** la tarjeta abre `/puntos`. El sheet Club con `REWARDS` se elimina.

## Criterios de aceptación

- [ ] La billetera arranca en 1,200 después de "Reiniciar demo".
- [ ] Canjear un **Café Americano al 100 %**: carrito en S/ 0.00 · 350 pts; el checkout confirma **sin pedir método de pago**; saldo final 850.
- [ ] Canjear un **pack Four Loko con puntos + soles**: pasa el age gate y se paga S/ 8.90 + 400 pts. Gana `floor(8.90 × 10) = 89` pts.
- [ ] Comprar S/ 44.70 en productos suma 447 pts. El seguimiento muestra "Sumaste 447 puntos".
- [ ] Cancelar ese pedido devuelve el saldo exacto anterior, y el ledger muestra la reversión.
- [ ] El cupón `TAMBOYA10` (mínimo S/ 30) **no** se aplica si el subtotal en soles es menor a 30, aunque el valor de catálogo sea mayor.
- [ ] Ningún monto en soles se calcula fuera de `pricing.ts`.

## Prompt para el agente

```
Iteración 2 de docs/iteraciones/it-02-tambo-lover-puntos.md (T13). Lee también docs/03-arquitectura.md
§2-§4 y §6. Implementa en este orden, verificando typecheck entre pasos:
1) src/lib/points.ts con las constantes y helpers puros (earnFor, levelFor, valueOf).
2) src/store/wallet.ts (ledger persistido 'tambo-wallet', saldo inicial 1,200 con historial semilla
   coherente, selectores useBalance/useLifetime, apply/revertOrder/demoTopUp). Agrégalo a `persisted`
   en _layout.tsx. Sube useSession a version 2 eliminando points/addPoints (migrate que lo descarte)
   y actualiza todos sus usos.
3) Product.redeem en src/data/types.ts y los valores de la tabla en src/data/products.ts.
   CartItem.redeem en src/store/cart.ts (version 2; identidad de línea = productId+redeem;
   actualiza add/setQty/remove/useCartQty/useCartLines).
4) Extiende src/lib/pricing.ts (lineTotal/computeTotals con redeem y opción usePoints; cupón y envío
   gratis sobre el subtotal en soles). No dupliques lógica de montos en ningún componente.
5) Integra en src/lib/placeOrder.ts (validar saldo, ledger earn/redeem, pointsEarned/pointsRedeemed,
   pago 'points' si total = 0) y crea cancelOrder con revertOrder; úsalo en seguimiento.
6) UI según docs/04-ux-ui.md: <PointsPill> en LocationHeader, ruta src/app/puntos.tsx, chip
   "Canjeable" y selector de modo en producto/[id].tsx, filtro en descuentos.tsx, filas en el carrito
   y el checkout, toggle "Usar mis puntos", monto real en confirmado y seguimiento; elimina el sheet
   Club y REWARDS de (tabs)/perfil.tsx. "+ Recargar 1,000 pts" dentro de <DemoOnly>.
   useAddToCart acepta { redeem } y mantiene el age gate.
Typecheck + lint. Luego dame un guion de prueba manual con los criterios de aceptación.
```

## Checklist de cierre

- [ ] Los criterios de aceptación anteriores.
- [ ] La regresión de la It1 sigue pasando, sobre todo cupones y envío gratis desde S/ 40.
- [ ] Un teléfono con datos de la It1, **sin** reiniciar, abre la app sin errores (la migración funciona).
