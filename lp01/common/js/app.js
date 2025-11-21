// Fast-safe image fallback
(function () {
  // Use existing logo as fallback instead of non-existent placeholder.svg
  var fallbackImage = "lp01/common/img/logo.svg";
  document.addEventListener(
    "error",
    function (e) {
      var t = e.target;

      if (t && t.tagName === "IMG" && !t.dataset.fallback) {
        t.dataset.fallback = "1";
        t.src = fallbackImage;
      }
    },
    true,
  );
})();

// Trial reservation form logic
(function () {
  var section = document.getElementById("trialReserveSection");
  if (!section) return;

  var endpoint =
    (section.dataset && section.dataset.gasEndpoint) || "";
  var form = document.getElementById("trialForm");
  var slotPickerBody = document.getElementById("slotPickerBody");
  var slotWeekLabel = document.getElementById("slotWeekLabel");
  var slotSelectionStatus = document.getElementById(
    "slotSelectionStatus",
  );
  var prevWeekBtn = document.getElementById("slotPrevWeek");
  var nextWeekBtn = document.getElementById("slotNextWeek");
  var slotHiddenInput = document.getElementById("slotISO");
  var submitBtn = document.getElementById("submitBtn");
  var resultMsg = document.getElementById("resultMsg");
  var STATUS_MODIFIERS = ["success", "error", "warning"];
  var DOW = ["日", "月", "火", "水", "木", "金", "土"];
  var DAYS_PER_PAGE = 3;

  if (
    !form ||
    !slotPickerBody ||
    !slotWeekLabel ||
    !slotSelectionStatus ||
    !prevWeekBtn ||
    !nextWeekBtn ||
    !slotHiddenInput ||
    !submitBtn ||
    !resultMsg
  ) {
    return;
  }

  var slotState = {
    weeks: [],
    currentWeek: 0,
    selectedSlotISO: "",
  };

  function pad(num) {
    return num < 10 ? "0" + num : "" + num;
  }

  function applyStatus(status) {
    STATUS_MODIFIERS.forEach(function (name) {
      resultMsg.classList.toggle(
        "trialReserve__result--" + name,
        status === name,
      );
    });
  }

  function clearMessage() {
    resultMsg.textContent = "";
    resultMsg.hidden = true;
    applyStatus(null);
  }

  function showMessage(message, status) {
    if (!message) {
      clearMessage();
      return;
    }
    resultMsg.textContent = message;
    resultMsg.hidden = false;
    applyStatus(status);
  }

  function setFormDisabled(disabled) {
    Array.prototype.forEach.call(form.elements, function (el) {
      el.disabled = disabled;
    });
  }

  function toLocalDate(isoString) {
    var d = new Date(isoString);
    if (isNaN(d.getTime())) {
      return null;
    }
    return d;
  }

  function dateKeyFromDate(date) {
    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate())
    );
  }

  function parseDateKey(key) {
    var parts = key.split("-");
    return new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2]),
    );
  }

  function formatTimeRange(startISO, endISO) {
    var start = toLocalDate(startISO);
    var end = toLocalDate(endISO);
    if (!start || !end) return "";
    return (
      pad(start.getHours()) +
      ":" +
      pad(start.getMinutes()) +
      " - " +
      pad(end.getHours()) +
      ":" +
      pad(end.getMinutes())
    );
  }

  function findSlotInfo(slotISO, weeksOverride) {
    var weeks = weeksOverride || slotState.weeks;
    for (var w = 0; w < weeks.length; w++) {
      var week = weeks[w];
      for (var d = 0; d < week.days.length; d++) {
        var day = week.days[d];
        for (var s = 0; s < day.slots.length; s++) {
          if (day.slots[s].startISO === slotISO) {
            return {
              weekIndex: w,
              day: day,
              slot: day.slots[s],
            };
          }
        }
      }
    }
    return null;
  }

  function updateSelectionStatus() {
    if (!slotSelectionStatus) return;

    if (!slotState.selectedSlotISO) {
      slotSelectionStatus.textContent = "";
      slotSelectionStatus.classList.remove("is-visible");
      return;
    }

    var info = findSlotInfo(slotState.selectedSlotISO);
    if (!info) {
      slotSelectionStatus.textContent = "";
      slotSelectionStatus.classList.remove("is-visible");
      return;
    }

    slotSelectionStatus.textContent =
      info.day.labelFull +
      " " +
      (info.slot.timeLabel || info.slot.label) +
      " を選択中です";
    slotSelectionStatus.classList.add("is-visible");
  }

  function setLoadingUI() {
    slotWeekLabel.textContent = "読み込み中…";
    // Add spinner here later
    slotPickerBody.innerHTML =
      '<div class="slotPicker__loading"><div class="spinner"></div><p>読み込み中です…</p></div>';
    prevWeekBtn.disabled = true;
    nextWeekBtn.disabled = true;
    submitBtn.disabled = true;
    slotSelectionStatus.textContent = "";
    slotSelectionStatus.classList.remove("is-visible");
  }

  function setNoSlotsUI() {
    slotWeekLabel.textContent = "現在予約可能な枠はありません";
    slotPickerBody.innerHTML =
      '<p class="slotPicker__empty">現在ご案内できる枠がありません。別日程の公開をお待ちください。</p>';
    prevWeekBtn.disabled = true;
    nextWeekBtn.disabled = true;
    submitBtn.disabled = true;
    slotHiddenInput.value = "";
    slotState.selectedSlotISO = "";
    updateSelectionStatus();
  }

  function setEndpointMissingUI() {
    slotWeekLabel.textContent = "デプロイURLを設定してください";
    slotPickerBody.innerHTML =
      '<p class="slotPicker__empty">GASのデプロイURLが未設定のため枠を表示できません。</p>';
    prevWeekBtn.disabled = true;
    nextWeekBtn.disabled = true;
    submitBtn.disabled = true;
    slotHiddenInput.value = "";
    slotState.selectedSlotISO = "";
    updateSelectionStatus();
  }

  function setErrorUI() {
    slotWeekLabel.textContent = "取得エラー";
    slotPickerBody.innerHTML =
      '<p class="slotPicker__empty">空き枠を取得できませんでした。</p>';
    prevWeekBtn.disabled = true;
    nextWeekBtn.disabled = true;
    submitBtn.disabled = true;
    slotHiddenInput.value = "";
    updateSelectionStatus();
  }

  function buildWeeks(slots) {
    var map = {};

    slots.forEach(function (slot) {
      if (!slot || !slot.startISO) return;
      var start = toLocalDate(slot.startISO);
      if (!start) return;
      start.setHours(0, 0, 0, 0);
      var key = dateKeyFromDate(start);
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push({
        startISO: slot.startISO,
        endISO: slot.endISO || slot.startISO,
        label: slot.label || "",
        timeLabel: formatTimeRange(slot.startISO, slot.endISO || slot.startISO),
      });
    });

    Object.keys(map).forEach(function (key) {
      map[key].sort(function (a, b) {
        return new Date(a.startISO) - new Date(b.startISO);
      });
    });

    var mapKeys = Object.keys(map).sort();
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var defaultStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    var startDate =
      mapKeys.length > 0 ? parseDateKey(mapKeys[0]) : new Date(defaultStart);
    if (startDate.getTime() > defaultStart.getTime()) {
      startDate = new Date(defaultStart);
    }

    var latestDate =
      mapKeys.length > 0
        ? parseDateKey(mapKeys[mapKeys.length - 1])
        : new Date(startDate);

    var diffDays = Math.floor(
      (latestDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
    );
    var totalDays = Math.min(14, Math.max(7, diffDays + 1));
    if (diffDays + 1 > 14) {
      totalDays = diffDays + 1;
    }

    var days = [];
    for (var i = 0; i < totalDays; i++) {
      var date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      var key = dateKeyFromDate(date);
      var slotsForDay = map[key] || [];
      days.push({
        key: key,
        date: date,
        slots: slotsForDay,
        labelShort: date.getMonth() + 1 + "/" + pad(date.getDate()),
        labelDow: DOW[date.getDay()],
        labelFull:
          date.getMonth() +
          1 +
          "月" +
          date.getDate() +
          "日(" +
          DOW[date.getDay()] +
          ")",
      });
    }

    if (mapKeys.length > totalDays) {
      for (var j = totalDays; j < mapKeys.length; j++) {
        var extraDate = parseDateKey(mapKeys[j]);
        days.push({
          key: mapKeys[j],
          date: extraDate,
          slots: map[mapKeys[j]] || [],
          labelShort: extraDate.getMonth() + 1 + "/" + pad(extraDate.getDate()),
          labelDow: DOW[extraDate.getDay()],
          labelFull:
            extraDate.getMonth() +
            1 +
            "月" +
            extraDate.getDate() +
            "日(" +
            DOW[extraDate.getDay()] +
            ")",
        });
      }
    }

    var weeks = [];
    for (var idx = 0; idx < days.length; idx += DAYS_PER_PAGE) {
      weeks.push({
        index: weeks.length,
        days: days.slice(idx, idx + DAYS_PER_PAGE),
      });
    }

    return weeks;
  }

  function formatWeekLabel(week) {
    if (!week || week.days.length === 0) return "";
    var first = week.days[0];
    var last = week.days[week.days.length - 1];
    return (
      first.labelShort +
      "(" +
      first.labelDow +
      ") 〜 " +
      last.labelShort +
      "(" +
      last.labelDow +
      ")"
    );
  }

  function renderWeek() {
    if (!slotState.weeks.length) {
      setNoSlotsUI();
      return;
    }

    if (slotState.currentWeek < 0) {
      slotState.currentWeek = 0;
    }
    if (slotState.currentWeek >= slotState.weeks.length) {
      slotState.currentWeek = slotState.weeks.length - 1;
    }

    var week = slotState.weeks[slotState.currentWeek];
    slotWeekLabel.textContent = formatWeekLabel(week);
    prevWeekBtn.disabled = slotState.currentWeek === 0;
    nextWeekBtn.disabled = slotState.currentWeek >= slotState.weeks.length - 1;

    slotPickerBody.innerHTML = "";
    var hasAvailableSlot = false;

    week.days.forEach(function (day) {
      var dayEl = document.createElement("article");
      dayEl.className = "slotDay";
      dayEl.setAttribute("data-date", day.key);
      dayEl.setAttribute("aria-label", day.labelFull);

      if (day.slots.length === 0) {
        dayEl.classList.add("slotDay--empty");
      }

      var hasSelected =
        day.slots.filter(function (slot) {
          return slot.startISO === slotState.selectedSlotISO;
        }).length > 0;
      if (hasSelected) {
        dayEl.classList.add("slotDay--selected");
      }

      var head = document.createElement("header");
      head.className = "slotDay__head";

      var dow = document.createElement("span");
      dow.className = "slotDay__dow";
      dow.textContent = day.labelDow;

      var date = document.createElement("span");
      date.className = "slotDay__date";
      date.textContent = day.labelShort;

      head.appendChild(dow);
      head.appendChild(date);

      var body = document.createElement("div");
      body.className = "slotDay__slots";

      if (!day.slots.length) {
        var empty = document.createElement("p");
        empty.className = "slotDay__noSlot";
        empty.textContent = "満席";
        body.appendChild(empty);
      } else {
        hasAvailableSlot = true;
        day.slots.forEach(function (slot) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "slotDay__slot";
          btn.dataset.slotIso = slot.startISO;
          btn.textContent = slot.timeLabel || slot.label;
          btn.setAttribute(
            "aria-label",
            day.labelFull + " " + (slot.timeLabel || slot.label),
          );
          var isSelected = slot.startISO === slotState.selectedSlotISO;
          btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
          if (isSelected) {
            btn.classList.add("is-selected");
          }
          btn.addEventListener("click", function () {
            selectSlot(slot.startISO);
          });
          body.appendChild(btn);
        });
      }

      dayEl.appendChild(head);
      dayEl.appendChild(body);
      slotPickerBody.appendChild(dayEl);
    });

    if (!hasAvailableSlot) {
      submitBtn.disabled = true;
    } else if (slotState.selectedSlotISO) {
      submitBtn.disabled = false;
    }

    updateSelectionStatus();
  }

  function selectSlot(slotISO, options) {
    slotState.selectedSlotISO = slotISO;
    slotHiddenInput.value = slotISO || "";
    submitBtn.disabled = !slotISO;

    if (!options || !options.silent) {
      renderWeek();
    } else {
      updateSelectionStatus();
    }
  }

  function ensureSelectedWeekVisible() {
    if (!slotState.selectedSlotISO) return;
    var info = findSlotInfo(slotState.selectedSlotISO);
    if (info && info.weekIndex !== slotState.currentWeek) {
      slotState.currentWeek = info.weekIndex;
    }
  }

  function autoSelectFirstAvailable() {
    for (var w = 0; w < slotState.weeks.length; w++) {
      var week = slotState.weeks[w];
      for (var d = 0; d < week.days.length; d++) {
        var day = week.days[d];
        if (day.slots.length > 0) {
          slotState.currentWeek = w;
          selectSlot(day.slots[0].startISO, { silent: true });
          renderWeek();
          return;
        }
      }
    }
    slotHiddenInput.value = "";
    submitBtn.disabled = true;
    updateSelectionStatus();
  }

  function changeWeek(delta) {
    if (!slotState.weeks.length) return;
    var nextIndex = slotState.currentWeek + delta;
    if (nextIndex < 0 || nextIndex >= slotState.weeks.length) return;
    slotState.currentWeek = nextIndex;
    renderWeek();
  }

  prevWeekBtn.addEventListener("click", function () {
    changeWeek(-1);
  });
  nextWeekBtn.addEventListener("click", function () {
    changeWeek(1);
  });

  async function loadSlots(options) {
    var keepMessage = options && options.keepMessage;
    if (!keepMessage) {
      clearMessage();
    }

    setLoadingUI();

    try {
      var response = await fetch(endpoint + "?mode=slots", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      var slots = await response.json();

      if (!Array.isArray(slots) || slots.length === 0) {
        slotState.weeks = [];
        slotState.selectedSlotISO = "";
        slotHiddenInput.value = "";
        setNoSlotsUI();
        showMessage(
          "現在ご案内できる枠がありません。別日程の公開をお待ちください。",
          "warning",
        );
        return;
      }

      var weeks = buildWeeks(slots);
      var previousSelection = slotState.selectedSlotISO;
      slotState.weeks = weeks;
      slotState.currentWeek = 0;

      if (previousSelection) {
        var existing = findSlotInfo(previousSelection, weeks);
        if (existing) {
          slotState.currentWeek = existing.weekIndex;
          slotState.selectedSlotISO = previousSelection;
          renderWeek();
          ensureSelectedWeekVisible();
          renderWeek();
        } else {
          slotState.selectedSlotISO = "";
          renderWeek();
          autoSelectFirstAvailable();
        }
      } else {
        renderWeek();
        autoSelectFirstAvailable();
      }
    } catch (err) {
      console.error("Failed to load slots", err);
      setErrorUI();
      showMessage(
        "空き枠の取得に失敗しました。時間を置いて再度お試しください。",
        "error",
      );
    }
  }

  if (!endpoint || endpoint.indexOf("YOUR_DEPLOYMENT_ID_HERE") !== -1) {
    setEndpointMissingUI();
    showMessage(
      "GASのデプロイURLを設定後にご利用いただけます。",
      "warning",
    );
    return;
  }

  loadSlots();

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    clearMessage();

    var contactField = form.elements.namedItem("contactMethod");

    var payload = {
      name: form.name.value.trim(),
      furigana:
        (form.elements.namedItem("furigana") &&
          form.elements.namedItem("furigana").value.trim()) ||
        "",
      email: form.email.value.trim(),
      tel: form.tel.value.trim(),
      slotISO: slotHiddenInput.value,
      contactMethod:
        (contactField && contactField.value) || "meet",
    };

    if (!payload.name || !payload.furigana || !payload.email || !payload.tel) {
      showMessage("未入力の項目があります。", "error");
      return;
    }

    if (!payload.slotISO) {
      showMessage("希望日時を選択してください。", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.setAttribute("aria-busy", "true");

    try {
      var formPayload = new URLSearchParams();
      formPayload.set("name", payload.name);
      formPayload.set("furigana", payload.furigana);
      formPayload.set("email", payload.email);
      formPayload.set("tel", payload.tel);
      formPayload.set("slotISO", payload.slotISO);
      formPayload.set("contactMethod", payload.contactMethod);

      var response = await fetch(endpoint + "?mode=book", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: formPayload.toString(),
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      var data = await response.json();

      var status = data && data.status;
      var message = data && data.message;

      if (status === "ok") {
        showMessage(
          message ||
            "ご予約が確定しました。確認メールをご確認ください。",
          "success",
        );
        setFormDisabled(true);
        submitBtn.removeAttribute("aria-busy");
        submitBtn.setAttribute("aria-disabled", "true");

        window.location.href = "reservation-complete.html";
      } else {
        showMessage(
          message ||
            "申し訳ありません。他の方が先にこの枠を確保しました。別の時間帯をお選びください。",
          "error",
        );
        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
        loadSlots({ keepMessage: true });
      }
    } catch (err) {
      console.error("Reservation request failed", err);
      showMessage(
        "通信エラーが発生しました。時間を置いて再度お試しください。",
        "error",
      );
      submitBtn.disabled = false;
      submitBtn.removeAttribute("aria-busy");
    }
  });
})();

