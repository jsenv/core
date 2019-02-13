import { assert } from "@dmail/assert"
import { fileStat } from "@dmail/helper"
import { root as selfRoot } from "../../root.js"
import { compileToService } from "../compileToService.js"

const root = `${selfRoot}/src/compileToService/test/fixtures`
const compileInto = "build"
const compileId = "group"
const output = "foo"
const compileDescription = {
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

;(async () => {
  // cacheStrategy: 'none'
  {
    const compileService = compileToService(compile, {
      root,
      compileInto,
      compileDescription,
      cacheStrategy: "none",
    })

    const actual = await compileService({
      ressource: `${compileInto}/${compileId}/${file}`,
    })
    assert({
      actual,
      expected: {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-length": 3,
          "content-type": "application/javascript",
        },
        body: output,
      },
    })
  }

  // cacheStrategy: 'etag'
  {
    const compileService = compileToService(compile, {
      root,
      compileInto,
      compileDescription,
      cacheStrategy: "etag",
    })

    {
      const actual = await compileService({
        ressource: `${compileInto}/${compileId}/${file}`,
        headers: {
          "if-none-match": '"wrong-etag"',
        },
      })
      assert({
        actual,
        expected: {
          status: 200,
          headers: {
            "content-length": 3,
            "content-type": "application/javascript",
            eTag: expectedEtag,
          },
          body: output,
        },
      })
    }

    {
      const actual = await compileService({
        ressource: `${compileInto}/${compileId}/${file}`,
        headers: {
          "if-none-match": expectedEtag,
        },
      })
      assert({
        actual,
        expected: {
          status: 304,
        },
      })
    }
  }

  // cacheStrategy: 'mtime'
  {
    const compileService = compileToService(compile, {
      root,
      compileInto,
      compileDescription,
      cacheStrategy: "mtime",
    })

    {
      const actual = await compileService({
        ressource: `${compileInto}/${compileId}/${file}`,
        headers: {
          "if-modified-since": new Date(0).toUTCString(),
        },
      })
      const { mtime } = await fileStat(`${root}/${file}`)
      assert({
        actual,
        expected: {
          status: 200,
          headers: {
            "content-length": 3,
            "content-type": "application/javascript",
            "last-modified": mtime.toUTCString(),
          },
          body: output,
        },
      })
    }

    {
      const actual = await compileService({
        ressource: `${compileInto}/${compileId}/${file}`,
        headers: {
          "if-modified-since": new Date().toUTCString(),
        },
      })
      assert({
        actual,
        expected: {
          status: 304,
        },
      })
    }
  }

  // with different compileInto
})()
