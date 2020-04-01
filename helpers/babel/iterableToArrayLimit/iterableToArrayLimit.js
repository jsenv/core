export default (arr, i) => {
  // this is an expanded form of \`for...of\` that properly supports abrupt completions of
  // iterators etc. variable names have been minimised to reduce the size of this massive
  // helper. sometimes spec compliance is annoying :(
  //
  // _n = _iteratorNormalCompletion
  // _d = _didIteratorError
  // _e = _iteratorError
  // _i = _iterator
  // _s = _step
  if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return
  var _arr = []
  var _n = true
  var _d = false
  var _e
  var _i = arr[Symbol.iterator]()
  var _s
  try {
    for (; !(_n = (_s = _i.next()).done); _n = true) {
      _arr.push(_s.value)
      if (i && _arr.length === i) break
    }
  } catch (err) {
    _d = true
    _e = err
  } finally {
    try {
      if (!_n && _i.return !== null) _i.return()
    } finally {
      if (_d) throw _e
    }
  }
  // eslint-disable-next-line consistent-return
  return _arr
}
