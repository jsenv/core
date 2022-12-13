var l$2;
l$2 = {
  __e: function (n, l, u, i) {
    for (var t, o, r; l = l.__;) if ((t = l.__c) && !t.__) try {
      if ((o = t.constructor) && null != o.getDerivedStateFromError && (t.setState(o.getDerivedStateFromError(n)), r = t.__d), null != t.componentDidCatch && (t.componentDidCatch(n, i || {}), r = t.__d), r) return t.__E = t;
    } catch (l) {
      n = l;
    }
    throw n;
  }
};

var t$1,
  r$1,
  u$1,
  i$1,
  o$1 = 0,
  f$1 = [],
  c$2 = [],
  e$1 = l$2.__b,
  a$2 = l$2.__r,
  v$1 = l$2.diffed,
  l$1 = l$2.__c,
  m = l$2.unmount;
function d$2(t, u) {
  l$2.__h && l$2.__h(r$1, t, o$1 || u), o$1 = 0;
  var i = r$1.__H || (r$1.__H = {
    __: [],
    __h: []
  });
  return t >= i.__.length && i.__.push({
    __V: c$2
  }), i.__[t];
}
function F(n, r) {
  var u = d$2(t$1++, 7);
  return z(u.__H, r) ? (u.__V = n(), u.i = r, u.__h = n, u.__V) : u.__;
}
function b$1() {
  for (var t; t = f$1.shift();) if (t.__P && t.__H) try {
    t.__H.__h.forEach(k), t.__H.__h.forEach(w$1), t.__H.__h = [];
  } catch (r) {
    t.__H.__h = [], l$2.__e(r, t.__v);
  }
}
l$2.__b = function (n) {
  r$1 = null, e$1 && e$1(n);
}, l$2.__r = function (n) {
  a$2 && a$2(n), t$1 = 0;
  var i = (r$1 = n.__c).__H;
  i && (u$1 === r$1 ? (i.__h = [], r$1.__h = [], i.__.forEach(function (n) {
    n.__N && (n.__ = n.__N), n.__V = c$2, n.__N = n.i = void 0;
  })) : (i.__h.forEach(k), i.__h.forEach(w$1), i.__h = [])), u$1 = r$1;
}, l$2.diffed = function (t) {
  v$1 && v$1(t);
  var o = t.__c;
  o && o.__H && (o.__H.__h.length && (1 !== f$1.push(o) && i$1 === l$2.requestAnimationFrame || ((i$1 = l$2.requestAnimationFrame) || j)(b$1)), o.__H.__.forEach(function (n) {
    n.i && (n.__H = n.i), n.__V !== c$2 && (n.__ = n.__V), n.i = void 0, n.__V = c$2;
  })), u$1 = r$1 = null;
}, l$2.__c = function (t, r) {
  r.some(function (t) {
    try {
      t.__h.forEach(k), t.__h = t.__h.filter(function (n) {
        return !n.__ || w$1(n);
      });
    } catch (u) {
      r.some(function (n) {
        n.__h && (n.__h = []);
      }), r = [], l$2.__e(u, t.__v);
    }
  }), l$1 && l$1(t, r);
}, l$2.unmount = function (t) {
  m && m(t);
  var r,
    u = t.__c;
  u && u.__H && (u.__H.__.forEach(function (n) {
    try {
      k(n);
    } catch (n) {
      r = n;
    }
  }), u.__H = void 0, r && l$2.__e(r, u.__v));
};
var g$1 = "function" == typeof requestAnimationFrame;
function j(n) {
  var t,
    r = function () {
      clearTimeout(u), g$1 && cancelAnimationFrame(t), setTimeout(n);
    },
    u = setTimeout(r, 100);
  g$1 && (t = requestAnimationFrame(r));
}
function k(n) {
  var t = r$1,
    u = n.__c;
  "function" == typeof u && (n.__c = void 0, u()), r$1 = t;
}
function w$1(n) {
  var t = r$1;
  n.__c = n.__(), r$1 = t;
}
function z(n, t) {
  return !n || n.length !== t.length || t.some(function (t, r) {
    return t !== n[r];
  });
}

function i() {
  throw new Error("Cycle detected");
}
function t() {
  if (h$1 > 1) {
    h$1--;
    return;
  }
  let i,
    t = !1;
  while (void 0 !== o) {
    let s = o;
    o = void 0;
    f++;
    while (void 0 !== s) {
      const n = s.o;
      s.o = void 0;
      s.f &= -3;
      if (!(8 & s.f) && v(s)) try {
        s.c();
      } catch (s) {
        if (!t) {
          i = s;
          t = !0;
        }
      }
      s = n;
    }
  }
  f = 0;
  h$1--;
  if (t) throw i;
}
let n,
  o,
  h$1 = 0,
  f = 0,
  r = 0;
