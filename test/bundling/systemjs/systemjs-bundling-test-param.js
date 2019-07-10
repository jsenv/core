import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { testBabelPluginMap } from "../../testBabelPluginMap.js"

export const SYSTEMJS_BUNDLING_TEST_GENERATE_PARAM = {
  projectPath: JSENV_PATH,
  platformGroupResolverRelativePath: "/src/balancing/platform-group-resolver.js",
  balancerTemplateRelativePath: "/src/bundling/systemjs/systemjs-balancer-template.js",
  globalThisHelperRelativePath: "/src/bundling/jsenv-rollup-plugin/global-this.js",
  babelPluginMap: testBabelPluginMap,
  logLevel: "off",
  throwUnhandled: false,
}

export const SYSTEMJS_BUNDLING_TEST_IMPORT_PARAM = {
  projectPath: JSENV_PATH,
  mainRelativePath: "/main.js",
}
