/* global require, __dirname */
const { pathToFileURL } = require("url")

exports.projectDirectoryUrl = `${String(pathToFileURL(__dirname))}/`
