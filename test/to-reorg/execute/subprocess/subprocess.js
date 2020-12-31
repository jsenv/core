import { fork } from "child_process"
import { resolveUrl, urlToFileSystemPath } from "@jsenv/util"

const childFilePath = urlToFileSystemPath(resolveUrl("./child.cjs", import.meta.url))
const child = fork(childFilePath, { execArgv: [] })
console.log(`child forked, pid: ${child.pid}`)
