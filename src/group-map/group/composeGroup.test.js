import { assert } from "@dmail/assert"
import { composeGroup } from "./composeGroup.js"

{
  const firstGroup = {
    incompatibleNameArray: ["a"],
    platformCompatMap: {
      chrome: 50,
      firefox: 20,
    },
  }
  const secondGroup = {
    incompatibleNameArray: ["b", "e"],
    platformCompatMap: {
      chrome: 49,
      firefox: 30,
      node: 10,
    },
  }
  const actual = composeGroup(firstGroup, secondGroup)
  const expected = {
    incompatibleNameArray: ["a", "b", "e"],
    platformCompatMap: {
      chrome: "50",
      firefox: "30",
      node: "10",
    },
  }
  assert({ actual, expected })
}
