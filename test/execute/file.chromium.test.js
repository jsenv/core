import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../src/ROOT_FOLDER.js"
import { execute, launchChromium } from "../../index.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`
const filenameRelative = `${testFolderRelative}/file.js`

const actual = await execute({
  projectFolder,
  compileInto,
  launch: launchChromium,
  filenameRelative,
  stopOnceExecuted: true,
})

assert({ actual, expected: { status: "completed" } })
