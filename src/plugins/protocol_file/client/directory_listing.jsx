import { render } from "preact";
import { useSyncExternalStore } from "preact/compat";

const directoryIconUrl = import.meta.resolve("./assets/dir.png");
const fileIconUrl = import.meta.resolve("./assets/file.png");
const homeIconUrl = import.meta.resolve("./assets/home.svg#root");

let {
  navItems,
  mainFilePath,
  directoryContentItems,
  enoentDetails,
  websocketUrl,
  autoreload,
} = window.DIRECTORY_LISTING;

const directoryItemsChangeCallbackSet = new Set();
const updateDirectoryContentItems = (value) => {
  directoryContentItems = value;
  for (const dirContentItem of value) {
    if (dirContentItem.isMainFile && window.location.pathname === "/") {
      window.location.reload();
      return;
    }
    const isDirectory = new URL(dirContentItem.url).pathname.endsWith("/");
    if (
      !isDirectory &&
      dirContentItem.urlRelativeToServer === window.location.pathname
    ) {
      window.location.reload();
      return;
    }
  }
  for (const directoryItemsChangeCallback of directoryItemsChangeCallbackSet) {
    directoryItemsChangeCallback();
  }
};

const DirectoryListing = () => {
  const directoryItems = useSyncExternalStore(
    (callback) => {
      directoryItemsChangeCallbackSet.add(callback);
    },
    () => {
      return directoryContentItems;
    },
  );

  return (
    <>
      {enoentDetails ? <ErrorMessage /> : null}
      <Nav />
      <DirectoryContent items={directoryItems} />
    </>
  );
};

const ErrorMessage = () => {
  const { fileUrl, filePathExisting, filePathNotFound } = enoentDetails;

  return (
    <p className="error_message">
      <span className="error_text">
        No filesystem entry at{" "}
        <code title={fileUrl}>
          <span className="file_path_good">{filePathExisting}</span>
          <span className="file_path_bad">{filePathNotFound}</span>
        </code>
        .
      </span>
    </p>
  );
};

const Nav = () => {
  return (
    <h1 className="nav">
      {navItems.map((navItem) => {
        const {
          url,
          urlRelativeToServer,
          name,
          isCurrent,
          isServerRootDirectory,
        } = navItem;
        const isDirectory = new URL(url).pathname.endsWith("/");
        return (
          <>
            <NavItem
              key={url}
              url={urlRelativeToServer}
              isCurrent={isCurrent}
              iconImageUrl={isServerRootDirectory ? homeIconUrl : ""}
              iconLinkUrl={isServerRootDirectory ? `/${mainFilePath}` : ""}
            >
              {name}
            </NavItem>
            {isDirectory ? (
              <span className="directory_separator">/</span>
            ) : null}
          </>
        );
      })}
    </h1>
  );
};
const NavItem = ({ url, iconImageUrl, iconLinkUrl, isCurrent, children }) => {
  return (
    <span className="nav_item" data-current={isCurrent ? "" : undefined}>
      {iconLinkUrl ? (
        <a
          className="nav_item_icon"
          // eslint-disable-next-line react/no-unknown-property
          hot-decline
          href={iconLinkUrl}
        >
          <Icon url={iconImageUrl} />
        </a>
      ) : iconImageUrl ? (
        <span className="nav_item_icon">
          <Icon url={iconImageUrl} />
        </span>
      ) : null}
      {url ? (
        <a className="nav_item_text" href={url}>
          {children}
        </a>
      ) : (
        <span className="nav_item_text">{children}</span>
      )}
    </span>
  );
};

const DirectoryContent = ({ items }) => {
  if (items.length === 0) {
    return <p className="directory_empty_message">Directory is empty</p>;
  }
  return (
    <ul className="directory_content">
      {items.map((directoryItem) => {
        return (
          <DirectoryContentItem
            key={directoryItem.url}
            url={directoryItem.urlRelativeToServer}
            isDirectory={directoryItem.url.endsWith("/")}
            isMainFile={directoryItem.isMainFile}
          >
            {directoryItem.urlRelativeToCurrentDirectory}
          </DirectoryContentItem>
        );
      })}
    </ul>
  );
};
const DirectoryContentItem = ({ url, isDirectory, isMainFile, children }) => {
  return (
    <li
      className="directory_content_item"
      data-directory={isDirectory ? "" : undefined}
      data-file={isDirectory ? undefined : ""}
    >
      <a
        className="directory_content_item_link"
        href={url}
        // eslint-disable-next-line react/no-unknown-property
        hot-decline={isMainFile ? true : undefined}
      >
        <span className="directory_content_item_icon">
          <Icon
            url={
              isMainFile
                ? homeIconUrl
                : isDirectory
                  ? directoryIconUrl
                  : fileIconUrl
            }
          />
        </span>
        {children}
        {isDirectory ? (
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

const Icon = ({ url }) => {
  if (urlToFilename(url).endsWith(".svg")) {
    return (
      <svg>
        <use href={url} />
      </svg>
    );
  }
  return <img src={url} />;
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

if (autoreload) {
  const socket = new WebSocket(websocketUrl, ["watch-directory"]);
  socket.onopen = () => {
    socket.onopen = null;
    setInterval(() => {
      socket.send('{"type":"ping"}');
    }, 30_000);
  };
  socket.onmessage = (messageEvent) => {
    const event = JSON.parse(messageEvent.data);
    const { type, reason, items } = event;
    if (type === "change") {
      console.log(`update list (reason: ${reason})`);
      // TODO: if index.html is added AND we are at "/" we must reload
      updateDirectoryContentItems(items);
    }
  };
}

render(<DirectoryListing />, document.querySelector("#root"));
