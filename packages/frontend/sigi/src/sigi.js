/**
 * https://github.com/luisherranz/deepsignal/blob/main/packages/deepsignal/core/src/index.ts
 *
 */
import { signal, computed } from "@preact/signals";

export const sigi = (rootValue) => {
  if (!shouldProxy(rootValue)) {
    throw new Error(
      `sigi first argument must be a basic object, got ${rootValue}`,
    );
  }
  return getOrCreateProxy(rootValue);
};

const proxyWeakMap = new WeakMap();
const getOrCreateProxy = (value) => {
  const existingProxy = proxyWeakMap.get(value);
  if (existingProxy) {
    return existingProxy;
  }
  const proxy = new Proxy(value, objectHandlers);
  ignoreWeakSet.add(proxy);
  proxyWeakMap.set(value, proxy);
  return proxy;
};

const signalMapWeakMap = new WeakMap();
const objectHandlers = {
  get: (target, key, receiver) => {
    let signalsMap = signalMapWeakMap.get(receiver);
    if (!signalsMap) {
      signalsMap = new Map();
      signalMapWeakMap.set(receiver, signalsMap);
    }
    let signalForThisKey = signalsMap.get(key);
    if (!signalForThisKey) {
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (descriptor && typeof descriptor.get === "function") {
        signalForThisKey = computed(() => Reflect.get(target, key, receiver));
        return signalForThisKey.value;
      }
    }
    let value = Reflect.get(target, key, receiver);
    if (typeof key === "symbol" && wellKnownSymbolSet.has(key)) {
      return value;
    }
    if (!signalForThisKey) {
      if (shouldProxy(value)) {
        const proxy = getOrCreateProxy(value);
        return proxy;
      }
      signalForThisKey = signal(value);
      signalsMap.set(key, signalForThisKey);
      return value;
    }
    return signalForThisKey.value;
  },
  set: (target, key, value, receiver) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor && typeof descriptor.set === "function") {
      return Reflect.set(target, key, value, receiver);
    }
    let signalMap = signalMapWeakMap.get(receiver);
    if (!signalMap) {
      signalMap = new Map();
      signalMapWeakMap.set(receiver, signalMap);
    }
    let internal;
    if (shouldProxy(value)) {
      internal = getOrCreateProxy(value);
    } else {
      internal = value;
    }
    const result = Reflect.set(target, key, value, receiver);
    let signalForThisKey = signalMap.get(key);
    if (!signalForThisKey) {
      signalForThisKey = signal(internal);
      signalMap.set(key, signalForThisKey);
    } else {
      signalForThisKey.value = internal;
    }
    if (Array.isArray(target)) {
      const signalForArrayLength = signalMap.get("length");
      if (signalForArrayLength) {
        signalForArrayLength.value = target.length;
      }
    }
    return result;
  },
  deleteProperty: (target, key) => {
    const result = Reflect.deleteProperty(target, key);
    const proxy = proxyWeakMap.get(target);
    if (!proxy) {
      return result;
    }
    const signalMap = signalMapWeakMap.get(proxy);
    if (!signalMap) {
      return result;
    }
    const signalForThisKey = signalMap.get(key);
    signalForThisKey.value = undefined;
    return result;
  },
};

const supportedSet = new Set([Object, Array]);
const ignoreWeakSet = new WeakSet();
const shouldProxy = (val) => {
  if (typeof val !== "object" || val === null) {
    return false;
  }
  return supportedSet.has(val.constructor) && !ignoreWeakSet.has(val);
};
const wellKnownSymbolSet = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map((key) => Symbol[key])
    .filter((value) => typeof value === "symbol"),
);

// const getPreciseType = (value) => {
//   if (value === null) {
//     return "null";
//   }
//   if (value === undefined) {
//     return "undefined";
//   }
//   const type = typeof value;
//   if (type === "object") {
//     const toStringResult = toString.call(value);
//     // returns format is '[object ${tagName}]';
//     // and we want ${tagName}
//     const tagName = toStringResult.slice("[object ".length, -1);
//     if (tagName === "Object") {
//       if (!value.constructor) return "object"; // Object.create(null)
//       const objectConstructorName = value.constructor.name;
//       if (objectConstructorName === "Object") {
//         return "object";
//       }
//       return objectConstructorName;
//     }
//     return tagName;
//   }
//   return type;
// };
// const { toString } = Object.prototype;
// const isObject = (value) => {
//   return getPreciseType(value) === "object";
// };
