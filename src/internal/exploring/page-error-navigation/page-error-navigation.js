export const errorNavigationRoute = {
  name: "error-navigation",

  load: ({ navigation }) => {
    const element = document
      .querySelector(`#page-templates [data-page="error-navigation"`)
      .cloneNode(true)

    const title = element.querySelector("h1")
    title.textContent = `Error during navigation to ${navigation.destinationUrl}.`

    const pre = element.querySelector("pre")
    pre.textContent = navigation.error.stack || navigation.error

    setTimeout(() => {
      throw navigation.error
    })

    return {
      // title: "Error", // Keep the original error title ?
      element,
    }
  },
}
