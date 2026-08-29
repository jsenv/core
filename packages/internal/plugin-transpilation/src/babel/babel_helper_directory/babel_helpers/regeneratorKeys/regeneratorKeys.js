/* eslint-disable */
export default function _regeneratorKeys(val) {
  var object = Object(val);
  var keys = [];
  var key;
  for (var key in object) {
    keys.unshift(key);
  }
  return function next() {
    while (keys.length) {
      key = keys.pop();
      if (key in object) {
        next.value = key;
        next.done = false;
        return next;
      }
    }
    next.done = true;
    return next;
  };
}
