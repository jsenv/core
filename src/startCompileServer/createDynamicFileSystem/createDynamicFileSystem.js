// dynamic may not be the right name, maybe derived would be better

// https://github.com/jsenv/core/blob/master/src/api/util/store.js

import path from "path"
import fs from "fs"
import cuid from "cuid"
import { createAction, all } from "@dmail/action"
// we use eTag as cache invalidation mecanism
// because mtime cannot be trusted due to git, system clock, etc...
import { createEtag } from "./createEtag.js"
import { createDebounceSelfWithMemoize } from "./debounceSelf.js"
import { writeFileFromString } from "../../writeFileFromString.js"

const getFileContentOr = (location, orValue) => {
  const action = createAction()

  fs.readFile(location, (error, buffer) => {
    if (error) {
      if (error.code === "ENOENT") {
        action.pass(orValue)
      } else {
        throw error
      }
    } else {
      action.pass(String(buffer))
    }
  })

  return action
}

const getFileContent = () => {
  const action = createAction()

  fs.readFile(location, (error, buffer) => {
    if (error) {
      throw error
    } else {
      action.pass(String(buffer))
    }
  })

  return action
}

const ressourceMap = new WeakMap()
const debounceRessource = () => {
  return createDebounceSelfWithMemoize({
    read: (file) => ressourceMap.get(file),
    write: (file, memoizedFn) => ressourceMap.set(file, memoizedFn),
  })
}

export const readFileCache = ({ location, folder, dynamicMeta, trackHit = true, generate }) => {
  const staticLocation = location
  // folder is the folder where all staticLocation cached version will be written
  // folder/branches.json is used to keep some information about the cached version
  // such as when they were generated, from which file eTag etc...
  const branchesLocation = `${folder}/branches.json`

  const getDynamicLocation = ({ branch }) => {
    return `${folder}/${branch.name}/${path.basename(location)}`
  }

  const getAssetLocation = ({ branch, asset }) => {
    return `${folder}/${branch.name}/${asset.name}`
  }

  const getCache = () => {
    return getFileContentOr(branchesLocation, "[]")
      .then(JSON.parse)
      .then((branches) => {
        const matchingBranch = branches.find((branch) => {
          return JSON.stringify(branch.dynamicMeta) === JSON.stringify(dynamicMeta)
        })
        return {
          branches,
          branch: matchingBranch || {
            name: cuid(),
          },
          status: matchingBranch ? "old" : "new",
        }
      })
  }

  const readCache = ({ branch, status }) => {
    if (status === "new") {
      return getFileContent(staticLocation).then((content) => {
        return {
          valid: false,
          reason: `no cache matching ${dynamicMeta}`,
          staticContent: content,
        }
      })
    }

    return all([
      getFileContent(staticLocation).then((content) => {
        const actual = createEtag(content)
        const expected = branch.staticMeta.eTag
        if (actual === expected) {
          return {
            valid: true,
            reason: `eTag matching on file ${staticLocation}`,
            content,
          }
        }
        return {
          valid: false,
          reason: `eTag mismatch on file ${staticLocation}`,
          content,
        }
      }),
      ...branch.assets.map((asset) => {
        const assetLocation = getAssetLocation({ branch, asset })
        return getFileContentOr(assetLocation, null).then((content) => {
          if (content === null) {
            return {
              valid: false,
              reason: `asset not found ${assetLocation}`,
            }
          }
          const actual = createEtag(content)
          const expected = asset.eTag
          if (actual === expected) {
            return {
              valid: true,
              reason: `eTag matching on asset ${assetLocation}`,
              content,
            }
          }
          return {
            valid: false,
            reason: `eTag mismatch on asset ${assetLocation}`,
            content,
          }
        })
      }),
    ]).then(([dynamicEntry, ...assetEntries]) => {
      const invalidReason = dynamicEntry.valid
        ? assetEntries.find((asset) => asset.valid === false)
        : assetEntries.reason

      if (invalidReason) {
        return {
          valid: false,
          reason: invalidReason,
          staticContent: dynamicEntry.staticContent,
        }
      }
      const dynamicLocation = getDynamicLocation({ branch })
      return getFileContentOr(dynamicLocation, null).then((content) => {
        if (content === null) {
          return {
            valid: false,
            reason: `dynamic file not found ${dynamicLocation}`,
            staticContent: dynamicEntry.content,
          }
        }
        return {
          valid: true,
          reason: "main and assets all valid",
          staticContent: dynamicEntry.content,
          dynamicContent: content,
          assets: branch.assets.map(({ name }, index) => {
            return {
              name,
              content: assetEntries[index].content,
            }
          }),
        }
      })
    })
  }

  const getData = (cache) => {
    return readCache(cache).then(({ valid, staticContent, dynamicContent, assets }) => {
      if (valid) {
        return {
          status: "cache",
          staticContent,
          dynamicContent,
          assets,
        }
      }
      return generate(staticContent).then(({ content: dynamicContent, assets = [] }) => {
        return all([
          writeFileFromString({
            location: getDynamicLocation(cache),
            string: dynamicContent,
          }),
          ...assets.map((asset) =>
            writeFileFromString({
              location: getAssetLocation({ branch: cache.branch, asset }),
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
    })
  }

  const updateCache = ({ branches, branch }, data) => {
    if (data.status === "cache" && !trackHit) {
      return
    }
    // must be updated because trackhit or because data are fresh
    const isFresh = data.status === "fresh"

    Object.assign(branch, {
      lastModifiedMs: Number(Date.now()),
      lastMatchMs: Number(Date.now()),
      assets: data.assets.map(({ name, content }) => {
        return { name, eTag: createEtag(content) }
      }),
      staticMeta: isFresh ? { eTag: createEtag(data.dynamicContent) } : branch.staticMeta,
      matchCount: isFresh ? 1 : branch.matchCount + 1,
    })

    if (isFresh) {
      branches.push(branch)
    }

    const compareBranch = (branchA, branchB) => {
      const lastMatchDiff = branchA.lastMatchMs - branchB.lastMatchMs

      if (lastMatchDiff === 0) {
        return branchA.matchCount - branchB.matchCount
      }
      return lastMatchDiff
    }
    branches = branches.sort(compareBranch)
    const branchesSource = JSON.stringify(branches, null, "\t")

    return writeFileFromString({
      location: branchesLocation,
      string: branchesSource,
    })
  }

  return debounceRessource(() => {
    return getCache().then((cache) => {
      return getData(cache).then((data) => {
        return updateCache(cache, data).then(() => data)
      })
    })
  })(branchesLocation)
}
