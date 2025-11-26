import { lazy } from "preact/compat";

export const Map = lazy(async () => {
  const { MapLazy } = await import("./map_lazy.jsx");
  return MapLazy;
});