// Hero scroll indicator button handler
(function() {
  var indicator = document.querySelector('.heroScrollIndicator');
  if (indicator) {
    indicator.addEventListener('click', function() {
      var target = document.getElementById('seqLead');
      if (target) {
        target.scrollIntoView({behavior: 'smooth'});
      }
    });
  }
})();

// Title animation
(function () {
  var baseSelector = ".seqLead__title .-strong.-orange";
  var target = document.querySelector(baseSelector);
  if (!target || typeof anime === "undefined") return;
  if (target.querySelector(".heroTitle__char")) return;

  var text = (target.textContent || "").trim();
  if (!text) return;

  var fragment = document.createDocumentFragment();
  Array.from(text).forEach(function (char) {
    var span = document.createElement("span");
    span.className = "heroTitle__char";
    span.textContent = char;
    span.style.display = "inline-block";
    span.style.opacity = "0";
    span.style.transform = "translateY(0.75em)";
    fragment.appendChild(span);
  });

  target.textContent = "";
  target.appendChild(fragment);

  anime.timeline({ loop: false }).add({
    targets: baseSelector + " .heroTitle__char",
    translateY: ["0.75em", "0em"],
    opacity: [0, 1],
    easing: "easeOutQuad",
    duration: 200,
    delay: function (el, i) {
      return 40 * i;
    },
  });
})();

