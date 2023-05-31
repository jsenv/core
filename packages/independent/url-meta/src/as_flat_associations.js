import { isPlainObject } from "./assertions.js";

export const asFlatAssociations = (associations) => {
  if (!isPlainObject(associations)) {
    throw new TypeError(
      `associations must be a plain object, got ${associations}`,
    );
  }
  const flatAssociations = {};
  Object.keys(associations).forEach((associationName) => {
    const associationValue = associations[associationName];
    if (isPlainObject(associationValue)) {
      Object.keys(associationValue).forEach((pattern) => {
        const patternValue = associationValue[pattern];
        const previousValue = flatAssociations[pattern];
        if (isPlainObject(previousValue)) {
          flatAssociations[pattern] = {
            ...previousValue,
            [associationName]: patternValue,
          };
        } else {
          flatAssociations[pattern] = {
            [associationName]: patternValue,
          };
        }
      });
    }
  });
  return flatAssociations;
};
