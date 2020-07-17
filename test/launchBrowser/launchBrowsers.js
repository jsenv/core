export const launchBrowsers = (launchers, fn) => {
  /*
  on windows and for some reason if we launch 3 browsers in parallel
  all requesting jsenv-browser-system.js concurrently
  it sometimes (~20% of the time) makes compile server await forever and not respond
  to browser request to get the compiled file.

  It never happens on mac suggesting it's related to the filesystem.
  But I don't see where or what would make server unresponsive like this.
  I don't get what server is waiting for.

  The unpredictible nature of this bug associated to being windows only makes it hard to fix.

  For now let's launch browser in sequence on windows.
  */
  if (process.platform === "win32") {
    return launchers.reduce(async (previous, current) => {
      await previous
      return fn(current)
    }, Promise.resolve())
  }
  return Promise.all(launchers.map((launcher) => fn(launcher)))
}
