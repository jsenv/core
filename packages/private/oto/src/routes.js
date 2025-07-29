import { defineRoutes } from "@jsenv/navi";

const { paused } = defineRoutes({
  paused: {
    urlTemplate: "?paused",
  },
});

export const pausedRoute = paused;
