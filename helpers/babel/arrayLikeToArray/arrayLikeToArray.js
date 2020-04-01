/* eslint-disable no-eq-null, eqeqeq */
export default function arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length
  var arr2 = new Array(len)
  for (var i = 0; i < len; i++) arr2[i] = arr[i]
  return arr2
}
