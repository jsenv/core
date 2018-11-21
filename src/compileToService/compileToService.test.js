import { compileToService } from "./compileToService.js"
import path from "path"
import assert from "assert"
import { stat } from "../fileHelper.js"

const projectRoot = path.resolve(__dirname, "../../../")
const localRoot = `${projectRoot}/src/compileToService/fixtures`
const compileInto = "build"
const compileId = "group"
const output = "foo"
const compileParamMap = {
  [compileId]: {
    content: output,
  },
}
const file = "src/file.txt"
const expectedEtag = `"3-C+7Hteo/D9vJXQ3UfzxbwnXaijM"`

const compile = ({ content }) => {
  return {
    sources: [file],
    sourcesContent: [content],
    assets: ["asset.map"],
    assetsContent: ["bar"],
    output: content,
  }
}

const test = async () => {
  // cacheStrategy: 'none'
  {
    const compileService = compileToService(compile, {
      localRoot,
      compileInto,
      compileParamMap,
      cacheStrategy: "none",
    })

    const actual = await compileService({
      ressource: `${compileInto}/${compileId}/${file}`,
    })
    assert.deepEqual(actual, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-length": 3,
        "content-type": "application/javascript",
      },
      body: output,
    })
  }

  // cacheStrategy: 'etag'
  {
    const compileService = compileToService(compile, {
      localRoot,
      compileInto,
      compileParamMap,
      cacheStrategy: "etag",
    })

    {
      const actual = await compileService({
        ressource: `${compileInto}/${compileId}/${file}`,
        headers: {
          "if-none-match": '"wrong-etag"',
        },
      })
      assert.deepEqual(actual, {
        status: 200,
        headers: {
          "content-length": 3,
          "content-type": "application/javascript",
          eTag: expectedEtag,
        },
        body: output,
      })
    }

    {
      const actual = await compileService({
        ressource: `${compileInto}/${compileId}/${file}`,
        headers: {
          "if-none-match": expectedEtag,
        },
      })
      assert.deepEqual(actual, {
        status: 304,
      })
    }
  }

  // cacheStrategy: 'mtime'
  {
    const compileService = compileToService(compile, {
      localRoot,
      compileInto,
      compileParamMap,
      cacheStrategy: "mtime",
    })

    {
      const actual = await compileService({
        ressource: `${compileInto}/${compileId}/${file}`,
        headers: {
          "if-modified-since": new Date(0).toUTCString(),
        },
      })
      const { mtime } = await stat(`${localRoot}/${file}`)
      assert.deepEqual(actual, {
        status: 200,
        headers: {
          "content-length": 3,
          "content-type": "application/javascript",
          "last-modified": mtime.toUTCString(),
        },
        body: output,
      })
    }

    {
      const actual = await compileService({
        ressource: `${compileInto}/${compileId}/${file}`,
        headers: {
          "if-modified-since": new Date().toUTCString(),
        },
      })
      assert.deepEqual(actual, {
        status: 304,
      })
    }
  }

  console.log("passed")
}

test()
