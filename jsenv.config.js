import { getBabelPluginMapForNode } from "@jsenv/core"

export const projectDirectoryUrl = String(new URL("./", import.meta.url))

export const babelPluginMap = getBabelPluginMapForNode()
