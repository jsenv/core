import { lazy } from "preact/compat";

export const Mapbox = lazy(async () => {
  const { MapboxLazy } = await import("./mapbox_lazy.jsx");
  return MapboxLazy;
});
