const { cover, jsenvCoverDescription } = require("@jsenv/core")
const { projectPath } = require("../../jsenv.config.js")

cover({
  projectPath,
  coverDescription: {
    ...jsenvCoverDescription,
    "/.jsenv/": true,
  },
})
