// this file launches a webkit brwoser, useful to test if exploring works on wekbit

import { createRequire } from "module"

const require = createRequire(import.meta.url)

const { webkit } = require("playwright")

webkit.launch({ headless: false })
