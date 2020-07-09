import getPrototypeOf from "../getPrototypeOf/getPrototypeOf.js"
import isNativeReflectConstruct from "../isNativeReflectConstruct/isNativeReflectConstruct.js"
import possibleConstructorReturn from "../possibleConstructorReturn/possibleConstructorReturn.js"

export default function _createSuper(Derived) {
  var hasNativeReflectConstruct = isNativeReflectConstruct()

  return function () {
    var Super = getPrototypeOf(Derived)
    var result
    if (hasNativeReflectConstruct) {
      // NOTE: This doesn't work if this.__proto__.constructor has been modified.
      var NewTarget = getPrototypeOf(this).constructor
      // eslint-disable-next-line prefer-rest-params
      result = Reflect.construct(Super, arguments, NewTarget)
    } else {
      // eslint-disable-next-line prefer-rest-params
      result = Super.apply(this, arguments)
    }
    return possibleConstructorReturn(this, result)
  }
}
