import { assert } from "@jsenv/assert"

import {
  ensureEmptyDirectory,
  resolveUrl,
  writeFile,
  removeEntry,
  writeDirectory,
  registerDirectoryLifecycle,
  writeEntryModificationTime,
} from "@jsenv/filesystem"
import { wait } from "@jsenv/filesystem/test/testHelpers.js"

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url)
await ensureEmptyDirectory(tempDirectoryUrl)

// file added
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl)
  const mutations = []
  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { "./file": "toto" },
    cooldownBetweenFileEvents: 150,
    // debug: true,
    added: (data) => {
      mutations.push({ name: "added", ...data })
    },
    updated: (data) => {
      mutations.push({ name: "updated", ...data })
    },
    keepProcessAlive: false,
  })

  await wait(200)
  await writeFile(fileUrl)
  await wait(200)
  await removeEntry(fileUrl)
  await wait(200)
  await writeFile(fileUrl)
  await wait(200)
  const actual = mutations
  const expected = [
    {
      name: "added",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "added",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
  ]
  assert({ actual, expected })
  unregister()
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// file added inside directory
{
  const directoryUrl = resolveUrl("dir", tempDirectoryUrl)
  const fileUrl = resolveUrl("dir/file", tempDirectoryUrl)
  const mutations = []
  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { "dir/": "toto" },
    cooldownBetweenFileEvents: 100,
    added: (data) => {
      mutations.push({ name: "added", ...data })
    },
    updated: (data) => {
      mutations.push({ name: "updated", ...data })
    },
    keepProcessAlive: false,
    recursive: true,
  })
  await writeDirectory(directoryUrl)
  await wait(200)
  await writeFile(fileUrl)
  await wait(200)

  const actual = mutations
  const expected = [
    {
      name: "added",
      relativeUrl: `dir`,
      type: "directory",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "added",
      relativeUrl: `dir/file`,
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
  ]
  assert({ actual, expected })
  unregister()
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// add, update, remove file
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl)
  const mutations = []
  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { file: "toto" },
    cooldownBetweenFileEvents: 100,
    added: (data) => {
      mutations.push({ name: "added", ...data })
    },
    updated: (data) => {
      mutations.push({ name: "updated", ...data })
    },
    removed: (data) => {
      mutations.push({ name: "removed", ...data })
    },
    keepProcessAlive: false,
  })
  await writeFile(fileUrl)
  await wait(200)
  await writeEntryModificationTime(fileUrl, Date.now())
  await wait(200)
  await removeEntry(fileUrl)
  await wait(200)

  const actual = mutations
  const expected = [
    {
      name: "added",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "updated",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
      previousMtime: actual[0].mtime,
    },
    {
      name: "removed",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
  ]
  assert({ actual, expected })
  unregister()
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// remove, add, remove a file
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl)
  const mutations = []
  await writeFile(fileUrl)

  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { file: "toto" },
    cooldownBetweenFileEvents: 100,
    updated: (data) => {
      mutations.push({ name: "updated", ...data })
    },
    removed: (data) => {
      mutations.push({ name: "removed", ...data })
    },
    keepProcessAlive: false,
  })
  await removeEntry(fileUrl)
  await wait(200)
  await writeFile(fileUrl)
  await wait(200)
  await removeEntry(fileUrl)
  await wait(200)
  const actual = mutations
  const expected = [
    {
      name: "removed",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "removed",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
  ]
  assert({ actual, expected })
  unregister()
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// remove inside directory
{
  const directoryUrl = resolveUrl("dir", tempDirectoryUrl)
  const fileUrl = resolveUrl("dir/file", tempDirectoryUrl)
  await writeDirectory(directoryUrl)
  await writeFile(fileUrl)
  const mutations = []

  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { "dir/": "toto" },
    cooldownBetweenFileEvents: 100,
    removed: (data) => {
      mutations.push({ name: "removed", ...data })
    },
    keepProcessAlive: false,
    recursive: true,
  })
  await removeEntry(fileUrl)
  await removeEntry(directoryUrl)
  await wait(200)
  await writeDirectory(directoryUrl)
  await writeFile(fileUrl)
  await wait(200)
  await removeEntry(fileUrl)
  await removeEntry(directoryUrl)
  await wait(200)
  const actual = mutations
  const expected = [
    {
      name: "removed",
      relativeUrl: "dir/file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "removed",
      relativeUrl: "dir",
      type: "directory",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "removed",
      relativeUrl: "dir/file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "removed",
      relativeUrl: "dir",
      type: "directory",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
  ]
  assert({ actual, expected })
  unregister()
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// update file
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl)
  await writeFile(fileUrl)
  const mutations = []

  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { file: "toto" },
    cooldownBetweenFileEvents: 100,
    updated: (data) => {
      mutations.push({ name: "updated", ...data })
    },
    keepProcessAlive: false,
  })
  await writeEntryModificationTime(fileUrl, Date.now())
  await wait(200)
  // file removed and created in between
  await removeEntry(fileUrl)
  await wait(200)
  await writeFile(fileUrl)
  await wait(200)
  await writeEntryModificationTime(fileUrl, Date.now() + 1000)
  await wait(200)
  const actual = mutations
  const expected = [
    {
      name: "updated",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
      previousMtime: assert.any(Number),
    },
    {
      name: "updated",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
      previousMtime: assert.any(Number),
    },
  ]
  assert({ actual, expected })
  unregister()
  await ensureEmptyDirectory(tempDirectoryUrl)
}

// update many
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl)
  await writeFile(fileUrl)
  await wait(200)
  const mutations = []

  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { file: "toto" },
    cooldownBetweenFileEvents: 100,
    updated: (data) => {
      mutations.push({ name: "updated", ...data })
    },
    keepProcessAlive: false,
  })
  await writeEntryModificationTime(fileUrl, Date.now())
  await wait(200)
  await writeEntryModificationTime(fileUrl, Date.now())
  await wait(200)
  await writeEntryModificationTime(fileUrl, Date.now())
  await wait(200)
  const actual = mutations
  const expected = [
    {
      name: "updated",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
      previousMtime: assert.any(Number),
    },
    {
      name: "updated",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
      previousMtime: actual[0].mtime,
    },
    {
      name: "updated",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
      previousMtime: actual[1].mtime,
    },
  ]
  assert({ actual, expected })
  unregister()
  await ensureEmptyDirectory(tempDirectoryUrl)
}
