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

// Trial reservation form logic - Step 1: Collect user info, register to GAS, then navigate
(function () {
  var section = document.getElementById("trialReserveSection");
  var form = document.getElementById("trialForm");
  var submitBtn = document.getElementById("submitBtn");
  var resultMsg = document.getElementById("resultMsg");

  if (!form || !submitBtn) return;

  var endpoint = (section && section.dataset && section.dataset.gasEndpoint) || "";

  function showMessage(message, status) {
    if (!resultMsg) return;
    if (!message) {
      resultMsg.textContent = "";
      resultMsg.hidden = true;
      return;
    }
    resultMsg.textContent = message;
    resultMsg.hidden = false;
    resultMsg.className = "trialReserve__result";
    if (status) {
      resultMsg.classList.add("trialReserve__result--" + status);
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    var payload = {
      name: (form.name && form.name.value.trim()) || "",
      furigana:
        (form.elements.namedItem("furigana") &&
          form.elements.namedItem("furigana").value.trim()) ||
        "",
      email: (form.email && form.email.value.trim()) || "",
      tel: (form.tel && form.tel.value.trim()) || "",
    };

    if (!payload.name || !payload.furigana || !payload.email || !payload.tel) {
      showMessage("未入力の項目があります。", "error");
      return;
    }

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.setAttribute("aria-busy", "true");
    var originalText = submitBtn.textContent;
    submitBtn.textContent = "送信中...";

    // Save to sessionStorage
    try {
      sessionStorage.setItem("reservationFormData", JSON.stringify(payload));
    } catch (e) {
      console.error("Failed to save form data", e);
    }

    // Send to GAS register mode (non-blocking - we navigate even if it fails)
    if (endpoint && endpoint.indexOf("YOUR_DEPLOYMENT_ID_HERE") === -1) {
      try {
        var formPayload = new URLSearchParams();
        formPayload.set("name", payload.name);
        formPayload.set("furigana", payload.furigana);
        formPayload.set("email", payload.email);
        formPayload.set("tel", payload.tel);

        await fetch(endpoint + "?mode=register", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: formPayload.toString(),
        });
        // We don't wait for response - fire and forget
      } catch (err) {
        // Silently fail - we still navigate to slot selection
        console.warn("Register request failed (continuing anyway)", err);
      }
    }

    // Navigate to slot selection
    window.location.href = "reservation-slot.html";
  });
})();

// Hero scroll indicator button handler
(function () {
  var indicator = document.querySelector('.heroScrollIndicator');
  if (indicator) {
    indicator.addEventListener('click', function () {
      var target = document.getElementById('seqLead');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
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

