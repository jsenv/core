import setPrototypeOf from "../setPrototypeOf/setPrototypeOf.js"

export default function (subClass, superClass) {
  subClass.prototype = Object.create(superClass.prototype)
  subClass.prototype.constructor = subClass
  setPrototypeOf(subClass, superClass)
}
