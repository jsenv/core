import { assert } from "@jsenv/assert"

import { applyAlgoToRepresentationData } from "@jsenv/integrity/src/integrity_algorithms.js"
import { validateResponseIntegrity } from "@jsenv/integrity/src/integrity_validation.js"

const helloWorldAsSha256AndBase64 = applyAlgoToRepresentationData(
  "sha256",
  Buffer.from("Hello world"),
)
const helloWorldAsSha512AndBase64 = applyAlgoToRepresentationData(
  "sha512",
  Buffer.from("Hello world"),
)
const helloAsSha512AndBase64 = applyAlgoToRepresentationData(
  "sha512",
  Buffer.from("Hello"),
)
const integrity = `sha256-${helloWorldAsSha256AndBase64} sha512-${helloWorldAsSha512AndBase64} sha512-${helloAsSha512AndBase64}`

// validating "Hello world"
{
  const response = {
    type: "cors",
    dataRepresentation: Buffer.from("Hello world"),
  }
  const actual = await validateResponseIntegrity(response, integrity)
  const expected = true
  assert({ actual, expected })
}

// validating "Hello"
{
  const response = {
    type: "cors",
    dataRepresentation: Buffer.from("Hello"),
  }
  const actual = await validateResponseIntegrity(response, integrity)
  const expected = true
  assert({ actual, expected })
}

// validating "Hellow"
{
  const response = {
    url: "http://example.com/file.txt",
    type: "cors",
    dataRepresentation: Buffer.from("Hellow"),
  }
  try {
    await validateResponseIntegrity(response, integrity)
    throw new Error("should throw")
  } catch (e) {
    const actual = {
      code: e.code,
      message: e.message,
    }
    const expected = {
      code: "EINTEGRITY",
      message: `Integrity validation failed for ressource "http://example.com/file.txt". The integrity found for this ressource is "sha512-E+RbhRojnWN6dkeUqrS8Fxl9hHR+5by21VwGtX/3sQtmItAdMtpv7G9Q8CEsoMx0fRuVp7zBqXfOhMl2yRFBuA=="`,
    }
    assert({ actual, expected })
  }
}
