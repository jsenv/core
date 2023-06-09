const nativeTypeOf = (obj) => typeof obj

const customTypeOf = (obj) => {
  return obj &&
    typeof Symbol === "function" &&
    obj.constructor === Symbol &&
    obj !== Symbol.prototype
    ? "symbol"
    : typeof obj
}

export default typeof Symbol === "function" && typeof Symbol.iterator === "symbol"
  ? nativeTypeOf
  : customTypeOf
