const { prettiest } = require("@dmail/prettiest")
const {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
} = require("@dmail/project-structure")
const { projectFolder } = require("../projectFolder.js")

const metaDescription = namedValueDescriptionToMetaDescription({
  formattable: {
    // js
    "/index.js": true,
    "/index.test.js": true,
    "/src/**/*.js": true,
    "/test/**/*.js": true,
    // json
    "/src/**/*.json": true,
    "/test/**/*.json": true,
    // md
    "/readme.md": true,
    "/doc/**.md": true,
    "/src/**/*.md": true,
    "/test/**/*.md": true,

    // ignore some dynamic folder
    "/**/dist/": false,
    "/**/.dist/": false,
  },
})

selectAllFileInsideFolder({
  pathname: projectFolder,
  metaDescription,
  predicate: (meta) => meta.formattable === true,
  transformFile: ({ filenameRelative }) => filenameRelative,
}).then((filenameRelativeArray) => {
  prettiest({ folder: projectFolder, filenameRelativeArray: filenameRelativeArray.sort() })
})
