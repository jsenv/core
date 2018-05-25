import { createNodeLoader } from "@dmail/module-loader/src/node/index.js"

const System = createNodeLoader()

global.System = System

System.import(process.env.entry)
