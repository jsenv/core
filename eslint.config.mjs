import { eslintConfigRelax } from "@jsenv/eslint-config-relax";

export default [
  ...eslintConfigRelax({
    rootDirectoryUrl: new URL("./", import.meta.url),
    browserFiles: [
      "docs/**/*.js",
      "tests/dev_server/errors/stories/**/*.js",
      "tests/dev_server/**/fixtures/**/*.js",
      // Needs to be explicitely configured as browser until https://github.com/eslint/eslint/pull/18742
      "packages/related/cli/template-web/src/**/*.js",
      "packages/related/cli/template-web-components/src/**/*.js",
      "packages/related/cli/template-web-preact/src/**/*",
      "packages/related/cli/template-web-react/src/**/*",
      "packages/**/pwa/**/*.js",
      "packages/**/custom-elements-redefine/**/*.js",
      "**/jsenv_service_worker.js",
    ],
    browserAndNodeFiles: ["packages/**/assert/**/*.js"],
    jsxPragmaAuto: true,
  }),
  {
    rules: {
      "no-debugger": ["off"],
    },
  },
  {
    ignores: [
      "**/async-to-promises.js",
      "**/regenerator_runtime.js",
      "**/neuquant.js",
      "**/babel_helpers/",
      "experiments/",
    ],
  },
];
