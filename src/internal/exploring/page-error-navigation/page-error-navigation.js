export const pageErrorNavigation = {
  name: "error-navigation",

  match: ({ event }) => {
    return event.type === "error-navigation"
  },

  navigate: ({ event }) => {
    return {
      // title: "Error", // Keep the original error title ?
      load: () => {
        const pageElement = document.querySelector(`[data-page="error-navigation"`).cloneNode(true)

        const title = pageElement.querySelector("h1")
        title.textContent = `Error during navigation to ${event.data.route.name} page.`

        const pre = pageElement.querySelector("pre")
        const { error } = event.data
        pre.textContent = error.stack || error

        return {
          pageElement,
        }
      },
    }
  },
}
