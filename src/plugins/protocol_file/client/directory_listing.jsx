import { render } from "preact";

const directoryIconUrl = import.meta.resolve("./assets/dir.png");
const fileIconUrl = import.meta.resolve("./assets/file.png");
const homeIconUrl = import.meta.resolve("./assets/home.svg");

const {
  directoryContentMagicName,
  rootDirectoryUrl,
  rootDirectoryUrlForServer,
  mainFilePath,
  directoryUrl,
  directoryContentItems,
} = window.DIRECTORY_LISTING;

const DirectoryListing = () => {
  return (
    <>
      <DirectoryNav />
      <DirectoryContent />
    </>
  );
};

const DirectoryNav = () => {
  const directoryRelativeUrl = urlToRelativeUrl(directoryUrl, rootDirectoryUrl);
  const rootDirectoryUrlName = urlToFilename(rootDirectoryUrl);
  const items = [];
  const parts = directoryRelativeUrl
    ? `${rootDirectoryUrlName}/${directoryRelativeUrl.slice(0, -1)}`.split("/")
    : [rootDirectoryUrlName];
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    const directoryRelativeUrl = `${parts.slice(1, i + 1).join("/")}`;
    const directoryUrl =
      directoryRelativeUrl === ""
        ? rootDirectoryUrl
        : new URL(`${directoryRelativeUrl}/`, rootDirectoryUrl).href;
    let href =
      directoryUrl === rootDirectoryUrlForServer ||
      urlIsInsideOf(directoryUrl, rootDirectoryUrlForServer)
        ? urlToRelativeUrl(directoryUrl, rootDirectoryUrlForServer)
        : directoryUrl;
    if (href === "") {
      href = `/${directoryContentMagicName}`;
    } else {
      href = `/${href}`;
    }
    const text = part;
    items.push({
      href,
      text,
    });
    i++;
  }
  i = 0;

  return (
    <h1 className="directory_nav">
      {parts.map((part, index) => {
        const isLastPart = index === parts.length - 1;
        const { href, text } = part;
        const isServerRootDirectory = false;

        return (
          <>
            <DirectoryNavItem
              key={index}
              url={isLastPart ? null : href}
              iconImageUrl={isServerRootDirectory ? "" : ""}
              iconLinkUrl={isServerRootDirectory ? "" : ""}
              {...part}
            >
              {text}
            </DirectoryNavItem>
            <span className="directory_separator">/</span>
          </>
        );
      })}
    </h1>
  );
};

const DirectoryNavItem = ({ url, iconImageUrl, iconLinkUrl, children }) => {
  return (
    <span className="directory_nav_item" data-has-url={url ? true : undefined}>
      {iconLinkUrl ? (
        <a
          className="directory_nav_item_icon"
          // eslint-disable-next-line react/no-unknown-property
          hot-decline
          href={iconLinkUrl}
        >
          <img src={iconImageUrl} />
        </a>
      ) : iconImageUrl ? (
        <span className="directory_nav_item_icon">
          <img src={iconImageUrl} />
        </span>
      ) : null}
      {url ? (
        <a className="directory_nav_item_text" href={url}>
          {children}
        </a>
      ) : (
        <span className="directory_nav_item_text">{children}</span>
      )}
    </span>
  );
};

const DirectoryContent = () => {
  if (directoryContentItems.length === 0) {
    return <p className="directory_empty_message">Directory is empty</p>;
  }
  return (
    <ul className="directory_content">
      {directoryContentItems.map((directoryContentItem, index) => (
        <DirectoryContentItem key={index} {...directoryContentItem} />
      ))}
    </ul>
  );
};

const DirectoryContentItem = ({
  type,
  fileUrlRelativeToParent,
  fileUrlRelativeToServer,
}) => {
  let href = fileUrlRelativeToServer;
  if (href === "") {
    href = `${directoryContentMagicName}`;
  }
  const isMainFile = href === mainFilePath;
  return (
    <li className="directory_child" data-type={type}>
      <span className="directory_child_icon">
        <img
          src={
            isMainFile
              ? homeIconUrl
              : type === "dir"
                ? directoryIconUrl
                : fileIconUrl
          }
        />
      </span>
      <a
        className="directory_child_text"
        href={`/${href}`}
        // eslint-disable-next-line react/no-unknown-property
        hot-decline={isMainFile ? true : undefined}
      >
        {fileUrlRelativeToParent}
      </a>
    </li>
  );
};

const urlToRelativeUrl = (url, otherUrl) => {
  return url.slice(otherUrl.length);
};
const urlToFilename = (url) => {
  const pathname = new URL(url).pathname;
  const pathnameBeforeLastSlash = pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  const slashLastIndex = pathnameBeforeLastSlash.lastIndexOf("/");
  const filename =
    slashLastIndex === -1
      ? pathnameBeforeLastSlash
      : pathnameBeforeLastSlash.slice(slashLastIndex + 1);
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

render(<DirectoryListing />, document.querySelector("#root"));
