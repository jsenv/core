import { render } from "preact";
import { useSyncExternalStore } from "preact/compat";

const directoryIconUrl = import.meta.resolve("./assets/dir.png");
const fileIconUrl = import.meta.resolve("./assets/file.png");
const homeIconUrl = import.meta.resolve("./assets/home.svg#root");

let {
  breadcrumb,
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
      <Breadcrumb items={breadcrumb} />
      <DirectoryContent items={directoryItems} />
    </>
  );
};

const ErrorMessage = () => {
  const { filePathExisting, filePathNotFound } = enoentDetails;

  let errorText;
  let errorSuggestion;
  errorText = (
    <>
      <strong>File not found:</strong>&nbsp;
      <Overflow>
        <code>
          <span className="file_path_good">{filePathExisting}</span>
          <span className="file_path_bad">{filePathNotFound}</span>
        </code>{" "}
        does not exist on the server.
      </Overflow>
    </>
  );
  errorSuggestion = (
    <>
      <span className="icon">🔍</span> Check available routes in{" "}
      <a href="/.internal/route_inspector">route inspector</a>
    </>
  );

  return (
    <div className="error_message">
      <p className="error_text">{errorText}</p>
      <p
        className="error_suggestion"
        style="font-size: 0.8em; margin-top: 10px;"
      >
        {errorSuggestion}
      </p>
    </div>
  );
};

const Overflow = ({ children, afterContent }) => {
  return (
    <div style="display: flex; flex-wrap: wrap; overflow: hidden; width: 100%; box-sizing: border-box; white-space: nowrap; text-overflow: ellipsis;">
      <div style="display: flex; flex-grow: 1; width: 0;">
        <div style="overflow: hidden; max-width: 100%; text-overflow: ellipsis;">
          {children}
        </div>
        {afterContent}
      </div>
    </div>
  );
};

const Breadcrumb = ({ items }) => {
  return (
    <h1 className="nav">
      {items.map((navItem) => {
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
            <BreadcrumbItem
              key={url}
              url={urlRelativeToServer}
              isCurrent={isCurrent}
              iconImageUrl={isServerRootDirectory ? homeIconUrl : ""}
              iconLinkUrl={isServerRootDirectory ? `/${mainFilePath}` : ""}
            >
              {name}
            </BreadcrumbItem>
            {isDirectory ? (
              <span className="directory_separator">/</span>
            ) : null}
          </>
        );
      })}
    </h1>
  );
};
const BreadcrumbItem = ({
  url,
  iconImageUrl,
  iconLinkUrl,
  isCurrent,
  children,
}) => {
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
            {decodeURI(directoryItem.urlRelativeToCurrentDirectory)}
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
        <span className="directory_content_item_text">
          <Overflow>{children}</Overflow>
          {isDirectory ? (
            <>
              <span style="flex:1"></span>
              <span className="directory_content_item_arrow">
                <RightArrowSvg />
              </span>
            </>
          ) : null}
        </span>
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
