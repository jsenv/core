import { writeFileSync } from "@jsenv/filesystem";
import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { renderTerminalSvg } from "@jsenv/terminal-recorder";

let markdown = ``;

const startTesting = (callback) => {
  const outputDirectorySnapshot = takeDirectorySnapshot(
    new URL("./output/", import.meta.url),
  );
  const test = (scenario, text, options) => {
    const output = renderTerminalSvg(text, options);
    writeFileSync(new URL(`./output/${scenario}.svg`, import.meta.url), output);
    if (markdown) {
      markdown += "\n";
    }
    markdown += `# ${scenario}

![img](./output/${scenario}.svg)`;
    markdown += `\n`;
  };
  callback(test);
  writeFileSync(new URL("./output.md", import.meta.url), markdown);
  outputDirectorySnapshot.compare();
};

startTesting((test) => {
  test("hello_world", "hello world");

  test("hello_world_custom_title", "hello world", { title: "Terminal" });

  test("hello_world_no_head", "hello world", { head: false });

  test(
    "rainbow_no_head",
    "[31mred [39m[33myellow [39m[32mgreen [39m[36mcyan [39m[34mblue [39m[35mmagenta[39m",
    { head: false },
  );

  test("color_outside_double_spaced", "[32mA[0mB  B[32mA[0m");

  test(
    "emojis_surrounded_by_text",
    `
above
before✅after
below`,
    {
      head: false,
      title: "Terminal",
    },
  );

  test(
    "text with background green and text black",
    "[42m[30mhello world[0m[0m",
  );

  test("emoji_background_color", `\x1b[45m ✅ \x1b[0m`);
});
