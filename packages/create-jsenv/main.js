#!/usr/bin/env node

// see https://docs.npmjs.com/cli/v8/commands/npm-init#description

import {
  existsSync,
  readdirSync,
  mkdirSync,
  statSync,
  copyFileSync,
} from "node:fs"
import { relative } from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"
import prompts from "prompts"

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
const getParamsFromProcessAndPrompts = async () => {
  const argv = process.argv.slice(2)
  // not using readdir to control order
  const availableDemoNames = ["web", "web-react", "web-preact", "node-package"]
  let demoName = availableDemoNames.find((demoNameCandidate) =>
    argv.includes(`--${demoNameCandidate}`),
  )
  let cancelled = false
  await new Promise((resolve, reject) => {
    prompts(
      [
        {
          type: demoName ? null : "select",
          name: "demoName",
          message: "Select a demo:",
          initial: 0,
          choices: availableDemoNames.map((demoName) => {
            return { title: demoName, value: demoName }
          }),
          onState: (state) => {
            demoName = state.value
          },
        },
      ],
      {
        onCancel: () => {
          cancelled = true
          resolve()
        },
      },
    ).then(resolve, reject)
  })
  if (cancelled) {
    return {
      cancelled,
    }
  }
  const demoSourceDirectoryUrl = new URL(`./demo-${demoName}/`, import.meta.url)
  const demoTargetDirectoryUrl = new URL(`jsenv-demo-${demoName}/`, cwdUrl)
  return {
    cancelled,
    demoName,
    demoSourceDirectoryUrl,
    demoTargetDirectoryUrl,
  }
}

const { cancelled, demoSourceDirectoryUrl, demoTargetDirectoryUrl } =
  await getParamsFromProcessAndPrompts()

if (cancelled) {
} else if (existsSync(demoTargetDirectoryUrl)) {
  console.log(`\n  directory exists at "${demoTargetDirectoryUrl.href}"`)
} else {
  console.log(
    `\n  copy "${demoSourceDirectoryUrl.href}" files into "${demoTargetDirectoryUrl.href}"`,
  )
  mkdirSync(demoTargetDirectoryUrl, { recursive: true })
  const files = readdirSync(demoSourceDirectoryUrl)
  for (const file of files) {
    const fromUrl = new URL(file, demoSourceDirectoryUrl)
    const toUrl = new URL(
      file === "_gitignore" ? ".gitignore" : file,
      demoTargetDirectoryUrl,
    )
    copy(fromUrl, toUrl)
  }
  console.log(`\nDone.`)
}

if (!cancelled) {
  console.log(`\nNow run:\n`)
  if (demoTargetDirectoryUrl.href !== cwdUrl.href) {
    console.log(
      `cd ${relative(
        fileURLToPath(cwdUrl),
        fileURLToPath(demoTargetDirectoryUrl),
      )}`,
    )
  }
  console.log(`npm install`)
  console.log(`npm run dev`)
}
