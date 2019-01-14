import path from "path"
import fs from "fs"
import sequence from "promise-sequential"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"

export { fileWriteFromString }

export const readFile = (location) => {
  return new Promise((resolve, reject) => {
    fs.readFile(location, (error, buffer) => {
      if (error) {
        reject(error)
      } else {
        resolve(String(buffer))
      }
    })
  })
}

export const copyFile = (from, to) => {
  return new Promise((resolve, reject) => {
    fs.copyFile(from, to, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export const symlink = (from, to) => {
  return new Promise((resolve, reject) => {
    fs.symlink(from, to, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export const compileResultToFileSysten = ({ code, map }, filename) => {
  if (map) {
    const sourceMapBasename = `${path.basename(filename)}.map`
    code = `${code}
${"//#"} sourceMappingURL=${sourceMapBasename}`
    const sourceMapFilename = `${path.dirname(filename)}/${sourceMapBasename}`

    return Promise.all([
      fileWriteFromString(filename, code),
      fileWriteFromString(sourceMapFilename, JSON.stringify(map, null, "  ")),
    ]).then(() => ({
      code,
      map,
    }))
  }

  return fileWriteFromString(filename, code).then(() => ({ code, map }))
}

export const stat = (location) => {
  return new Promise((resolve, reject) => {
    fs.stat(location, (error, stat) => {
      if (error) {
        reject(error)
      } else {
        resolve(stat)
      }
    })
  })
}

export const listDirectoryContent = (location) => {
  return new Promise((resolve, reject) => {
    fs.readdir(location, (error, ressourceNames) => {
      if (error) {
        reject(error)
      } else {
        resolve(ressourceNames)
      }
    })
  })
}

export const fileToReadableStream = (file) => {
  return fs.createReadStream(file)
}

export const removeFile = (location) => {
  return new Promise((resolve, reject) => {
    fs.unlink(location, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

const getFileLStat = (path) => {
  return new Promise((resolve, reject) => {
    fs.lstat(path, (error, lstat) => {
      if (error) {
        reject({ status: 500, statusText: error.code })
      } else {
        resolve(lstat)
      }
    })
  })
}

const createFolder = (folder) => {
  return new Promise((resolve, reject) => {
    fs.mkdir(folder, (error) => {
      if (error) {
        // au cas ou deux script essayent de crée un dossier peu importe qui y arrive c'est ok
        if (error.code === "EEXIST") {
          getFileLStat(folder).then((stat) => {
            if (stat.isDirectory()) {
              resolve()
            } else {
              reject({ status: 500, statusText: "expect a directory" })
            }
          })
        } else {
          reject({ status: 500, statusText: error.code })
        }
      } else {
        resolve()
      }
    })
  })
}

// nodejs 10.12.0 https://nodejs.org/api/fs.html#fs_fs_mkdir_path_options_callback
// export const ensureFolderLeadingTo = (file) => {
//   return new Promise((resolve, reject) => {
//     fs.mkdir(path.dirname(file), { resurcive: true }, (error) => {
//       if (error) {
//         if (error.code === "EEXIST") {
//           resolve()
//           return
//         }
//         reject(error)
//         return
//       }
//       resolve()
//     })
//   })
// }

export const ensureFolderLeadingTo = (file) => {
  const fileNormalized = normalizeSeparation(file)
  // remove first / in case path starts with / (linux)
  // because it would create a "" entry in folders array below
  // tryig to create a folder at ""
  const fileStartsWithSlash = fileNormalized[0] === "/"
  const pathname = fileStartsWithSlash ? fileNormalized.slice(1) : fileNormalized
  const folders = pathname.split("/")
  folders.pop()

  return sequence(
    folders.map((_, index) => {
      return () => {
        const folder = folders.slice(0, index + 1).join("/")
        return createFolder(`${fileStartsWithSlash ? "/" : ""}${folder}`)
      }
    }),
  )
}

const normalizeSeparation = (file) => file.replace(/\\/g, "/")
