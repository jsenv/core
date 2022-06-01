#!/usr/bin/env node

// see https://docs.npmjs.com/cli/v8/commands/npm-init#description

import {
  existsSync,
  readdirSync,
  mkdirSync,
  statSync,
  copyFileSync,
  rmSync,
} from "node:fs"
import { basename, relative } from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"
import prompts from "prompts"

const directoryIsEmpty = (directoryUrl) => {
  const files = readdirSync(directoryUrl)
  return files.length === 0 || (files.length === 1 && files[0] === ".git")
}
const makeDirectoryEmpty = (directoryUrl) => {
  if (!existsSync(directoryUrl)) {
    return
  }
  for (const file of readdirSync(directoryUrl)) {
    rmSync(new URL(file, directoryUrl), { recursive: true, force: true })
  }
}
const copy = (fromUrl, toUrl) => {
  const stat = statSync(fromUrl)
  if (stat.isDirectory()) {
    copyDirectoryContent(new URL(`${fromUrl}/`), new URL(`${toUrl}/`))
  } else {
    copyFileSync(fromUrl, toUrl)
  }
}
const copyDirectoryContent = (fromUrl, toUrl) => {
  mkdirSync(toUrl, { recursive: true })
  for (const file of readdirSync(fromUrl)) {
    copy(new URL(file, fromUrl), new URL(file, toUrl))
  }
}

const argv = process.argv.slice(2)
const cwdUrl = `${pathToFileURL(process.cwd())}/`
let targetDirectory = argv[0]
const webVanilla = argv.includes("--web")
const webReact = argv.includes("--web-react")
const projectName = targetDirectory
  ? basename(targetDirectory.trim())
  : "jsenv-project"

const runPrompts = async () => {
  try {
    const result = await prompts(
      [
        {
          type: targetDirectory ? null : "text",
          name: "projectName",
          message: "Project name:",
          initial: projectName,
          onState: (state) => {
            targetDirectory =
              state.value.trim().replace(/\/+$/g, "") || projectName
          },
        },
        {
          type: () =>
            !existsSync(targetDirectory) || directoryIsEmpty(targetDirectory)
              ? null
              : "confirm",
          name: "overwrite",
          message: () => {
            const directoryLabel =
              targetDirectory === "."
                ? "Current directory"
                : `Target directory "${targetDirectory}"`
            return `${directoryLabel} is not empty. Remove existing files and continue?`
          },
        },
        {
          type: (_, { overwrite } = {}) => {
            if (overwrite === false) {
              throw new Error(`Operation cancelled`)
            }
            return null
          },
          name: "overwriteChecker",
        },
        {
          type: webVanilla || webReact ? null : "select",
          name: "template",
          message: "Select a template:",
          initial: 0,
          choices: [
            {
              title: "web",
              value: "web",
            },
            {
              title: "web-react",
              value: "web-react",
            },
          ],
        },
      ],
      {
        onCancel: () => {
          throw new Error(`Operation cancelled`)
        },
      },
    )
    return result
  } catch (cancelled) {
    return { cancelled }
  }
}

const createFilesFromTemplate = ({ overwrite, template }) => {
  const rootDirectoryUrl = new URL(`${targetDirectory}/`, cwdUrl)
  console.log(`\n  setup project in ${rootDirectoryUrl.href}`)
  if (overwrite) {
    makeDirectoryEmpty(rootDirectoryUrl)
  } else if (!existsSync(rootDirectoryUrl)) {
    mkdirSync(rootDirectoryUrl, { recursive: true })
  }

  const templateDirectoryUrl = new URL(
    `./template-${template}/`,
    import.meta.url,
  )
  console.log(`  create files from ${templateDirectoryUrl.href}`)
  const files = readdirSync(templateDirectoryUrl)
  for (const file of files) {
    const fromUrl = new URL(file, templateDirectoryUrl)
    const toUrl = new URL(
      file === "_gitignore" ? ".gitignore" : file,
      rootDirectoryUrl,
    )
    copy(fromUrl, toUrl)
  }

  console.log(`\nDone. Now run:\n`)
  if (rootDirectoryUrl.href !== cwdUrl.href) {
    console.log(
      `cd ${relative(fileURLToPath(cwdUrl), fileURLToPath(rootDirectoryUrl))}`,
    )
  }
  console.log(`npm install`)
  console.log(`npm run dev`)
}

const { cancelled, overwrite, template } = await runPrompts()
if (cancelled) {
  console.log(cancelled.message)
} else {
  createFilesFromTemplate({
    overwrite,
    template,
  })
}
