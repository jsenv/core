const { createEslintConfig } = require("@jsenv/eslint-config")

const config = createEslintConfig({
  projectDirectoryUrl: __dirname,
  importResolutionMethod: "import-map",
  // importResolverOptions: {
  //   logLevel: "debug",
  // },
})

// disable commonjs globals by default
// (package is "type": "module")
Object.assign(config.globals, {
  __filename: "off",
  __dirname: "off",
  require: "off",
})

config.overrides = [
  // inside *.cjs files. restore commonJS "globals"
  {
    files: ["**/*.cjs"],
    globals: {
      __filename: true,
      __dirname: true,
      require: true,
    },
  },
]

module.exports = config
