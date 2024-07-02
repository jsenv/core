import { assert } from "@jsenv/assert";

import { pickContentLanguage } from "@jsenv/server";

{
  const request = {
    headers: {
      "accept-language":
        "fr-CH;q=0.9, fr-BE;q=0.8, fr;q=0.5, en;q=0.4, de;q=0.3, *;q=0.2",
    },
  };

  {
    const actual = pickContentLanguage(request, ["en", "fr"]);
    const expect = "fr";
    assert({ actual, expect });
  }
  {
    const actual = pickContentLanguage(request, ["fr", "fr-CH"]);
    const expect = "fr-CH";
    assert({ actual, expect });
  }
  {
    const actual = pickContentLanguage(request, ["fr-CH", "fr"]);
    const expect = "fr-CH";
    assert({ actual, expect });
  }
  {
    const actual = pickContentLanguage(request, ["fr-BE", "fr-CH"]);
    const expect = "fr-CH";
    assert({ actual, expect });
  }
  {
    const actual = pickContentLanguage(request, ["fr-CH", "fr-BE"]);
    const expect = "fr-CH";
    assert({ actual, expect });
  }
  {
    const actual = pickContentLanguage(request, ["fr", "fr-BE"]);
    const expect = "fr-BE";
    assert({ actual, expect });
  }
  {
    const actual = pickContentLanguage(request, ["it", "de"]);
    const expect = "de";
    assert({ actual, expect });
  }
  {
    const actual = pickContentLanguage(request, ["it", "es"]);
    const expect = "it";
    assert({ actual, expect });
  }
}