// Header scroll logic
(function () {
  var root = document.body;
  var header = document.getElementById("header");
  if (!root || !header) return;

  var hero = document.querySelector(".heroSection--fullscreen");
  var threshold = 0;
  var ticking = false;
  var heroClass = "is-header-hero";
  var solidClass = "is-header-solid";
  var logo = header.querySelector(".header__logoImage");
  var defaultLogo = logo ? logo.getAttribute("data-logo-default") : "";
  var heroLogo = logo ? logo.getAttribute("data-logo-hero") : "";
  var desktopMedia = window.matchMedia("(min-width: 768px)");

  function applyState() {
    var heroActive = window.scrollY <= threshold;

    root.classList.toggle(heroClass, heroActive);
    root.classList.toggle(solidClass, !heroActive);
    updateLogo(heroActive);
  }

  function updateLogo(heroActive) {
    if (!logo) return;

    var isDesktop = desktopMedia.matches;
    var targetSrc = heroActive && isDesktop ? heroLogo : defaultLogo;

    if (targetSrc && logo.getAttribute("src") !== targetSrc) {
      logo.setAttribute("src", targetSrc);
    }
  }

  function recalc() {
    var heroHeight = hero ? hero.offsetHeight : 0;
    threshold =
      heroHeight > 0
        ? heroHeight * 0.55
        : Math.max(window.innerHeight * 0.25, header.offsetHeight * 2);
    applyState();
  }

  function onScroll() {
    if (ticking) return;

    ticking = true;
    window.requestAnimationFrame(function () {
      applyState();
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", recalc);
  if (desktopMedia.addEventListener) {
    desktopMedia.addEventListener("change", function () {
      updateLogo(window.scrollY <= threshold);
    });
  } else if (desktopMedia.addListener) {
    desktopMedia.addListener(function () {
      updateLogo(window.scrollY <= threshold);
    });
  }

  root.classList.add(heroClass);
  updateLogo(true);
  recalc();
})();

// Theme switcher
(function () {
  const themeSwitcher = document.querySelector(".theme-switcher");

  if (!themeSwitcher) return;

  const body = document.body;

  const buttons = themeSwitcher.querySelectorAll("button");
  const themeClasses = ["theme-palette-1", "theme-palette-2"];

  const savedTheme = localStorage.getItem("theme");

  function applyTheme(theme) {
    themeClasses.forEach((themeClass) => body.classList.remove(themeClass));

    if (theme && theme !== "original" && themeClasses.includes(theme)) {
      body.classList.add(theme);
    }

    localStorage.setItem("theme", theme || "original");
  }

  if (savedTheme) {
    applyTheme(savedTheme);
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const theme = button.dataset.theme;

      applyTheme(theme);
    });
  });
})();

