import { registerRoutes } from "router";

const { paused } = registerRoutes({
  paused: {
    urlTemplate: "?paused",
  },
});

export const pausedRoute = paused;
