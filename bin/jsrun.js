#!/usr/bin/env node

import { getFromProcessArguments } from "./getFromProcessArguments.js"
import { run } from "../src/run/run.js"

// ce qu'on fera ptet pour rendre le truc generique c'4est utiliser un chemin de fichier absolu
// et en deduire root
const root = process.cwd()
const file = process.argv[1]
const port = getFromProcessArguments("port") || 0
const platform = getFromProcessArguments("platform") || "node"
const watch = getFromProcessArguments("watch") || false
const instrument = getFromProcessArguments("instrument") || false
const headless = getFromProcessArguments("headless") || false

run({
  root,
  file,
  port,
  platform,
  watch,
  instrument,
  headless,
})
