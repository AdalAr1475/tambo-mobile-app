# 06 · Propuestas adicionales (fuera del PDF)

Mejoras detectadas al analizar el código y el objetivo de la demo. Cada una indica **dónde encaja** en el roadmap. Las que dicen "incluida" ya están en el archivo de su iteración.

## Robustez de la demo (alta prioridad)

| Propuesta | Por qué | Dónde |
| --- | --- | --- |
| **Modo Presentador** (`/demo`, acceso oculto) | Concentra los controles de simulación, reinicia los datos y evita que la app "se vea prototipo" cuando está apagado. | It1 (incluida) |
| **Reiniciar demo** | Los stores persistidos no tienen `version` ni `migrate`. Un teléfono con datos viejos puede fallar en vivo. | It1 (incluida) |
| **`version` + `migrate` en todos los `persist`** | Casi todas las iteraciones cambian el estado persistido. | It1 en adelante (incluida) |
| **`npx expo install --fix` antes de agregar dependencias** | Hoy `expo-doctor` falla 1 de 20. Instalar paquetes nuevos sobre versiones desalineadas multiplica los errores. | It1 (incluida, en un commit aparte) |
| **Reloj por pedido (`clockOffsetMs` → `simClock`)** | "Adelantar a listo" y "Simular recorrido" necesitan mover **un** pedido sin tocar `DEMO_TIMELINE`. | It1 / It6 (incluida) |
| **Video de respaldo y `--no-dev --minify`** | El modo dev es más lento, y la demo en vivo siempre puede fallar. | [Guion](05-guion-demo.md) (incluida) |

## Correcciones de fondo detectadas

| Propuesta | Hallazgo | Dónde |
| --- | --- | --- |
| **`placeOrder()` / `cancelOrder()`** como transacción única | La lógica de cierre vive dentro del componente del checkout. Auto-Pilot y los canjes la necesitan fuera. | It1 (incluida) |
| **Confirmar antes de reemplazar el carrito** | Es la causa real de T01. Además, `replace()` hereda el cupón viejo. | It1 (incluida) |
| **Revertir puntos y cupón al cancelar** | Hoy, al cancelar, los puntos quedan sumados y el cupón queda marcado como usado. | It2 (incluida) |
| **Ledger de puntos** | Hace falta para revertir, auditar y mostrar "Movimientos", y para calcular el nivel por puntos históricos. | It2 (incluida) |
| **`useAddManyToCart()` con age gate** | La IA, Auto-Pilot y favoritos agregan varios productos a la vez. Sin un helper, el age gate se repetiría en 5 sitios. | It4 (incluida) |
| **Los pedidos pickup no se completaban solos** | Dependían de "Ya recogí". El locker los cierra por verificación. | It3 (incluida) |

## Valor para la exposición

### Panel de impacto (Modo Presentador) · opcional, It8

Una pantalla en `/demo/impacto` que calcula **con los pedidos locales** las métricas que cada función mueve. No inventa números: son indicadores sobre los datos de la demo, que sirven para *hablar de negocio* con el docente.

| Función | KPI de negocio | Cálculo en la demo |
| --- | --- | --- |
| Tambo IA | Ticket medio, tasa de aceptación del upsell | Promedio de `totals.total`; % de pedidos con un ítem agregado desde la IA (marcar con `source: 'ai'` en el `CartItem`) |
| Tambo Lover | Puntos emitidos / canjeados, % de pedidos con canje | Suma del ledger |
| Smart Lockers | % de retiros autónomos, tiempo de retiro | Pedidos `pickupMethod: 'locker'`; `verifiedAt − listo` |
| Auto-Pilot | Ingreso recurrente mensual proyectado | Suma de `monthlyEstimate` de las rutinas activas |
| SafeDrop | % de entregas verificadas | `verifiedAt` en delivery |

### Accesibilidad

El equipo señaló: *"un ciego como yo o apurado…"*. Además de evitar recompras accidentales (T01), se propone:

- `accessibilityLabel` en los badges y CTAs;
- anunciar cambios de estado con `AccessibilityInfo.announceForAccessibility` ("Tu pedido está listo en el casillero B04");
- áreas táctiles de 44 px o más;
- contraste AA.

Va en It8.3. Es un argumento de **inclusión** que suma en la evaluación.

### Handshake real entre dos dispositivos (sin backend)

Para el locker (It3) y SafeDrop (It6): la laptop muestra el QR del "tótem" o del "repartidor" y el teléfono lo escanea con `expo-camera`. Ambos derivan el token de los mismos datos, así que la verificación es real aunque no haya servidor. Convierte un "botón simulado" en un **escaneo con cámara de verdad** frente al docente. Es opcional dentro de It3 e It6.

## Más allá del prototipo (para la sección "trabajo futuro" de la exposición)

| Capa | Propuesta |
| --- | --- |
| Backend | Supabase o Firebase: auth, pedidos, rutinas (cron) y tokens firmados (HMAC) |
| Pagos | Pasarela peruana (Niubiz, Izipay, Culqi o Mercado Pago) con tarjeta tokenizada para Auto-Pilot. Yape mediante su integración para comercios. |
| Notificaciones | `expo-notifications` + push remotas (requieren development build y credenciales) |
| Repartidor | App del repartidor que publica su ubicación por WebSocket y escanea el SafeDrop |
| IoT | Lockers con controlador (por ejemplo, ESP32) + MQTT + sensores de temperatura y peso |
| AR real | Development build con ARKit/ARCore (detección de planos) |
| Analítica | Eventos de producto (recomendación vista, aceptada; canje; rutina creada) para medir los KPIs reales |

## Proceso de trabajo sugerido

- **Una rama y un PR por iteración** (`it-01-estabilizacion`, …), con un commit por sub-ticket, en español.
- Antes de pasar a la siguiente iteración: **checklist de regresión de It1** + "Reiniciar demo" + ensayo del paso del guion.
- Al terminar cada iteración, actualizar **CLAUDE.md** si cambió algo que el agente deba saber: stores nuevos, helpers obligatorios o sitios del age gate.
