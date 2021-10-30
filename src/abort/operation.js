import { Abort } from "./abort.js"
import { createCleaner } from "./cleaner.js"
import { raceCallbacks } from "./callback_race.js"

export const createOperation = ({
  abortSignal = Abort.dormantSignal(),
  handleSIGINT = false,
} = {}) => {
  const cleaner = createCleaner()

  if (handleSIGINT) {
    const abortControllerSIGINT = new AbortController()
    abortSignal = Abort.composeTwoAbortSignals(
      abortSignal,
      abortControllerSIGINT.signal,
    )
    const SIGINTEventCallback = () => {
      abortControllerSIGINT.abort()
    }
    process.once("SIGINT", SIGINTEventCallback)
    cleaner.addCallback(() => {
      process.removeEventListener("SIGINT", SIGINTEventCallback)
    })
  }

  const abortEventCallback = () => {
    abortSignal.removeEventListener("abort", abortEventCallback)
    cleaner.clean()
  }
  // when aborted -> call clean()
  abortSignal.addEventListener("abort", abortEventCallback)
  // when cleanup -> remove "abort" listener
  // so that when cleanup is called by something else than abort signal
  // we remove the callback
  cleaner.addCallback(() => {
    abortSignal.removeEventListener("abort", abortEventCallback)
  })

  return { abortSignal, cleaner }
}

export const addProcessTeardownInOperationAbortSignal = (
  operation,
  {
    SIGHUP = false,
    SIGTERM = false,
    SIGINT = false,
    beforeExit = false,
    exit = false,
  } = {},
) => {
  const processSignalAbortController = new AbortController()
  operation.abortSignal = Abort.composeTwoAbortSignals(
    operation.abortSignal,
    processSignalAbortController.signal,
  )
  return raceCallbacks(
    {
      ...(SIGHUP ? SIGHUP_CALLBACK : {}),
      ...(SIGTERM ? SIGTERM_CALLBACK : {}),
      ...(SIGINT ? SIGINT_CALLBACK : {}),
      ...(beforeExit ? BEFORE_EXIT_CALLBACK : {}),
      ...(exit ? EXIT_CALLBACK : {}),
    },
    () => {
      processSignalAbortController.abort()
    },
  )
}

const SIGHUP_CALLBACK = {
  SIGHUP: (cb) => {
    process.on("SIGHUP", cb)
    return () => {
      process.removeListener("SIGHUP", cb)
    }
  },
}

const SIGTERM_CALLBACK = {
  SIGTERM: (cb) => {
    process.on("SIGTERM", cb)
    return () => {
      process.removeListener("SIGTERM", cb)
    }
  },
}

const BEFORE_EXIT_CALLBACK = {
  beforeExit: (cb) => {
    process.on("beforeExit", cb)
    return () => {
      process.removeListener("beforeExit", cb)
    }
  },
}

const EXIT_CALLBACK = {
  exit: (cb) => {
    process.on("exit", cb)
    return () => {
      process.removeListener("exit", cb)
    }
  },
}

const SIGINT_CALLBACK = {
  SIGINT: (cb) => {
    process.on("SIGINT", cb)
    return () => {
      process.removeListener("SIGINT", cb)
    }
  },
}
