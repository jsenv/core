import { arrayWithoutDuplicate } from "@dmail/helper"

export const composeBabelPluginNameArray = (prevPluginList, pluginList) =>
  arrayWithoutDuplicate([...prevPluginList, ...pluginList]).sort()
