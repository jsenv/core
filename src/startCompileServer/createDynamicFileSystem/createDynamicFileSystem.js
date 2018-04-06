// https://github.com/jsenv/core/blob/master/src/api/util/store.js

import cuid from "cuid"
import { createAction, all, passed } from "@dmail/action"
import path from "path"
import { mtimeValidator } from "./mtimeValidator.js"
import { eTagValidator, createEtag } from "./eTagValidator.js"

// a given function is forced to wait for any previous function call to be resolved
const createLock = () => {
  const pendings = []
  let locked = false

  const monitorCall = (fn) => {
    locked = true
    return passed(fn()).then(() => {
      locked = false
      if (pendings.length > 0) {
        const { action, fn } = pendings.shift()
        action.pass(monitorCall(fn))
      }
    })
  }

  const callAsap = (fn) => {
    if (locked) {
      const action = createAction()
      pendings.push({ action, fn })
      return action
    }
    return monitorCall(fn)
  }

  return { callAsap }
}

const lockMap = new WeakMap()
const getLockForFile = (file) => {
  if (lockMap.has(file)) {
    return lockMap.get(file)
  }
  const lock = createLock()
  lockMap.set(file, lock)
  return lock
}

const getFileContentOr = () => {}

const setFileContent = () => {}

export const readFileCache = ({
  folder,
  location,
  data,
  trackHit = true,
  strategy = "eTag",
  generate,
}) => {
  const branchesPath = `${folder}/branches.json`
  const branchLock = getLockForFile(branchesPath)

  if (strategy !== "eTag" && strategy !== "mtime") {
    throw new Error(`unexpected ${strategy} strategy, must be eTag or mtime`)
  }

  const getBranches = () => getFileContentOr(branchesPath, "[]").then(JSON.parse)

  const getBranch = (branches) => {
    const matchingBranch = branches.find((branch) => {
      return branch.data === data
    })

    if (matchingBranch) {
      return {
        branch: matchingBranch,
        branchStatus: "old",
      }
    }
    const newBranch = {
      name: cuid(),
      data,
    }
    branches.push(newBranch)
    return {
      branch: newBranch,
      branchStatus: "new",
    }
  }

  const getEntry = ({ staticLocation, dynamicLocation, branch }) => {
    if (strategy === "eTag") {
      // si la branche à des assets
      // chaque assets doit aussi vérifier la stratégie
      return eTagValidator({
        staticLocation,
        dynamicLocation,
        eTag: branch.eTag,
      })
    }
    if (strategy === "mtime") {
      return mtimeValidator({
        staticLocation,
        dynamicLocation,
      })
    }
  }

  return branchLock.callAsap(() => {
    getBranches()
      .then((branches) => {
        let { branch, branchStatus } = getBranch(branches)
        const staticLocation = location
        const dynamicFolder = `${folder}/${branch.name}`
        const dynamicLocation = `${dynamicFolder}/${path.basename(location)}`

        return getEntry({ staticLocation, dynamicLocation, branch }).then((entry) => {
          if (entry.valid) {
            return {
              branches,
              branch,
              branchStatus,
              content: entry.content,
            }
          }
          if (branchStatus === "old") {
            branchStatus = "modified"
          }
          return generate(staticLocation).then(({ content, assets = [] }) => {
            branch.eTag = createEtag(content)
            // il faudrait aussi écrire les assets que retourne generate
            // pour qu'on check que les assets existe toujours lorsqu'on valide que le cache est valide ?
            // il faut alors aussi mettre assets eTags pour qu'on check que les assets présents sont bons

            return all([
              setFileContent(dynamicLocation, content),
              ...assets.map(({ name, content }) =>
                setFileContent(`${dynamicFolder}/${name}`, content),
              ),
            ]).then(() => {
              return {
                branches,
                branch,
                branchStatus,
                content,
              }
            })
          })
        })
      })
      .then(({ branches, branch, branchStatus }) => {
        if (branchStatus === "old" && !trackHit) {
          return
        }

        branch.matchCount++
        branch.lastMatchMs = Number(Date.now())

        const compareBranch = (branchA, branchB) => {
          const lastMatchDiff = branchA.lastMatchMs - branchB.lastMatchMs

          if (lastMatchDiff === 0) {
            return branchA.matchCount - branchB.matchCount
          }
          return lastMatchDiff
        }

        const sortedBranches = branches.sort(compareBranch)
        const branchesSource = JSON.stringify(sortedBranches, null, "\t")
        const updateAction = setFileContent(branchesPath, branchesSource)

        if (branchStatus === "modified" || branchStatus === "new") {
          return updateAction
        }
        // no need to return updateAction in case we trackHit
        // because it's not an problem if matchCount & lastMatchMs are not in sync
      })
  })
}
