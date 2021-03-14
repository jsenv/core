export default function _classCheckPrivateStaticFieldDescriptor(descriptor, action) {
  if (descriptor === undefined) {
    // eslint-disable-next-line prefer-template
    throw new TypeError("attempted to " + action + " private static field before its declaration")
  }
}