function e(i) {
  if (void 0 === n) return;
  let t = i.n;
  if (void 0 === t || t.t !== n) {
    t = {
      i: 0,
      S: i,
      p: void 0,
      n: n.s,
      t: n,
      e: void 0,
      x: void 0,
      r: t
    };
    n.s = t;
    i.n = t;
    if (32 & n.f) i.S(t);
    return t;
  } else if (-1 === t.i) {
    t.i = 0;
    if (void 0 !== t.p) {
      t.p.n = t.n;
      if (void 0 !== t.n) t.n.p = t.p;
      t.p = void 0;
      t.n = n.s;
      n.s.p = t;
      n.s = t;
    }
    return t;
  }
}
function u(i) {
  this.v = i;
  this.i = 0;
  this.n = void 0;
  this.t = void 0;
}
u.prototype.h = function () {
  return !0;
};
u.prototype.S = function (i) {
  if (this.t !== i && void 0 === i.e) {
    i.x = this.t;
    if (void 0 !== this.t) this.t.e = i;
    this.t = i;
  }
};
u.prototype.U = function (i) {
  const t = i.e,
    s = i.x;
  if (void 0 !== t) {
    t.x = s;
    i.e = void 0;
  }
  if (void 0 !== s) {
    s.e = t;
    i.x = void 0;
  }
  if (i === this.t) this.t = s;
};
u.prototype.subscribe = function (i) {
  const t = this;
  return b(function () {
    const s = t.value,
      n = 32 & this.f;
    this.f &= -33;
    try {
      i(s);
    } finally {
      this.f |= n;
    }
  });
};
u.prototype.valueOf = function () {
  return this.value;
};
u.prototype.toString = function () {
  return this.value + "";
};
u.prototype.peek = function () {
  return this.v;
};
Object.defineProperty(u.prototype, "value", {
  get() {
    const i = e(this);
    if (void 0 !== i) i.i = this.i;
    return this.v;
  },
  set(s) {
    if (s !== this.v) {
      if (f > 100) i();
      this.v = s;
      this.i++;
      r++;
      h$1++;
      try {
        for (let i = this.t; void 0 !== i; i = i.x) i.t.N();
      } finally {
        t();
      }
    }
  }
});
function c$1(i) {
  return new u(i);
}
function v(i) {
  for (let t = i.s; void 0 !== t; t = t.n) if (t.S.i !== t.i || !t.S.h() || t.S.i !== t.i) return !0;
  return !1;
}
function d$1(i) {
  for (let t = i.s; void 0 !== t; t = t.n) {
    const i = t.S.n;
    if (void 0 !== i) t.r = i;
    t.S.n = t;
    t.i = -1;
  }
}
function l(i) {
  let t,
    s = i.s;
  while (void 0 !== s) {
    const i = s.n;
    if (-1 === s.i) {
      s.S.U(s);
      s.n = void 0;
    } else {
      if (void 0 !== t) t.p = s;
      s.p = void 0;
      s.n = t;
      t = s;
    }
    s.S.n = s.r;
    if (void 0 !== s.r) s.r = void 0;
    s = i;
  }
  i.s = t;
}
function w(i) {
  u.call(this, void 0);
  this.x = i;
  this.s = void 0;
  this.g = r - 1;
  this.f = 4;
}
(w.prototype = new u()).h = function () {
  this.f &= -3;
  if (1 & this.f) return !1;
  if (32 == (36 & this.f)) return !0;
  this.f &= -5;
  if (this.g === r) return !0;
  this.g = r;
  this.f |= 1;
  if (this.i > 0 && !v(this)) {
    this.f &= -2;
    return !0;
  }
  const i = n;
  try {
    d$1(this);
    n = this;
    const i = this.x();
    if (16 & this.f || this.v !== i || 0 === this.i) {
      this.v = i;
      this.f &= -17;
      this.i++;
    }
  } catch (i) {
    this.v = i;
    this.f |= 16;
    this.i++;
  }
  n = i;
  l(this);
  this.f &= -2;
  return !0;
};
w.prototype.S = function (i) {
  if (void 0 === this.t) {
    this.f |= 36;
    for (let i = this.s; void 0 !== i; i = i.n) i.S.S(i);
  }
  u.prototype.S.call(this, i);
};
w.prototype.U = function (i) {
  u.prototype.U.call(this, i);
  if (void 0 === this.t) {
    this.f &= -33;
    for (let i = this.s; void 0 !== i; i = i.n) i.S.U(i);
  }
};
w.prototype.N = function () {
  if (!(2 & this.f)) {
    this.f |= 6;
    for (let i = this.t; void 0 !== i; i = i.x) i.t.N();
  }
};
w.prototype.peek = function () {
  if (!this.h()) i();
  if (16 & this.f) throw this.v;
  return this.v;
};
Object.defineProperty(w.prototype, "value", {
  get() {
    if (1 & this.f) i();
    const t = e(this);
    this.h();
    if (void 0 !== t) t.i = this.i;
    if (16 & this.f) throw this.v;
    return this.v;
  }
});
function a$1(i) {
  return new w(i);
}
function y(i) {
  const s = i.u;
  i.u = void 0;
  if ("function" == typeof s) {
    h$1++;
    const o = n;
    n = void 0;
    try {
      s();
    } catch (t) {
      i.f &= -2;
      i.f |= 8;
      _(i);
      throw t;
    } finally {
      n = o;
      t();
    }
  }
}
function _(i) {
  for (let t = i.s; void 0 !== t; t = t.n) t.S.U(t);
  i.x = void 0;
  i.s = void 0;
  y(i);
}
function g(i) {
  if (n !== this) throw new Error("Out-of-order effect");
  l(this);
  n = i;
  this.f &= -2;
  if (8 & this.f) _(this);
  t();
}
function p$1(i) {
  this.x = i;
  this.u = void 0;
  this.s = void 0;
  this.o = void 0;
  this.f = 32;
}
p$1.prototype.c = function () {
  const i = this.S();
  try {
    if (!(8 & this.f) && void 0 !== this.x) this.u = this.x();
  } finally {
    i();
  }
};
p$1.prototype.S = function () {
  if (1 & this.f) i();
  this.f |= 1;
  this.f &= -9;
  y(this);
  d$1(this);
  h$1++;
  const t = n;
  n = this;
  return g.bind(this, t);
};
p$1.prototype.N = function () {
  if (!(2 & this.f)) {
    this.f |= 2;
    this.o = o;
    o = this;
  }
};
p$1.prototype.d = function () {
  this.f |= 8;
  if (!(1 & this.f)) _(this);
};
function b(i) {
  const t = new p$1(i);
  t.c();
  return t.d.bind(t);
}

