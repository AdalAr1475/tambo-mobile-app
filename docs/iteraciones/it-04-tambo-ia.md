# Iteración 4 · Tambo IA (motor de recomendación local)

**Ticket:** T11
**Objetivo:** personalizar la compra con un motor que aprende del **historial real de pedidos**, de la **hora del día** y del **contenido del carrito**. Tiene tres superficies: "Para ti" en Inicio, el complemento inteligente en el carrito y "Arma tu plan" por presupuesto.
**Valor de negocio:** aumenta el ticket medio (upsell y cross-sell), acelera la recompra y prepara la conversación sobre datos y personalización.
**Decisión:** motor **local, determinista y explicable**. Funciona sin internet ni API keys. El LLM real es la iteración opcional [it-09](it-09-llm-opcional.md).
**Esfuerzo:** M · **Dependencias nuevas:** ninguna.

## Honestidad técnica (para la exposición)

No es un modelo generativo. Es un **sistema de recomendación híbrido**:

- **filtrado basado en contenido:** categorías, `pairsWith`, `promoTags`;
- **señales de comportamiento:** frecuencia y recencia en `useOrders`;
- **contexto:** franja horaria;
- **optimización con restricciones:** el presupuesto, resuelto con un algoritmo de mochila voraz.

Así funcionan los recomendadores de retail en producción. La UI lo llama "Tambo IA" y cada tarjeta tiene un **"¿Por qué veo esto?"** que muestra las señales usadas. Eso es justamente lo que un docente valora: IA explicable.

## Insumos que ya existen

