import { eslintConfigRelax } from "@jsenv/eslint-config-relax";
import globals from "globals";

export default [
  ...eslintConfigRelax({
    rootDirectoryUrl: import.meta.resolve("./"),
    browserFiles: [
      "docs/**/*.js",
      "tests/dev_server/errors/stories/**/*.js",
      "tests/dev_server/**/fixtures/**/*.js",
      // Needs to be explicitely configured as browser until https://github.com/eslint/eslint/pull/18742
      "packages/related/cli/template-web/src/**/*.js",
      "packages/related/cli/template-web-components/src/**/*.js",
      "packages/related/cli/template-web-preact/src/**/*",
      "packages/related/cli/template-web-react/src/**/*",
      "packages/**/frontend/**/*.js",
      "packages/**/frontend/**/*.jsx",
      "packages/private/oto/src/**/*.js",
      "packages/private/oto/src/**/*.jsx",
      "packages/private/oto/packages/**/*.js",
      "packages/private/oto/packages/**/*.jsx",
    ],
    browserAndNodeFiles: ["packages/**/assert/**/*.js"],
    jsxPragmaAuto: true,
    // importResolutionLogLevel: "debug",
    // Favor dev:jsenv package exports condition
    importResolutionDevConditions: ["dev:jsenv"],
  }),
  {
    // Client scripts of the devices plugin run in the browser. Placed after the
    // relax config so its browser globals win over the default node env.
    files: ["src/plugins/devices/client/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    rules: {
      "no-debugger": ["off"],
      "jsenv/no-unknown-params": process.env.CI
        ? ["off"] // too heavy for github actions
        : ["warn", { maxImportDepth: 2, reportAllUnknownParams: true }],
    },
  },
  {
    ignores: [
      "**/async-to-promises.js",
      "**/regenerator_runtime.js",
      "**/neuquant.js",
      "**/babel_helpers/",
      "**/_*test.*/",
      "**/_*test_manual.*/",
      "tests/dev_server/workspace_bundle/fixtures/**",
      "**/packages/tooling/eslint-plugin-jsenv/**/fixtures/**",
      "experiments/",
    ],
  },
];
