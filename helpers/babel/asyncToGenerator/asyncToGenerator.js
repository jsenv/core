export default function(fn) {
  return function() {
    var self = this
    // eslint-disable-next-line prefer-rest-params
    var args = arguments
    return new Promise(function(resolve, reject) {
      var gen = fn.apply(self, args)
      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value)
      }
      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err)
      }
      _next(undefined)
    })
  }
}

const asyncGeneratorStep = (gen, resolve, reject, _next, _throw, key, arg) => {
  var info
  var value
  try {
    info = gen[key](arg)
    value = info.value
  } catch (error) {
    reject(error)
    return
  }
  if (info.done) {
    resolve(value)
  } else {
    Promise.resolve(value).then(_next, _throw)
  }
}
