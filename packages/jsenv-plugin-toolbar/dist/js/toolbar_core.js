var l$3;
l$3 = {
  __e: function (n, l, u, i) {
    for (var t, r, o; l = l.__;) if ((t = l.__c) && !t.__) try {
      if ((r = t.constructor) && null != r.getDerivedStateFromError && (t.setState(r.getDerivedStateFromError(n)), o = t.__d), null != t.componentDidCatch && (t.componentDidCatch(n, i || {}), o = t.__d), o) return t.__E = t;
    } catch (l) {
      n = l;
    }
    throw n;
  }
}, "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout;

var t$1,
  r$1,
  u$1,
  i$1,
  o = 0,
  f$1 = [],
  c$1 = [],
  e$1 = l$3.__b,
  a$1 = l$3.__r,
  v$2 = l$3.diffed,
  l$2 = l$3.__c,
  m = l$3.unmount;
function d$2(t, u) {
  l$3.__h && l$3.__h(r$1, t, o || u), o = 0;
  var i = r$1.__H || (r$1.__H = {
    __: [],
    __h: []
  });
  return t >= i.__.length && i.__.push({
    __V: c$1
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
    t.__H.__h = [], l$3.__e(r, t.__v);
  }
}
l$3.__b = function (n) {
  r$1 = null, e$1 && e$1(n);
}, l$3.__r = function (n) {
  a$1 && a$1(n), t$1 = 0;
  var i = (r$1 = n.__c).__H;
  i && (u$1 === r$1 ? (i.__h = [], r$1.__h = [], i.__.forEach(function (n) {
    n.__N && (n.__ = n.__N), n.__V = c$1, n.__N = n.i = void 0;
  })) : (i.__h.forEach(k), i.__h.forEach(w$1), i.__h = [])), u$1 = r$1;
}, l$3.diffed = function (t) {
  v$2 && v$2(t);
  var o = t.__c;
  o && o.__H && (o.__H.__h.length && (1 !== f$1.push(o) && i$1 === l$3.requestAnimationFrame || ((i$1 = l$3.requestAnimationFrame) || j)(b$1)), o.__H.__.forEach(function (n) {
    n.i && (n.__H = n.i), n.__V !== c$1 && (n.__ = n.__V), n.i = void 0, n.__V = c$1;
  })), u$1 = r$1 = null;
}, l$3.__c = function (t, r) {
  r.some(function (t) {
    try {
      t.__h.forEach(k), t.__h = t.__h.filter(function (n) {
        return !n.__ || w$1(n);
      });
    } catch (u) {
      r.some(function (n) {
        n.__h && (n.__h = []);
      }), r = [], l$3.__e(u, t.__v);
    }
  }), l$2 && l$2(t, r);
}, l$3.unmount = function (t) {
  m && m(t);
  var r,
    u = t.__c;
  u && u.__H && (u.__H.__.forEach(function (n) {
    try {
      k(n);
    } catch (n) {
      r = n;
    }
  }), u.__H = void 0, r && l$3.__e(r, u.__v));
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
  if (!(h > 1)) {
    var i,
      t = !1;
    while (void 0 !== n) {
      var o = n;
      n = void 0;
      s$1++;
      while (void 0 !== o) {
        var r = o.o;
        o.o = void 0;
        o.f &= -3;
        if (!(8 & o.f) && c(o)) try {
          o.c();
        } catch (o) {
          if (!t) {
            i = o;
            t = !0;
          }
        }
        o = r;
      }
    }
    s$1 = 0;
    h--;
    if (t) throw i;
  } else h--;
}
var r = void 0,
  n = void 0,
  h = 0,
  s$1 = 0,
  f = 0;
function v$1(i) {
  if (void 0 !== r) {
    var t = i.n;
    if (void 0 === t || t.t !== r) {
      t = {
        i: 0,
        S: i,
        p: r.s,
        n: void 0,
        t: r,
        e: void 0,
        x: void 0,
        r: t
      };
      if (void 0 !== r.s) r.s.n = t;
      r.s = t;
      i.n = t;
      if (32 & r.f) i.S(t);
      return t;
    } else if (-1 === t.i) {
      t.i = 0;
      if (void 0 !== t.n) {
        t.n.p = t.p;
        if (void 0 !== t.p) t.p.n = t.n;
        t.p = r.s;
        t.n = void 0;
        r.s.n = t;
        r.s = t;
      }
      return t;
    }
  }
}
function e(i) {
  this.v = i;
  this.i = 0;
  this.n = void 0;
  this.t = void 0;
}
e.prototype.h = function () {
  return !0;
};
e.prototype.S = function (i) {
  if (this.t !== i && void 0 === i.e) {
    i.x = this.t;
    if (void 0 !== this.t) this.t.e = i;
    this.t = i;
  }
};
e.prototype.U = function (i) {
  if (void 0 !== this.t) {
    var t = i.e,
      o = i.x;
    if (void 0 !== t) {
      t.x = o;
      i.e = void 0;
    }
    if (void 0 !== o) {
      o.e = t;
      i.x = void 0;
    }
    if (i === this.t) this.t = o;
  }
};
e.prototype.subscribe = function (i) {
  var t = this;
  return b(function () {
    var o = t.value,
      r = 32 & this.f;
    this.f &= -33;
    try {
      i(o);
    } finally {
      this.f |= r;
    }
  });
};
e.prototype.valueOf = function () {
  return this.value;
};
e.prototype.toString = function () {
  return this.value + "";
};
e.prototype.toJSON = function () {
  return this.value;
};
e.prototype.peek = function () {
  return this.v;
};
Object.defineProperty(e.prototype, "value", {
  get: function () {
    var i = v$1(this);
    if (void 0 !== i) i.i = this.i;
    return this.v;
  },
  set: function (o) {
    if (r instanceof l$1) !function () {
      throw new Error("Computed cannot have side-effects");
    }();
    if (o !== this.v) {
      if (s$1 > 100) i();
      this.v = o;
      this.i++;
      f++;
      h++;
      try {
        for (var n = this.t; void 0 !== n; n = n.x) n.t.N();
      } finally {
        t();
      }
    }
  }
});
function u(i) {
  return new e(i);
}
function c(i) {
  for (var t = i.s; void 0 !== t; t = t.n) if (t.S.i !== t.i || !t.S.h() || t.S.i !== t.i) return !0;
  return !1;
}
function d$1(i) {
  for (var t = i.s; void 0 !== t; t = t.n) {
    var o = t.S.n;
    if (void 0 !== o) t.r = o;
    t.S.n = t;
    t.i = -1;
    if (void 0 === t.n) {
      i.s = t;
      break;
    }
  }
}
function a(i) {
  var t = i.s,
    o = void 0;
  while (void 0 !== t) {
    var r = t.p;
    if (-1 === t.i) {
      t.S.U(t);
      if (void 0 !== r) r.n = t.n;
      if (void 0 !== t.n) t.n.p = r;
    } else o = t;
    t.S.n = t.r;
    if (void 0 !== t.r) t.r = void 0;
    t = r;
  }
  i.s = o;
}
function l$1(i) {
  e.call(this, void 0);
  this.x = i;
  this.s = void 0;
  this.g = f - 1;
  this.f = 4;
}
(l$1.prototype = new e()).h = function () {
  this.f &= -3;
  if (1 & this.f) return !1;
  if (32 == (36 & this.f)) return !0;
  this.f &= -5;
  if (this.g === f) return !0;
  this.g = f;
  this.f |= 1;
  if (this.i > 0 && !c(this)) {
    this.f &= -2;
    return !0;
  }
  var i = r;
  try {
    d$1(this);
    r = this;
    var t = this.x();
    if (16 & this.f || this.v !== t || 0 === this.i) {
      this.v = t;
      this.f &= -17;
      this.i++;
    }
  } catch (i) {
    this.v = i;
    this.f |= 16;
    this.i++;
  }
  r = i;
  a(this);
  this.f &= -2;
  return !0;
};
l$1.prototype.S = function (i) {
  if (void 0 === this.t) {
    this.f |= 36;
    for (var t = this.s; void 0 !== t; t = t.n) t.S.S(t);
  }
  e.prototype.S.call(this, i);
};
l$1.prototype.U = function (i) {
  if (void 0 !== this.t) {
    e.prototype.U.call(this, i);
    if (void 0 === this.t) {
      this.f &= -33;
      for (var t = this.s; void 0 !== t; t = t.n) t.S.U(t);
    }
  }
};
l$1.prototype.N = function () {
  if (!(2 & this.f)) {
    this.f |= 6;
    for (var i = this.t; void 0 !== i; i = i.x) i.t.N();
  }
};
l$1.prototype.peek = function () {
  if (!this.h()) i();
  if (16 & this.f) throw this.v;
  return this.v;
};
Object.defineProperty(l$1.prototype, "value", {
  get: function () {
    if (1 & this.f) i();
    var t = v$1(this);
    this.h();
    if (void 0 !== t) t.i = this.i;
    if (16 & this.f) throw this.v;
    return this.v;
  }
});
function w(i) {
  return new l$1(i);
}
function y(i) {
  var o = i.u;
  i.u = void 0;
  if ("function" == typeof o) {
    h++;
    var n = r;
    r = void 0;
    try {
      o();
    } catch (t) {
      i.f &= -2;
      i.f |= 8;
      _(i);
      throw t;
    } finally {
      r = n;
      t();
    }
  }
}
function _(i) {
  for (var t = i.s; void 0 !== t; t = t.n) t.S.U(t);
  i.x = void 0;
  i.s = void 0;
  y(i);
}
function p$1(i) {
  if (r !== this) throw new Error("Out-of-order effect");
  a(this);
  r = i;
  this.f &= -2;
  if (8 & this.f) _(this);
  t();
}
function g(i) {
  this.x = i;
  this.u = void 0;
  this.s = void 0;
  this.o = void 0;
  this.f = 32;
}
g.prototype.c = function () {
  var i = this.S();
  try {
    if (8 & this.f) return;
    if (void 0 === this.x) return;
    var t = this.x();
    if ("function" == typeof t) this.u = t;
  } finally {
    i();
  }
};
g.prototype.S = function () {
  if (1 & this.f) i();
  this.f |= 1;
  this.f &= -9;
  y(this);
  d$1(this);
  h++;
  var t = r;
  r = this;
  return p$1.bind(this, t);
};
g.prototype.N = function () {
  if (!(2 & this.f)) {
    this.f |= 2;
    this.o = n;
    n = this;
  }
};
g.prototype.d = function () {
  this.f |= 8;
  if (!(1 & this.f)) _(this);
};
function b(i) {
  var t = new g(i);
  try {
    t.c();
  } catch (i) {
    t.d();
    throw i;
  }
  return t.d.bind(t);
}

var v;
function s(n, i) {
  l$3[n] = i.bind(null, l$3[n] || function () {});
}
function l(n) {
  if (v) v();
  v = n && n.S();
}
function d(n) {
  var r = this,
    t = n.data,
    f = useSignal(t);
  f.value = t;
  var o = F(function () {
    var n = r.__v;
    while (n = n.__) if (n.__c) {
      n.__c.__$f |= 4;
      break;
    }
    r.__$u.c = function () {
      r.base.data = o.peek();
    };
    return w(function () {
      var n = f.value.value;
      return 0 === n ? 0 : !0 === n ? "" : n || "";
    });
  }, []);
  return o.value;
}
d.displayName = "_st";
Object.defineProperties(e.prototype, {
  constructor: {
    configurable: !0,
    value: void 0
  },
  type: {
    configurable: !0,
    value: d
  },
  props: {
    configurable: !0,
    get: function () {
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
s("__b", function (n, r) {
  if ("string" == typeof r.type) {
    var i,
      t = r.props;
    for (var f in t) if ("children" !== f) {
      var e$1 = t[f];
      if (e$1 instanceof e) {
        if (!i) r.__np = i = {};
        i[f] = e$1;
        t[f] = e$1.peek();
      }
    }
  }
  n(r);
});
s("__r", function (n, r) {
  l();
  var i,
    t = r.__c;
  if (t) {
    t.__$f &= -2;
    if (void 0 === (i = t.__$u)) t.__$u = i = function (n) {
      var r;
      b(function () {
        r = this;
      });
      r.c = function () {
        t.__$f |= 1;
        t.setState({});
      };
      return r;
    }();
  }
  l(i);
  n(r);
});
s("__e", function (n, r, i, t) {
  l();
  n(r, i, t);
});
s("diffed", function (n, r) {
  l();
  var i;
  if ("string" == typeof r.type && (i = r.__e)) {
    var t = r.__np,
      f = r.props;
    if (t) {
      var o = i.U;
      if (o) for (var e in o) {
        var u = o[e];
        if (void 0 !== u && !(e in t)) {
          u.d();
          o[e] = void 0;
        }
      } else i.U = o = {};
      for (var a in t) {
        var v = o[a],
          s = t[a];
        if (void 0 === v) {
          v = p(i, a, s, f);
          o[a] = v;
        } else v.o(s, f);
      }
    }
  }
  n(r);
});
function p(n, r, i, t) {
  var f = r in n && void 0 === n.ownerSVGElement,
    o = u(i);
  return {
    o: function (n, r) {
      o.value = n;
      t = r;
    },
    d: b(function () {
      var i = o.value.value;
      if (t[r] !== i) {
        t[r] = i;
        if (f) n[r] = i;else if (i) n.setAttribute(r, i);else n.removeAttribute(r);
      }
    })
  };
}
s("unmount", function (n, r) {
  if ("string" == typeof r.type) {
    var i = r.__e;
    if (i) {
      var t = i.U;
      if (t) {
        i.U = void 0;
        for (var f in t) {
          var o = t[f];
          if (o) o.d();
        }
      }
    }
  } else {
    var e = r.__c;
    if (e) {
      var u = e.__$u;
      if (u) {
        e.__$u = void 0;
        u.d();
      }
    }
  }
  n(r);
});
s("__h", function (n, r, i, t) {
  if (t < 3) r.__$f |= 2;
  n(r, i, t);
});
function useSignal(n) {
  return F(function () {
    return u(n);
  }, []);
}

const paramsFromParentWindow = {};
const searchParams = new URLSearchParams(window.location.search);
searchParams.forEach((value, key) => {
  paramsFromParentWindow[key] = value === "" ? true : value;
});
const parentWindowReloader = window.parent.__reloader__;

const stateFromLocalStorage = localStorage.hasOwnProperty("jsenv_toolbar") ? JSON.parse(localStorage.getItem("jsenv_toolbar")) : {};

const animationsEnabledSignal = u(typeof stateFromLocalStorage.animationsEnabled === "boolean" ? stateFromLocalStorage.animationsEnabled : typeof paramsFromParentWindow.animationsEnabled === "boolean" ? paramsFromParentWindow.animationsEnabled : false);

b(() => {
  const animationsEnabled = animationsEnabledSignal.value;
  if (animationsEnabled) {
    document.documentElement.removeAttribute("data-animation-disabled");
  } else {
    document.documentElement.setAttribute("data-animation-disabled", "");
  }
});

const executionTooltipOpenedSignal = u(false);
const executionSignal = u({
  status: "running"
});
const previousExecutionSignal = u(sessionStorage.hasOwnProperty(window.location.href) ? JSON.parse(sessionStorage.getItem(window.location.href)) : null);
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

const notificationsEnabledSignal = u(typeof stateFromLocalStorage.notificationsEnabled === "boolean" ? stateFromLocalStorage.notificationsEnabled : typeof paramsFromParentWindow.notificationsEnabled === "boolean" ? paramsFromParentWindow.notificationsEnabled : false);
const notificationPermissionSignal = u(Notification.permission);

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
  if (execution.status === "failed") {
    if (previousExecution) {
      if (previousExecution.status === "completed") {
        notify("Broken", {
          ...notificationOptions,
          body: "".concat(executedFileRelativeUrl, " execution now failing.")
        });
      } else {
        notify("Still failing", {
          ...notificationOptions,
          body: "".concat(executedFileRelativeUrl, " execution still failing.")
        });
      }
    } else {
      notify("Failing", {
        ...notificationOptions,
        body: "".concat(executedFileRelativeUrl, " execution failed.")
      });
    }
  } else if (previousExecution && previousExecution.status === "failed") {
    notify("Fixed", {
      ...notificationOptions,
      body: "".concat(executedFileRelativeUrl, " execution fixed.")
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

const serverTooltipOpenedSignal = u(false);
const serverConnectionSignal = u("default");
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

const openedSignal = u(typeof stateFromLocalStorage.opened === "boolean" ? stateFromLocalStorage.opened : typeof paramsFromParentWindow.opened === "boolean" ? paramsFromParentWindow.opened : false);

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

const settingsOpenedSignal = u(false);

const openSettings = () => {
  settingsOpenedSignal.value = true;
};
const closeSettings = () => {
  settingsOpenedSignal.value = false;
};

const changesTooltipOpenedSignal = u(false);

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
  const nodesNotMatching = Array.from(rootNode.querySelectorAll("[".concat(attributeIndicatingACondition, "]")));
  nodesNotMatching.forEach(nodeNotMatching => {
    const conditionAttributeValue = nodeNotMatching.getAttribute(attributeIndicatingACondition);
    const matches = testCondition(conditionAttributeValue, variables);
    if (matches) {
      renameAttribute(nodeNotMatching, attributeIndicatingACondition, attributeIndicatingAMatch);
    }
  });
  const nodesMatching = Array.from(rootNode.querySelectorAll("[".concat(attributeIndicatingAMatch, "]")));
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
const attributeIndicatingACondition = "data-when";
const attributeIndicatingAMatch = "data-when-active";
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
    return "Execution completed in ".concat(endTime - startTime, "ms");
  }
  if (status === "failed") {
    return "Execution failed in ".concat(endTime - startTime, "ms");
  }
  if (status === "running") {
    return "Executing...";
  }
  return "";
};

const autoreloadEnabledSignal = u(false);
const reloaderStatusSignal = u("idle");
const changesSignal = u(0);
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
    return "There is <a href=\"javascript:void(0)\">1</a> change to apply";
  }
  return "There is  <a href=\"javascript:void(0)\">".concat(changesCount, "<a> changes to apply");
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
  document.querySelector(".settings_autoreload").setAttribute("title", "Autoreload not enabled on server");
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
  notifSetting.setAttribute("title", "Notification not available in the browser");
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
  notifSetting.setAttribute("title", "Notification denied");
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

const themeSignal = u(typeof stateFromLocalStorage.theme === "string" ? stateFromLocalStorage.theme : typeof paramsFromParentWindow.theme === "string" ? paramsFromParentWindow.theme : "dark");

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

const toolbarStateSignal = w(() => {
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
