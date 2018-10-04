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

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const transform = (context, transformer) => {
  return Promise.resolve(transformer(_objectSpread({}, context, {
    inputSource: context.outputSource,
    inputSourceMap: context.outputSourceMap,
    inputAst: context.outputAst
  }))).then(result => {
    // for now result is expected to null, undefined, or an object with any properties named
    // outputSource, outputAst, outputSourceMap, outputSourceMapName, outputAssets
    if (result) {
      return _objectSpread({}, context, result);
    }

    return context;
  });
};

const createDefaultOptions = ({
  groupId,
  abstractFolderRelativeLocation
}) => {
  let transpile = false;

  if (abstractFolderRelativeLocation === "compiled") {
    transpile = true;
  }

  let instrument = false;

  if (abstractFolderRelativeLocation === "instrumented") {
    transpile = true;
    instrument = true;
  }

  const remap = true;
  return {
    groupId,
    identify: false,
    identifyMethod: "relative",
    transpile,
    minify: false,
    instrument,
    optimize: false,
    remap,
    remapMethod: "comment" // 'comment', 'inline'

  };
};

const createCompile = ({
  createOptions = () => {},
  transpiler = _transpiler.transpiler,
  minifier = _minifier.minifier,
  instrumenter = _instrumenterBabel.instrumenter,
  optimizer = _optimizer.optimizer,
  instrumentPredicate = () => true
} = {}) => {
  const getOptions = context => {
    return Promise.all([createDefaultOptions(context), createOptions(context)]).then(([defaultOptions, customOptions = {}]) => {
      return _objectSpread({}, defaultOptions, customOptions);
    });
  };

  const compile = compileContext => {
    return getOptions(compileContext).then(options => {
      let {
        identify,
        transpile,
        instrument,
        minify,
        optimize,
        remap
      } = options; // no location -> cannot identify

      if (!compileContext.inputRelativeLocation) {
        identify = false;
      } // if sourceMap are appended as comment do not put any //#sourceURL=../../file.js
      // because sourceMappingURL will try to resolve against sourceURL


      if (remap) {
        identify = false;
      }

      const generate = generateContext => {
        // generateContext.outputRelativeLocation dependent from options:
        // there is a 1/1 relationship between JSON.stringify(options) & outputRelativeLocation
        // it means we can get options from outputRelativeLocation & vice versa
        // this is how compile output gets cached
        return Promise.resolve(_objectSpread({
          outputSource: compileContext.inputSource,
          outputSourceMap: compileContext.inputSourceMap,
          // folder/file.js -> file.js.map
          outputSourceMapName: `${_path.default.basename(compileContext.inputRelativeLocation)}.map`,
          outputAst: compileContext.inputAst,
          getSourceNameForSourceMap: ({
            rootLocation,
            inputRelativeLocation
          }) => {
            return (0, _helpers.resolvePath)(rootLocation, inputRelativeLocation);
          },
          getSourceLocationForSourceMap: ({
            inputRelativeLocation
          }) => {
            return inputRelativeLocation;
          }
        }, compileContext, generateContext, {
          options
        })).then(context => transpile ? transform(context, transpiler) : context).then(context => {
          if (instrument && instrumentPredicate(context)) {
            return transform(context, instrumenter);
          }

          return context;
        }).then(context => minify ? transform(context, minifier) : context).then(context => optimize ? transform(context, optimizer) : context).then(context => identify ? transform(context, _identifier.identifier) : context).then(context => remap ? transform(context, _remapper.remapper) : context).then(({
          outputSource,
          outputAssets = {}
        }) => {
          return {
            output: outputSource,
            outputAssets: Object.keys(outputAssets).map(name => {
              return {
                name,
                content: outputAssets[name]
              };
            })
          };
        });
      };

      return {
        options,
        generate
      };
    });
  };

  return compile;
};

exports.createCompile = createCompile;
//# sourceMappingURL=createCompile.js.map