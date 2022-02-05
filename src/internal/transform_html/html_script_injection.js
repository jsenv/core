/*
 * While working on jsenv the source files are used
 * When a project uses jsenv, it will use the build files from dist
 */

import { urlToRelativeUrl } from "@jsenv/filesystem"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import {
  EVENT_SOURCE_CLIENT_BUILD_URL,
  BROWSER_CLIENT_BUILD_URL,
  TOOLBAR_INJECTOR_BUILD_URL,
} from "@jsenv/core/dist/build_manifest.js"
import { injectQuery } from "@jsenv/core/src/internal/url_utils.js"

export const getScriptsToInject = ({
  projectDirectoryUrl,
  jsenvCorePackageVersion,
  moduleOutFormat,

  eventSourceClient,
  browserClient,
  toolbar,
}) => {
  const scriptInjections = []
  if (eventSourceClient) {
    const eventSourceClientScript = getScriptToInject({
      projectDirectoryUrl,
      jsenvCorePackageVersion,
      moduleOutFormat,
      scripts: eventSourceClientScripts,
    })
    scriptInjections.push(eventSourceClientScript)
  }
  if (browserClient) {
    const browserClientScript = getScriptToInject({
      projectDirectoryUrl,
      jsenvCorePackageVersion,
      moduleOutFormat,
      scripts: browserClientScripts,
    })
    scriptInjections.push(browserClientScript)
  }
  if (toolbar) {
    const toolbarScript = getScriptToInject({
      projectDirectoryUrl,
      jsenvCorePackageVersion,
      moduleOutFormat,
      scripts: toolbarInjectorScripts,
    })
    if (toolbarScript.type !== "module") {
      toolbarScript.defer = ""
      toolbarScript.async = ""
    }
    scriptInjections.push(toolbarScript)
  }
  return scriptInjections
}

const eventSourceClientScripts = {
  source: new URL(
    "./src/internal/dev_server/event_source_client/event_source_client.js",
    jsenvCoreDirectoryUrl,
  ),
  // dist_module: '', // not yet available but will be soon
  dist_classic: EVENT_SOURCE_CLIENT_BUILD_URL,
}

const browserClientScripts = {
  source: new URL(
    "./src/internal/browser_client/browser_client.js",
    jsenvCoreDirectoryUrl,
  ),
  dist_classic: BROWSER_CLIENT_BUILD_URL,
}

const toolbarInjectorScripts = {
  source: new URL(
    "./src/internal/dev_server/toolbar/toolbar_injector.js",
    jsenvCoreDirectoryUrl,
  ),
  dist_classic: TOOLBAR_INJECTOR_BUILD_URL,
}

const getScriptToInject = ({
  projectDirectoryUrl,
  jsenvCorePackageVersion,

  compileProfile,
  scripts,
}) => {
  const scriptToUse = pickScript({
    projectDirectoryUrl,
    compileProfile,
    scripts,
  })
  const url = scripts[scriptToUse]
  if (scriptToUse === "source") {
    return {
      "type": "module",
      "src": `/${urlToRelativeUrl(url, projectDirectoryUrl)}`,
      "data-injected": true,
    }
  }
  const urlVersioned = injectQuery(url, { version: jsenvCorePackageVersion })
  const src = `/${urlToRelativeUrl(urlVersioned, projectDirectoryUrl)}`
  if (scriptToUse === "dist_module") {
    return {
      "type": "module",
      src,
      "data-injected": true,
    }
  }
  return {
    src,
    "data-injected": true,
  }
}

const pickScript = ({ projectDirectoryUrl, moduleOutFormat, scripts }) => {
  // prefer source files while working on jsenv
  const preferSource = projectDirectoryUrl === jsenvCoreDirectoryUrl
  const canUseModule = moduleOutFormat === "esmodule"
  if (preferSource && canUseModule && scripts.source) {
    return "source"
  }
  if (canUseModule && scripts.dist_module) {
    return "dist_module"
  }
  return "dist_classic"
}
