import { executionTooltipOpenedSignal } from "./execution_signals.js";
import { notify } from "./notification_actions.js";

export const openExecutionTooltip = () => {
  executionTooltipOpenedSignal.value = true;
};

export const closeExecutionTooltip = () => {
  executionTooltipOpenedSignal.value = false;
};

export const notifyExecutionResult = (execution, previousExecution) => {
  const executedFileRelativeUrl = window.location.href;
  const notificationOptions = {
    lang: "en",
    icon: getFaviconHref(),
    clickToFocus: true,
    clickToClose: true,
  };
  if (execution.status === "failed") {
    if (previousExecution) {
      if (previousExecution.status === "completed") {
        notify("Broken", {
          ...notificationOptions,
          body: `${executedFileRelativeUrl} execution now failing.`,
        });
      } else {
        notify("Still failing", {
          ...notificationOptions,
          body: `${executedFileRelativeUrl} execution still failing.`,
        });
      }
    } else {
      notify("Failing", {
        ...notificationOptions,
        body: `${executedFileRelativeUrl} execution failed.`,
      });
    }
  } else if (previousExecution && previousExecution.status === "failed") {
    notify("Fixed", {
      ...notificationOptions,
      body: `${executedFileRelativeUrl} execution fixed.`,
    });
  }
};

const getFaviconHref = () => {
  const link = document.querySelector('link[rel="icon"]');
  return link ? link.href : undefined;
};
