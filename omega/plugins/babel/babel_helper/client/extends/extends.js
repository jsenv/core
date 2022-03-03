function assign(target) {
  for (var i = 1; i < arguments.length; i++) {
    // eslint-disable-next-line prefer-rest-params
    var source = arguments[i]
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key]
      }
    }
  }
  return target
}

export default Object.assign || assign
