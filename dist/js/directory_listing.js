import { render } from "preact";
import { jsx, jsxs, Fragment } from "preact/jsx-runtime";

const directoryIconUrl = new URL("../other/dir.png", import.meta.url).href;
const fileIconUrl = new URL("../other/file.png", import.meta.url).href;
const homeIconUrl = new URL("../other/home.svg", import.meta.url).href;
const {
  directoryContentMagicName,
  rootDirectoryUrl,
  serverRootDirectoryUrl,
  mainFilePath,
  directoryUrl,
  directoryContentItems,
  enoentDetails
} = window.DIRECTORY_LISTING;
const DirectoryListing = () => {
  return jsxs(Fragment, {
    children: [enoentDetails ? jsx(ErrorMessage, {}) : null, jsx(DirectoryNav, {}), jsx(DirectoryContent, {})]
  });
};
const ErrorMessage = () => {
  const {
    fileUrl
  } = enoentDetails;
  const fileRelativeUrl = urlIsInsideOf(fileUrl, serverRootDirectoryUrl) ? urlToRelativeUrl(fileUrl, serverRootDirectoryUrl) : urlToRelativeUrl(fileUrl, rootDirectoryUrl);
  return jsx("p", {
    className: "error_message",
    children: jsxs("span", {
      className: "error_text",
      children: ["No entry on the filesystem for", " ", jsxs("code", {
        title: fileUrl,
        children: ["/", fileRelativeUrl]
      }), ".", jsx("br", {}), "Content of closest parent directory is listed below:"]
    })
  });
};
const DirectoryNav = () => {
  const directoryRelativeUrl = urlToRelativeUrl(directoryUrl, rootDirectoryUrl);
  const rootDirectoryUrlName = urlToFilename(rootDirectoryUrl);
  const items = [];
  const parts = directoryRelativeUrl ? `${rootDirectoryUrlName}/${directoryRelativeUrl.slice(0, -1)}`.split("/") : [rootDirectoryUrlName];
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    const navItemRelativeUrl = `${parts.slice(1, i + 1).join("/")}`;
    const navItemUrl = navItemRelativeUrl === "" ? rootDirectoryUrl : new URL(`${navItemRelativeUrl}/`, rootDirectoryUrl).href;
    const text = part;
    items.push({
      url: navItemUrl,
      text
    });
    i++;
  }
  return jsx("h1", {
    className: "directory_nav",
    children: items.map((item, index) => {
      const {
        url,
        text
      } = item;
      const isServerRootDirectory = url === serverRootDirectoryUrl;
      const isLast = index === parts.length - 1;
      let href = url === serverRootDirectoryUrl || urlIsInsideOf(url, serverRootDirectoryUrl) ? urlToRelativeUrl(url, serverRootDirectoryUrl) : `@fs/${url.slice("file:///".length)}`;
      if (href === "") {
        href = `/${directoryContentMagicName}`;
      } else {
        href = `/${href}`;
      }
      return jsxs(Fragment, {
        children: [jsx(DirectoryNavItem, {
          url: isLast ? null : href,
          iconImageUrl: isServerRootDirectory ? homeIconUrl : "",
          iconLinkUrl: isServerRootDirectory ? `/${mainFilePath}` : "",
          children: text
        }, index), jsx("span", {
          className: "directory_separator",
          children: "/"
        })]
      });
    })
  });
};
const DirectoryNavItem = ({
  url,
  iconImageUrl,
  iconLinkUrl,
  children
}) => {
  return jsxs("span", {
    className: "directory_nav_item",
    "data-has-url": url ? "" : undefined,
    "data-current": url ? undefined : "",
    children: [iconLinkUrl ? jsx("a", {
      className: "directory_nav_item_icon"
      // eslint-disable-next-line react/no-unknown-property
      ,
      "hot-decline": true,
      href: iconLinkUrl,
      children: jsx(Icon, {
        url: iconImageUrl
      })
    }) : iconImageUrl ? jsx("span", {
      className: "directory_nav_item_icon",
      children: jsx(Icon, {
        url: iconImageUrl
      })
    }) : null, url ? jsx("a", {
      className: "directory_nav_item_text",
      href: url,
      children: children
    }) : jsx("span", {
      className: "directory_nav_item_text",
      children: children
    })]
  });
};
const DirectoryContent = () => {
  if (directoryContentItems.length === 0) {
    return jsx("p", {
      className: "directory_empty_message",
      children: "Directory is empty"
    });
  }
  return jsx("ul", {
    className: "directory_content",
    children: directoryContentItems.map(directoryContentItem => {
      const itemUrl = directoryContentItem;
      const isDirectory = directoryContentItem.endsWith("/");
      const isOutsideServerRootDirectory = !urlIsInsideOf(itemUrl, serverRootDirectoryUrl);
      const itemUrlRelativeToCurrentDirectory = urlToRelativeUrl(itemUrl, directoryUrl);
      const text = itemUrlRelativeToCurrentDirectory;
      let url;
      let isMainFile;
      if (isOutsideServerRootDirectory) {
        url = `/@fs/${itemUrl.slice("file:///".length)}`;
        isMainFile = false;
      } else {
        const itemUrlRelativeToServer = urlToRelativeUrl(itemUrl, serverRootDirectoryUrl);
        url = `/${itemUrlRelativeToServer}`;
        isMainFile = itemUrlRelativeToServer === mainFilePath;
      }
      return jsx(DirectoryContentItem, {
        url: url,
        isDirectory: isDirectory,
        isMainFile: isMainFile,
        children: text
      }, url);
    })
  });
};
const DirectoryContentItem = ({
  url,
  isDirectory,
  isMainFile,
  children
}) => {
  return jsx("li", {
    className: "directory_content_item",
    "data-directory": isDirectory ? "" : undefined,
    "data-file": isDirectory ? undefined : "",
    children: jsxs("a", {
      className: "directory_content_item_link",
      href: url
      // eslint-disable-next-line react/no-unknown-property
      ,
      "hot-decline": isMainFile ? true : undefined,
      children: [jsx("span", {
        className: "directory_content_item_icon",
        children: jsx(Icon, {
          url: isMainFile ? homeIconUrl : isDirectory ? directoryIconUrl : fileIconUrl
        })
      }), children, isDirectory ? jsxs(Fragment, {
        children: [jsx("span", {
          style: "flex:1"
        }), jsx("span", {
          className: "directory_content_item_arrow",
          children: jsx(RightArrowSvg, {})
        })]
      }) : null]
    })
  });
};
const RightArrowSvg = () => {
  return jsx("svg", {
    fill: "currentColor",
    viewBox: "0 0 330 330",
    children: jsx("path", {
      stroke: "currentColor",
      d: "M250.606,154.389l-150-149.996c-5.857-5.858-15.355-5.858-21.213,0.001 c-5.857,5.858-5.857,15.355,0.001,21.213l139.393,139.39L79.393,304.394c-5.857,5.858-5.857,15.355,0.001,21.213 C82.322,328.536,86.161,330,90,330s7.678-1.464,10.607-4.394l149.999-150.004c2.814-2.813,4.394-6.628,4.394-10.606 C255,161.018,253.42,157.202,250.606,154.389z"
    })
  });
};
const Icon = ({
  url
}) => {
  if (urlToFilename(url).endsWith(".svg")) {
    return jsx("svg", {
      children: jsx("use", {
        href: url
      })
    });
  }
  return jsx("img", {
    src: url
  });
};
const urlToRelativeUrl = (url, otherUrl) => {
  return url.slice(otherUrl.length);
};
const urlToFilename = url => {
  const pathname = new URL(url).pathname;
  const pathnameBeforeLastSlash = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const slashLastIndex = pathnameBeforeLastSlash.lastIndexOf("/");
  const filename = slashLastIndex === -1 ? pathnameBeforeLastSlash : pathnameBeforeLastSlash.slice(slashLastIndex + 1);
  return filename;
};
const urlIsInsideOf = (url, otherUrl) => {
  const urlObject = new URL(url);
  const otherUrlObject = new URL(otherUrl);
  if (urlObject.origin !== otherUrlObject.origin) {
    return false;
  }
  const urlPathname = urlObject.pathname;
  const otherUrlPathname = otherUrlObject.pathname;
  if (urlPathname === otherUrlPathname) {
    return false;
  }
  const isInside = urlPathname.startsWith(otherUrlPathname);
  return isInside;
};
render(jsx(DirectoryListing, {}), document.querySelector("#root"));
