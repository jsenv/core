export const renderBackToListInToolbar = ({
  outDirectoryRelativeUrl,
  exploringHtmlFileRelativeUrl,
}) => {
  const exploringHtmlFileUrl = `/${outDirectoryRelativeUrl}otherwise/${exploringHtmlFileRelativeUrl}`

  document.querySelector("#file-list-link a").href = exploringHtmlFileUrl
  document.querySelector("#file-list-link a").onclick = (clickEvent) => {
    if (clickEvent.defaultPrevented) {
      return
    }

    if (isClickToOpenTab(clickEvent)) {
      return
    }

    window.parent.location.href = exploringHtmlFileUrl
  }
}

const isClickToOpenTab = (clickEvent) => {
  if (clickEvent.button !== 0) {
    // Chrome < 55 fires a click event when the middle mouse button is pressed
    return true
  }
  if (clickEvent.metaKey) {
    return true
  }
  if (clickEvent.ctrlKey) {
    return true
  }
  return false
}
