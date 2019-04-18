// const rootHref = `file://${projectFolder}`

// const filenameRelative = ressource.slice(1)
// const href = await locate({ origin, rootHref, filenameRelative })

// if (!href) {
//   return {
//     status: 404,
//   }
// }

// // redirection to other origin
// if (hrefToOrigin(href) !== hrefToOrigin(rootHref)) {
//   return {
//     status: 307,
//     headers: {
//       location: href,
//     },
//   }
// }

// if (href.startsWith(`${rootHref}/`)) {
//   // redirection to same origin
//   const resolvedFilename = href.slice(`${rootHref}/`.length)
//   if (resolvedFilename !== filenameRelative) {
//     return {
//       status: 307,
//       headers: {
//         location: `${origin}/${resolvedFilename}`,
//       },
//     }
//   }
// }

// const filename = hrefToPathname(href)
