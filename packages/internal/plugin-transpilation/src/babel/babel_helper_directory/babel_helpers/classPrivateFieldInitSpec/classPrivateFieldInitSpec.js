import checkPrivateRedeclaration from "../checkPrivateRedeclaration/checkPrivateRedeclaration.js";

/* eslint-disable */
export default function _classPrivateFieldInitSpec(obj, privateMap, value) {
  checkPrivateRedeclaration(obj, privateMap);
  privateMap.set(obj, value);
}

//# sourceMappingURL=classPrivateFieldInitSpec.js.map
