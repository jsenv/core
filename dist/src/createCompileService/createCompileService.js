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

var _createCompileProfiles = require("../createCompileProfiles/createCompileProfiles.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const readBranchMain = ({
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  inputLocation,
  inputETagClient,
  cache,
  branch
}) => {
  return (0, _readFile.readFile)({
    location: inputLocation
  }).then(({
    content
  }) => {
    const inputETag = (0, _helpers.createETag)(content);
    return Promise.resolve().then(() => {
      // faudra pouvoir désactiver ce check lorsqu'on veut juste connaitre l'état du cache
      if (inputETagClient) {
        if (inputETag !== inputETagClient) {
          return {
            status: `eTag modified on ${inputLocation} since it was cached by client`,
            inputETagClient
          };
        }

        return {
          status: "valid"
        };
      }

      const inputETagCached = cache.inputETag;

      if (inputETag !== inputETagCached) {
        return {
          status: `eTag modified on ${inputLocation} since it was cached on filesystem`,
          inputETagCached
        };
      }

      const outputLocation = (0, _locaters.getOutputLocation)({
        rootLocation,
        cacheFolderRelativeLocation,
        abstractFolderRelativeLocation,
        filename,
        branch
      });
      return (0, _readFile.readFile)({
        location: outputLocation,
        errorHandler: _helpers.isFileNotFoundError
      }).then(({
        content,
        error
      }) => {
        if (error) {
          return {
            status: `cache not found at ${outputLocation}`
          };
        }

        return {
          status: "valid",
          output: content
        };
      });
    }).then(moreData => {
      return _objectSpread({
        input: content,
        inputETag
      }, moreData);
    });
  });
};

const readBranchAsset = ({
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  cache,
  branch,
  asset
}) => {
  const outputAssetLocation = (0, _locaters.getOutputAssetLocation)({
    rootLocation,
    cacheFolderRelativeLocation,
    abstractFolderRelativeLocation,
    filename,
    branch,
    asset
  });
  const name = asset.name;
  return (0, _readFile.readFile)({
    location: outputAssetLocation,
    errorHandler: _helpers.isFileNotFoundError
  }).then(({
    content,
    error
  }) => {
    if (error) {
      return {
        status: `asset file not found ${outputAssetLocation}`,
        name
      };
    }

    const actual = (0, _helpers.createETag)(content);
    const expected = asset.eTag;

    if (actual !== expected) {
      return {
        status: `unexpected ${asset.name} asset for ${cache.inputRelativeLocation}: unexpected eTag`,
        name,
        content
      };
    }

    return {
      status: "valid",
      name,
      content
    };
  });
};

const readBranch = ({
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  inputLocation,
  inputETagClient,
  cache,
  branch
}) => {
  return Promise.all([readBranchMain({
    rootLocation,
    cacheFolderRelativeLocation,
    abstractFolderRelativeLocation,
    filename,
    inputLocation,
    inputETagClient,
    cache,
    branch
  }), ...branch.outputAssets.map(outputAsset => {
    return readBranchAsset({
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename,
      cache,
      branch,
      asset: outputAsset
    });
  })]).then(([mainData, ...assetsData]) => {
    const {
      status,
      input,
      inputETag,
      output
    } = mainData;
    let computedStatus;

    if (status === "valid") {
      const invalidAsset = assetsData.find(assetData => assetData.status !== "valid");
      computedStatus = invalidAsset ? invalidAsset.status : "valid";
    } else {
      computedStatus = status;
    }

    return {
      status: computedStatus,
      input,
      inputETag,
      output,
      outputAssets: assetsData
    };
  });
};

