import defineProperty from "../defineProperty/defineProperty.js"

export default function(target) {
  for (var i = 1; i < arguments.length; i++) {
    // eslint-disable-next-line prefer-rest-params
    var source = arguments[i] === null ? {} : arguments[i]
    var ownKeys = Object.keys(source)
    if (typeof Object.getOwnPropertySymbols === "function") {
      ownKeys = ownKeys.concat(
        // eslint-disable-next-line no-loop-func
        Object.getOwnPropertySymbols(source).filter(function(sym) {
          return Object.getOwnPropertyDescriptor(source, sym).enumerable
        }),
      )
    }
    // eslint-disable-next-line no-loop-func
    ownKeys.forEach(function(key) {
      defineProperty(target, key, source[key])
    })
  }
  return target
}
