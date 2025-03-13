// default runtimeCompat corresponds to
// "we can keep <script type="module"> intact":
// so script_type_module + dynamic_import + import_meta
export const defaultRuntimeCompat = {
  // android: "8",
  chrome: "64",
  edge: "79",
  firefox: "67",
  ios: "12",
  opera: "51",
  safari: "11.3",
  samsung: "9.2",
};
export const logsDefault = {
  level: "info",
  disabled: false,
  animation: true,
};
export const getDefaultBase = (runtimeCompat) =>
  runtimeCompat.node ? "./" : "/";
