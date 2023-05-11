import { signal } from "@preact/signals";

export const executionTooltipOpenedSignal = signal(false);

export const executionSignal = signal({
  status: "running",
});

export const previousExecutionSignal = signal(
  sessionStorage.hasOwnProperty(window.location.href)
    ? JSON.parse(sessionStorage.getItem(window.location.href))
    : null,
);

window.parent.__supervisor__
  .getDocumentExecutionResult()
  .then(({ status, startTime, endTime }) => {
    executionSignal.value = { status, startTime, endTime };
  });
