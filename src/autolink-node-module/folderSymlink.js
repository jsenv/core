import { symlink } from "fs"

// https://nodejs.org/docs/latest/api/fs.html#fs_fs_symlink_target_path_type_callback
export const folderSymlink = ({ sourceFolder, link }) => {
  return new Promise((resolve, reject) => {
    symlink(
      sourceFolder,
      link,
      {
        type: "dir",
      },
      (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      },
    )
  })
}
