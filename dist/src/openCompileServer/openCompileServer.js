"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openCompileServer = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _url = require("url");

var _createCompile = require("../createCompile/createCompile.js");

var _index = require("../createCompileService/index.js");

var _index2 = require("../createFileService/index.js");

var _createResponseGenerator = require("../openServer/createResponseGenerator.js");

var _createNodeRequestHandler = require("../openServer/createNodeRequestHandler.js");

var _openServer = require("../openServer/openServer.js");

var _createSSERoom = require("./createSSERoom.js");

var _watchFile = require("../watchFile.js");

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; } // https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

/* eslint-disable import/max-dependencies */


var guard = function guard(fn, shield) {
  return function () {
    return shield.apply(undefined, arguments) ? fn.apply(undefined, arguments) : undefined;
  };
};

var openCompileServer = function openCompileServer(_ref) {
  var url = _ref.url,
      autoCloseOnExit = _ref.autoCloseOnExit,
      autoCloseOnCrash = _ref.autoCloseOnCrash,
      autoCloseOnError = _ref.autoCloseOnError,
      _ref$watch = _ref.watch,
      watch = _ref$watch === undefined ? false : _ref$watch,
      rootLocation = _ref.rootLocation,
      _ref$cacheFolderRelat = _ref.cacheFolderRelativeLocation,
      cacheFolderRelativeLocation = _ref$cacheFolderRelat === undefined ? "build" : _ref$cacheFolderRelat,
      _ref$abstractFolderRe = _ref.abstractFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref$abstractFolderRe === undefined ? "compiled" : _ref$abstractFolderRe,
      _ref$cors = _ref.cors,
      cors = _ref$cors === undefined ? true : _ref$cors,
      _ref$transpile = _ref.transpile,
      transpile = _ref$transpile === undefined ? true : _ref$transpile,
      _ref$sourceMap = _ref.sourceMap,
      sourceMap = _ref$sourceMap === undefined ? "comment" : _ref$sourceMap,
      _ref$sourceURL = _ref.sourceURL,
      sourceURL = _ref$sourceURL === undefined ? true : _ref$sourceURL,
      _ref$minify = _ref.minify,
      minify = _ref$minify === undefined ? false : _ref$minify,
      _ref$optimize = _ref.optimize,
      optimize = _ref$optimize === undefined ? false : _ref$optimize,
      _ref$instrument = _ref.instrument,
      instrument = _ref$instrument === undefined ? false : _ref$instrument;

  return (0, _openServer.openServer)({
    url: url,
    autoCloseOnExit: autoCloseOnExit,
    autoCloseOnCrash: autoCloseOnCrash,
    autoCloseOnError: autoCloseOnError
  }).then(function (_ref2) {
    var url = _ref2.url,
        addRequestHandler = _ref2.addRequestHandler,
        close = _ref2.close,
        closed = _ref2.closed;

    var createWatchServices = function createWatchServices() {
      // https://github.com/dmail-old/http-eventsource/tree/master/lib

      var fileChangedSSE = (0, _createSSERoom.createSSERoom)();
      fileChangedSSE.open();
      var watchedFiles = new Map();
      closed.listenOnce(function () {
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

      return [function (_ref3) {
        var headers = _ref3.headers;

        if (headers.get("accept") === "text/event-stream") {
          return fileChangedSSE.connect(headers.get("last-event-id"));
        }
      }, function (_ref4) {
        var url = _ref4.url;

        var relativeFilename = url.pathname.slice(1);
        var dirname = relativeFilename.slice(0, relativeFilename.indexOf("/"));
        if (dirname === abstractFolderRelativeLocation) {
          // when I ask for a compiled file, watch the corresponding file on filesystem
          relativeFilename = relativeFilename.slice(abstractFolderRelativeLocation.length + 1);
        }

        var filename = rootLocation + "/" + relativeFilename;

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

    var compileFileFromCompileService = void 0;
    var createCompileServiceCustom = function createCompileServiceCustom() {
      var compile = (0, _createCompile.createCompile)({
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

      return guard(compileService, function (_ref5) {
        var method = _ref5.method,
            url = _ref5.url;

        if (method !== "GET" && method !== "HEAD") {
          return false;
        }

        var pathname = url.pathname;
        // '/compiled/folder/file.js' -> 'compiled/folder/file.js'
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
      return function (_ref6) {
        var url = _ref6.url,
            props = _objectWithoutProperties(_ref6, ["url"]);

        var fileURL = new _url.URL(url.pathname.slice(1), "file:///" + rootLocation + "/");

        return previousFileService(_extends({
          url: fileURL
        }, props));
      };
    };

    var handler = (0, _createResponseGenerator.createResponseGenerator)({
      services: [].concat(_toConsumableArray(watch ? createWatchServices() : []), [createCompileServiceCustom(), createFileServiceCustom()])
    });

    addRequestHandler(handler, function (response) {
      return cors ? (0, _createNodeRequestHandler.enableCORS)(response) : response;
    });

    return {
      close: close,
      url: url,
      compileURL: "" + url + abstractFolderRelativeLocation,
      rootLocation: rootLocation,
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      compileFile: compileFileFromCompileService
    };
  });
};

// if we want to use react we must start a compileServer like that
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