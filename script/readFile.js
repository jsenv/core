const { promisify } = require("util")
const { readFile: fsReadFile } = require("fs")

const readFile = promisify(fsReadFile)
exports.readFile = readFile
