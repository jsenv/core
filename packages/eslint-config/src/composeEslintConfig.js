import { composeTwoObjects } from "./internal/composeTwoObjects.js";

export const composeEslintConfig = (...eslintConfigs) => {
  return eslintConfigs.reduce((previous, current) => {
    const next = composeTwoEslintConfigs(previous, current);
    return next;
  }, {});
};

const composeTwoEslintConfigs = (firstEslintConfig, secondEslintConfig) => {
  return composeTwoObjects(firstEslintConfig, secondEslintConfig, {
    parserOptions: (firstParserOptions, secondParserOptions) => {
      return composeTwoObjects(firstParserOptions, secondParserOptions, {
        ecmaFeatures: (firstEcmaFeatures, secondEcmaFeatures) => {
          return {
            ...firstEcmaFeatures,
            ...secondEcmaFeatures,
          };
        },
      });
    },
    env: (firstEnv, secondEnv) => {
      return {
        ...firstEnv,
        ...secondEnv,
      };
    },
    globals: (firstGlobals, secondGlobals) => {
      return {
        ...firstGlobals,
        ...secondGlobals,
      };
    },
    plugins: (firstPlugins, secondPlugins) => {
      return [...firstPlugins, ...secondPlugins];
    },
    settings: (firstSettings, secondSettings) => {
      return composeTwoObjects(firstSettings, secondSettings, {
        extensions: (firstExtensions, secondExtensions) => {
          return [...firstExtensions, ...secondExtensions];
        },
      });
    },
    rules: (firstRules, secondRules) => {
      return {
        ...firstRules,
        ...secondRules,
      };
    },
    overrides: (firstOverrides, secondOverrides) => {
      return [...firstOverrides, ...secondOverrides];
    },
  });
};
