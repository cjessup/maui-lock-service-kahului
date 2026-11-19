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