function c(t, e) {
  l$2[t] = e.bind(null, l$2[t] || (() => {}));
}
let a;
function d(t) {
  if (a) a();
  a = t && t.S();
}
function p({
  data: t
}) {
  const i = useSignal(t);
  i.value = t;
  const n = F(() => {
    let t = this.__v;
    while (t = t.__) if (t.__c) {
      t.__c.__$f |= 4;
      break;
    }
    this.__$u.c = () => {
      this.base.data = n.peek();
    };
    return a$1(() => {
      let t = i.value.value;
      return 0 === t ? 0 : !0 === t ? "" : t || "";
    });
  }, []);
  return n.value;
}
p.displayName = "_st";
Object.defineProperties(u.prototype, {
  constructor: {
    configurable: !0
  },
  type: {
    configurable: !0,
    value: p
  },
  props: {
    configurable: !0,
    get() {
      return {
        data: this
      };
    }
  },
  __b: {
    configurable: !0,
    value: 1
  }
});
c("__b", (t, i) => {
  if ("string" == typeof i.type) {
    let t,
      e = i.props;
    for (let n in e) {
      if ("children" === n) continue;
      let o = e[n];
      if (o instanceof u) {
        if (!t) i.__np = t = {};
        t[n] = o;
        e[n] = o.peek();
      }
    }
  }
  t(i);
});
c("__r", (t, i) => {
  d();
  let e,
    n = i.__c;
  if (n) {
    n.__$f &= -2;
    e = n.__$u;
    if (void 0 === e) n.__$u = e = function (t) {
      let i;
      b(function () {
        i = this;
      });
      i.c = () => {
        n.__$f |= 1;
        n.setState({});
      };
      return i;
    }();
  }
  d(e);
  t(i);
});
c("__e", (t, i, e, n) => {
  d();
  t(i, e, n);
});
c("diffed", (t, i) => {
  d();
  let e;
  if ("string" == typeof i.type && (e = i.__e)) {
    let t = i.__np,
      n = i.props;
    if (t) {
      let i = e.U;
      if (i) for (let e in i) {
        let n = i[e];
        if (void 0 !== n && !(e in t)) {
          n.d();
          i[e] = void 0;
        }
      } else {
        i = {};
        e.U = i;
      }
      for (let o in t) {
        let r = i[o],
          f = t[o];
        if (void 0 === r) {
          r = h(e, o, f, n);
          i[o] = r;
        } else r.o(f, n);
      }
    }
  }
  t(i);
});
function h(t, i, e, n) {
  const o = i in t && void 0 === t.ownerSVGElement,
    r = c$1(e);
  return {
    o: (t, i) => {
      r.value = t;
      n = i;
    },
    d: b(() => {
      const e = r.value.value;
      if (n[i] !== e) {
        n[i] = e;
        if (o) t[i] = e;else if (e) t.setAttribute(i, e);else t.removeAttribute(i);
      }
    })
  };
}
c("unmount", (t, i) => {
  if ("string" == typeof i.type) {
    let t = i.__e;
    if (t) {
      const i = t.U;
      if (i) {
        t.U = void 0;
        for (let t in i) {
          let e = i[t];
          if (e) e.d();
        }
      }
    }
  } else {
    let t = i.__c;
    if (t) {
      const i = t.__$u;
      if (i) {
        t.__$u = void 0;
        i.d();
      }
    }
  }
  t(i);
});
c("__h", (t, i, e, n) => {
  if (n < 3) i.__$f |= 2;
  t(i, e, n);
});
function useSignal(t) {
  return F(() => c$1(t), []);
}

const paramsFromParentWindow = {};
const searchParams = new URLSearchParams(window.location.search);
searchParams.forEach((value, key) => {
  paramsFromParentWindow[key] = value === "" ? true : value;
});
const parentWindowReloader = window.parent.__reloader__;

const stateFromLocalStorage = localStorage.hasOwnProperty("jsenv_toolbar") ? JSON.parse(localStorage.getItem("jsenv_toolbar")) : {};

const animationsEnabledSignal = c$1(typeof stateFromLocalStorage.animationsEnabled === "boolean" ? stateFromLocalStorage.animationsEnabled : typeof paramsFromParentWindow.animationsEnabled === "boolean" ? paramsFromParentWindow.animationsEnabled : false);

b(() => {
  const animationsEnabled = animationsEnabledSignal.value;
  if (animationsEnabled) {
    document.documentElement.removeAttribute("data-animation-disabled");
  } else {
    document.documentElement.setAttribute("data-animation-disabled", "");
  }
});

const executionTooltipOpenedSignal = c$1(false);
const executionSignal = c$1({
  status: "running"
});
const previousExecutionSignal = c$1(sessionStorage.hasOwnProperty(window.location.href) ? JSON.parse(sessionStorage.getItem(window.location.href)) : null);
window.parent.__supervisor__.getDocumentExecutionResult().then(({
  status,
  startTime,
  endTime
}) => {
  executionSignal.value = {
    status,
    startTime,
    endTime
  };
});

const notificationAPIDetected = typeof window.Notification === "function";

const notificationsEnabledSignal = c$1(typeof stateFromLocalStorage.notificationsEnabled === "boolean" ? stateFromLocalStorage.notificationsEnabled : typeof paramsFromParentWindow.notificationsEnabled === "boolean" ? paramsFromParentWindow.notificationsEnabled : false);
const notificationPermissionSignal = c$1(Notification.permission);

const enableNotifications = () => {
  notificationsEnabledSignal.value = true;
};
const disableNotifications = () => {
  notificationsEnabledSignal.value = false;
};
const arrayOfOpenedNotifications = [];
const notify = notificationAPIDetected ? async (title, {
  clickToFocus = false,
  clickToClose = false,
  ...options
} = {}) => {
  const notificationsEnabled = notificationsEnabledSignal.value;
  if (!notificationsEnabled) {
    return null;
  }
  if (Notification.permission !== "granted") {
    return null;
  }
  const notification = new Notification(title, options);
  arrayOfOpenedNotifications.push(notification);
  notification.onclick = () => {
    // but if the user navigated inbetween
    // focusing window will show something else
    // in that case it could be great to do something
    // maybe like showing a message saying this execution
    // is no longer visible
    // we could also navigauate to this file execution but
    // there is no guarantee re-executing the file would give same output
    // and it would also trigger an other notification
    if (clickToFocus) window.focus();
    if (clickToClose) notification.close();
  };
  notification.onclose = () => {
    const index = arrayOfOpenedNotifications.indexOf(notification);
    if (index > -1) {
      arrayOfOpenedNotifications.splice(index, 1);
    }
  };
  return notification;
} : () => {};
const closeAllNotifications = () => {
  // slice because arrayOfOpenedNotifications can be mutated while looping
  arrayOfOpenedNotifications.slice().forEach(notification => {
    notification.close();
  });
};
let requestPromise;
const requestPermission = notificationAPIDetected ? async () => {
  if (requestPromise) {
    await requestPromise;
    return;
  }
  requestPromise = Notification.requestPermission();
  await requestPromise;
  requestPromise = undefined;
  notificationPermissionSignal.value = Notification.permission;
} : () => Promise.resolve();

const openExecutionTooltip = () => {
  executionTooltipOpenedSignal.value = true;
};
const closeExecutionTooltip = () => {
  executionTooltipOpenedSignal.value = false;
};
const notifyExecutionResult = (execution, previousExecution) => {
  const executedFileRelativeUrl = window.location.href;
  const notificationOptions = {
    lang: "en",
    icon: getFaviconHref(),
    clickToFocus: true,
    clickToClose: true
  };
  if (execution.status === "errored") {
    if (previousExecution) {
      if (previousExecution.status === "completed") {
        notify("Broken", {
          ...notificationOptions,
          body: `${executedFileRelativeUrl} execution now failing.`
        });
      } else {
        notify("Still failing", {
          ...notificationOptions,
          body: `${executedFileRelativeUrl} execution still failing.`
        });
      }
    } else {
      notify("Failing", {
        ...notificationOptions,
        body: `${executedFileRelativeUrl} execution failed.`
      });
    }
  } else if (previousExecution && previousExecution.status === "errored") {
    notify("Fixed", {
      ...notificationOptions,
      body: `${executedFileRelativeUrl} execution fixed.`
    });
  }
};
const getFaviconHref = () => {
  const link = document.querySelector('link[rel="icon"]');
  return link ? link.href : undefined;
};

