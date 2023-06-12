export default function (target, property, descriptor, context) {
  if (!descriptor) return
  Object.defineProperty(target, property, {
    enumerable: descriptor.enumerable,
    configurable: descriptor.configurable,
    writable: descriptor.writable,
    // eslint-disable-next-line no-void
    value: descriptor.initializer ? descriptor.initializer.call(context) : void 0,
  })
}
