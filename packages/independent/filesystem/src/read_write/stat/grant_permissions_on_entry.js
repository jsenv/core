import { assertAndNormalizeFileUrl } from "../../path_and_url/file_url_validation.js";
import { readEntryPermissions } from "./read_entry_permissions.js";
import { writeEntryPermissions } from "./write_entry_permissions.js";

export const grantPermissionsOnEntry = async (
  source,
  { read = false, write = false, execute = false },
) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);

  const filePermissions = await readEntryPermissions(sourceUrl);
  await writeEntryPermissions(sourceUrl, {
    owner: { read, write, execute },
    group: { read, write, execute },
    others: { read, write, execute },
  });
  return async () => {
    await writeEntryPermissions(sourceUrl, filePermissions);
  };
};
