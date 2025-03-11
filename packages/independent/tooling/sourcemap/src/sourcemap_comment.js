export const SOURCEMAP = {
  enabledOnContentType: (contentType) => {
    return ["text/javascript", "text/css"].includes(contentType);
  },

  readComment: ({ contentType, content }) => {
    const read = {
      "text/javascript": parseJavaScriptSourcemapComment,
      "text/css": parseCssSourcemapComment,
    }[contentType];
    return read ? read(content) : null;
  },

  removeComment: ({ contentType, content }) => {
    return SOURCEMAP.writeComment({ contentType, content, specifier: "" });
  },

  writeComment: ({ contentType, content, specifier }) => {
    const write = {
      "text/javascript": setJavaScriptSourceMappingUrl,
      "text/css": setCssSourceMappingUrl,
    }[contentType];
    return write ? write(content, specifier) : content;
  },
};

const parseJavaScriptSourcemapComment = (javaScriptSource) => {
  let sourceMappingUrl;
  replaceSourceMappingUrl(
    javaScriptSource,
    javascriptSourceMappingUrlCommentRegexp,
    (value) => {
      sourceMappingUrl = value;
    },
  );
  if (!sourceMappingUrl) {
    return null;
  }
  return {
    type: "sourcemap_comment",
    subtype: "js",
    // we assume it's on last line
    line: javaScriptSource.split(/\r?\n/).length,
    // ${"//#"} is to avoid static analysis to think there is a sourceMappingUrl for this file
    column: `${"//#"} sourceMappingURL=`.length + 1,
    specifier: sourceMappingUrl,
  };
};

const setJavaScriptSourceMappingUrl = (
  javaScriptSource,
  sourceMappingFileUrl,
) => {
  let replaced;
  const sourceAfterReplace = replaceSourceMappingUrl(
    javaScriptSource,
    javascriptSourceMappingUrlCommentRegexp,
    () => {
      replaced = true;
      return sourceMappingFileUrl
        ? writeJavaScriptSourceMappingURL(sourceMappingFileUrl)
        : "";
    },
  );
  if (replaced) {
    return sourceAfterReplace;
  }

  return sourceMappingFileUrl
    ? `${javaScriptSource}
${writeJavaScriptSourceMappingURL(sourceMappingFileUrl)}
`
    : javaScriptSource;
};

const parseCssSourcemapComment = (cssSource) => {
  let sourceMappingUrl;
  replaceSourceMappingUrl(
    cssSource,
    cssSourceMappingUrlCommentRegExp,
    (value) => {
      sourceMappingUrl = value;
    },
  );
  if (!sourceMappingUrl) {
    return null;
  }
  return {
    type: "sourcemap_comment",
    subtype: "css",
    // we assume it's on last line
    line: cssSource.split(/\r?\n/).length - 1,
    // ${"//*#"} is to avoid static analysis to think there is a sourceMappingUrl for this file
    column: `${"//*#"} sourceMappingURL=`.length + 1,
    specifier: sourceMappingUrl,
  };
};

const setCssSourceMappingUrl = (cssSource, sourceMappingFileUrl) => {
  let replaced;
  const sourceAfterReplace = replaceSourceMappingUrl(
    cssSource,
    cssSourceMappingUrlCommentRegExp,
    () => {
      replaced = true;
      return sourceMappingFileUrl
        ? writeCssSourceMappingUrl(sourceMappingFileUrl)
        : "";
    },
  );
  if (replaced) {
    return sourceAfterReplace;
  }
  return sourceMappingFileUrl
    ? `${cssSource}
${writeCssSourceMappingUrl(sourceMappingFileUrl)}
`
    : cssSource;
};

const javascriptSourceMappingUrlCommentRegexp =
  /\/\/ ?# ?sourceMappingURL=([^\s'"]+)/g;
const cssSourceMappingUrlCommentRegExp =
  /\/\*# ?sourceMappingURL=([^\s'"]+) \*\//g;

// ${"//#"} is to avoid a parser thinking there is a sourceMappingUrl for this file
const writeJavaScriptSourceMappingURL = (value) => {
  return `${"//#"} sourceMappingURL=${value}`;
};
const writeCssSourceMappingUrl = (value) => {
  return `/*# sourceMappingURL=${value} */`;
};

const replaceSourceMappingUrl = (source, regexp, callback) => {
  let lastSourceMappingUrl;
  let matchSourceMappingUrl;
  while ((matchSourceMappingUrl = regexp.exec(source))) {
    lastSourceMappingUrl = matchSourceMappingUrl;
  }
  if (lastSourceMappingUrl) {
    const index = lastSourceMappingUrl.index;
    const before = source.slice(0, index);
    const after = source.slice(index);
    const mappedAfter = after.replace(regexp, (match, firstGroup) => {
      return callback(firstGroup);
    });
    return `${before}${mappedAfter}`;
  }
  return source;
};
