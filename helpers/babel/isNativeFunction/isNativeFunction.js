// Note: This function returns "true" for core-js functions.
export default function (fn) {
  return Function.toString.call(fn).indexOf("[native code]") !== -1
}
