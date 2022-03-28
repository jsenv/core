// it's a bit strange to serve a file that is not part of the user codebase
// for me a better solution would be to recommend people to copy-paste
// the explorer.html as their index.html file

export const jsenvPluginExplorer = () => {
  return {
    name: "jsenv:explorer",
    appliesDuring: {
      dev: true,
    },
  }
}
