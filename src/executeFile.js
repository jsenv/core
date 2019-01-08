import {
  createCancellationSource,
  createCancellationToken,
  cancellationTokenCompose,
} from "@dmail/cancellation"
import { createJsCompileService } from "./createJsCompileService.js"
import { launchAndExecute } from "./launchAndExecute/index.js"
import { openCompileServer } from "./server-compile/index.js"

export const executeFile = async (
  file,
  { launchPlatform, cancellationToken = createCancellationToken(), cancelSIGINT = true, ...rest },
) => {
  if (cancelSIGINT) {
    const SIGINTCancelSource = createCancellationSource()
    process.on("SIGINT", () => SIGINTCancelSource.cancel("process interruption"))
    cancellationToken = cancellationTokenCompose(cancellationToken, SIGINTCancelSource.token)
  }

  const jsCompileService = await createJsCompileService({
    cancellationToken,
    ...rest,
  })

  const { origin: remoteRoot } = await openCompileServer({
    cancellationToken,
    compileService: jsCompileService,
    ...rest,
  })

  const launch = () => launchPlatform({ cancellationToken, remoteRoot, ...rest })

  return launchAndExecute(launch, file, {
    cancellationToken,
    ...rest,
  })
}
