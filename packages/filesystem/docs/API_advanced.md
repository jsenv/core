An documentation for exported function that are for advanced use case.

# grantPermissionsOnEntry

_grantPermissionsOnEntry_ is an async function granting permission on a given file system node. It returns an async function restoring the previous permissions.

> Do not use on Windows because of [file permissions caveat](#file-permissions-and-windows)

```js
import { grantPermissionsOnEntry } from "@jsenv/filesystem"

const restorePermissions = await grantPermissionsOnEntry("file:///file.js", {
  execute: true,
})
await restorePermissions()
```

# readEntryPermissions

_readEntryPermissions_ is an async function returning an object representing the permissions of a given filesystem node.

> Do not use on Windows because of [file permissions caveat](#file-permissions-and-windows)

```js
import { readEntryPermissions } from "@jsenv/filesystem"

const permissions = await readEntryPermissions("file:///directory/file.js")
```

# testEntryPermissions

_testEntryPermissions_ is an async function returning a boolean indicating if current user has read/write/execute permission on the filesystem node.

> Do not use on Windows because of [file permissions caveat](#file-permissions-and-windows)

```js
import { testEntryPermissions } from "@jsenv/filesystem"

const allowed = await testEntryPermissions("file:///file.js", {
  execute: true,
})
```

# writeEntryPermissions

_writeEntryPermissions_ is an async function setting the permissions of a filesystem node.

> Do not use on Windows because of [file permissions caveat](#file-permissions-and-windows)

```js
import { writeEntryPermissions } from "@jsenv/filesystem"

await writeEntryPermissions("file:///directory/file.js", {
  owner: { read: true, write: true, execute: true },
  group: { read: true, write: true, execute: false },
  others: { read: true, write: false, execute: false },
})
```

# File permissions and Windows

File permissions, read/write/execute, is a concept from Linux also available on MacOS. For this reason you cannot use the following functions on Windows:

- [grantPermissionsOnEntry](#grantPermissionsOnEntry)
- [readEntryPermissions](#readEntryPermissions)
- [testEntryPermissions](#testEntryPermissions)
- [writeEntryPermissions](#writeEntryPermissions)

This limitation is inherited from Node.js. The following paragraph is quoted from Node.js documentation

> Caveats: on Windows only the write permission can be changed, and the distinction among the permissions of group, owner or others is not implemented.

In other words it's unusable on Windows. In the end working with file permission is not common, you certainly don't need them.

— See [File modes documentation on Node.js](https://nodejs.org/dist/latest-v15.x/docs/api/fs.html#fs_fs_chmodsync_path_mode)
