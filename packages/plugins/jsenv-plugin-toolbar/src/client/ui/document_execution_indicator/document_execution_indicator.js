import { effect } from "@preact/signals";

import {
  executionSignal,
  executionTooltipOpenedSignal,
} from "../../core/execution_signals.js";
import {
  closeExecutionTooltip,
  openExecutionTooltip,
} from "../../core/execution_actions.js";
import { removeForceHideElement } from "../util/dom.js";
import { enableVariant } from "../variant.js";

const executionIndicator = document.querySelector(
  "#document_execution_indicator",
);

export const renderDocumentExecutionIndicator = async () => {
  removeForceHideElement(
    document.querySelector("#document_execution_indicator"),
  );
  effect(() => {
    const execution = executionSignal.value;
    updateExecutionIndicator(execution);
  });
  effect(() => {
    const executionTooltipOpened = executionTooltipOpenedSignal.value;
    if (executionTooltipOpened) {
      executionIndicator.setAttribute("data-tooltip-visible", "");
    } else {
      executionIndicator.removeAttribute("data-tooltip-visible");
    }
  });
};

const updateExecutionIndicator = ({ status, startTime, endTime } = {}) => {
  enableVariant(executionIndicator, { execution: status });
  const variantNode = executionIndicator.querySelector("[data-when-active]");
  variantNode.querySelector("button").onclick = () => {
    const executionTooltipOpened = executionTooltipOpenedSignal.value;
    if (executionTooltipOpened) {
      closeExecutionTooltip();
    } else {
      openExecutionTooltip();
    }
  };
  variantNode.querySelector(".tooltip").textContent = computeText({
    status,
    startTime,
    endTime,
  });
};

// relative time: https://github.com/tc39/proposal-intl-relative-time/issues/118
const computeText = ({ status, startTime, endTime }) => {
  if (status === "completed") {
    return `Execution completed in ${endTime - startTime}ms`;
  }
  if (status === "failed") {
    return `Execution failed in ${endTime - startTime}ms`;
  }
  if (status === "running") {
    return "Executing...";
  }
  return "";
};
