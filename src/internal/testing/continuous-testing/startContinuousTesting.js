/* eslint-disable import/max-dependencies */
import {
  createCancellationToken,
  composeCancellationToken,
  createCancellationSource,
  errorToCancelReason,
} from "@jsenv/cancellation"
import { createLogger } from "@jsenv/logger"
import {
  urlIsInsideOf,
  urlToRelativeUrl,
  urlToFileSystemPath,
  registerDirectoryLifecycle,
} from "@jsenv/util"
import { executeJsenvAsyncFunction } from "@jsenv/core/src/internal/executeJsenvAsyncFunction.js"
import { require } from "@jsenv/core/src/internal/require.js"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "../../argUtils.js"
import { generateExecutionSteps } from "../../executing/generateExecutionSteps.js"
import { executeConcurrently } from "../../executing/executeConcurrently.js"
import { startCompileServer } from "../../compiling/startCompileServer.js"
import { relativeUrlToExecutionSteps } from "./relativeUrlToExecutionSteps.js"
import { showContinuousTestingNotification } from "./showContinuousTestingNotification.js"
import { createRemoveLog, createRunLog } from "./continous-testing-logs.js"

const cuid = require("cuid")

export const TESTING_WATCH_EXCLUDE_DESCRIPTION = {
  "./.git/": false,
  "./node_modules/": false,
}

