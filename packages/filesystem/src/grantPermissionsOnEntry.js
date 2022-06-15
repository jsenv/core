import { assertAndNormalizeFileUrl } from "./assertAndNormalizeFileUrl.js"
import { readEntryPermissions } from "./readEntryPermissions.js"
import { writeEntryPermissions } from "./writeEntryPermissions.js"

export const grantPermissionsOnEntry = async (
  source,
  { read = false, write = false, execute = false },
) => {
  const sourceUrl = assertAndNormalizeFileUrl(source)

  const filePermissions = await readEntryPermissions(sourceUrl)
  await writeEntryPermissions(sourceUrl, {
    owner: { read, write, execute },
    group: { read, write, execute },
    others: { read, write, execute },
  })
  return async () => {
    await writeEntryPermissions(sourceUrl, filePermissions)
  }
}
