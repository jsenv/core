import { writeFile as writeFileNode } from "node:fs"

import { assertAndNormalizeFileUrl } from "./file_url_validation.js"
import { ensureParentDirectories } from "./ensureParentDirectories.js"

export const writeFile = async (destination, content = "") => {
  const destinationUrl = assertAndNormalizeFileUrl(destination)
  const destinationUrlObject = new URL(destinationUrl)
  try {
    await writeFileNaive(destinationUrlObject, content)
  } catch (error) {
    if (error.code === "ENOENT") {
      await ensureParentDirectories(destinationUrl)
      await writeFileNaive(destinationUrlObject, content)
      return
    }
    throw error
  }
}

const writeFileNaive = (urlObject, content) => {
  return new Promise((resolve, reject) => {
    writeFileNode(urlObject, content, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}
