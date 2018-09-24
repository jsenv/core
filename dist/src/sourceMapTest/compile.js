"use strict";

var babel = require("babel-core");
var fs = require("fs");
var path = require("path");

var compileFolder = function compileFolder(folderLocation) {
  var files = fs.readdirSync(folderLocation).filter(function (fileName) {
    return fileName.endsWith(".js");
  }).map(function (fileName) {
    return folderLocation + "/" + fileName;
  });

  files.forEach(function (fileLocation) {
    var extname = path.extname(fileLocation);
    var fileName = path.basename(fileLocation, extname);

    if (fileName.endsWith(".es5")) {
      return;
    }

    var fileOutputLocation = folderLocation + "/" + fileName + ".es5.js";
    var fileOutputSourceMapLocation = folderLocation + "/" + fileName + ".es5.js.map";

    var inputSource = fs.readFileSync(fileLocation).toString();

    var babelOptions = {
      filenameRelative: fileName + ".js",
      sourceMaps: true,
      babelrc: false,
      plugins: ["babel-plugin-transform-es2015-block-scoping"]
    };

    if (inputSource.includes("export")) {
      babelOptions.plugins.push("babel-plugin-transform-es2015-modules-systemjs");
    }

    var _babel$transform = babel.transform(inputSource, babelOptions),
        code = _babel$transform.code,
        map = _babel$transform.map;

    var outputSource = code + "\n//# sourceMappingURL=" + fileOutputSourceMapLocation;

    delete map.sourcesContent;
    map.sources[0] = fileLocation;
    map.file = fileLocation;

    fs.writeFileSync(fileOutputLocation, outputSource);
    fs.writeFileSync(fileOutputSourceMapLocation, JSON.stringify(map, null, "  "));
  });
};
exports.compileFolder = compileFolder;

compileFolder(__dirname + "/vscode-bug");
//# sourceMappingURL=compile.js.map