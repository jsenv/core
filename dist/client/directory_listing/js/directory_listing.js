import { F, u, E, k } from "../jsenv_core_node_modules.js";

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
  const directoryItems = E(callback => {
    directoryItemsChangeCallbackSet.add(callback);
  }, () => {
    return directoryContentItems;
  });
  return u(k, {
    children: [enoentDetails ? u(ErrorMessage, {}) : null, u(Breadcrumb, {
      items: breadcrumb
    }), u(DirectoryContent, {
      items: directoryItems
    })]
  });
};
const ErrorMessage = () => {
  const {
    filePathExisting,
    filePathNotFound
  } = enoentDetails;
  let errorText;
  let errorSuggestion;
  errorText = u(k, {
    children: [u("strong", {
      children: "File not found:"
    }), "\xA0", u(Overflow, {
      children: [u("code", {
        children: [u("span", {
          className: "file_path_good",
          children: filePathExisting
        }), u("span", {
          className: "file_path_bad",
          children: filePathNotFound
        })]
      }), " ", "does not exist on the server."]
    })]
  });
  errorSuggestion = u(k, {
    children: [u("span", {
      className: "icon",
      children: "\uD83D\uDD0D"
    }), " Check available routes in", " ", u("a", {
      href: "/.internal/route_inspector",
      children: "route inspector"
    })]
  });
  return u("div", {
    className: "error_message",
    children: [u("p", {
      className: "error_text",
      children: errorText
    }), u("p", {
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
  return u("div", {
    style: "display: flex; flex-wrap: wrap; overflow: hidden; width: 100%; box-sizing: border-box; white-space: nowrap; text-overflow: ellipsis;",
    children: u("div", {
      style: "display: flex; flex-grow: 1; width: 0;",
      children: [u("div", {
        style: "overflow: hidden; max-width: 100%; text-overflow: ellipsis;",
        children: children
      }), afterContent]
    })
  });
};
const Breadcrumb = ({
  items
}) => {
  return u("h1", {
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
      return u(k, {
        children: [u(BreadcrumbItem, {
          url: urlRelativeToServer,
          isCurrent: isCurrent,
          iconImageUrl: isServerRootDirectory ? homeIconUrl : "",
          iconLinkUrl: isServerRootDirectory ? `/${mainFilePath}` : "",
          children: name
        }, url), isDirectory ? u("span", {
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
  return u("span", {
    className: "nav_item",
    "data-current": isCurrent ? "" : undefined,
    children: [iconLinkUrl ? u("a", {
      className: "nav_item_icon"
      // eslint-disable-next-line react/no-unknown-property
      ,
      "hot-decline": true,
      href: iconLinkUrl,
      children: u(Icon, {
        url: iconImageUrl
      })
    }) : iconImageUrl ? u("span", {
      className: "nav_item_icon",
      children: u(Icon, {
        url: iconImageUrl
      })
    }) : null, url ? u("a", {
      className: "nav_item_text",
      href: url,
      children: children
    }) : u("span", {
      className: "nav_item_text",
      children: children
    })]
  });
};
const DirectoryContent = ({
  items
}) => {
  if (items.length === 0) {
    return u("p", {
      className: "directory_empty_message",
      children: "Directory is empty"
    });
  }
  return u("ul", {
    className: "directory_content",
    children: items.map(directoryItem => {
      return u(DirectoryContentItem, {
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
  return u("li", {
    className: "directory_content_item",
    "data-directory": isDirectory ? "" : undefined,
    "data-file": isDirectory ? undefined : "",
    children: u("a", {
      className: "directory_content_item_link",
      href: url
      // eslint-disable-next-line react/no-unknown-property
      ,
      "hot-decline": isMainFile ? true : undefined,
      children: [u("span", {
        className: "directory_content_item_icon",
        children: u(Icon, {
          url: isMainFile ? homeIconUrl : isDirectory ? directoryIconUrl : fileIconUrl
        })
      }), u("span", {
        className: "directory_content_item_text",
        children: [u(Overflow, {
          children: children
        }), isDirectory ? u(k, {
          children: [u("span", {
            style: "flex:1"
          }), u("span", {
            className: "directory_content_item_arrow",
            children: u(RightArrowSvg, {})
          })]
        }) : null]
      })]
    })
  });
};
const RightArrowSvg = () => {
  return u("svg", {
    fill: "currentColor",
    viewBox: "0 0 330 330",
    children: u("path", {
      stroke: "currentColor",
      d: "M250.606,154.389l-150-149.996c-5.857-5.858-15.355-5.858-21.213,0.001 c-5.857,5.858-5.857,15.355,0.001,21.213l139.393,139.39L79.393,304.394c-5.857,5.858-5.857,15.355,0.001,21.213 C82.322,328.536,86.161,330,90,330s7.678-1.464,10.607-4.394l149.999-150.004c2.814-2.813,4.394-6.628,4.394-10.606 C255,161.018,253.42,157.202,250.606,154.389z"
    })
  });
};
const Icon = ({
  url
}) => {
  if (urlToFilename(url).endsWith(".svg")) {
    return u("svg", {
      children: u("use", {
        href: url
      })
    });
  }
  return u("img", {
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
F(u(DirectoryListing, {}), document.querySelector("#root"));
