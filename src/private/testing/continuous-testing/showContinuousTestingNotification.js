import { basename } from "path"
import { executionIsPassed } from "../execution/execution-is-passed.js"
import {
  createBrokenNotificationMessage,
  createStillFailingNotificationMessage,
  createFixedNotificationMessage,
} from "./continuous-testing-notifications.js"

const notifier = import.meta.require("node-notifier")

export const showContinuousTestingNotification = ({
  projectPath,
  previousTestingResult,
  testingResult,
}) => {
  const projectName = basename(projectPath)

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
