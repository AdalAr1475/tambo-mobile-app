// Pruebas de "Arma tu plan" con restricciones y del cliente de Tambo IA (It9), sin red ni Expo Go.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const cache = new Map();
// URL ficticia (modo proxy por defecto): las pruebas inyectan su propio `fetch`, nunca salen a la red.
process.env.EXPO_PUBLIC_AI_PROXY_URL = 'https://proxy.test/';

function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  const localRequire = (id) => {
    if (/\.(jpg|png)$/.test(id)) return 1;
    const resolved = id.startsWith('@/')
      ? path.join(root, 'src', id.slice(2))
      : path.resolve(path.dirname(file), id);
    if (resolved.endsWith('.json')) return JSON.parse(fs.readFileSync(resolved, 'utf8'));
    return load(`${resolved}.ts`);
  };
  new Function('require', 'module', 'exports', 'process', source)(
    localRequire,
    module,
    module.exports,
    process,
  );
  return module.exports;
}

const { getProduct } = load(path.join(root, 'src/data/products.ts'));
const { buildPlan, planSlots } = load(path.join(root, 'src/lib/recommender.ts'));
const { parseIntent, interpretIntent, intentMode, IntentError, INTENT_TIMEOUT_MS } = load(
  path.join(root, 'src/lib/aiIntent.ts'),
);

const products = (plan) => plan.items.map((i) => getProduct(i.productId));
const reason = (promise) =>
  promise.then(
    () => assert.fail('se esperaba IntentError'),
    (e) => {
      assert.ok(e instanceof IntentError);
      return e.reason;
    },
  );

test('ejemplo del partido: S/ 50, 4 personas, 1 no toma → plan ≤ S/ 50 con bebida sin alcohol', () => {
  const plan = buildPlan({ budget: 50, people: 4, vibe: 'patas', constraints: { noAlcoholFor: 1 } });
  assert.equal(plan.ok, true);
  assert.ok(plan.total <= 50, `total ${plan.total}`);
  const sober = plan.items.find((i) => i.slotLabel === 'Sin alcohol');
  assert.ok(sober, 'falta la bebida sin alcohol');
  assert.equal(getProduct(sober.productId).alcoholic, undefined);
  assert.match(sober.note, /para 1 persona$/);
  const drinks = plan.items.find((i) => i.slotKey === 'drinks');
  assert.match(drinks.note, /para 3 personas$/, 'el alcohol se calcula solo para los que toman');
});

test('nadie toma: no queda ningún producto con alcohol ni gaseosa duplicada', () => {
  const plan = buildPlan({ budget: 60, people: 4, vibe: 'patas', constraints: { noAlcoholFor: 99 } });
  assert.equal(plan.ok, true);
  assert.equal(plan.hasAlcohol, false);
  assert.ok(products(plan).every((p) => !p.alcoholic));
  const slots = planSlots('patas', 4, { noAlcoholFor: 99 });
  assert.equal(new Set(slots.map((s) => s.key)).size, slots.length);
  assert.equal(slots.filter((s) => s.options.includes('incakola-zero')).length, 1);
});

test('sin restricciones el plan no cambia respecto de It4', () => {
  for (const vibe of ['patas', 'estudio', 'desayuno', 'dulce']) {
    assert.deepEqual(
      buildPlan({ budget: 35, people: 3, vibe }),
      buildPlan({ budget: 35, people: 3, vibe, constraints: {} }),
    );
  }
});

test('vegetariano, dulce, bebida caliente y máximo de productos', () => {
  const veg = buildPlan({ budget: 30, people: 3, vibe: 'desayuno', constraints: { vegetarian: true } });
  assert.ok(veg.ok && products(veg).every((p) => p.categoryId !== 'comida'));

  const sweet = buildPlan({ budget: 60, people: 3, vibe: 'patas', constraints: { sweet: true } });
  assert.ok(sweet.ok && sweet.items.some((i) => i.slotKey === 'sweet'));

  const hot = buildPlan({ budget: 25, people: 2, vibe: 'estudio', constraints: { hotDrinks: true } });
  assert.ok(hot.ok);
  assert.ok(
    ['cafe-americano', 'capuccino'].includes(hot.items.find((i) => i.slotKey === 'energy').productId),
  );

  const short = buildPlan({ budget: 100, people: 3, vibe: 'patas', constraints: { maxItems: 2 } });
  assert.ok(short.ok && short.items.length === 2 && short.coverage === 1);
});

