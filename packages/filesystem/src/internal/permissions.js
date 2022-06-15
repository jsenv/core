// https://github.com/coderaiser/cloudcmd/issues/63#issuecomment-195478143
// https://nodejs.org/api/fs.html#fs_file_modes
// https://github.com/TooTallNate/stat-mode

// cannot get from fs.constants because they are not available on windows
const S_IRUSR = 256 /* 0000400 read permission, owner */
const S_IWUSR = 128 /* 0000200 write permission, owner */
const S_IXUSR = 64 /* 0000100 execute/search permission, owner */
const S_IRGRP = 32 /* 0000040 read permission, group */
const S_IWGRP = 16 /* 0000020 write permission, group */
const S_IXGRP = 8 /* 0000010 execute/search permission, group */
const S_IROTH = 4 /* 0000004 read permission, others */
const S_IWOTH = 2 /* 0000002 write permission, others */
const S_IXOTH = 1 /* 0000001 execute/search permission, others */

/*
here we could warn that on windows only 0o444 or 0o666 will work

0o444 (readonly)
{
  owner: {read: true, write: false, execute: false},
  group: {read: true, write: false, execute: false},
  others: {read: true, write: false, execute: false},
}

0o666 (read and write)
{
  owner: {read: true, write: true, execute: false},
  group: {read: true, write: true, execute: false},
  others: {read: true, write: true, execute: false},
}
*/
export const binaryFlagsToPermissions = (binaryFlags) => {
  const owner = {
    read: Boolean(binaryFlags & S_IRUSR),
    write: Boolean(binaryFlags & S_IWUSR),
    execute: Boolean(binaryFlags & S_IXUSR),
  }

  const group = {
    read: Boolean(binaryFlags & S_IRGRP),
    write: Boolean(binaryFlags & S_IWGRP),
    execute: Boolean(binaryFlags & S_IXGRP),
  }

  const others = {
    read: Boolean(binaryFlags & S_IROTH),
    write: Boolean(binaryFlags & S_IWOTH),
    execute: Boolean(binaryFlags & S_IXOTH),
  }

  return {
    owner,
    group,
    others,
  }
}

export const permissionsToBinaryFlags = ({ owner, group, others }) => {
  let binaryFlags = 0

  if (owner.read) binaryFlags |= S_IRUSR
  if (owner.write) binaryFlags |= S_IWUSR
  if (owner.execute) binaryFlags |= S_IXUSR

  if (group.read) binaryFlags |= S_IRGRP
  if (group.write) binaryFlags |= S_IWGRP
  if (group.execute) binaryFlags |= S_IXGRP

  if (others.read) binaryFlags |= S_IROTH
  if (others.write) binaryFlags |= S_IWOTH
  if (others.execute) binaryFlags |= S_IXOTH

  return binaryFlags
}
