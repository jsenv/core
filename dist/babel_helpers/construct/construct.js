/* @minVersion 7.0.0-beta.0 */

// @ts-expect-error helper
import setPrototypeOf from "../setPrototypeOf/setPrototypeOf.js";
import isNativeReflectConstruct from "../isNativeReflectConstruct/isNativeReflectConstruct.js";

export default function _construct(Parent, args, Class) {
  if (isNativeReflectConstruct()) {
    // Avoid issues with Class being present but undefined when it wasn't
    // present in the original call.
    return Reflect.construct.apply(null, arguments);
  }
  // NOTE: If Parent !== Class, the correct __proto__ is set *after*
  //       calling the constructor.
  var a = [null];
  a.push.apply(a, args);
  var instance = new (Parent.bind.apply(Parent, a))();
  if (Class) setPrototypeOf(instance, Class.prototype);
  return instance;
}
