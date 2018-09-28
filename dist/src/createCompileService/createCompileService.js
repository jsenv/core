"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createCompileService = void 0;

var _cuid = _interopRequireDefault(require("cuid"));

var _url = require("url");

var _createCompile = require("../createCompile/createCompile.js");

var _cache = require("./cache.js");

var _helpers = require("./helpers.js");

var _locateFile = require("./locateFile.js");

var _readFile = require("./readFile.js");

var _ressourceRegistry = require("./ressourceRegistry.js");

var _projectStructureCompileBabel = require("@dmail/project-structure-compile-babel");

var _createFileService = require("../createFileService/createFileService.js");

var _getPlatformAndVersionFromHeaders = require("./getPlatformAndVersionFromHeaders.js");

var _locaters = require("./locaters.js");

var _buildGroup2 = require("./buildGroup.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _toArray(arr) { return _arrayWithHoles(arr) || _iterableToArray(arr) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var readBranchMain = function readBranchMain(_ref) {
  var rootLocation = _ref.rootLocation,
      cacheFolderRelativeLocation = _ref.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref.abstractFolderRelativeLocation,
      filename = _ref.filename,
      inputLocation = _ref.inputLocation,
      inputETagClient = _ref.inputETagClient,
      cache = _ref.cache,
      branch = _ref.branch;
  return (0, _readFile.readFile)({
    location: inputLocation
  }).then(function (_ref2) {
    var content = _ref2.content;
    var inputETag = (0, _helpers.createETag)(content);
    return Promise.resolve().then(function () {
      // faudra pouvoir désactiver ce check lorsqu'on veut juste connaitre l'état du cache
      if (inputETagClient) {
        if (inputETag !== inputETagClient) {
          return {
            status: "eTag modified on ".concat(inputLocation, " since it was cached by client"),
            inputETagClient: inputETagClient
          };
        }

        return {
          status: "valid"
        };
      }

      var inputETagCached = cache.inputETag;

      if (inputETag !== inputETagCached) {
        return {
          status: "eTag modified on ".concat(inputLocation, " since it was cached on filesystem"),
          inputETagCached: inputETagCached
        };
      }

      var outputLocation = (0, _locaters.getOutputLocation)({
        rootLocation: rootLocation,
        cacheFolderRelativeLocation: cacheFolderRelativeLocation,
        abstractFolderRelativeLocation: abstractFolderRelativeLocation,
        filename: filename,
        branch: branch
      });
      return (0, _readFile.readFile)({
        location: outputLocation,
        errorHandler: _helpers.isFileNotFoundError
      }).then(function (_ref3) {
        var content = _ref3.content,
            error = _ref3.error;

        if (error) {
          return {
            status: "cache not found at ".concat(outputLocation)
          };
        }

        return {
          status: "valid",
          output: content
        };
      });
    }).then(function (moreData) {
      return _objectSpread({
        input: content,
        inputETag: inputETag
      }, moreData);
    });
  });
};

