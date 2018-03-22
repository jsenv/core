const { createNodeLoader } = require("../createLoader/createNodeLoader/index.js")

global.System = createNodeLoader()
