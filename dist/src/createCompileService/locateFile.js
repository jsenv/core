"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.locateFile = undefined;

var _module = require("module");

var _module2 = _interopRequireDefault(_module);

var _helpers = require("./helpers.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var locateNodeModule = function locateNodeModule(moduleLocation, location) {
  var requireContext = new _module2["default"](location);
  requireContext.paths = _module2["default"]._nodeModulePaths(location);
  return _module2["default"]._resolveFilename(moduleLocation, requireContext, true);
};

// "node_modules/aaa/main.js"
// returns { dependent: "": relativeDependency: "aaa/main.js"}

// "node_modules/bbb/node_modules/aaa/index.js"
// returns { dependent: "node_modules/bbb", relativeDependency: "aaa/index.js"}
var getNodeDependentAndRelativeDependency = function getNodeDependentAndRelativeDependency(fileLocation) {
  var prefixedLocation = fileLocation[0] === "/" ? fileLocation : "/" + fileLocation;
  var pattern = "/node_modules/";
  var lastNodeModulesIndex = prefixedLocation.lastIndexOf(pattern);

  if (lastNodeModulesIndex === 0) {
    var _dependent = "";
    var _relativeDependency = fileLocation.slice(pattern.length - 1);
    // console.log("node location", location, "means", { dependent, relativeDependency })
    return {
      dependent: _dependent,
      relativeDependency: _relativeDependency
    };
  }

  var dependent = fileLocation.slice(0, lastNodeModulesIndex - 1);
  var relativeDependency = fileLocation.slice(lastNodeModulesIndex + pattern.length - 1);
  // console.log("node location", location, "means", { dependent, relativeDependency })
  return {
    dependent: dependent,
    relativeDependency: relativeDependency
  };
};

var locateFile = exports.locateFile = function locateFile(relativeLocation, absoluteLocation) {
  if (relativeLocation.startsWith("node_modules/")) {
    var _getNodeDependentAndR = getNodeDependentAndRelativeDependency(relativeLocation),
        dependent = _getNodeDependentAndR.dependent,
        relativeDependency = _getNodeDependentAndR.relativeDependency;

    var nodeLocation = absoluteLocation;
    if (dependent) {
      nodeLocation += "/" + dependent;
    }
    nodeLocation += "/node_modules";

    try {
      return Promise.resolve(locateNodeModule(relativeDependency, nodeLocation));
    } catch (e) {
      if (e && e.code === "MODULE_NOT_FOUND") {
        return Promise.reject({ status: 404, reason: "MODULE_NOT_FOUND" });
      }
      throw e;
    }
  }

  return Promise.resolve((0, _helpers.resolvePath)(absoluteLocation, relativeLocation));
};
//# sourceMappingURL=locateFile.js.map