b(() => {
  const execution = executionSignal.value;
  if (execution) {
    sessionStorage.setItem(window.location.href, JSON.stringify(execution));
  }
});
b(() => {
  const execution = executionSignal.value;
  const previousExecution = previousExecutionSignal.value;
  if (execution) {
    notifyExecutionResult(execution, previousExecution);
  }
});

b(() => {
  const notificationsEnabled = notificationsEnabledSignal.value;
  if (!notificationsEnabled) {
    closeAllNotifications();
  }
});

const sendEventToParent = (name, data) => {
  window.parent.postMessage({
    __jsenv__: {
      event: name,
      data
    }
  }, "*");
};
const addExternalCommandCallback = (command, callback) => {
  const messageEventCallback = messageEvent => {
    const {
      data
    } = messageEvent;
    if (typeof data !== "object") {
      return;
    }
    const {
      __jsenv__
    } = data;
    if (!__jsenv__) {
      return;
    }
    if (__jsenv__.command !== command) {
      return;
    }
    callback(...__jsenv__.args);
  };
  window.addEventListener("message", messageEventCallback);
  return () => {
    window.removeEventListener("message", messageEventCallback);
  };
};
const enableAutoreload = () => {
  parentWindowReloader.autoreload.enable();
};
const disableAutoreload = () => {
  parentWindowReloader.autoreload.disable();
};

const serverTooltipOpenedSignal = c$1(false);
const serverConnectionSignal = c$1("default");
const serverEvents$1 = window.__server_events__;
if (serverEvents$1) {
  serverEvents$1.readyState.onchange = () => {
    serverConnectionSignal.value = serverEvents$1.readyState.value;
  };
  serverConnectionSignal.value = serverEvents$1.readyState.value;
}

const openServerTooltip = () => {
  serverTooltipOpenedSignal.value = true;
};
const closeServerTooltip = () => {
  serverTooltipOpenedSignal.value = false;
};

const closeAllTooltips = () => {
  closeExecutionTooltip();
  closeServerTooltip();
};

const openedSignal = c$1(typeof stateFromLocalStorage.opened === "boolean" ? stateFromLocalStorage.opened : typeof paramsFromParentWindow.opened === "boolean" ? paramsFromParentWindow.opened : false);

const getToolbarIframe = () => {
  const iframes = Array.from(window.parent.document.querySelectorAll("iframe"));
  return iframes.find(iframe => iframe.contentWindow === window);
};
const forceHideElement = element => {
  element.setAttribute("data-force-hide", "");
};
const removeForceHideElement = element => {
  element.removeAttribute("data-force-hide");
};
const setStyles = (element, styles) => {
  const elementStyle = element.style;
  const restoreStyles = Object.keys(styles).map(styleName => {
    let restore;
    if (styleName in elementStyle) {
      const currentStyle = elementStyle[styleName];
      restore = () => {
        elementStyle[styleName] = currentStyle;
      };
    } else {
      restore = () => {
        delete elementStyle[styleName];
      };
    }
    elementStyle[styleName] = styles[styleName];
    return restore;
  });
  return () => {
    restoreStyles.forEach(restore => restore());
  };
};
const activateToolbarSection = element => {
  element.setAttribute("data-active", "");
};
const deactivateToolbarSection = element => {
  element.removeAttribute("data-active");
};

const startJavaScriptAnimation = ({
  duration = 300,
  timingFunction = t => t,
  onProgress = () => {},
  onCancel = () => {},
  onComplete = () => {}
}) => {
  if (isNaN(duration)) {
    // console.warn(`duration must be a number, received ${duration}`)
    return () => {};
  }
  duration = parseInt(duration, 10);
  const startMs = performance.now();
  let currentRequestAnimationFrameId;
  let done = false;
  let rawProgress = 0;
  let progress = 0;
  const handler = () => {
    currentRequestAnimationFrameId = null;
    const nowMs = performance.now();
    rawProgress = Math.min((nowMs - startMs) / duration, 1);
    progress = timingFunction(rawProgress);
    done = rawProgress === 1;
    onProgress({
      done,
      rawProgress,
      progress
    });
    if (done) {
      onComplete();
    } else {
      currentRequestAnimationFrameId = window.requestAnimationFrame(handler);
    }
  };
  handler();
  const stop = () => {
    if (currentRequestAnimationFrameId) {
      window.cancelAnimationFrame(currentRequestAnimationFrameId);
      currentRequestAnimationFrameId = null;
    }
    if (!done) {
      done = true;
      onCancel({
        rawProgress,
        progress
      });
    }
  };
  return stop;
};

const initToolbarOpening = () => {
  b(() => {
    const opened = openedSignal.value;
    if (opened) {
      showToolbar();
    } else {
      hideToolbar();
    }
  });
};
let restoreToolbarIframeParentStyles = () => {};
let restoreToolbarIframeStyles = () => {};
const hideToolbar = () => {
  closeAllTooltips();
  restoreToolbarIframeParentStyles();
  restoreToolbarIframeStyles();
  document.documentElement.removeAttribute("data-toolbar-visible");
};

// (by the way it might be cool to have the toolbar auto show when)
// it has something to say (being disconnected from server)
const showToolbar = () => {
  const animationsEnabled = animationsEnabledSignal.peek();
  document.documentElement.setAttribute("data-toolbar-visible", "");
  const toolbarIframe = getToolbarIframe();
  const toolbarIframeParent = toolbarIframe.parentNode;
  const parentWindow = window.parent;
  const parentDocumentElement = parentWindow.document.compatMode === "CSS1Compat" ? parentWindow.document.documentElement : parentWindow.document.body;
  const scrollYMax = parentDocumentElement.scrollHeight - parentWindow.innerHeight;
  const scrollY = parentDocumentElement.scrollTop;
  const scrollYRemaining = scrollYMax - scrollY;
  setStyles(toolbarIframeParent, {
    "transition-property": "padding-bottom",
    "transition-duration": animationsEnabled ? "300ms" : "0s"
  });
  // maybe we should use js animation here because we would not conflict with css
  restoreToolbarIframeParentStyles = setStyles(toolbarIframeParent, {
    "scroll-padding-bottom": "40px",
    // same here we should add 40px
    "padding-bottom": "40px" // if there is already one we should add 40px
  });

  restoreToolbarIframeStyles = setStyles(toolbarIframe, {
    height: "40px",
    visibility: "visible"
  });
  if (scrollYRemaining < 40 && scrollYMax > 0) {
    const scrollEnd = scrollY + 40;
    startJavaScriptAnimation({
      duration: 300,
      onProgress: ({
        progress
      }) => {
        const value = scrollY + (scrollEnd - scrollY) * progress;
        parentDocumentElement.scrollTop = value;
      }
    });
  }
};

