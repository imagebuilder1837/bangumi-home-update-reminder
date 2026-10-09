// ==UserScript==
// @name         Bangumi 首页更新提醒
// @namespace    https://github.com/imagebuilder1837/bangumi-home-update-reminder
// @version      0.1.1
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
      let hasUpdates = false;
      for (const id of snapshot.dynamic) {
        if (!seen.has(id)) {
          pending[0].add(id);
          hasUpdates = true;
        }
        seen.add(id);
      }
      [snapshot.group, snapshot.subject].forEach((topics, index) => {
        const previous = lastReplies[index];
        for (const [id, replies] of topics) {
          if (!previous.has(id) || replies > previous.get(id)) {
            pending[index + 1].add(id);
            hasUpdates = true;
          }
          // Decreases become the comparison value too; missing topics retain it.
          previous.set(id, replies);
        }
      });
      return { counts: pending.map((items) => items.size), hasUpdates };
    };
  }

  function createReminder(onIgnorePage) {
    let total = 0;
    let prefix = "";
    let toast;
    let summary;
    let titleObserver;

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
          z-index: 9;
          top: calc(48px + env(safe-area-inset-top, 0px));
          left: 50%;
          transform: translateX(-50%);
          box-sizing: border-box;
          width: max-content;
          max-width: calc(100vw - 32px);
          margin: 0;
          padding: 10px 16px;
          border: 1px solid #e8e8e8;
          border-top: 3px solid var(--primary-color, #f09199);
          border-radius: 8px;
          background: #fff;
          color: #444;
          box-shadow: 0 4px 18px rgb(0 0 0 / 12%);
          font: 13px/1.7 'Lucida Grande', Helvetica, Arial, sans-serif;
          text-align: center;
          overflow-wrap: anywhere;
          cursor: default;
        }
        #${TOAST_ID}[hidden] { display: none; }
        #${TOAST_ID} .reminder-summary { display: block; }
        #${TOAST_ID} .reminder-actions {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-top: 4px;
        }
        #${TOAST_ID} button {
          appearance: none;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: #999;
          box-shadow: none;
          font: inherit;
          font-size: 12px;
          white-space: nowrap;
          cursor: pointer;
        }
        #${TOAST_ID} button:hover { color: var(--primary-color, #f09199); }
        #${TOAST_ID} button:focus-visible {
          outline: 2px solid var(--primary-color, #f09199);
          outline-offset: 3px;
        }
        html[data-theme='dark'] #${TOAST_ID} {
          background: #303132;
          color: #eee;
          border-color: #555;
          border-top-color: var(--primary-color, #f09199);
          box-shadow: 0 4px 18px rgb(0 0 0 / 28%);
        }
      `;
      document.head.append(style);

      toast = document.createElement("div");
      toast.id = TOAST_ID;
      toast.hidden = true;
      summary = document.createElement("span");
      summary.className = "reminder-summary";
      summary.setAttribute("role", "status");
      summary.setAttribute("aria-live", "polite");
      summary.setAttribute("aria-atomic", "true");
      const actions = document.createElement("div");
      actions.className = "reminder-actions";
      for (const [label, action] of [
        ["点击刷新", () => location.reload()],
        [
          "本次忽略",
          () => {
            toast.hidden = true;
          },
        ],
        ["本页忽略", onIgnorePage],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", action);
        actions.append(button);
      }
      toast.append(summary, actions);
      document.body.append(toast);

      // Only strip our exact prefix, not arbitrary unread counts from other scripts.
      titleObserver = new MutationObserver(updateTitle);
      titleObserver.observe(document.head, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    }

    return {
      update({ counts, hasUpdates }) {
        const nextTotal = counts.reduce((sum, count) => sum + count, 0);
        if (!nextTotal) return;
        total = nextTotal;
        if (!toast) mount();
        const labels = ["最新动态", "小组话题", "条目讨论"];
        const parts = counts.flatMap((count, index) =>
          count
            ? [`${labels[index]} ${count} ${index === 0 ? "条" : "个"}`]
            : [],
        );
        const text = `检测到更新：${parts.join(" · ")}`;
        if (summary.textContent !== text) summary.textContent = text;
        // A counted topic can receive more replies without changing the total.
        if (hasUpdates) toast.hidden = false;
        updateTitle();
      },
      stop() {
        if (toast) toast.hidden = true;
        titleObserver?.disconnect();
        if (prefix && document.title.startsWith(prefix))
          document.title = document.title.slice(prefix.length);
        prefix = "";
      },
    };
  }

  function initialize() {
    // const debugReminder = createReminder(() => debugReminder.stop());
    // debugReminder.update({ counts: [3, 2, 5], hasUpdates: true });
    // return;

    const initial = readSnapshot(document);
    if (!initial) return;
    const observe = createTracker(initial);
    const reminder = createReminder(stop);
    const homepage = `${location.origin}/`;
    let inFlight = null;
    let suspended = false;
    let stopped = false;
    let interval;

    function stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(interval);
      inFlight?.abort();
      reminder.stop();
    }

    async function poll() {
      if (stopped || suspended || inFlight) return;
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
        if (stopped || suspended || controller.signal.aborted || !response.ok)
          return;
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
        if (stopped || suspended || controller.signal.aborted) return;
        const snapshot = readSnapshot(
          new DOMParser().parseFromString(html, "text/html"),
        );
        if (!snapshot) return;
        const update = observe(snapshot);
        if (update) reminder.update(update);
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
      if (stopped) return;
      suspended = true;
      clearInterval(interval);
      inFlight?.abort();
    });
    window.addEventListener("pageshow", () => {
      if (stopped || !suspended) return;
      suspended = false;
      interval = setInterval(poll, POLL_INTERVAL);
      void poll();
    });
  }

  if (document.readyState === "complete") initialize();
  else window.addEventListener("load", initialize, { once: true });
})();
