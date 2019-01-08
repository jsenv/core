import {
  createCancellationSource,
  createCancellationToken,
  cancellationTokenCompose,
} from "@dmail/cancellation"
import { createJsCompileService } from "../createJsCompileService.js"
import { executeFileOnPlatform } from "../executeFileOnPlatform/index.js"
import { openCompileServer } from "../server-compile/index.js"
import { launchNode } from "./launchNode.js"

export const executeFileOnNode = async (
  file,
  { cancellationToken = createCancellationToken(), cancelSIGINT = true, ...rest },
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

  return executeFileOnPlatform(file, () => launchNode({ cancellationToken, remoteRoot, ...rest }), {
    cancellationToken,
    ...rest,
  })
}
