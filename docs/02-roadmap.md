# 02 · Roadmap y priorización

## Criterio

Se sigue el orden pedido por el equipo:

1. **Correcciones primero.** Son requisito de la demo: el docente pidió explícitamente que "el flujo base funcione sin fallos", así que no compiten en el puntaje.
2. **Lo disruptivo con más valor de negocio después.**
3. **Al final, lo que aporta menos en alguno de los dos ejes.**

Para ordenar las mejoras se usa:

```
Prioridad = (Valor de negocio × Factor disruptivo) ÷ (Costo × Riesgo)      cada eje de 1 a 5
```

- **Valor de negocio:** retención, ticket medio, ingresos recurrentes, reducción de costos operativos o confianza.
- **Factor disruptivo:** cuánto pesa en la evaluación del docente (tecnología visible y diferenciadora).
- **Costo:** días de trabajo estimados con el agente + volumen de código nuevo.
- **Riesgo:** dependencias nuevas, compatibilidad con Expo Go, dependencia de internet, posibilidad de que falle en vivo.

| Ticket | Mejora | Valor | Disrupción | Costo | Riesgo | **Prioridad** | Nota |
| --- | --- | :-: | :-: | :-: | :-: | :-: | --- |
| T13 | Tambo Lover Puntos (CMR) | 5 | 3 | 2 | 1 | **7.5** | La base ya existe. Es fundación para T14 y T11. |
| T09 | Smart Lockers IoT + QR | 4 | 5 | 3 | 1 | **6.7** | Estrella del docente. Deja lista la infraestructura QR para SafeDrop. |
| T11 | Tambo IA (motor local) | 4 | 5 | 3 | 1 | **6.7** | Aumenta el ticket medio. Usa datos que ya existen. |
| T14 | Auto-Pilot recurrente | 5 | 4 | 3 | 1 | **6.7** | Ingreso recurrente. Depende de T13 y T09 para lucir completo. |
| T07 | Telemetría GPS + SafeDrop | 3 | 5 | 4 | 3 | **1.3** | Mucho efecto "wow", pero es la iteración más cara y depende de internet. |
| T06 | Mapa de tiendas con cobertura | 3 | 3 | 2* | 2 | **2.3** | *El costo baja si se hace después de T07 (mapa ya hecho). |
| T08 | Ruta peatonal + "Cómo llegar" | 3 | 3 | 1* | 2 | **4.5*** | *Muy barato una vez que existe el mapa: se agrupa con T07. |
| T10 | Visor 3D / AR | 2 | 5 | 4 | 4 | **0.6** | Máximo "wow", pero el valor de negocio es el más bajo en conveniencia y el riesgo técnico es alto. |
| T12 | Party Split | 2 | 2 | 2 | 1 | **2.0** | Diferenciador menor: Yape ya permite cobrar entre amigos. |
| T15a | Fotos del catálogo | 2 | 1 | 1 | 1 | **2.0** | Estética. Es trabajo de contenido, no de código. |

Los empates entre T09, T11 y T14 se resuelven por **dependencias**:

- T09 crea la infraestructura QR y el modelo de casilleros que usa T14 ("listo a las 7:00 en tu Smart Locker").
- T11 no depende de nada y es la demo más corta de explicar.
- T14 se luce más cuando ya existen puntos dobles (T13) y el locker (T09).

T06, T07 y T08 se agrupan en una sola iteración porque comparten el **mismo componente de mapa, los mismos datos geográficos y las mismas dependencias**. Por separado cada uno costaría casi lo mismo que los tres juntos.

## Dependencias

```
It1 Estabilización ───────────────┬────────────────────────────────────────────┐
  (placeOrder, useReorder,        │                                            │
   versionado persist, Modo       ▼                                            ▼
   Presentador)             It2 Puntos ──────────────┐                  It4 Tambo IA
                                  │                  │                  (historial + carrito)
                                  ▼                  ▼                         │
                            It3 Smart Lockers ──► It5 Auto-Pilot ◄─────────────┘ (plantillas)
                            (QR + reloj por pedido)  │
                                  │                  │
                                  ▼                  ▼
                            It6 Geo/Telemetría/SafeDrop (reusa QR y reloj por pedido)
                                  │
                                  ▼
                            It7 Visor 3D/AR (independiente; usa expo-camera de It3 si existe)
                            It8 Party Split + fotos (independiente)
                            It9 LLM opcional (sobre It4)
```

## Iteraciones

| It. | Nombre | Tickets | Esfuerzo* | Valor acumulado** | Demo que habilita |
| --- | --- | --- | :-: | :-: | --- |
| 1 | **Estabilización del core + Modo Presentador** | T01, T03, T02, T04, T05, padding de T15 | M | 20 % | Flujo de compra completo sin tropiezos, Yape con OTP |
| 2 | **Billetera Tambo Lover (canje tipo CMR)** | T13 | M | 35 % | Canjear un café al 100 % con puntos y un pack con puntos + S/ |
| 3 | **Tambo Smart Lockers IoT** | T09 | M | 52 % | Casillero #B04 a 4.2 °C, QR dinámico y tótem que abre la puerta |
| 4 | **Tambo IA** | T11 | M | 67 % | "Para ti" con % de afinidad, upsell en el carrito, "Arma tu plan" con S/ 35 para 3 personas |
| 5 | **Tambo Auto-Pilot** | T14 | M | **80 %** | Rutina de lunes a viernes a las 7:00 y "Simular disparo" |
| — | **🔻 Línea de corte del ~80 %** | | | | Con esto ya se demuestran 5 de los 6 pilares sobre una base sólida |
| 6 | **Geo real + Telemetría + SafeDrop** | T07, T06, T08 | L | 91 % | Moto sobre calles reales, QR de entrega, mapa de cobertura, "Cómo llegar" |
| 7 | **Visor 3D / AR** | T10 | L | 97 % | Rotar el combo, vista explosiva y proyectarlo sobre la mesa |
| 8 | **Party Split + catálogo con fotos + pulido** | T12, fotos de T15 | S | 100 % | Dividir la cuenta en 3 y simular pagos con Yape |
| 9 | *(opcional)* **LLM real para "Arma tu plan"** | extensión de T11 | S-M | +extra | Pedir un plan en lenguaje natural |

