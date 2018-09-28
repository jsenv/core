"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.locateFile = void 0;

var _module = _interopRequireDefault(require("module"));

var _helpers = require("./helpers.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var locateNodeModule = function locateNodeModule(moduleLocation, location) {
  var requireContext = new _module.default(location);
  requireContext.paths = _module.default._nodeModulePaths(location);
  return _module.default._resolveFilename(moduleLocation, requireContext, true);
}; // "node_modules/aaa/main.js"
// returns { dependent: "": relativeDependency: "aaa/main.js"}
// "node_modules/bbb/node_modules/aaa/index.js"
// returns { dependent: "node_modules/bbb", relativeDependency: "aaa/index.js"}


var getNodeDependentAndRelativeDependency = function getNodeDependentAndRelativeDependency(fileLocation) {
  var prefixedLocation = fileLocation[0] === "/" ? fileLocation : "/".concat(fileLocation);
  var pattern = "/node_modules/";
  var lastNodeModulesIndex = prefixedLocation.lastIndexOf(pattern);

  if (lastNodeModulesIndex === 0) {
    var _dependent = "";

    var _relativeDependency = fileLocation.slice(pattern.length - 1); // console.log("node location", location, "means", { dependent, relativeDependency })


    return {
      dependent: _dependent,
      relativeDependency: _relativeDependency
    };
  }

  var dependent = fileLocation.slice(0, lastNodeModulesIndex - 1);
  var relativeDependency = fileLocation.slice(lastNodeModulesIndex + pattern.length - 1); // console.log("node location", location, "means", { dependent, relativeDependency })

  return {
    dependent: dependent,
    relativeDependency: relativeDependency
  };
};

var locateFile = function locateFile(relativeLocation, absoluteLocation) {
  if (relativeLocation.startsWith("node_modules/")) {
    var _getNodeDependentAndR = getNodeDependentAndRelativeDependency(relativeLocation),
        dependent = _getNodeDependentAndR.dependent,
        relativeDependency = _getNodeDependentAndR.relativeDependency;

    var nodeLocation = absoluteLocation;

    if (dependent) {
      nodeLocation += "/".concat(dependent);
    }

    nodeLocation += "/node_modules";

    try {
      return Promise.resolve(locateNodeModule(relativeDependency, nodeLocation));
    } catch (e) {
      if (e && e.code === "MODULE_NOT_FOUND") {
        return Promise.reject({
          status: 404,
          reason: "MODULE_NOT_FOUND"
        });
      }

      throw e;
    }
  }

  return Promise.resolve((0, _helpers.resolvePath)(absoluteLocation, relativeLocation));
};

exports.locateFile = locateFile;
//# sourceMappingURL=locateFile.js.map