export const renderBackToListInToolbar = () => {
  // sauf que ce ne sera pas toujours ça
  // c'est plutot quelque chose en dur qu'on récup du serveur je pense
  const href = window.parent.location.href

  document.querySelector("#file-list-link a").href = href
  document.querySelector("#file-list-link a").onclick = (clickEvent) => {
    if (clickEvent.defaultPrevented) {
      return
    }

    if (isClickToOpenTab(clickEvent)) {
      return
    }

    window.parent.location.href = href
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
