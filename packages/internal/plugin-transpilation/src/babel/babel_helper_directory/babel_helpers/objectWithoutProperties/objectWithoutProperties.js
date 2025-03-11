import objectWithoutPropertiesLoose from "../objectWithoutPropertiesLoose/objectWithoutPropertiesLoose.js";

export default (source, excluded) => {
  if (source === null) return {};

  var target = objectWithoutPropertiesLoose(source, excluded);
  var key;
  var i;
  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.includes(key)) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }
  return target;
};
