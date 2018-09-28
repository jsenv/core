"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openCompileServer = void 0;

var _url = require("url");

var _createCompile = require("../createCompile/createCompile.js");

var _index = require("../createCompileService/index.js");

var _index2 = require("../createFileService/index.js");

var _createResponseGenerator = require("../openServer/createResponseGenerator.js");

var _createNodeRequestHandler = require("../openServer/createNodeRequestHandler.js");

var _openServer = require("../openServer/openServer.js");

var _createSSERoom = require("./createSSERoom.js");

var _watchFile = require("../watchFile.js");

var _projectStructure = require("@dmail/project-structure");

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var guard = function guard(fn, shield) {
  return function () {
    return shield.apply(void 0, arguments) ? fn.apply(void 0, arguments) : undefined;
  };
};

var getRequiredHelper = function getRequiredHelper(_ref) {
  var rootLocation = _ref.rootLocation,
      instrument = _ref.instrument;

  if (instrument) {
    return (0, _projectStructure.createRoot)({
      root: rootLocation
    }).then(function (_ref2) {
      var getMetaForLocation = _ref2.getMetaForLocation;

      var instrumentPredicate = function instrumentPredicate(_ref3) {
        var inputRelativeLocation = _ref3.inputRelativeLocation;
        return Boolean(getMetaForLocation(inputRelativeLocation).cover);
      };

      return {
        instrumentPredicate: instrumentPredicate
      };
    });
  }

  return Promise.resolve({});
};

var openCompileServer = function openCompileServer(_ref4) {
  var url = _ref4.url,
      autoCloseOnExit = _ref4.autoCloseOnExit,
      autoCloseOnCrash = _ref4.autoCloseOnCrash,
      autoCloseOnError = _ref4.autoCloseOnError,
      _ref4$watch = _ref4.watch,
      watch = _ref4$watch === void 0 ? false : _ref4$watch,
      rootLocation = _ref4.rootLocation,
      _ref4$cacheFolderRela = _ref4.cacheFolderRelativeLocation,
      cacheFolderRelativeLocation = _ref4$cacheFolderRela === void 0 ? "build" : _ref4$cacheFolderRela,
      _ref4$abstractFolderR = _ref4.abstractFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref4$abstractFolderR === void 0 ? "compiled" : _ref4$abstractFolderR,
      _ref4$cors = _ref4.cors,
      cors = _ref4$cors === void 0 ? true : _ref4$cors,
      _ref4$transpile = _ref4.transpile,
      transpile = _ref4$transpile === void 0 ? true : _ref4$transpile,
      _ref4$sourceMap = _ref4.sourceMap,
      sourceMap = _ref4$sourceMap === void 0 ? "comment" : _ref4$sourceMap,
      _ref4$sourceURL = _ref4.sourceURL,
      sourceURL = _ref4$sourceURL === void 0 ? true : _ref4$sourceURL,
      _ref4$minify = _ref4.minify,
      minify = _ref4$minify === void 0 ? false : _ref4$minify,
      _ref4$optimize = _ref4.optimize,
      optimize = _ref4$optimize === void 0 ? false : _ref4$optimize,
      _ref4$instrument = _ref4.instrument,
      instrument = _ref4$instrument === void 0 ? false : _ref4$instrument;
  return Promise.all([getRequiredHelper({
    rootLocation: rootLocation,
    instrument: instrument
  }), (0, _openServer.openServer)({
    url: url,
    autoCloseOnExit: autoCloseOnExit,
    autoCloseOnCrash: autoCloseOnCrash,
    autoCloseOnError: autoCloseOnError
  })]).then(function (_ref5) {
    var _ref6 = _slicedToArray(_ref5, 2),
        helper = _ref6[0],
        server = _ref6[1];

    return _objectSpread({
      server: server
    }, helper);
  }).then(function (_ref7) {
    var server = _ref7.server,
        instrumentPredicate = _ref7.instrumentPredicate;

    var createWatchServices = function createWatchServices() {
      // https://github.com/dmail-old/http-eventsource/tree/master/lib
      var fileChangedSSE = (0, _createSSERoom.createSSERoom)();
      fileChangedSSE.open();
      var watchedFiles = new Map();
      server.closed.listenOnce(function () {
        watchedFiles.forEach(function (closeWatcher) {
          return closeWatcher();
        });
        watchedFiles.clear();
        fileChangedSSE.close();
      });

      var watchPredicate = function watchPredicate(relativeFilename) {
        // for now watch only js files (0 not favicon or .map files)
        return relativeFilename.endsWith(".js");
      };

      return [function (_ref8) {
        var headers = _ref8.headers;

        if (headers.get("accept") === "text/event-stream") {
          return fileChangedSSE.connect(headers.get("last-event-id"));
        }

        return null;
      }, function (_ref9) {
        var url = _ref9.url;
        var relativeFilename = url.pathname.slice(1);
        var dirname = relativeFilename.slice(0, relativeFilename.indexOf("/"));

        if (dirname === abstractFolderRelativeLocation) {
          // when I ask for a compiled file, watch the corresponding file on filesystem
          relativeFilename = relativeFilename.slice(abstractFolderRelativeLocation.length + 1);
        }

        var filename = "".concat(rootLocation, "/").concat(relativeFilename);

        if (watchedFiles.has(filename) === false && watchPredicate(relativeFilename)) {
          var fileWatcher = (0, _watchFile.watchFile)(filename, function () {
            fileChangedSSE.sendEvent({
              type: "file-changed",
              data: relativeFilename
            });
          });
          watchedFiles.set(url, fileWatcher);
        }
      }];
    };

    var compileFileFromCompileService;

    var createCompileServiceCustom = function createCompileServiceCustom() {
      var compile = (0, _createCompile.createCompile)({
        instrumentPredicate: instrumentPredicate,
        createOptions: function createOptions() {
          // we should use a token or something to prevent a browser from being taken for nodejs
          // because will have security impact as we are going to trust this
          // const isNodeClient =
          //   request.headers.has("user-agent") &&
          //   request.headers.get("user-agent").startsWith("node-fetch")
          var remap = sourceMap === "comment" || sourceMap === "inline";
          var remapMethod = sourceMap;
          var identify = sourceURL;
          var identifyMethod = "relative";
          return {
            identify: identify,
            identifyMethod: identifyMethod,
            transpile: transpile,
            instrument: instrument,
            remap: remap,
            remapMethod: remapMethod,
            minify: minify,
            optimize: optimize
          };
        }
      });

      var _createCompileService = (0, _index.createCompileService)({
        rootLocation: rootLocation,
        cacheFolderRelativeLocation: cacheFolderRelativeLocation,
        abstractFolderRelativeLocation: abstractFolderRelativeLocation,
        trackHit: true,
        compile: compile
      }),
          compileService = _createCompileService.service,
          compileFile = _createCompileService.compileFile;

      compileFileFromCompileService = compileFile;
      return guard(compileService, function (_ref10) {
        var method = _ref10.method,
            url = _ref10.url;

        if (method !== "GET" && method !== "HEAD") {
          return false;
        }

        var pathname = url.pathname; // '/compiled/folder/file.js' -> 'compiled/folder/file.js'

        var filename = pathname.slice(1);
        var dirname = filename.slice(0, filename.indexOf("/"));

        if (dirname !== abstractFolderRelativeLocation) {
          return false;
        }

        return true;
      });
    };

    var createFileServiceCustom = function createFileServiceCustom() {
      var fileService = (0, _index2.createFileService)();
      var previousFileService = fileService;
      return function (_ref11) {
        var url = _ref11.url,
            props = _objectWithoutProperties(_ref11, ["url"]);

        var fileURL = new _url.URL(url.pathname.slice(1), "file:///".concat(rootLocation, "/"));
        return previousFileService(_objectSpread({
          url: fileURL
        }, props));
      };
    };

    var handler = (0, _createResponseGenerator.createResponseGenerator)({
      services: _toConsumableArray(watch ? createWatchServices() : []).concat([createCompileServiceCustom(), createFileServiceCustom()])
    });
    server.addRequestHandler(handler, function (response) {
      return cors ? (0, _createNodeRequestHandler.enableCORS)(response) : response;
    });
    return _objectSpread({}, server, {
      compileURL: "".concat(server.url).concat(abstractFolderRelativeLocation),
      rootLocation: rootLocation,
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      compileFile: compileFileFromCompileService
    });
  });
}; // if we want to use react we must start a compileServer like that

