// https://mathiasbynens.be/notes/globalthis

// eslint-disable-next-line no-extend-native
Object.defineProperty(Object.prototype, "__global__", {
  get() {
    return this
  },
  configurable: true,
})
// eslint-disable-next-line no-undef
const globalThis = __global__
delete Object.prototype.__global__
globalThis.globalThis = globalThis