const createHorizontalBreakpoint = breakpointValue => {
  return createBreakpoint(windowWidthMeasure, breakpointValue);
};
const createMeasure = ({
  compute,
  register
}) => {
  let currentValue = compute();
  const get = () => compute();
  const changed = createSignal();
  let unregister = () => {};
  if (register) {
    unregister = register(() => {
      const value = compute();
      if (value !== currentValue) {
        const previousValue = value;
        currentValue = value;
        changed.notify(value, previousValue);
      }
    });
  }
  return {
    get,
    changed,
    unregister
  };
};
const createSignal = () => {
  const callbackArray = [];
  const listen = callback => {
    callbackArray.push(callback);
    return () => {
      const index = callbackArray.indexOf(callback);
      if (index > -1) {
        callbackArray.splice(index, 1);
      }
    };
  };
  const notify = (...args) => {
    callbackArray.slice().forEach(callback => {
      callback(...args);
    });
  };
  return {
    listen,
    notify
  };
};
const windowWidthMeasure = createMeasure({
  name: "window-width",
  compute: () => window.innerWidth,
  register: onchange => {
    window.addEventListener("resize", onchange);
    window.addEventListener("orientationchange", onchange);
    return () => {
      window.removeEventListener("resize", onchange);
      window.removeEventListener("orientationchange", onchange);
    };
  }
});
const createBreakpoint = (measure, breakpointValue) => {
  const getBreakpointState = () => {
    const value = measure.get();
    if (value < breakpointValue) {
      return "below";
    }
    if (value > breakpointValue) {
      return "above";
    }
    return "equals";
  };
  let currentBreakpointState = getBreakpointState();
  const isAbove = () => {
    return measure.get() > breakpointValue;
  };
  const isBelow = () => {
    return measure.get() < breakpointValue;
  };
  const breakpointChanged = createSignal();
  measure.changed.listen(() => {
    const breakpointState = getBreakpointState();
    if (breakpointState !== currentBreakpointState) {
      const breakpointStatePrevious = currentBreakpointState;
      currentBreakpointState = breakpointState;
      breakpointChanged.notify(breakpointState, breakpointStatePrevious);
    }
  });
  return {
    isAbove,
    isBelow,
    changed: breakpointChanged
  };
};

// const windowScrollTop = createMeasure({
//   name: "window-scroll-top",
//   compute: () => window.scrollTop,
//   register: (onchange) => {
//     window.addEventListener("scroll", onchange)
//     return () => {
//       window.removeEventListener("scroll", onchange)
//     }
//   },
// })

const WINDOW_SMALL_WIDTH = 420;
const initToolbarMenuOverflow = () => {
  // apply responsive design on toolbar icons if needed + add listener on resize screen
  // ideally we should listen breakpoint once, for now restore toolbar
  const overflowMenuBreakpoint = createHorizontalBreakpoint(WINDOW_SMALL_WIDTH);
  const handleOverflowMenuBreakpoint = () => {
    responsiveToolbar(overflowMenuBreakpoint);
  };
  handleOverflowMenuBreakpoint();
  overflowMenuBreakpoint.changed.listen(handleOverflowMenuBreakpoint);
  document.querySelector("#menu_overflow_button").onclick = () => {
    if (overflowMenuIsOpened()) {
      closeOverflowMenu();
    } else {
      openOverflowMenu();
    }
  };
};
const responsiveToolbar = overflowMenuBreakpoint => {
  // close all tooltips in case opened
  closeAllTooltips();
  // close settings box in case opened
  deactivateToolbarSection(document.querySelector("#settings"));
  if (overflowMenuBreakpoint.isBelow()) {
    enableOverflow();
  } else {
    disableOverflow();
  }
};
let moves = [];
const enableOverflow = () => {
  // move elements from toolbar to overflow menu
  const responsiveToolbarElements = document.querySelectorAll("[data-responsive-toolbar-element]");
  const overflowMenu = document.querySelector("#menu_overflow");

  // keep a placeholder element to know where to move them back
  moves = Array.from(responsiveToolbarElements).map(element => {
    const placeholder = document.createElement("div");
    placeholder.style.display = "none";
    placeholder.setAttribute("data-placeholder", "");
    element.parentNode.replaceChild(placeholder, element);
    overflowMenu.appendChild(element);
    return {
      element,
      placeholder
    };
  });
  document.querySelector("#toolbar").setAttribute("data-menu-overflow-enabled", "");
  removeForceHideElement(document.querySelector("#menu_overflow_button"));
};
const disableOverflow = () => {
  // close overflow menu in case it's open & unselect toggleOverflowMenu button in case it's selected
  closeOverflowMenu();
  deactivateToolbarSection(document.querySelector("#menu_overflow"));
  moves.forEach(({
    element,
    placeholder
  }) => {
    placeholder.parentNode.replaceChild(element, placeholder);
  });
  moves = [];
  document.querySelector("#toolbar").removeAttribute("data-menu-overflow-enabled");
  forceHideElement(document.querySelector("#menu_overflow_button"));
};
const overflowMenuIsOpened = () => {
  const toolbar = document.querySelector("#toolbar");
  return toolbar.hasAttribute("data-menu-overflow-opened");
};
const openOverflowMenu = () => {
  const toolbar = document.querySelector("#toolbar");
  document.querySelector("#menu_overflow").setAttribute("data-animate", "");
  toolbar.setAttribute("data-menu-overflow-opened", "");
};
const closeOverflowMenu = () => {
  const toolbar = document.querySelector("#toolbar");
  toolbar.removeAttribute("data-menu-overflow-opened");
  document.querySelector("#menu_overflow").removeAttribute("data-animate");
};

const settingsOpenedSignal = c$1(false);

const openSettings = () => {
  settingsOpenedSignal.value = true;
};
const closeSettings = () => {
  settingsOpenedSignal.value = false;
};

