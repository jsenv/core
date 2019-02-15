const { prettiest } = require("@dmail/prettiest")
const {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
} = require("@dmail/project-structure")
const { projectFolder } = require("./projectFolder.js")

const metaDescription = namedValueDescriptionToMetaDescription({
  format: {
    "**/*.js": true,
    "**/*.json": true,
    "**/*.md": true,
    sourceMapTest: false,
    node_modules: false, // eslint-disable-line camelcase
    dist: false,
    build: false,
    "src/compileToService/test/fixtures/build": false,
    "package.json": false,
    "package-lock.json": false,
  },
})

selectAllFileInsideFolder({
  pathname: projectFolder,
  metaDescription,
  predicate: (meta) => meta.format === true,
  transformFile: ({ filenameRelative }) => filenameRelative,
}).then((filenameRelativeArray) => {
  prettiest({ folder: projectFolder, filenameRelativeArray })
})
