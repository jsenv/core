import { raceCallbacks } from "./callback_race.js"

export const raceProcessTeardownEvents = (processTeardownEvents, callback) => {
  return raceCallbacks(
    {
      ...(processTeardownEvents.SIGHUP ? SIGHUP_CALLBACK : {}),
      ...(processTeardownEvents.SIGTERM ? SIGTERM_CALLBACK : {}),
      ...(processTeardownEvents.SIGINT ? SIGINT_CALLBACK : {}),
      ...(processTeardownEvents.beforeExit ? BEFORE_EXIT_CALLBACK : {}),
      ...(processTeardownEvents.exit ? EXIT_CALLBACK : {}),
    },
    callback,
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
