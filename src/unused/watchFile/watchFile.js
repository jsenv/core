import { createSignal } from "@dmail/signal"
import fs from "fs"
import { memoizeSync } from "../../memoize.js"
import { guardAsync } from "../guard.js"

const getModificationDate = (url) => {
  return new Promise((resolve, reject) => {
    fs.stat(url, (error, stat) => {
      if (error) {
        reject(error)
      } else {
        resolve(stat.mtime)
      }
    })
  })
}

const createChangedAsyncShield = (read, compare) => {
  let currentValuePromise = Promise.resolve(read())

  return () => {
    const nextValuePromise = Promise.resolve(read())
    return Promise.all([currentValuePromise, nextValuePromise]).then(([value, nextValue]) => {
      currentValuePromise = nextValuePromise
      return {
        shielded: compare(value, nextValue),
      }
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
