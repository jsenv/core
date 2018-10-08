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

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const guard = (fn, shield) => (...args) => {
  return shield(...args) ? fn(...args) : undefined;
};

const getRequiredHelper = ({
  rootLocation,
  instrument
}) => {
  if (instrument) {
    return (0, _projectStructure.createRoot)({
      root: rootLocation
    }).then(({
      getMetaForLocation
    }) => {
      const instrumentPredicate = ({
        inputRelativeLocation
      }) => {
        return Boolean(getMetaForLocation(inputRelativeLocation).cover);
      };

      return {
        instrumentPredicate
      };
    });
  }

  return Promise.resolve({});
};

const openCompileServer = ({
  // server options
  url,
  autoCloseOnExit,
  autoCloseOnCrash,
  autoCloseOnError,
  watch = false,
  // compile options
  rootLocation,
  cacheFolderRelativeLocation = "build",
  abstractFolderRelativeLocation = "compiled",
  cors = true,
  transpile = true,
  sourceMap = "comment",
  // can be "comment", "inline", "none"
  sourceURL = true,
  minify = false,
  optimize = false,
  instrument = false
}) => {
  return Promise.all([getRequiredHelper({
    rootLocation,
    instrument
  }), (0, _openServer.openServer)({
    url,
    autoCloseOnExit,
    autoCloseOnCrash,
    autoCloseOnError
  })]).then(([helper, server]) => {
    return _objectSpread({
      server
    }, helper);
  }).then(({
    server,
    instrumentPredicate
  }) => {
    const createWatchServices = () => {
      // https://github.com/dmail-old/http-eventsource/tree/master/lib
      const fileChangedSSE = (0, _createSSERoom.createSSERoom)();
      fileChangedSSE.open();
      const watchedFiles = new Map();
      server.closed.listenOnce(() => {
        watchedFiles.forEach(closeWatcher => closeWatcher());
        watchedFiles.clear();
        fileChangedSSE.close();
      });

      const watchPredicate = relativeFilename => {
        // for now watch only js files (0 not favicon or .map files)
        return relativeFilename.endsWith(".js");
      };

      return [({
        headers
      }) => {
        if (headers.accept === "text/event-stream") {
          return fileChangedSSE.connect(headers["last-event-id"]);
        }

        return null;
      }, ({
        url
      }) => {
        let relativeFilename = url.pathname.slice(1);
        const dirname = relativeFilename.slice(0, relativeFilename.indexOf("/"));

        if (dirname === abstractFolderRelativeLocation) {
          // when I ask for a compiled file, watch the corresponding file on filesystem
          relativeFilename = relativeFilename.slice(abstractFolderRelativeLocation.length + 1);
        }

        const filename = `${rootLocation}/${relativeFilename}`;

        if (watchedFiles.has(filename) === false && watchPredicate(relativeFilename)) {
          const fileWatcher = (0, _watchFile.watchFile)(filename, () => {
            fileChangedSSE.sendEvent({
              type: "file-changed",
              data: relativeFilename
            });
          });
          watchedFiles.set(url, fileWatcher);
        }
      }];
    };

    let compileFileFromCompileService;

    const createCompileServiceCustom = () => {
      const compile = (0, _createCompile.createCompile)({
        instrumentPredicate,
        createOptions: () => {
          // we should use a token or something to prevent a browser from being taken for nodejs
          // because will have security impact as we are going to trust this
          // const isNodeClient =
          //   request.headers.has("user-agent") &&
          //   request.headers.get("user-agent").startsWith("node-fetch")
          const remap = sourceMap === "comment" || sourceMap === "inline";
          const remapMethod = sourceMap;
          const identify = sourceURL;
          const identifyMethod = "relative";
          return {
            identify,
            identifyMethod,
            transpile,
            instrument,
            remap,
            remapMethod,
            minify,
            optimize
          };
        }
      });
      const {
        service: compileService,
        compileFile
      } = (0, _index.createCompileService)({
        rootLocation,
        cacheFolderRelativeLocation,
        abstractFolderRelativeLocation,
        trackHit: true,
        compile
      });
      compileFileFromCompileService = compileFile;
      return guard(compileService, ({
        method,
        url
      }) => {
        if (method !== "GET" && method !== "HEAD") {
          return false;
        }

        const pathname = url.pathname; // '/compiled/folder/file.js' -> 'compiled/folder/file.js'

        const filename = pathname.slice(1);
        const dirname = filename.slice(0, filename.indexOf("/"));

        if (dirname !== abstractFolderRelativeLocation) {
          return false;
        }

        return true;
      });
    };

    const createFileServiceCustom = () => {
      const fileService = (0, _index2.createFileService)();
      const previousFileService = fileService;
      return (_ref) => {
        let {
          url
        } = _ref,
            props = _objectWithoutProperties(_ref, ["url"]);

        const fileURL = new _url.URL(url.pathname.slice(1), `file:///${rootLocation}/`);
        return previousFileService(_objectSpread({
          url: fileURL
        }, props));
      };
    };

    const handler = (0, _createResponseGenerator.createResponseGenerator)({
      services: [...(watch ? createWatchServices() : []), createCompileServiceCustom(), createFileServiceCustom()]
    });
    server.addRequestHandler(handler, response => cors ? (0, _createNodeRequestHandler.enableCORS)(response) : response);
    return _objectSpread({}, server, {
      compileURL: `${server.url}${abstractFolderRelativeLocation}`,
      rootLocation,
      abstractFolderRelativeLocation,
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