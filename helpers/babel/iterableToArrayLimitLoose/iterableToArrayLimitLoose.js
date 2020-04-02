export default function(arr, i) {
  if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return
  var _arr = []
  for (var _iterator = arr[Symbol.iterator](), _step; !(_step = _iterator.next()).done; ) {
    _arr.push(_step.value)
    if (i && _arr.length === i) break
  }
  // eslint-disable-next-line consistent-return
  return _arr
}
