export default function (subClass, superClass) {
  subClass.prototype = Object.create(superClass.prototype)
  subClass.prototype.constructor = subClass
  // eslint-disable-next-line no-proto
  subClass.__proto__ = superClass
}
