import { assert } from "@jsenv/assert"

import { negotiateContentLanguage } from "@jsenv/server"

{
  const request = {
    headers: {
      "accept-language":
        "fr-CH;q=0.9, fr-BE;q=0.8, fr;q=0.5, en;q=0.4, de;q=0.3, *;q=0.2",
    },
  }

  {
    const actual = negotiateContentLanguage(request, ["en", "fr"])
    const expected = "fr"
    assert({ actual, expected })
  }
  {
    const actual = negotiateContentLanguage(request, ["fr", "fr-CH"])
    const expected = "fr-CH"
    assert({ actual, expected })
  }
  {
    const actual = negotiateContentLanguage(request, ["fr-CH", "fr"])
    const expected = "fr-CH"
    assert({ actual, expected })
  }
  {
    const actual = negotiateContentLanguage(request, ["fr-BE", "fr-CH"])
    const expected = "fr-CH"
    assert({ actual, expected })
  }
  {
    const actual = negotiateContentLanguage(request, ["fr-CH", "fr-BE"])
    const expected = "fr-CH"
    assert({ actual, expected })
  }
  {
    const actual = negotiateContentLanguage(request, ["fr", "fr-BE"])
    const expected = "fr-BE"
    assert({ actual, expected })
  }
  {
    const actual = negotiateContentLanguage(request, ["it", "de"])
    const expected = "de"
    assert({ actual, expected })
  }
  {
    const actual = negotiateContentLanguage(request, ["it", "es"])
    const expected = "it"
    assert({ actual, expected })
  }
}