- `Product.pairsWith`, `promoTags`, `popularity`, `categoryId` y `subcategory` ([types.ts:19-45](../../src/data/types.ts#L19)).
- `useOrders.orders`: 4 pedidos semilla más los pedidos de la demo.
- `lineTotal()`, que respeta `multiBuy`. Se usa para calcular los costos dentro del motor.
- **Hueco:** `hielo-2kg` no tiene foto y aparece en muchos `pairsWith`. Conviene ponerle foto en esta iteración (ver it-08) o, como mínimo, un ícono cuidado.

## Motor (`src/lib/recommender.ts`, funciones puras)

### 1. `forYou(orders, now, catalog) → Suggestion[3]`

- **Afinidad por producto:** `Σ qty × e^(−edadDías/14)` sobre los pedidos no cancelados. La afinidad por categoría es la suma de sus productos.
- **Franjas horarias** (`now.getHours()`):

  | Franja | Horario | Categorías y tags favorecidos |
  | --- | --- | --- |
  | Desayuno | 6-11 h | cafetería, lácteos |
  | Tarde | 11-18 h | comida lista, snacks, gaseosas |
  | Noche | 18-24 h | bebidas con alcohol, hielo, piqueos (`promos.nights`) |
  | Madrugada | 0-6 h | snacks, energizantes |

- **Combos candidatos:** para cada *ancla* (los 3 productos con más afinidad, más el producto top de la franja), el combo es `ancla + 2 de sus pairsWith` que no se hayan comprado en las últimas 24 h. Se priorizan los que tienen promo.
- **Puntaje:** `0.5·afinidad + 0.3·encaje_horario + 0.2·promo`, normalizado de 0 a 1. **Match** = `round(70 + 28·puntaje)`, así que va de 70 % a 98 %.
- **Razón:** se elige la señal dominante.
  - "Porque pediste **Four Loko Gold** 3 veces"
  - "Ideal para la noche"
  - "En promo hoy: ahorras S/ 4.20"
- **Sin historial** (cold start): se usan popularidad + franja ("Popular a esta hora").
- Se **recalcula sola** al cambiar `orders`: un `useMemo` sobre `orders` y la franja. Después de un pedido nuevo en la demo, "Para ti" cambia.

### 2. `upsell(lines, orders) → Suggestion | null`

- **Reglas de complemento**, de mayor a menor prioridad:
  - bebida con alcohol sin hielo → `hielo-2kg`;
  - café sin acompañamiento → `croissant`;
  - snacks sin bebida → gaseosa;
  - comida sin bebida → bebida.
- Si no aplica ninguna regla: el `pairsWith` más frecuente en el historial entre los productos del carrito.
- Excluye lo que ya está en el carrito. Devuelve 1 sugerencia con su razón.
- **"Precio IA":** el PDF propone "+ Agregar con descuento IA". Para no inventar descuentos fuera de `pricing.ts`, la versión base **prioriza productos que ya tienen promo** y muestra el ahorro real.
- Un descuento propio de bundle (`CartItem.source = 'ai'` → 10 % en `computeTotals`) queda como **opcional**, documentado en arquitectura si se implementa.

### 3. `buildPlan({ budget, people, vibe }) → Plan`

Cada vibe tiene una plantilla de *slots* con cantidad por persona:

| Vibe | Slots (obligatorios **en negrita**) |
| --- | --- |
| Noche de patas | **bebida con alcohol** (1 six-pack o pack cada 3 personas), **hielo** (1 cada 4), **piqueo** (1 cada 2), gaseosa (1 cada 3) |
| Noche de estudio | **energizante o café** (1 por persona), **snack dulce** (1 por persona), agua |
| Desayuno express | **café** (1 por persona), **pan o croissant** (1 por persona), lácteo |
| Antojo dulce | **helado** (multiBuy 2x1), **chocolate o galleta** (1 por persona), bebida |

El algoritmo:

1. Llena los slots obligatorios con la opción de **mejor valor**: `popularidad / costo`, con el costo calculado por `lineTotal`, que respeta los 2x1.
2. Con el presupuesto restante, agrega los slots opcionales y luego mejora opciones (por ejemplo, de six-pack Pilsen a Cusqueña) mientras alcance.
3. Si ni el mínimo cabe en el presupuesto, devuelve `{ ok: false, minBudget }`. La UI muestra "Con S/ 22 más armamos tu plan".

El resultado incluye ítems, total con `computeTotals`, saldo restante, cobertura del plan (%) y una frase por ítem ("2 six-packs para 5 personas").

## UI

- **Inicio**, debajo de "Tu último pedido": sección **"✨ Para ti · Tambo IA"** con un carrusel de 3 tarjetas.
  - Cada tarjeta: imágenes apiladas del combo, nombre ("Previa Four Loko"), chip `96 % match`, razón, precio total y **"+ Agregar combo"**.
  - El ícono ⓘ abre el sheet **"¿Por qué veo esto?"**, con las barras de cada señal.
  - Al final de la sección, el CTA "🪄 Arma tu plan con Tambo IA".
- **Carrito:** bloque **"🤖 Complemento inteligente"** con una línea: imagen, nombre, razón, precio y "+ Agregar". Desaparece cuando ya se agregó.
- **`/ia/plan`:**
  - Slider de presupuesto de S/ 10 a S/ 100, con pasos de S/ 5.
  - Stepper de personas de 1 a 6.
  - Chips de vibe.
  - **"Generar combo IA"**: una animación breve de "pensando" de 600 ms (por honestidad, sin fingir latencia larga) y luego el resultado: lista de ítems con su frase, total vs. presupuesto en una barra y **"Agregar todo al carrito"**.
  - Se puede regenerar o cambiar un ítem por la alternativa siguiente.
- **`useAddManyToCart(items)`** (`src/lib/useAddManyToCart.ts`):
  - si algún ítem es alcohólico y no se verificó la edad → `openAgeGate(() => addAll())`;
  - toast "Agregamos 5 productos" con **Deshacer**, que restaura una copia del carrito;
  - lo usan "Agregar combo", "Agregar todo" y, más adelante, Auto-Pilot y "Agregar todos" de favoritos;
  - **Actualizar CLAUDE.md**: la lista de sitios del age gate pasa a incluir este helper.

## Criterios de aceptación

- [ ] Con los pedidos semilla, "Para ti" muestra 3 combos con razones diferentes y su % de match. Entre las 18 h y las 24 h aparece un combo nocturno.
- [ ] Hacer un pedido nuevo de café + croissant cambia "Para ti" (aparece una razón ligada a ese pedido).
- [ ] Carrito con Pack Four Loko y sin hielo → sugiere hielo. Al agregarlo, el bloque desaparece o cambia.
- [ ] "Arma tu plan" con S/ 35, 3 personas y "Noche de patas" → un plan de S/ 35 o menos con bebida, hielo y piqueo. Agregar todo pasa por el age gate.
- [ ] Con S/ 10 y 6 personas en "Noche de patas" → mensaje de presupuesto mínimo, sin un plan vacío.
- [ ] Ningún total del motor difiere del que calcula `computeTotals` en el carrito.

## Prompt para el agente

```
Iteración 4 de docs/iteraciones/it-04-tambo-ia.md (T11). Motor 100% local, funciones puras.
1) src/lib/recommender.ts: forYou(orders, now, products), upsell(lines, orders) y
   buildPlan({budget, people, vibe}) según la especificación (afinidad con decaimiento 14 días,
   franjas horarias, match 70-98, razón dominante, plantillas por vibe, mochila voraz con costos vía
   lineTotal, resultado con { ok:false, minBudget } si no alcanza). Cada sugerencia trae `signals`
   para el sheet "¿Por qué veo esto?". Sin efectos secundarios.
2) src/lib/useAddManyToCart.ts con age gate (useUi.openAgeGate), toast con Deshacer (snapshot del
   carrito) y haptic. Úsalo también en perfil/favoritos.tsx ("Agregar todos") y actualiza la sección
   "Agregar al carrito" de CLAUDE.md con el nuevo sitio.
3) src/components/ai.tsx: <ForYouSection/>, <ComboCard/>, <WhySheet/>, <UpsellRow/>.
   Monta ForYouSection en (tabs)/index.tsx bajo "Tu último pedido" (useMemo sobre orders + franja)
   y UpsellRow en carrito.tsx entre los productos y el cupón.
4) Ruta src/app/ia/plan.tsx con slider (si no hay slider en el proyecto, constrúyelo con
   Pressable/PanResponder + tokens; no agregues dependencias), stepper de personas, chips de vibe,
   resultado y "Agregar todo".
Copy es-PE en docs/04-ux-ui.md. Totales SIEMPRE con lineTotal/computeTotals. Typecheck + lint.
```
