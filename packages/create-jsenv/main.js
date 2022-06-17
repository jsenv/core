#!/usr/bin/env node

// see https://docs.npmjs.com/cli/v8/commands/npm-init#description

import {
  existsSync,
  readdirSync,
  mkdirSync,
  statSync,
  copyFileSync,
  rmSync,
  readFileSync,
  writeFileSync,
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

const cwdUrl = `${pathToFileURL(process.cwd())}/`

const getParamsFromProcessArgsAndPrompts = async () => {
  const argv = process.argv.slice(2)
  const directoryArg = argv[0] ? argv[0].trim() : ""
  let directoryUrl = directoryArg ? new URL(`${directoryUrl}/`, cwdUrl) : null
  const webVanilla = argv.includes("--web")
  const webReact = argv.includes("--web-react")
  const webPreact = argv.includes("--web-preact")

  try {
    const demoDirectoryName = directoryUrl
      ? basename(fileURLToPath(directoryUrl))
      : "jsenv-demo"

    const result = await prompts(
      [
        {
          type: directoryUrl ? null : "text",
          name: "directoryUrl",
          message: "directory path:",
          initial: demoDirectoryName,
          onState: (state) => {
            const value =
              state.value.trim().replace(/\/+$/g, "") || demoDirectoryName
            directoryUrl = new URL(`${value}/`, cwdUrl)
          },
        },
        {
          type: () => {
            if (existsSync(directoryUrl) && !directoryIsEmpty(directoryUrl)) {
              return "confirm"
            }
            return null
          },
          name: "overwrite",
          message: () => {
            const directoryLabel =
              directoryUrl.href === cwdUrl.href
                ? "Current directory"
                : `Target directory "${fileURLToPath(directoryUrl)}"`
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
          type: webVanilla || webReact || webPreact ? null : "select",
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
            {
              title: "web-preact",
              value: "web-preact",
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
    return {
      ...result,
      directoryUrl,
    }
  } catch (cancelled) {
    return { cancelled }
  }
}

const createFilesFromTemplate = ({ directoryUrl, overwrite, template }) => {
  console.log(`\n  setup project in ${directoryUrl.href}`)
  if (overwrite) {
    makeDirectoryEmpty(directoryUrl)
  } else if (!existsSync(directoryUrl)) {
    mkdirSync(directoryUrl, { recursive: true })
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
      directoryUrl,
    )
    copy(fromUrl, toUrl)
    if (file === "package.json") {
      const packageJsonFileContent = readFileSync(toUrl, { encoding: "utf8" })
      const packageJsonObject = JSON.parse(packageJsonFileContent)
      const visitPackageMappings = (packageMappings) => {
        if (packageMappings) {
          Object.keys(packageMappings).forEach((packageName) => {
            const packageVersion = packageMappings[packageName]
            if (packageVersion.startsWith("../")) {
              // resolve it and put the exact version
              const packageDirectoryUrl = new URL(packageVersion, fromUrl)
              const packageFileUrl = new URL(
                "package.json",
                packageDirectoryUrl,
              )
              const packageObject = JSON.parse(
                readFileSync(packageFileUrl, { encoding: "utf8" }),
              )
              packageMappings[packageName] = packageObject.version
            }
          })
        }
      }
      visitPackageMappings(packageJsonObject.dependencies)
      visitPackageMappings(packageJsonObject.devDependencies)
      visitPackageMappings(packageJsonObject.peerDependencies)
      writeFileSync(toUrl, JSON.stringify(packageJsonObject, null, "  "))
    }
  }

  console.log(`\nDone. Now run:\n`)
  if (directoryUrl.href !== cwdUrl.href) {
    console.log(
      `cd ${relative(fileURLToPath(cwdUrl), fileURLToPath(directoryUrl))}`,
    )
  }
  console.log(`npm install`)
  console.log(`npm run dev`)
}

const { cancelled, directoryUrl, overwrite, template } =
  await getParamsFromProcessArgsAndPrompts()
if (cancelled) {
  console.log(cancelled.message)
} else {
  createFilesFromTemplate({
    directoryUrl,
    overwrite,
    template,
  })
}
