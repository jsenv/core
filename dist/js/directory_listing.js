var n,l,u$1,i,r,o,e,f$1,c,s,a,p={},v=[],y=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,d=Array.isArray;function w(n,l){for(var u in l)n[u]=l[u];return n}function _(n){n&&n.parentNode&&n.parentNode.removeChild(n);}function g(l,u,t){var i,r,o,e={};for(o in u)"key"==o?i=u[o]:"ref"==o?r=u[o]:e[o]=u[o];if(arguments.length>2&&(e.children=arguments.length>3?n.call(arguments,2):t),"function"==typeof l&&null!=l.defaultProps)for(o in l.defaultProps) undefined===e[o]&&(e[o]=l.defaultProps[o]);return m(l,e,i,r,null)}function m(n,t,i,r,o){var e={type:n,props:t,key:i,ref:r,__k:null,__:null,__b:0,__e:null,__c:null,constructor:undefined,__v:null==o?++u$1:o,__i:-1,__u:0};return null==o&&null!=l.vnode&&l.vnode(e),e}function k(n){return n.children}function x(n,l){this.props=n,this.context=l;}function C(n,l){if(null==l)return n.__?C(n.__,n.__i+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return "function"==typeof n.type?C(n):null}function S(n){var l,u;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e){n.__e=n.__c.base=u.__e;break}return S(n)}}function M(n){(!n.__d&&(n.__d=true)&&i.push(n)&&!P.__r++||r!==l.debounceRendering)&&((r=l.debounceRendering)||o)(P);}function P(){var n,u,t,r,o,f,c,s;for(i.sort(e);n=i.shift();)n.__d&&(u=i.length,r=undefined,f=(o=(t=n).__v).__e,c=[],s=[],t.__P&&((r=w({},o)).__v=o.__v+1,l.vnode&&l.vnode(r),j(t.__P,r,o,t.__n,t.__P.namespaceURI,32&o.__u?[f]:null,c,null==f?C(o):f,!!(32&o.__u),s),r.__v=o.__v,r.__.__k[r.__i]=r,z(c,r,s),r.__e!=f&&S(r)),i.length>u&&i.sort(e));P.__r=0;}function $(n,l,u,t,i,r,o,e,f,c,s){var a,h,y,d,w,_,g=t&&t.__k||v,m=l.length;for(f=I(u,l,g,f,m),a=0;a<m;a++)null!=(y=u.__k[a])&&(h=-1===y.__i?p:g[y.__i]||p,y.__i=a,_=j(n,y,h,i,r,o,e,f,c,s),d=y.__e,y.ref&&h.ref!=y.ref&&(h.ref&&V(h.ref,null,y),s.push(y.ref,y.__c||d,y)),null==w&&null!=d&&(w=d),4&y.__u||h.__k===y.__k?f=A(y,f,n):"function"==typeof y.type&&undefined!==_?f=_:d&&(f=d.nextSibling),y.__u&=-7);return u.__e=w,f}function I(n,l,u,t,i){var r,o,e,f,c,s=u.length,a=s,h=0;for(n.__k=new Array(i),r=0;r<i;r++)null!=(o=l[r])&&"boolean"!=typeof o&&"function"!=typeof o?(f=r+h,(o=n.__k[r]="string"==typeof o||"number"==typeof o||"bigint"==typeof o||o.constructor==String?m(null,o,null,null,null):d(o)?m(k,{children:o},null,null,null):undefined===o.constructor&&o.__b>0?m(o.type,o.props,o.key,o.ref?o.ref:null,o.__v):o).__=n,o.__b=n.__b+1,e=null,-1!==(c=o.__i=L(o,u,f,a))&&(a--,(e=u[c])&&(e.__u|=2)),null==e||null===e.__v?(-1==c&&h--,"function"!=typeof o.type&&(o.__u|=4)):c!=f&&(c==f-1?h--:c==f+1?h++:(c>f?h--:h++,o.__u|=4))):n.__k[r]=null;if(a)for(r=0;r<s;r++)null!=(e=u[r])&&0==(2&e.__u)&&(e.__e==t&&(t=C(e)),q(e,e));return t}function A(n,l,u){var t,i;if("function"==typeof n.type){for(t=n.__k,i=0;t&&i<t.length;i++)t[i]&&(t[i].__=n,l=A(t[i],l,u));return l}n.__e!=l&&(l&&n.type&&!u.contains(l)&&(l=C(n)),u.insertBefore(n.__e,l||null),l=n.__e);do{l=l&&l.nextSibling;}while(null!=l&&8==l.nodeType);return l}function L(n,l,u,t){var i,r,o=n.key,e=n.type,f=l[u];if(null===f||f&&o==f.key&&e===f.type&&0==(2&f.__u))return u;if(t>(null!=f&&0==(2&f.__u)?1:0))for(i=u-1,r=u+1;i>=0||r<l.length;){if(i>=0){if((f=l[i])&&0==(2&f.__u)&&o==f.key&&e===f.type)return i;i--;}if(r<l.length){if((f=l[r])&&0==(2&f.__u)&&o==f.key&&e===f.type)return r;r++;}}return  -1}function T(n,l,u){"-"==l[0]?n.setProperty(l,null==u?"":u):n[l]=null==u?"":"number"!=typeof u||y.test(l)?u:u+"px";}function F(n,l,u,t,i){var r;n:if("style"==l)if("string"==typeof u)n.style.cssText=u;else {if("string"==typeof t&&(n.style.cssText=t=""),t)for(l in t)u&&l in u||T(n.style,l,"");if(u)for(l in u)t&&u[l]===t[l]||T(n.style,l,u[l]);}else if("o"==l[0]&&"n"==l[1])r=l!=(l=l.replace(f$1,"$1")),l=l.toLowerCase()in n||"onFocusOut"==l||"onFocusIn"==l?l.toLowerCase().slice(2):l.slice(2),n.l||(n.l={}),n.l[l+r]=u,u?t?u.u=t.u:(u.u=c,n.addEventListener(l,r?a:s,r)):n.removeEventListener(l,r?a:s,r);else {if("http://www.w3.org/2000/svg"==i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!=l&&"height"!=l&&"href"!=l&&"list"!=l&&"form"!=l&&"tabIndex"!=l&&"download"!=l&&"rowSpan"!=l&&"colSpan"!=l&&"role"!=l&&"popover"!=l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null==u||false===u&&"-"!=l[4]?n.removeAttribute(l):n.setAttribute(l,"popover"==l&&1==u?"":u));}}function O(n){return function(u){if(this.l){var t=this.l[u.type+n];if(null==u.t)u.t=c++;else if(u.t<t.u)return;return t(l.event?l.event(u):u)}}}function j(n,u,t,i,r,o,e,f,c,s){var a,h,p,v,y,g,m,b,C,S,M,P,I,A,H,L,T,F=u.type;if(undefined!==u.constructor)return null;128&t.__u&&(c=!!(32&t.__u),o=[f=u.__e=t.__e]),(a=l.__b)&&a(u);n:if("function"==typeof F)try{if(b=u.props,C="prototype"in F&&F.prototype.render,S=(a=F.contextType)&&i[a.__c],M=a?S?S.props.value:a.__:i,t.__c?m=(h=u.__c=t.__c).__=h.__E:(C?u.__c=h=new F(b,M):(u.__c=h=new x(b,M),h.constructor=F,h.render=B),S&&S.sub(h),h.props=b,h.state||(h.state={}),h.context=M,h.__n=i,p=h.__d=!0,h.__h=[],h._sb=[]),C&&null==h.__s&&(h.__s=h.state),C&&null!=F.getDerivedStateFromProps&&(h.__s==h.state&&(h.__s=w({},h.__s)),w(h.__s,F.getDerivedStateFromProps(b,h.__s))),v=h.props,y=h.state,h.__v=u,p)C&&null==F.getDerivedStateFromProps&&null!=h.componentWillMount&&h.componentWillMount(),C&&null!=h.componentDidMount&&h.__h.push(h.componentDidMount);else {if(C&&null==F.getDerivedStateFromProps&&b!==v&&null!=h.componentWillReceiveProps&&h.componentWillReceiveProps(b,M),!h.__e&&(null!=h.shouldComponentUpdate&&!1===h.shouldComponentUpdate(b,h.__s,M)||u.__v==t.__v)){for(u.__v!=t.__v&&(h.props=b,h.state=h.__s,h.__d=!1),u.__e=t.__e,u.__k=t.__k,u.__k.some(function(n){n&&(n.__=u);}),P=0;P<h._sb.length;P++)h.__h.push(h._sb[P]);h._sb=[],h.__h.length&&e.push(h);break n}null!=h.componentWillUpdate&&h.componentWillUpdate(b,h.__s,M),C&&null!=h.componentDidUpdate&&h.__h.push(function(){h.componentDidUpdate(v,y,g);});}if(h.context=M,h.props=b,h.__P=n,h.__e=!1,I=l.__r,A=0,C){for(h.state=h.__s,h.__d=!1,I&&I(u),a=h.render(h.props,h.state,h.context),H=0;H<h._sb.length;H++)h.__h.push(h._sb[H]);h._sb=[];}else do{h.__d=!1,I&&I(u),a=h.render(h.props,h.state,h.context),h.state=h.__s;}while(h.__d&&++A<25);h.state=h.__s,null!=h.getChildContext&&(i=w(w({},i),h.getChildContext())),C&&!p&&null!=h.getSnapshotBeforeUpdate&&(g=h.getSnapshotBeforeUpdate(v,y)),f=$(n,d(L=null!=a&&a.type===k&&null==a.key?a.props.children:a)?L:[L],u,t,i,r,o,e,f,c,s),h.base=u.__e,u.__u&=-161,h.__h.length&&e.push(h),m&&(h.__E=h.__=null);}catch(n){if(u.__v=null,c||null!=o)if(n.then){for(u.__u|=c?160:128;f&&8==f.nodeType&&f.nextSibling;)f=f.nextSibling;o[o.indexOf(f)]=null,u.__e=f;}else for(T=o.length;T--;)_(o[T]);else u.__e=t.__e,u.__k=t.__k;l.__e(n,u,t);}else null==o&&u.__v==t.__v?(u.__k=t.__k,u.__e=t.__e):f=u.__e=N(t.__e,u,t,i,r,o,e,c,s);return (a=l.diffed)&&a(u),128&u.__u?undefined:f}function z(n,u,t){for(var i=0;i<t.length;i++)V(t[i],t[++i],t[++i]);l.__c&&l.__c(u,n),n.some(function(u){try{n=u.__h,u.__h=[],n.some(function(n){n.call(u);});}catch(n){l.__e(n,u.__v);}});}function N(u,t,i,r,o,e,f,c,s){var a,h,v,y,w,g,m,b=i.props,k=t.props,x=t.type;if("svg"==x?o="http://www.w3.org/2000/svg":"math"==x?o="http://www.w3.org/1998/Math/MathML":o||(o="http://www.w3.org/1999/xhtml"),null!=e)for(a=0;a<e.length;a++)if((w=e[a])&&"setAttribute"in w==!!x&&(x?w.localName==x:3==w.nodeType)){u=w,e[a]=null;break}if(null==u){if(null==x)return document.createTextNode(k);u=document.createElementNS(o,x,k.is&&k),c&&(l.__m&&l.__m(t,e),c=false),e=null;}if(null===x)b===k||c&&u.data===k||(u.data=k);else {if(e=e&&n.call(u.childNodes),b=i.props||p,!c&&null!=e)for(b={},a=0;a<u.attributes.length;a++)b[(w=u.attributes[a]).name]=w.value;for(a in b)if(w=b[a],"children"==a);else if("dangerouslySetInnerHTML"==a)v=w;else if(!(a in k)){if("value"==a&&"defaultValue"in k||"checked"==a&&"defaultChecked"in k)continue;F(u,a,null,w,o);}for(a in k)w=k[a],"children"==a?y=w:"dangerouslySetInnerHTML"==a?h=w:"value"==a?g=w:"checked"==a?m=w:c&&"function"!=typeof w||b[a]===w||F(u,a,w,b[a],o);if(h)c||v&&(h.__html===v.__html||h.__html===u.innerHTML)||(u.innerHTML=h.__html),t.__k=[];else if(v&&(u.innerHTML=""),$(u,d(y)?y:[y],t,i,r,"foreignObject"==x?"http://www.w3.org/1999/xhtml":o,e,f,e?e[0]:i.__k&&C(i,0),c,s),null!=e)for(a=e.length;a--;)_(e[a]);c||(a="value","progress"==x&&null==g?u.removeAttribute("value"):undefined!==g&&(g!==u[a]||"progress"==x&&!g||"option"==x&&g!==b[a])&&F(u,a,g,b[a],o),a="checked",undefined!==m&&m!==u[a]&&F(u,a,m,b[a],o));}return u}function V(n,u,t){try{if("function"==typeof n){var i="function"==typeof n.__u;i&&n.__u(),i&&null==u||(n.__u=n(u));}else n.current=u;}catch(n){l.__e(n,t);}}function q(n,u,t){var i,r;if(l.unmount&&l.unmount(n),(i=n.ref)&&(i.current&&i.current!==n.__e||V(i,null,u)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount();}catch(n){l.__e(n,u);}i.base=i.__P=null;}if(i=n.__k)for(r=0;r<i.length;r++)i[r]&&q(i[r],u,t||"function"!=typeof n.type);t||_(n.__e),n.__c=n.__=n.__e=undefined;}function B(n,l,u){return this.constructor(n,u)}function D(u,t,i){var r,o,e,f;t==document&&(t=document.documentElement),l.__&&l.__(u,t),o=(r="function"=="undefined")?null:t.__k,e=[],f=[],j(t,u=(t).__k=g(k,null,[u]),o||p,p,t.namespaceURI,o?null:t.firstChild?n.call(t.childNodes):null,e,o?o.__e:t.firstChild,r,f),z(e,u,f);}n=v.slice,l={__e:function(n,l,u,t){for(var i,r,o;l=l.__;)if((i=l.__c)&&!i.__)try{if((r=i.constructor)&&null!=r.getDerivedStateFromError&&(i.setState(r.getDerivedStateFromError(n)),o=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,t||{}),o=i.__d),o)return i.__E=i}catch(l){n=l;}throw n}},u$1=0,x.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=w({},this.state),"function"==typeof n&&(n=n(w({},u),this.props)),n&&w(u,n),null!=n&&this.__v&&(l&&this._sb.push(l),M(this));},x.prototype.forceUpdate=function(n){this.__v&&(this.__e=true,n&&this.__h.push(n),M(this));},x.prototype.render=k,i=[],o="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,e=function(n,l){return n.__v.__b-l.__v.__b},P.__r=0,f$1=/(PointerCapture)$|Capture$/i,c=0,s=O(false),a=O(true);

