import set from "../set/set.js";
import getPrototypeOf from "../getPrototypeOf/getPrototypeOf.js";

/* eslint-disable */
export default function _superPropSet(classArg, property, value, receiver, isStrict, prototype) {
  return set(getPrototypeOf(prototype ? classArg.prototype : classArg), property, value, receiver, isStrict);
}
