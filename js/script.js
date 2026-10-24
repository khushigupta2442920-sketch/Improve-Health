/* HealthNest starter prototype. Data stays in this browser via localStorage. */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const KEYS = { goals: "healthnest_goals_v1", diary: "healthnest_diary_v1", settings: "healthnest_settings_v1", notes: "healthnest_notes_v1" };
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const getGoals = () => read(KEYS.goals, []);
  const setGoals = goals => write(KEYS.goals, goals);
  const isDoneToday = goal => goal.completedOn === todayKey();
  const formatTime = time => { if (!time) return "No time set"; const [h,m] = time.split(":").map(Number); const d = new Date(); d.setHours(h,m,0,0); return d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}); };

  // Shared navigation and footer year.
  $$("[data-year]").forEach(el => el.textContent = new Date().getFullYear());
  const menuToggle = $(".menu-toggle"), nav = $(".main-nav");
  if (menuToggle && nav) menuToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open"); menuToggle.setAttribute("aria-expanded", String(open));
  });

  // Goals page: add, check off, delete, clear completed, and timed reminders while page is open.
  const goalForm = $("#goal-form");
  const goalList = $("#goal-list");
  let reminderTimers = [];
  function renderGoals() {
    if (!goalList) return;
    const goals = getGoals();
    const count = $("#goal-count"); if (count) count.textContent = goals.length;
    if (!goals.length) { goalList.innerHTML = '<p class="empty-state">No goals yet. Add your first small step.</p>'; return; }
    goalList.innerHTML = goals.map(g => `<article class="goal-item ${isDoneToday(g) ? "is-complete" : ""}">
      <input class="goal-check" type="checkbox" data-action="toggle" data-id="${escapeHTML(g.id)}" ${isDoneToday(g) ? "checked" : ""} aria-label="Mark ${escapeHTML(g.title)} complete">
      <div class="goal-main"><span class="goal-title">${escapeHTML(g.title)}</span><span class="goal-meta">${escapeHTML(g.category)} · ${escapeHTML(formatTime(g.time))}${g.reminder ? " · Reminder on" : ""}</span></div>
      <div class="goal-actions"><button class="icon-button" data-action="delete" data-id="${escapeHTML(g.id)}" aria-label="Delete goal">✕</button></div>
    </article>`).join("");
  }
  function renderDashboard() {
    const goals = getGoals();
    const completed = goals.filter(isDoneToday).length;
    const elCompleted = $("#stat-completed"), elTotal = $("#stat-total"), elRate = $("#stat-rate");
    if (elCompleted) elCompleted.textContent = completed;
    if (elTotal) elTotal.textContent = goals.length;
    if (elRate) elRate.textContent = `${goals.length ? Math.round(completed / goals.length * 100) : 0}%`;
    const list = $("#dashboard-goals");
    if (list) {
      const todays = goals.slice(0, 6);
      list.innerHTML = todays.length ? todays.map(g => `<article class="goal-item ${isDoneToday(g) ? "is-complete" : ""}"><input class="goal-check" type="checkbox" data-action="toggle" data-id="${escapeHTML(g.id)}" ${isDoneToday(g) ? "checked" : ""} aria-label="Mark ${escapeHTML(g.title)} complete"><div class="goal-main"><span class="goal-title">${escapeHTML(g.title)}</span><span class="goal-meta">${escapeHTML(g.category)} · ${escapeHTML(formatTime(g.time))}</span></div></article>`).join("") : '<p class="empty-state">Your goals will appear here once you add them.</p>';
    }
    const chart = $("#weekly-chart");
    if (chart) {
      const history = read("healthnest_daily_history_v1", {});
      const days = [];
      for (let offset = 6; offset >= 0; offset--) {
        const d = new Date(); d.setDate(d.getDate() - offset);
        const key = d.toISOString().slice(0,10);
        let done = key === todayKey() ? completed : (history[key]?.completed ?? null);
        let total = key === todayKey() ? goals.length : (history[key]?.total ?? null);
        const pct = (done !== null && total) ? Math.round(done/total*100) : 0;
        days.push({label:d.toLocaleDateString([], {weekday:"short"}),pct,logged:done !== null});
      }
      chart.innerHTML = days.map(d => `<div class="chart-day" title="${d.logged ? d.pct + '% completed' : 'No data logged'}"><div class="chart-bar-wrap"><div class="chart-bar" style="height:${d.logged ? d.pct : 2}%"></div></div><small>${d.label}</small></div>`).join("");
      const caption = $("#weekly-caption"); if (caption) caption.textContent = "Days without saved check-ins are shown as no data, not as zero activity.";
    }
  }
  function saveTodayHistory() {
    const goals = getGoals(), history = read("healthnest_daily_history_v1", {});
    history[todayKey()] = { completed: goals.filter(isDoneToday).length, total: goals.length };
    write("healthnest_daily_history_v1", history);
  }
  function refreshGoals() { renderGoals(); renderDashboard(); }
  if (goalForm) {
    goalForm.addEventListener("submit", e => {
      e.preventDefault();
      const title = $("#goal-title").value.trim(); if (!title) return;
      const goals = getGoals();
      goals.unshift({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), title, category: $("#goal-category").value, time: $("#goal-time").value, reminder: $("#goal-reminder").checked, completedOn: null, remindedOn: null });
      setGoals(goals); goalForm.reset(); $("#goal-time").value = "08:00"; $("#goal-reminder").checked = true;
      refreshGoals();
    });
  }
  document.addEventListener("change", e => {
    const target = e.target;
    if (target.matches('[data-action="toggle"]')) {
      const goals = getGoals(), goal = goals.find(g => g.id === target.dataset.id);
      if (goal) goal.completedOn = target.checked ? todayKey() : null;
      setGoals(goals); saveTodayHistory(); refreshGoals();
    }
  });
  document.addEventListener("click", e => {
    const button = e.target.closest('[data-action="delete"]');
    if (button) { setGoals(getGoals().filter(g => g.id !== button.dataset.id)); refreshGoals(); }
  });
  $("#clear-completed")?.addEventListener("click", () => { setGoals(getGoals().filter(g => !isDoneToday(g))); saveTodayHistory(); refreshGoals(); });
  $("#enable-notifications")?.addEventListener("click", async () => {
    const status = $("#notification-status");
    if (!("Notification" in window)) { status.textContent = " This browser does not support notifications."; return; }
    try { const result = await Notification.requestPermission(); status.textContent = result === "granted" ? " Notifications enabled for this browser." : " Permission not granted. You can change it in browser settings."; }
    catch { status.textContent = " Notifications could not be enabled here."; }
  });
  function checkReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date(), current = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const goals = getGoals(); let changed = false;
    goals.forEach(g => {
      if (g.reminder && g.time === current && !isDoneToday(g) && g.remindedOn !== `${todayKey()} ${current}`) {
        try { new Notification("HealthNest reminder", { body: `${g.title} — take a small step for yourself.` }); g.remindedOn = `${todayKey()} ${current}`; changed = true; } catch {}
      }
    });
    if (changed) setGoals(goals);
  }
  if (goalList) { renderGoals(); checkReminders(); reminderTimers.push(setInterval(checkReminders, 15000)); }
  renderDashboard();

  // Diary entries.
  const diaryForm = $("#diary-form"), diaryEntries = $("#diary-entries");
  function renderDiary() {
    if (!diaryEntries) return;
    const entries = read(KEYS.diary, []).sort((a,b) => b.date.localeCompare(a.date));
    diaryEntries.innerHTML = entries.length ? entries.map(entry => `<article class="diary-entry"><div class="diary-entry-head"><span>${escapeHTML(entry.date)}</span><span class="mood">${escapeHTML(entry.mood)}</span></div><p>${escapeHTML(entry.note || "No written note.")}</p><button type="button" data-diary-delete="${escapeHTML(entry.id)}">Delete entry</button></article>`).join("") : '<p class="empty-state">Your saved reflections will appear here.</p>';
  }
  if ($("#diary-date")) $("#diary-date").value = todayKey();
  diaryForm?.addEventListener("submit", e => {
    e.preventDefault();
    const entries = read(KEYS.diary, []);
    const date = $("#diary-date").value;
    const entry = { id: `${date}-${Date.now()}`, date, mood: $("#diary-mood").value, note: $("#diary-note").value.trim() };
    const existing = entries.findIndex(item => item.date === date);
    if (existing >= 0) entries[existing] = entry; else entries.push(entry);
    write(KEYS.diary, entries); $("#diary-note").value = ""; renderDiary();
  });
  diaryEntries?.addEventListener("click", e => {
    const button = e.target.closest("[data-diary-delete]"); if (!button) return;
    write(KEYS.diary, read(KEYS.diary, []).filter(entry => entry.id !== button.dataset.diaryDelete)); renderDiary();
  });
  $("#export-diary")?.addEventListener("click", () => downloadJSON("healthnest-diary.json", read(KEYS.diary, [])));
  renderDiary();

  // Searchable health library.
  $("#library-search")?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase().trim(); let visible = 0;
    $$(".article-card").forEach(card => { const match = (card.dataset.search + " " + card.innerText).toLowerCase().includes(q); card.classList.toggle("hidden", !match); if (match) visible++; });
    $("#no-articles")?.classList.toggle("hidden", visible > 0);
  });

  // Local demo chat, deliberately not presented as AI or medical advice.
  // Guided offline HealthNest chatbot
  const chatForm = $("#chat-form");
  const chatMessages = $("#chat-messages");
  const chatOptions = $("#chat-options");

  const chatTopics = {
    "🥗 Food & Nutrition": {
      "How can I eat a balanced diet?":
        "Include vegetables or fruits, staple grains and protein sources such as dal, beans, eggs, curd or paneer. Choose foods that suit your needs and budget.",

      "How can I gain weight healthily?":
        "Eat regular meals and add nourishing snacks such as banana with milk, curd, roasted chana, nuts or paneer. Increase portions gradually.",

      "How much water should I drink?":
        "Drink water regularly throughout the day. Your needs depend on your activity, weather and health."
    },

    "🌿 Skin Care": {
      "What is a simple skincare routine?":
        "Use a gentle cleanser, moisturizer and broad-spectrum sunscreen during the day. Introduce new products one at a time.",

      "How can I manage dull skin?":
        "Keep a gentle skincare routine, sleep regularly and use sunscreen. Avoid harsh scrubs, lemon juice and baking soda on your face.",

      "What should I do about pimples?":
        "Avoid squeezing pimples, cleanse gently and use a non-comedogenic moisturizer. Seek a dermatologist's advice for persistent or painful acne.",

      "What if my skin gets irritated?":
        "Stop using the product and rinse gently. Avoid trying more ingredients on the irritated area. Get medical help for severe reactions."
    },

    "😴 Sleep & Routine": {
      "How can I improve my sleep?":
        "Try a consistent bedtime and wake-up time, morning daylight and less caffeine late in the day.",

      "Why do I feel tired?":
        "Regular meals, hydration and adequate sleep may help. If tiredness persists, consult a healthcare professional.",

      "How can I plan my day?":
        "Choose three realistic priorities, set a time for each and leave some time for breaks."
    },

    "🏃 Exercise & Fitness": {
      "What exercise is good for beginners?":
        "Start with comfortable walking, gentle stretching and simple strength movements. Increase activity gradually.",

      "Is daily walking useful?":
        "Walking is a useful physical activity. Start at a comfortable pace and adjust the duration to your fitness.",

      "Which simple strength exercises can I try?":
        "You can try chair sit-to-stands, wall push-ups and calf raises. Stop if you experience pain or dizziness."
    },

    "✅ Daily Goals & Habits": {
      "How do I create a goal?":
        "Open the Goals page, create a task and set a reminder time if available. Mark it complete when finished.",

      "How can I build a habit?":
        "Start with one small action and connect it to a routine you already follow. Track progress without expecting perfection.",

      "How can I track today's progress?":
        "Mark your tasks complete on the Goals page and review your progress on the Dashboard."
    },

    "💚 General Health": {
      "How can I manage stress?":
        "Take a short break, breathe comfortably or talk to someone you trust. Seek qualified support if distress persists.",

      "Can this chatbot diagnose symptoms?":
        "No. This is an offline guidance chatbot, not a diagnostic tool. Seek medical advice for concerning symptoms and urgent help for emergencies.",

      "How do I use HealthNest?":
        "Use the website navigation to open Goals, Nutrition, Fitness, Natural Care, Diary and other sections."
    }
  };

  function addMessage(text, who) {
    if (!chatMessages) return;

    const div = document.createElement("div");
    div.className = `message ${
      who === "user" ? "user-message" : "assistant-message"
    }`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  function showTypingIndicator() {
    if (!chatMessages) return null;

    const typing = document.createElement("div");
    typing.className = "message assistant-message typing-indicator";
    typing.setAttribute("aria-label", "HealthNest is typing");

    for (let i = 0; i < 3; i++) {
      typing.appendChild(document.createElement("span"));
    }

    chatMessages.appendChild(typing);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return typing;
  }

  function replyWithTyping(answer) {
    const typing = showTypingIndicator();

    setTimeout(() => {
      typing?.remove();
      addMessage(answer, "assistant");
    }, 1200);
  }

  function showChatOptions(items, onSelect, heading) {
    if (!chatOptions) return;

    chatOptions.replaceChildren();

    const label = document.createElement("p");
    label.textContent = heading;
    chatOptions.appendChild(label);

    items.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chat-option-button";
      button.textContent = item;
      button.addEventListener("click", () => onSelect(item));
      chatOptions.appendChild(button);
    });
  }

  function showChatTopics() {
    showChatOptions(
      Object.keys(chatTopics),
      topic => {
        addMessage(topic, "user");
        showChatQuestions(topic);
      },
      "Hello! 🌿 Choose a topic:"
    );
  }

  function showChatQuestions(topic) {
    showChatOptions(
      Object.keys(chatTopics[topic]),
      question => {
        addMessage(question, "user");
        replyWithTyping(chatTopics[topic][question]);
        showChatNext(topic);
      },
      "Choose a question:"
    );
  }

  function showChatNext(topic) {
    showChatOptions(
      [
        "Ask another question in this topic",
        "Choose another topic",
        "Start again"
      ],
      choice => {
        if (choice === "Ask another question in this topic") {
          showChatQuestions(topic);
        } else {
          showChatTopics();
        }
      },
      "What would you like to do next?"
    );
  }

  const chatKeywordTopics = [
    {
      topic: "🥗 Food & Nutrition",
      keywords: ["food", "diet", "nutrition", "weight", "meal", "water", "drink"]
    },
    {
      topic: "🌿 Skin Care",
      keywords: ["skin", "face", "glow", "dull", "pimple", "acne", "irritation"]
    },
    {
      topic: "😴 Sleep & Routine",
      keywords: ["sleep", "tired", "routine", "wake", "bedtime"]
    },
    {
      topic: "🏃 Exercise & Fitness",
      keywords: ["exercise", "fitness", "walking", "walk", "workout", "strength"]
    },
    {
      topic: "✅ Daily Goals & Habits",
      keywords: ["goal", "habit", "task", "reminder", "progress", "complete"]
    },
    {
      topic: "💚 General Health",
      keywords: ["stress", "sad", "mental", "anxious", "symptom", "health"]
    }
  ];

  chatForm?.addEventListener("submit", event => {
    event.preventDefault();

    const input = $("#chat-input");
    const msg = input?.value.trim();
    if (!msg) return;

    addMessage(msg, "user");
    input.value = "";

    const lower = msg.toLowerCase();

    if (/^(hi|hello|hey)[!. ]*$/.test(lower)) {
      addMessage("Hello! Choose a topic below to get started.", "assistant");
      showChatTopics();
      return;
    }

    const match = chatKeywordTopics.find(item =>
      item.keywords.some(keyword => lower.includes(keyword))
    );

    if (match) {
      addMessage(
        "Please choose the question that best matches what you want to know.",
        "assistant"
      );
      showChatQuestions(match.topic);
    } else {
      addMessage(
        "I don't have a matching answer yet. Please choose a topic, then select a question.",
        "assistant"
      );
      showChatTopics();
    }
  });

  if (chatOptions) showChatTopics();

  // Quick journal notes.
  function renderQuickNotes() {
    const holder = $("#quick-notes"); if (!holder) return;
    const notes = read(KEYS.notes, []);
    holder.innerHTML = notes.slice(0,5).map(n => `<div class="quick-note">${escapeHTML(n.text)}<div class="muted">${escapeHTML(n.date)}</div></div>`).join("");
  }
  $("#quick-note-form")?.addEventListener("submit", e => {
    e.preventDefault(); const input = $("#quick-note"), text = input.value.trim(); if (!text) return;
    const notes = read(KEYS.notes, []); notes.unshift({text, date:new Date().toLocaleString()}); write(KEYS.notes, notes.slice(0,30)); input.value = ""; renderQuickNotes();
  });
  renderQuickNotes();

  // Profile preferences and data export/delete.
  const settingsForm = $("#settings-form");
  const settings = read(KEYS.settings, {});
  if ($("#display-name")) $("#display-name").value = settings.name || "";
  if ($("#site-language")) $("#site-language").value = settings.language || "en";
  if ($("#daily-encouragement")) $("#daily-encouragement").checked = settings.encouragement !== false;
  settingsForm?.addEventListener("submit", e => {
    e.preventDefault(); write(KEYS.settings, {name:$("#display-name").value.trim(), language:$("#site-language").value, encouragement:$("#daily-encouragement").checked});
    $("#settings-status").textContent = "Preferences saved in this browser.";
  });
  function allData() { return { goals:read(KEYS.goals,[]), diary:read(KEYS.diary,[]), settings:read(KEYS.settings,{}), notes:read(KEYS.notes,[]), dailyHistory:read("healthnest_daily_history_v1",{}) }; }
  function downloadJSON(name, data) { const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url); }
  $("#export-data")?.addEventListener("click", () => downloadJSON("healthnest-data.json", allData()));
  $("#delete-data")?.addEventListener("click", () => {
    if (!confirm("Delete all HealthNest goals, diary entries, notes and preferences saved in this browser? This cannot be undone.")) return;
    Object.values(KEYS).forEach(key => localStorage.removeItem(key)); localStorage.removeItem("healthnest_daily_history_v1"); location.reload();
  });

  // Simple breathing timer: no external API.
  let breathingInterval = null, remaining = 120;
  $("#breathing-start")?.addEventListener("click", () => {
    if (breathingInterval) { clearInterval(breathingInterval); breathingInterval = null; }
    remaining = 120; const circle = $("#breathing-circle"), label = $("#breathing-label"), status = $("#breathing-status"), button = $("#breathing-start");
    circle.classList.add("active"); button.disabled = true; button.textContent = "Pause in progress…";
    const update = () => {
      label.textContent = `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,"0")}`;
      status.textContent = "Breathe naturally and stop if you feel uncomfortable.";
      remaining--;
      if (remaining < 0) { clearInterval(breathingInterval); breathingInterval = null; circle.classList.remove("active"); label.textContent = "Well done"; status.textContent = "Your mindful pause is complete."; button.disabled = false; button.textContent = "Start again"; }
    };
    update(); breathingInterval = setInterval(update,1000);
  });
})();
/* ===== HealthNest: Global Dark Mode ===== */

const themeToggle = document.querySelector("#theme-toggle");

function setHealthNestTheme(theme) {
  const isDark = theme === "dark";

  document.body.classList.toggle("dark-mode", isDark);

  if (themeToggle) {
    themeToggle.textContent = isDark
      ? "☀️ Light Mode"
      : "🌙 Dark Mode";

    themeToggle.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );
  }
}

// Load the saved theme on every page
const savedTheme = localStorage.getItem("healthnest-theme") || "light";
setHealthNestTheme(savedTheme);

// Save the user's choice
themeToggle?.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark-mode")
    ? "light"
    : "dark";

  localStorage.setItem("healthnest-theme", nextTheme);
  setHealthNestTheme(nextTheme);
});
