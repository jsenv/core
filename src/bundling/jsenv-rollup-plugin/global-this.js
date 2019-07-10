// https://mathiasbynens.be/notes/globalthis

// eslint-disable-next-line no-undef
if (typeof globalThis !== "object") {
  let globalObject

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
