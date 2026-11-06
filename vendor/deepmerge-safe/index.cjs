'use strict';

// Derived from deepmerge 4.3.1 (MIT; see LICENSE). Changes are documented in
// README.md and tested by scripts/test-dependency-security.mjs.
function isMergeableObject(value) {
  return !!value && typeof value === 'object' && !isSpecial(value);
}

const REACT_ELEMENT_TYPE = typeof Symbol === 'function' && Symbol.for
  ? Symbol.for('react.element') : 0xeac7;

function isSpecial(value) {
  const tag = Object.prototype.toString.call(value);
  return tag === '[object RegExp]' || tag === '[object Date]' || value.$$typeof === REACT_ELEMENT_TYPE;
}

function emptyTarget(value) {
  return Array.isArray(value) ? [] : {};
}

function cloneUnlessOtherwiseSpecified(value, options) {
  return options.clone !== false && options.isMergeableObject(value)
    ? deepmerge(emptyTarget(value), value, options) : value;
}

function defaultArrayMerge(target, source, options) {
  return target.concat(source).map((element) => cloneUnlessOtherwiseSpecified(element, options));
}

function getMergeFunction(key, options) {
  if (!options.customMerge) return deepmerge;
  const customMerge = options.customMerge(key);
  return typeof customMerge === 'function' ? customMerge : deepmerge;
}

function getKeys(target) {
  return Object.keys(target).concat(Object.getOwnPropertySymbols(target)
    .filter((symbol) => Object.prototype.propertyIsEnumerable.call(target, symbol)));
}

function propertyIsOnObject(object, property) {
  try { return property in object; } catch { return false; }
}

function unsafeKey(key) {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

function propertyIsUnsafe(target, key) {
  return unsafeKey(key) || (propertyIsOnObject(target, key)
    && !(Object.prototype.hasOwnProperty.call(target, key)
      && Object.prototype.propertyIsEnumerable.call(target, key)));
}

function assignOwn(destination, key, value) {
  Object.defineProperty(destination, key, {
    value, enumerable: true, configurable: true, writable: true,
  });
}

function mergeObject(target, source, options) {
  const destination = {};
  if (options.isMergeableObject(target)) {
    getKeys(target).forEach((key) => {
      if (!unsafeKey(key)) assignOwn(destination, key, cloneUnlessOtherwiseSpecified(target[key], options));
    });
  }
  getKeys(source).forEach((key) => {
    if (propertyIsUnsafe(target, key)) return;
    const value = propertyIsOnObject(target, key) && options.isMergeableObject(source[key])
      ? getMergeFunction(key, options)(target[key], source[key], options)
      : cloneUnlessOtherwiseSpecified(source[key], options);
    assignOwn(destination, key, value);
  });
  return destination;
}

function deepmerge(target, source, options) {
  options = options || {};
  options.arrayMerge = options.arrayMerge || defaultArrayMerge;
  options.isMergeableObject = options.isMergeableObject || isMergeableObject;
  options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;
  const sourceIsArray = Array.isArray(source);
  const targetIsArray = Array.isArray(target);
  if (sourceIsArray !== targetIsArray) return cloneUnlessOtherwiseSpecified(source, options);
  if (sourceIsArray) return options.arrayMerge(target, source, options);
  return mergeObject(target, source, options);
}

deepmerge.all = function (array, options) {
  if (!Array.isArray(array)) throw new Error('first argument should be an array');
  return array.reduce((previous, next) => deepmerge(previous, next, options), {});
};

module.exports = deepmerge;
