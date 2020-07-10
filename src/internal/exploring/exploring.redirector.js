import { fetchUrl } from "../fetch-browser.js"
import { fetchExploringJson } from "./fetchExploringJson.js"
import { computeCompileIdFromGroupId } from "../runtime/computeCompileIdFromGroupId.js"
import { resolveBrowserGroup } from "../runtime/resolveBrowserGroup.js"

const redirect = async () => {
  const { outDirectoryRelativeUrl, exploringHtmlFileRelativeUrl } = await fetchExploringJson()
  const compileId = await decideCompileId({ outDirectoryRelativeUrl })

  const exploringIndexHtmlFileUrl = `/${outDirectoryRelativeUrl}${compileId}/${exploringHtmlFileRelativeUrl}`
  window.location.href = exploringIndexHtmlFileUrl
}

const decideCompileId = async ({ outDirectoryRelativeUrl }) => {
  const compileServerGroupMapUrl = `/${outDirectoryRelativeUrl}groupMap.json`
  const compileServerGroupMapResponse = await fetchUrl(compileServerGroupMapUrl)
  const compileServerGroupMap = await compileServerGroupMapResponse.json()

  const compileId = computeCompileIdFromGroupId({
    groupId: resolveBrowserGroup(compileServerGroupMap),
    groupMap: compileServerGroupMap,
  })
  return compileId
}

redirect()
