import { inspectFileSize, distributePercentages, ANSI } from "@jsenv/humanize";

import { GRAPH_VISITOR } from "./url_graph_visitor.js";

export const createUrlGraphSummary = (
  urlGraph,
  { title = "graph summary" } = {},
) => {
  const graphReport = createUrlGraphReport(urlGraph);
  return `--- ${title} ---  
${createRepartitionMessage(graphReport)}
--------------------`;
};

const createUrlGraphReport = (urlGraph) => {
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

  GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
    urlGraph.rootUrlInfo,
    (urlInfo) => {
      // ignore:
      // - ignored files: we don't know their content
      // - inline files and data files: they are already taken into account in the file where they appear
      if (urlInfo.url.startsWith("ignore:")) {
        return;
      }
      if (urlInfo.isInline) {
        return;
      }
      if (urlInfo.url.startsWith("data:")) {
        return;
      }

      // file loaded via import assertion are already inside the graph
      // their js module equivalent are ignored to avoid counting it twice
      // in the build graph the file targeted by import assertion will likely be gone
      // and only the js module remain (likely bundled)
      if (
        urlInfo.searchParams.has("as_json_module") ||
        urlInfo.searchParams.has("as_css_module") ||
        urlInfo.searchParams.has("as_text_module")
      ) {
        return;
      }

      const urlContentSize = Buffer.byteLength(urlInfo.content);
      const category = determineCategory(urlInfo);
      if (category === "sourcemap") {
        countGroups.sourcemaps++;
        sizeGroups.sourcemaps += urlContentSize;
        return;
      }
      countGroups.total++;
      sizeGroups.total += urlContentSize;
      if (category === "html") {
        countGroups.html++;
        sizeGroups.html += urlContentSize;
        return;
      }
      if (category === "css") {
        countGroups.css++;
        sizeGroups.css += urlContentSize;
        return;
      }
      if (category === "js") {
        countGroups.js++;
        sizeGroups.js += urlContentSize;
        return;
      }
      if (category === "json") {
        countGroups.json++;
        sizeGroups.json += urlContentSize;
        return;
      }
      countGroups.other++;
      sizeGroups.other += urlContentSize;
      return;
    },
  );

  const sizesToDistribute = {};
  Object.keys(sizeGroups).forEach((groupName) => {
    if (groupName !== "sourcemaps" && groupName !== "total") {
      sizesToDistribute[groupName] = sizeGroups[groupName];
    }
  });
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

const determineCategory = (urlInfo) => {
  if (urlInfo.type === "sourcemap") {
    return "sourcemap";
  }
  if (urlInfo.type === "html") {
    return "html";
  }
  if (urlInfo.type === "css") {
    return "css";
  }
  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    return "js";
  }
  if (urlInfo.type === "json") {
    return "json";
  }
  return "other";
};

const createRepartitionMessage = ({ html, css, js, json, other, total }) => {
  const addPart = (name, { count, size, percentage }) => {
    parts.push(
      `${ANSI.color(`${name}:`, ANSI.GREY)} ${count} (${inspectFileSize(
        size,
      )} / ${percentage} %)`,
    );
  };

  const parts = [];
  // if (sourcemaps.count) {
  //   parts.push(
  //     `${ANSI.color(`sourcemaps:`, ANSI.GREY)} ${
  //       sourcemaps.count
  //     } (${inspectFileSize(sourcemaps.size)})`,
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
