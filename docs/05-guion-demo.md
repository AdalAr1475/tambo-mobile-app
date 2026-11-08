# 05 · Guion de la demo en vivo

**Duración objetivo:** unos 5 min de demo + 2 a 3 min de preguntas.
**Dispositivo:** celular con Expo Go, proyectado.
**Principio:** cada paso muestra **una tecnología** y **un beneficio de negocio** en una frase. Los botones "Simular…" reemplazan lo que en producción haría un dispositivo o un servidor, y se dice así.

El guion es **modular**. La versión base usa las It. 1 a 5 (lo que queda dentro del corte del 80 %). Los pasos marcados como *extensión* se agregan si se completaron It6 o It7.

## Narrativa

> "Tambo vende conveniencia: lo que necesitas, ya. Nuestra propuesta lleva esa conveniencia al terreno **phygital**: la app conoce tus hábitos (IA), te premia (puntos), se adelanta a tu rutina (Auto-Pilot) y te entrega sin colas ni contacto (Smart Lockers y SafeDrop). Todo sobre un e-commerce que funciona de principio a fin."

## Secuencia

| # | Tiempo | Pantalla | Acción en vivo | Qué decir (tecnología → negocio) | It. |
| --- | --- | --- | --- | --- | :-: |
| 0 | 0:00-0:20 | Inicio | Mostrar la cabecera compacta, `✪ 1,200` y la tarjeta Auto-Pilot | "Una sola barra de contexto: dónde, cómo y cuántos puntos tienes." | 1-2 |
| 1 | 0:20-1:10 | Inicio → "Para ti" | Abrir **"¿Por qué veo esto?"** en un combo con 96 % de match. Luego **"Arma tu plan"**: S/ 35, 3 personas, "Noche de patas" → Agregar todo (age gate) | "Motor de recomendación híbrido: historial + hora + presupuesto, explicable y sin enviar tus datos a ningún servidor. → Sube el ticket medio." | 4 |
| 2 | 1:10-2:10 | Carrito → Checkout | Upsell IA (hielo). En Descuentos, filtro **Canjea con puntos** → Café 100 % puntos. Checkout: Para llevar, **Smart Locker**, slot de 20 min, **Yape OTP** con "Simular código" → Confirmar. Volver a Inicio: **carrito limpio** | "Canje al estilo CMR: puntos o puntos + soles. Yape con código de aprobación, como en el e-commerce real. → Retención y conversión." | 1-3 |
| 3 | 2:10-3:10 | Seguimiento pickup | `/demo` → "Adelantar a listo". Panel **Casillero #B04 · 4.2 °C**, QR que cambia cada 30 s. **Abrir casillero** → tótem → escanear → puerta abierta → "Recogido y verificado por IoT" | "Retiro autónomo 24/7: token dinámico + cerradura IoT + sensor de peso. → Cero colas y menos costo de atención." | 3 |
| 4 | 3:10-4:10 | Inicio → Rutinas | Plantilla **"Desayuno oficina"** (L-V 7:00, delivery a la oficina) → guardar → **"Simular disparo de las 7:00 AM"** → banner → pedido creado con 10 % OFF, envío gratis y puntos dobles | "Retail-as-a-subscription: la compra recurrente se automatiza. → Ingreso predecible y planificación de stock." | 5 |
| 5 | 4:10-5:00 | *Extensión* · Seguimiento delivery | **"Simular recorrido GPS"** → la moto recorre calles reales → bajo 50 m aparece **SafeDrop** → "Simular escaneo del motorizado" → Entregado | "Telemetría en tiempo real + handshake QR/PIN: el pedido solo se da por entregado si lo confirma quien lo recibe. → Menos fraude y menos reclamos." | 6 |
| 6 | *Extensión* (apertura alternativa) | Combo → Ver en 3D | Rotar, **vista explosiva** del pan con chicharrón y **proyectar en la mesa** con la cámara | "Previsualización espacial para productos nuevos y combos. → Confianza en la compra." | 7 |
| — | 5:00 | — | Cierre | "Seis pilares sobre una base transaccional sin fallos. Lo simulado (IoT, GPS del repartidor, Yape) tiene un camino claro a producción." | — |

Si It7 está lista, conviene **abrir** con el paso 6 (es lo más vistoso) y acortar el paso 0.

