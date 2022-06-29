export const startSpinner = ({
  log,
  frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  fps = 20,
  keepProcessAlive = false,
  stopOnWriteFromOutside = true,
  text = "",
  update = (text) => text,
  effect = () => {},
}) => {
  let frameIndex = 0
  let interval

  const spinner = {
    text,
  }

  const render = () => {
    spinner.text = update(spinner.text)
    return `${frames[frameIndex]} ${spinner.text}`
  }

  const cleanup = effect() || (() => {})
  log.write(render())
  if (process.stdout.isTTY) {
    interval = setInterval(() => {
      frameIndex = frameIndex === frames.length - 1 ? 0 : frameIndex + 1
      log.dynamicWrite(({ outputFromOutside }) => {
        if (outputFromOutside && stopOnWriteFromOutside) {
          stop()
          return ""
        }
        return render()
      })
    }, 1000 / fps)
    if (!keepProcessAlive) {
      interval.unref()
    }
  }

  const stop = (text) => {
    if (log && text) {
      log.write(text)
    }
    cleanup()
    clearInterval(interval)
    interval = null
    log = null
  }

  spinner.stop = stop

  return spinner
}
