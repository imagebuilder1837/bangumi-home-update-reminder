// ==UserScript==
// @name         Bangumi 首页更新提醒
// @namespace    https://github.com/imagebuilder1837/bangumi-home-update-reminder
// @version      0.1.0
// @description  定时检测 Bangumi 首页的新动态、小组话题与热门条目讨论，并在有更新时提醒。
// @author       imagebuilder1837
// @match        https://bgm.tv/
// @match        https://bangumi.tv/
// @match        https://chii.in/
// @run-at       document-idle
// @grant        none
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/imagebuilder1837/bangumi-home-update-reminder/refs/heads/main/src/index.user.js
// @updateURL    https://raw.githubusercontent.com/imagebuilder1837/bangumi-home-update-reminder/refs/heads/main/src/index.user.js
// ==/UserScript==

(() => {
  "use strict";

  const POLL_INTERVAL = 30_000;
  const REQUEST_TIMEOUT = 15_000;
  const HOSTS = new Set(["bgm.tv", "bangumi.tv", "chii.in"]);
  const TOAST_ID = "bgm-home-update-reminder";

  if (
    window.top !== window.self ||
    location.pathname !== "/" ||
    !HOSTS.has(location.hostname)
  )
    return;

  function route(href) {
    if (!href) return null;
    try {
      const url = new URL(href, location.origin);
      return url.protocol === "https:" && HOSTS.has(url.hostname)
        ? url.pathname
        : null;
    } catch {
      return null;
    }
  }

  // Parse the entire snapshot before changing any observation or pending count.
  function readSnapshot(doc) {
    const accountPath = route(
      doc.querySelector(".idBadgerNeue > a.avatar[href]")?.getAttribute("href"),
    );
    const account = accountPath?.match(/^\/user\/([^/]+)\/?$/)?.[1];
    const timeline = doc.querySelector("#home_tml #tmlContent #timeline");
    const focusedTabs = doc.querySelectorAll("#home_tml #timelineTabs a.focus");
    if (
      !account ||
      !timeline ||
      focusedTabs.length !== 1 ||
      focusedTabs[0].id !== "tab_all"
    )
      return null;

    const dynamic = new Set();
    for (const row of timeline.querySelectorAll(":scope > ul > li")) {
      if (
        !row.classList.contains("tml_item") ||
        !/^tml_[1-9]\d*$/.test(row.id) ||
        dynamic.has(row.id)
      )
        return null;
      dynamic.add(row.id);
    }

    const group = readTopics(doc, "#home_grp_tpc", "group");
    const subject = readTopics(doc, "#home_subject_tpc", "subject");
    return group && subject ? { account, dynamic, group, subject } : null;
  }

  function readTopics(doc, selector, kind) {
    const list = doc.querySelector(`${selector} .sideTpcList`);
    if (!list) return null;
    const topics = new Map();
    for (const row of list.children) {
      if (kind === "group" && row.matches("li.tools")) continue;
      if (!row.matches("li.row")) return null;
      const path = route(
        row.querySelector(".inner > a.title[href]")?.getAttribute("href"),
      );
      const id = path?.match(new RegExp(`^/${kind}/topic/([1-9]\\d*)/?$`))?.[1];
      const countText = row
        .querySelector(".inner > small.grey")
        ?.textContent.replace(/\s/g, "");
      const countMatch = countText?.match(/^\(\+(\d+)\)$/);
      const replies = countMatch ? Number(countMatch[1]) : NaN;
      if (!id || !Number.isSafeInteger(replies) || topics.has(id)) return null;
      topics.set(id, replies);
    }
    return topics;
  }

  function createTracker(initial) {
    const seen = new Set(initial.dynamic);
    const lastReplies = [new Map(initial.group), new Map(initial.subject)];
    const pending = [new Set(), new Set(), new Set()];

    return (snapshot) => {
      if (snapshot.account !== initial.account) return null;
      for (const id of snapshot.dynamic) {
        if (!seen.has(id)) pending[0].add(id);
        seen.add(id);
      }
      [snapshot.group, snapshot.subject].forEach((topics, index) => {
        const previous = lastReplies[index];
        for (const [id, replies] of topics) {
          if (!previous.has(id) || replies > previous.get(id))
            pending[index + 1].add(id);
          // Decreases become the comparison value too; missing topics retain it.
          previous.set(id, replies);
        }
      });
      return pending.map((items) => items.size);
    };
  }

  function createReminder() {
    let total = 0;
    let prefix = "";
    let summary;

    function updateTitle() {
      const current = document.title;
      const base =
        prefix && current.startsWith(prefix)
          ? current.slice(prefix.length)
          : current;
      prefix = `(${total}) `;
      const next = prefix + base;
      if (current !== next) document.title = next;
    }

    function mount() {
      const style = document.createElement("style");
      style.id = `${TOAST_ID}-style`;
      style.textContent = `
        #${TOAST_ID} {
          position: fixed;
          z-index: 1000;
          top: calc(16px + env(safe-area-inset-top, 0px));
          left: 50%;
          transform: translateX(-50%);
          width: max-content;
          max-width: calc(100vw - 32px);
        }
        #${TOAST_ID} button {
          display: block;
          box-sizing: border-box;
          width: 100%;
          margin: 0;
          padding: 12px 18px;
          border: 1px solid #e8e8e8;
          border-top: 3px solid var(--primary-color, #f09199);
          border-radius: 8px;
          background: #fff;
          color: #444;
          box-shadow: 0 4px 18px rgb(0 0 0 / 12%);
          font: 13px/1.7 'Lucida Grande', Helvetica, Arial, sans-serif;
          text-align: center;
          overflow-wrap: anywhere;
          cursor: pointer;
        }
        #${TOAST_ID} button:hover { border-color: var(--primary-color, #f09199); }
        #${TOAST_ID} button:focus-visible {
          outline: 2px solid var(--primary-color, #f09199);
          outline-offset: 3px;
        }
        #${TOAST_ID} span { display: block; }
        #${TOAST_ID} .refresh-hint { color: #999; font-size: 12px; }
        html[data-theme='dark'] #${TOAST_ID} button {
          background: #303132;
          color: #eee;
          border-color: #555;
          border-top-color: var(--primary-color, #f09199);
          box-shadow: 0 4px 18px rgb(0 0 0 / 28%);
        }
        html[data-theme='dark'] #${TOAST_ID} button:hover {
          border-color: var(--primary-color, #f09199);
        }
      `;
      document.head.append(style);

      const toast = document.createElement("div");
      toast.id = TOAST_ID;
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.setAttribute("aria-atomic", "true");
      const button = document.createElement("button");
      button.type = "button";
      summary = document.createElement("span");
      const hint = document.createElement("span");
      hint.className = "refresh-hint";
      hint.textContent = "点击刷新首页";
      button.append(summary, hint);
      button.addEventListener("click", () => location.reload());
      toast.append(button);
      document.body.append(toast);

      // Only strip our exact prefix, not arbitrary unread counts from other scripts.
      new MutationObserver(updateTitle).observe(document.head, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    }

    return (counts) => {
      const nextTotal = counts.reduce((sum, count) => sum + count, 0);
      if (nextTotal === total) return;
      total = nextTotal;
      if (!summary) mount();
      const labels = ["最新动态", "小组话题", "条目讨论"];
      const parts = counts.flatMap((count, index) =>
        count ? [`${labels[index]} ${count} ${index === 0 ? "条" : "个"}`] : [],
      );
      summary.textContent = `检测到更新：${parts.join(" · ")}`;
      updateTitle();
    };
  }

  function initialize() {
    const initial = readSnapshot(document);
    if (!initial) return;
    const observe = createTracker(initial);
    const remind = createReminder();
    const homepage = `${location.origin}/`;
    let inFlight = null;
    let suspended = false;
    let interval;

    async function poll() {
      if (suspended || inFlight) return;
      const controller = new AbortController();
      inFlight = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      try {
        const response = await fetch(homepage, {
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const url = new URL(response.url);
        const contentType = response.headers
          .get("content-type")
          ?.split(";")[0]
          .trim()
          .toLowerCase();
        if (
          url.origin !== location.origin ||
          url.pathname !== "/" ||
          contentType !== "text/html"
        )
          return;
        const html = await response.text();
        if (controller.signal.aborted || suspended) return;
        const snapshot = readSnapshot(
          new DOMParser().parseFromString(html, "text/html"),
        );
        if (!snapshot) return;
        const counts = observe(snapshot);
        if (counts) remind(counts);
      } catch {
        // Network errors, login redirects and challenges never replace valid state.
      } finally {
        clearTimeout(timeout);
        if (inFlight === controller) inFlight = null;
      }
    }

    interval = setInterval(poll, POLL_INTERVAL);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void poll();
    });
    window.addEventListener("pagehide", () => {
      suspended = true;
      clearInterval(interval);
      inFlight?.abort();
    });
    window.addEventListener("pageshow", () => {
      if (!suspended) return;
      suspended = false;
      interval = setInterval(poll, POLL_INTERVAL);
      void poll();
    });
  }

  if (document.readyState === "complete") initialize();
  else window.addEventListener("load", initialize, { once: true });
})();
