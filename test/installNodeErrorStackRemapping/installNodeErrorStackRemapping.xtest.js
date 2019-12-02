// disabled for now because needs to be rewritten

import { assert } from "@jsenv/assert"
import { fileUrlToPath, urlToRelativeUrl, resolveUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { installNodeErrorStackRemapping } from "internal/error-stack-remapping/installNodeErrorStackRemapping.js"

const fileRelativeUrl = urlToRelativeUrl(import.meta.url, jsenvCoreDirectoryUrl)

const { getErrorOriginalStackString } = installNodeErrorStackRemapping()

const error = new Error()
const stackString = error.stack
{
  const compiledFileUrl = resolveUrl(`./.dist/best/${fileRelativeUrl}`, jsenvCoreDirectoryUrl)
  const compiledFilePath = fileUrlToPath(compiledFileUrl)
  const actual = stackString.includes(compiledFilePath)
  const expected = true
  assert({ actual, expected })
}
const originalStackString = await getErrorOriginalStackString(error)
{
  const actual = originalStackString.includes(import.meta.url)
  const expected = true
  assert({ actual, expected })
}
