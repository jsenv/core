const { readFileSync, writeFileSync, unlinkSync } = require("fs")
const { resolve } = require("path")

const PACKAGE_PATH = resolve(__dirname, "../../package.json")
const PACKAGE_CACHED_PATH = resolve(__dirname, "../../cached-package.json")

writeFileSync(PACKAGE_PATH, readFileSync(PACKAGE_CACHED_PATH))
unlinkSync(PACKAGE_CACHED_PATH)
