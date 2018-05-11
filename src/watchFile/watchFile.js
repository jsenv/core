import { all, createAction, failed, passed } from "@dmail/action"
import { createSignal } from "@dmail/signal"
import fs from "fs"
import { guardAsync } from "../guard.js"
import { memoizeSync } from "../memoize.js"

const getModificationDate = (url) => {
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

const createChangedAsyncShield = (read, compare) => {
  let currentValueAction = passed(read())

  return () => {
    const nextValueAction = passed(read())
    return all([currentValueAction, nextValueAction]).then(([value, nextValue]) => {
      currentValueAction = nextValueAction
      return compare(value, nextValue) ? passed() : failed()
    })
  }
}

const createWatchSignal = (url) => {
  const shield = createChangedAsyncShield(
    () => getModificationDate(url),
    (modificationDate, nextModificationDate) =>
      Number(modificationDate) !== Number(nextModificationDate),
  )

  return createSignal({
    installer: ({ emit }) => {
      // https://nodejs.org/docs/latest/api/fs.html#fs_class_fs_fswatcher
      const guardedEmit = guardAsync(emit, shield)
      const watcher = fs.watch(url, { persistent: false }, (eventType, filename) => {
        guardedEmit({ url, eventType, filename })
      })
      return () => watcher.close()
    },
  })
}

const memoizedCreateWatchSignal = memoizeSync(createWatchSignal)

export const watchFile = (url, fn) => {
  return memoizedCreateWatchSignal(url).listen(fn)
}
