import { createNodeLoader } from "@dmail/module-loader/src/node/index.js"

const System = createNodeLoader({ base: process.env.location })

global.System = System

System.import(process.env.entry)
