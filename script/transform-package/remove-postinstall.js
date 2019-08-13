const { readFileSync, writeFileSync } = require("fs")
const { resolve } = require("path")

const PACKAGE_PATH = resolve(__dirname, "../../package.json")
const PACKAGE_CACHED_PATH = resolve(__dirname, "../../cached-package.json")

const packageString = String(readFileSync(PACKAGE_PATH))
writeFileSync(PACKAGE_CACHED_PATH, packageString)

const publishedPackageObject = JSON.parse(packageString)
delete publishedPackageObject.scripts.postinstall
writeFileSync(PACKAGE_PATH, JSON.stringify(publishedPackageObject, null, "  "))
