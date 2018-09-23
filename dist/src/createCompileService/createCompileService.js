"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createCompileService = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _cuid = require("cuid");

var _cuid2 = _interopRequireDefault(_cuid);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _url = require("url");

var _createCompile = require("../createCompile/createCompile.js");

var _cache = require("./cache.js");

var _helpers = require("./helpers.js");

var _locateFile = require("./locateFile.js");

var _readFile = require("./readFile.js");

var _ressourceRegistry = require("./ressourceRegistry.js");

var _writeFile = require("./writeFile.js");

var _createFileService = require("../createFileService/createFileService.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; } /* eslint-disable import/max-dependencies */


var compareBranch = function compareBranch(branchA, branchB) {
  var lastMatchDiff = branchA.lastMatchMs - branchB.lastMatchMs;

  if (lastMatchDiff === 0) {
    return branchA.matchCount - branchB.matchCount;
  }
  return lastMatchDiff;
};

var getInputRelativeLocation = function getInputRelativeLocation(_ref) {
  var abstractFolderRelativeLocation = _ref.abstractFolderRelativeLocation,
      filename = _ref.filename;

  // 'compiled/folder/file.js' -> 'folder/file.js'
  return filename.slice(abstractFolderRelativeLocation.length + 1);
};

var getCacheFolderLocation = function getCacheFolderLocation(_ref2) {
  var rootLocation = _ref2.rootLocation,
      cacheFolderRelativeLocation = _ref2.cacheFolderRelativeLocation,
      rest = _objectWithoutProperties(_ref2, ["rootLocation", "cacheFolderRelativeLocation"]);

  return (0, _helpers.resolvePath)(rootLocation, cacheFolderRelativeLocation, getInputRelativeLocation(rest));
};

var getCacheDataLocation = function getCacheDataLocation(param) {
  return (0, _helpers.resolvePath)(getCacheFolderLocation(param), _cache.JSON_FILE);
};

var getBranchRelativeLocation = function getBranchRelativeLocation(_ref3) {
  var cacheFolderRelativeLocation = _ref3.cacheFolderRelativeLocation,
      branch = _ref3.branch,
      rest = _objectWithoutProperties(_ref3, ["cacheFolderRelativeLocation", "branch"]);

  return (0, _helpers.resolvePath)(cacheFolderRelativeLocation, getInputRelativeLocation(rest), branch.name);
};

var getOutputRelativeLocation = function getOutputRelativeLocation(_ref4) {
  var filename = _ref4.filename,
      rest = _objectWithoutProperties(_ref4, ["filename"]);

  return (0, _helpers.resolvePath)(getBranchRelativeLocation(_extends({ filename: filename }, rest)), _path2["default"].basename(filename));
};

var getBranchLocation = function getBranchLocation(_ref5) {
  var rootLocation = _ref5.rootLocation,
      rest = _objectWithoutProperties(_ref5, ["rootLocation"]);

  return (0, _helpers.resolvePath)(rootLocation, getBranchRelativeLocation(rest));
};

var getOutputLocation = function getOutputLocation(_ref6) {
  var rootLocation = _ref6.rootLocation,
      rest = _objectWithoutProperties(_ref6, ["rootLocation"]);

  return (0, _helpers.resolvePath)(rootLocation, getOutputRelativeLocation(rest));
};

var getOutputAssetLocation = function getOutputAssetLocation(_ref7) {
  var asset = _ref7.asset,
      rest = _objectWithoutProperties(_ref7, ["asset"]);

  return (0, _helpers.resolvePath)(getBranchLocation(rest), asset.name);
};

var readBranchMain = function readBranchMain(_ref8) {
  var rootLocation = _ref8.rootLocation,
      cacheFolderRelativeLocation = _ref8.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref8.abstractFolderRelativeLocation,
      filename = _ref8.filename,
      inputLocation = _ref8.inputLocation,
      inputETagClient = _ref8.inputETagClient,
      cache = _ref8.cache,
      branch = _ref8.branch;

  return (0, _readFile.readFile)({ location: inputLocation }).then(function (_ref9) {
    var content = _ref9.content;

    var inputETag = (0, _helpers.createETag)(content);

    return Promise.resolve().then(function () {
      // faudra pouvoir désactiver ce check lorsqu'on veut juste connaitre l'état du cache
      if (inputETagClient) {
        if (inputETag !== inputETagClient) {
          return {
            status: "eTag modified on " + inputLocation + " since it was cached by client",
            inputETagClient: inputETagClient
          };
        }
        return { status: "valid" };
      }

      var inputETagCached = cache.inputETag;
      if (inputETag !== inputETagCached) {
        return {
          status: "eTag modified on " + inputLocation + " since it was cached on filesystem",
          inputETagCached: inputETagCached
        };
      }

      var outputLocation = getOutputLocation({
        rootLocation: rootLocation,
        cacheFolderRelativeLocation: cacheFolderRelativeLocation,
        abstractFolderRelativeLocation: abstractFolderRelativeLocation,
        filename: filename,
        branch: branch
      });
      return (0, _readFile.readFile)({
        location: outputLocation,
        errorHandler: _helpers.isFileNotFoundError
      }).then(function (_ref10) {
        var content = _ref10.content,
            error = _ref10.error;

        if (error) {
          return {
            status: "cache not found at " + outputLocation
          };
        }
        return { status: "valid", output: content };
      });
    }).then(function (moreData) {
      return _extends({
        input: content,
        inputETag: inputETag
      }, moreData);
    });
  });
};

var readBranchAsset = function readBranchAsset(_ref11) {
  var rootLocation = _ref11.rootLocation,
      cacheFolderRelativeLocation = _ref11.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref11.abstractFolderRelativeLocation,
      filename = _ref11.filename,
      cache = _ref11.cache,
      branch = _ref11.branch,
      asset = _ref11.asset;

  var outputAssetLocation = getOutputAssetLocation({
    rootLocation: rootLocation,
    cacheFolderRelativeLocation: cacheFolderRelativeLocation,
    abstractFolderRelativeLocation: abstractFolderRelativeLocation,
    filename: filename,
    branch: branch,
    asset: asset
  });
  var name = asset.name;

  return (0, _readFile.readFile)({
    location: outputAssetLocation,
    errorHandler: _helpers.isFileNotFoundError
  }).then(function (_ref12) {
    var content = _ref12.content,
        error = _ref12.error;

    if (error) {
      return {
        status: "asset file not found " + outputAssetLocation,
        name: name
      };
    }

    var actual = (0, _helpers.createETag)(content);
    var expected = asset.eTag;
    if (actual !== expected) {
      return {
        status: "unexpected " + asset.name + " asset for " + cache.inputRelativeLocation + ": unexpected eTag",
        name: name,
        content: content
      };
    }
    return {
      status: "valid",
      name: name,
      content: content
    };
  });
};

var readBranch = function readBranch(_ref13) {
  var rootLocation = _ref13.rootLocation,
      cacheFolderRelativeLocation = _ref13.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref13.abstractFolderRelativeLocation,
      filename = _ref13.filename,
      inputLocation = _ref13.inputLocation,
      inputETagClient = _ref13.inputETagClient,
      cache = _ref13.cache,
      branch = _ref13.branch;

  return Promise.all([readBranchMain({
    rootLocation: rootLocation,
    cacheFolderRelativeLocation: cacheFolderRelativeLocation,
    abstractFolderRelativeLocation: abstractFolderRelativeLocation,
    filename: filename,
    inputLocation: inputLocation,
    inputETagClient: inputETagClient,
    cache: cache,
    branch: branch
  })].concat(_toConsumableArray(branch.outputAssets.map(function (outputAsset) {
    return readBranchAsset({
      rootLocation: rootLocation,
      cacheFolderRelativeLocation: cacheFolderRelativeLocation,
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      filename: filename,
      cache: cache,
      branch: branch,
      asset: outputAsset
    });
  })))).then(function (_ref14) {
    var _ref15 = _toArray(_ref14),
        mainData = _ref15[0],
        assetsData = _ref15.slice(1);

    var status = mainData.status,
        input = mainData.input,
        inputETag = mainData.inputETag,
        output = mainData.output;


    var computedStatus = void 0;
    if (status === "valid") {
      var invalidAsset = assetsData.find(function (assetData) {
        return assetData.status !== "valid";
      });
      computedStatus = invalidAsset ? invalidAsset.status : "valid";
    } else {
      computedStatus = status;
    }

    return {
      status: computedStatus,
      input: input,
      inputETag: inputETag,
      output: output,
      outputAssets: assetsData
    };
  });
};

var getSourceAbstractLocation = function getSourceAbstractLocation(_ref16) {
  var rootLocation = _ref16.rootLocation,
      inputRelativeLocation = _ref16.inputRelativeLocation;
  return (0, _helpers.resolvePath)(rootLocation, inputRelativeLocation);
};

var getSourceMapLocation = function getSourceMapLocation(_ref17) {
  var rootLocation = _ref17.rootLocation,
      outputRelativeLocation = _ref17.outputRelativeLocation,
      outputSourceMapName = _ref17.outputSourceMapName;
  return (0, _helpers.resolvePath)(rootLocation, _path2["default"].dirname(outputRelativeLocation), outputSourceMapName);
};

var sourceMapKnowsExactLocation = false;

var getSourceMapAbstractpLocation = function getSourceMapAbstractpLocation(_ref18) {
  var rootLocation = _ref18.rootLocation,
      abstractFolderRelativeLocation = _ref18.abstractFolderRelativeLocation,
      inputRelativeLocation = _ref18.inputRelativeLocation,
      outputSourceMapName = _ref18.outputSourceMapName;
  return (0, _helpers.resolvePath)(rootLocation, abstractFolderRelativeLocation, _path2["default"].dirname(inputRelativeLocation), outputSourceMapName);
};

var getFileBranch = function getFileBranch(_ref19) {
  var rootLocation = _ref19.rootLocation,
      cacheFolderRelativeLocation = _ref19.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref19.abstractFolderRelativeLocation,
      filename = _ref19.filename,
      compile = _ref19.compile;

  var inputRelativeLocation = getInputRelativeLocation({
    abstractFolderRelativeLocation: abstractFolderRelativeLocation,
    filename: filename
  });

  var cacheDataLocation = getCacheDataLocation({
    rootLocation: rootLocation,
    cacheFolderRelativeLocation: cacheFolderRelativeLocation,
    abstractFolderRelativeLocation: abstractFolderRelativeLocation,
    filename: filename
  });

  return Promise.all([(0, _locateFile.locateFile)(inputRelativeLocation, rootLocation), (0, _readFile.readFile)({
    location: cacheDataLocation,
    errorHandler: _helpers.isFileNotFoundError
  }).then(function (_ref20) {
    var content = _ref20.content,
        error = _ref20.error;

    if (error) {
      return {
        branches: []
      };
    }
    var cache = JSON.parse(content);
    if (cache.inputRelativeLocation !== inputRelativeLocation) {
      throw new Error(_cache.JSON_FILE + " corrupted: unexpected inputRelativeLocation " + cache.inputRelativeLocation + ", it must be " + inputRelativeLocation);
    }
    return cache;
  })]).then(function (_ref21) {
    var _ref22 = _slicedToArray(_ref21, 2),
        inputLocation = _ref22[0],
        cache = _ref22[1];

    return {
      inputLocation: inputLocation,
      cache: cache
    };
  }).then(function (_ref23) {
    var inputLocation = _ref23.inputLocation,
        cache = _ref23.cache;

    // here, if readFile returns ENOENT we could/should check is there is something in cache for that file
    // and take that chance to remove the cached version of that file
    // but it's not supposed to happen
    return (0, _readFile.readFile)({
      location: inputLocation
    }).then(function (_ref24) {
      var content = _ref24.content;

      return compile({
        rootLocation: rootLocation,
        abstractFolderRelativeLocation: abstractFolderRelativeLocation,
        inputRelativeLocation: inputRelativeLocation,
        inputSource: content,
        filename: filename,
        getSourceNameForSourceMap: function getSourceNameForSourceMap() {
          return filename;
        },
        getSourceLocationForSourceMap: function getSourceLocationForSourceMap(context) {
          var sourceMapUseAbsoluteLocation = true;

          if (sourceMapUseAbsoluteLocation) {
            return "/" + context.inputRelativeLocation;
          }

          var sourceLocation = getSourceAbstractLocation(context);
          var sourceMapLocation = sourceMapKnowsExactLocation ? getSourceMapLocation(context) : getSourceMapAbstractpLocation(context);
          var sourceLocationRelativeToSourceMapLocation = (0, _helpers.normalizeSeparation)(_path2["default"].relative(_path2["default"].dirname(sourceMapLocation), sourceLocation));

          return sourceLocationRelativeToSourceMapLocation;
        }
      }).then(function (_ref25) {
        var options = _ref25.options,
            generate = _ref25.generate;

        var branchIsValid = function branchIsValid(branch) {
          return JSON.stringify(branch.outputMeta) === JSON.stringify(options);
        };

        var cachedBranch = cache.branches.find(function (branch) {
          return branchIsValid(branch);
        });

        return {
          inputLocation: inputLocation,
          cache: cache,
          options: options,
          generate: generate,
          input: content,
          branch: cachedBranch
        };
      });
    });
  });
};

var getFileReport = function getFileReport(_ref26) {
  var rootLocation = _ref26.rootLocation,
      cacheFolderRelativeLocation = _ref26.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref26.abstractFolderRelativeLocation,
      filename = _ref26.filename,
      _ref26$inputETagClien = _ref26.inputETagClient,
      inputETagClient = _ref26$inputETagClien === undefined ? null : _ref26$inputETagClien,
      compile = _ref26.compile;

  return getFileBranch({
    rootLocation: rootLocation,
    cacheFolderRelativeLocation: cacheFolderRelativeLocation,
    abstractFolderRelativeLocation: abstractFolderRelativeLocation,
    filename: filename,
    compile: compile
  }).then(function (_ref27) {
    var inputLocation = _ref27.inputLocation,
        cache = _ref27.cache,
        options = _ref27.options,
        generate = _ref27.generate,
        input = _ref27.input,
        branch = _ref27.branch;

    if (!branch) {
      return {
        inputLocation: inputLocation,
        status: "missing",
        cache: cache,
        options: options,
        generate: generate,
        branch: {
          name: (0, _cuid2["default"])()
        },
        input: input
      };
    }

    return readBranch({
      rootLocation: rootLocation,
      cacheFolderRelativeLocation: cacheFolderRelativeLocation,
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      filename: filename,
      inputLocation: inputLocation,
      inputETagClient: inputETagClient,
      cache: cache,
      branch: branch
    }).then(function (_ref28) {
      var status = _ref28.status,
          input = _ref28.input,
          output = _ref28.output,
          outputAssets = _ref28.outputAssets;

      return {
        inputLocation: inputLocation,
        status: status,
        cache: cache,
        options: options,
        generate: generate,
        branch: branch,
        input: input,
        output: output,
        outputAssets: outputAssets
      };
    });
  });
};

var updateBranch = function updateBranch(_ref29) {
  var rootLocation = _ref29.rootLocation,
      cacheFolderRelativeLocation = _ref29.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref29.abstractFolderRelativeLocation,
      filename = _ref29.filename,
      inputLocation = _ref29.inputLocation,
      status = _ref29.status,
      cache = _ref29.cache,
      options = _ref29.options,
      branch = _ref29.branch,
      inputETag = _ref29.inputETag,
      output = _ref29.output,
      outputAssets = _ref29.outputAssets,
      cacheAutoClean = _ref29.cacheAutoClean,
      cacheTrackHit = _ref29.cacheTrackHit;
  var branches = cache.branches;

  var isCached = status === "cached";
  var isNew = status === "created";
  var isUpdated = status === "updated";

  var promises = [];

  if (isNew || isUpdated) {
    var mainLocation = getOutputLocation({
      rootLocation: rootLocation,
      cacheFolderRelativeLocation: cacheFolderRelativeLocation,
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      filename: filename,
      branch: branch
    });

    promises.push.apply(promises, [(0, _writeFile.writeFile)({
      location: mainLocation,
      string: output
    })].concat(_toConsumableArray(outputAssets.map(function (asset) {
      var assetLocation = getOutputAssetLocation({
        rootLocation: rootLocation,
        cacheFolderRelativeLocation: cacheFolderRelativeLocation,
        abstractFolderRelativeLocation: abstractFolderRelativeLocation,
        filename: filename,
        branch: branch,
        asset: asset
      });

      return (0, _writeFile.writeFile)({
        location: assetLocation,
        string: asset.content
      });
    }))));
  }

  if (isNew || isUpdated || isCached && cacheTrackHit) {
    if (cacheAutoClean) {
      if (inputETag !== cache.inputETag) {
        var branchesToRemove = branches.slice();

        // no need to remove the updated branch
        var index = branchesToRemove.indexOf(branch);
        branchesToRemove.splice(index, 1);

        branches.length = 0;
        branchesToRemove.forEach(function (branch) {
          var branchLocation = getBranchLocation({
            rootLocation: rootLocation,
            cacheFolderRelativeLocation: cacheFolderRelativeLocation,
            abstractFolderRelativeLocation: abstractFolderRelativeLocation,
            filename: filename,
            branch: branch
          });
          console.log("file changed, remove " + branchLocation);
          // the line below is async but non blocking
          (0, _helpers.removeFolderDeep)(branchLocation);
        });
      }
    }

    if (isNew) {
      branches.push(branch);
    }

    var updatedBranches = branches.map(function (branchToUpdate) {
      if (branchToUpdate.name !== branch.name) {
        return _extends({}, branchToUpdate);
      }
      if (isCached) {
        return _extends({}, branchToUpdate, {
          matchCount: branch.matchCount + 1,
          lastMatchMs: Number(Date.now())
        });
      }
      if (isUpdated) {
        return _extends({}, branchToUpdate, {
          matchCount: branch.matchCount + 1,
          lastMatchMs: Number(Date.now()),
          lastModifiedMs: Number(Date.now()),
          outputAssets: outputAssets.map(function (_ref30) {
            var name = _ref30.name,
                content = _ref30.content;

            return { name: name, eTag: (0, _helpers.createETag)(content) };
          })
        });
      }
      // new branch
      return {
        name: branch.name,
        matchCount: 1,
        createdMs: Number(Date.now()),
        lastModifiedMs: Number(Date.now()),
        lastMatchMs: Number(Date.now()),
        outputMeta: options,
        outputAssets: outputAssets.map(function (_ref31) {
          var name = _ref31.name,
              content = _ref31.content;

          return { name: name, eTag: (0, _helpers.createETag)(content) };
        })
      };
    }).sort(compareBranch);

    var inputRelativeLocation = getInputRelativeLocation({
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      filename: filename
    });

    var updatedCache = {
      inputRelativeLocation: inputRelativeLocation,
      inputETag: isCached ? cache.inputETag : inputETag,
      inputLocation: inputLocation === (0, _helpers.resolvePath)(rootLocation, inputRelativeLocation) ? undefined : inputLocation,
      branches: updatedBranches
    };

    var cacheDataLocation = getCacheDataLocation({
      rootLocation: rootLocation,
      cacheFolderRelativeLocation: cacheFolderRelativeLocation,
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      filename: filename
    });

    promises.push((0, _writeFile.writeFile)({
      location: cacheDataLocation,
      string: JSON.stringify(updatedCache, null, "  ")
    }));
  }

  return Promise.all(promises);
};

var getFileCompiled = function getFileCompiled(_ref32) {
  var rootLocation = _ref32.rootLocation,
      cacheFolderRelativeLocation = _ref32.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref32.abstractFolderRelativeLocation,
      filename = _ref32.filename,
      compile = _ref32.compile,
      inputETagClient = _ref32.inputETagClient,
      cacheEnabled = _ref32.cacheEnabled,
      cacheAutoClean = _ref32.cacheAutoClean,
      cacheTrackHit = _ref32.cacheTrackHit;

  var fileLock = (0, _ressourceRegistry.lockForRessource)(getCacheDataLocation({
    rootLocation: rootLocation,
    cacheFolderRelativeLocation: cacheFolderRelativeLocation,
    abstractFolderRelativeLocation: abstractFolderRelativeLocation,
    filename: filename
  }));

  return fileLock.chain(function () {
    return getFileReport({
      rootLocation: rootLocation,
      cacheFolderRelativeLocation: cacheFolderRelativeLocation,
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      filename: filename,
      compile: compile,
      inputETagClient: inputETagClient
    }).then(function (_ref33) {
      var inputLocation = _ref33.inputLocation,
          status = _ref33.status,
          cache = _ref33.cache,
          options = _ref33.options,
          generate = _ref33.generate,
          branch = _ref33.branch,
          input = _ref33.input,
          inputETag = _ref33.inputETag,
          output = _ref33.output,
          outputAssets = _ref33.outputAssets;

      if (cacheEnabled === false) {
        status = "missing";
      }

      var outputRelativeLocation = getOutputRelativeLocation({
        cacheFolderRelativeLocation: cacheFolderRelativeLocation,
        abstractFolderRelativeLocation: abstractFolderRelativeLocation,
        filename: filename,
        branch: branch
      });

      if (status === "valid") {
        return {
          inputLocation: inputLocation,
          status: "cached",
          cache: cache,
          options: options,
          branch: branch,
          input: input,
          inputETag: inputETag,
          outputRelativeLocation: outputRelativeLocation,
          output: output,
          outputAssets: outputAssets
        };
      }

      return Promise.resolve(generate({ outputRelativeLocation: outputRelativeLocation })).then(function (_ref34) {
        var output = _ref34.output,
            outputAssets = _ref34.outputAssets;

        return {
          inputLocation: inputLocation,
          status: status === "missing" ? "created" : "updated",
          cache: cache,
          options: options,
          branch: branch,
          input: input,
          inputETag: (0, _helpers.createETag)(input),
          outputRelativeLocation: outputRelativeLocation,
          output: output,
          outputAssets: outputAssets
        };
      });
    }).then(function (_ref35) {
      var inputLocation = _ref35.inputLocation,
          status = _ref35.status,
          cache = _ref35.cache,
          options = _ref35.options,
          branch = _ref35.branch,
          input = _ref35.input,
          inputETag = _ref35.inputETag,
          outputRelativeLocation = _ref35.outputRelativeLocation,
          output = _ref35.output,
          outputAssets = _ref35.outputAssets;

      return updateBranch({
        rootLocation: rootLocation,
        cacheFolderRelativeLocation: cacheFolderRelativeLocation,
        abstractFolderRelativeLocation: abstractFolderRelativeLocation,
        filename: filename,
        inputLocation: inputLocation,
        status: status,
        cache: cache,
        options: options,
        branch: branch,
        input: input,
        inputETag: inputETag,
        output: output,
        outputAssets: outputAssets,
        cacheTrackHit: cacheTrackHit,
        cacheAutoClean: cacheAutoClean
      }).then(function () {
        return {
          status: status,
          inputETag: inputETag,
          output: output,
          outputRelativeLocation: outputRelativeLocation
        };
      });
    });
  });
};

var createCompileService = exports.createCompileService = function createCompileService(_ref36) {
  var rootLocation = _ref36.rootLocation,
      _ref36$cacheFolderRel = _ref36.cacheFolderRelativeLocation,
      cacheFolderRelativeLocation = _ref36$cacheFolderRel === undefined ? "build" : _ref36$cacheFolderRel,
      _ref36$abstractFolder = _ref36.abstractFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref36$abstractFolder === undefined ? "compiled" : _ref36$abstractFolder,
      _ref36$compile = _ref36.compile,
      compile = _ref36$compile === undefined ? (0, _createCompile.createCompile)() : _ref36$compile,
      _ref36$cacheEnabled = _ref36.cacheEnabled,
      cacheEnabled = _ref36$cacheEnabled === undefined ? false : _ref36$cacheEnabled,
      _ref36$cacheAutoClean = _ref36.cacheAutoClean,
      cacheAutoClean = _ref36$cacheAutoClean === undefined ? true : _ref36$cacheAutoClean,
      _ref36$cacheTrackHit = _ref36.cacheTrackHit,
      cacheTrackHit = _ref36$cacheTrackHit === undefined ? false : _ref36$cacheTrackHit;

  var fileService = (0, _createFileService.createFileService)();

  var service = function service(_ref37) {
    var method = _ref37.method,
        url = _ref37.url,
        headers = _ref37.headers;

    var pathname = url.pathname;
    // '/compiled/folder/file.js' -> 'compiled/folder/file.js'
    var filename = pathname.slice(1);

    // je crois, que, normalement
    // il faudrait "aider" le browser pour que tout ça ait du sens
    // genre lui envoyer une redirection vers le fichier en cache
    // genre renvoyer 201 vers le cache lorsqu'il a été update ou créé
    // https://developer.mozilla.org/fr/docs/Web/HTTP/Status/201
    // renvoyer 302 ou 307 lorsque le cache existe
    // l'intérêt c'est que si jamais le browser fait une requête vers le cache
    // il sait à quoi ça correspond vraiment
    // par contre ça fait 2 requête http

    if (filename.endsWith(".map")) {
      var fileLock = (0, _ressourceRegistry.lockForRessource)(getCacheDataLocation({
        rootLocation: rootLocation,
        cacheFolderRelativeLocation: cacheFolderRelativeLocation,
        abstractFolderRelativeLocation: abstractFolderRelativeLocation,
        filename: filename
      }));

      return fileLock.chain(function () {
        var script = filename.slice(0, -4); // 'folder/file.js.map' -> 'folder.file.js'

        // if we receive something like compiled/folder/file.js.map
        // we redirect to build/folder/file.js/jqjcijjojio/file.js.map

        return getFileBranch({
          rootLocation: rootLocation,
          cacheFolderRelativeLocation: cacheFolderRelativeLocation,
          abstractFolderRelativeLocation: abstractFolderRelativeLocation,
          filename: script,
          compile: compile
        }).then(function (_ref38) {
          var branch = _ref38.branch;

          if (!branch) {
            return {
              status: 404
            };
          }

          var scriptCompiledFolder = (0, _helpers.resolvePath)(rootLocation, getBranchRelativeLocation({
            cacheFolderRelativeLocation: cacheFolderRelativeLocation,
            abstractFolderRelativeLocation: abstractFolderRelativeLocation,
            filename: script,
            branch: branch
          }));

          return fileService({
            method: method,
            url: new _url.URL("file:///" + scriptCompiledFolder + "/" + _path2["default"].basename(filename) + url.search),
            headers: headers
          });
        }, function (error) {
          if (error && error.reason === "Unexpected directory operation") {
            return {
              status: 403
            };
          }
          return Promise.reject(error);
        });
      });
    }

    return getFileCompiled({
      rootLocation: rootLocation,
      cacheFolderRelativeLocation: cacheFolderRelativeLocation,
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      filename: filename,
      compile: compile,
      inputETagClient: headers.has("if-none-match") ? headers.get("if-none-match") : undefined,
      cacheEnabled: cacheEnabled,
      cacheAutoClean: cacheAutoClean,
      cacheTrackHit: cacheTrackHit
    }).then(function (_ref39) {
      var status = _ref39.status,
          inputETag = _ref39.inputETag,
          outputRelativeLocation = _ref39.outputRelativeLocation,
          output = _ref39.output;

      // here status can be "created", "updated", "cached"

      // c'est un peu optimiste ici de se dire que si c'est cached et qu'on a
      // if-none-match c'est forcément le etag du client qui a match
      // faudra changer ça non?
      if (headers.has("if-none-match") && status === "cached") {
        return {
          status: 304,
          headers: {
            "cache-control": "no-store",
            "x-location": outputRelativeLocation
          }
        };
      }

      return {
        status: 200,
        headers: {
          Etag: inputETag,
          "content-length": Buffer.byteLength(output),
          "content-type": "application/javascript",
          "cache-control": "no-store",
          "x-location": outputRelativeLocation
        },
        body: output
      };
    }, function (error) {
      if (error && error.reason === "Unexpected directory operation") {
        return {
          status: 403
        };
      }
      return Promise.reject(error);
    });
  };

  var compileFile = function compileFile(relativeLocation) {
    return getFileCompiled({
      rootLocation: rootLocation,
      cacheFolderRelativeLocation: cacheFolderRelativeLocation,
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      filename: abstractFolderRelativeLocation + "/" + relativeLocation,
      compile: compile,
      cacheEnabled: cacheEnabled,
      cacheAutoClean: cacheAutoClean,
      cacheTrackHit: cacheTrackHit
    });
  };

  return { service: service, compileFile: compileFile };
};
//# sourceMappingURL=createCompileService.js.map