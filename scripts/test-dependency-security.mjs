import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const merge = require('deepmerge');
assert.equal(require('deepmerge/package.json').name, '@domashno/deepmerge-safe', 'the build actually uses the security-patched local module');
// Prevent a stale packed artifact from diverging from the reviewed source.
const fs = require('node:fs');
assert.equal(fs.readFileSync(require.resolve('deepmerge'), 'utf8'),
  fs.readFileSync(new URL('../vendor/deepmerge-safe/index.cjs', import.meta.url), 'utf8'));

const malicious = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true},"safe":1}');
const verify = (result) => {
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(result.polluted, undefined);
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    assert.equal(Object.hasOwn(result, key), false);
  }
  assert.equal({}.polluted, undefined);
};
verify(merge({}, malicious));
verify(merge(malicious, {}));
verify(merge(Object.create(null), malicious));
verify(merge({ nested: {} }, { nested: malicious }).nested);
verify(merge({ nested: malicious }, { nested: {} }).nested);
verify(merge([{ safe: 2 }], [malicious])[1]);
verify(merge.all([malicious, { normal: true }]));

assert.deepEqual(merge({ nested: { a: 1 }, items: [1] }, { nested: { b: 2 }, items: [2] }), {
  nested: { a: 1, b: 2 }, items: [1, 2],
});
const source = { nested: { count: 1 } };
const cloned = merge({}, source);
assert.notEqual(cloned.nested, source.nested);
assert.equal(merge({}, source, { clone: false }).nested, source.nested);
assert.deepEqual(merge({ a: [1] }, { a: [2] }, { arrayMerge: (_target, s) => s }), { a: [2] });
assert.deepEqual(merge({ a: { one: 1 } }, { a: { two: 2 } }, {
  customMerge: (key) => key === 'a' ? () => ({ custom: true }) : undefined,
}), { a: { custom: true } });
const symbol = Symbol('safe');
assert.equal(merge({}, { [symbol]: 'value' })[symbol], 'value');
const date = new Date();
assert.equal(merge({}, { date }).date, date);
assert.equal(merge({}, { re: /test/ }).re.source, 'test');
assert.throws(() => merge.all({}), /array/);
console.log('PASS: prototype-poisoning regressions and deepmerge API compatibility');
