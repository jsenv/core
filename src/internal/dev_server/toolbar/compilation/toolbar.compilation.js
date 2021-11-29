import { scanBrowserRuntimeFeatures } from "../../../runtime/createBrowserRuntime/scanBrowserRuntimeFeatures.js"
import { removeForceHideElement } from "../util/dom.js"
import { enableVariant } from "../variant/variant.js"

export const renderCompilationInToolbar = ({ compileGroup }) => {
  const browserSupportRootNode = document.querySelector("#browser_support")
  const filesCompilationRootNode = document.querySelector("#files_compilation")

  removeForceHideElement(browserSupportRootNode)
  removeForceHideElement(filesCompilationRootNode)

  scanBrowserRuntimeFeatures().then(
    ({
      canAvoidCompilation,
      featuresReport,
      customCompilerPatterns,
      pluginRequiredNameArray,
      inlineImportMapIntoHTML,
      outDirectoryRelativeUrl,
      compileId,
    }) => {
      const browserSupport = canAvoidCompilation
        ? inlineImportMapIntoHTML
          ? "partial"
          : "full"
        : "no"
      enableVariant(browserSupportRootNode, {
        browserSupport,
      })
      if (browserSupport === "no") {
        browserSupportRootNode.querySelector(
          `a.browser_support_read_more_link`,
        ).onclick = () => {
          // eslint-disable-next-line no-alert
          window.alert(
            `Source files needs to be compiled to be executable in this browser because: ${getBrowserSupportMessage(
              {
                missingOnly: true,
                featuresReport,
                customCompilerPatterns,
                pluginRequiredNameArray,
                inlineImportMapIntoHTML,
              },
            )}`,
          )
        }
      } else if (browserSupport === "partial") {
        browserSupportRootNode.querySelector(
          `a.browser_support_read_more_link`,
        ).onclick = () => {
          // eslint-disable-next-line no-alert
          window.alert(
            `Source files (except html) can be executed directly in this browser because: ${getBrowserSupportMessage(
              {
                featuresReport,
                customCompilerPatterns,
                pluginRequiredNameArray,
                inlineImportMapIntoHTML,
              },
            )}`,
          )
        }
      } else if (browserSupport === "full") {
        browserSupportRootNode.querySelector(
          `a.browser_support_read_more_link`,
        ).onclick = () => {
          // eslint-disable-next-line no-alert
          window.alert(
            `Source files can be executed directly in this browser because: ${getBrowserSupportMessage(
              {
                featuresReport,
                customCompilerPatterns,
                pluginRequiredNameArray,
                inlineImportMapIntoHTML,
              },
            )}`,
          )
        }
      }

      const filesCompilation = compileGroup.compileId
        ? "yes"
        : inlineImportMapIntoHTML
        ? "html_only"
        : "no"
      enableVariant(filesCompilationRootNode, {
        filesCompilation,
        compiled: compileGroup.compileId ? "yes" : "no",
      })
      filesCompilationRootNode.querySelector("a.go_to_source_link").onclick =
        () => {
          window.parent.location = `/${compileGroup.fileRelativeUrl}`
        }
      filesCompilationRootNode.querySelector("a.go_to_compiled_link").onclick =
        () => {
          window.parent.location = `/${outDirectoryRelativeUrl}${compileId}/${compileGroup.fileRelativeUrl}`
        }

      const shouldCompile =
        filesCompilation !== "yes" && browserSupport === "no"

      if (shouldCompile) {
        document
          .querySelector(".files_compilation_text")
          .setAttribute("data-warning", "")
        document
          .querySelector(".browser_support_text")
          .setAttribute("data-warning", "")
        document
          .querySelector("#settings-button")
          .setAttribute("data-warning", "")
      } else {
        document
          .querySelector(".files_compilation_text")
          .removeAttribute("data-warning")
        document
          .querySelector(".browser_support_text")
          .removeAttribute("data-warning")
        document
          .querySelector("#settings-button")
          .removeAttribute("data-warning")
      }
    },
  )
}

const getBrowserSupportMessage = ({
  missingOnly,
  featuresReport,
  customCompilerPatterns,
  pluginRequiredNameArray,
  inlineImportMapIntoHTML,
}) => {
  const parts = []

  if (featuresReport.importmap) {
    if (!missingOnly) {
      if (inlineImportMapIntoHTML) {
        parts.push(`importmaps are supported (only when inlined in html files)`)
      } else {
        parts.push(`importmaps are supported`)
      }
    }
  } else {
    parts.push(`importmaps are not supported`)
  }

  if (featuresReport.dynamicImport) {
    if (!missingOnly) {
      parts.push(`dynamic imports are supported`)
    }
  } else {
    parts.push(`dynamic imports are not supported`)
  }

  if (featuresReport.topLevelAwait) {
    if (!missingOnly) {
      parts.push(`top level await is supported`)
    }
  } else {
    parts.push(`top level await is not supported`)
  }

  const pluginRequiredCount = pluginRequiredNameArray.length
  if (pluginRequiredCount === 0) {
    if (!missingOnly) {
      parts.push(`all plugins are natively supported`)
    }
  } else {
    parts.push(
      `${pluginRequiredCount} plugins are mandatory: ${pluginRequiredNameArray}`,
    )
  }

  const customCompilerCount = customCompilerPatterns.length
  if (customCompilerCount === 0) {
    // no need to talk about something unused
  } else {
    parts.push(
      `${customCompilerCount} custom compilers enabled: ${customCompilerPatterns}`,
    )
  }

  return `
- ${parts.join(`
- `)}`
}
