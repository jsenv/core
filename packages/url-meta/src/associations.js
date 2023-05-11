import { assertUrlLike, isPlainObject } from "./assertions.js";
import { asFlatAssociations } from "./as_flat_associations.js";
import { applyPatternMatching } from "./pattern_matching.js";

export const applyAssociations = ({ url, associations }) => {
  assertUrlLike(url);
  const flatAssociations = asFlatAssociations(associations);
  return Object.keys(flatAssociations).reduce((previousValue, pattern) => {
    const { matched } = applyPatternMatching({
      pattern,
      url,
    });
    if (matched) {
      const value = flatAssociations[pattern];
      if (isPlainObject(previousValue) && isPlainObject(value)) {
        return {
          ...previousValue,
          ...value,
        };
      }
      return value;
    }
    return previousValue;
  }, {});
};
