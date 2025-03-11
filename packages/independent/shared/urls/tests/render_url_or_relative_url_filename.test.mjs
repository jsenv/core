import { assert } from "@jsenv/assert";
import { renderUrlOrRelativeUrlFilename } from "@jsenv/urls";

{
  const actual = renderUrlOrRelativeUrlFilename(
    "./file.js",
    ({ basename, extension }) => {
      return `${basename}-coucou${extension}`;
    },
  );
  const expect = "./file-coucou.js";
  assert({ actual, expect });
}

{
  const actual = renderUrlOrRelativeUrlFilename(
    "./file.js?v=toto",
    ({ basename, extension }) => {
      return `hey-${basename}${extension}`;
    },
  );
  const expect = "./hey-file.js?v=toto";
  assert({ actual, expect });
}

{
  const actual = renderUrlOrRelativeUrlFilename(
    "./a/b/file.js?v=toto&t=\uf7f9",
    ({ basename, extension }) => {
      return `hey-${basename}${extension}`;
    },
  );
  const expect = "./a/b/hey-file.js?v=toto&t=\uf7f9";
  assert({ actual, expect });
}

{
  const actual = renderUrlOrRelativeUrlFilename(
    "https://cdn.com/a/b/file.js?v=toto&t=\uf7f9",
    ({ basename, extension }) => {
      return `hey-${basename}${extension}`;
    },
  );
  const expect = "https://cdn.com/a/b/hey-file.js?v=toto&t=\uf7f9";
  assert({ actual, expect });
}
