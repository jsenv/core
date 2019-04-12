const { cover, generateCoverageLog, generateCoverageHTML } = require("@jsenv/core")
const { fileWrite } = require("@dmail/helper")
const {
  readImportMap,
  projectFolder,
  compileInto,
  babelConfigMap,
} = require("../../jsenv.config.js")
const { testDescription } = require("../test/test.config.js")

const coverageFile = `${projectFolder}/coverage/coverage-final.json`

const coverDescription = {
  "/index.js": true,
  "/src/**/*.js": true,
  "/**/*.test.*": false, // contains .test. -> nope
  "/**/test/": false, // inside a test folder -> nope
}

const generateFile = false

const generateLog = false

const generateHTMLFiles = false

;(async () => {
  const { coverageMap } = await cover({
    importMap: readImportMap(),
    projectFolder,
    compileInto,
    babelConfigMap,
    coverDescription,
    executeDescription: testDescription,
  })

  if (generateFile) {
    fileWrite(coverageFile, JSON.stringify(coverageMap, null, "  "))
  }
  if (generateLog) {
    generateCoverageLog(coverageMap)
  }
  if (generateHTMLFiles) {
    generateCoverageHTML(coverageMap)
  }
})()
