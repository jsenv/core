import { setBaseUrl } from "@jsenv/router";

setBaseUrl(new URL(window.DB_MANAGER_CONFIG.pathname, window.location.href));
