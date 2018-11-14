import { ressourceToLocateParam } from "./ressourceToLocateParam.js"
import assert from "assert"

const test = async () => {
  // dependentRessource different compileInto
  {
    const actual = ressourceToLocateParam("build/foo/index.js", "not-build/foo/file.js", "build")
    const expected = {
      file: "index.js",
    }
    assert.deepEqual(actual, expected)
  }

  // dependentRessource different compileId
  {
    const actual = ressourceToLocateParam("build/foo/index.js", "build/not-foo/file.js", "build")
    const expected = {
      file: "index.js",
    }
    assert.deepEqual(actual, expected)
  }

  // dependentRessource is ressource itself
  {
    const actual = ressourceToLocateParam("build/foo/index.js", "build/foo/index.js", "build")
    const expected = {
      file: "index.js",
    }
    assert.deepEqual(actual, expected)
  }

  // dependentRessource not parent of ressource
  {
    const actual = ressourceToLocateParam(
      "build/foo/folder/file.js",
      "build/foo/dependentFolder/dependentFile.js",
      "build",
    )
    const expected = {
      file: "folder/file.js",
    }
    assert.deepEqual(actual, expected)
  }

  // dependentRessource parent of ressource
  {
    const actual = ressourceToLocateParam(
      "build/foo/dependentFolder/folder/file.js",
      "build/foo/dependentFolder/dependentFile.js",
      "build",
    )
    const expected = {
      dependentFolder: "dependentFolder",
      dependentFile: "dependentFolder/dependentFile.js",
      file: "folder/file.js",
    }
    assert.deepEqual(actual, expected)
  }

  console.log("passed")
}
test()
