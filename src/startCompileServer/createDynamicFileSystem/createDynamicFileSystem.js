// dynamic may not be the right name, maybe derived would be better

// https://github.com/jsenv/core/blob/master/src/api/util/store.js

import path from "path"
import cuid from "cuid"
import { all, passed } from "@dmail/action"
// we use eTag as cache invalidation mecanism
// because mtime cannot be trusted due to git, system clock, etc...
import { createEtag } from "./createEtag.js"
import { createDebounceSelfWithMemoize } from "./debounceSelf.js"
import { writeFileFromString } from "../../writeFileFromString.js"
import { getFileContentOr, getFileContent, readFolder, removeFile } from "./helpers.js"

const getCacheLocation = ({ folder }) => {
  return `${folder}/cache.json`
}

const getDynamicLocation = ({ folder, branch }) => {
  return `${folder}/${branch.name}/${path.basename(branch.staticLocation)}`
}

const getAssetLocation = ({ folder, branch, asset }) => {
  return `${folder}/${branch.name}/${asset.name}`
}

const defaultCache = `{
  "dynamicMeta": {},
  "staticLocation": "",
  "eTag": "",
  "branches": [],
}`

const readCache = ({ folder }) => {
  return getFileContentOr(getCacheLocation({ folder }), defaultCache).then(JSON.parse)
}

const readDynamicFileCache = ({ folder, cache, branch, allowMissingStatic = false }) => {
  const { staticLocation, eTag } = cache

  return getFileContentOr(staticLocation, null).then((staticContent) => {
    if (staticContent === null) {
      if (allowMissingStatic) {
        return {
          valid: false,
          reason: `static file not found: ${staticLocation}`,
        }
      }
      throw new Error(`static file not found: ${staticLocation}`)
    }
    const actual = createEtag(staticContent)
    const expected = eTag
    if (actual !== expected) {
      return {
        valid: false,
        reason: `static eTag modified on ${staticLocation}`,
        staticContent,
      }
    }

    const dynamicLocation = getDynamicLocation({ folder, branch })
    return getFileContentOr(dynamicLocation, null).then((dynamicContent) => {
      if (dynamicContent === null) {
        return {
          valid: false,
          reason: `dynamic file not found ${dynamicLocation}`,
          staticContent,
        }
      }
      return {
        valid: true,
        reason: `static eTag matched on ${staticLocation}`,
        staticContent,
        dynamicContent,
      }
    })
  })
}

const readAssetCache = ({ folder, branch, asset }) => {
  const assetLocation = getAssetLocation({ folder, branch, asset })
  return getFileContentOr(assetLocation, null).then((content) => {
    if (content === null) {
      return {
        valid: false,
        reason: `asset file not found ${assetLocation}`,
      }
    }
    const actual = createEtag(content)
    const expected = asset.eTag
    if (actual !== expected) {
      return {
        valid: false,
        reason: `asset eTag modified on ${assetLocation}`,
        content,
      }
    }
    return {
      valid: true,
      reason: `asset eTag matching on ${assetLocation}`,
      content,
    }
  })
}

const readBranch = ({ folder, cache, branch, allowMissingStatic }) => {
  return all([
    readDynamicFileCache({ folder, cache, branch, allowMissingStatic }),
    ...branch.assets.map((asset) => readAssetCache({ folder, cache, branch, asset })),
  ]).then(([dynamicFileData, ...assetsData]) => {
    const invalidReason = dynamicFileData.valid
      ? assetsData.find((asset) => asset.valid === false)
      : dynamicFileData.reason

    const data = {
      staticContent: dynamicFileData.staticContent,
      dynamicContent: dynamicFileData.dynamicContent,
      assets: branch.assets.map(({ name }, index) => {
        return {
          name,
          content: assetsData[index].content,
        }
      }),
    }

    if (invalidReason) {
      return {
        valid: false,
        reason: invalidReason,
        data,
      }
    }
    const dynamicLocation = getDynamicLocation({ branch })
    return getFileContentOr(dynamicLocation, null).then((content) => {
      if (content === null) {
        return {
          valid: false,
          reason: `dynamic file not found ${dynamicLocation}`,
          data,
        }
      }
      return {
        valid: true,
        reason: "main and assets all valid",
        data,
      }
    })
  })
}

const updateBranches = ({ folder, cache, branches }) => {
  return writeFileFromString({
    location: getCacheLocation({ folder }),
    string: JSON.stringify({ ...cache, branches }, null, "\t"),
  })
}

const ressourceMap = new WeakMap()
const debounceRessource = () => {
  return createDebounceSelfWithMemoize({
    read: (file) => ressourceMap.get(file),
    write: (file, memoizedFn) => ressourceMap.set(file, memoizedFn),
  })
}

