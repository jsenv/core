const babel = require("babel-core")
const fs = require("fs")
const path = require("path")

const compileFolder = (folderLocation) => {
  const files = fs
    .readdirSync(folderLocation)
    .filter((fileName) => fileName.endsWith(".js"))
    .map((fileName) => `${folderLocation}/${fileName}`)

  files.forEach((fileLocation) => {
    const extname = path.extname(fileLocation)
    const fileName = path.basename(fileLocation, extname)

    if (fileName.endsWith(".es5")) {
      return
    }

    const fileOutputLocation = `${folderLocation}/${fileName}.es5.js`
    const fileOutputSourceMapLocation = `${folderLocation}/${fileName}.es5.js.map`

    const inputSource = fs.readFileSync(fileLocation).toString()

    const babelOptions = {
      filenameRelative: `${fileName}.js`,
      sourceMaps: true,
      babelrc: false,
      plugins: ["babel-plugin-transform-es2015-block-scoping"],
    }

    if (inputSource.includes("export")) {
      babelOptions.plugins.push("babel-plugin-transform-es2015-modules-systemjs")
    }

    const { code, map } = babel.transform(inputSource, babelOptions)

    const outputSource = `${code}
//# sourceURL=${fileLocation}
//# sourceMappingURL=${fileOutputSourceMapLocation}`

    delete map.sourcesContent
    map.sources[0] = fileLocation
    map.file = fileLocation

    fs.writeFileSync(fileOutputLocation, outputSource)
    fs.writeFileSync(fileOutputSourceMapLocation, JSON.stringify(map, null, "  "))
  })
}
exports.compileFolder = compileFolder

compileFolder(`${__dirname}/comment-absolute-system`)
