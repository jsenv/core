export default function _isNativeFunction(fn) {
  // Note: This function returns "true" for core-js functions.
  try {
    return Function.toString.call(fn).indexOf("[native code]") !== -1;
  } catch (e) {
    // Firefox 31 throws when "toString" is applied to an HTMLElement
    return typeof fn === "function";
  }
}
