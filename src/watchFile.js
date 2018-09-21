import { createSignal } from "@dmail/signal"
import fs from "fs"
import { memoizeSync } from "./memoize.js"

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

const guardAsync = (fn, shield) => (...args) => {
  return Promise.resolve()
    .then(() => shield(...args))
    .then((shielded) => (shielded ? undefined : fn(...args)))
}

const createChangedAsyncShield = ({ value, get, compare }) => {
  let lastValue

  return () => {
    return Promise.all([
      lastValue === undefined ? value : lastValue,
      Promise.resolve().then(get),
    ]).then(([previousValue, value]) => {
      lastValue = value
      return compare(previousValue, value)
    })
  }
}

const createWatchSignal = (url) => {
  // get mtime right now
  const mtime = getModificationDate(url)

  return createSignal({
    installer: ({ emit }) => {
      const shield = createChangedAsyncShield({
        value: mtime,
        get: () => getModificationDate(url),
        compare: (modificationDate, nextModificationDate) =>
          Number(modificationDate) !== Number(nextModificationDate),
      })

      const guardedEmit = guardAsync(emit, shield)
      // https://nodejs.org/docs/latest/api/fs.html#fs_fs_watch_filename_options_listener
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
