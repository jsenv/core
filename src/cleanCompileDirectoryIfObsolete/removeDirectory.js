const rimraf = import.meta.require("rimraf")

export const removeDirectory = (path) =>
  new Promise((resolve, reject) =>
    rimraf(path, (error) => {
      if (error) reject(error)
      else resolve()
    }),
  )
