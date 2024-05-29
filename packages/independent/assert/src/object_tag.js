export const getObjectTag = (obj) => {
  // https://github.com/nodejs/node/blob/384fd1787634c13b3e5d2f225076d2175dc3b96b/lib/internal/util/inspect.js#L859
  while (obj || isUndetectableObject(obj)) {
    const constructorDescriptor = Object.getOwnPropertyDescriptor(
      obj,
      "constructor",
    );
    if (
      constructorDescriptor !== undefined &&
      typeof constructorDescriptor.value === "function" &&
      constructorDescriptor.value.name !== ""
    ) {
      return String(constructorDescriptor.value.name);
    }
    const toStringTagDescriptor = Object.getOwnPropertyDescriptor(
      obj,
      Symbol.toStringTag,
    );
    if (
      toStringTagDescriptor &&
      typeof toStringTagDescriptor.value === "string"
    ) {
      return toStringTagDescriptor.value;
    }

    obj = Object.getPrototypeOf(obj);
    if (obj === null) {
      return "Object";
    }
  }
  return "";
};

export const visitObjectPrototypes = (obj, callback) => {
  while (obj || isUndetectableObject(obj)) {
    const proto = Object.getPrototypeOf(obj);
    if (!proto) {
      break;
    }
    callback(proto);
    obj = proto;
  }
};

const isUndetectableObject = (v) => typeof v === "undefined" && v !== undefined;
