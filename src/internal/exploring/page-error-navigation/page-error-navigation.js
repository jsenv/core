export const pageErrorNavigation = {
  name: "error-navigation",

  activate: ({ url }, error) => {
    const element = document
      .querySelector(`#page-templates [data-page="error-navigation"`)
      .cloneNode(true)

    const title = element.querySelector("h1")
    title.textContent = `Error during navigation to ${url}`

    const pre = element.querySelector("pre")
    pre.textContent = error.stack || error

    setTimeout(() => {
      throw error
    })

    return {
      // title: "Error", // Keep the original error title ?
      element,
    }
  },
}