export const startContinuousTesting = async ({
  cancellationToken = createCancellationToken(),
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importDefaultExtension,
  testPlan = {},
  watchDescription = {
    "./**/*": true,
    ...TESTING_WATCH_EXCLUDE_DESCRIPTION,
  },
  compileGroupCount = 2,
  babelPluginMap,
  convertMap,
  logLevel,
  maxParallelExecution,
  defaultAllocatedMsPerExecution = 30000,
  captureConsole = true,
  measureDuration = true,
  measureTotalDuration = false,
  systemNotification = true,
}) => {
  return executeJsenvAsyncFunction(async () => {
    const logger = createLogger({ logLevel })

    projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
    await assertProjectDirectoryExists({ projectDirectoryUrl })

    const dependencyTracker = createDependencyTracker()
    let executionImportCallback = ({ relativeUrl, executionId }) => {
      dependencyTracker.trackDependency(relativeUrl, executionId)
    }

    const projectFileSet = new Set()
    const projectFileRequestedCallback = (relativeUrl, request) => {
      projectFileSet.add(relativeUrl)

      const { headers = {} } = request
      if ("x-jsenv-execution-id" in headers) {
        const executionId = headers["x-jsenv-execution-id"]
        executionImportCallback({ relativeUrl, executionId })
      } else if ("referer" in headers) {
        const { referer } = headers
        const { origin } = request
        if (referer === origin || urlIsInsideOf(referer, origin)) {
          const refererRelativeUrl = urlToRelativeUrl(referer, origin)

          executionSteps.forEach(({ executionId, fileRelativeUrl }) => {
            if (fileRelativeUrl === refererRelativeUrl) {
              executionImportCallback({ relativeUrl, executionId })
            }
          })
        } else {
          executionImportCallback({ relativeUrl })
        }
      } else {
        executionImportCallback({ relativeUrl })
      }
    }

    const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
      cancellationToken,
      logLevel: "warn",

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      importDefaultExtension,

      compileGroupCount,
      babelPluginMap,
      convertMap,
      projectFileRequestedCallback,
      keepProcessAlive: true,
    })

    const unregisterProjectDirectoryLifecycle = registerDirectoryLifecycle(
      urlToFileSystemPath(projectDirectoryUrl),
      {
        watchDescription: {
          ...watchDescription,
          [outDirectoryRelativeUrl]: false,
        },
        keepProcessAlive: false,
        recursive: true,
        added: ({ relativeUrl, type }) => {
          if (type === "file") {
            projectFileAddedCallback({ relativeUrl })
          }
        },
        updated: ({ relativeUrl }) => {
          if (!projectFileSet.has(relativeUrl)) return
          projectFileUpdatedCallback({ relativeUrl })
        },
        removed: ({ relativeUrl }) => {
          if (!projectFileSet.has(relativeUrl)) return
          projectFileRemovedCallback({ relativeUrl })
        },
      },
    )
    cancellationToken.register(unregisterProjectDirectoryLifecycle)

    let executionSteps = await generateExecutionSteps(testPlan, {
      cancellationToken,
      projectDirectoryUrl,
    })
    executionSteps.forEach((executionStep) => {
      executionStep.executionId = cuid()
    })

    let testingResult
    let initialTestingDone = false
    let fileMutationMapHandledAfterInitialTesting = {}
    let fileMutationMap
    let resolveActionRequired

    const projectFileAddedCallback = ({ relativeUrl }) => {
      projectFileSet.add(relativeUrl)

      if (!initialTestingDone) {
        fileMutationMapHandledAfterInitialTesting[relativeUrl] = "added"
        return
      }

      fileMutationMap[relativeUrl] = "added"
      checkActionRequiredResolution({
        projectDirectoryUrl,
        testPlan,
        executionSteps,
        dependencyTracker,
        fileMutationMap,
        resolveActionRequired,
      })
    }

    const projectFileUpdatedCallback = ({ relativeUrl }) => {
      if (!initialTestingDone) {
        fileMutationMapHandledAfterInitialTesting[relativeUrl] = "updated"
        return
      }

      fileMutationMap[relativeUrl] = "updated"
      checkActionRequiredResolution({
        projectDirectoryUrl,
        testPlan,
        executionSteps,
        dependencyTracker,
        fileMutationMap,
        resolveActionRequired,
      })
    }

    const projectFileRemovedCallback = ({ relativeUrl }) => {
      if (!initialTestingDone) {
        fileMutationMapHandledAfterInitialTesting[relativeUrl] = "removed"
        return
      }

      fileMutationMap[relativeUrl] = "removed"
      checkActionRequiredResolution({
        projectDirectoryUrl,
        testPlan,
        executionSteps,
        dependencyTracker,
        fileMutationMap,
        resolveActionRequired,
      })
    }

    const getNextTestingResult = async (actionRequiredPromise) => {
      const {
        toAdd,
        toRun,
        toRemove,
        // fileResponsibleOfAdd,
        fileResponsibleOfRemove,
        fileResponsibleOfRun,
      } = await actionRequiredPromise

      const nextActionRequiredPromise = generateActionRequiredPromise()
      const actionRequiredCancellationSource = createCancellationSource()
      const externalOrFileChangedCancellationToken = composeCancellationToken(
        cancellationToken,
        actionRequiredCancellationSource.token,
      )

      if (toRun.length > 0) {
        logger.info(createRunLog({ fileResponsibleOfRun, toRun }))

        const nextDependencyTracker = createDependencyTracker()
        executionImportCallback = ({ relativeUrl, executionId }) => {
          dependencyTracker.trackDependency(relativeUrl, executionId)
          nextDependencyTracker.trackDependency(relativeUrl, executionId)
        }

        let executing
        nextActionRequiredPromise.then(
          () => {
            if (executing) {
              logger.info(`cancel all execution`)
              actionRequiredCancellationSource.cancel({
                code: "ACTION_REQUIRED",
              })
            }
          },
          () => {},
        )

        const previousTestingResult = testingResult
        try {
          executing = true
          testingResult = await executeConcurrently(toRun, {
            cancellationToken: externalOrFileChangedCancellationToken,
            logLevel,
            executionLogLevel: "off",

            projectDirectoryUrl,
            jsenvDirectoryRelativeUrl,
            outDirectoryRelativeUrl,
            compileServerOrigin,
            importDefaultExtension,

            maxParallelExecution,
            defaultAllocatedMsPerExecution,
            logEachExecutionSuccess: false,
            captureConsole,
            measureDuration,
            measureTotalDuration,
            afterEachExecutionCallback: ({ executionId }) => {
              // only once an execution is done,
              // we update its dependencyArray
              // because only then we know the actual dependencyArray
              // in case it gets cancelled midway
              // dependencyTracker is still tracking what is hapenning
              // and will be notified of any new file
              // becoming a dependency
              dependencyTracker.setDependencySet(
                executionId,
                nextDependencyTracker.getDependencySet(executionId),
              )
            },
            // we can realize a file is removed when we want to execute it
            // it's not a big problem, let's just call projectFileRemovedCallback
            // it can happen because fs.watch is not notified when a file is removed
            // inside a folder on windows os for instance
            mainFileNotFoundCallback: ({ relativeUrl }) => {
              projectFileRemovedCallback({ relativeUrl })
            },
          })
          executing = false

          const updatedRelativeUrlArray = Object.keys(fileMutationMap).filter((relativeUrl) => {
            return fileMutationMap[relativeUrl] === "removed"
          })
          // toRun handled
          updatedRelativeUrlArray.forEach((relativeUrl) => {
            delete fileMutationMap[relativeUrl]
          })

          if (systemNotification) {
            showContinuousTestingNotification({
              projectDirectoryUrl,
              previousTestingResult,
              testingResult,
            })
          }
        } catch (error) {
          const cancelReason = errorToCancelReason(error)
          if (cancelReason && cancelReason.code === `ACTION_REQUIRED`) {
            // do nothing special, we will just wait to next testing result at the bottom
            // of this function
          } else {
            throw error
          }
        }
      }

      // if cancellation is requested we cannot consider the
      // toAdd, toRun, toRemoved as handled
      if (!externalOrFileChangedCancellationToken.cancellationRequested) {
        if (toAdd.length > 0) {
          // log(createAddLog({ fileResponsibleOfAdd, toAdd }))
          // we should sort thoose execution, but it's ok for now
          executionSteps.push(...toAdd)
        }
        if (toRemove.length > 0) {
          logger.info(createRemoveLog({ fileResponsibleOfRemove, toRemove }))
          // we should sort thoose execution, but it's ok for now
          executionSteps = executionSteps.filter(
            (executionStep) => !toRemove.includes(executionStep),
          )
        }
        // all mutation handled, reset the map
        fileMutationMap = {}
      }

      // we wait recursively for next testing result
      // so that something can try/catch
      // the whole execution because we still
      // await for every promise
      return await getNextTestingResult(nextActionRequiredPromise)
    }

    const generateActionRequiredPromise = () => {
      return new Promise((resolve) => {
        resolveActionRequired = resolve
      })
    }

    logger.info("start initial testing")
    testingResult = await executeConcurrently(executionSteps, {
      cancellationToken,
      logLevel,
      executionLogLevel: "off",

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin,
      importDefaultExtension,

      maxParallelExecution,
      defaultAllocatedMsPerExecution,
      logEachExecutionSuccess: false,
      captureConsole,
      measureDuration,
      measureTotalDuration,
      // we can realize a file is removed when we want to execute it
      // it's not a big problem, let's just call projectFileRemovedCallback
      // it can happen because fs.watch is not notified when a file is removed
      // inside a folder on windows os for instance
      mainFileNotFoundCallback: ({ relativeUrl }) => {
        projectFileRemovedCallback({ relativeUrl })
      },
    })
    initialTestingDone = true
    const actionRequiredPromise = generateActionRequiredPromise()
    const willDoSomething = checkActionRequiredResolution({
      projectDirectoryUrl,
      testPlan,
      executionSteps,
      dependencyTracker,
      fileMutationMap: fileMutationMapHandledAfterInitialTesting,
      resolveActionRequired,
    })
    fileMutationMapHandledAfterInitialTesting = undefined
    fileMutationMap = {}
    if (!willDoSomething) {
      logger.info(`test execution will restart automatically`)
    }
    await getNextTestingResult(actionRequiredPromise)
  })
}

