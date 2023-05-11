import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

export const plugins = [
  jsenvPluginPreact(),
  jsenvPluginCommonJs({
    include: {
      "/**/node_modules/react-is/": true,
      "/**/node_modules/use-sync-external-store/": {
        external: ["react"],
      },
      "/**/node_modules/hoist-non-react-statics/": {
        external: ["react-is"],
      },
    },
  }),
];
