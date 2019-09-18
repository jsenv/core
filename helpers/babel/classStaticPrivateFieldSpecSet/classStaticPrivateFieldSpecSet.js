export default function(receiver, classConstructor, descriptor, value) {
  if (receiver !== classConstructor) {
    throw new TypeError("Private static access of wrong provenance")
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
