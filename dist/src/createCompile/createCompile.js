"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createCompile = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _identifier = require("./identifier.js");

var _instrumenterBabel = require("./instrumenter-babel.js");

var _minifier = require("./minifier.js");

var _optimizer = require("./optimizer.js");

var _remapper = require("./remapper.js");

var _transpiler = require("./transpiler.js");

var _helpers = require("../createCompileService/helpers.js");

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var transform = function transform(context, transformer) {
  return Promise.resolve(transformer(_extends({}, context, {
    inputSource: context.outputSource,
    inputSourceMap: context.outputSourceMap,
    inputAst: context.outputAst
  }))).then(function (result) {
    // for now result is expected to null, undefined, or an object with any properties named
    // outputSource, outputAst, outputSourceMap, outputSourceMapName, outputAssets

    if (result) {
      return _extends({}, context, result);
    }
    return context;
  });
};

var createDefaultOptions = function createDefaultOptions(_ref) {
  var abstractFolderRelativeLocation = _ref.abstractFolderRelativeLocation;

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

var instrumentPredicate = function instrumentPredicate(_ref2) {
  var inputRelativeLocation = _ref2.inputRelativeLocation;

  if (inputRelativeLocation.startsWith("node_modules/")) {
    return false;
  }
  // it should be passed by coverFolder
  // because we are duplicating the logic about
  // what is a test file and what is a source file there
  if (inputRelativeLocation.endsWith(".test.js")) {
    return false;
  }
  return true;
};

var createCompile = exports.createCompile = function createCompile() {
  var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref3$createOptions = _ref3.createOptions,
      createOptions = _ref3$createOptions === undefined ? function () {} : _ref3$createOptions,
      _ref3$transpiler = _ref3.transpiler,
      transpiler = _ref3$transpiler === undefined ? _transpiler.transpiler : _ref3$transpiler,
      _ref3$minifier = _ref3.minifier,
      minifier = _ref3$minifier === undefined ? _minifier.minifier : _ref3$minifier,
      _ref3$instrumenter = _ref3.instrumenter,
      instrumenter = _ref3$instrumenter === undefined ? _instrumenterBabel.instrumenter : _ref3$instrumenter,
      _ref3$optimizer = _ref3.optimizer,
      optimizer = _ref3$optimizer === undefined ? _optimizer.optimizer : _ref3$optimizer;

  var compile = function compile(compileContext) {
    return Promise.all([createDefaultOptions(compileContext), createOptions(compileContext)]).then(function (_ref4) {
      var _ref5 = _slicedToArray(_ref4, 2),
          defaultOptions = _ref5[0],
          _ref5$ = _ref5[1],
          customOptions = _ref5$ === undefined ? {} : _ref5$;

      var options = _extends({}, defaultOptions, customOptions);
      var identify = options.identify,
          transpile = options.transpile,
          instrument = options.instrument,
          minify = options.minify,
          optimize = options.optimize,
          remap = options.remap;


      var generate = function generate(_ref6) {
        var outputRelativeLocation = _ref6.outputRelativeLocation;

        // outputRelativeLocation dependent from options:
        // there is a 1/1 relationship between JSON.stringify(options) & outputRelativeLocation
        // it means we can get options from outputRelativeLocation & vice versa
        // this is how compile output gets cached

        // no location -> cannot identify
        if (!compileContext.inputRelativeLocation) {
          identify = false;
        }
        // if sourceMap are appended as comment do not put any //#sourceURL=../../file.js
        // because sourceMappingURL will try to resolve against sourceURL
        if (remap) {
          identify = false;
        }

        return Promise.resolve(_extends({
          outputSource: compileContext.inputSource,
          outputSourceMap: compileContext.inputSourceMap,
          // folder/file.js -> file.js.map
          outputSourceMapName: _path2["default"].basename(compileContext.inputRelativeLocation) + ".map",
          outputAst: compileContext.inputAst,
          getSourceNameForSourceMap: function getSourceNameForSourceMap(_ref7) {
            var rootLocation = _ref7.rootLocation,
                inputRelativeLocation = _ref7.inputRelativeLocation;

            return (0, _helpers.resolvePath)(rootLocation, inputRelativeLocation);
          },
          getSourceLocationForSourceMap: function getSourceLocationForSourceMap(_ref8) {
            var inputRelativeLocation = _ref8.inputRelativeLocation;

            return inputRelativeLocation;
          }
        }, compileContext, {
          outputRelativeLocation: outputRelativeLocation,
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
        }).then(function (_ref9) {
          var outputSource = _ref9.outputSource,
              _ref9$outputAssets = _ref9.outputAssets,
              outputAssets = _ref9$outputAssets === undefined ? {} : _ref9$outputAssets;

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

      return { options: options, generate: generate };
    });
  };

  return compile;
};
//# sourceMappingURL=createCompile.js.map