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

const getInputRelativeLocation = ({
  abstractFolderRelativeLocation,
  filename
}) => {
  // 'compiled/folder/file.js' -> 'folder/file.js'
  return filename.slice(abstractFolderRelativeLocation.length + 1);
};

exports.getInputRelativeLocation = getInputRelativeLocation;

const getCacheFolderLocation = (_ref) => {
  let {
    rootLocation,
    cacheFolderRelativeLocation
  } = _ref,
      rest = _objectWithoutProperties(_ref, ["rootLocation", "cacheFolderRelativeLocation"]);

  return (0, _helpers.resolvePath)(rootLocation, cacheFolderRelativeLocation, getInputRelativeLocation(rest));
};

exports.getCacheFolderLocation = getCacheFolderLocation;

const getCacheDataLocation = param => {
  return (0, _helpers.resolvePath)(getCacheFolderLocation(param), _cache.JSON_FILE);
};

exports.getCacheDataLocation = getCacheDataLocation;

const getBranchRelativeLocation = (_ref2) => {
  let {
    cacheFolderRelativeLocation,
    branch
  } = _ref2,
      rest = _objectWithoutProperties(_ref2, ["cacheFolderRelativeLocation", "branch"]);

  return (0, _helpers.resolvePath)(cacheFolderRelativeLocation, getInputRelativeLocation(rest), branch.name);
};

exports.getBranchRelativeLocation = getBranchRelativeLocation;

const getOutputRelativeLocation = (_ref3) => {
  let {
    filename
  } = _ref3,
      rest = _objectWithoutProperties(_ref3, ["filename"]);

  return (0, _helpers.resolvePath)(getBranchRelativeLocation(_objectSpread({
    filename
  }, rest)), _path.default.basename(filename));
};

exports.getOutputRelativeLocation = getOutputRelativeLocation;

const getBranchLocation = (_ref4) => {
  let {
    rootLocation
  } = _ref4,
      rest = _objectWithoutProperties(_ref4, ["rootLocation"]);

  return (0, _helpers.resolvePath)(rootLocation, getBranchRelativeLocation(rest));
};

exports.getBranchLocation = getBranchLocation;

const getOutputLocation = (_ref5) => {
  let {
    rootLocation
  } = _ref5,
      rest = _objectWithoutProperties(_ref5, ["rootLocation"]);

  return (0, _helpers.resolvePath)(rootLocation, getOutputRelativeLocation(rest));
};

exports.getOutputLocation = getOutputLocation;

const getOutputAssetLocation = (_ref6) => {
  let {
    asset
  } = _ref6,
      rest = _objectWithoutProperties(_ref6, ["asset"]);

  return (0, _helpers.resolvePath)(getBranchLocation(rest), asset.name);
};

exports.getOutputAssetLocation = getOutputAssetLocation;

const getSourceAbstractLocation = ({
  rootLocation,
  inputRelativeLocation
}) => (0, _helpers.resolvePath)(rootLocation, inputRelativeLocation);

exports.getSourceAbstractLocation = getSourceAbstractLocation;

const getSourceMapLocation = ({
  rootLocation,
  outputRelativeLocation,
  outputSourceMapName
}) => (0, _helpers.resolvePath)(rootLocation, _path.default.dirname(outputRelativeLocation), outputSourceMapName);

exports.getSourceMapLocation = getSourceMapLocation;

const getSourceMapAbstractLocation = ({
  rootLocation,
  abstractFolderRelativeLocation,
  inputRelativeLocation,
  outputSourceMapName
}) => (0, _helpers.resolvePath)(rootLocation, abstractFolderRelativeLocation, _path.default.dirname(inputRelativeLocation), outputSourceMapName);

exports.getSourceMapAbstractLocation = getSourceMapAbstractLocation;
const sourceMapKnowsExactLocation = false;
const sourceMapUseAbsoluteLocation = true;

const getSourceLocationForSourceMap = context => {
  if (sourceMapUseAbsoluteLocation) {
    return `/${context.inputRelativeLocation}`;
  }

  const sourceLocation = getSourceAbstractLocation(context);
  const sourceMapLocation = sourceMapKnowsExactLocation ? getSourceMapLocation(context) : getSourceMapAbstractLocation(context);
  return (0, _helpers.normalizeSeparation)(_path.default.relative(_path.default.dirname(sourceMapLocation), sourceLocation));
};

exports.getSourceLocationForSourceMap = getSourceLocationForSourceMap;
//# sourceMappingURL=locaters.js.map