"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createCompile = void 0;

var _identifier = require("./identifier.js");

var _instrumenterBabel = require("./instrumenter-babel.js");

var _minifier = require("./minifier.js");

var _optimizer = require("./optimizer.js");

var _remapper = require("./remapper.js");

var _transpiler = require("./transpiler.js");

var _helpers = require("../createCompileService/helpers.js");

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var transform = function transform(context, transformer) {
  return Promise.resolve(transformer(_objectSpread({}, context, {
    inputSource: context.outputSource,
    inputSourceMap: context.outputSourceMap,
    inputAst: context.outputAst
  }))).then(function (result) {
    // for now result is expected to null, undefined, or an object with any properties named
    // outputSource, outputAst, outputSourceMap, outputSourceMapName, outputAssets
    if (result) {
      return _objectSpread({}, context, result);
    }

    return context;
  });
};

var createDefaultOptions = function createDefaultOptions(_ref) {
  var groupId = _ref.groupId,
      abstractFolderRelativeLocation = _ref.abstractFolderRelativeLocation;
  var transpile = false;

  if (abstractFolderRelativeLocation === "compiled") {
    transpile = true;
  }

  var instrument = false;

  if (abstractFolderRelativeLocation === "instrumented") {
    transpile = true;
    instrument = true;
  }

  var remap = true;
  return {
    groupId: groupId,
    identify: false,
    identifyMethod: "relative",
    transpile: transpile,
    minify: false,
    instrument: instrument,
    optimize: false,
    remap: remap,
    remapMethod: "comment" // 'comment', 'inline'

  };
};

var createCompile = function createCompile() {
  var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref2$createOptions = _ref2.createOptions,
      createOptions = _ref2$createOptions === void 0 ? function () {} : _ref2$createOptions,
      _ref2$transpiler = _ref2.transpiler,
      transpiler = _ref2$transpiler === void 0 ? _transpiler.transpiler : _ref2$transpiler,
      _ref2$minifier = _ref2.minifier,
      minifier = _ref2$minifier === void 0 ? _minifier.minifier : _ref2$minifier,
      _ref2$instrumenter = _ref2.instrumenter,
      instrumenter = _ref2$instrumenter === void 0 ? _instrumenterBabel.instrumenter : _ref2$instrumenter,
      _ref2$optimizer = _ref2.optimizer,
      optimizer = _ref2$optimizer === void 0 ? _optimizer.optimizer : _ref2$optimizer,
      _ref2$instrumentPredi = _ref2.instrumentPredicate,
      instrumentPredicate = _ref2$instrumentPredi === void 0 ? function () {
    return true;
  } : _ref2$instrumentPredi;

  var getOptions = function getOptions(context) {
    return Promise.all([createDefaultOptions(context), createOptions(context)]).then(function (_ref3) {
      var _ref4 = _slicedToArray(_ref3, 2),
          defaultOptions = _ref4[0],
          _ref4$ = _ref4[1],
          customOptions = _ref4$ === void 0 ? {} : _ref4$;

      return _objectSpread({}, defaultOptions, customOptions);
    });
  };

  var compile = function compile(compileContext) {
    return getOptions(compileContext).then(function (options) {
      var identify = options.identify,
          transpile = options.transpile,
          instrument = options.instrument,
          minify = options.minify,
          optimize = options.optimize,
          remap = options.remap; // no location -> cannot identify

      if (!compileContext.inputRelativeLocation) {
        identify = false;
      } // if sourceMap are appended as comment do not put any //#sourceURL=../../file.js
      // because sourceMappingURL will try to resolve against sourceURL


      if (remap) {
        identify = false;
      }

      var generate = function generate(generateContext) {
        // generateContext.outputRelativeLocation dependent from options:
        // there is a 1/1 relationship between JSON.stringify(options) & outputRelativeLocation
        // it means we can get options from outputRelativeLocation & vice versa
        // this is how compile output gets cached
        return Promise.resolve(_objectSpread({
          outputSource: compileContext.inputSource,
          outputSourceMap: compileContext.inputSourceMap,
          // folder/file.js -> file.js.map
          outputSourceMapName: "".concat(_path.default.basename(compileContext.inputRelativeLocation), ".map"),
          outputAst: compileContext.inputAst,
          getSourceNameForSourceMap: function getSourceNameForSourceMap(_ref5) {
            var rootLocation = _ref5.rootLocation,
                inputRelativeLocation = _ref5.inputRelativeLocation;
            return (0, _helpers.resolvePath)(rootLocation, inputRelativeLocation);
          },
          getSourceLocationForSourceMap: function getSourceLocationForSourceMap(_ref6) {
            var inputRelativeLocation = _ref6.inputRelativeLocation;
            return inputRelativeLocation;
          }
        }, compileContext, generateContext, {
          options: options
        })).then(function (context) {
          return transpile ? transform(context, transpiler) : context;
        }).then(function (context) {
          if (instrument && instrumentPredicate(context)) {
            return transform(context, instrumenter);
          }

          return context;
        }).then(function (context) {
          return minify ? transform(context, minifier) : context;
        }).then(function (context) {
          return optimize ? transform(context, optimizer) : context;
        }).then(function (context) {
          return identify ? transform(context, _identifier.identifier) : context;
        }).then(function (context) {
          return remap ? transform(context, _remapper.remapper) : context;
        }).then(function (_ref7) {
          var outputSource = _ref7.outputSource,
              _ref7$outputAssets = _ref7.outputAssets,
              outputAssets = _ref7$outputAssets === void 0 ? {} : _ref7$outputAssets;
          return {
            output: outputSource,
            outputAssets: Object.keys(outputAssets).map(function (name) {
              return {
                name: name,
                content: outputAssets[name]
              };
            })
          };
        });
      };

      return {
        options: options,
        generate: generate
      };
    });
  };

  return compile;
};

exports.createCompile = createCompile;
//# sourceMappingURL=createCompile.js.map