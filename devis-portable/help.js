(function () {
  "use strict";

  const search = document.querySelector("#helpSearch");
  const status = document.querySelector("#helpSearchStatus");
  const empty = document.querySelector("#helpNoResults");
  const topics = [...document.querySelectorAll("[data-help-topic]")];
  const navLinks = [...document.querySelectorAll("[data-help-nav]")];

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr")
      .replace(/\s+/g, " ")
      .trim();
  }

  function topicText(topic) {
    return normalize(`${topic.dataset.searchTerms || ""} ${topic.textContent || ""}`);
  }

  function topicCount(count) {
    return `${count} thème${count === 1 ? "" : "s"}`;
  }

  function setActiveTopic(id) {
    navLinks.forEach((link) => {
      const active = link.dataset.helpNav === id;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function filterTopics() {
    const query = normalize(search?.value);
    const terms = query.split(" ").filter(Boolean);
    let visible = 0;
    topics.forEach((topic) => {
      const haystack = topicText(topic);
      const match = terms.length === 0 || terms.every((term) => haystack.includes(term));
      topic.hidden = !match;
      topic.classList.toggle("search-match", Boolean(query && match));
      if (match) visible += 1;
    });
    empty.hidden = visible > 0;
    status.textContent = query
      ? `${topicCount(visible)} ${visible === 1 ? "trouvé" : "trouvés"} pour « ${search.value.trim()} »`
      : `${topicCount(topics.length)} ${topics.length === 1 ? "disponible" : "disponibles"}`;
    if (query) setActiveTopic("");
    else syncHash();
  }

  function syncHash({ scroll = false } = {}) {
    const id = decodeURIComponent(location.hash.slice(1)) || "overview";
    const target = topics.find((topic) => topic.id === id) || topics[0];
    setActiveTopic(target?.id || "overview");
    if (scroll && target) target.scrollIntoView({ block: "start" });
  }

  search?.addEventListener("input", filterTopics);
  document.querySelector("#clearHelpSearch")?.addEventListener("click", () => {
    search.value = "";
    filterTopics();
    search.focus();
  });
  document.querySelector("#printHelpButton")?.addEventListener("click", () => window.print());
  navLinks.forEach((link) => link.addEventListener("click", () => {
    if (search?.value) {
      search.value = "";
      filterTopics();
    }
    setActiveTopic(link.dataset.helpNav);
  }));
  window.addEventListener("hashchange", () => syncHash({ scroll: true }));

  if ("IntersectionObserver" in window) {
    const visibleTopics = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visibleTopics.set(entry.target.id, entry.intersectionRatio);
        else visibleTopics.delete(entry.target.id);
      });
      if (normalize(search?.value)) return;
      const current = [...visibleTopics.entries()].sort((left, right) => right[1] - left[1])[0];
      if (current) setActiveTopic(current[0]);
    }, { rootMargin: "-18% 0px -58% 0px", threshold: [0, 0.2, 0.5, 0.8] });
    topics.forEach((topic) => observer.observe(topic));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.matches("input, textarea, select")) {
      event.preventDefault();
      search?.focus();
    }
    if (event.key === "Escape") {
      if (search?.value) {
        search.value = "";
        filterTopics();
        search.focus();
        return;
      }
      if (window.parent !== window) window.parent.postMessage({ type: "bcdevis-help-close" }, "*");
    }
  });

  syncHash({ scroll: Boolean(location.hash) });
  filterTopics();
}());
