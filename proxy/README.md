# Proxy de Tambo IA (It9)

Cloudflare Worker mínimo entre la app y la API de Gemini. **Es opcional:** para desarrollar basta con poner `EXPO_PUBLIC_GEMINI_API_KEY` en `.env` (modo directo, ver `.env.example`). El proxy sirve para presentar sin que la key quede dentro del bundle de la app. La app le envía el texto que escribe el usuario en **Arma tu plan**. El Worker devuelve solo parámetros validados (`budget`, `people`, `vibe`, `noAlcoholFor`, `constraints`, `maxItems`). Los productos y precios los sigue eligiendo `buildPlan()` en el teléfono.

**Con el proxy, la API key nunca va en la app ni en el repo.** Vive solo como secreto del Worker.

## Desplegar (una vez)

Necesitas una cuenta gratuita de Cloudflare y una API key de Gemini (Google AI Studio → *Get API key*).

```bash
cd proxy
npx wrangler login                      # abre el navegador
npx wrangler secret put GEMINI_API_KEY  # pega la key cuando la pida (no queda en ningún archivo)
npx wrangler deploy                     # imprime la URL, p. ej. https://tambo-ia-proxy.<tu-cuenta>.workers.dev
```

Luego, en el `.env` de la raíz de la app (está en `.gitignore`), pon la URL **del proxy** y deja vacía `EXPO_PUBLIC_GEMINI_API_KEY` para que la key no entre en el bundle:

```bash
EXPO_PUBLIC_AI_PROXY_URL=https://tambo-ia-proxy.<tu-cuenta>.workers.dev
```

Reinicia `npx expo start` para que Expo lea la variable. Sin ella, la pantalla funciona solo con el formulario manual.

## Probar el Worker

```bash
curl -s -X POST https://tambo-ia-proxy.<tu-cuenta>.workers.dev/intent \
  -H "Content-Type: application/json" \
  -d '{"text":"somos 4, vamos a ver el partido, tenemos 50 soles y uno no toma alcohol"}'
# {"relevant":true,"budget":50,"people":4,"vibe":"patas","noAlcoholFor":1,"constraints":[],"maxItems":null}
```

Si responde `{"error":"upstream"}`, revisa el motivo con `npx wrangler tail`. El log muestra solo el código HTTP de Gemini, nunca la key.

- **400:** el modelo o el campo `responseJsonSchema` cambiaron. Confirma ambos en la documentación vigente de la API de Gemini.
- **403:** la key es inválida.
- **429:** se agotó la cuota gratuita.

## Configuración

| Qué | Dónde | Valor por defecto |
| --- | --- | --- |
| `GEMINI_API_KEY` | secreto (`wrangler secret put`) | — (obligatorio) |
| `GEMINI_MODEL` | `wrangler.toml` → `[vars]` | `gemini-3.5-flash-lite` (estable, rápido, con nivel gratuito) |
| `ALLOWED_ORIGINS` | `wrangler.toml` → `[vars]` | `*`. Para la web puedes restringirlo, p. ej. `http://localhost:8081`. La app nativa no envía `Origin`. |

## Protecciones

- **Un solo endpoint:** solo responde a `POST /intent`. Rechaza cuerpos de más de 2 KB y textos de más de 280 caracteres.
- **Límite de tasa:** 8 consultas por minuto por IP. Se cuenta por instancia del Worker, así que es *best effort*; alcanza para la demo. En producción se usaría el rate limiting de Cloudflare.
- **Salida estructurada:** Gemini responde con `responseJsonSchema` y el Worker la vuelve a filtrar con un allowlist (`sanitize`). La app la valida otra vez en `src/lib/aiIntent.ts`.
- **Sin seguir instrucciones del usuario:** el prompt trata el texto como dato. Aunque alguien intente manipularlo, solo pueden salir los campos permitidos.
- **Timeout:** 5 s hacia Gemini. La app corta a los 6 s y vuelve al formulario con el toast "Usamos el modo sin conexión".

> **Nivel gratuito de Gemini:** Google puede usar las consultas para mejorar sus productos. Aquí solo viaja el texto del plan. No se envían datos personales, carrito ni ubicación.
