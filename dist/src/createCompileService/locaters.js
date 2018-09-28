"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSourceLocationForSourceMap = exports.getSourceMapAbstractLocation = exports.getSourceMapLocation = exports.getSourceAbstractLocation = exports.getOutputAssetLocation = exports.getOutputLocation = exports.getBranchLocation = exports.getOutputRelativeLocation = exports.getBranchRelativeLocation = exports.getCacheDataLocation = exports.getCacheFolderLocation = exports.getInputRelativeLocation = void 0;

var _cache = require("./cache.js");

var _helpers = require("./helpers.js");

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

var getInputRelativeLocation = function getInputRelativeLocation(_ref) {
  var abstractFolderRelativeLocation = _ref.abstractFolderRelativeLocation,
      filename = _ref.filename;
  // 'compiled/folder/file.js' -> 'folder/file.js'
  return filename.slice(abstractFolderRelativeLocation.length + 1);
};

exports.getInputRelativeLocation = getInputRelativeLocation;

var getCacheFolderLocation = function getCacheFolderLocation(_ref2) {
  var rootLocation = _ref2.rootLocation,
      cacheFolderRelativeLocation = _ref2.cacheFolderRelativeLocation,
      rest = _objectWithoutProperties(_ref2, ["rootLocation", "cacheFolderRelativeLocation"]);

  return (0, _helpers.resolvePath)(rootLocation, cacheFolderRelativeLocation, getInputRelativeLocation(rest));
};

exports.getCacheFolderLocation = getCacheFolderLocation;

var getCacheDataLocation = function getCacheDataLocation(param) {
  return (0, _helpers.resolvePath)(getCacheFolderLocation(param), _cache.JSON_FILE);
};

exports.getCacheDataLocation = getCacheDataLocation;

var getBranchRelativeLocation = function getBranchRelativeLocation(_ref3) {
  var cacheFolderRelativeLocation = _ref3.cacheFolderRelativeLocation,
      branch = _ref3.branch,
      rest = _objectWithoutProperties(_ref3, ["cacheFolderRelativeLocation", "branch"]);

  return (0, _helpers.resolvePath)(cacheFolderRelativeLocation, getInputRelativeLocation(rest), branch.name);
};

exports.getBranchRelativeLocation = getBranchRelativeLocation;

var getOutputRelativeLocation = function getOutputRelativeLocation(_ref4) {
  var filename = _ref4.filename,
      rest = _objectWithoutProperties(_ref4, ["filename"]);

  return (0, _helpers.resolvePath)(getBranchRelativeLocation(_objectSpread({
    filename: filename
  }, rest)), _path.default.basename(filename));
};

exports.getOutputRelativeLocation = getOutputRelativeLocation;

var getBranchLocation = function getBranchLocation(_ref5) {
  var rootLocation = _ref5.rootLocation,
      rest = _objectWithoutProperties(_ref5, ["rootLocation"]);

  return (0, _helpers.resolvePath)(rootLocation, getBranchRelativeLocation(rest));
};

exports.getBranchLocation = getBranchLocation;

var getOutputLocation = function getOutputLocation(_ref6) {
  var rootLocation = _ref6.rootLocation,
      rest = _objectWithoutProperties(_ref6, ["rootLocation"]);

  return (0, _helpers.resolvePath)(rootLocation, getOutputRelativeLocation(rest));
};

exports.getOutputLocation = getOutputLocation;

var getOutputAssetLocation = function getOutputAssetLocation(_ref7) {
  var asset = _ref7.asset,
      rest = _objectWithoutProperties(_ref7, ["asset"]);

  return (0, _helpers.resolvePath)(getBranchLocation(rest), asset.name);
};

exports.getOutputAssetLocation = getOutputAssetLocation;

var getSourceAbstractLocation = function getSourceAbstractLocation(_ref8) {
  var rootLocation = _ref8.rootLocation,
      inputRelativeLocation = _ref8.inputRelativeLocation;
  return (0, _helpers.resolvePath)(rootLocation, inputRelativeLocation);
};

exports.getSourceAbstractLocation = getSourceAbstractLocation;

var getSourceMapLocation = function getSourceMapLocation(_ref9) {
  var rootLocation = _ref9.rootLocation,
      outputRelativeLocation = _ref9.outputRelativeLocation,
      outputSourceMapName = _ref9.outputSourceMapName;
  return (0, _helpers.resolvePath)(rootLocation, _path.default.dirname(outputRelativeLocation), outputSourceMapName);
};

exports.getSourceMapLocation = getSourceMapLocation;

var getSourceMapAbstractLocation = function getSourceMapAbstractLocation(_ref10) {
  var rootLocation = _ref10.rootLocation,
      abstractFolderRelativeLocation = _ref10.abstractFolderRelativeLocation,
      inputRelativeLocation = _ref10.inputRelativeLocation,
      outputSourceMapName = _ref10.outputSourceMapName;
  return (0, _helpers.resolvePath)(rootLocation, abstractFolderRelativeLocation, _path.default.dirname(inputRelativeLocation), outputSourceMapName);
};

exports.getSourceMapAbstractLocation = getSourceMapAbstractLocation;
var sourceMapKnowsExactLocation = false;
var sourceMapUseAbsoluteLocation = true;

var getSourceLocationForSourceMap = function getSourceLocationForSourceMap(context) {
  if (sourceMapUseAbsoluteLocation) {
    return "/".concat(context.inputRelativeLocation);
  }

  var sourceLocation = getSourceAbstractLocation(context);
  var sourceMapLocation = sourceMapKnowsExactLocation ? getSourceMapLocation(context) : getSourceMapAbstractLocation(context);
  return (0, _helpers.normalizeSeparation)(_path.default.relative(_path.default.dirname(sourceMapLocation), sourceLocation));
};

exports.getSourceLocationForSourceMap = getSourceLocationForSourceMap;
//# sourceMappingURL=locaters.js.map