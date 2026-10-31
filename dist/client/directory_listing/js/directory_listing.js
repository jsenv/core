import { K, a, Z, M } from "../jsenv_core_node_modules.js";

const directoryIconUrl = new URL("../other/dir.png", import.meta.url).href;
const fileIconUrl = new URL("../other/file.png", import.meta.url).href;
const homeIconUrl = new URL("../other/home.svg#root", import.meta.url).href;
let {
  breadcrumb,
  mainFilePath,
  directoryContentItems,
  enoentDetails,
  websocketUrl,
  autoreload
} = window.DIRECTORY_LISTING;
const directoryItemsChangeCallbackSet = new Set();
const updateDirectoryContentItems = value => {
  directoryContentItems = value;
  for (const dirContentItem of value) {
    if (dirContentItem.isMainFile && window.location.pathname === "/") {
      window.location.reload();
      return;
    }
    const isDirectory = new URL(dirContentItem.url).pathname.endsWith("/");
    if (!isDirectory && dirContentItem.urlRelativeToServer === window.location.pathname) {
      window.location.reload();
      return;
    }
  }
  for (const directoryItemsChangeCallback of directoryItemsChangeCallbackSet) {
    directoryItemsChangeCallback();
  }
};
const DirectoryListing = () => {
  const directoryItems = Z(callback => {
    directoryItemsChangeCallbackSet.add(callback);
  }, () => {
    return directoryContentItems;
  });
  return a(M, {
    children: [enoentDetails ? a(ErrorMessage, {}) : null, a(Breadcrumb, {
      items: breadcrumb
    }), a(DirectoryContent, {
      items: directoryItems
    })]
  });
};
const ErrorMessage = () => {
  const {
    filePathExisting,
    filePathNotFound,
    spaFallbackFilePaths
  } = enoentDetails;
  let errorText;
  let errorSuggestion;
  let spaExplanation = null;
  if (spaFallbackFilePaths) {
    spaExplanation = a(M, {
      children: [a("strong", {
        children: "SPA mode:"
      }), " a url without extension is a route, served with the closest html file. None of these exists:", a("ul", {
        className: "spa_fallback_list",
        style: "margin: 6px 0 0; padding-left: 20px;",
        children: spaFallbackFilePaths.map(filePath => a("li", {
          children: [a("code", {
            children: filePath
          }), filePath === `/${mainFilePath}` ? " (main file)" : ""]
        }, filePath))
      })]
    });
  }
  errorText = a(M, {
    children: [a("strong", {
      children: "File not found:"
    }), "\xA0", a(Overflow, {
      children: [a("code", {
        children: [a("span", {
          className: "file_path_good",
          children: filePathExisting
        }), a("span", {
          className: "file_path_bad",
          children: filePathNotFound
        })]
      }), " ", "does not exist on the server."]
    })]
  });
  errorSuggestion = a(M, {
    children: [a("span", {
      className: "icon",
      children: "🔍"
    }), " Check available routes in", " ", a("a", {
      href: "/.internal/route_inspector",
      children: "route inspector"
    })]
  });
  return a("div", {
    className: "error_message",
    children: [a("p", {
      className: "error_text",
      children: errorText
    }), spaExplanation ? a("p", {
      className: "error_spa",
      style: "margin-top: 10px;",
      children: spaExplanation
    }) : null, a("p", {
      className: "error_suggestion",
      style: "font-size: 0.8em; margin-top: 10px;",
      children: errorSuggestion
    })]
  });
};
const Overflow = ({
  children,
  afterContent
}) => {
  return a("div", {
    style: "display: flex; flex-wrap: wrap; overflow: hidden; width: 100%; box-sizing: border-box; white-space: nowrap; text-overflow: ellipsis;",
    children: a("div", {
      style: "display: flex; flex-grow: 1; width: 0;",
      children: [a("div", {
        style: "overflow: hidden; max-width: 100%; text-overflow: ellipsis;",
        children: children
      }), afterContent]
    })
  });
};
const Breadcrumb = ({
  items
}) => {
  return a("h1", {
    className: "nav",
    children: items.map(navItem => {
      const {
        url,
        urlRelativeToServer,
        name,
        isCurrent,
        isServerRootDirectory
      } = navItem;
      const isDirectory = new URL(url).pathname.endsWith("/");
      return a(M, {
        children: [a(BreadcrumbItem, {
          url: urlRelativeToServer,
          isCurrent: isCurrent,
          iconImageUrl: isServerRootDirectory ? homeIconUrl : "",
          iconLinkUrl: isServerRootDirectory ? `/${mainFilePath}` : "",
          children: name
        }, url), isDirectory ? a("span", {
          className: "directory_separator",
          children: "/"
        }) : null]
      });
    })
  });
};
const BreadcrumbItem = ({
  url,
  iconImageUrl,
  iconLinkUrl,
  isCurrent,
  children
}) => {
  return a("span", {
    className: "nav_item",
    "data-current": isCurrent ? "" : undefined,
    children: [iconLinkUrl ? a("a", {
      className: "nav_item_icon"
      // eslint-disable-next-line react/no-unknown-property
      ,
      "hot-decline": true,
      href: iconLinkUrl,
      children: a(Icon, {
        url: iconImageUrl
      })
    }) : iconImageUrl ? a("span", {
      className: "nav_item_icon",
      children: a(Icon, {
        url: iconImageUrl
      })
    }) : null, url ? a("a", {
      className: "nav_item_text",
      href: url,
      children: children
    }) : a("span", {
      className: "nav_item_text",
      children: children
    })]
  });
};
const DirectoryContent = ({
  items
}) => {
  if (items.length === 0) {
    return a("p", {
      className: "directory_empty_message",
      children: "Directory is empty"
    });
  }
  return a("ul", {
    className: "directory_content",
    children: items.map(directoryItem => {
      return a(DirectoryContentItem, {
        url: directoryItem.urlRelativeToServer,
        isDirectory: directoryItem.url.endsWith("/"),
        isMainFile: directoryItem.isMainFile,
        children: decodeURI(directoryItem.urlRelativeToCurrentDirectory)
      }, directoryItem.url);
    })
  });
};
const DirectoryContentItem = ({
  url,
  isDirectory,
  isMainFile,
  children
}) => {
  return a("li", {
    className: "directory_content_item",
    "data-directory": isDirectory ? "" : undefined,
    "data-file": isDirectory ? undefined : "",
    children: a("a", {
      className: "directory_content_item_link",
      href: url
      // eslint-disable-next-line react/no-unknown-property
      ,
      "hot-decline": isMainFile ? true : undefined,
      children: [a("span", {
        className: "directory_content_item_icon",
        children: a(Icon, {
          url: isMainFile ? homeIconUrl : isDirectory ? directoryIconUrl : fileIconUrl
        })
      }), a("span", {
        className: "directory_content_item_text",
        children: [a(Overflow, {
          children: children
        }), isDirectory ? a(M, {
          children: [a("span", {
            style: "flex:1"
          }), a("span", {
            className: "directory_content_item_arrow",
            children: a(RightArrowSvg, {})
          })]
        }) : null]
      })]
    })
  });
};
const RightArrowSvg = () => {
  return a("svg", {
    fill: "currentColor",
    viewBox: "0 0 330 330",
    children: a("path", {
      stroke: "currentColor",
      d: "M250.606,154.389l-150-149.996c-5.857-5.858-15.355-5.858-21.213,0.001 c-5.857,5.858-5.857,15.355,0.001,21.213l139.393,139.39L79.393,304.394c-5.857,5.858-5.857,15.355,0.001,21.213 C82.322,328.536,86.161,330,90,330s7.678-1.464,10.607-4.394l149.999-150.004c2.814-2.813,4.394-6.628,4.394-10.606 C255,161.018,253.42,157.202,250.606,154.389z"
    })
  });
};
const Icon = ({
  url
}) => {
  if (urlToFilename(url).endsWith(".svg")) {
    return a("svg", {
      children: a("use", {
        href: url
      })
    });
  }
  return a("img", {
    src: url
  });
};
const urlToFilename = url => {
  const pathname = new URL(url).pathname;
  const pathnameBeforeLastSlash = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const slashLastIndex = pathnameBeforeLastSlash.lastIndexOf("/");
  const filename = slashLastIndex === -1 ? pathnameBeforeLastSlash : pathnameBeforeLastSlash.slice(slashLastIndex + 1);
  return filename;
};
if (autoreload) {
  const socket = new WebSocket(websocketUrl, ["watch-directory"]);
  socket.onopen = () => {
    socket.onopen = null;
    setInterval(() => {
      socket.send('{"type":"ping"}');
    }, 30_000);
  };
  socket.onmessage = messageEvent => {
    const event = JSON.parse(messageEvent.data);
    const {
      type,
      reason,
      items
    } = event;
    if (type === "change") {
      console.log(`update list (reason: ${reason})`);
      // TODO: if index.html is added AND we are at "/" we must reload
      updateDirectoryContentItems(items);
    }
  };
}
K(a(DirectoryListing, {}), document.querySelector("#root"));
