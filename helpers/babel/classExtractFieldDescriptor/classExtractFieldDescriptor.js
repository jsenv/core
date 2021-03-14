export default function _classExtractFieldDescriptor(receiver, privateMap, action) {
  if (!privateMap.has(receiver)) {
    // eslint-disable-next-line prefer-template
    throw new TypeError("attempted to " + action + " private field on non-instance")
  }
  return privateMap.get(receiver)
}
