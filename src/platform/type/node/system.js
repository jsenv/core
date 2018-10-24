import https from "https"
import fetch from "node-fetch"
import EventSource from "eventsource"
import { createNodeSystem } from "@dmail/module-loader"
import { valueInstall } from "./valueInstall.js"

export const install = ({ isRemoteCompiledFile, remoteCompiledFileToLocalCompiledFile }) => {
  const urlToFilename = (url) => {
    return isRemoteCompiledFile(url) ? remoteCompiledFileToLocalCompiledFile(url) : url
  }

  const nodeSystem = createNodeSystem({ urlToFilename })

  const uninstallRejectUnauthorized = valueInstall(
    https.globalAgent.options,
    "rejectUnauthorized",
    false,
  )
  const uninstallFetch = valueInstall(global, "fetch", fetch)
  const uninstallSystem = valueInstall(global, "System", nodeSystem)
  const uninstallEventSource = valueInstall(global, "EventSource", EventSource)

  return () => {
    uninstallRejectUnauthorized()
    uninstallFetch()
    uninstallSystem()
    uninstallEventSource()
  }
}
