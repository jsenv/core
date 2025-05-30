// TO BE FIXED
// eslint-disable-next-line import-x/named
import { registerRoutes } from "@jsenv/router";

const { paused } = registerRoutes({
  paused: {
    urlTemplate: "?paused",
  },
});

export const pausedRoute = paused;
