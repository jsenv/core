export default function(fn) {
  return function() {
    // eslint-disable-next-line prefer-rest-params
    var it = fn.apply(this, arguments)
    it.next()
    return it
  }
}
