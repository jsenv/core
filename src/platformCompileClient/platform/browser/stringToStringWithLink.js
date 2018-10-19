export const link = (url, text = url) => `<a href="${url}">${text}</a>`

// `Error: yo
// at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
// at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
// at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
// at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
//   debugger
// })
export const stringToStringWithLink = (source) => {
  return source.replace(/(?:https?|ftp|file):\/\/.*?$/gm, (match) => {
    // remove lineNumber. columnNumber and possible last ) from url
    const url = match.replace(/(?::[0-9]+)?:[0-9]*\)?$/, "")
    // const sourceURL = url.replace(`${remoteRoot}/${remoteCompileDestination}`, remoteRoot)

    return link(url, match)
  })
}
