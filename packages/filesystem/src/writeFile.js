import { promises } from "node:fs"

import { assertAndNormalizeFileUrl } from "./assertAndNormalizeFileUrl.js"
import { ensureParentDirectories } from "./ensureParentDirectories.js"

// https://nodejs.org/dist/latest-v13.x/docs/api/fs.html#fs_fspromises_writefile_file_data_options
const { writeFile: writeFileNode } = promises

export const writeFile = async (destination, content = "") => {
  const destinationUrl = assertAndNormalizeFileUrl(destination)
  const destinationUrlObject = new URL(destinationUrl)
  try {
    await writeFileNode(destinationUrlObject, content)
  } catch (error) {
    if (error.code === "ENOENT") {
      await ensureParentDirectories(destinationUrl)
      await writeFileNode(destinationUrlObject, content)
      return
    }
    throw error
  }
}