/*
import { startCompileServer, defaultTransformer, createBabelOptions } from "@dmail/dev-server"

startCompileServer({
	transformer: (result, options, context) => {
		const { inputRelativeLocation } = context
		if (inputRelativeLocation.endsWith('.jsx')) {
			const babelOptions = createBabelOptions(result, options, context)
			const babelOptionWithReact = {
				...babelOptions,
				plugins: [
					['babel-plugin-syntax-jsx', {}],
					['babel-plugin-transform-react-jsx', { "pragma": "React.createElement" }],
					...babelOptions.plugins
				],
			}
			return babel.transform(result.code, babelOptionWithReact)
		]
		return defaultTransformer(result, options, context)
	}
})
*/
// in order to support a build specific to a given browser we could

/*
startCompileServer({
	createOptions: ({ request }) => {
		// we could run something client side to decide which
		// profile the client belongs to between a,b,c and send it by cookie or header
		// or decide this using user-agent
		const profile = request.headers.get('x-client-feature-profile')
		return {
			profile
		}
	},
	transformer: (result, options, context) => {
		if (options.profile === 'c') {
			return transformFewThings(result, options, context)
		}
		if (options.profile === 'b') {
			return transformSomeThings(result, options, context)
		}
		return transformAllThings(result, options, context)
	}
})
*/
// hot reloading https://github.com/dmail-old/es6-project/blob/master/lib/start.js#L62
// and https://github.com/dmail-old/project/blob/master/lib/sse.js


exports.openCompileServer = openCompileServer;
//# sourceMappingURL=openCompileServer.js.map