# Tambo+ 2.0 — Planificación

Planificación de las mejoras del prototipo a partir del documento del equipo *"Plan Maestro App Tambo Disruptiva IA"* (15 tickets). Se cruzó cada observación con el código real del repo y se ordenó todo en **iteraciones**: primero las correcciones del flujo base y después las innovaciones, de mayor a menor valor.

> **Meta de la demo:** mostrar al docente un uso disruptivo de la tecnología (IoT, IA, geolocalización, AR, fidelización y suscripción) sobre una base de e-commerce que no falla.

## Decisiones tomadas

| Tema | Decisión | Consecuencia |
| --- | --- | --- |
| Plataforma de la demo | **Celular con Expo Go**, proyectado o espejado. | La web es respaldo: cámara, GPS y AR no se garantizan ahí. No se usan módulos nativos fuera de Expo Go. |
| Mapas | **OpenStreetMap + Leaflet** dentro de `react-native-webview`. | Se ven calles reales de Lima sin API key, pero hace falta internet. Si no hay conexión, se usa el mapa SVG actual (`TrackingMap`). |
| IA | **Motor de recomendación local** (offline y explicable). El LLM real es una iteración **opcional** al final. | Para la demo no se necesitan API keys ni backend. |

## Documentos

| # | Documento | Para qué sirve |
| --- | --- | --- |
| 1 | [01-diagnostico.md](01-diagnostico.md) | Cada observación del PDF contrastada con el código, con su causa raíz real. **Léelo primero:** varias observaciones tienen otra causa de la que supone el PDF. |
| 2 | [02-roadmap.md](02-roadmap.md) | Priorización con puntaje, dependencias, iteraciones y la **línea de corte del 80 %**, Definition of Done, riesgos y trazabilidad de los 15 tickets. |
| 3 | [03-arquitectura.md](03-arquitectura.md) | Estado y persistencia, módulos nuevos, extensiones de `pricing` y `orderProgress`, dependencias y compatibilidad con Expo Go. |
| 4 | [04-ux-ui.md](04-ux-ui.md) | Principios de UX, navegación, cambios pantalla por pantalla, copy y componentes a reutilizar. |
| 5 | [05-guion-demo.md](05-guion-demo.md) | Guion de la presentación en vivo, checklist previo, plan B por paso y preguntas probables del docente. |
| 6 | [06-propuestas-adicionales.md](06-propuestas-adicionales.md) | Mejoras que no estaban en el PDF y que aportan robustez o valor a la demo. |
| — | [iteraciones/](iteraciones/) | **Un archivo autocontenido por iteración**, con tickets, criterios de aceptación y el prompt listo para el agente. |

### Iteraciones

| It. | Archivo | Tickets del PDF |
| --- | --- | --- |
| 1 | [it-01-estabilizacion.md](iteraciones/it-01-estabilizacion.md) | T01, T02, T03, T04, T05, padding de T15 + Modo Presentador |
| 2 | [it-02-tambo-lover-puntos.md](iteraciones/it-02-tambo-lover-puntos.md) | T13 |
| 3 | [it-03-smart-lockers.md](iteraciones/it-03-smart-lockers.md) | T09 (+ infraestructura QR) |
| 4 | [it-04-tambo-ia.md](iteraciones/it-04-tambo-ia.md) | T11 |
| 5 | [it-05-auto-pilot.md](iteraciones/it-05-auto-pilot.md) | T14 |
| — | **Corte ~80 % del valor** | |
| 6 | [it-06-geo-telemetria.md](iteraciones/it-06-geo-telemetria.md) | T07, T06, T08 |
| 7 | [it-07-visor-3d-ar.md](iteraciones/it-07-visor-3d-ar.md) | T10 |
| 8 | [it-08-party-split-y-catalogo.md](iteraciones/it-08-party-split-y-catalogo.md) | T12, fotos de T15 |
| 9 | [it-09-llm-opcional.md](iteraciones/it-09-llm-opcional.md) | Extensión opcional de T11 |

## Cómo trabajar una iteración con el agente de IA

1. Abre el archivo de la iteración y lee el **diagnóstico** de cada ticket. Ahí está el estado real del código, no el que supone el PDF.
2. Pasa al agente **un ticket a la vez** (o la iteración entera si es pequeña) copiando el bloque *Prompt para el agente*. Los prompts ya asumen las reglas de [CLAUDE.md](../CLAUDE.md): tokens del tema, `Txt`/`Tap`/`Button`, `computeTotals`, `npx expo install` y docs de SDK 58.
3. Al cerrar cada ticket: `npm run typecheck` y `npm run lint`. Prueba en **Expo Go** con el checklist del archivo.
4. Al cerrar la iteración: ensaya el paso correspondiente del [guion de demo](05-guion-demo.md) y haz **un commit por iteración** (o por ticket), en español.
5. Si una iteración cambia la forma del estado persistido, sube la `version` del store y escribe su `migrate`, como explica [03-arquitectura.md](03-arquitectura.md#6-persistencia-y-migraciones).

## Glosario

- **Delivery / Para llevar:** `Fulfillment = 'delivery' | 'pickup'`. Es un solo estado global en `useSession`.
- **Modo Presentador:** panel oculto con controles de demo: reiniciar datos, recargar puntos, mostrar los botones "Simular…", etc. Ver It. 1.
- **Tambo Lover Puntos:** billetera de puntos con canje 100 % puntos o puntos + soles, al estilo de CMR Puntos.
- **Tambo Smart Locker:** casillero inteligente para retirar sin colas, con QR dinámico y "telemetría" de temperatura.
- **SafeDrop:** handshake de entrega con QR y PIN entre el repartidor y el cliente.
- **Auto-Pilot:** rutinas de pedidos recurrentes (por ejemplo, desayuno de lunes a viernes a las 7:00 AM).
- **QR dinámico:** token que cambia cada 30 s, derivado del pedido, de un PIN y de la ventana de tiempo.
- **Simulado:** todo lo que en producción haría un backend o un dispositivo físico (IoT, GPS del repartidor, Yape). La app lo representa de forma honesta y con botones de demo.
