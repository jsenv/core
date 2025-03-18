import { ANSI, distributePercentages, humanizeFileSize } from "@jsenv/humanize";

export const createBuildContentSummary = (
  buildFileContents,
  { title = "build content summary" } = {},
) => {
  const buildContentReport = createBuildContentReport(buildFileContents);
  return `--- ${title} ---  
${createRepartitionMessage(buildContentReport)}
--------------------`;
};

const createBuildContentReport = (buildFileContents) => {
  const countGroups = {
    sourcemaps: 0,
    html: 0,
    css: 0,
    js: 0,
    json: 0,
    other: 0,
    total: 0,
  };
  const sizeGroups = {
    sourcemaps: 0,
    html: 0,
    css: 0,
    js: 0,
    json: 0,
    other: 0,
    total: 0,
  };

  for (const buildRelativeUrl of Object.keys(buildFileContents)) {
    const content = buildFileContents[buildRelativeUrl];
    const contentSize = Buffer.byteLength(content);
    const category = determineCategory(buildRelativeUrl);
    if (category === "sourcemap") {
      countGroups.sourcemaps++;
      sizeGroups.sourcemaps += contentSize;
      continue;
    }
    countGroups.total++;
    sizeGroups.total += contentSize;
    if (category === "html") {
      countGroups.html++;
      sizeGroups.html += contentSize;
      continue;
    }
    if (category === "css") {
      countGroups.css++;
      sizeGroups.css += contentSize;
      continue;
    }
    if (category === "js") {
      countGroups.js++;
      sizeGroups.js += contentSize;
      continue;
    }
    if (category === "json") {
      countGroups.json++;
      sizeGroups.json += contentSize;
      continue;
    }
    countGroups.other++;
    sizeGroups.other += contentSize;
    continue;
  }

  const sizesToDistribute = {};
  for (const groupName of Object.keys(sizeGroups)) {
    if (groupName !== "sourcemaps" && groupName !== "total") {
      sizesToDistribute[groupName] = sizeGroups[groupName];
    }
  }
  const percentageGroups = distributePercentages(sizesToDistribute);

  return {
    // sourcemaps are special, there size are ignored
    // so there is no "percentage" associated
    sourcemaps: {
      count: countGroups.sourcemaps,
      size: sizeGroups.sourcemaps,
      percentage: undefined,
    },

    html: {
      count: countGroups.html,
      size: sizeGroups.html,
      percentage: percentageGroups.html,
    },
    css: {
      count: countGroups.css,
      size: sizeGroups.css,
      percentage: percentageGroups.css,
    },
    js: {
      count: countGroups.js,
      size: sizeGroups.js,
      percentage: percentageGroups.js,
    },
    json: {
      count: countGroups.json,
      size: sizeGroups.json,
      percentage: percentageGroups.json,
    },
    other: {
      count: countGroups.other,
      size: sizeGroups.other,
      percentage: percentageGroups.other,
    },
    total: {
      count: countGroups.total,
      size: sizeGroups.total,
      percentage: 100,
    },
  };
};

const determineCategory = (buildRelativeUrl) => {
  if (buildRelativeUrl.endsWith(".map")) {
    return "sourcemap";
  }
  if (buildRelativeUrl.endsWith(".html")) {
    return "html";
  }
  if (buildRelativeUrl.endsWith(".css")) {
    return "css";
  }
  if (
    buildRelativeUrl.endsWith(".js") ||
    buildRelativeUrl.endsWith(".mjs") ||
    buildRelativeUrl.endsWith(".cjs")
  ) {
    return "js";
  }
  if (buildRelativeUrl.endsWith(".json")) {
    return "json";
  }
  return "other";
};

const createRepartitionMessage = ({ html, css, js, json, other, total }) => {
  const addPart = (name, { count, size, percentage }) => {
    parts.push(
      `${ANSI.color(`${name}:`, ANSI.GREY)} ${count} (${humanizeFileSize(
        size,
      )} / ${percentage} %)`,
    );
  };

  const parts = [];
  // if (sourcemaps.count) {
  //   parts.push(
  //     `${ANSI.color(`sourcemaps:`, ANSI.GREY)} ${
  //       sourcemaps.count
  //     } (${humanizeFileSize(sourcemaps.size)})`,
  //   )
  // }
  if (html.count) {
    addPart("html ", html);
  }
  if (css.count) {
    addPart("css  ", css);
  }
  if (js.count) {
    addPart("js   ", js);
  }
  if (json.count) {
    addPart("json ", json);
  }
  if (other.count) {
    addPart("other", other);
  }
  addPart("total", total);
  return `- ${parts.join(`
- `)}`;
};
