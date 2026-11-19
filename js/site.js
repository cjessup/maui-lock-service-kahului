(function () {
  var nav = document.getElementById("site-nav");
  var toggle = document.querySelector(".nav-toggle");

  if (nav && toggle) {
    var label = toggle.querySelector(".nav-toggle-label");

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (label) {
        label.textContent = open ? "Close" : "Menu";
      }
    }

    toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("is-open"));
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    });
  }

  document.querySelectorAll(".demo-form").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var note = form.querySelector(".form-note");
      if (!note) {
        return;
      }
      note.hidden = false;
      note.textContent = form.getAttribute("data-note") || "This demo form does not send.";
    });
  });

  var params = new URLSearchParams(window.location.search);
  var query = (params.get("q") || "").trim().toLowerCase();
  var posts = document.querySelectorAll("[data-post]");
  var empty = document.querySelector(".search-empty");
  var searchInput = document.getElementById("search-input");

  if (query && searchInput) {
    searchInput.value = params.get("q");
  }

  if (query && posts.length) {
    var shown = 0;
    posts.forEach(function (post) {
      var hit = post.textContent.toLowerCase().indexOf(query) !== -1;
      post.hidden = !hit;
      if (hit) {
        shown += 1;
      }
    });
    if (empty) {
      empty.hidden = shown !== 0;
    }
  }

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  (function setupServiceTabs() {
    var serviceArea = document.getElementById("service-area");
    var tablist = serviceArea ? serviceArea.querySelector("[role='tablist']") : null;
    if (!serviceArea || !tablist) {
      return;
    }

    var tabButtons = Array.prototype.slice.call(tablist.querySelectorAll("[role='tab']"));
    var tabIds = tabButtons.map(function (tab) {
      return tab.getAttribute("aria-controls");
    });
    var tabPanels = tabIds.map(function (id) {
      return document.getElementById(id);
    });
    if (!tabButtons.length || tabPanels.indexOf(null) !== -1) {
      return;
    }

    var tabsRoot = tablist.closest(".service-tabs") || tablist;
    var stage = document.getElementById("content");
    var indicator = document.createElement("span");
    indicator.className = "service-tab-indicator";
    indicator.setAttribute("aria-hidden", "true");
    tablist.insertBefore(indicator, tablist.firstChild);

    var activeId = "";
    var allowHashScroll = false;
    var motionToken = 0;
    var liveAnims = [];
    var pillGeom = { x: NaN, y: NaN, w: NaN, h: NaN };

    function motionReduced() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function cssRaw(name) {
      return getComputedStyle(tabsRoot).getPropertyValue(name).trim();
    }

    function cssMs(name, fallback) {
      var raw = cssRaw(name);
      if (!raw) {
        return fallback;
      }
      var value = parseFloat(raw);
      if (isNaN(value)) {
        return fallback;
      }
      return /ms$/i.test(raw) ? value : value * 1000;
    }

    function staggerTargets(panel) {
      var found = [];
      function take(el, depth) {
        if (!el || el.nodeType !== 1) {
          return;
        }
        var tag = el.tagName;
        if (
          tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4" || tag === "H5" || tag === "H6" ||
          tag === "P" || tag === "UL" || tag === "OL" || tag === "FIGURE" || tag === "IMG"
        ) {
          found.push(el);
          return;
        }
        if (depth >= 3) {
          return;
        }
        Array.prototype.forEach.call(el.children, function (child) {
          take(child, depth + 1);
        });
      }
      Array.prototype.forEach.call(panel.children, function (child) {
        take(child, 0);
      });
      return found;
    }

    function stopAnims() {
      var batch = liveAnims.splice(0, liveAnims.length);
      batch.forEach(function (anim) {
        try {
          anim.onfinish = null;
          anim.oncancel = null;
          anim.cancel();
        } catch (error) {
          /* already finished or cancelled */
        }
      });
    }

    function clearMotionStyles(panel) {
      panel.style.transformOrigin = "";
      staggerTargets(panel).forEach(function (el) {
        el.style.opacity = "";
        el.style.transform = "";
        el.style.filter = "";
      });
    }

    function applyStable(id, markIn) {
      serviceArea.classList.remove("is-switching");
      if (stage) {
        stage.style.height = "";
        stage.style.minHeight = "";
        stage.style.overflow = "";
      }
      tabPanels.forEach(function (panel) {
        var on = panel.id === id;
        clearMotionStyles(panel);
        panel.classList.remove("is-leaving", "is-entering");
        panel.classList.toggle("is-active", on);
        if (on && markIn) {
          panel.classList.add("is-in");
        }
      });
    }

    function preservePanelFocus(activeEl, outgoingPanels, incoming) {
      if (!activeEl || !incoming || incoming.contains(activeEl)) {
        return;
      }
      var inside = false;
      outgoingPanels.forEach(function (panel) {
        if (panel && panel.contains(activeEl)) {
          inside = true;
        }
      });
      if (!inside) {
        return;
      }
      try {
        incoming.focus({ preventScroll: true });
      } catch (error) {
        incoming.focus();
      }
    }

    function selectedButton() {
      var found = null;
      tabButtons.forEach(function (tab) {
        if (tab.getAttribute("aria-controls") === activeId) {
          found = tab;
        }
      });
      return found;
    }

    // Pill coordinates are content-box offsets inside the scrolling tablist,
    // so a horizontal scroll does not leave the indicator behind.
    function moveIndicator(tab, animate) {
      if (!indicator || !tab) {
        return;
      }
      var tabRect = tab.getBoundingClientRect();
      if (tabRect.width < 1 || tabRect.height < 1) {
        return;
      }
      var listRect = tablist.getBoundingClientRect();
      var x = Math.round((tabRect.left - listRect.left + tablist.scrollLeft) * 100) / 100;
      var y = Math.round((tabRect.top - listRect.top + tablist.scrollTop) * 100) / 100;
      var w = Math.round(tabRect.width * 100) / 100;
      var h = Math.round(tabRect.height * 100) / 100;
      if (
        Math.abs(x - pillGeom.x) < 0.5 &&
        Math.abs(y - pillGeom.y) < 0.5 &&
        Math.abs(w - pillGeom.w) < 0.5 &&
        Math.abs(h - pillGeom.h) < 0.5
      ) {
        return;
      }
      pillGeom.x = x;
      pillGeom.y = y;
      pillGeom.w = w;
      pillGeom.h = h;
      var instant = !animate || motionReduced();
      if (instant) {
        indicator.style.transition = "none";
      }
      indicator.style.width = w + "px";
      indicator.style.height = h + "px";
      indicator.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      if (instant) {
        void indicator.offsetWidth;
        indicator.style.transition = "";
      }
    }

    function headerOffset() {
      var header = document.querySelector(".site-header");
      return header ? header.getBoundingClientRect().height : 0;
    }

    function syncTabsTop() {
      var offset = headerOffset();
      if (offset) {
        document.documentElement.style.setProperty("--header-offset", offset + "px");
      }
    }

    function idFromHash() {
      var raw = location.hash ? location.hash.slice(1) : "";
      if (!raw) {
        return "";
      }
      try {
        raw = decodeURIComponent(raw);
      } catch (error) {
        return "";
      }
      return tabIds.indexOf(raw) === -1 ? "" : raw;
    }

    function tabIdFromLocation() {
      return idFromHash() || "introduction";
    }

    function scrollTabIntoStrip(tab) {
      if (!tablist.clientWidth) {
        return;
      }
      var pad = 8;
      var tabRect = tab.getBoundingClientRect();
      var listRect = tablist.getBoundingClientRect();
      if (tabRect.left < listRect.left + pad) {
        tablist.scrollLeft -= listRect.left + pad - tabRect.left;
      } else if (tabRect.right > listRect.right - pad) {
        tablist.scrollLeft += tabRect.right - (listRect.right - pad);
      }
    }

    function scrollInstant(x, y) {
      var root = document.documentElement;
      var previous = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(x, y);
      root.style.scrollBehavior = previous;
    }

    function scrollTabsBelowHeader() {
      syncTabsTop();
      var top = serviceArea.getBoundingClientRect().top + window.pageYOffset - headerOffset();
      if (top < 0) {
        top = 0;
      }
      scrollInstant(window.pageXOffset, top);
    }

    function animateTo(id, token) {
      var incoming = document.getElementById(id);
      if (!incoming || !stage || typeof incoming.animate !== "function") {
        stopAnims();
        applyStable(id, true);
        return;
      }

      var outgoing = null;
      tabPanels.forEach(function (panel) {
        if (panel !== incoming && panel.classList.contains("is-active")) {
          outgoing = panel;
        }
      });
      var startOpacity = 1;
      if (outgoing) {
        var parsedOpacity = parseFloat(getComputedStyle(outgoing).opacity);
        if (!isNaN(parsedOpacity)) {
          startOpacity = parsedOpacity;
        }
      }

      var fromH = stage.getBoundingClientRect().height;
      stage.style.height = fromH + "px";
      stage.style.minHeight = fromH + "px";
      stage.style.overflow = "hidden";
      // Lock the visible height before cancelling, or a filled height animation
      // would drop and the page would jump.
      stopAnims();
      if (token !== motionToken) {
        return;
      }

      try {
        tabPanels.forEach(function (panel) {
          if (panel !== incoming && panel !== outgoing) {
            panel.classList.remove("is-active", "is-leaving", "is-entering");
          }
        });

        if (outgoing) {
          outgoing.classList.add("is-leaving", "is-entering");
          outgoing.classList.remove("is-active");
          outgoing.style.transformOrigin = "center top";
        }
        incoming.classList.add("is-active", "is-entering", "is-in");
        incoming.classList.remove("is-leaving");
        incoming.style.transformOrigin = "center top";
        serviceArea.classList.add("is-switching");

        var toH = incoming.getBoundingClientRect().height;
        if (!toH) {
          applyStable(id, true);
          return;
        }
        // A min-height stuck at the taller outgoing panel would block the shrink.
        if (toH < fromH) {
          stage.style.minHeight = toH + "px";
        }

        var outMs = cssMs("--tab-out", 200);
        var inMs = cssMs("--tab-in", 340);
        var staggerMs = cssMs("--tab-stagger", 40);
        var budget = cssMs("--tab-budget", 600);
        var shiftOut = cssRaw("--tab-out-shift") || "6px";
        var shiftIn = cssRaw("--tab-in-shift") || "10px";
        var blurOut = cssRaw("--tab-out-blur") || "4px";
        var blurIn = cssRaw("--tab-in-blur") || "6px";
        var scaleIn = cssRaw("--tab-in-scale") || "0.985";
        var easeOut = cssRaw("--tab-ease-out") || "cubic-bezier(0.22, 1, 0.36, 1)";
        var easeIn = cssRaw("--tab-ease-in") || "ease-in";
        var maxDelay = Math.max(0, budget - inMs);
        var lastDelay = 0;
        var pending = 0;
        var settled = false;
        var backup = 0;

        function finish() {
          if (settled || token !== motionToken) {
            return;
          }
          settled = true;
          if (backup) {
            window.clearTimeout(backup);
          }
          var activeEl = document.activeElement;
          var losers = [];
          tabPanels.forEach(function (panel) {
            if (panel !== incoming && activeEl && panel.contains(activeEl)) {
              losers.push(panel);
            }
          });
          // Move focus while the outgoing panel is still displayed.
          preservePanelFocus(activeEl, losers, incoming);
          stopAnims();
          applyStable(id, true);
          moveIndicator(selectedButton(), false);
        }

        function track(anim) {
          if (!anim) {
            return;
          }
          liveAnims.push(anim);
          if (anim.finished && typeof anim.finished.catch === "function") {
            anim.finished.catch(function () {});
          }
          pending += 1;
          anim.onfinish = function () {
            pending -= 1;
            if (pending <= 0) {
              finish();
            }
          };
        }

        if (outgoing && outgoing !== incoming) {
          track(outgoing.animate(
            [
              { opacity: startOpacity, transform: "translateY(0px)", filter: "blur(0px)" },
              { opacity: 0, transform: "translateY(" + shiftOut + ")", filter: "blur(" + blurOut + ")" }
            ],
            { duration: outMs, easing: easeIn, fill: "forwards" }
          ));
        }

        track(incoming.animate(
          [
            {
              opacity: 0,
              transform: "translateY(" + shiftIn + ") scale(" + scaleIn + ")",
              filter: "blur(" + blurIn + ")"
            },
            { opacity: 1, transform: "translateY(0px) scale(1)", filter: "blur(0px)" }
          ],
          { duration: inMs, easing: easeOut, fill: "both" }
        ));

        staggerTargets(incoming).forEach(function (el, index) {
          var delay = Math.min(index * staggerMs, maxDelay);
          if (delay > lastDelay) {
            lastDelay = delay;
          }
          track(el.animate(
            [
              { opacity: 0, transform: "translateY(" + shiftIn + ")" },
              { opacity: 1, transform: "translateY(0px)" }
            ],
            { duration: inMs, delay: delay, easing: easeOut, fill: "both" }
          ));
        });

        track(stage.animate(
          [{ height: fromH + "px" }, { height: toH + "px" }],
          { duration: Math.max(outMs, inMs), easing: easeOut, fill: "forwards" }
        ));

        if (pending <= 0) {
          finish();
          return;
        }
        backup = window.setTimeout(finish, Math.max(outMs, inMs + lastDelay) + 70);
      } catch (error) {
        if (token !== motionToken) {
          return;
        }
        stopAnims();
        applyStable(id, true);
      }
    }

    function selectTab(id, options) {
      var opts = options || {};
      if (tabIds.indexOf(id) === -1) {
        id = "introduction";
      }
      var changed = activeId !== id;
      activeId = id;
      var selected = null;

      tabButtons.forEach(function (tab) {
        var on = tab.getAttribute("aria-controls") === id;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
        if (!on) {
          return;
        }
        selected = tab;
        if (opts.focus && document.activeElement !== tab) {
          try {
            tab.focus({ preventScroll: true });
          } catch (error) {
            tab.focus();
          }
        }
      });

      if (opts.push) {
        allowHashScroll = false;
        var nextHash = "#" + id;
        if (location.hash !== nextHash) {
          var sx = window.pageXOffset;
          var sy = window.pageYOffset;
          // pushState updates the hash without the fragment scroll location.hash would cause.
          history.pushState({ tab: id }, "", nextHash);
          scrollInstant(sx, sy);
          window.requestAnimationFrame(function () {
            scrollInstant(sx, sy);
          });
        }
      }

      // Checked at switch time so a late prefers-reduced-motion change skips the fade.
      var wantMotion = !!(opts.animate && changed && !motionReduced());
      // Place the pill before scrolling the strip. A scroll event then sees the
      // same content coordinates and does not cancel the slide.
      moveIndicator(selected, wantMotion);
      if (selected) {
        scrollTabIntoStrip(selected);
      }

      if (!changed) {
        return;
      }

      var token = ++motionToken;
      if (!wantMotion) {
        var incomingNow = document.getElementById(id);
        var losers = [];
        if (document.activeElement) {
          tabPanels.forEach(function (panel) {
            if (panel !== incomingNow && panel.contains(document.activeElement)) {
              losers.push(panel);
            }
          });
        }
        stopAnims();
        // showNow marks the panel revealed. The first paint leaves that to the
        // existing double-rAF so the scroll reveal can still play.
        preservePanelFocus(document.activeElement, losers, incomingNow);
        applyStable(id, !!opts.showNow);
        return;
      }

      animateTo(id, token);
    }

    tablist.addEventListener("click", function (event) {
      var tab = event.target.closest("[role='tab']");
      if (!tab || !tablist.contains(tab)) {
        return;
      }
      selectTab(tab.getAttribute("aria-controls"), { push: true, animate: true, showNow: true });
    });

    tablist.addEventListener("keydown", function (event) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      var key = event.key;
      if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") {
        return;
      }
      var current = tabButtons.indexOf(document.activeElement);
      if (current === -1) {
        current = 0;
        tabButtons.forEach(function (tab, index) {
          if (tab.getAttribute("aria-selected") === "true") {
            current = index;
          }
        });
      }
      var next = current;
      if (key === "ArrowLeft") {
        next = (current - 1 + tabButtons.length) % tabButtons.length;
      } else if (key === "ArrowRight") {
        next = (current + 1) % tabButtons.length;
      } else if (key === "Home") {
        next = 0;
      } else if (key === "End") {
        next = tabButtons.length - 1;
      }
      event.preventDefault();
      selectTab(tabButtons[next].getAttribute("aria-controls"), {
        push: true,
        animate: true,
        showNow: true,
        focus: true
      });
    });

    window.addEventListener("hashchange", function () {
      selectTab(tabIdFromLocation(), { animate: true, showNow: true });
    });

    window.addEventListener("popstate", function () {
      selectTab(tabIdFromLocation(), { animate: true, showNow: true });
    });

    function syncIndicator() {
      var tab = selectedButton();
      if (!tab) {
        return;
      }
      moveIndicator(tab, false);
      scrollTabIntoStrip(tab);
    }

    window.addEventListener("resize", function () {
      syncTabsTop();
      syncIndicator();
    });

    tablist.addEventListener("scroll", function () {
      moveIndicator(selectedButton(), false);
    }, { passive: true });

    if ("ResizeObserver" in window) {
      var pillObserver = new ResizeObserver(function () {
        moveIndicator(selectedButton(), false);
      });
      pillObserver.observe(tablist);
      tabButtons.forEach(function (tab) {
        pillObserver.observe(tab);
      });
    }

    var openedFromHash = idFromHash() !== "";
    syncTabsTop();
    selectTab(tabIdFromLocation(), {});
    serviceArea.classList.add("tabs-ready");
    var selectedTab = tablist.querySelector("[aria-selected='true']");
    if (selectedTab) {
      scrollTabIntoStrip(selectedTab);
      moveIndicator(selectedTab, false);
    }

    if (openedFromHash) {
      allowHashScroll = true;
      function stopHashScroll() {
        allowHashScroll = false;
      }
      window.addEventListener("wheel", stopHashScroll, { passive: true, once: true });
      window.addEventListener("touchmove", stopHashScroll, { passive: true, once: true });
      function settleHashScroll() {
        if (!allowHashScroll) {
          return;
        }
        scrollTabsBelowHeader();
      }
      settleHashScroll();
      document.addEventListener("DOMContentLoaded", settleHashScroll);
      window.addEventListener("load", function () {
        settleHashScroll();
        window.setTimeout(settleHashScroll, 0);
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(settleHashScroll);
        });
      });
    } else {
      window.addEventListener("load", syncTabsTop);
    }

    function nudgeIndicator() {
      moveIndicator(selectedButton(), false);
    }

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var activePanel = document.getElementById(activeId);
        if (activePanel && activePanel.classList.contains("is-active") && !activePanel.classList.contains("is-in")) {
          activePanel.classList.add("is-in");
        }
        nudgeIndicator();
      });
    });
    window.addEventListener("load", nudgeIndicator);
  })();

  var nodes = document.querySelectorAll(".reveal");

  if (reduce || !("IntersectionObserver" in window)) {
    nodes.forEach(function (node) {
      node.classList.add("is-in");
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.01, rootMargin: "0px 0px 80px 0px" }
  );

  nodes.forEach(function (node) {
    observer.observe(node);
  });
})();
