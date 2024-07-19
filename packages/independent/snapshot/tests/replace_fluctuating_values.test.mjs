import { replaceFluctuatingValues } from "@jsenv/snapshot/src/replace_fluctuating_values.js";
import { assert } from "@jsenv/assert";

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
    cwdPath: "C:\\Users\\project",
    cwdUrl: "file:///C:/Users/project",
    isWindows: true,
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
