import { compileProfiles } from "./compileProfiles/compileProfiles.js"
import { createGetProfileForPlatform } from "./createGetProfileForPlatform.js"
import assert from "assert"

{
  const getProfileForPlatform = createGetProfileForPlatform(
    compileProfiles({
      compatMap: {
        a: {
          chrome: "41",
        },
      },
    }),
  )

  {
    const actual = getProfileForPlatform({ platformName: "chrome", platformVersion: "39" })
      .pluginNames
    const expected = ["a"]
    assert.deepEqual(actual, expected)
  }

  {
    const actual = getProfileForPlatform({ platformName: "chrome", platformVersion: "41" })
      .pluginNames
    const expected = []
    assert.deepEqual(actual, expected)
  }

  {
    const actual = getProfileForPlatform({ platformName: "chrome", platformVersion: "42" })
      .pluginNames
    const expected = []
    assert.deepEqual(actual, expected)
  }
}

{
  const getProfileForPlatform = createGetProfileForPlatform(
    compileProfiles({
      compatMap: {
        a: {
          chrome: "41",
        },
        b: {
          chrome: "42",
        },
      },
      size: 1,
    }),
  )

  const actual = getProfileForPlatform({
    platformName: "chrome",
    platformVersion: "41", // even if chrome 41, we serve a because in same group than chrome 42
  }).pluginNames
  const expected = ["a", "b"]

  assert.deepEqual(actual, expected)
}

{
  const getProfileForPlatform = createGetProfileForPlatform(
    compileProfiles({
      compatMap: {
        a: {
          chrome: "60",
        },
      },
      size: 1,
    }),
  )

  const actual = getProfileForPlatform({
    platformName: "firefox",
    platformVersion: "70",
  }).pluginNames
  const expected = ["a"]
  assert.deepEqual(actual, expected)
}

{
  const getProfileForPlatform = createGetProfileForPlatform(
    compileProfiles({
      compatMap: {
        a: {},
      },
      size: 1,
    }),
  )

  const actual = getProfileForPlatform({
    platformName: "chrome",
    platformVersion: "50",
  }).pluginNames
  const expected = ["a"]
  assert.deepEqual(actual, expected)
}

{
  const getProfileForPlatform = createGetProfileForPlatform(
    compileProfiles({
      compatMap: {
        a: {
          chrome: "42",
        },
      },
      size: 1,
    }),
  )

  const actual = getProfileForPlatform({
    platformName: "chrome",
    platformVersion: "41", // even if chrome 41, we serve a because in same group than chrome 42
  }).pluginNames
  const expected = ["a"]

  assert.deepEqual(actual, expected)
}

{
  const getProfileForPlatform = createGetProfileForPlatform(
    compileProfiles({
      compatMap: {
        a: {
          chrome: "42",
        },
        b: {},
      },
      size: 4,
    }),
  )

  const actual = getProfileForPlatform({
    platformName: "chrome",
    platformVersion: "45",
  }).pluginNames
  const expected = ["b"]

  assert.deepEqual(actual, expected)
}

{
  const getProfileForPlatform = createGetProfileForPlatform(
    compileProfiles({
      platformNames: ["node"],
    }),
  )

  const actual = getProfileForPlatform({
    platformName: "node",
    platformVersion: "8.0",
  }).pluginNames
  const expected = [
    "proposal-async-generator-functions",
    "proposal-json-strings",
    "proposal-object-rest-spread",
    "proposal-optional-catch-binding",
    "proposal-unicode-property-regex",
    "transform-async-to-generator",
    "transform-dotall-regex",
    "transform-exponentiation-operator",
  ]
  assert.deepEqual(actual, expected)
}

console.log("passed")
