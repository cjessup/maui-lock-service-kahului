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

    var activeId = "";
    var allowHashScroll = false;

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

    function selectTab(id, options) {
      var opts = options || {};
      if (tabIds.indexOf(id) === -1) {
        id = "introduction";
      }
      var changed = activeId !== id;
      activeId = id;

      tabButtons.forEach(function (tab) {
        var on = tab.getAttribute("aria-controls") === id;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
        if (!on) {
          return;
        }
        scrollTabIntoStrip(tab);
        if (opts.focus && document.activeElement !== tab) {
          try {
            tab.focus({ preventScroll: true });
          } catch (error) {
            tab.focus();
          }
        }
      });

      tabPanels.forEach(function (panel) {
        var on = panel.id === id;
        panel.classList.toggle("is-active", on);
        if (!on) {
          panel.classList.remove("is-entering");
          return;
        }
        // Hidden panels never intersect, so the reveal observer would leave them at opacity 0.
        if (opts.showNow) {
          panel.classList.add("is-in");
        }
      });

      if (opts.animate && changed && !reduce) {
        var activePanel = document.getElementById(id);
        if (activePanel) {
          activePanel.classList.remove("is-entering");
          void activePanel.offsetWidth;
          activePanel.classList.add("is-entering");
        }
      }

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

    window.addEventListener("resize", syncTabsTop);

    serviceArea.addEventListener("animationend", function (event) {
      if (event.animationName !== "tab-panel-in") {
        return;
      }
      if (event.target && event.target.classList) {
        event.target.classList.remove("is-entering");
      }
    });

    var openedFromHash = idFromHash() !== "";
    syncTabsTop();
    selectTab(tabIdFromLocation(), {});
    serviceArea.classList.add("tabs-ready");
    var selectedTab = tablist.querySelector("[aria-selected='true']");
    if (selectedTab) {
      scrollTabIntoStrip(selectedTab);
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

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var activePanel = document.getElementById(activeId);
        if (activePanel && activePanel.classList.contains("is-active") && !activePanel.classList.contains("is-in")) {
          activePanel.classList.add("is-in");
        }
      });
    });
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
