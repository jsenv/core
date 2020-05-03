/* eslint-disable no-void */
export default function _applyDecoratedDescriptor(
  target,
  property,
  decorators,
  descriptor,
  context,
) {
  var desc = {}
  Object.keys(descriptor).forEach(function (key) {
    desc[key] = descriptor[key]
  })
  desc.enumerable = Boolean(desc.enumerable)
  desc.configurable = Boolean(desc.configurable)
  if ("value" in desc || desc.initializer) {
    desc.writable = true
  }
  desc = decorators
    .slice()
    .reverse()
    .reduce(function (desc, decorator) {
      return decorator(target, property, desc) || desc
    }, desc)
  if (context && desc.initializer !== void 0) {
    desc.value = desc.initializer ? desc.initializer.call(context) : void 0
    desc.initializer = undefined
  }
  if (desc.initializer === void 0) {
    // This is a hack to avoid this being processed by 'transform-runtime'.
    // See issue #9.
    Object.defineProperty(target, property, desc)
    desc = null
  }
  return desc
}