const changesTooltipOpenedSignal = c$1(false);

const renderToolbarOverlay = () => {
  const toolbarOverlay = document.querySelector("#toolbar_overlay");
  toolbarOverlay.onclick = () => {
    closeAllTooltips();
    closeSettings();
  };
  b(() => {
    if (!window.parent) {
      // can happen while parent iframe reloads
      return;
    }
    const opened = openedSignal.value;
    const settingsOpened = settingsOpenedSignal.value;
    const executionTooltipOpened = executionTooltipOpenedSignal.value;
    const changesTooltipOpened = changesTooltipOpenedSignal.value;
    const serverTooltipOpened = serverTooltipOpenedSignal.value;
    if (!opened) {
      return;
    }
    if (settingsOpened || executionTooltipOpened || changesTooltipOpened || serverTooltipOpened) {
      enableIframeOverflowOnParentWindow();
    } else {
      disableIframeOverflowOnParentWindow();
    }
  });
};
const enableIframeOverflowOnParentWindow = () => {
  const iframe = getToolbarIframe();
  const transitionDuration = iframe.style.transitionDuration;
  setStyles(iframe, {
    "height": "100%",
    // we don't want to animate height transition
    // but if it was enabled, we'll restore it afterwards
    "transition-duration": "0ms"
  });
  if (transitionDuration) {
    setTimeout(() => {
      setStyles(iframe, {
        "transition-duration": transitionDuration
      });
    });
  }
};
const disableIframeOverflowOnParentWindow = () => {
  const iframe = getToolbarIframe();
  const transitionDuration = iframe.style.transitionDuration;
  setStyles(iframe, {
    "height": "40px",
    // we don't want to animate height transition
    // but if it was enabled, we'll restore it afterwards
    "transition-duration": "0ms"
  });
  if (transitionDuration) {
    setTimeout(() => {
      setStyles(iframe, {
        "transition-duration": transitionDuration
      });
    });
  }
};

const setLinkHrefForParentWindow = (a, href) => {
  a.href = href;
  a.onclick = e => {
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    e.preventDefault();
    window.parent.location.href = href;
  };
};

const renderDocumentIndexLink = () => {
  setLinkHrefForParentWindow(document.querySelector("#document_index_link"), "/");
};

const enableVariant = (rootNode, variables) => {
  const nodesNotMatching = Array.from(rootNode.querySelectorAll(`[${attributeIndicatingACondition}]`));
  nodesNotMatching.forEach(nodeNotMatching => {
    const conditionAttributeValue = nodeNotMatching.getAttribute(attributeIndicatingACondition);
    const matches = testCondition(conditionAttributeValue, variables);
    if (matches) {
      renameAttribute(nodeNotMatching, attributeIndicatingACondition, attributeIndicatingAMatch);
    }
  });
  const nodesMatching = Array.from(rootNode.querySelectorAll(`[${attributeIndicatingAMatch}]`));
  nodesMatching.forEach(nodeMatching => {
    const conditionAttributeValue = nodeMatching.getAttribute(attributeIndicatingAMatch);
    const matches = testCondition(conditionAttributeValue, variables);
    if (!matches) {
      renameAttribute(nodeMatching, attributeIndicatingAMatch, attributeIndicatingACondition);
    }
  });
};
const testCondition = (conditionAttributeValue, variables) => {
  const condition = parseCondition(conditionAttributeValue);
  return Object.keys(variables).some(key => {
    if (condition.key !== key) {
      return false;
    }
    // the condition do not specify a value, any value is ok
    if (condition.value === undefined) {
      return true;
    }
    if (condition.value === variables[key]) {
      return true;
    }
    return false;
  });
};
const parseCondition = conditionAttributeValue => {
  const colonIndex = conditionAttributeValue.indexOf(":");
  if (colonIndex === -1) {
    return {
      key: conditionAttributeValue,
      value: undefined
    };
  }
  return {
    key: conditionAttributeValue.slice(0, colonIndex),
    value: conditionAttributeValue.slice(colonIndex + 1)
  };
};
const attributeIndicatingACondition = `data-when`;
const attributeIndicatingAMatch = `data-when-active`;
const renameAttribute = (node, name, newName) => {
  node.setAttribute(newName, node.getAttribute(name));
  node.removeAttribute(name);
};

const executionIndicator = document.querySelector("#document_execution_indicator");
const renderDocumentExecutionIndicator = async () => {
  removeForceHideElement(document.querySelector("#document_execution_indicator"));
  b(() => {
    const execution = executionSignal.value;
    updateExecutionIndicator(execution);
  });
  b(() => {
    const executionTooltipOpened = executionTooltipOpenedSignal.value;
    if (executionTooltipOpened) {
      executionIndicator.setAttribute("data-tooltip-visible", "");
    } else {
      executionIndicator.removeAttribute("data-tooltip-visible");
    }
  });
};
const updateExecutionIndicator = ({
  status,
  startTime,
  endTime
} = {}) => {
  enableVariant(executionIndicator, {
    execution: status
  });
  const variantNode = executionIndicator.querySelector("[data-when-active]");
  variantNode.querySelector("button").onclick = () => {
    const executionTooltipOpened = executionTooltipOpenedSignal.value;
    if (executionTooltipOpened) {
      closeExecutionTooltip();
    } else {
      openExecutionTooltip();
    }
  };
  variantNode.querySelector(".tooltip").textContent = computeText({
    status,
    startTime,
    endTime
  });
};

// relative time: https://github.com/tc39/proposal-intl-relative-time/issues/118
const computeText = ({
  status,
  startTime,
  endTime
}) => {
  if (status === "completed") {
    return `Execution completed in ${endTime - startTime}ms`;
  }
  if (status === "errored") {
    return `Execution failed in ${endTime - startTime}ms`;
  }
  if (status === "running") {
    return "Executing...";
  }
  return "";
};

const autoreloadEnabledSignal = c$1(false);
const reloaderStatusSignal = c$1("idle");
const changesSignal = c$1(0);
if (parentWindowReloader) {
  if (!parentWindowReloader.autoreload.enabled && paramsFromParentWindow.autoreload) {
    autoreloadEnabledSignal.value = true;
  } else {
    autoreloadEnabledSignal.value = parentWindowReloader.autoreload.enabled;
  }
  parentWindowReloader.autoreload.onchange = () => {
    autoreloadEnabledSignal.value = parentWindowReloader.autoreload.enabled;
  };
  reloaderStatusSignal.value = parentWindowReloader.status.value;
  const onchange = parentWindowReloader.status.onchange;
  parentWindowReloader.status.onchange = () => {
    onchange();
    reloaderStatusSignal.value = parentWindowReloader.status.value;
  };
  changesSignal.value = parentWindowReloader.changes.value;
  parentWindowReloader.changes.onchange = () => {
    changesSignal.value = [...parentWindowReloader.changes.value];
  };
}

