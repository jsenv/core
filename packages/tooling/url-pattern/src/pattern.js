import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";

const createPattern = (
  pattern,
  {
    namedGroupDelimiter,
    prepareStringToGenerate = (stringToBuild) => stringToBuild,
    finalizeGeneratedString = (generatedString) => generatedString,
    // encode = encodeURIComponent,
    // decode = decodeURIComponent,
  } = {},
) => {
  if (pattern === "*") {
    return {
      regexp: /.*/,
      match: () => true,
      generate: (stringToGenerate) => stringToGenerate,
      generateExample: (stringToGenerate) => stringToGenerate,
    };
  }

  const parts = [];
  const namedParams = [];
  let starParamCount = 0;
  let regexpSource = "";
  let lastIndex = 0;
  regexpSource += "^";
  for (const match of pattern.matchAll(/:\w+|\*/g)) {
    const string = match[0];
    const index = match.index;
    let before = pattern.slice(lastIndex, index);
    parts.push({ type: "static", value: before });
    regexpSource += escapeRegexpSpecialChars(before);
    if (string === "*") {
      starParamCount++;
      regexpSource += `(?<star_${starParamCount - 1}>.+)`;
      parts.push({ type: "star", value: starParamCount - 1 });
    } else {
      const paramName = string.slice(1);
      namedParams.push(paramName);
      regexpSource += namedGroupDelimiter
        ? `(?<${paramName}>[^${escapeRegexpSpecialChars(namedGroupDelimiter)}]+)`
        : `(?<${paramName}>.+)`;
      parts.push({ type: "named", value: paramName });
    }
    lastIndex = index + string.length;
  }
  const after = pattern.slice(lastIndex);
  parts.push({ type: "static", value: after });
  regexpSource += escapeRegexpSpecialChars(after);
  regexpSource += "$";

  const regexp = new RegExp(regexpSource);

  const generateWhenPatternIsStatic = () => {
    return prepareStringToGenerate(pattern);
  };
  const generateWhenPatternUsesOnlyStarParams = (...values) => {
    let generatedString = "";
    for (const part of parts) {
      if (part.type === "static") {
        generatedString += part.value;
      } else {
        generatedString += values[part.value];
      }
    }
    return finalizeGeneratedString(generatedString, pattern);
  };
  const generateWhenPatternUsesOnlyNamedParams = (namedValues) => {
    let generatedString = "";
    for (const part of parts) {
      if (part.type === "static") {
        generatedString += part.value;
      } else {
        generatedString += namedValues[part.value];
      }
    }
    return finalizeGeneratedString(generatedString, pattern);
  };
  const generateWhenPatternUsesNamedAndStarParams = (
    namedValues,
    ...values
  ) => {
    let generatedString = "";
    for (const part of parts) {
      if (part.type === "static") {
        generatedString += part.value;
      } else if (part.type === "named") {
        generatedString += namedValues[part.value];
      } else {
        generatedString += values[part.value];
      }
    }
    return finalizeGeneratedString(generatedString, pattern);
  };

  const isStatic = namedParams.length === 0 && starParamCount === 0;
  const usesOnlyNamedParams = namedParams.length > 0 && starParamCount === 0;
  const usesOnlyStarParams = namedParams.length === 0 && starParamCount > 0;
  const usesNamedAndStarParams = namedParams.length > 0 && starParamCount > 0;

  const generate = isStatic
    ? generateWhenPatternIsStatic
    : usesOnlyNamedParams
      ? generateWhenPatternUsesOnlyNamedParams
      : usesOnlyStarParams
        ? generateWhenPatternUsesOnlyStarParams
        : generateWhenPatternUsesNamedAndStarParams;

  return {
    regexp,
    match: (value) => {
      if (value === undefined) {
        return null;
      }
      const match = String(value).match(regexp);
      if (!match) {
        return null;
      }
      const groups = match.groups;
      if (groups && Object.keys(groups).length) {
        const stars = [];
        const named = {};
        for (const key of Object.keys(groups)) {
          if (key.startsWith("star_")) {
            const index = parseInt(key.slice("star_".length));
            stars[index] = groups[key];
          } else {
            named[key] = groups[key];
          }
        }
        return {
          named: Object.keys(named).length === 0 ? null : named,
          stars: stars.length === 0 ? null : stars,
        };
      }
      return { named: null, stars: null };
    },
    generate,
    generateExample: () => {
      if (usesNamedAndStarParams) {
        return generate(
          generateNamedParamsExample(namedParams),
          ...generateStarParamsExample(starParamCount),
        );
      }
      if (usesOnlyNamedParams) {
        return generate(generateNamedParamsExample(namedParams));
      }
      if (usesOnlyStarParams) {
        return generate(...generateStarParamsExample(starParamCount));
      }
      return generate();
    },
  };
};

const composeTwoMatchResults = (left, right) => {
  if (!left || !right) {
    return false;
  }
  let named;
  const leftNamed = left.named;
  const rightNamed = right.named;
  if (leftNamed && rightNamed) {
    named = { ...leftNamed, ...rightNamed };
  } else if (leftNamed) {
    named = leftNamed;
  } else if (rightNamed) {
    named = rightNamed;
  }
  let stars;
  const leftStars = left.stars;
  const rightStars = right.stars;
  if (leftStars && rightStars) {
    stars = [...leftStars, ...rightStars];
  } else if (leftStars) {
    stars = leftStars;
  } else if (rightStars) {
    stars = rightStars;
  }
  return { named, stars };
};

export const PATTERN = {
  create: createPattern,
  composeTwoMatchResults,
  createKeyValue: (object) => {
    const patternMap = new Map();
    const keys = Object.keys(object);
    for (const key of keys) {
      const value = object[key];
      if (typeof value === "function") {
        patternMap.set(key, {
          match: (value) => {
            return Boolean(value(value));
          },
          generate: () => {
            return "?";
          },
        });
      } else {
        const valuePattern = PATTERN.create(value);
        patternMap.set(key, valuePattern);
      }
    }
    return {
      match: (objectToMatch) => {
        const namedValues = {};
        for (const [key, pattern] of patternMap) {
          const value = objectToMatch[key];
          const matchResult = pattern.match(value);
          if (!matchResult) {
            return false;
          }
          const named = matchResult.named;
          Object.assign(namedValues, named);
        }
        return namedValues;
      },
      generate: (values) => {
        const generatedObject = {};
        for (const [key, pattern] of patternMap) {
          generatedObject[key] = pattern.generate(values);
        }
        return generatedObject;
      },
      generateExample: () => {
        const generatedObject = {};
        for (const [key, pattern] of patternMap) {
          generatedObject[key] = pattern.generateExample();
        }
        return generatedObject;
      },
    };
  },
};

const generateNamedParamsExample = (namedParams) => {
  const namedParamValues = {};
  for (const name of namedParams) {
    namedParamValues[name] = name;
  }
  return namedParamValues;
};
const generateStarParamsExample = (starParamCount) => {
  const starValues = [];
  while (starValues.length < starParamCount) {
    starValues.push(starValues.length);
  }
  return starValues;
};
