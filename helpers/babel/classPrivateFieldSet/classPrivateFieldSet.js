export default function(receiver, privateMap, value) {
  var descriptor = privateMap.get(receiver)
  if (!descriptor) {
    throw new TypeError("attempted to set private field on non-instance")
  }
  if (descriptor.set) {
    descriptor.set.call(receiver, value)
  } else {
    if (!descriptor.writable) {
      // This should only throw in strict mode, but class bodies are
      // always strict and private fields can only be used inside
      // class bodies.
      throw new TypeError("attempted to set read only private field")
    }
    descriptor.value = value
  }
  return value
}
