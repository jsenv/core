const rimraf = import.meta.require("rimraf")

export const removeFolder = (foldername) =>
  new Promise((resolve, reject) =>
    rimraf(foldername, (error) => {
      if (error) reject(error)
      else resolve()
    }),
  )