const openChangesToolip = () => {
  changesTooltipOpenedSignal.value = true;
};
const closeChangesToolip = () => {
  changesTooltipOpenedSignal.value = false;
};

const changesIndicator = document.querySelector("#changes_indicator");
const renderChangesIndicator = () => {
  b(() => {
    const autoreloadEnabled = autoreloadEnabledSignal.value;
    const changes = changesSignal.value;
    const changeCount = changes.length;
    enableVariant(changesIndicator, {
      changes: !autoreloadEnabled && changeCount ? "yes" : "no"
    });
    if (changeCount) {
      changesIndicator.querySelector(".tooltip_text").innerHTML = computeTooltipText({
        changes
      });
      changesIndicator.querySelector(".tooltip_text a").onclick = () => {
        // eslint-disable-next-line no-alert
        window.alert(JSON.stringify(changes, null, "  "));
        console.log(changes);
      };
      changesIndicator.querySelector(".changes_text").innerHTML = changeCount;
    }
  });
  changesIndicator.querySelector(".tooltip_action").onclick = () => {
    parentWindowReloader.reload();
  };
  b(() => {
    const changesTooltipOpened = changesTooltipOpenedSignal.value;
    if (changesTooltipOpened) {
      changesIndicator.setAttribute("data-tooltip-visible", "");
    } else {
      changesIndicator.removeAttribute("data-tooltip-visible");
    }
  });
  const button = changesIndicator.querySelector("button");
  button.onclick = () => {
    const changesTooltipOpened = changesTooltipOpenedSignal.value;
    if (changesTooltipOpened) {
      closeChangesToolip();
    } else {
      openChangesToolip();
    }
  };
};
const computeTooltipText = ({
  changes
}) => {
  const changesCount = changes.length;
  if (changesCount === 1) {
    return `There is <a href="javascript:void(0)">1</a> change to apply`;
  }
  return `There is  <a href="javascript:void(0)">${changesCount}<a> changes to apply`;
};

const parentServerEvents = window.parent.__server_events__;
const serverEvents = window.__server_events__;
const serverIndicator = document.querySelector("#server_indicator");
const renderServerIndicator = () => {
  removeForceHideElement(document.querySelector("#server_indicator"));
  b(() => {
    const serverConnection = serverConnectionSignal.value;
    updateServerIndicator(serverConnection);
  });
  b(() => {
    const serverTooltipOpened = serverTooltipOpenedSignal.value;
    if (serverTooltipOpened) {
      serverIndicator.setAttribute("data-tooltip-visible", "");
    } else {
      serverIndicator.removeAttribute("data-tooltip-visible");
    }
  });
};
const updateServerIndicator = connectionState => {
  enableVariant(serverIndicator, {
    connectionState
  });
  const variantNode = document.querySelector("#server_indicator > [data-when-active]");
  variantNode.querySelector("button").onclick = () => {
    const serverTooltipOpened = serverTooltipOpenedSignal.value;
    if (serverTooltipOpened) {
      closeServerTooltip();
    } else {
      openServerTooltip();
    }
  };
  if (connectionState === "connecting") {
    variantNode.querySelector("a").onclick = () => {
      if (parentServerEvents) {
        parentServerEvents.disconnect();
      }
      serverEvents.disconnect();
    };
  } else if (connectionState === "closed") {
    variantNode.querySelector("a").onclick = () => {
      if (parentServerEvents) {
        parentServerEvents.connect();
      }
      serverEvents.connect();
    };
  }
};

const renderToolbarAutoreloadSetting = () => {
  const parentWindowReloader = window.parent.__reloader__;
  if (!parentWindowReloader) {
    disableAutoreloadSetting();
    return;
  }
  const autoreloadCheckbox = document.querySelector("#toggle_autoreload");
  b(() => {
    const autoreloadEnabled = autoreloadEnabledSignal.value;
    if (autoreloadEnabled) {
      autoreloadCheckbox.checked = true;
    } else {
      autoreloadCheckbox.checked = false;
    }
  });
  autoreloadCheckbox.onchange = () => {
    if (autoreloadCheckbox.checked) {
      enableAutoreload();
    } else {
      disableAutoreload();
    }
  };
};
const disableAutoreloadSetting = () => {
  document.querySelector(".settings_autoreload").setAttribute("data-disabled", "true");
  document.querySelector(".settings_autoreload").setAttribute("title", `Autoreload not enabled on server`);
  document.querySelector("#toggle_autoreload").disabled = true;
};

// const changeLink = variantNode.querySelector(".eventsource-changes-link")
// changeLink.innerHTML = reloadMessageCount
// changeLink.onclick = () => {
//   console.log(reloadMessages)
//   // eslint-disable-next-line no-alert
//   window.parent.alert(JSON.stringify(reloadMessages, null, "  "))
// }

// const someFailed = reloadMessages.some((m) => m.status === "failed")
// const somePending = reloadMessages.some((m) => m.status === "pending")
// const applyLink = variantNode.querySelector(".eventsource-reload-link")
// applyLink.innerHTML = someFailed
//   ? "failed"
//   : somePending
//   ? "applying..."
//   : "apply changes"
// applyLink.onclick = someFailed
//   ? () => {
//       parentEventSourceClient.applyReloadMessageEffects()
//     }
//   : somePending
//   ? () => {}
//   : () => {
//       parentEventSourceClient.applyReloadMessageEffects()
//     }

// parentEventSourceClient.reloadMessagesSignal.onchange = () => {
//   updateEventSourceIndicator()
// }
// const autoreloadCheckbox = document.querySelector("#toggle-autoreload")
// autoreloadCheckbox.checked = parentEventSourceClient.isAutoreloadEnabled()
// autoreloadCheckbox.onchange = () => {
//   parentEventSourceClient.setAutoreloadPreference(autoreloadCheckbox.checked)
//   updateEventSourceIndicator()
// }

const enableAnimations = () => {
  animationsEnabledSignal.value = true;
};
const disableAnimations = () => {
  animationsEnabledSignal.value = false;
};

