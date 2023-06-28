import { assert } from "@jsenv/assert";
import { renderUrlOrRelativeUrlFilename } from "@jsenv/urls";

{
  const actual = renderUrlOrRelativeUrlFilename(
    "./file.js",
    ({ basename, extension }) => {
      return `${basename}-coucou${extension}`;
    },
  );
  const expected = "./file-coucou.js";
  assert({ actual, expected });
}

{
  const actual = renderUrlOrRelativeUrlFilename(
    "./file.js?v=toto",
    ({ basename, extension }) => {
      return `hey-${basename}${extension}`;
    },
  );
  const expected = "./hey-file.js?v=toto";
  assert({ actual, expected });
}

{
  const actual = renderUrlOrRelativeUrlFilename(
    "./a/b/file.js?v=toto&t=\uf7f9",
    ({ basename, extension }) => {
      return `hey-${basename}${extension}`;
    },
  );
  const expected = "./a/b/hey-file.js?v=toto&t=\uf7f9";
  assert({ actual, expected });
}

{
  const actual = renderUrlOrRelativeUrlFilename(
    "https://cdn.com/a/b/file.js?v=toto&t=\uf7f9",
    ({ basename, extension }) => {
      return `hey-${basename}${extension}`;
    },
  );
  const expected = "https://cdn.com/a/b/hey-file.js?v=toto&t=\uf7f9";
  assert({ actual, expected });
}
