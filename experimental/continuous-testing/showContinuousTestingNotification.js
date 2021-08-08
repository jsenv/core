import { basename } from "path"

import { require } from "@jsenv/core/src/internal/require.js"
import { executionIsPassed } from "@jsenv/core/src/internal/executing/executionIsPassed.js"
import {
  createBrokenNotificationMessage,
  createStillFailingNotificationMessage,
  createFixedNotificationMessage,
} from "./continuous-testing-notifications.js"

export const showContinuousTestingNotification = ({
  projectDirectoryUrl,
  previousTestingResult,
  testingResult,
}) => {
  const notifier = require("node-notifier")
  const projectName = basename(projectDirectoryUrl)

  const previousTestingPassed = executionIsPassed(previousTestingResult)
  const testingPassed = executionIsPassed(testingResult)
  if (previousTestingPassed && !testingPassed) {
    notifier.notify({
      title: `${projectName} broken`,
      message: createBrokenNotificationMessage({ previousTestingResult, testingResult }),
    })
  } else if (!previousTestingPassed && testingPassed) {
    notifier.notify({
      title: `${projectName} fixed`,
      message: createFixedNotificationMessage({ previousTestingResult, testingResult }),
    })
  } else if (!previousTestingPassed && !testingPassed) {
    notifier.notify({
      title: `${projectName} failing`,
      message: createStillFailingNotificationMessage({
        previousTestingResult,
        testingResult,
      }),
    })
  }
}
