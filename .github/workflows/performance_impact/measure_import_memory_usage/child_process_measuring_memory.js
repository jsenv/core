/* eslint-disable no-unused-vars */
import { memoryUsage } from "process"

global.gc()
const beforeHeapUsed = memoryUsage().heapUsed

let namespace = await import(`../../../../main.js?t=${Date.now()}`)

const afterHeapUsed = memoryUsage().heapUsed

const heapUsed = afterHeapUsed - beforeHeapUsed

process.send({ heapUsed })

namespace = null
global.gc()
