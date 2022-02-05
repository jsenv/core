/*
 * While working on jsenv the source files are used
 * When a project uses jsenv, it will use the build files from dist
 */

import { urlToRelativeUrl } from "@jsenv/filesystem"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import {
  COMPILE_PROXY_DIST_URL,
  EVENT_SOURCE_CLIENT_DIST_URL,
  BROWSER_CLIENT_SYSTEMJS_DIST_URL,
  TOOLBAR_INJECTOR_DIST_URL,
  REDIRECTOR_DIST_URL,
} from "@jsenv/core/dist/build_manifest.js"
import { injectQuery } from "@jsenv/core/src/internal/url_utils.js"

export const createJsenvFileSelector = ({
  projectDirectoryUrl,
  jsenvCorePackageVersion,
}) => {
  const select = (files, { canUseScriptTypeModule = false } = {}) => {
    const preferSource = projectDirectoryUrl === jsenvCoreDirectoryUrl
    if (preferSource && canUseScriptTypeModule && files.source) {
      return {
        selected: "source",
        urlRelativeToProject: `/${urlToRelativeUrl(
          files.source,
          projectDirectoryUrl,
        )}`,
      }
    }
    const selected =
      canUseScriptTypeModule && files.dist_module
        ? "dist_module"
        : "dist_classic"
    const fileUrl = files[selected]
    const fileUrlVersioned = injectQuery(fileUrl, {
      version: jsenvCorePackageVersion,
    })
    return {
      selected,
      urlRelativeToProject: `/${urlToRelativeUrl(
        fileUrlVersioned,
        projectDirectoryUrl,
      )}`,
    }
  }

  return { select }
}

export const redirectorFiles = {
  source: new URL(
    "./src/internal/redirector/redirector.html",
    jsenvCoreDirectoryUrl,
  ),
  dist_classic: REDIRECTOR_DIST_URL,
}

export const compileProxyFiles = {
  source: new URL(
    "./src/internal/features/browser_feature_detection/compile_proxy.html",
    jsenvCoreDirectoryUrl,
  ),
  // for this one therw won't be a module version
  dist_classic: COMPILE_PROXY_DIST_URL,
}

export const eventSourceClientFiles = {
  source: new URL(
    "./src/internal/dev_server/event_source_client/event_source_client.js",
    jsenvCoreDirectoryUrl,
  ),
  // dist_module: '', // not yet available but will be soon
  dist_classic: EVENT_SOURCE_CLIENT_DIST_URL,
}

export const browserClientFiles = {
  source: new URL(
    "./src/internal/browser_client/module/browser_client_module.js",
    jsenvCoreDirectoryUrl,
  ),
  dist_classic: BROWSER_CLIENT_SYSTEMJS_DIST_URL,
}

export const toolbarInjectorFiles = {
  source: new URL(
    "./src/internal/dev_server/toolbar/toolbar_injector.js",
    jsenvCoreDirectoryUrl,
  ),
  dist_classic: TOOLBAR_INJECTOR_DIST_URL,
}
