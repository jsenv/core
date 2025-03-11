import { assert } from "@jsenv/assert";
import { replaceFluctuatingValues } from "@jsenv/snapshot";
import { createReplaceFilesystemWellKnownValues } from "@jsenv/snapshot/src/filesystem_well_known_values.js";

// current path and http urls
if (process.platform !== "win32") {
  const actual = replaceFluctuatingValues(
    `A string with path inside:
- ${process.cwd()}
- ${process.cwd()}/
- ${process.cwd()}/directory
- ${process.cwd()}/directory/
- ${process.cwd()}/directory/file.txt
And file urls
- file:///${process.cwd()}
- file:///${process.cwd()}/
- file:///${process.cwd()}/directory
- file:///${process.cwd()}/directory/
- file:///${process.cwd()}/directory/file.txt
And http urls
http://localhost
http://localhost/
http://localhost:3457
http://localhost:3457/
ip notation: http://127.0.0.1:5678
ipv6 notation: http://[::1]:5678`,
    {
      replaceFilesystemWellKnownValues: createReplaceFilesystemWellKnownValues({
        homedirDisabled: true,
        ancestorPackagesDisabled: true,
      }),
    },
  );
  const expect = `A string with path inside:
- cwd()
- cwd()/
- cwd()/directory
- cwd()/directory/
- cwd()/directory/file.txt
And file urls
- file:///cwd()
- file:///cwd()/
- file:///cwd()/directory
- file:///cwd()/directory/
- file:///cwd()/directory/file.txt
And http urls
http://127.0.0.1
http://127.0.0.1/
http://127.0.0.1
http://127.0.0.1/
ip notation: http://127.0.0.1
ipv6 notation: http://127.0.0.1`;
  assert({ actual, expect });
}

// window file path and urls
{
  const actual = replaceFluctuatingValues(
    `A string with many windows path inside:
- C:\\Users\\project
- C:\\Users\\project\\
- C:\\Users\\project\\directory
- C:\\Users\\project\\directory\\
- C:\\Users\\project\\directory\\file.txt
And file urls
- file:///C:/Users/project
- file:///C:/Users/project/
- file:///C:/Users/project/directory
- file:///C:/Users/project/directory/
- file:///C:/Users/project/directory/file.txt`,
    {
      replaceFilesystemWellKnownValues: createReplaceFilesystemWellKnownValues({
        cwdUrl: "file:///C:/Users/project",
        cwdPath: "C:\\Users\\project",
        isWindows: true,
        homedirDisabled: true,
        ancestorPackagesDisabled: true,
      }),
    },
  );
  const expect = `A string with many windows path inside:
- cwd()
- cwd()/
- cwd()/directory
- cwd()/directory/
- cwd()/directory/file.txt
And file urls
- file:///cwd()
- file:///cwd()/
- file:///cwd()/directory
- file:///cwd()/directory/
- file:///cwd()/directory/file.txt`;
  assert({ actual, expect });
}

{
  const actual = replaceFluctuatingValues(
    `<svg xmlns="http://www.w3.org/2000/svg">
  <g test="${process.cwd()}/dir/file.js"></g>
  <text>before ${process.cwd()}/ after</text>
</svg>`,
    {
      replaceFilesystemWellKnownValues: createReplaceFilesystemWellKnownValues({
        homedirDisabled: true,
        ancestorPackagesDisabled: true,
      }),
    },
  );
  const expect = `<svg xmlns="http://www.w3.org/2000/svg">
  <g test="cwd()/dir/file.js"></g>
  <text>before cwd()/ after</text>
</svg>`;
  assert({ actual, expect });
}

{
  const actual = replaceFluctuatingValues(`"http://jsenv.dev/").href`);
  const expect = `"http://jsenv.dev/").href`;
  assert({ actual, expect });
}
