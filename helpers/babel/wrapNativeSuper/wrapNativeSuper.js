import getPrototypeOf from "../getPrototypeOf/getPrototypeOf.js"
import setPrototypeOf from "../setPrototypeOf/setPrototypeOf.js"
import isNativeFunction from "../isNativeFunction/isNativeFunction.js"
import construct from "../construct/construct.js"

var _cache = typeof Map === "function" ? new Map() : undefined

export default function(Class) {
  if (Class === null || !isNativeFunction(Class)) return Class
  if (typeof Class !== "function") {
    throw new TypeError("Super expression must either be null or a function")
  }
  if (typeof _cache !== "undefined") {
    if (_cache.has(Class)) return _cache.get(Class)
    _cache.set(Class, Wrapper)
  }
  function Wrapper() {
    // eslint-disable-next-line prefer-rest-params
    return construct(Class, arguments, getPrototypeOf(this).constructor)
  }
  Wrapper.prototype = Object.create(Class.prototype, {
    constructor: {
      value: Wrapper,
      enumerable: false,
      writable: true,
      configurable: true,
    },
  })
  return setPrototypeOf(Wrapper, Class)
}
