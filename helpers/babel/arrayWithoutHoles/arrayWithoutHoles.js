// eslint-disable-next-line consistent-return
export default (arr) => {
  if (Array.isArray(arr)) {
    var i = 0
    var arr2 = new Array(arr.length)
    for (; i < arr.length; i++) arr2[i] = arr[i]
    return arr2
  }
}
