const { createEslintConfig } = require("@jsenv/eslint-config")

const eslintConfig = createEslintConfig({
  projectDirectoryUrl: __dirname,
  importResolutionMethod: "import-map",
  importMapFileRelativeUrl: "./import-map.importmap",
  // importResolverOptions: {
  //   logLevel: "debug",
  // },
  html: true,
  node: true,
  prettier: true,
})

// disable commonjs globals by default
// (package is "type": "module")
Object.assign(eslintConfig.globals, {
  __filename: "off",
  __dirname: "off",
  require: "off",
})

eslintConfig.overrides.push({
  files: ["**/*.cjs"],
  // inside *.cjs files. restore commonJS "globals"
  globals: {
    __filename: true,
    __dirname: true,
    require: true,
  },
  // inside *.cjs files, use commonjs module resolution
  settings: {
    "import/resolver": {
      [Object.keys(eslintConfig.settings["import/resolver"])[0]]: {
        node: true,
        commonJsModuleResolution: true,
      },
    },
  },
})

eslintConfig.overrides.push({
  // several files are written for browsers, not Node.js
  files: [
    "**/createBrowserRuntime/**/*.js",
    "**/exploring/**/*.js",
    "**/toolbar/**/*.js",
    "**/browser-utils/**/*.js",
    "**/detectBrowser/**/*.js",
  ],
  env: {
    browser: true,
    node: false,
  },
})

module.exports = eslintConfig
