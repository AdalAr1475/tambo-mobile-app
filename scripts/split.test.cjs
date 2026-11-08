// Pruebas de dominio sin Expo Go ni dependencias nuevas. TypeScript ya pertenece al proyecto.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const cache = new Map();
const writes = [];
const orders = [];
const ledger = [{ delta: 1200 }];
const mocks = {
  '@/store/cart': {
    toCartLines: (items) => items.map((i) => ({ product: getProduct(i.productId), qty: i.qty, redeem: i.redeem })),
    useCart: { getState: () => ({ clear: () => writes.push('cart') }) },
  },
  '@/store/orders': {
    newOrderId: () => 'TB-SPLIT-TEST', timestamp: () => 1234,
    useOrders: { getState: () => ({ orders, place: (order) => { orders.push(order); writes.push('order'); } }) },
  },
  '@/store/session': {
    useSession: { getState: () => ({ markCouponUsed: () => writes.push('coupon') }) },
  },
  '@/store/wallet': {
    balanceOf: (entries) => entries.reduce((sum, e) => sum + e.delta, 0),
    useWallet: { getState: () => ({ ledger, apply: () => writes.push('wallet') }) },
  },
};

// Solo sustituye los stores (efectos); pricing, catálogo, canjes y placeOrder son los reales.
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: file,
  }).outputText;
  const localRequire = (id) => {
    if (mocks[id]) return mocks[id];
    if (/\.(jpg|png)$/.test(id)) return 1;
    const resolved = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id);
    if (resolved.endsWith('.json')) return JSON.parse(fs.readFileSync(resolved, 'utf8'));
    return load(`${resolved}.ts`);
  };
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}

const { getProduct } = load(path.join(root, 'src/data/products.ts'));
const { computeTotals } = load(path.join(root, 'src/lib/pricing.ts'));
const { splitEqual, splitByItems, validateSplit } = load(path.join(root, 'src/lib/split.ts'));
const { placeOrder } = load(path.join(root, 'src/lib/placeOrder.ts'));
const centSum = (shares) => shares.reduce((sum, s) => sum + Math.round(s * 100), 0);
const linesOf = mocks['@/store/cart'].toCartLines;

test('partes iguales: ejemplos de aceptación, céntimos y suma exacta entre 2 y 5', () => {
  assert.deepEqual(splitEqual(44.70, 3), [14.9, 14.9, 14.9]);
  assert.deepEqual(splitEqual(10, 3), [3.34, 3.33, 3.33]);
  assert.deepEqual(splitEqual(44.69, 3), [14.89, 14.9, 14.9]);
  assert.deepEqual(splitEqual(0.03, 5), [0.03, 0, 0, 0, 0]);
  for (let total = 0; total <= 10000; total++) {
    for (let n = 2; n <= 5; n++) {
      const shares = splitEqual(total / 100, n);
      assert.equal(centSum(shares), total);
      assert.ok(shares.every((s) => s >= 0 && Number.isFinite(s)));
      assert.ok(shares.slice(1).every((s) => s === shares[1]));
    }
  }
  for (const n of [0, 1, 6, 2.5]) assert.throws(() => splitEqual(10, n));
  for (const amount of [-1, NaN, Infinity]) assert.throws(() => splitEqual(amount, 3));
});

test('por producto usa paquetes promocionales y envío igual, incluyendo participantes sin productos', () => {
  const lines = linesOf([{ productId: 'monster', qty: 3 }, { productId: 'cafe-americano', qty: 1 }]);
  assert.deepEqual(splitByItems(lines, [0, 1], 4.5, 2), [24.05, 5.75]);
  assert.deepEqual(splitByItems(lines, [0, 1], 4.5, 3), [23.3, 5, 1.5]);
  assert.throws(() => splitByItems(lines, [0], 4.5, 3));
  assert.throws(() => splitByItems(lines, [0, 3], 4.5, 3));
});

test('canje 100%, mixto, descuento libre y cupón: se reparte únicamente el total final en soles', () => {
  const lines = linesOf([
    { productId: 'empanada-carne', qty: 1, redeem: 'points' },
    { productId: 'cafe-americano', qty: 1, redeem: 'mixed' },
    { productId: 'monster', qty: 2 },
  ]);
  const totals = computeTotals(lines, 'delivery', 'TAMBOAPP', { pointsToUse: 100 });
  assert.equal(totals.total, 17.36);
  assert.deepEqual(splitByItems(lines, [0, 1, 2], totals.shipping, 3, totals.total), [1.5, 2.75, 13.11]);
  assert.equal(centSum(splitEqual(totals.total, 3)), 1736);
  assert.equal(centSum(splitByItems(lines, [2, 1, 0], totals.shipping, 5, totals.total)), 1736);
  assert.deepEqual(splitByItems(lines.slice(0, 1), [1], 0, 2, 0), [0, 0]);
});

test('por producto conserva todos los céntimos al variar descuentos y asignaciones', () => {
  const lines = linesOf([{ productId: 'monster', qty: 2 }, { productId: 'cafe-americano', qty: 2 }]);
  for (let products = 0; products <= 2090; products++) {
    for (let n = 2; n <= 5; n++) {
      const shares = splitByItems(lines, [n - 1, 0], 4.5, n, (products + 450) / 100);
      assert.equal(centSum(shares), products + 450);
      assert.ok(shares.every((s) => s >= 0));
    }
  }
});

test('placeOrder rechaza pagos pendientes o reparto desactualizado antes de mutar stores', () => {
  const items = [{ productId: 'croissant', qty: 1 }, { productId: 'clorox', qty: 1 }];
  const lines = linesOf(items);
  const split = { mode: 'equal', participants: splitEqual(10, 3).map((amount, i) => ({
    name: `Persona ${i}`, amount, method: i === 0 ? 'card' : 'yape', paid: true,
  })) };
  const input = { items, fulfillment: 'pickup', storeId: 'aliaga', schedule: { type: 'asap' },
    payment: { method: 'card', label: 'Tarjeta demo' }, split };
  for (const mutate of [
    (s) => { s.participants[1].paid = false; },
    (s) => { s.participants[0].amount += 0.01; },
    (s) => { s.participants[0].amount += 0.0001; },
    (s) => { s.participants[1].method = 'card'; },
    (s) => { s.participants[2].name = ' '; },
  ]) {
    const invalid = structuredClone(split);
    mutate(invalid);
    assert.throws(() => placeOrder({ ...input, split: invalid }));
    assert.equal(writes.length, 0);
  }
  assert.throws(() => validateSplit(split, lines, 0, 10, 'cash'));
  assert.throws(() => validateSplit(split, lines, 0, 0, 'card'));
  const order = placeOrder(input);
  assert.deepEqual(order.split, split);
  assert.equal(centSum(order.split.participants.map((p) => p.amount)), 1000);
  assert.deepEqual(writes, ['order', 'wallet', 'cart']);
  // La boleta lee este mismo objeto persistido, sin recalcular precios futuros del catálogo.
  assert.deepEqual(JSON.parse(JSON.stringify(orders[0])).split, split);
});
