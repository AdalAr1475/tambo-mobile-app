# Iteración 9 (opcional) · LLM real para "Arma tu plan"

**Ticket:** extensión de T11.
**Objetivo:** que el usuario pida en **lenguaje natural**, por ejemplo *"somos 4, vamos a ver el partido, tenemos 50 soles y uno no toma alcohol"*, y un LLM interprete la intención. El **motor local de It4** sigue eligiendo los productos y los precios.
**Cuándo hacerla:** solo si sobra tiempo después de It8, **y** hay internet confiable en el aula.
**Esfuerzo:** S-M.

## Arquitectura: el LLM interpreta, el motor decide

```
Usuario (texto) ──► Proxy HTTPS (serverless) ──► Claude API
                          │  devuelve JSON validado: { budget, people, vibe, constraints[] }
                          ▼
                    buildPlan() de It4 (local, precios con computeTotals)
                          ▼
                    Plan + explicación generada (opcional, segunda llamada o el mismo JSON)
```

- **El LLM no inventa productos ni precios.** Solo extrae parámetros, y opcionalmente redacta la explicación a partir del plan ya calculado. Así se evitan las alucinaciones de catálogo y se mantiene `computeTotals` como única fuente de montos.
- **La API key nunca va en la app.** Un bundle de Expo es público. Hace falta un **proxy mínimo** (por ejemplo, una función serverless en Vercel o Cloudflare Workers) con:
  - la key en una variable de entorno;
  - un límite de tasa;
  - un *allowlist* del esquema de salida.
- La app llama al proxy con `fetch` y un *timeout* de 6 s. Si falla, no hay red o tarda → **cae al formulario de It4** (slider, personas, vibe) con un toast "Usamos el modo sin conexión".
- **Modelo:** el más reciente y capaz disponible de la familia Claude. Antes de implementar, confirmar los IDs, los precios y los parámetros vigentes en la documentación oficial de la API de Anthropic. Usar salida estructurada (*tool use* o *JSON schema*) para garantizar el formato.

## Restricciones que el LLM debe extraer

- `budget` (S/), `people`, `vibe` (uno de los 4 de It4, o el más cercano).
- `constraints`: `no_alcohol`, `vegetarian` (filtra `comida`), `sweet`, `hot_drinks` y `max_items`.
- `buildPlan` se extiende para respetar esas `constraints`. Por ejemplo, `no_alcohol` reemplaza el slot de alcohol por gaseosas.

## UI

- En `/ia/plan`: un campo de texto "Cuéntale a Tambo IA qué necesitas…" con 3 ejemplos tocables. Debajo, "o arma tu plan manualmente" (el formulario de It4).
- Se muestran los parámetros interpretados como chips editables: `S/ 50` `4 personas` `Partido` `Sin alcohol para 1`. Así el usuario ve qué entendió la IA y puede corregirlo.

## Criterios de aceptación

- [ ] El ejemplo del partido devuelve un plan de S/ 50 o menos, con una bebida sin alcohol, en menos de 4 s con buena red.
- [ ] Sin red: el fallback al formulario ocurre en 6 s o menos, sin errores rojos.
- [ ] La key no aparece en el bundle (`grep` sobre el export web) ni en el repo.

## Prompt para el agente

```
Iteración 9 (opcional) de docs/iteraciones/it-09-llm-opcional.md. Antes de escribir código, consulta la
documentación vigente de la API de Claude (modelos, salida estructurada) y propón el proxy mínimo
(serverless) en una carpeta separada del app (por ejemplo, /proxy), sin incluir secretos. En la app:
src/lib/aiIntent.ts (fetch al proxy con timeout de 6 s, validación del JSON, fallback), extensión de
buildPlan con constraints, y la UI de texto libre + chips editables en src/app/ia/plan.tsx. La URL
del proxy va en app.json (extra) o en EXPO_PUBLIC_*, nunca la API key. Typecheck + lint.
```