const renderToolbarAnimationSetting = () => {
  const animCheckbox = document.querySelector("#toggle_anims");
  b(() => {
    const animationsEnabled = animationsEnabledSignal.value;
    animCheckbox.checked = animationsEnabled;
  });
  animCheckbox.onchange = () => {
    if (animCheckbox.checked) {
      enableAnimations();
    } else {
      disableAnimations();
    }
  };
  // enable toolbar transition only after first render
  setTimeout(() => {
    document.querySelector("#toolbar").setAttribute("data-animate", "");
  });
};

const notifCheckbox = document.querySelector("#toggle_notifs");
const renderToolbarNotificationSetting = () => {
  b(() => {
    const notificationsEnabled = notificationsEnabledSignal.value;
    notifCheckbox.checked = notificationsEnabled;
  });
  b(() => {
    const notificationPermission = notificationPermissionSignal.value;
    if (!notificationAPIDetected) {
      applyNotificationNotAvailableEffects();
      return;
    }
    if (notificationPermission === "default") {
      applyNotificationDefaultEffects();
      return;
    }
    if (notificationPermission === "denied") {
      applyNotificationDeniedEffects();
      return;
    }
    if (notificationPermission === "granted") {
      applyNotificationGrantedEffects();
      return;
    }
  });
};
const applyNotificationNotAvailableEffects = () => {
  const notifSetting = document.querySelector(".settings_notification");
  notifSetting.setAttribute("data-disabled", "true");
  notifSetting.setAttribute("title", `Notification not available in the browser`);
  notifCheckbox.disabled = true;
};
const applyNotificationDefaultEffects = () => {
  applyNotificationNOTGrantedEffects();
  const notifSetting = document.querySelector(".settings_notification");
  notifSetting.removeAttribute("data-disabled");
  notifSetting.removeAttribute("title");
};
const applyNotificationDeniedEffects = () => {
  applyNotificationNOTGrantedEffects();
  const notifSetting = document.querySelector(".settings_notification");
  notifSetting.setAttribute("data-disabled", "true");
  notifSetting.setAttribute("title", `Notification denied`);
};
const applyNotificationGrantedEffects = () => {
  enableVariant(document.querySelector(".notification_text"), {
    notif_granted: "yes"
  });
  notifCheckbox.disabled = false;
  notifCheckbox.onchange = () => {
    if (notifCheckbox.checked) {
      enableNotifications();
    } else {
      disableNotifications();
    }
  };
};
const applyNotificationNOTGrantedEffects = () => {
  enableVariant(document.querySelector(".notification_text"), {
    notif_granted: "no"
  });
  notifCheckbox.disabled = true;
  notifCheckbox.checked = false;
  document.querySelector("a.request_notification_permission").onclick = () => {
    requestPermission();
  };
};

const themeSignal = c$1(typeof stateFromLocalStorage.theme === "string" ? stateFromLocalStorage.theme : typeof paramsFromParentWindow.theme === "string" ? paramsFromParentWindow.theme : "dark");

const switchToLightTheme = () => {
  themeSignal.value = "light";
};
const switchToDefaultTheme = () => {
  themeSignal.value = "dark";
};

const renderToolbarThemeSetting = () => {
  const checkbox = document.querySelector("#checkbox_dark_theme");
  checkbox.checked = themeSignal.value === "dark";
  checkbox.onchange = () => {
    if (checkbox.checked) {
      switchToDefaultTheme();
    } else {
      switchToLightTheme();
    }
  };
};

const renderToolbarSettings = () => {
  document.querySelector("#settings_open_button").onclick = toggleSettings;
  document.querySelector("#settings_close_button").onclick = toggleSettings;
  disableWarningStyle();
  renderToolbarAutoreloadSetting();
  renderToolbarAnimationSetting();
  renderToolbarNotificationSetting();
  renderToolbarThemeSetting();
  b(() => {
    const settingsOpened = settingsOpenedSignal.value;
    if (settingsOpened) {
      activateToolbarSection(document.querySelector("#settings"));
    } else {
      deactivateToolbarSection(document.querySelector("#settings"));
    }
  });
};
const toggleSettings = () => {
  const settingsOpened = settingsOpenedSignal.value;
  if (settingsOpened) {
    closeSettings();
  } else {
    openSettings();
  }
};
const disableWarningStyle = () => {
  enableVariant(document.querySelector("#settings_open_button"), {
    has_warning: "no"
  });
};

const openToolbar = () => {
  openedSignal.value = true;
};
const closeToolbar = () => {
  openedSignal.value = false;
};

const renderToolbarCloseButton = () => {
  // if user click enter or space quickly while closing toolbar
  // it will cancel the closing
  // that's why I used toggleToolbar and not hideToolbar
  document.querySelector("#toolbar_close_button").onclick = () => {
    if (openedSignal.value) {
      closeToolbar();
    } else {
      openToolbar();
    }
  };
};

const initToolbarUI = () => {
  initToolbarOpening();
  initToolbarMenuOverflow();
  renderToolbarOverlay();
  renderDocumentIndexLink();
  renderDocumentExecutionIndicator();
  renderChangesIndicator();
  renderServerIndicator();
  renderToolbarSettings();
  renderToolbarCloseButton();
};

addExternalCommandCallback("initToolbar", () => {
  // for the first render, force disable animations
  const animationsEnabled = animationsEnabledSignal.value;
  if (animationsEnabled) {
    animationsEnabledSignal.value = false;
  }
  initToolbarUI();
  if (animationsEnabled) {
    animationsEnabledSignal.value = true;
  }
});
sendEventToParent("toolbar_ready");

b(() => {
  const serverConnection = serverConnectionSignal.value;
  if (serverConnection === "connecting" || serverConnection === "closed") {
    openServerTooltip();
  }
});

b(() => {
  const theme = themeSignal.value;
  document.querySelector("html").setAttribute("data-theme", theme);
});

addExternalCommandCallback("openToolbar", openToolbar);
addExternalCommandCallback("closeToolbar", closeToolbar);

const toolbarStateSignal = a$1(() => {
  const opened = openedSignal.value;
  const theme = themeSignal.value;
  const animationsEnabled = animationsEnabledSignal.value;
  const notificationsEnabled = notificationsEnabledSignal.value;
  return {
    opened,
    theme,
    animationsEnabled,
    notificationsEnabled
  };
});

b(() => {
  const toolbarState = toolbarStateSignal.value;
  localStorage.setItem("jsenv_toolbar", JSON.stringify(toolbarState));
  sendEventToParent("toolbar_state_change", toolbarState);
});
