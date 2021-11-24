/* eslint-env browser */

import { createEventSourceConnection } from "./event_source_connection.js"
import {
  getFileChanges,
  addFileChange,
  setFileChangeCallback,
  reloadIfNeeded,
} from "./file_changes.js"
import {
  isLivereloadEnabled,
  setLivereloadPreference,
} from "./livereload_preference.js"

const eventsourceConnection = createEventSourceConnection(
  document.location.href,
  {
    "file-added": ({ data }) => {
      addFileChange({
        file: data,
        eventType: "added",
      })
    },
    "file-modified": ({ data }) => {
      addFileChange({
        file: data,
        eventType: "modified",
      })
    },
    "file-removed": ({ data }) => {
      addFileChange({
        file: data,
        eventType: "removed",
      })
    },
  },
  {
    retryMaxAttempt: Infinity,
    retryAllocatedMs: 20 * 1000,
  },
)

const {
  connect,
  disconnect,
  setConnectionStatusChangeCallback,
  getConnectionStatus,
} = eventsourceConnection

connect()

window.__jsenv_event_source_client__ = {
  connect,
  disconnect,
  getConnectionStatus,
  setConnectionStatusChangeCallback,
  getFileChanges,
  addFileChange,
  setFileChangeCallback,
  reloadIfNeeded,
  isLivereloadEnabled,
  setLivereloadPreference,
}
