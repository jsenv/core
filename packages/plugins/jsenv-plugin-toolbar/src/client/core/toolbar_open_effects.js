import { addExternalCommandCallback } from "./parent_window_actions.js";
import { openToolbar, closeToolbar } from "./toolbar_open_actions.js";

addExternalCommandCallback("openToolbar", openToolbar);
addExternalCommandCallback("closeToolbar", closeToolbar);
