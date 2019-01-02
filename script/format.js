const { prettiest } = require("@dmail/prettiest")
const { patternGroupToMetaMap, forEachRessourceMatching } = require("@dmail/project-structure")
const { localRoot } = require("./util.js")

const metaMap = patternGroupToMetaMap({
  format: {
    "**/*.js": true,
    "**/*.js/**": false,
    "**/*.json": true,
    "**/*.md": true,
    sourceMapTest: false,
    node_modules: false, // eslint-disable-line camelcase
    dist: false,
    build: false,
    "src/compileToService/test/fixtures/build": false,
    "src/__test__/file-with-syntax-error.js": false,
    "package.json": false,
    "package-lock.json": false,
  },
})

forEachRessourceMatching({
  localRoot,
  metaMap,
  predicate: (meta) => meta.format === true,
}).then((ressources) => {
  prettiest({ localRoot, ressources })
})
