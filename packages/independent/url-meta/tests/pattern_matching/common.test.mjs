import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

// any file
{
  const pattern = "file:///**/";
  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///file.js",
    });
    const expect = true;
    assert({ actual, expect });
  }

  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///dir/file.js",
    });
    const expect = true;
    assert({ actual, expect });
  }

  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///.git/dir/file.js",
    });
    const expect = true;
    assert({ actual, expect });
  }
}

// only root files
{
  const pattern = "file:///*";
  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///file.js",
    });
    const expect = true;
    assert({ actual, expect });
  }

  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///dir/file.js",
    });
    const expect = false;
    assert({ actual, expect });
  }

  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///dir/foo/file.js",
    });
    const expect = false;
    assert({ actual, expect });
  }
}

// only files inside directory
{
  const pattern = "file:///*/**";
  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///file.js",
    });
    const expect = false;
    assert({ actual, expect });
  }

  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///dir/file.js",
    });
    const expect = true;
    assert({ actual, expect });
  }

  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///dir/foo/file.js",
    });
    const expect = true;
    assert({ actual, expect });
  }
}

// only files inside directory starting with .
{
  const pattern = "file:///**/.*/*";
  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///.git/file.js",
    });
    const expect = true;
    assert({ actual, expect });
  }

  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///dir/.git/file.js",
    });
    const expect = true;
    assert({ actual, expect });
  }

  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///file.js",
    });
    const expect = false;
    assert({ actual, expect });
  }

  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///dir/file.js",
    });
    const expect = false;
    assert({ actual, expect });
  }

  {
    const { matched: actual } = URL_META.applyPatternMatching({
      pattern,
      url: "file:///.file.js",
    });
    const expect = false;
    assert({ actual, expect });
  }
}
