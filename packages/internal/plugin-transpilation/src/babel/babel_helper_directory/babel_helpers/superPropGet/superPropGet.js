import get from "../get/get.js";
import getPrototypeOf from "../getPrototypeOf/getPrototypeOf.js";

/* eslint-disable */
export default function _superPropGet(classArg, property, receiver, flags) {
  var result = get(getPrototypeOf(flags & 1 ? classArg.prototype : classArg), property, receiver);
  return flags & 2 && typeof result === "function" ? function (args) {
    return result.apply(receiver, args);
  } : result;
}