## Checklist previo (el día de la demo)

**Una noche antes**

- [ ] `npm ci`, `npm run typecheck`, `npm run lint` y `npx expo-doctor` en verde.
- [ ] Ensayar el guion completo **3 veces** con cronómetro.
- [ ] **Grabar un video de respaldo** de la demo completa, con la pantalla del teléfono.
- [ ] Cargar el teléfono y la laptop. Tener un cable para espejar (Android: `scrcpy`; iPhone: QuickTime o AirPlay).

**30 minutos antes**

- [ ] Levantar el servidor con `npx expo start --no-dev --minify`: es más fluido que el modo dev. Si la red del aula aísla los dispositivos, usar `--tunnel`.
- [ ] En el teléfono: Modo no molestar, brillo alto, rotación bloqueada y Expo Go actualizado.
- [ ] `/demo` → **Reiniciar demo** → activar **Modo demo** → reloj ×1.
- [ ] Conceder **de antemano** los permisos de cámara y ubicación (abrir una vez el visor AR y el mapa), para que no aparezcan diálogos en vivo.
- [ ] Probar que el mapa carga tiles (indicador en `/demo`). Si no carga, decidir ya si se usa el SVG o se activan los datos móviles.
- [ ] Dejar el teléfono en Inicio.

## Plan B por paso

| Paso | Falla | Plan B |
| --- | --- | --- |
| Cualquiera | La app se cuelga o se pierde el hot reload | Cerrar y reabrir Expo Go. Si persiste, **pasar al video de respaldo** sin perder la narración. |
| 1 | El age gate interrumpe el flujo | Es una función, no un error: "cumplimos la regulación de venta de alcohol". |
| 2 | Puntos insuficientes | `/demo` → "+ Recargar 1,000 pts". |
| 3 | El token venció mientras se explicaba | El tótem muestra "Código vencido": mostrar que el QR se regeneró y volver a escanear. **Es una demostración de seguridad.** |
| 5 | No hay internet en el mapa | El fallback SVG se activa solo ("Mapa sin conexión"). La telemetría y SafeDrop funcionan igual. |
| 6 | Se negó el permiso de cámara o va lento | Usar la foto de mesa de respaldo o la pestaña 3D. |
| 9 (opcional) | El LLM no responde | El fallback al formulario manual es automático. |

## Preguntas probables del docente

| Pregunta | Respuesta sugerida |
| --- | --- |
| "¿Esto es IA de verdad?" | "Es un sistema de recomendación híbrido (contenido + comportamiento + contexto + optimización con presupuesto), como los de retail en producción. Corre en el dispositivo, sin enviar datos personales, y explica cada sugerencia." Si existe It9: "y un LLM interpreta pedidos en lenguaje natural, pero no puede inventar productos ni precios". |
| "¿Cómo sería el locker real?" | "Una cerradura electromecánica y sensores de temperatura y peso por compartimento, conectados a un controlador con red (por ejemplo, MQTT) al backend. El backend emite el token y valida el escaneo. En el prototipo, la app hace el papel de backend y de tótem." |
| "¿El QR es seguro?" | "Cambia cada 30 s y se deriva del pedido + un PIN + la hora, como un código TOTP. En producción se firma con un secreto del servidor (HMAC) y es de un solo uso." |
| "¿Cómo se ejecuta Auto-Pilot con el teléfono apagado?" | "En producción, en el servidor: un cron por rutina + cobro con tarjeta tokenizada. En la demo lo disparamos manualmente." |
| "¿Qué tan rentable es dar 10 % en puntos?" | "Es un parámetro. Los programas reales en Perú devuelven entre 1 % y 3 %. Lo dejamos alto para la demo. Lo importante es el mecanismo de canje mixto, que mueve stock de baja rotación." |
| "¿Por qué no Google Maps?" | "OpenStreetMap no requiere API key ni facturación, y para un prototipo es suficiente. La capa de mapa está aislada en un componente, así que cambiarla es local." |
| "¿El GPS es real?" | "La ubicación del usuario sí (con permiso). La del repartidor se simula sobre una ruta real calculada con OSRM. En producción llegaría desde la app del repartidor por WebSocket." |
| "¿Qué pasa si falla el internet?" | "La app degrada con elegancia: mapa sin conexión, IA local, todo el flujo transaccional funciona." |
