// https://mathiasbynens.be/notes/globalthis

/* global globalThis */
/* eslint-disable no-redeclare */
let globalObject
if (typeof globalThis === "object") {
  globalObject = globalThis
} else {
  if (this) {
    globalObject = this
  } else {
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, "__global__", {
      get() {
        return this
      },
      configurable: true,
    })
    // eslint-disable-next-line no-undef
    globalObject = __global__
    delete Object.prototype.__global__
  }

  globalObject.globalThis = globalObject
}

export default globalObject
