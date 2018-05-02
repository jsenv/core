import { createAction, passed, failed, all } from "@dmail/action"
import { createSignal } from "@dmail/signal"
import fs from "fs"
import { memoizeSync, createStore } from "../memoize.js"
import { shield } from "../shield.js"

const getMtime = (url) => {
  const action = createAction()

  fs.stat(url, (error, stat) => {
    if (error) {
      throw error
    } else {
      action.pass(stat.mtime)
    }
  })

  return action
}

const createModifiedGuard = (read, compare) => {
  let currentValueAction = passed(read())

  return () => {
    const nextValueAction = passed(read())
    return all([currentValueAction, nextValueAction]).then(([value, nextValue]) => {
      return compare(value, nextValue).then(() => {
        currentValueAction = nextValueAction
      })
    })
  }
}

const createModifiedMtimeGuard = (url) => {
  return createModifiedGuard(
    () => getMtime(url),
    (mtime, nextMtime) => (Number(mtime) === Number(nextMtime) ? failed() : passed()),
  )
}

const defaultWatch = (url, callback) => {
  const watcher = fs.watch(url, { persistent: false }, callback)
  return () => watcher.close()
}

const memoizedWatch = memoizeSync(defaultWatch, createStore())

const createWatchSignal = (url) => {
  const guard = createModifiedMtimeGuard(url)
  return createSignal({
    installer: ({ emit }) => {
      // https://nodejs.org/docs/latest/api/fs.html#fs_class_fs_fswatcher
      const shieldedEmit = shield(emit, guard)
      return memoizedWatch(url, () => shieldedEmit({ url }))
    },
  })
}

const memoizedCreateWatchSignal = memoizeSync(createWatchSignal, createStore())

export const watchFile = (url, fn) => {
  return memoizedCreateWatchSignal(url).listen(fn)
}