test('"Cambiar" no puede forzar un producto que la restricción retiró', () => {
  const plan = buildPlan(
    { budget: 30, people: 2, vibe: 'desayuno', constraints: { vegetarian: true } },
    { bread: 'empanada-carne' },
  );
  assert.ok(plan.ok && !plan.items.some((i) => i.productId === 'empanada-carne'));
});

test('parseIntent: allowlist de campos y valores', () => {
  assert.deepEqual(
    parseIntent({
      relevant: true,
      budget: 50,
      people: 4,
      vibe: 'patas',
      noAlcoholFor: 1,
      constraints: ['sweet', 'drop_table', 'sweet'],
      maxItems: 0,
      extra: 'se ignora',
    }),
    { budget: 50, people: 4, vibe: 'patas', constraints: { noAlcoholFor: 1, sweet: true } },
  );
  assert.deepEqual(
    parseIntent({ relevant: true, budget: -3, people: 2.5, vibe: 'toString', constraints: 'x', maxItems: 4 }),
    { budget: null, people: null, vibe: null, constraints: { maxItems: 4 } },
  );
  assert.equal(parseIntent({ relevant: false, budget: 50 }), null);
  assert.throws(() => parseIntent('hola'), IntentError);
});

test('interpretIntent: respuesta válida, sin red, límite de tasa, irrelevante y timeout ≤ 6 s', async () => {
  const ok =
    (body, status = 200) =>
    async (url, init) => {
      assert.equal(url, 'https://proxy.test/intent');
      assert.deepEqual(JSON.parse(init.body), { text: 'somos 2' });
      return new Response(JSON.stringify(body), { status });
    };
  const intent = await interpretIntent('  somos 2  ', ok({ relevant: true, people: 2, vibe: 'estudio' }));
  assert.equal(intent.people, 2);

  assert.equal(await reason(interpretIntent('somos 2', ok({ relevant: false }))), 'irrelevant');
  assert.equal(await reason(interpretIntent('somos 2', ok({ error: 'rate_limited' }, 429))), 'rate');
  assert.equal(await reason(interpretIntent('somos 2', ok({ error: 'upstream' }, 502))), 'invalid');
  const offline = async () => {
    throw new TypeError('Network request failed');
  };
  assert.equal(await reason(interpretIntent('somos 2', offline)), 'offline');

  const hang = (_url, init) =>
    new Promise((_resolve, reject) =>
      init.signal.addEventListener('abort', () => reject(new Error('aborted'))),
    );
  const start = Date.now();
  assert.equal(await reason(interpretIntent('somos 2', hang)), 'timeout');
  assert.ok(Date.now() - start <= INTENT_TIMEOUT_MS + 500);
});

test('modo directo: llama a Gemini con la key en el header y valida su salida estructurada', async () => {
  const config = { proxyUrl: '', geminiKey: 'clave-de-prueba', model: '' };
  const gemini = (output) => async (url, init) => {
    assert.equal(
      url,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    );
    assert.equal(init.headers['x-goog-api-key'], 'clave-de-prueba');
    assert.ok(!url.includes('clave-de-prueba'), 'la key no va en la URL');
    const body = JSON.parse(init.body);
    assert.equal(body.contents[0].parts[0].text, 'somos 4 y uno no toma');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseJsonSchema.properties.vibe.enum.includes('patas'));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: output }] } }] }));
  };
  const out = JSON.stringify({
    relevant: true,
    budget: 50,
    people: 4,
    vibe: 'patas',
    noAlcoholFor: 1,
    constraints: [],
    maxItems: 0,
  });
  assert.deepEqual(await interpretIntent('somos 4 y uno no toma', gemini(out), config), {
    budget: 50,
    people: 4,
    vibe: 'patas',
    constraints: { noAlcoholFor: 1 },
  });
  assert.equal(
    await reason(interpretIntent('somos 4 y uno no toma', gemini('no es json'), config)),
    'invalid',
  );
  const forbidden = async () => new Response('{}', { status: 403 });
  assert.equal(await reason(interpretIntent('hola', forbidden, config)), 'invalid');
});

test('prioridad de modos: proxy > key directa > solo formulario', async () => {
  assert.equal(intentMode({ proxyUrl: 'https://p', geminiKey: 'k', model: '' }), 'proxy');
  assert.equal(intentMode({ proxyUrl: '', geminiKey: 'k', model: '' }), 'direct');
  assert.equal(intentMode({ proxyUrl: '', geminiKey: '', model: '' }), 'off');
  const never = async () => assert.fail('no debe llamar a la red');
  const off = { proxyUrl: '', geminiKey: '', model: '' };
  assert.equal(await reason(interpretIntent('somos 2', never, off)), 'unconfigured');
});