const getFileBranch = ({
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  groupId,
  compile
}) => {
  const inputRelativeLocation = (0, _locaters.getInputRelativeLocation)({
    abstractFolderRelativeLocation,
    filename
  });
  const cacheDataLocation = (0, _locaters.getCacheDataLocation)({
    rootLocation,
    cacheFolderRelativeLocation,
    abstractFolderRelativeLocation,
    filename
  });
  return Promise.all([(0, _locateFile.locateFile)(inputRelativeLocation, rootLocation), (0, _readFile.readFile)({
    location: cacheDataLocation,
    errorHandler: _helpers.isFileNotFoundError
  }).then(({
    content,
    error
  }) => {
    if (error) {
      return {
        branches: []
      };
    }

    const cache = JSON.parse(content);

    if (cache.inputRelativeLocation !== inputRelativeLocation) {
      throw new Error(`${_cache.JSON_FILE} corrupted: unexpected inputRelativeLocation ${cache.inputRelativeLocation}, it must be ${inputRelativeLocation}`);
    }

    return cache;
  })]).then(([inputLocation, cache]) => {
    return {
      inputLocation,
      cache
    };
  }).then(({
    inputLocation,
    cache
  }) => {
    // here, if readFile returns ENOENT we could/should check is there is something in cache for that file
    // and take that chance to remove the cached version of that file
    // but it's not supposed to happen
    return (0, _readFile.readFile)({
      location: inputLocation
    }).then(({
      content
    }) => {
      return compile({
        rootLocation,
        abstractFolderRelativeLocation,
        inputRelativeLocation,
        inputSource: content,
        filename,
        groupId,
        getSourceNameForSourceMap: () => {
          return filename;
        },
        getSourceLocationForSourceMap: _locaters.getSourceLocationForSourceMap
      }).then(({
        options,
        generate
      }) => {
        const branchIsValid = branch => {
          return JSON.stringify(branch.outputMeta) === JSON.stringify(options);
        };

        const cachedBranch = cache.branches.find(branch => branchIsValid(branch));
        return {
          inputLocation,
          cache,
          options,
          generate,
          input: content,
          branch: cachedBranch
        };
      });
    });
  });
};

const getFileReport = ({
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  inputETagClient = null,
  groupId,
  compile
}) => {
  return getFileBranch({
    rootLocation,
    cacheFolderRelativeLocation,
    abstractFolderRelativeLocation,
    filename,
    groupId,
    compile
  }).then(({
    inputLocation,
    cache,
    options,
    generate,
    input,
    branch
  }) => {
    if (!branch) {
      return {
        inputLocation,
        status: "missing",
        cache,
        options,
        generate,
        branch: {
          name: (0, _cuid.default)()
        },
        input
      };
    }

    return readBranch({
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename,
      inputLocation,
      inputETagClient,
      cache,
      branch
    }).then(({
      status,
      input,
      output,
      outputAssets
    }) => {
      return {
        inputLocation,
        status,
        cache,
        options,
        generate,
        branch,
        input,
        output,
        outputAssets
      };
    });
  });
};

const compareBranch = (branchA, branchB) => {
  const lastMatchDiff = branchA.lastMatchMs - branchB.lastMatchMs;

  if (lastMatchDiff === 0) {
    return branchA.matchCount - branchB.matchCount;
  }

  return lastMatchDiff;
};

