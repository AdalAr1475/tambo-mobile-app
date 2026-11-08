# Iteración 8 · Party Split, catálogo con fotos y pulido final

**Tickets:** T12 (Party Split), T15 (fotos del catálogo) y el pulido general.
**Objetivo:** cerrar con un diferenciador social y dejar el catálogo con aspecto de producto terminado.
**Esfuerzo:** S · **Dependencias nuevas:** ninguna.

---

## 8.1 · T12 · Tambo Party Split ("¿Compras en mancha?")

**Valor:** menor que el de las otras mejoras (Yape ya permite cobrar entre amigos), pero sube el tamaño de los pedidos grupales ("previa", "oficina") y le da una buena historia a la demo.

**Funcional**

- En el checkout, sección Pago, con método Yape o tarjeta: el toggle **"👥 ¿Compras en mancha? Dividir pago"**.
- **Modo partes iguales:** stepper de 2 a 5 personas. `splitEqual(total, n)` reparte con `round2` y **el residuo de céntimos queda en el anfitrión** (S/ 44.70 entre 3 = 14.90 × 3; S/ 10.00 entre 3 = 3.34 + 3.33 + 3.33).
- **Modo por producto:** se asigna cada línea a un participante con chips de avatar. El envío se reparte en partes iguales. `splitByItems(lines, assignment, shipping)` usa `lineTotal`.
- **Participantes:**
  - "Tú (anfitrión)" paga con el método elegido;
  - el resto aparece como "Amigo 1…" o con un nombre editable;
  - cada uno tiene un botón "Enviar solicitud Yape", que abre la hoja de compartir de RN (`Share.share`) con un mensaje y el monto.
- **Progreso:** la barra "2 de 3 pagaron · S/ 29.80 / S/ 44.70". En `<DemoOnly>`, **"⚡ Simular pagos Yape de amigos"** marca a cada amigo como `Pagado con Yape ✓` en secuencia (800 ms).
- **`CONFIRMAR PEDIDO`** se habilita solo cuando todos pagaron.
- **Compatibilidad con puntos (It2):** el split se aplica al **total en soles después del canje**.
- `Order.split` queda guardado. La boleta muestra el detalle por participante.

**Criterios de aceptación**

- [ ] S/ 44.70 entre 3 → 14.90 c/u. S/ 10.00 entre 3 → 3.34 / 3.33 / 3.33. La suma siempre es igual al total.
- [ ] Por producto: los montos coinciden con `lineTotal` + envío / n.
- [ ] No se puede confirmar con pagos pendientes. "Simular pagos" completa la barra y habilita el botón.

**Prompt para el agente**

```
Iteración 8.1 de docs/iteraciones/it-08-party-split-y-catalogo.md (T12). Crea src/lib/split.ts
(splitEqual con round2 y residuo al anfitrión; splitByItems con lineTotal y envío prorrateado),
Order.split en types.ts, y en checkout.tsx el toggle "¿Compras en mancha?" con los modos partes
iguales y por producto, la lista de participantes con Share.share, la barra de progreso, "Simular
pagos Yape de amigos" en <DemoOnly> y la validación que bloquea CONFIRMAR hasta que todos paguen.
Pásalo a placeOrder y muéstralo en la boleta pedido/[id].tsx. Typecheck + lint.
```

---

## 8.2 · T15 · Fotos del catálogo

**Estado:** 19 de 38 productos usan un ícono (lista completa en el [diagnóstico](../01-diagnostico.md#t15--catálogo-e-imágenes)). Cafetería tiene 0 de 3 fotos y *Postres* está vacía.

**Prioridad de las fotos** (según qué se ve en la demo):

1. **Cafetería:** `cafe-americano`, `capuccino`, `croissant`. Salen en IA, en Auto-Pilot, en el canje y en el visor 3D.
2. `hielo-2kg` y `agua-sanluis`, que aparecen en el upsell y en las plantillas.
3. `doritos`, `hot-dog` y `aji-gallina` (comida lista y snacks).
4. Lácteos, abarrotes, limpieza y cuidado.

**Reglas de contenido**

- **Fuentes:** fotos propias tomadas en una tienda o con producto comprado (fondo blanco, luz natural) o bancos con licencia libre (Unsplash o Pexels: guardar la URL de origen en un comentario).
- **No usar** imágenes con copyright de la web de Tambo ni de las marcas sin permiso.
- **Formato:** JPG cuadrado de 800 × 800, menos de 80 KB, en `assets/images/<id>.jpg`, registrado en el mapa `img` de `src/data/products.ts`.
- Hay que reutilizar o eliminar `fourloko-thumb.jpg` y `lays-thumb.jpg`, que hoy no se usan.
- **Opcional:** 2 productos para *Postres* (por ejemplo, un alfajor y un queque), o quitar la subcategoría.

**Criterios de aceptación**

- [ ] Ningún producto de Cafetería, Comida lista ni Bebidas muestra ícono.
- [ ] El peso total de `assets/images` crece menos de 1.5 MB.
- [ ] Cada imagen nueva tiene su origen documentado.

---

## 8.3 · Pulido final y accesibilidad

- `accessibilityLabel` y `accessibilityRole` en: el badge de la bolsa ("3 productos en tu carrito"), `FloatingCartBar`, la píldora de puntos, los CTAs principales, el `OtpInput` y los botones "Simular…".
- Contraste: revisar el texto dorado sobre fondo claro (WCAG AA).
- Revisar todos los textos: la consistencia de "Para llevar" vs. "Recojo", tildes y `money()` en todas partes.
- Que ninguna pantalla nueva rompa el ancho centrado en web (`MAX_APP_WIDTH`).
- Opcional: el **Panel de impacto** del Modo Presentador (ver [propuestas](../06-propuestas-adicionales.md)).
- Actualizar [README.md](../../README.md) (flujos implementados y datos para probar) y [CLAUDE.md](../../CLAUDE.md) (stores nuevos, `placeOrder`, Modo Presentador y sitios del age gate).

**Prompt para el agente**

```
Iteración 8.3 de docs/iteraciones/it-08-party-split-y-catalogo.md. Haz una pasada de accesibilidad
(accessibilityLabel/Role en los elementos listados), de consistencia de copy y de contraste, y
actualiza README.md y CLAUDE.md con lo construido en las iteraciones 1 a 8 (stores nuevos y su
clave de persistencia, placeOrder/cancelOrder, Modo Presentador, sitios del age gate, dependencias
nuevas, datos de prueba). Typecheck + lint.
```
