import { setBaseUrl } from "@jsenv/router";

setBaseUrl(new URL("/.internal/database/", window.location.href));
