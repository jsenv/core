import setPrototypeOf from "../setPrototypeOf/setPrototypeOf.js"

export default (subClass, superClass) => {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function")
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      writable: true,
      configurable: true,
    },
  })
  if (superClass) setPrototypeOf(subClass, superClass)
}
