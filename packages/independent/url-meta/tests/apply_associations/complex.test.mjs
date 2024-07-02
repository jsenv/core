import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

{
  const actual = URL_META.applyAssociations({
    url: "file:///file.es5.js/file.es5.js.map",
    associations: {
      js: {
        "file:///**/*.js": true,
      },
    },
  });
  const expect = {};
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///file.es5.js/file.es5.js.map",
    associations: {
      js: {
        "file:///**/*.js": true,
        "file:///**/*.js/**": false,
      },
    },
  });
  const expect = { js: false };
  assert({ actual, expect });
}

{
  const actual = URL_META.applyAssociations({
    url: "file:///file.js.map",
    associations: {
      js: {
        "file:///**/*.js": true,
      },
    },
  });
  const expect = {};
  assert({ actual, expect });
}

{
  const associations = {
    format: {
      "file:///**/*.js": true,
      "file:///**/*.jsx": true,
      "file:///build": false,
      "file:///src/exception.js": false,
    },
  };

  {
    const actual = URL_META.applyAssociations({
      url: "file:///index.js",
      associations,
    });
    const expect = { format: true };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///src/file.js",
      associations,
    });
    const expect = { format: true };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///src/folder/file.js",
      associations,
    });
    const expect = { format: true };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///index.test.js",
      associations,
    });
    const expect = { format: true };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///src/file.test.js",
      associations,
    });
    const expect = { format: true };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///src/folder/file.test.js",
      associations,
    });
    const expect = { format: true };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      url: "file:///src/exception.js",
      associations,
    });
    const expect = { format: false };
    assert({ actual, expect });
  }
}

{
  const associations = {
    cover: {
      "file:///index.js": true,
      "file:///src/**/*.js": true,
      "file:///src/**/*.jsx": true,
      "file:///**/*.test.js": false,
      "file:///**/*.test.jsx": false,
      "file:///build/": false,
      "file:///src/exception.js": false,
    },
  };

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///index.js",
    });
    const expect = { cover: true };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///src/file.js",
    });
    const expect = { cover: true };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///src/folder/file.js",
    });
    const expect = { cover: true };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///index.test.js",
    });
    const expect = { cover: false };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///src/file.test.js",
    });
    const expect = { cover: false };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///src/folder/file.test.js",
    });
    const expect = { cover: false };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///build/index.js",
    });
    const expect = { cover: false };
    assert({ actual, expect });
  }

  {
    const actual = URL_META.applyAssociations({
      associations,
      url: "file:///src/exception.js",
    });
    const expect = { cover: false };
    assert({ actual, expect });
  }
}