var readBranchAsset = function readBranchAsset(_ref4) {
  var rootLocation = _ref4.rootLocation,
      cacheFolderRelativeLocation = _ref4.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref4.abstractFolderRelativeLocation,
      filename = _ref4.filename,
      cache = _ref4.cache,
      branch = _ref4.branch,
      asset = _ref4.asset;
  var outputAssetLocation = (0, _locaters.getOutputAssetLocation)({
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
  }).then(function (_ref5) {
    var content = _ref5.content,
        error = _ref5.error;

    if (error) {
      return {
        status: "asset file not found ".concat(outputAssetLocation),
        name: name
      };
    }

    var actual = (0, _helpers.createETag)(content);
    var expected = asset.eTag;

    if (actual !== expected) {
      return {
        status: "unexpected ".concat(asset.name, " asset for ").concat(cache.inputRelativeLocation, ": unexpected eTag"),
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

var readBranch = function readBranch(_ref6) {
  var rootLocation = _ref6.rootLocation,
      cacheFolderRelativeLocation = _ref6.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref6.abstractFolderRelativeLocation,
      filename = _ref6.filename,
      inputLocation = _ref6.inputLocation,
      inputETagClient = _ref6.inputETagClient,
      cache = _ref6.cache,
      branch = _ref6.branch;
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
  })))).then(function (_ref7) {
    var _ref8 = _toArray(_ref7),
        mainData = _ref8[0],
        assetsData = _ref8.slice(1);

    var status = mainData.status,
        input = mainData.input,
        inputETag = mainData.inputETag,
        output = mainData.output;
    var computedStatus;

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

var getFileBranch = function getFileBranch(_ref9) {
  var rootLocation = _ref9.rootLocation,
      cacheFolderRelativeLocation = _ref9.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref9.abstractFolderRelativeLocation,
      filename = _ref9.filename,
      groupId = _ref9.groupId,
      compile = _ref9.compile;
  var inputRelativeLocation = (0, _locaters.getInputRelativeLocation)({
    abstractFolderRelativeLocation: abstractFolderRelativeLocation,
    filename: filename
  });
  var cacheDataLocation = (0, _locaters.getCacheDataLocation)({
    rootLocation: rootLocation,
    cacheFolderRelativeLocation: cacheFolderRelativeLocation,
    abstractFolderRelativeLocation: abstractFolderRelativeLocation,
    filename: filename
  });
  return Promise.all([(0, _locateFile.locateFile)(inputRelativeLocation, rootLocation), (0, _readFile.readFile)({
    location: cacheDataLocation,
    errorHandler: _helpers.isFileNotFoundError
  }).then(function (_ref10) {
    var content = _ref10.content,
        error = _ref10.error;

    if (error) {
      return {
        branches: []
      };
    }

    var cache = JSON.parse(content);

    if (cache.inputRelativeLocation !== inputRelativeLocation) {
      throw new Error("".concat(_cache.JSON_FILE, " corrupted: unexpected inputRelativeLocation ").concat(cache.inputRelativeLocation, ", it must be ").concat(inputRelativeLocation));
    }

    return cache;
  })]).then(function (_ref11) {
    var _ref12 = _slicedToArray(_ref11, 2),
        inputLocation = _ref12[0],
        cache = _ref12[1];

    return {
      inputLocation: inputLocation,
      cache: cache
    };
  }).then(function (_ref13) {
    var inputLocation = _ref13.inputLocation,
        cache = _ref13.cache;
    // here, if readFile returns ENOENT we could/should check is there is something in cache for that file
    // and take that chance to remove the cached version of that file
    // but it's not supposed to happen
    return (0, _readFile.readFile)({
      location: inputLocation
    }).then(function (_ref14) {
      var content = _ref14.content;
      return compile({
        rootLocation: rootLocation,
        abstractFolderRelativeLocation: abstractFolderRelativeLocation,
        inputRelativeLocation: inputRelativeLocation,
        inputSource: content,
        filename: filename,
        groupId: groupId,
        getSourceNameForSourceMap: function getSourceNameForSourceMap() {
          return filename;
        },
        getSourceLocationForSourceMap: _locaters.getSourceLocationForSourceMap
      }).then(function (_ref15) {
        var options = _ref15.options,
            generate = _ref15.generate;

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

var getFileReport = function getFileReport(_ref16) {
  var rootLocation = _ref16.rootLocation,
      cacheFolderRelativeLocation = _ref16.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref16.abstractFolderRelativeLocation,
      filename = _ref16.filename,
      _ref16$inputETagClien = _ref16.inputETagClient,
      inputETagClient = _ref16$inputETagClien === void 0 ? null : _ref16$inputETagClien,
      groupId = _ref16.groupId,
      compile = _ref16.compile;
  return getFileBranch({
    rootLocation: rootLocation,
    cacheFolderRelativeLocation: cacheFolderRelativeLocation,
    abstractFolderRelativeLocation: abstractFolderRelativeLocation,
    filename: filename,
    groupId: groupId,
    compile: compile
  }).then(function (_ref17) {
    var inputLocation = _ref17.inputLocation,
        cache = _ref17.cache,
        options = _ref17.options,
        generate = _ref17.generate,
        input = _ref17.input,
        branch = _ref17.branch;

    if (!branch) {
      return {
        inputLocation: inputLocation,
        status: "missing",
        cache: cache,
        options: options,
        generate: generate,
        branch: {
          name: (0, _cuid.default)()
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
    }).then(function (_ref18) {
      var status = _ref18.status,
          input = _ref18.input,
          output = _ref18.output,
          outputAssets = _ref18.outputAssets;
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

var compareBranch = function compareBranch(branchA, branchB) {
  var lastMatchDiff = branchA.lastMatchMs - branchB.lastMatchMs;

  if (lastMatchDiff === 0) {
    return branchA.matchCount - branchB.matchCount;
  }

  return lastMatchDiff;
};

var updateBranch = function updateBranch(_ref19) {
  var rootLocation = _ref19.rootLocation,
      cacheFolderRelativeLocation = _ref19.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref19.abstractFolderRelativeLocation,
      filename = _ref19.filename,
      inputLocation = _ref19.inputLocation,
      status = _ref19.status,
      cache = _ref19.cache,
      options = _ref19.options,
      branch = _ref19.branch,
      inputETag = _ref19.inputETag,
      output = _ref19.output,
      outputAssets = _ref19.outputAssets,
      cacheAutoClean = _ref19.cacheAutoClean,
      cacheTrackHit = _ref19.cacheTrackHit;
  var branches = cache.branches;
  var isCached = status === "cached";
  var isNew = status === "created";
  var isUpdated = status === "updated";
  var promises = [];

  if (isNew || isUpdated) {
    var mainLocation = (0, _locaters.getOutputLocation)({
      rootLocation: rootLocation,
      cacheFolderRelativeLocation: cacheFolderRelativeLocation,
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      filename: filename,
      branch: branch
    });
    promises.push.apply(promises, [(0, _projectStructureCompileBabel.writeFileFromString)(mainLocation, output)].concat(_toConsumableArray(outputAssets.map(function (asset) {
      var assetLocation = (0, _locaters.getOutputAssetLocation)({
        rootLocation: rootLocation,
        cacheFolderRelativeLocation: cacheFolderRelativeLocation,
        abstractFolderRelativeLocation: abstractFolderRelativeLocation,
        filename: filename,
        branch: branch,
        asset: asset
      });
      return (0, _projectStructureCompileBabel.writeFileFromString)(assetLocation, asset.content);
    }))));
  }

  if (isNew || isUpdated || isCached && cacheTrackHit) {
    if (cacheAutoClean) {
      if (inputETag !== cache.inputETag) {
        var branchesToRemove = branches.slice(); // no need to remove the updated branch

        var index = branchesToRemove.indexOf(branch);
        branchesToRemove.splice(index, 1);
        branches.length = 0;
        branchesToRemove.forEach(function (branch) {
          var branchLocation = (0, _locaters.getBranchLocation)({
            rootLocation: rootLocation,
            cacheFolderRelativeLocation: cacheFolderRelativeLocation,
            abstractFolderRelativeLocation: abstractFolderRelativeLocation,
            filename: filename,
            branch: branch
          });
          console.log("file changed, remove ".concat(branchLocation)); // the line below is async but non blocking

          (0, _helpers.removeFolderDeep)(branchLocation);
        });
      }
    }

    if (isNew) {
      branches.push(branch);
    }

    var updatedBranches = branches.map(function (branchToUpdate) {
      if (branchToUpdate.name !== branch.name) {
        return _objectSpread({}, branchToUpdate);
      }

      if (isCached) {
        return _objectSpread({}, branchToUpdate, {
          matchCount: branch.matchCount + 1,
          lastMatchMs: Number(Date.now())
        });
      }

      if (isUpdated) {
        return _objectSpread({}, branchToUpdate, {
          matchCount: branch.matchCount + 1,
          lastMatchMs: Number(Date.now()),
          lastModifiedMs: Number(Date.now()),
          outputAssets: outputAssets.map(function (_ref20) {
            var name = _ref20.name,
                content = _ref20.content;
            return {
              name: name,
              eTag: (0, _helpers.createETag)(content)
            };
          })
        });
      } // new branch


      return {
        name: branch.name,
        matchCount: 1,
        createdMs: Number(Date.now()),
        lastModifiedMs: Number(Date.now()),
        lastMatchMs: Number(Date.now()),
        outputMeta: options,
        outputAssets: outputAssets.map(function (_ref21) {
          var name = _ref21.name,
              content = _ref21.content;
          return {
            name: name,
            eTag: (0, _helpers.createETag)(content)
          };
        })
      };
    }).sort(compareBranch);
    var inputRelativeLocation = (0, _locaters.getInputRelativeLocation)({
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      filename: filename
    });
    var updatedCache = {
      inputRelativeLocation: inputRelativeLocation,
      inputETag: isCached ? cache.inputETag : inputETag,
      inputLocation: inputLocation === (0, _locaters.getSourceAbstractLocation)({
        rootLocation: rootLocation,
        inputRelativeLocation: inputRelativeLocation
      }) ? undefined : inputLocation,
      branches: updatedBranches
    };
    var cacheDataLocation = (0, _locaters.getCacheDataLocation)({
      rootLocation: rootLocation,
      cacheFolderRelativeLocation: cacheFolderRelativeLocation,
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      filename: filename
    });
    promises.push((0, _projectStructureCompileBabel.writeFileFromString)(cacheDataLocation, JSON.stringify(updatedCache, null, "  ")));
  }

  return Promise.all(promises);
};

var getFileCompiled = function getFileCompiled(_ref22) {
  var rootLocation = _ref22.rootLocation,
      cacheFolderRelativeLocation = _ref22.cacheFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref22.abstractFolderRelativeLocation,
      filename = _ref22.filename,
      compile = _ref22.compile,
      inputETagClient = _ref22.inputETagClient,
      groupId = _ref22.groupId,
      getBabelPlugins = _ref22.getBabelPlugins,
      cacheEnabled = _ref22.cacheEnabled,
      cacheAutoClean = _ref22.cacheAutoClean,
      cacheTrackHit = _ref22.cacheTrackHit;
  var fileLock = (0, _ressourceRegistry.lockForRessource)((0, _locaters.getCacheDataLocation)({
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
      inputETagClient: inputETagClient,
      groupId: groupId,
      compile: compile
    }).then(function (_ref23) {
      var inputLocation = _ref23.inputLocation,
          status = _ref23.status,
          cache = _ref23.cache,
          options = _ref23.options,
          generate = _ref23.generate,
          branch = _ref23.branch,
          input = _ref23.input,
          inputETag = _ref23.inputETag,
          output = _ref23.output,
          outputAssets = _ref23.outputAssets;
      var outputRelativeLocation = (0, _locaters.getOutputRelativeLocation)({
        cacheFolderRelativeLocation: cacheFolderRelativeLocation,
        abstractFolderRelativeLocation: abstractFolderRelativeLocation,
        filename: filename,
        branch: branch
      });

      if (cacheEnabled && status === "valid") {
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

      return Promise.resolve(generate({
        outputRelativeLocation: outputRelativeLocation,
        getBabelPlugins: getBabelPlugins
      })).then(function (_ref24) {
        var output = _ref24.output,
            outputAssets = _ref24.outputAssets;
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
    }).then(function (_ref25) {
      var inputLocation = _ref25.inputLocation,
          status = _ref25.status,
          cache = _ref25.cache,
          options = _ref25.options,
          branch = _ref25.branch,
          input = _ref25.input,
          inputETag = _ref25.inputETag,
          outputRelativeLocation = _ref25.outputRelativeLocation,
          output = _ref25.output,
          outputAssets = _ref25.outputAssets;
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

var createCompileService = function createCompileService(_ref26) {
  var rootLocation = _ref26.rootLocation,
      _ref26$cacheFolderRel = _ref26.cacheFolderRelativeLocation,
      cacheFolderRelativeLocation = _ref26$cacheFolderRel === void 0 ? "build" : _ref26$cacheFolderRel,
      _ref26$abstractFolder = _ref26.abstractFolderRelativeLocation,
      abstractFolderRelativeLocation = _ref26$abstractFolder === void 0 ? "compiled" : _ref26$abstractFolder,
      _ref26$compile = _ref26.compile,
      compile = _ref26$compile === void 0 ? (0, _createCompile.createCompile)() : _ref26$compile,
      _ref26$cacheEnabled = _ref26.cacheEnabled,
      cacheEnabled = _ref26$cacheEnabled === void 0 ? false : _ref26$cacheEnabled,
      _ref26$cacheAutoClean = _ref26.cacheAutoClean,
      cacheAutoClean = _ref26$cacheAutoClean === void 0 ? true : _ref26$cacheAutoClean,
      _ref26$cacheTrackHit = _ref26.cacheTrackHit,
      cacheTrackHit = _ref26$cacheTrackHit === void 0 ? false : _ref26$cacheTrackHit;
  var fileService = (0, _createFileService.createFileService)();

  var _buildGroup = (0, _buildGroup2.buildGroup)({
    root: rootLocation
  }),
      getGroupIdForPlatform = _buildGroup.getGroupIdForPlatform,
      getPluginsFromGroupId = _buildGroup.getPluginsFromGroupId;

  var service = function service(_ref27) {
    var method = _ref27.method,
        url = _ref27.url,
        headers = _ref27.headers;
    var pathname = url.pathname; // '/compiled/folder/file.js' -> 'compiled/folder/file.js'

    var filename = pathname.slice(1); // je crois, que, normalement
    // il faudrait "aider" le browser pour que tout ça ait du sens
    // genre lui envoyer une redirection vers le fichier en cache
    // genre renvoyer 201 vers le cache lorsqu'il a été update ou créé
    // https://developer.mozilla.org/fr/docs/Web/HTTP/Status/201
    // renvoyer 302 ou 307 lorsque le cache existe
    // l'intérêt c'est que si jamais le browser fait une requête vers le cache
    // il sait à quoi ça correspond vraiment
    // par contre ça fait 2 requête http

    if (filename.endsWith(".map")) {
      var fileLock = (0, _ressourceRegistry.lockForRessource)((0, _locaters.getCacheDataLocation)({
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
        }).then(function (_ref28) {
          var branch = _ref28.branch;

          if (!branch) {
            return {
              status: 404
            };
          }

          var outputLocation = (0, _locaters.getOutputLocation)({
            rootLocation: rootLocation,
            cacheFolderRelativeLocation: cacheFolderRelativeLocation,
            abstractFolderRelativeLocation: abstractFolderRelativeLocation,
            filename: filename,
            branch: branch
          });
          return fileService({
            method: method,
            url: new _url.URL("file:///".concat(outputLocation).concat(url.search)),
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

    var _getPlatformAndVersio = (0, _getPlatformAndVersionFromHeaders.getPlatformAndVersionFromHeaders)(headers),
        platformName = _getPlatformAndVersio.platformName,
        platformVersion = _getPlatformAndVersio.platformVersion;

    var groupId = getGroupIdForPlatform({
      platformName: platformName,
      platformVersion: platformVersion
    });
    return getFileCompiled({
      rootLocation: rootLocation,
      cacheFolderRelativeLocation: cacheFolderRelativeLocation,
      abstractFolderRelativeLocation: abstractFolderRelativeLocation,
      filename: filename,
      compile: compile,
      inputETagClient: headers.has("if-none-match") ? headers.get("if-none-match") : undefined,
      groupId: groupId,
      getBabelPlugins: function getBabelPlugins() {
        return getPluginsFromGroupId(groupId);
      },
      cacheEnabled: cacheEnabled,
      cacheAutoClean: cacheAutoClean,
      cacheTrackHit: cacheTrackHit
    }).then(function (_ref29) {
      var status = _ref29.status,
          inputETag = _ref29.inputETag,
          outputRelativeLocation = _ref29.outputRelativeLocation,
          output = _ref29.output;

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
      filename: "".concat(abstractFolderRelativeLocation, "/").concat(relativeLocation),
      compile: compile,
      cacheEnabled: cacheEnabled,
      cacheAutoClean: cacheAutoClean,
      cacheTrackHit: cacheTrackHit
    });
  };

  return {
    service: service,
    compileFile: compileFile
  };
};

exports.createCompileService = createCompileService;
//# sourceMappingURL=createCompileService.js.map