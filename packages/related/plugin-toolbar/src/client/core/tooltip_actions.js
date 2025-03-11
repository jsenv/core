import { closeExecutionTooltip } from "./execution_actions.js";
import { closeServerTooltip } from "./server_actions.js";

export const closeAllTooltips = () => {
  closeExecutionTooltip();
  closeServerTooltip();
};
