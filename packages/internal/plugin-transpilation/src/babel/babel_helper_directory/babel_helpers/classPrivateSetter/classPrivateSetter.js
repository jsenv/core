import assertClassBrand from "../assertClassBrand/assertClassBrand.js";

/* eslint-disable */
export default function _classPrivateSetter(privateMap, setter, receiver, value) {
  setter(assertClassBrand(privateMap, receiver), value);
  return value;
}

//# sourceMappingURL=classPrivateSetter.js.map
