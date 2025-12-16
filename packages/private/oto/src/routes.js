import { setupRoutes } from "@jsenv/navi";

const { paused } = setupRoutes({
  paused: {
    urlTemplate: "?paused",
  },
});

export const pausedRoute = paused;
