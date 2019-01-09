import {
  createCancellationSource,
  createCancellationToken,
  cancellationTokenCompose,
} from "@dmail/cancellation"
import { launchAndExecute } from "./launchAndExecute/index.js"
import { startCompileServer } from "./server-compile/index.js"

export const executeFile = async (
  file,
  { launchPlatform, cancellationToken = createCancellationToken(), cancelSIGINT = true, ...rest },
) => {
  if (cancelSIGINT) {
    const SIGINTCancelSource = createCancellationSource()
    process.on("SIGINT", () => SIGINTCancelSource.cancel("process interruption"))
    cancellationToken = cancellationTokenCompose(cancellationToken, SIGINTCancelSource.token)
  }

  const { origin: remoteRoot } = await startCompileServer({
    cancellationToken,
    ...rest,
  })

  const launch = () => launchPlatform({ cancellationToken, remoteRoot, ...rest })

  return launchAndExecute(launch, file, {
    cancellationToken,
    ...rest,
  })
}
