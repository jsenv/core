const createReason = (reasonString) => {
  return {
    toString: () => reasonString,
  }
}

export const STOP_REASON_INTERNAL_ERROR = createReason("Internal error")
export const STOP_REASON_PROCESS_SIGHUP = createReason("process SIGHUP")
export const STOP_REASON_PROCESS_SIGTERM = createReason("process SIGTERM")
export const STOP_REASON_PROCESS_SIGINT = createReason("process SIGINT")
export const STOP_REASON_PROCESS_BEFORE_EXIT = createReason(
  "process before exit",
)
export const STOP_REASON_PROCESS_EXIT = createReason("process exit")
export const STOP_REASON_NOT_SPECIFIED = createReason("not specified")
