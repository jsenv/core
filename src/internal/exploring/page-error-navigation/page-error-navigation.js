export const pageErrorNavigation = {
  name: "error-navigation",

  match: ({ event }) => {
    return event.type === "error-navigation"
  },

  navigate: async ({ event }) => {
    const element = document.querySelector(`[data-page="error-navigation"`).cloneNode(true)

    const title = element.querySelector("h1")
    title.textContent = `Error during navigation to ${event.data.route.name} page.`

    const pre = element.querySelector("pre")
    const { error } = event.data
    pre.textContent = error.stack || error

    return {
      element,
    }
  },
}
