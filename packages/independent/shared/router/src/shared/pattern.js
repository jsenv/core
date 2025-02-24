import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";

const createPattern = (
  pattern,
  {
    prepareStringToGenerate = (stringToBuild) => stringToBuild,
    finalizeGeneratedString = (generatedString) => generatedString,
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

  const namedParams = [];
  let starParamCount = 0;
  let regexpSource = "";
  let lastIndex = 0;
  regexpSource += "^";
  for (const match of pattern.matchAll(/:\w+|\*/g)) {
    const string = match[0];
    const index = match.index;
    let before = pattern.slice(lastIndex, index);
    regexpSource += escapeRegexpSpecialChars(before);
    if (string === "*") {
      starParamCount++;
      regexpSource += `(?<star_${starParamCount - 1}>.+)`;
    } else {
      const paramName = string.slice(1);
      namedParams.push(paramName);
      regexpSource += `(?<${paramName}>[^\/]+)`;
    }
    lastIndex = index + string.length;
  }
  const after = pattern.slice(lastIndex);
  regexpSource += escapeRegexpSpecialChars(after);
  regexpSource += "$";

  const regexp = new RegExp(regexpSource);

  const generateWhenPatternIsStatic = (stringToGenerate) => {
    return prepareStringToGenerate(stringToGenerate);
  };
  const generateWhenPatternUsesOnlyStarParams = (
    stringToGenerate,
    ...values
  ) => {
    stringToGenerate = prepareStringToGenerate(stringToGenerate);
    let valueIndex = 0;
    const generatedString = stringToGenerate.replaceAll(/\*/g, () => {
      const value = values[valueIndex];
      valueIndex++;
      return encodeURIComponent(value);
    });
    return finalizeGeneratedString(generatedString, stringToGenerate);
  };
  const generateWhenPatternUsesOnlyNamedParams = (
    stringToGenerate,
    namedValues,
  ) => {
    const generatedString = stringToGenerate.replaceAll(/:\w+/g, (match) => {
      const key = match.slice(1);
      const value = namedValues[key];
      return encodeURIComponent(value);
    });
    return finalizeGeneratedString(generatedString, stringToGenerate);
  };

  const generateWhenPatternUsesNamedAndStarParams = (
    stringToGenerate,
    namedValues,
    ...values
  ) => {
    let valueIndex = 0;
    const generatedString = stringToGenerate.replaceAll(/:\w+|\*/g, (match) => {
      if (match === "*") {
        const value = values[valueIndex];
        valueIndex++;
        return encodeURIComponent(value);
      }
      const key = match.slice(1);
      const value = namedValues[key];
      return encodeURIComponent(value);
    });
    return finalizeGeneratedString(generatedString, stringToGenerate);
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
    match: (string) => {
      const match = string.match(regexp);
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
    generateExample: (url) => {
      if (usesNamedAndStarParams) {
        return generate(
          url,
          generateNamedParamsExample(namedParams),
          ...generateStarParamsExample(starParamCount),
        );
      }
      if (usesOnlyNamedParams) {
        return generate(url, generateNamedParamsExample(namedParams));
      }
      if (usesOnlyStarParams) {
        return generate(url, ...generateStarParamsExample(starParamCount));
      }
      return generate(url);
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
