export const redirectBrowserPlatformToCompileServer = ({
  compileServerOrigin,
  request: { ressource },
}) => {
  if (ressource !== `/.jsenv/browser-platform.js`) return null

  return {
    status: 307,
    headers: {
      location: `${compileServerOrigin}/.jsenv/browser-platform.js`,
    },
  }
}