\* S ≈ 1 a 2 sesiones de trabajo con el agente · M ≈ 3 a 4 · L ≈ 5 o más.
\** Estimación relativa de valor para la demo y el negocio, ponderada por la prioridad de cada ticket. No es una métrica medida.

### ¿Por qué el geo queda detrás del corte si el docente lo pidió?

- El seguimiento **ya tiene** un mapa animado con moto: lo que falta es realismo, no funcionalidad.
- Es la iteración más cara (WebView + Leaflet, coordenadas, rutas, permisos de ubicación) y la única que **depende de internet en el aula**.
- El SafeDrop (QR de entrega) reutiliza la infraestructura QR y el reloj por pedido de It3, así que hacerlo después es más barato.

Si el equipo considera que la telemetría es imprescindible, el intercambio recomendado es **subir It6 por encima de It5**, no por encima de It3 o It4.

### ¿Por qué el 3D/AR es la penúltima?

- Es el pilar con más "wow", pero en una tienda de conveniencia nadie necesita ver una lata en 3D para comprarla. **El valor de negocio es bajo.**
- La AR real (detección de planos) **no es posible en Expo Go**: requiere ARKit/ARCore y un *development build*. Lo factible es un visor 3D con `expo-gl` + `three` y una "AR ligera" (cámara + objeto superpuesto).
- Hay que dejarlo claro en la exposición. Ver [it-07](iteraciones/it-07-visor-3d-ar.md).

## Definition of Done (aplica a todas las iteraciones)

- [ ] `npm run typecheck` y `npm run lint` sin errores.
- [ ] Probado en **Expo Go en el teléfono de la demo** (Android o iOS, según cuál se presente). La web abre sin errores rojos aunque alguna función muestre un aviso de "solo en el celular".
- [ ] Si cambió la forma del estado persistido: se subió la `version` del store y se escribió su `migrate`, o el "Reiniciar demo" lo cubre y está documentado.
- [ ] Si se creó un store persistido nuevo: se agregó al array `persisted` de [_layout.tsx:21](../src/app/_layout.tsx#L21).
- [ ] El copy está en español (Perú), los montos con `money()` y los totales calculados con `computeTotals` / `lineTotal`.
- [ ] Los botones "Simular…" solo se ven con el **Modo Presentador** activo.
- [ ] Se ensayó el paso correspondiente del [guion de demo](05-guion-demo.md).
- [ ] Commit en español con el número de iteración (por ejemplo: `It3: Smart Lockers con QR dinámico`).

## Riesgos y plan B

| Riesgo | Prob. | Impacto | Mitigación / plan B |
| --- | :-: | :-: | --- |
| No hay internet en el aula: mapas OSM, LLM | Media | Alto | Usar el mapa SVG actual cuando la WebView no carga tiles en 5 s. Usar el motor local cuando el LLM falla. Llevar datos móviles o un hotspot. |
| Datos persistidos viejos en el teléfono de la demo | Alta | Alto | "Reiniciar demo" en el Modo Presentador + `version`/`migrate` en cada store. |
| Desfase de versiones al instalar dependencias nuevas | Media | Medio | `npx expo install --fix` al inicio de It1, en un commit aparte. Instalar siempre con `npx expo install`. |
| Se niegan permisos de cámara o ubicación en vivo | Media | Medio | Toda función con permisos tiene un camino "Simular…" que no los necesita. |
| `three` + `expo-gl` incompatibles con React 19.3 / RN 0.88 | Media | Medio | Hacer un *spike* de 1 sesión al inicio de It7. Si falla, usar el visor 2.5D con Reanimated (ver it-07). |
| El agente rompe el flujo base al agregar funciones | Media | Alto | Checklist de regresión del flujo base al final de cada iteración (en it-01). |
| Tiempo insuficiente | Alta | Medio | El orden ya protege el valor: cortar desde abajo (It9 → It8 → It7 → It6). |

## Trazabilidad de los 15 tickets

| Ticket | Iteración | Ticket | Iteración | Ticket | Iteración |
| --- | :-: | --- | :-: | --- | :-: |
| T01 | 1 | T06 | 6 | T11 | 4 (+9) |
| T02 | 1 | T07 | 6 | T12 | 8 |
| T03 | 1 | T08 | 6 | T13 | 2 |
| T04 | 1 | T09 | 3 | T14 | 5 |
| T05 | 1 | T10 | 7 | T15 | 1 (padding) + 8 (fotos) |
