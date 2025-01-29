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

  return (
    <h1 className="directory_nav">
      {items.map((item, index) => {
        const isLast = index === parts.length - 1;
        const { href, text } = item;
        const isServerRootDirectory = false;

        return (
          <>
            <DirectoryNavItem
              key={index}
              url={isLast ? null : href}
              iconImageUrl={isServerRootDirectory ? "" : ""}
              iconLinkUrl={isServerRootDirectory ? "" : ""}
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
      {directoryContentItems.map((directoryContentItem, index) => {
        return (
          <DirectoryContentItem key={index} {...directoryContentItem}>
            COUCOU
          </DirectoryContentItem>
        );
      })}
    </ul>
  );
};

const DirectoryContentItem = ({
  type,
  fileUrlRelativeToParent,
  fileUrlRelativeToServer,
  children,
}) => {
  let href = fileUrlRelativeToServer;
  if (href === "") {
    href = `${directoryContentMagicName}`;
  }
  const isMainFile = href === mainFilePath;
  const isDirectory = type === "dir";
  return (
    <li className="directory_content_item" data-type={type}>
      <a
        className="directory_content_item_link"
        href={`/${href}`} // eslint-disable-next-line react/no-unknown-property
        hot-decline={isMainFile ? true : undefined}
      >
        <span className="directory_content_item_icon">
          <img
            src={
              isMainFile
                ? homeIconUrl
                : isDirectory
                  ? directoryIconUrl
                  : fileIconUrl
            }
          />
        </span>
        {children}
        {isDirectory || true ? (
          <>
            <span style="flex:1"></span>
            <span className="directory_content_item_arrow">
              <RightArrowSvg />
            </span>
          </>
        ) : null}
      </a>
    </li>
  );
};

const RightArrowSvg = () => {
  return (
    <svg fill="currentColor" viewBox="0 0 330 330">
      <path
        stroke="currentColor"
        d="M250.606,154.389l-150-149.996c-5.857-5.858-15.355-5.858-21.213,0.001
	c-5.857,5.858-5.857,15.355,0.001,21.213l139.393,139.39L79.393,304.394c-5.857,5.858-5.857,15.355,0.001,21.213
	C82.322,328.536,86.161,330,90,330s7.678-1.464,10.607-4.394l149.999-150.004c2.814-2.813,4.394-6.628,4.394-10.606
	C255,161.018,253.42,157.202,250.606,154.389z"
      />
    </svg>
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
