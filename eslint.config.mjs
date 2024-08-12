import { eslintConfigRelax } from "@jsenv/eslint-config-relax";

export default [
  ...eslintConfigRelax({
    type: "node",
    rootDirectoryUrl: new URL("./", import.meta.url),
    browserFiles: [
      "docs/**/*.js",
      "tests/dev_server/errors/stories/**/*.js",
      "tests/dev_server/**/fixtures/**/*.js",
      "packages/**/pwa/**/*.js",
      "packages/**/custom-elements-redefine/**/*.js",
      "packages/service-worker/**/*.js",
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