const updateBranch = ({
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  inputLocation,
  status,
  cache,
  options,
  branch,
  inputETag,
  output,
  outputAssets,
  cacheAutoClean,
  cacheTrackHit
}) => {
  const {
    branches
  } = cache;
  const isCached = status === "cached";
  const isNew = status === "created";
  const isUpdated = status === "updated";
  const promises = [];

  if (isNew || isUpdated) {
    const mainLocation = (0, _locaters.getOutputLocation)({
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename,
      branch
    });
    promises.push((0, _projectStructureCompileBabel.writeFileFromString)(mainLocation, output), ...outputAssets.map(asset => {
      const assetLocation = (0, _locaters.getOutputAssetLocation)({
        rootLocation,
        cacheFolderRelativeLocation,
        abstractFolderRelativeLocation,
        filename,
        branch,
        asset
      });
      return (0, _projectStructureCompileBabel.writeFileFromString)(assetLocation, asset.content);
    }));
  }

  if (isNew || isUpdated || isCached && cacheTrackHit) {
    if (cacheAutoClean) {
      if (inputETag !== cache.inputETag) {
        const branchesToRemove = branches.slice(); // no need to remove the updated branch

        const index = branchesToRemove.indexOf(branch);
        branchesToRemove.splice(index, 1);
        branches.length = 0;
        branchesToRemove.forEach(branch => {
          const branchLocation = (0, _locaters.getBranchLocation)({
            rootLocation,
            cacheFolderRelativeLocation,
            abstractFolderRelativeLocation,
            filename,
            branch
          });
          console.log(`file changed, remove ${branchLocation}`); // the line below is async but non blocking

          (0, _helpers.removeFolderDeep)(branchLocation);
        });
      }
    }

    if (isNew) {
      branches.push(branch);
    }

    const updatedBranches = branches.map(branchToUpdate => {
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
          outputAssets: outputAssets.map(({
            name,
            content
          }) => {
            return {
              name,
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
        outputAssets: outputAssets.map(({
          name,
          content
        }) => {
          return {
            name,
            eTag: (0, _helpers.createETag)(content)
          };
        })
      };
    }).sort(compareBranch);
    const inputRelativeLocation = (0, _locaters.getInputRelativeLocation)({
      abstractFolderRelativeLocation,
      filename
    });
    const updatedCache = {
      inputRelativeLocation,
      inputETag: isCached ? cache.inputETag : inputETag,
      inputLocation: inputLocation === (0, _locaters.getSourceAbstractLocation)({
        rootLocation,
        inputRelativeLocation
      }) ? undefined : inputLocation,
      branches: updatedBranches
    };
    const cacheDataLocation = (0, _locaters.getCacheDataLocation)({
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename
    });
    promises.push((0, _projectStructureCompileBabel.writeFileFromString)(cacheDataLocation, JSON.stringify(updatedCache, null, "  ")));
  }

  return Promise.all(promises);
};

const getFileCompiled = ({
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  compile,
  inputETagClient,
  groupId,
  getBabelPlugins,
  cacheEnabled,
  cacheAutoClean,
  cacheTrackHit
}) => {
  const fileLock = (0, _ressourceRegistry.lockForRessource)((0, _locaters.getCacheDataLocation)({
    rootLocation,
    cacheFolderRelativeLocation,
    abstractFolderRelativeLocation,
    filename
  }));
  return fileLock.chain(() => {
    return getFileReport({
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename,
      inputETagClient,
      groupId,
      compile
    }).then(({
      inputLocation,
      status,
      cache,
      options,
      generate,
      branch,
      input,
      inputETag,
      output,
      outputAssets
    }) => {
      const outputRelativeLocation = (0, _locaters.getOutputRelativeLocation)({
        cacheFolderRelativeLocation,
        abstractFolderRelativeLocation,
        filename,
        branch
      });

      if (cacheEnabled && status === "valid") {
        return {
          inputLocation,
          status: "cached",
          cache,
          options,
          branch,
          input,
          inputETag,
          outputRelativeLocation,
          output,
          outputAssets
        };
      }

      return Promise.resolve(generate({
        outputRelativeLocation,
        getBabelPlugins
      })).then(({
        output,
        outputAssets
      }) => {
        return {
          inputLocation,
          status: status === "missing" ? "created" : "updated",
          cache,
          options,
          branch,
          input,
          inputETag: (0, _helpers.createETag)(input),
          outputRelativeLocation,
          output,
          outputAssets
        };
      });
    }).then(({
      inputLocation,
      status,
      cache,
      options,
      branch,
      input,
      inputETag,
      outputRelativeLocation,
      output,
      outputAssets
    }) => {
      return updateBranch({
        rootLocation,
        cacheFolderRelativeLocation,
        abstractFolderRelativeLocation,
        filename,
        inputLocation,
        status,
        cache,
        options,
        branch,
        input,
        inputETag,
        output,
        outputAssets,
        cacheTrackHit,
        cacheAutoClean
      }).then(() => {
        return {
          status,
          inputETag,
          output,
          outputRelativeLocation
        };
      });
    });
  });
};

const createCompileService = ({
  rootLocation,
  cacheFolderRelativeLocation = "build",
  abstractFolderRelativeLocation = "compiled",
  compile = (0, _createCompile.createCompile)(),
  cacheEnabled = false,
  cacheAutoClean = true,
  cacheTrackHit = false
}) => {
  const fileService = (0, _createFileService.createFileService)();
  const compileProfilePromise = (0, _createCompileProfiles.createCompileProfiles)({
    root: rootLocation
  });

  const service = ({
    method,
    url,
    headers
  }) => {
    const pathname = url.pathname; // '/compiled/folder/file.js' -> 'compiled/folder/file.js'

    const filename = pathname.slice(1); // je crois, que, normalement
    // il faudrait "aider" le browser pour que tout ça ait du sens
    // genre lui envoyer une redirection vers le fichier en cache
    // genre renvoyer 201 vers le cache lorsqu'il a été update ou créé
    // https://developer.mozilla.org/fr/docs/Web/HTTP/Status/201
    // renvoyer 302 ou 307 lorsque le cache existe
    // l'intérêt c'est que si jamais le browser fait une requête vers le cache
    // il sait à quoi ça correspond vraiment
    // par contre ça fait 2 requête http

    return compileProfilePromise.then(({
      getGroupIdForPlatform,
      getPluginsFromGroupId
    }) => {
      const {
        platformName,
        platformVersion
      } = (0, _getPlatformAndVersionFromHeaders.getPlatformAndVersionFromHeaders)(headers);
      const groupId = getGroupIdForPlatform({
        platformName,
        platformVersion
      });

      if (filename.endsWith(".map")) {
        const fileLock = (0, _ressourceRegistry.lockForRessource)((0, _locaters.getCacheDataLocation)({
          rootLocation,
          cacheFolderRelativeLocation,
          abstractFolderRelativeLocation,
          filename
        }));
        return fileLock.chain(() => {
          const script = filename.slice(0, -4); // 'folder/file.js.map' -> 'folder.file.js'
          // if we receive something like compiled/folder/file.js.map
          // we redirect to build/folder/file.js/jqjcijjojio/file.js.map

          return getFileBranch({
            rootLocation,
            cacheFolderRelativeLocation,
            abstractFolderRelativeLocation,
            filename: script,
            compile,
            groupId
          }).then(({
            branch
          }) => {
            if (!branch) {
              return {
                status: 404
              };
            }

            const outputLocation = (0, _locaters.getOutputLocation)({
              rootLocation,
              cacheFolderRelativeLocation,
              abstractFolderRelativeLocation,
              filename: script,
              branch
            });
            return fileService({
              method,
              url: new _url.URL(`file:///${outputLocation}.map${url.search}`),
              headers
            }); // .then(({ status, headers = {}, body }) => {
            //   headers.vary = [...(headers.vary ? [headers.vary] : []), "User-agent"].join(",")
            //   return { status, headers, body }
            // })
          }, error => {
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
        rootLocation,
        cacheFolderRelativeLocation,
        abstractFolderRelativeLocation,
        filename,
        compile,
        inputETagClient: "if-none-match" in headers ? headers["if-none-match"] : undefined,
        groupId,
        getBabelPlugins: () => getPluginsFromGroupId(groupId),
        cacheEnabled,
        cacheAutoClean,
        cacheTrackHit
      }).then(({
        status,
        inputETag,
        outputRelativeLocation,
        output
      }) => {
        // here status can be "created", "updated", "cached"
        // c'est un peu optimiste ici de se dire que si c'est cached et qu'on a
        // if-none-match c'est forcément le etag du client qui a match
        // faudra changer ça non?
        if ("if-none-match" in headers && status === "cached") {
          return {
            status: 304,
            headers: {
              "cache-control": "no-store",
              vary: "User-Agent",
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
            vary: "User-Agent",
            "x-location": outputRelativeLocation
          },
          body: output
        };
      }, error => {
        if (error && error.reason === "Unexpected directory operation") {
          return {
            status: 403
          };
        }

        return Promise.reject(error);
      });
    });
  };

  const compileFile = relativeLocation => getFileCompiled({
    rootLocation,
    cacheFolderRelativeLocation,
    abstractFolderRelativeLocation,
    filename: `${abstractFolderRelativeLocation}/${relativeLocation}`,
    compile,
    cacheEnabled,
    cacheAutoClean,
    cacheTrackHit
  });

  return {
    service,
    compileFile
  };
};

exports.createCompileService = createCompileService;
//# sourceMappingURL=createCompileService.js.map