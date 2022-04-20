import { CONTENT_TYPE } from "@jsenv/utils/content_type/content_type.js"

export const assertLoadedContentCompliance = ({ reference, urlInfo }) => {
  const { expectedType } = reference
  if (expectedType) {
    assertTypeCompliance(urlInfo, expectedType)
  }
  // we could perform integrity checks
}

const assertTypeCompliance = (urlInfo, expectedType) => {
  const assertion = typeAssertions[expectedType]
  if (assertion) {
    assertion()
  }
}

const typeAssertions = {
  text: (urlInfo) => {
    if (!CONTENT_TYPE.isTextual(urlInfo.contentType)) {
      throw new Error(
        `Unexpected content type on ${urlInfo.url}, should be "text/*" but got ${urlInfo.contentType}`,
      )
    }
  },
  css: (urlInfo) => {
    if (urlInfo.type !== "css") {
      throw new Error(
        `Unexpected content type on ${urlInfo.url}, should be "text/css" but got ${urlInfo.contentType}`,
      )
    }
  },
  json: (urlInfo) => {
    if (urlInfo.type !== "json") {
      throw new Error(
        `Unexpected content type on ${urlInfo.url}, should be "application/json" but got ${urlInfo.contentType}`,
      )
    }
  },
}
