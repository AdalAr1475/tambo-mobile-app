# Tambo+ — prototipo de app móvil

Prototipo universitario de Tambo en **Expo SDK 58, React Native 0.88, React 19 y TypeScript**, con Expo Router. Implementa las iteraciones 1 a 8 de [docs/](docs/README.md). Los diseños están en [stitch_app_delivery_tambo/](stitch_app_delivery_tambo/) y el sistema visual en [DESIGN.md](stitch_app_delivery_tambo/tambo_digital_retail_system/DESIGN.md).

## Cómo levantarla

Requiere Node compatible con Expo SDK 58 y npm (el repositorio usa `package-lock.json`).

```bash
npm ci
npx expo start          # Expo Go en Android/iOS: plataforma principal de la demo
npx expo start --web    # respaldo web, centrado a 480 px
```

No necesita backend, API keys ni development build. El texto libre de Tambo IA (It9) es opcional: copia `.env.example` como `.env` y pon tu `EXPO_PUBLIC_GEMINI_API_KEY` (modo de desarrollo: la key queda dentro del bundle). Para presentar sin exponer la key, despliega el proxy de [`proxy/`](proxy/README.md) y usa `EXPO_PUBLIC_AI_PROXY_URL`. Sin variables se usa el formulario. Carrito, sesión, pedidos, puntos y rutinas persisten en AsyncStorage. Los pagos, sensores IoT, repartidor y verificación del QR se simulan; no se realiza ningún cobro. Los mapas nativos descargan tiles de CARTO/OSM; en web o sin conexión usan un mapa SVG de respaldo.

## Flujos implementados

| Flujo | Comportamiento |
| --- | --- |
| Compra y carrito | Categorías, filtros, búsqueda, favoritos, promociones por paquete, cupones, deshacer, envío gratis y volver a pedir sin perder el carrito actual |
| Checkout | Delivery / Para llevar, dirección, referencia, horarios reales, Yape con código de 6 dígitos, Plin, tarjetas y efectivo con vuelto; validación de mayoría de edad |
| Tambo Lover Puntos | Saldo, movimientos, niveles, canje 100% puntos, puntos + soles y descuento libre sobre productos |
| Smart Lockers | Retiro en casillero o mostrador, QR dinámico cada 30 s, PIN, reserva y telemetría demostrativa; el retiro termina con la verificación |
| Tambo IA | Recomendaciones locales explicables, complementos y plan por presupuesto. Opcional (It9): pedir el plan en lenguaje natural; Gemini (directo con key en `.env` o vía un proxy propio) interpreta el texto y el motor local elige productos y precios |
| Auto-Pilot | Rutinas editables, pausa, saltar una fecha, próxima entrega y estimación mensual; 10% en productos, envío gratis y puntos dobles |
| Geo y SafeDrop | Tienda cercana, distancias, cobertura, GPS opcional, ruta real precalculada y entrega mediante QR/PIN |
| Tambo Spatial | Visor 3D procedural y AR sobre cámara en celular; escala real y foto de mesa como respaldo web |
| Party Split | De 2 a 5 personas, partes iguales o líneas por producto, nombres editables, solicitudes Yape para compartir y progreso; confirmar exige todas las cuotas pagadas |
| Historial y cuenta | Seguimiento, cancelación con devolución de puntos/cupón, boleta con cuotas Party Split, calificación, perfil, direcciones, pagos y ayuda |
| Catálogo y accesibilidad | Fotos locales para los 38 productos, controles etiquetados, progreso accesible, precios con `money()` y copy Delivery / Para llevar |

### Modo Presentador y datos para probar

Mantén presionada **2 segundos la foto de Perfil** para abrir `/demo`. Activa los controles de simulación. Allí puedes reiniciar los datos, recargar **1000 puntos**, elegir reloj ×1/×3, activar el GPS real y crear o adelantar pedidos. Reiniciar restaura los datos y conserva la configuración del presentador.