export const getDynamicFileWithCache = ({
  location,
  folder,
  dynamicMeta,
  trackHit = true,
  generate,
}) => {
  const staticLocation = location
  // folder is the folder where all staticLocation cached version will be written
  // folder/cache.json is used to keep some information about the cached version
  // such as when they were generated, from which file eTag etc...

  const branchIsValid = (branch) => {
    return JSON.stringify(branch.dynamicMeta) === JSON.stringify(dynamicMeta)
  }

  const getData = ({ cache, branch }) => {
    const getDataFromGenerate = ({ staticContent, branch }) => {
      return generate(staticContent).then(({ content: dynamicContent, assets = [] }) => {
        return all([
          writeFileFromString({
            location: getDynamicLocation({ folder, cache }),
            string: dynamicContent,
          }),
          ...assets.map((asset) =>
            writeFileFromString({
              location: getAssetLocation({ branch, asset }),
              string: asset.content,
            }),
          ),
        ]).then(() => {
          return {
            status: "fresh",
            staticContent,
            dynamicContent,
            assets,
          }
        })
      })
    }

    if (branch) {
      return readBranch({ folder, cache, branch }).then(({ valid, data }) => {
        if (valid) {
          return { status: "cached", data }
        }
        return "staticContent" in data
          ? passed(data.staticContent)
          : getFileContent(staticLocation).then((staticContent) => {
              return getDataFromGenerate({ staticContent, branch }).then((data) => {
                return { status: "updated", data }
              })
            })
      })
    }

    branch = { name: cuid() }
    return getFileContent(staticLocation).then((staticContent) => {
      return getDataFromGenerate({ staticContent, branch }).then((data) => {
        return { status: "created", data }
      })
    })
  }

  const saveData = ({ cache, branch, status, data }) => {
    const isCached = status === "cached"
    const isNew = status === "created"

    if (isCached && !trackHit) {
      return passed()
    }

    Object.assign(branch, {
      staticLocation,
      dynamicMeta,
      eTag: isCached ? branch.eTag : createEtag(data.dynamicContent),
      matchCount: isCached ? branch.matchCount + 1 : 1,
      createdMs: isNew ? Number(Date.now()) : branch.createdMs,
      lastModifiedMs: isCached ? branch.lastModifiedMs : Number(Date.now()),
      lastMatchMs: Number(Date.now()),
      assets: isCached
        ? branch.assets
        : data.assets.map(({ name, content }) => {
            return { name, eTag: createEtag(content) }
          }),
    })

    if (isNew) {
      cache.branches.push(branch)
    }

    const compareBranch = (branchA, branchB) => {
      const lastMatchDiff = branchA.lastMatchMs - branchB.lastMatchMs

      if (lastMatchDiff === 0) {
        return branchA.matchCount - branchB.matchCount
      }
      return lastMatchDiff
    }
    return updateBranches({ folder, cache, branches: cache.branches.sort(compareBranch) })
  }

  return debounceRessource(() => {
    return readCache({ folder }).then((cache) => {
      return getData({
        cache,
        branch: cache.branches.find((branch) => branchIsValid(branch)),
      }).then(({ data, branch, status }) =>
        saveData({ cache, data, branch, status }).then(() => data),
      )
    })
  })(getCacheLocation({ folder }))
}

export const inspectCache = ({ folder }) => {
  return all([readCache({ folder }), readFolder(folder)]).then(([cache, files]) => {
    const { branches } = cache

    return all(
      branches.map((branch) => readBranch({ folder, cache, branch, allowMissingStatic: true })),
    ).then((branchesData) => {
      const validBranches = branches.filter((branch, index) => branchesData[index].valid)

      const getDynamicFileBranch = (file) => {
        return branches.find((branch) => branch.name === file)
      }
      const getAssetBranch = (file) => {
        return validBranches.find((branch) => branch.assets.some(({ name }) => name === file))
      }
      const branchIsValid = (branch) => {
        const index = branches.indexOf(branch)
        return branchesData[index].valid
      }

      return {
        cache,
        files,
        filesStatus: files.map((file) => {
          const dynamicFileBranch = getDynamicFileBranch(file)
          if (dynamicFileBranch) {
            return `dynamic-file-${
              branchIsValid(dynamicFileBranch) ? "valid" : "invalid"
            }-reference`
          }
          const assetBranch = getAssetBranch(file)
          if (assetBranch) {
            return `asset-${branchIsValid(dynamicFileBranch) ? "valid" : "invalid"}-reference`
          }
          return "no-reference"
        }),
        branches,
        branchesStatus: branches.map((branch, index) => {
          const { valid, reason } = branchesData[index]
          if (valid) {
            return "valid"
          }
          return reason
        }),
      }
    })
  })
}

export const syncCache = ({ folder }) => {
  return inspectCache({ folder }).then(
    ({ cache, files, filesStatus, branches, branchesStatus }) => {
      const filesWithInvalidStatus = files.filter((file, index) => {
        const status = filesStatus[index]
        return (
          status === "dynamic-file-invalid-reference" ||
          status === "asset-invalid-reference" ||
          status === "no-reference"
        )
      })
      const branchesWithValidStatus = branches.filter((branch, index) => {
        return branchesStatus[index] === "valid"
      })

      return all([
        ...filesWithInvalidStatus.map((file) => removeFile(`${folder}/${file}`)),
        updateBranches({ folder, cache, branches: branchesWithValidStatus }),
      ])
    },
  )
}
