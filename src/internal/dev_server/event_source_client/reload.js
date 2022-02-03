export const reloadPage = () => {
  window.parent.location.reload(true)
}

export const reloadAllCss = () => {
  const links = Array.from(window.parent.document.getElementsByTagName("link"))
  links.forEach((link) => {
    if (link.rel === "stylesheet") {
      const url = new URL(link.href)
      url.searchParams.set("t", Date.now())
      link.href = String(url)
    }
  })
}