- **Login:** cualquier correo válido y contraseña de al menos 6 caracteres. La sesión inicial ya está abierta.
- **Cupones:** `TAMBOAPP` (10%, máximo S/ 8.00), `TAMBOYA10` (S/ 10.00 desde S/ 30.00) y `ENVIOGRATIS` (desde S/ 15.00). Un cupón usado queda disponible de nuevo al cancelar el pedido.
- **Envío:** S/ 4.50; gratis desde S/ 40.00 en productos pagados en soles. Para llevar es gratis.
- **Puntos:** saldo inicial 1200; 100 pts equivalen a S/ 1.00. Café americano: 350 pts o 200 pts + S/ 1.50. Se acumulan 10 pts por sol pagado en productos; el envío no acumula.
- **Yape:** celular de 9 dígitos que empieza con 9 (ejemplo ficticio `987654321`) y código de 6 dígitos. Con Presentador, “Simular código Yape” completa la aprobación.
- **Party Split:** elige Yape o tarjeta, activa “¿Compras en mancha?”, selecciona 2–5 personas, completa tu medio de pago y pulsa **Autorizar mi parte**. “⚡ Simular pagos Yape de amigos” paga una cuota cada 800 ms. Compartir una solicitud no marca el pago. La boleta conserva el reparto al reiniciar la app.
- **Ejemplos de split (Para llevar, sin puntos ni cupón):** 3 packs Four Loko Gold = S/ 44.70, entre 3 = S/ 14.90 cada uno; croissant + lejía = S/ 10.00, entre 3 = S/ 3.34 / S/ 3.33 / S/ 3.33. El residuo queda en el anfitrión. Al cambiar el total, los productos, el reparto o el medio de pago se requieren nuevas autorizaciones. En modo por producto el envío se divide por igual y los descuentos de cupón/puntos se prorratean sobre los soles de las líneas.
- **Seguimiento a ×1:** preparación 15 s, salida 25 s, llegada 75 s; Para llevar listo a los 30 s. Se puede cancelar antes de los 15 s. Los pedidos nuevos esperan verificación QR/PIN para completar la entrega o el retiro.
- **Auto-Pilot:** prueba “Desayuno oficina” o crea una rutina desde el carrito. Solo se ejecuta con la app abierta, dentro de los 10 minutos posteriores a la hora; puedes dispararla desde el control de demo.
- **3D/AR:** prueba Four Loko Gold, Sandía, café, capuccino y pan con chicharrón. Cámara, permisos GPS y hoja de compartir se deben comprobar en Expo Go.
- **Alcohol:** confirmar +18 al agregar productos, combos o favoritos, crear rutinas y confirmar checkout. “Volver a pedir” vuelve a validar en checkout.

### Fotos del catálogo

Las 19 fotos añadidas en It. 8 son referenciales de Pexels, con origen comentado en `src/data/products.ts` y [manifiesto de fuentes/licencias](docs/catalogo-imagenes.json). No representan necesariamente el empaque de la marca: el detalle del producto lo indica. Son JPG de 800 × 800, de menos de 80 KB cada una. Se eliminaron los dos thumbnails sin uso y la subcategoría Postres vacía.

Para regenerarlas: `python scripts/build-catalog-images.py` (requiere Pillow y curl; omite archivos existentes). No se añadieron dependencias a la app en esta iteración.

## Estructura y persistencia

```text
src/app/          rutas Expo Router: compra, puntos, IA, rutinas, locker, visor, pedidos y perfil
src/components/   UI compartida; PartySplit, mapas, QR, sensores y visor espacial
src/data/         catálogo, coordenadas y rutas precalculadas, tiendas y datos de ejemplo
src/lib/          pricing, split, placeOrder/cancelOrder, puntos, IA, geo y rutinas
src/store/        zustand + AsyncStorage; UI efímera
src/theme/        colores, tipografía, espaciados y MAX_APP_WIDTH
```

| Store | Clave | Versión |
| --- | --- | --- |
| `useCart` | `tambo-cart` | 2 |
| `useSession` | `tambo-session` | 3 |
| `useOrders` | `tambo-orders` | 3 |
| `useDemo` | `tambo-demo` | 1 |
| `useWallet` | `tambo-wallet` | 1 |
| `useRoutines` | `tambo-routines` | 1 |

`useUi` no persiste. `placeOrder()` centraliza totales, validación del split, guardado, puntos, cupón y vaciado del carrito; Auto-Pilot usa `clearCart: false`. `cancelOrder()` revierte puntos y libera el cupón. Los pedidos antiguos se conservan sin `split`.

Las iteraciones anteriores incorporaron `expo-crypto` y `qrcode-generator` (QR), `react-native-webview` y `expo-location` (mapas/GPS), `three` **0.162.0**, `@types/three`, `expo-gl`, `expo-asset` y `expo-camera` (3D/AR). Mantén three fijado: versiones posteriores requieren WebGL 2, incompatible con este visor en Expo Go.

## Calidad

```bash
npm run typecheck
npm run lint
npm run test:split    # cálculo exacto, canjes y validación de placeOrder; sin dependencias adicionales
npm run test:plan     # Arma tu plan con restricciones y cliente de Tambo IA (fallbacks, timeout, allowlist)
npx expo export --platform web
npx expo-doctor
```

Pendiente de verificación manual en Expo Go: hoja de compartir, simulación secuencial, boleta tras recargar, VoiceOver/TalkBack y flujo completo en pantalla pequeña. La revisión visual automatizada de It. 8 se interrumpió porque el control del equipo no pudo verificar la URL de Chrome.
