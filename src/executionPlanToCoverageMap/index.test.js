import { assert } from "@dmail/assert"
import { launchNode } from "../launchNode/index.js"
import { launchChromium } from "../launchChromium/index.js"
import { executionPlanToCoverageMap } from "./executionPlanToCoverageMap.js"
import { localRoot } from "../localRoot.js"

const test = async () => {
  const compileInto = "build"
  // executeFileOnPlatform ne va rien passer de special a launchPlatform
  // autrement dit launchPlatform doit deja connaitre remoteRoot, localRoot etc
  // et executionPlan n'a pas connaissance qu'on demarre un serveur etc
  // donc pour le moment on va par avoir un executionPlan propre nickel
  // on va tout écrire pour voir comment ça s'agence
  const executionPlan = {
    node: {
      launchPlatform: launchNode,
      files: ["src/__test__/file.test.js"],
    },
    chromium: {
      launchPlatform: launchChromium,
      files: [], // ["src/__test__/file.test.js"]
    },
  }
  const coverageMap = await executionPlanToCoverageMap(executionPlan, {
    localRoot,
    compileInto,
  })

  assert({
    actual: coverageMap["index.js"],
    expected: {
      b: {},
      branchMap: {},
      f: {},
      fnMap: {},
      path: "index.js",
      s: {},
      statementMap: {},
    },
  })
  assert({
    actual: coverageMap["src/__test__/file.js"].s,
    expected: {
      0: 1,
      1: 1,
      2: 1,
    },
  })
}

test()
