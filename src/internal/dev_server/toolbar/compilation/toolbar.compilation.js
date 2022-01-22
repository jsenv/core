import { scanBrowserRuntimeFeatures } from "../../../features/browser_feature_detection/browser_feature_detection.js"
import { removeForceHideElement } from "../util/dom.js"
import { enableVariant } from "../variant/variant.js"

export const renderCompilationInToolbar = ({ compileGroup }) => {
  const browserSupportRootNode = document.querySelector("#browser_support")
  const filesCompilationRootNode = document.querySelector("#files_compilation")

  removeForceHideElement(browserSupportRootNode)
  removeForceHideElement(filesCompilationRootNode)

  scanBrowserRuntimeFeatures().then(
    ({
      jsenvDirectoryRelativeUrl,
      inlineImportMapIntoHTML,
      compileProfile,
      compileId,
    }) => {
      const browserSupport = compileId
        ? "no"
        : inlineImportMapIntoHTML
        ? "partial"
        : "full"
      enableVariant(browserSupportRootNode, {
        browserSupport,
      })
      if (browserSupport === "no") {
        browserSupportRootNode.querySelector(
          `a.browser_support_read_more_link`,
        ).onclick = () => {
          // eslint-disable-next-line no-alert
          window.alert(
            `Source files needs to be compiled to be executable in this browser because: ${listWhatIsMissing(
              {
                compileProfile,
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
            `Source files (except html) can be executed directly in this browser because: ${listWhatIsSupported(
              {
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
            `Source files can be executed directly in this browser because: ${listWhatIsSupported(
              {
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
          window.parent.location = `/${jsenvDirectoryRelativeUrl}${compileId}/${compileGroup.fileRelativeUrl}`
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

const listWhatIsSupported = ({ inlineImportMapIntoHTML }) => {
  const parts = []
  if (inlineImportMapIntoHTML) {
    parts.push(`importmaps are supported (only when inlined in html files)`)
  } else {
    parts.push(`importmaps are supported`)
  }
  parts.push(`dynamic imports are supported`)
  parts.push(`top level await is supported`)
  parts.push(`all features are natively supported`)
  return `
- ${parts.join(`
- `)}`
}

const listWhatIsMissing = ({ compileProfile }) => {
  const parts = []
  const { missingFeatures } = compileProfile
  if (missingFeatures.importmap) {
    parts.push(`importmaps are not supported`)
  }
  if (missingFeatures.dynamicImport) {
    parts.push(`dynamic imports are not supported`)
  }
  if (missingFeatures.topLevelAwait) {
    parts.push(`top level await is not supported`)
  }
  const missingFeatureNames = Object.keys(missingFeatures).filter((name) => {
    return (
      name !== "importmap" &&
      name !== "dynamicImport" &&
      name !== "topLevelAwait" &&
      name !== "custom_compiler_patterns"
    )
  })
  const missingFeatureCount = missingFeatureNames.length
  if (missingFeatureCount > 0) {
    parts.push(
      `${missingFeatureCount} features are missing: ${missingFeatureNames}`,
    )
  }
  const { custom_compiler_patterns } = missingFeatures
  if (custom_compiler_patterns) {
    parts.push(
      `${custom_compiler_patterns.length} custom compilers enabled: ${custom_compiler_patterns}`,
    )
  }
  return `
- ${parts.join(`
- `)}`
}
