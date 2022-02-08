/*
 * While working on jsenv the source files are used
 * When a project uses jsenv, it will use the build files from dist
 */

import { urlToRelativeUrl } from "@jsenv/filesystem"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import {
  COMPILE_PROXY_DIST_URL,
  EVENT_SOURCE_CLIENT_DIST_URL,
  HTML_SUPERVISOR_CLASSIC_DIST_URL,
  TOOLBAR_INJECTOR_DIST_URL,
  REDIRECTOR_DIST_URL,
} from "@jsenv/core/dist/build_manifest.js"
import { injectQuery } from "@jsenv/core/src/internal/url_utils.js"

export const createJsenvFileSelector = ({
  projectDirectoryUrl,
  jsenvCorePackageVersion,
}) => {
  const select = (files, { canUseScriptTypeModule = false } = {}) => {
    const fileType = selectFileType({
      projectDirectoryUrl,
      jsenvCoreDirectoryUrl,
      canUseScriptTypeModule,
      files,
    })
    const fileUrl = files[fileType]
    if (fileType === "source_module" || fileType === "source_classic") {
      return {
        selected: fileType,
        urlRelativeToProject: `/${urlToRelativeUrl(
          fileUrl,
          projectDirectoryUrl,
        )}`,
      }
    }
    const fileUrlVersioned = injectQuery(fileUrl, {
      version: jsenvCorePackageVersion,
    })
    return {
      selected: fileType,
      urlRelativeToProject: `/${urlToRelativeUrl(
        fileUrlVersioned,
        projectDirectoryUrl,
      )}`,
    }
  }

  return { select }
}

const selectFileType = ({
  projectDirectoryUrl,
  jsenvCoreDirectoryUrl,
  canUseScriptTypeModule,
  files,
}) => {
  const preferSource = projectDirectoryUrl === jsenvCoreDirectoryUrl
  if (preferSource && canUseScriptTypeModule && files.source_module) {
    return "source_module"
  }
  if (preferSource && files.source_classic) {
    return "source_classic"
  }
  if (canUseScriptTypeModule && files.dist_module) {
    return "dist_module"
  }
  if (files.dist_classic) {
    return "dist_classic"
  }
  return files[Object.keys(files)[0]]
}

export const redirectorFiles = {
  source_module: new URL(
    "./src/internal/redirector/redirector.html",
    jsenvCoreDirectoryUrl,
  ),
  dist_classic: REDIRECTOR_DIST_URL,
}

export const compileProxyFiles = {
  source_module: new URL(
    "./src/internal/features/browser_feature_detection/compile_proxy.html",
    jsenvCoreDirectoryUrl,
  ),
  // for this one therw won't be a module version
  dist_classic: COMPILE_PROXY_DIST_URL,
}

export const eventSourceClientFiles = {
  source_module: new URL(
    "./src/internal/event_source_client/event_source_client.js",
    jsenvCoreDirectoryUrl,
  ),
  // dist_module: '', // not yet available but will be soon
  dist_classic: EVENT_SOURCE_CLIENT_DIST_URL,
}

export const htmlSupervisorFiles = {
  source_module: new URL(
    "./src/internal/html_supervisor/module/html_supervisor_module.js",
    jsenvCoreDirectoryUrl,
  ),
  dist_module: HTML_SUPERVISOR_CLASSIC_DIST_URL,
}

export const htmlSupervisorSetupFiles = {
  source_classic: new URL(
    "./src/internal/html_supervisor/html_supervisor_setup.js",
    jsenvCoreDirectoryUrl,
  ),
}

export const toolbarInjectorFiles = {
  source_module: new URL(
    "./src/internal/toolbar/toolbar_injector.js",
    jsenvCoreDirectoryUrl,
  ),
  dist_classic: TOOLBAR_INJECTOR_DIST_URL,
}
