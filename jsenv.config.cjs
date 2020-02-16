/* globals require, __dirname */
const { pathToFileURL } = require("url")

exports.projectDirectoryUrl = String(new URL("./", `${pathToFileURL(__dirname)}/`))
