# Tambo+ — prototipo de app móvil

Prototipo funcional de la app de delivery de Tambo construido con **React Native + Expo (SDK 58) + TypeScript** y **Expo Router**. Cubre la compra, el checkout, el seguimiento del pedido y el delivery o retiro en tienda. Los diseños base están en [stitch_app_delivery_tambo/](stitch_app_delivery_tambo/), y el sistema de diseño está en [DESIGN.md](stitch_app_delivery_tambo/tambo_digital_retail_system/DESIGN.md).

## Cómo levantarla

Requisitos: Node 20 o superior.

```bash
npm install
npx expo start          # muestra el QR para abrir la app en Expo Go (Android/iOS)
npx expo start --web    # abre la versión web (se centra con ancho de teléfono)
npx expo start --android  # emulador Android
```

La app funciona en **Expo Go** porque no necesita módulos nativos adicionales ni API keys. Los datos son de prueba y se guardan en el dispositivo (AsyncStorage): el carrito, los pedidos, las direcciones y los favoritos siguen ahí aunque cierres la app.

Para volver al estado inicial, borra los datos de la app (en web, el `localStorage` del sitio).

## Flujos implementados

| Flujo | Pantallas |
| --- | --- |
| Compra | Inicio, Categorías, Listado por categoría (subcategorías, orden, filtros por marca y precio, búsqueda), Búsqueda global, Detalle de producto, Promociones |
| Carrito | Bottom sheet con punto de entrega, cantidades, eliminar con *deshacer*, cupones, barra de "delivery gratis" y resumen |
| Checkout | Delivery o Para llevar, dirección y referencia, horario (lo antes posible o programado), pago con Yape/Plin, tarjeta (guardada o nueva, con validación) o efectivo (con cálculo de vuelto) |
| Seguimiento | Pedido confirmado, seguimiento en vivo con mapa y moto animada, pasos con hora, chat con el repartidor, llamada, cancelación, calificación y confirmación de recojo |
| Historial | Mis pedidos (en curso e historial), boleta electrónica y volver a pedir |
| Cuenta | Perfil, Club de puntos con canjes, direcciones (crear, editar, eliminar), métodos de pago, cupones, favoritos, notificaciones, ayuda/FAQ, términos y libro de reclamaciones, cerrar sesión e iniciar sesión |

### Datos para probar

- **Cupones:** `TAMBOAPP` (10%, hasta S/ 8), `TAMBOYA10` (S/ 10 desde S/ 30) y `ENVIOGRATIS` (delivery gratis desde S/ 15).
- **Delivery:** cuesta S/ 4.50 y es gratis desde S/ 40. "Para llevar" no tiene costo de envío.
- **Simulación del pedido (acelerada):** se prepara a los 15 s, sale en camino a los 25 s y se entrega a los 75 s. Un pedido "Para llevar" queda listo a los 30 s. Puedes cancelar en los primeros 15 s.
- **Login:** cualquier correo válido con una contraseña de 6 caracteres o más.
- **Productos con alcohol:** piden confirmar la mayoría de edad (+18) la primera vez.

## Estructura

```
src/
  app/          rutas (Expo Router): (tabs), categoria, producto, carrito, checkout, pedido, perfil, buscar, login
  components/   UI reutilizable (botones, tarjetas, sheets, toasts, mapa de seguimiento, tab bar)
  data/         catálogo, categorías, promociones, tiendas, cupones y pedidos de ejemplo
  lib/          formato de precios, cálculo de totales, simulación del pedido y helpers
  store/        estado global con zustand + persistencia (carrito, sesión, pedidos, UI)
  theme/        tokens del sistema de diseño Tambo (colores, tipografía Inter, radios, sombras)
```

## Calidad

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
npx expo-doctor    # salud del proyecto
```