var f=0;function u(e,t,n,o,i,u){t||(t={});var a,c,p=t;if("ref"in p)for(c in p={},t)"ref"==c?a=t[c]:p[c]=t[c];var l$1={type:e,props:p,key:n,ref:a,__k:null,__:null,__b:0,__e:null,__c:null,constructor:undefined,__v:--f,__i:-1,__u:0,__source:i,__self:u};if("function"==typeof e&&(a=e.defaultProps))for(c in a) undefined===p[c]&&(p[c]=a[c]);return l.vnode&&l.vnode(l$1),l$1}

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
  return u(k, {
    children: [enoentDetails ? u(ErrorMessage, {}) : null, u(DirectoryNav, {}), u(DirectoryContent, {})]
  });
};
const ErrorMessage = () => {
  const {
    fileUrl
  } = enoentDetails;
  const fileRelativeUrl = urlIsInsideOf(fileUrl, serverRootDirectoryUrl) ? urlToRelativeUrl(fileUrl, serverRootDirectoryUrl) : urlToRelativeUrl(fileUrl, rootDirectoryUrl);
  return u("p", {
    className: "error_message",
    children: u("span", {
      className: "error_text",
      children: ["No entry on the filesystem for", " ", u("code", {
        title: fileUrl,
        children: ["/", fileRelativeUrl]
      }), ".", u("br", {}), "Content of closest parent directory is listed below:"]
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
  return u("h1", {
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
      return u(k, {
        children: [u(DirectoryNavItem, {
          url: isLast ? null : href,
          iconImageUrl: isServerRootDirectory ? homeIconUrl : "",
          iconLinkUrl: isServerRootDirectory ? `/${mainFilePath}` : "",
          children: text
        }, index), u("span", {
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
  return u("span", {
    className: "directory_nav_item",
    "data-has-url": url ? "" : undefined,
    "data-current": url ? undefined : "",
    children: [iconLinkUrl ? u("a", {
      className: "directory_nav_item_icon"
      // eslint-disable-next-line react/no-unknown-property
      ,
      "hot-decline": true,
      href: iconLinkUrl,
      children: u(Icon, {
        url: iconImageUrl
      })
    }) : iconImageUrl ? u("span", {
      className: "directory_nav_item_icon",
      children: u(Icon, {
        url: iconImageUrl
      })
    }) : null, url ? u("a", {
      className: "directory_nav_item_text",
      href: url,
      children: children
    }) : u("span", {
      className: "directory_nav_item_text",
      children: children
    })]
  });
};
const DirectoryContent = () => {
  if (directoryContentItems.length === 0) {
    return u("p", {
      className: "directory_empty_message",
      children: "Directory is empty"
    });
  }
  return u("ul", {
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
      return u(DirectoryContentItem, {
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
      }), children, isDirectory ? u(k, {
        children: [u("span", {
          style: "flex:1"
        }), u("span", {
          className: "directory_content_item_arrow",
          children: u(RightArrowSvg, {})
        })]
      }) : null]
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
D(u(DirectoryListing, {}), document.querySelector("#root"));