const checkActionRequiredResolution = ({
  projectDirectoryUrl,
  testPlan,
  executionSteps,
  dependencyTracker,
  fileMutationMap,
  resolveActionRequired,
}) => {
  const actionsToPerform = computeActionsToPerform({
    projectDirectoryUrl,
    testPlan,
    executionSteps,
    dependencyTracker,
    fileMutationMap,
  })
  if (actionsToPerform) {
    resolveActionRequired(actionsToPerform)
    return true
  }
  return false
}

const computeActionsToPerform = ({
  projectDirectoryUrl,
  testPlan,
  executionSteps,
  dependencyTracker,
  fileMutationMap,
}) => {
  const toAdd = []
  const toRun = []
  const toRemove = []
  const fileResponsibleOfAdd = []
  const fileResponsibleOfRemove = []
  const fileResponsibleOfRun = []

  const fileIsAdded = (relativeUrl) => fileMutationMap[relativeUrl] === "added"

  const fileIsUpdated = (relativeUrl) => fileMutationMap[relativeUrl] === "updated"

  const fileIsRemoved = (relativeUrl) => fileMutationMap[relativeUrl] === "removed"

  executionSteps.forEach((executionStep) => {
    const { fileRelativeUrl } = executionStep

    if (fileIsRemoved(fileRelativeUrl)) {
      if (!fileResponsibleOfRemove.includes(fileRelativeUrl)) {
        fileResponsibleOfRemove.push(fileRelativeUrl)
      }
      toRemove.push(executionStep)
    } else {
      const dependencySet = dependencyTracker.getDependencySet(executionStep.executionId)
      const executionDependencyChangedArray = Array.from(dependencySet).filter((relativeUrl) => {
        if (fileIsUpdated(relativeUrl)) return true
        if (relativeUrl !== fileRelativeUrl && fileIsRemoved(relativeUrl)) return true
        // only indirect dependency added counts
        // otherwise we could add it twice
        if (relativeUrl !== fileRelativeUrl && fileIsAdded(relativeUrl)) return true
        return false
      })
      if (executionDependencyChangedArray.length) {
        executionDependencyChangedArray.forEach((relativeUrl) => {
          if (!fileResponsibleOfRun.includes(relativeUrl)) {
            fileResponsibleOfRun.push(relativeUrl)
          }
        })
        toRun.push(executionStep)
      }
    }
  })

  Object.keys(fileMutationMap).forEach((relativeUrl) => {
    if (!fileIsAdded(relativeUrl)) return

    const toAddForFile = relativeUrlToExecutionSteps(relativeUrl, {
      projectDirectoryUrl,
      plan: testPlan,
    })
    if (toAddForFile.length) {
      toAddForFile.forEach((execution) => {
        execution.executionId = cuid()
      })
      fileResponsibleOfAdd.push(relativeUrl)
      toAdd.push(...toAddForFile)
      fileResponsibleOfRun.push(relativeUrl)
      toRun.push(...toAddForFile)
    }
  })

  if (toAdd.length === 0 && toRun.length === 0 && toRemove.length === 0) {
    return null
  }

  return {
    toAdd,
    toRun,
    toRemove,
    fileResponsibleOfAdd,
    fileResponsibleOfRemove,
    fileResponsibleOfRun,
  }
}

const createDependencyTracker = () => {
  const state = {}

  const trackDependency = (relativeUrl, executionId) => {
    if (executionId) {
      if (state.hasOwnProperty(executionId)) {
        state[executionId].add(relativeUrl)
      } else {
        const set = new Set()
        state[executionId] = set
        set.add(relativeUrl)
      }
    } else {
      Object.keys(state).forEach((executionId) => {
        state[executionId].add(relativeUrl)
      })
    }
  }

  const getDependencySet = (executionId) => {
    return state.hasOwnProperty(executionId) ? state[executionId] : new Set()
  }

  const setDependencySet = (executionId, dependencySet) => {
    state[executionId] = dependencySet
  }

  return {
    trackDependency,
    getDependencySet,
    setDependencySet,
  }
}
