export const pageErrorNavigation = {
  name: "error-navigation",

  match: ({ event }) => {
    return event.type === "error-navigation"
  },

  navigate: async ({ event }) => {
    const element = document.querySelector(`[data-page="error-navigation"`).cloneNode(true)

    element.innerHTML = `
Error during navigation to ${event.data.route.name} page.

<pre>
${event.data.error.stack}
</pre>
`
    return {
      element,
    }
  },
}
