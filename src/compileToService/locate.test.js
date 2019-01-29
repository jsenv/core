import { assert } from "@dmail/assert"
import { locate } from "./locate.js"

{
  const actual = locate({
    requestFile: "build/cache/best/index.js",
    refererFile: "",
    compileInto: "build/cache",
    localRoot: "/root",
  })
  const expected = {
    compileId: "best",
    projectFile: "index.js",
    file: "/root/index.js",
  }
  assert({ actual, expected })
}

// refererFile different compileInto
// {
//   const actual = locate({
//     requestFile: "build/foo/index.js",
//     refererFile: "not-build/foo/file.js",
//     compileInto: "build",
//     localRoot: "/root",
//   })
//   const expected = {
//     compileId: "foo",
//     projectFile: "index.js",
//     file: "/root/index.js",
//   }
//   assert({ actual, expected })
// }

// // refererFile different compileId
// {
//   const actual = locate({
//     requestFile: "build/foo/index.js",
//     refererFile: "build/not-foo/file.js",
//     compileInto: "build",
//     localRoot: "/root",
//   })
//   const expected = {
//     compileId: "foo",
//     projectFile: "index.js",
//     file: "/root/index.js",
//   }
//   assert({ actual, expected })
// }

// // refererFile is requestFile itself
// {
//   const actual = locate({
//     requestFile: "build/foo/index.js",
//     refererFile: "build/foo/index.js",
//     compileInto: "build",
//     localRoot: "/root",
//   })
//   const expected = {
//     compileId: "foo",
//     projectFile: "index.js",
//     file: "/root/index.js",
//   }
//   assert({ actual, expected })
// }

// refererFile not parent of requestFile
{
  const actual = locate({
    requestFile: "build/foo/folder/file.js",
    refererFile: "build/foo/dependentFolder/dependentFile.js",
    compileInto: "build",
    localRoot: "/root",
  })
  const expected = {
    compileId: "foo",
    projectFile: "folder/file.js",
    file: "/root/folder/file.js",
  }
  assert({ actual, expected })
}

// refererFile parent of requestFile
// {
//   const actual = locate({
//     requestFile: "build/foo/dependentFolder/folder/file.js",
//     refererFile: "build/foo/dependentFolder/dependentFile.js",
//     compileInto: "build",
//     localRoot: "/root",
//   })
//   const expected = {
//     compileId: "foo",
//     projectFile: "dependentFolder/folder/file.js",
//     file: "/root/dependentFolder/folder/file.js",
//   }
//   assert({ actual, expected })
// }
