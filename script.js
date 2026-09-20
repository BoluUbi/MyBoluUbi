/* =========================================================
   BOLU UBI — PERSONAL BIRTHDAY EXPERIENCE
   =========================================================

   Author's note:
   This file is intentionally vanilla JavaScript.

   The website is not supposed to feel like a "web app".
   It should feel like something Tongzi personally made
   for Tata.

   Emotional architecture:

   01  curiosity
   02  playful teasing
   03  nostalgia
   04  realization
   05  personal details
   06  emotional pause
   07  transition
   08  sincerity
   09  silence
   10  culmination + lingering after-feeling

   ========================================================= */


/* =========================================================
   01. CONFIGURATION
   ========================================================= */

const CONFIG = {
  scenes: 10,

  firstScene: 1,
  finalScene: 10,

  // Audio
  music1Volume: 0.72,
  music2Volume: 0.78,

  audioFadeIn: 2200,
  audioFadeOut: 1800,
  audioCrossfade: 1800,

  // Typing
  defaultTypingSpeed: 28,
  slowTypingSpeed: 42,
  fastTypingSpeed: 18,

  // Scene transition
  transitionDuration: 650,

  // Confetti
  confettiAmount: 70,

  // Storage
  storageKey: "bolu-ubi-progress-v1",

  // Debug mode
  debug: false
};


/* =========================================================
   02. DOM REFERENCES
   ========================================================= */

const DOM = {
  body: document.body,

  app:
    document.querySelector("#app") ||
    document.querySelector(".app") ||
    document.querySelector("main") ||
    document.body,

  scenes: Array.from(document.querySelectorAll(".scene")),

  progress:
    document.querySelector("#sceneProgress") ||
    document.querySelector("[data-scene-progress]"),

  current:
    document.querySelector("#sceneCurrent") ||
    document.querySelector("[data-scene-current]"),

  birthdayMusic:
    document.querySelector("#birthdayMusic"),

  music1:
    document.querySelector("#music1") ||
    document.querySelector('audio[data-music="music1"]') ||
    document.querySelector('audio[data-track="1"]'),

  music2:
    document.querySelector("#music2") ||
    document.querySelector('audio[data-music="music2"]') ||
    document.querySelector('audio[data-track="2"]'),

  enterLetterButton:
    document.querySelector("#enterLetterButton"),

  memoryTimeline:
    document.querySelector("#memoryTimeline"),

  photoStage:
    document.querySelector("#photoStage"),

  confettiLayer:
    document.querySelector("#confettiLayer"),

  musicStatus:
    document.querySelector(".music-status") ||
    document.querySelector("[data-music-status]")
};


/* =========================================================
   03. INTERNAL STATE
   ========================================================= */

const STATE = {
  currentScene: CONFIG.firstScene,

  isTransitioning: false,

  music1Started: false,
  music2Started: false,

  music1FadeTimer: null,
  music2FadeTimer: null,

  typingAbort: null,

  activeLetterPart: 0,

  detailOpen: false,

  finalUnlocked: false,

  firstInteraction: false,

  reducedMotion:
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,

  hasVisited: false,

  // Prevent accidental repeated clicks
  lastNavigationAt: 0,

  // Track whether scene 8 has already been entered
  letterEntered: false,

  // Track whether final scene has already initialized
  finalInitialized: false
};


/* =========================================================
   04. HELPERS
   ========================================================= */

function log(...args) {
  if (CONFIG.debug) {
    console.log("[BOLU UBI]", ...args);
  }
}


function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function isElement(element) {
  return element instanceof Element;
}


function getSceneNumber(scene) {
  if (!scene) return null;

  const idMatch = scene.id?.match(/scene[-_]?0*(\d+)/i);

  if (idMatch) {
    return Number(idMatch[1]);
  }

  const dataScene = scene.dataset.scene;

  if (dataScene && !Number.isNaN(Number(dataScene))) {
    return Number(dataScene);
  }

  const index = DOM.scenes.indexOf(scene);

  return index >= 0 ? index + 1 : null;
}


function getScene(number) {
  const target = Number(number);

  if (!Number.isFinite(target)) {
    return null;
  }

  return (
    DOM.scenes.find(scene => getSceneNumber(scene) === target) ||
    document.querySelector(`#scene-${String(target).padStart(2, "0")}`) ||
    document.querySelector(`#scene-${target}`)
  );
}


function getCurrentScene() {
  return getScene(STATE.currentScene);
}


function getSceneLabel(number) {
  return String(number).padStart(2, "0");
}


function safeFocus(element) {
  if (!element || typeof element.focus !== "function") {
    return;
  }

  try {
    element.focus({
      preventScroll: true
    });
  } catch {
    element.focus();
  }
}


function announce(message) {
  const liveRegion =
    document.querySelector("#liveRegion") ||
    document.querySelector("[aria-live]");

  if (!liveRegion) {
    return;
  }

  liveRegion.textContent = "";

  requestAnimationFrame(() => {
    liveRegion.textContent = message;
  });
}


/* =========================================================
   05. INITIALIZATION
   ========================================================= */

function init() {
  if (!DOM.scenes.length) {
    console.warn(
      "[BOLU UBI] No .scene elements were found. " +
      "Please make sure your HTML scenes use the .scene class."
    );
  }

  loadSavedProgress();

  prepareScenes();

  setupNavigation();

  setupTyping();

  setupLetterParts();

  setupDetailPanels();

  setupMemoryTimeline();

  setupPhoto();

  setupMusic();

  setupRestart();

  setupKeyboard();

  setupVisibilityHandling();

  setupFinalInteraction();

  setupMicroInteractions();

  updateProgress();

  // Always start at the beginning on a fresh load,
  // unless saved-progress restoration is explicitly used.
  const startScene = STATE.hasVisited
    ? STATE.currentScene
    : CONFIG.firstScene;

  activateScene(startScene, {
    initial: true,
    instant: true
  });

  // Make sure the first scene never triggers audio.
  stopAllMusic({
    immediate: true
  });

  DOM.body.classList.add("site-ready");

  requestAnimationFrame(() => {
    DOM.body.classList.add("is-loaded");
  });

  log("Initialized.", {
    scenes: DOM.scenes.length,
    currentScene: STATE.currentScene
  });
}


/* =========================================================
   06. SCENE PREPARATION
   ========================================================= */

function prepareScenes() {
  DOM.scenes.forEach((scene, index) => {
    const number = getSceneNumber(scene) || index + 1;

    scene.dataset.sceneNumber = String(number);

    scene.setAttribute(
      "aria-hidden",
      number === STATE.currentScene ? "false" : "true"
    );

    scene.classList.toggle(
      "is-active",
      number === STATE.currentScene
    );

    scene.classList.remove("is-leaving");

    // Accessibility:
    // inactive scenes should not be keyboard reachable.
    if (number !== STATE.currentScene) {
      scene.setAttribute("inert", "");
    } else {
      scene.removeAttribute("inert");
    }
  });
}


/* =========================================================
   07. NAVIGATION
   ========================================================= */

function setupNavigation() {
  document.addEventListener("click", event => {
    const nextButton = event.target.closest(
      "[data-next-scene]"
    );

    const prevButton = event.target.closest(
      "[data-prev-scene]"
    );

    const directSceneButton = event.target.closest(
      "[data-go-scene]"
    );

    const startMusicButton = event.target.closest(
      "[data-start-music]"
    );

    const restartButton = event.target.closest(
      "[data-restart]"
    );

    if (restartButton) {
      event.preventDefault();
      restartExperience();
      return;
    }

    if (startMusicButton) {
      // Important:
      // Audio starts from an actual user gesture.
      startMusic1();

      const target =
        startMusicButton.dataset.nextScene ||
        startMusicButton.dataset.goScene;

      if (target) {
        event.preventDefault();

        const numericTarget = parseInt(target, 10);

        if (Number.isFinite(numericTarget)) {
          goToScene(numericTarget, {
            reason: "start-music"
          });
        }
      }

      return;
    }

    if (directSceneButton) {
      event.preventDefault();

      const target = parseInt(
        directSceneButton.dataset.goScene,
        10
      );

      if (Number.isFinite(target)) {
        goToScene(target, {
          reason: "direct-button"
        });
      }

      return;
    }

    if (nextButton) {
      event.preventDefault();

      const target =
        parseInt(nextButton.dataset.nextScene, 10) ||
        STATE.currentScene + 1;

      goToScene(target, {
        reason: "next-button"
      });

      return;
    }

    if (prevButton) {
      event.preventDefault();

      const target =
        parseInt(prevButton.dataset.prevScene, 10) ||
        STATE.currentScene - 1;

      goToScene(target, {
        reason: "prev-button"
      });

      return;
    }
  });
}


async function goToScene(
  target,
  {
    reason = "unknown",
    instant = false
  } = {}
) {
  const nextSceneNumber = clamp(
    Number(target),
    CONFIG.firstScene,
    CONFIG.finalScene
  );

  const currentSceneNumber = STATE.currentScene;

  if (
    nextSceneNumber === currentSceneNumber &&
    !instant
  ) {
    return;
  }

  if (STATE.isTransitioning && !instant) {
    return;
  }

  const nextScene = getScene(nextSceneNumber);

  if (!nextScene) {
    log("Scene not found:", nextSceneNumber);
    return;
  }

  const currentScene = getCurrentScene();

  STATE.isTransitioning = true;
  STATE.lastNavigationAt = Date.now();

  log(
    `Scene ${currentSceneNumber} → ${nextSceneNumber}`,
    reason
  );

  // Music handling happens BEFORE scene activation
  // for the emotional transition.
  if (nextSceneNumber === CONFIG.finalScene) {
    await transitionToClimaxMusic();
  }

  if (
    currentSceneNumber !== CONFIG.finalScene &&
    nextSceneNumber !== CONFIG.finalScene
  ) {
    // Keep music 1 alive through the emotional middle.
    // It only gets stopped when music 2 begins.
  }

  if (currentScene) {
    currentScene.classList.add("is-leaving");
    currentScene.classList.remove("scene-revealed");
  }

  nextScene.classList.add("is-preparing");

  // Allow the browser to paint the outgoing state.
  if (!instant && !STATE.reducedMotion) {
    await sleep(90);
  }

  DOM.scenes.forEach(scene => {
    const number = getSceneNumber(scene);

    const active = number === nextSceneNumber;

    scene.classList.toggle("is-active", active);

    scene.setAttribute(
      "aria-hidden",
      active ? "false" : "true"
    );

    if (active) {
      scene.removeAttribute("inert");
    } else {
      scene.setAttribute("inert", "");
    }
  });

  STATE.currentScene = nextSceneNumber;

  updateProgress();

  saveProgress();

  // Clear scene preparation class after activation.
  requestAnimationFrame(() => {
    nextScene.classList.remove("is-preparing");
    nextScene.classList.add("scene-revealed");

    if (currentScene) {
      currentScene.classList.remove("is-leaving");
    }
  });

  handleSceneEntry(nextSceneNumber);

  // We intentionally do NOT use:
  //
  // window.scrollTo(...)
  //
  // here.
  //
  // This is important for mobile because natural vertical
  // scrolling inside a scene should not be mistaken for
  // scene navigation.

  if (!instant && !STATE.reducedMotion) {
    await sleep(CONFIG.transitionDuration);
  }

  STATE.isTransitioning = false;

  announce(
    `Scene ${getSceneLabel(nextSceneNumber)}`
  );
}


/* =========================================================
   08. SCENE ENTRY LOGIC
   ========================================================= */

function handleSceneEntry(sceneNumber) {
  const scene = getScene(sceneNumber);

  if (!scene) return;

  switch (sceneNumber) {
    case 1:
      enterScene01(scene);
      break;

    case 2:
      enterScene02(scene);
      break;

    case 3:
      enterScene03(scene);
      break;

    case 4:
      enterScene04(scene);
      break;

    case 5:
      enterScene05(scene);
      break;

    case 6:
      enterScene06(scene);
      break;

    case 7:
      enterScene07(scene);
      break;

    case 8:
      enterScene08(scene);
      break;

    case 9:
      enterScene09(scene);
      break;

    case 10:
      enterScene10(scene);
      break;
  }
}


/* =========================================================
   09. SCENE 01 — ENTRANCE
   ========================================================= */

function enterScene01(scene) {
  scene.classList.add("entrance-active");

  // Reset the entrance animation state so returning to scene 1
  // feels intentional.
  scene.classList.remove("entrance-complete");

  requestAnimationFrame(() => {
    scene.classList.add("entrance-complete");
  });
}


/* =========================================================
   10. SCENE 02 — BIRTHDAY
   ========================================================= */

function enterScene02(scene) {
  scene.classList.add("birthday-active");

  // Little delayed reveal for playful elements.
  const playfulElements = scene.querySelectorAll(
    "[data-playful-reveal]"
  );

  playfulElements.forEach((element, index) => {
    element.style.setProperty(
      "--playful-delay",
      `${index * 120}ms`
    );
  });
}


/* =========================================================
   11. SCENE 03 — MEMORY / OSN TIMELINE
   ========================================================= */

function enterScene03(scene) {
  scene.classList.add("memory-active");

  const timeline = scene.querySelector(
    "#memoryTimeline"
  );

  if (!timeline) return;

  const items = timeline.querySelectorAll(
    "[data-memory-item], .memory-item, .timeline-item"
  );

  items.forEach((item, index) => {
    item.style.setProperty(
      "--memory-delay",
      `${index * 140}ms`
    );
  });
}


/* =========================================================
   12. SCENE 04 — THINGS I LIKE
   ========================================================= */

function enterScene04(scene) {
  scene.classList.add("traits-active");

  const cards = scene.querySelectorAll(
    "[data-trait], .trait-card"
  );

  cards.forEach((card, index) => {
    card.style.setProperty(
      "--trait-delay",
      `${index * 110}ms`
    );
  });
}


/* =========================================================
   13. SCENE 05 — PERSONAL DETAILS / HYDROPONICS
   ========================================================= */

function enterScene05(scene) {
  scene.classList.add("details-active");

  const cards = scene.querySelectorAll(
    "[data-detail-card], .fact-card"
  );

  cards.forEach((card, index) => {
    card.style.setProperty(
      "--detail-delay",
      `${index * 90}ms`
    );
  });
}


/* =========================================================
   14. SCENE 06 — PHOTO
   ========================================================= */

function enterScene06(scene) {
  scene.classList.add("photo-active");

  preparePhotoReveal(scene);
}


function preparePhotoReveal(scene) {
  const image =
    scene.querySelector("img") ||
    document.querySelector("#photoStage img");

  if (!image) return;

  image.classList.remove("photo-loaded");

  if (image.complete && image.naturalWidth > 0) {
    requestAnimationFrame(() => {
      image.classList.add("photo-loaded");
    });
  }
}


/* =========================================================
   15. SCENE 07 — LETTER GATEWAY / MUSIC
   ========================================================= */

function enterScene07(scene) {
  scene.classList.add("letter-gateway-active");

  // The actual music starts from the user's button gesture,
  // not merely because scene 7 appeared.
  //
  // This preserves browser autoplay rules AND makes the
  // interaction feel intentional.

  if (STATE.music1Started) {
    scene.classList.add("music-is-ready");
  }
}


/* =========================================================
   16. SCENE 08 — LETTER
   ========================================================= */

function enterScene08(scene) {
  STATE.letterEntered = true;

  scene.classList.add("letter-active");

  // Music 1 should be alive here.
  if (!STATE.music1Started) {
    // We do NOT force autoplay here.
    // User gesture is required.
    scene.classList.add("music-awaiting-gesture");
  } else {
    scene.classList.add("music-playing");
  }

  // Prepare letter sections.
  const parts = scene.querySelectorAll(
    ".letter__part, [data-letter-part]"
  );

  parts.forEach((part, index) => {
    part.dataset.letterIndex = String(index);
  });

  // If the HTML has an explicit first letter part,
  // reveal it gently.
  revealFirstLetterPart(scene);
}


function revealFirstLetterPart(scene) {
  const first =
    scene.querySelector(
      '[data-letter-part="1"]'
    ) ||
    scene.querySelector(
      ".letter__part:first-child"
    );

  if (!first) return;

  first.classList.add("is-visible");
}


/* =========================================================
   17. SCENE 09 — QUIET AFTERGLOW
   ========================================================= */

function enterScene09(scene) {
  scene.classList.add("quiet-active");

  // The emotional pacing intentionally slows down here.
  //
  // We don't launch confetti.
  // We don't create a dramatic animation.
  // We let silence do the work.

  const quietElements = scene.querySelectorAll(
    "[data-quiet-reveal], .quiet-reveal"
  );

  quietElements.forEach((element, index) => {
    element.style.setProperty(
      "--quiet-delay",
      `${index * 500}ms`
    );
  });
}


/* =========================================================
   18. SCENE 10 — FINAL
   ========================================================= */

function enterScene10(scene) {
  if (!STATE.finalInitialized) {
    STATE.finalInitialized = true;

    scene.classList.add("final-first-entry");

    requestAnimationFrame(() => {
      scene.classList.add("final-ready");
    });
  } else {
    scene.classList.add("final-returning");
  }

  STATE.finalUnlocked = true;

  updateFinalControls(scene);

  // Celebration starts AFTER the final scene is visible.
  // This prevents the site from becoming a confetti explosion
  // before the emotional peak lands.
  if (!STATE.reducedMotion) {
    setTimeout(() => {
      launchConfetti(CONFIG.confettiAmount);
    }, 650);
  }
}


/* =========================================================
   19. PROGRESS INDICATOR
   ========================================================= */

function updateProgress() {
  const current = STATE.currentScene;
  const total = CONFIG.scenes;

  if (DOM.current) {
    DOM.current.textContent = getSceneLabel(current);
  }

  if (DOM.progress) {
    const percentage =
      ((current - 1) / (total - 1)) * 100;

    DOM.progress.style.setProperty(
      "--progress",
      `${clamp(percentage, 0, 100)}%`
    );

    // Support both width and transform based implementations.
    DOM.progress.style.width =
      `${clamp(percentage, 0, 100)}%`;

    DOM.progress.setAttribute(
      "aria-valuenow",
      String(current)
    );

    DOM.progress.setAttribute(
      "aria-valuemax",
      String(total)
    );
  }

  // Optional scene dots
  document
    .querySelectorAll("[data-scene-dot]")
    .forEach(dot => {
      const target = Number(
        dot.dataset.sceneDot
      );

      dot.classList.toggle(
        "is-active",
        target === current
      );

      dot.classList.toggle(
        "is-past",
        target < current
      );
    });
}


/* =========================================================
   20. TYPING ENGINE
   ========================================================= */

function setupTyping() {
  const typingElements =
    document.querySelectorAll(
      "[data-typing], .js-typing"
    );

  typingElements.forEach(element => {
    // Store original content only once.
    if (!element.dataset.typingOriginal) {
      element.dataset.typingOriginal =
        element.textContent;
    }

    element.setAttribute(
      "aria-label",
      element.textContent.trim()
    );
  });
}


async function typeElement(
  element,
  {
    speed = CONFIG.defaultTypingSpeed,
    delay = 0,
    cursor = true,
    preserveWhitespace = true,
    force = false
  } = {}
) {
  if (!element) return;

  if (
    element.dataset.typingDone === "true" &&
    !force
  ) {
    return;
  }

  cancelTyping();

  const controller = new AbortController();

  STATE.typingAbort = controller;

  const original =
    element.dataset.typingOriginal ??
    element.textContent ??
    "";

  const finalText = preserveWhitespace
    ? original
    : original.replace(/\s+/g, " ").trim();

  element.classList.add("is-typing");

  if (cursor) {
    element.classList.add("has-typing-cursor");
  }

  if (delay > 0) {
    await sleep(delay);

    if (controller.signal.aborted) {
      return;
    }
  }

  element.textContent = "";

  for (let i = 0; i < finalText.length; i++) {
    if (controller.signal.aborted) {
      return;
    }

    element.textContent += finalText[i];

    // Natural typing rhythm.
    let actualSpeed = speed;

    const character = finalText[i];

    if (character === ".") {
      actualSpeed *= 3.0;
    }

    if (character === ",") {
      actualSpeed *= 1.8;
    }

    if (character === "…") {
      actualSpeed *= 4.0;
    }

    if (character === "\n") {
      actualSpeed *= 1.2;
    }

    // Tiny human-like variance.
    if (!STATE.reducedMotion) {
      actualSpeed += Math.random() * 12 - 6;
    }

    await sleep(
      clamp(actualSpeed, 8, 120)
    );
  }

  if (controller.signal.aborted) {
    return;
  }

  element.dataset.typingDone = "true";
  element.classList.remove("is-typing");

  // Keep the cursor for a moment before removing it.
  if (cursor) {
    await sleep(
      STATE.reducedMotion ? 0 : 650
    );

    element.classList.remove(
      "has-typing-cursor"
    );
  }

  STATE.typingAbort = null;
}


function cancelTyping() {
  if (STATE.typingAbort) {
    STATE.typingAbort.abort();
    STATE.typingAbort = null;
  }

  document
    .querySelectorAll(
      ".is-typing, .has-typing-cursor"
    )
    .forEach(element => {
      element.classList.remove(
        "is-typing",
        "has-typing-cursor"
      );
    });
}


/* =========================================================
   21. LETTER PARTS
   ========================================================= */

function setupLetterParts() {
  document.addEventListener("click", event => {
    const nextLetter = event.target.closest(
      "[data-next-letter]"
    );

    const prevLetter = event.target.closest(
      "[data-prev-letter]"
    );

    if (nextLetter) {
      event.preventDefault();
      nextLetterPart();
      return;
    }

    if (prevLetter) {
      event.preventDefault();
      previousLetterPart();
    }
  });
}


function getLetterParts() {
  const scene =
    getScene(8) ||
    document.querySelector(
      '[data-scene="8"]'
    );

  if (!scene) return [];

  return Array.from(
    scene.querySelectorAll(
      ".letter__part, [data-letter-part]"
    )
  );
}


function nextLetterPart() {
  const parts = getLetterParts();

  if (!parts.length) {
    return;
  }

  STATE.activeLetterPart = clamp(
    STATE.activeLetterPart + 1,
    0,
    parts.length - 1
  );

  revealLetterPart(
    parts,
    STATE.activeLetterPart
  );
}


function previousLetterPart() {
  const parts = getLetterParts();

  if (!parts.length) {
    return;
  }

  STATE.activeLetterPart = clamp(
    STATE.activeLetterPart - 1,
    0,
    parts.length - 1
  );

  revealLetterPart(
    parts,
    STATE.activeLetterPart
  );
}


function revealLetterPart(parts, index) {
  parts.forEach((part, partIndex) => {
    const active =
      partIndex === index;

    part.classList.toggle(
      "is-visible",
      active
    );

    part.classList.toggle(
      "is-current",
      active
    );

    part.setAttribute(
      "aria-hidden",
      active ? "false" : "true"
    );
  });

  const current = parts[index];

  if (!current) return;

  current.scrollIntoView({
    behavior:
      STATE.reducedMotion
        ? "auto"
        : "smooth",

    block: "nearest"
  });

  // If a letter part has typing enabled,
  // start it only when that part becomes relevant.
  const typingElement =
    current.querySelector(
      "[data-typing], .js-typing"
    );

  if (typingElement) {
    typeElement(
      typingElement,
      {
        speed:
          Number(
            typingElement.dataset.typingSpeed
          ) ||
          CONFIG.defaultTypingSpeed,

        delay:
          Number(
            typingElement.dataset.typingDelay
          ) ||
          0
      }
    );
  }
}


/* =========================================================
   22. HYDROPONICS / DETAIL PANELS
   ========================================================= */

function setupDetailPanels() {
  document.addEventListener("click", event => {
    const toggle = event.target.closest(
      "[data-toggle-detail]"
    );

    if (!toggle) {
      return;
    }

    event.preventDefault();

    const targetId =
      toggle.dataset.detailPanel;

    let panel = null;

    if (targetId) {
      panel =
        document.getElementById(targetId) ||
        document.querySelector(
          `[data-detail-panel="${CSS.escape(targetId)}"]`
        );
    }

    if (!panel) {
      // Fallback:
      // if the toggle is inside a card,
      // search the nearest detail panel.
      const parent =
        toggle.closest(
          "[data-detail-card], .detail-card, .fact-card"
        );

      panel =
        parent?.querySelector(
          "[data-detail-content], .detail-panel"
        );
    }

    if (!panel) {
      return;
    }

    const isOpen =
      panel.classList.contains("is-open");

    panel.classList.toggle(
      "is-open",
      !isOpen
    );

    toggle.classList.toggle(
      "is-active",
      !isOpen
    );

    toggle.setAttribute(
      "aria-expanded",
      String(!isOpen)
    );

    panel.setAttribute(
      "aria-hidden",
      String(isOpen)
    );

    if (!isOpen) {
      panel.removeAttribute("hidden");

      if (!STATE.reducedMotion) {
        requestAnimationFrame(() => {
          panel.classList.add(
            "detail-opening"
          );
        });
      }
    } else {
      panel.classList.remove(
        "detail-opening"
      );
    }

    STATE.detailOpen = !isOpen;
  });
}


/* =========================================================
   23. MEMORY TIMELINE
   ========================================================= */

function setupMemoryTimeline() {
  const timeline =
    DOM.memoryTimeline;

  if (!timeline) {
    return;
  }

  const items = timeline.querySelectorAll(
    "[data-memory-item], .memory-item, .timeline-item"
  );

  items.forEach(item => {
    item.setAttribute(
      "tabindex",
      "0"
    );

    item.addEventListener(
      "click",
      () => {
        activateMemoryItem(
          items,
          item
        );
      }
    );

    item.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();

          activateMemoryItem(
            items,
            item
          );
        }
      }
    );
  });
}


function activateMemoryItem(
  items,
  selected
) {
  items.forEach(item => {
    item.classList.toggle(
      "is-selected",
      item === selected
    );
  });

  selected.classList.add(
    "memory-item-pulse"
  );

  setTimeout(() => {
    selected.classList.remove(
      "memory-item-pulse"
    );
  }, 700);
}


/* =========================================================
   24. PHOTO HANDLING
   ========================================================= */

function setupPhoto() {
  const photoContainers =
    document.querySelectorAll(
      "#photoStage, [data-photo-stage]"
    );

  photoContainers.forEach(stage => {
    const images =
      stage.querySelectorAll("img");

    images.forEach(image => {
      image.addEventListener(
        "load",
        () => {
          image.classList.add(
            "photo-loaded"
          );

          image.classList.remove(
            "photo-error"
          );
        },
        {
          once: false
        }
      );

      image.addEventListener(
        "error",
        () => {
          image.classList.add(
            "photo-error"
          );

          stage.classList.add(
            "photo-missing"
          );

          log(
            "Photo failed to load:",
            image.src
          );
        }
      );
    });
  });
}


/* =========================================================
   25. MUSIC SYSTEM
   ========================================================= */

function setupMusic() {
  const music1 =
    getMusic1();

  const music2 =
    getMusic2();

  if (music1) {
    configureAudio(music1);
  }

  if (music2) {
    configureAudio(music2);
  }

  // Existing legacy audio ID support.
  if (
    DOM.birthdayMusic &&
    DOM.birthdayMusic !== music1 &&
    !music1
  ) {
    configureAudio(
      DOM.birthdayMusic
    );
  }

  // If there is an explicit play button,
  // connect it to music 1.
  document.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-play-music], #playMusic, .music-play"
        );

      if (!button) return;

      event.preventDefault();

      if (STATE.music1Started) {
        toggleMusic1();
      } else {
        startMusic1();
      }
    }
  );

  // Audio status updates
  [music1, music2]
    .filter(Boolean)
    .forEach(audio => {
      audio.addEventListener(
        "play",
        () => {
          updateMusicStatus(
            true,
            audio === music2
              ? "music2"
              : "music1"
          );
        }
      );

      audio.addEventListener(
        "pause",
        () => {
          if (
            audio === music1 &&
            !music2?.playing
          ) {
            updateMusicStatus(
              false,
              "music1"
            );
          }
        }
      );

      audio.addEventListener(
        "ended",
        () => {
          if (audio === music1) {
            STATE.music1Started = false;

            updateMusicStatus(
              false,
              "music1"
            );
          }

          if (audio === music2) {
            STATE.music2Started = false;

            updateMusicStatus(
              false,
              "music2"
            );
          }
        }
      );
    });
}


function getMusic1() {
  return (
    DOM.music1 ||
    DOM.birthdayMusic ||
    document.querySelector(
      'audio[data-role="music1"]'
    ) ||
    document.querySelector(
      'audio[src*="music1"]'
    )
  );
}


function getMusic2() {
  return (
    DOM.music2 ||
    document.querySelector(
      'audio[data-role="music2"]'
    ) ||
    document.querySelector(
      'audio[src*="music2"]'
    )
  );
}


function configureAudio(audio) {
  if (!audio) return;

  audio.preload = "auto";

  audio.volume = 0;

  // Prevent the browser from treating it as
  // an automatic playback element.
  audio.autoplay = false;
}


async function startMusic1() {
  const audio = getMusic1();

  if (!audio) {
    log(
      "Music 1 not found. " +
      "Expected #music1 or #birthdayMusic."
    );

    return false;
  }

  // If music 2 is accidentally active,
  // stop it before music 1 begins.
  const music2 = getMusic2();

  if (
    music2 &&
    !music2.paused
  ) {
    await fadeOutAudio(
      music2,
      CONFIG.audioFadeOut
    );

    music2.pause();
    music2.currentTime = 0;

    STATE.music2Started = false;
  }

  try {
    if (
      audio.readyState < 2
    ) {
      audio.load();
    }

    // If already playing, don't restart it.
    if (!audio.paused) {
      STATE.music1Started = true;

      document.body.classList.add(
        "music-playing"
      );

      return true;
    }

    audio.currentTime =
      Number.isFinite(audio.currentTime)
        ? audio.currentTime
        : 0;

    audio.volume = 0;

    const playPromise =
      audio.play();

    if (
      playPromise &&
      typeof playPromise.then === "function"
    ) {
      await playPromise;
    }

    STATE.music1Started = true;

    document.body.classList.add(
      "music-playing"
    );

    document.body.classList.remove(
      "music2-playing"
    );

    updateMusicStatus(
      true,
      "music1"
    );

    await fadeInAudio(
      audio,
      CONFIG.music1Volume,
      CONFIG.audioFadeIn
    );

    return true;

  } catch (error) {
    console.warn(
      "[BOLU UBI] Music 1 could not start:",
      error
    );

    document.body.classList.add(
      "music-awaiting-gesture"
    );

    return false;
  }
}


async function toggleMusic1() {
  const audio = getMusic1();

  if (!audio) return;

  if (audio.paused) {
    await startMusic1();
  } else {
    await fadeOutAudio(
      audio,
      CONFIG.audioFadeOut
    );

    audio.pause();

    updateMusicStatus(
      false,
      "music1"
    );
  }
}


async function transitionToClimaxMusic() {
  const music1 = getMusic1();
  const music2 = getMusic2();

  // If there is no music 2, simply stop music 1.
  if (!music2) {
    if (music1) {
      await fadeOutAudio(
        music1,
        CONFIG.audioFadeOut
      );

      music1.pause();
    }

    document.body.classList.remove(
      "music-playing"
    );

    return;
  }

  // Stop music 1 FIRST.
  if (
    music1 &&
    !music1.paused
  ) {
    await fadeOutAudio(
      music1,
      CONFIG.audioCrossfade
    );

    music1.pause();
    music1.currentTime = 0;

    STATE.music1Started = false;
  }

  try {
    music2.currentTime = 0;
    music2.volume = 0;

    const playPromise =
      music2.play();

    if (
      playPromise &&
      typeof playPromise.then === "function"
    ) {
      await playPromise;
    }

    STATE.music2Started = true;

    document.body.classList.remove(
      "music-playing"
    );

    document.body.classList.add(
      "music2-playing"
    );

    document.body.classList.add(
      "letter-is-playing"
    );

    updateMusicStatus(
      true,
      "music2"
    );

    await fadeInAudio(
      music2,
      CONFIG.music2Volume,
      CONFIG.audioCrossfade
    );

  } catch (error) {
    console.warn(
      "[BOLU UBI] Music 2 could not start:",
      error
    );
  }
}


function stopAllMusic({
  immediate = false
} = {}) {
  const audios = [
    getMusic1(),
    getMusic2()
  ].filter(Boolean);

  audios.forEach(audio => {
    if (immediate) {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;
    } else {
      fadeOutAudio(
        audio,
        CONFIG.audioFadeOut
      ).then(() => {
        audio.pause();
        audio.currentTime = 0;
      });
    }
  });

  STATE.music1Started = false;
  STATE.music2Started = false;

  document.body.classList.remove(
    "music-playing",
    "music2-playing",
    "letter-is-playing"
  );
}


function fadeInAudio(
  audio,
  targetVolume,
  duration
) {
  if (!audio) {
    return Promise.resolve();
  }

  if (STATE.reducedMotion) {
    audio.volume =
      clamp(targetVolume, 0, 1);

    return Promise.resolve();
  }

  clearInterval(
    audio.__fadeTimer
  );

  const startVolume =
    Number.isFinite(audio.volume)
      ? audio.volume
      : 0;

  const startTime =
    performance.now();

  return new Promise(resolve => {
    audio.__fadeTimer =
      setInterval(() => {
        const elapsed =
          performance.now() -
          startTime;

        const progress =
          clamp(
            elapsed / duration,
            0,
            1
          );

        // Smooth ease-out.
        const eased =
          1 -
          Math.pow(
            1 - progress,
            3
          );

        audio.volume =
          startVolume +
          (
            targetVolume -
            startVolume
          ) * eased;

        if (progress >= 1) {
          clearInterval(
            audio.__fadeTimer
          );

          audio.volume =
            clamp(
              targetVolume,
              0,
              1
            );

          resolve();
        }
      }, 30);
  });
}


function fadeOutAudio(
  audio,
  duration
) {
  if (!audio) {
    return Promise.resolve();
  }

  if (STATE.reducedMotion) {
    audio.volume = 0;

    return Promise.resolve();
  }

  clearInterval(
    audio.__fadeTimer
  );

  const startVolume =
    Number.isFinite(audio.volume)
      ? audio.volume
      : 0;

  const startTime =
    performance.now();

  return new Promise(resolve => {
    audio.__fadeTimer =
      setInterval(() => {
        const elapsed =
          performance.now() -
          startTime;

        const progress =
          clamp(
            elapsed / duration,
            0,
            1
          );

        const eased =
          1 -
          Math.pow(
            1 - progress,
            3
          );

        audio.volume =
          startVolume *
          (1 - eased);

        if (progress >= 1) {
          clearInterval(
            audio.__fadeTimer
          );

          audio.volume = 0;

          resolve();
        }
      }, 30);
  });
}


function updateMusicStatus(
  playing,
  track
) {
  if (!DOM.musicStatus) {
    return;
  }

  DOM.musicStatus.classList.toggle(
    "is-playing",
    playing
  );

  DOM.musicStatus.dataset.track =
    track || "";

  const label =
    DOM.musicStatus.querySelector(
      "[data-music-label]"
    );

  if (label) {
    if (!playing) {
      label.textContent =
        "music paused";
    } else if (track === "music2") {
      label.textContent =
        "stay here for a little while";
    } else {
      label.textContent =
        "put this on while you read";
    }
  }
}


/* =========================================================
   26. RESTART
   ========================================================= */

function setupRestart() {
  document.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-restart]"
        );

      if (!button) return;

      event.preventDefault();

      restartExperience();
    }
  );
}


async function restartExperience() {
  if (STATE.isTransitioning) {
    return;
  }

  stopAllMusic({
    immediate: false
  });

  cancelTyping();

  STATE.currentScene =
    CONFIG.firstScene;

  STATE.activeLetterPart = 0;

  STATE.detailOpen = false;

  STATE.finalUnlocked = false;

  STATE.finalInitialized = false;

  STATE.letterEntered = false;

  STATE.hasVisited = false;

  try {
    localStorage.removeItem(
      CONFIG.storageKey
    );
  } catch {
    // Storage may be disabled.
  }

  document.body.classList.remove(
    "final-mode",
    "music-playing",
    "music2-playing",
    "letter-is-playing"
  );

  document
    .querySelectorAll(
      ".is-open, .is-selected, .is-visible"
    )
    .forEach(element => {
      element.classList.remove(
        "is-open",
        "is-selected",
        "is-visible"
      );
    });

  await goToScene(
    CONFIG.firstScene,
    {
      reason: "restart",
      instant: true
    }
  );
}


/* =========================================================
   27. KEYBOARD SUPPORT
   ========================================================= */

function setupKeyboard() {
  document.addEventListener(
    "keydown",
    event => {
      // Never hijack keyboard input while typing in an input.
      const target =
        event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }

      if (
        event.key === "ArrowRight" ||
        event.key === "PageDown"
      ) {
        event.preventDefault();

        goToScene(
          STATE.currentScene + 1,
          {
            reason: "keyboard-next"
          }
        );
      }

      if (
        event.key === "ArrowLeft" ||
        event.key === "PageUp"
      ) {
        event.preventDefault();

        goToScene(
          STATE.currentScene - 1,
          {
            reason: "keyboard-prev"
          }
        );
      }

      if (
        event.key === "Home"
      ) {
        event.preventDefault();

        goToScene(
          CONFIG.firstScene,
          {
            reason: "keyboard-home"
          }
        );
      }

      if (
        event.key === "End"
      ) {
        event.preventDefault();

        goToScene(
          CONFIG.finalScene,
          {
            reason: "keyboard-end"
          }
        );
      }

      // Space can advance only when it is not focused
      // on a button/link.
      if (
        event.key === " " &&
        !(
          target instanceof HTMLButtonElement ||
          target instanceof HTMLAnchorElement
        )
      ) {
        event.preventDefault();

        goToScene(
          STATE.currentScene + 1,
          {
            reason: "keyboard-space"
          }
        );
      }
    }
  );
}


/* =========================================================
   28. VISIBILITY / TAB HANDLING
   ========================================================= */

function setupVisibilityHandling() {
  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.visibilityState ===
        "hidden"
      ) {
        // Do NOT kill audio immediately.
        // Mobile browsers can briefly mark a page hidden
        // during UI transitions.
        return;
      }

      if (
        document.visibilityState ===
        "visible"
      ) {
        // Restore visual state if necessary.
        updateProgress();
      }
    }
  );
}


/* =========================================================
   29. FINAL INTERACTION
   ========================================================= */

function setupFinalInteraction() {
  document.addEventListener(
    "click",
    event => {
      const finalButton =
        event.target.closest(
          "[data-final-action]"
        );

      if (!finalButton) {
        return;
      }

      event.preventDefault();

      const action =
        finalButton.dataset.finalAction;

      switch (action) {
        case "reveal":
          revealFinalAfterglow();
          break;

        case "celebrate":
          launchConfetti(
            CONFIG.confettiAmount + 35
          );

          revealFinalAfterglow();
          break;

        case "stay":
          revealFinalAfterglow({
            gentle: true
          });
          break;

        case "restart":
          restartExperience();
          break;

        default:
          revealFinalAfterglow();
      }
    }
  );
}


function updateFinalControls(scene) {
  const buttons =
    scene.querySelectorAll(
      "[data-final-action]"
    );

  buttons.forEach(button => {
    button.classList.add(
      "final-control-ready"
    );
  });
}


function revealFinalAfterglow({
  gentle = false
} = {}) {
  const finalScene =
    getScene(CONFIG.finalScene);

  if (!finalScene) {
    return;
  }

  finalScene.classList.add(
    "afterglow-revealed"
  );

  document.body.classList.add(
    "final-afterglow"
  );

  const afterglow =
    finalScene.querySelector(
      "[data-final-afterglow], .final-afterglow"
    );

  if (afterglow) {
    afterglow.removeAttribute(
      "hidden"
    );

    afterglow.classList.add(
      "is-visible"
    );
  }

  if (!gentle) {
    launchConfetti(28);
  }

  // A final little piece of text can be delayed,
  // so the page doesn't feel like it instantly dumps
  // everything at once.
  const delayed =
    finalScene.querySelector(
      "[data-final-delayed]"
    );

  if (delayed) {
    setTimeout(() => {
      delayed.classList.add(
        "is-visible"
      );
    }, gentle ? 350 : 550);
  }
}


/* =========================================================
   30. CONFETTI
   ========================================================= */

function launchConfetti(
  amount = CONFIG.confettiAmount
) {
  const layer =
    DOM.confettiLayer ||
    document.querySelector(
      "#confettiLayer"
    );

  if (!layer) {
    return;
  }

  if (STATE.reducedMotion) {
    return;
  }

  layer.classList.add(
    "is-active"
  );

  const fragment =
    document.createDocumentFragment();

  for (
    let i = 0;
    i < amount;
    i++
  ) {
    const piece =
      document.createElement("span");

    piece.className =
      "confetti-piece";

    const x =
      Math.random() * 100;

    const drift =
      (Math.random() - 0.5) * 180;

    const duration =
      2.8 +
      Math.random() * 2.8;

    const delay =
      Math.random() * 0.55;

    const rotation =
      Math.random() * 720 - 360;

    const size =
      5 +
      Math.random() * 8;

    piece.style.setProperty(
      "--confetti-x",
      `${x}vw`
    );

    piece.style.setProperty(
      "--confetti-drift",
      `${drift}px`
    );

    piece.style.setProperty(
      "--confetti-duration",
      `${duration}s`
    );

    piece.style.setProperty(
      "--confetti-delay",
      `${delay}s`
    );

    piece.style.setProperty(
      "--confetti-rotation",
      `${rotation}deg`
    );

    piece.style.setProperty(
      "--confetti-size",
      `${size}px`
    );

    fragment.appendChild(piece);
  }

  layer.appendChild(fragment);

  setTimeout(
    () => {
      layer
        .querySelectorAll(
          ".confetti-piece"
        )
        .forEach(piece => {
          piece.remove();
        });

      layer.classList.remove(
        "is-active"
      );
    },
    6500
  );
}


/* =========================================================
   31. MICRO INTERACTIONS
   ========================================================= */

function setupMicroInteractions() {
  // Add a tiny pressed state through JS as a fallback
  // for browsers where CSS :active feels too short.
  document.addEventListener(
    "pointerdown",
    event => {
      const interactive =
        event.target.closest(
          "button, a, [role='button'], [data-next-scene], [data-prev-scene]"
        );

      if (!interactive) {
        return;
      }

      interactive.classList.add(
        "is-pressed"
      );
    }
  );

  document.addEventListener(
    "pointerup",
    event => {
      const interactive =
        event.target.closest(
          "button, a, [role='button'], [data-next-scene], [data-prev-scene]"
        );

      if (!interactive) {
        return;
      }

      setTimeout(() => {
        interactive.classList.remove(
          "is-pressed"
        );
      }, 80);
    }
  );

  document.addEventListener(
    "pointercancel",
    event => {
      const interactive =
        event.target.closest(
          "button, a, [role='button'], [data-next-scene], [data-prev-scene]"
        );

      if (!interactive) {
        return;
      }

      interactive.classList.remove(
        "is-pressed"
      );
    }
  );


  // Small parallax only on pointer-capable devices.
  setupGentlePointerMotion();
}


function setupGentlePointerMotion() {
  if (
    STATE.reducedMotion ||
    !window.matchMedia(
      "(pointer: fine)"
    ).matches
  ) {
    return;
  }

  let raf = null;

  window.addEventListener(
    "pointermove",
    event => {
      if (raf) {
        cancelAnimationFrame(raf);
      }

      raf = requestAnimationFrame(() => {
        const activeScene =
          getCurrentScene();

        if (!activeScene) {
          return;
        }

        const interactive =
          activeScene.querySelector(
            "[data-parallax]"
          );

        if (!interactive) {
          return;
        }

        const rect =
          activeScene.getBoundingClientRect();

        const x =
          (
            event.clientX -
            rect.left
          ) /
          rect.width;

        const y =
          (
            event.clientY -
            rect.top
          ) /
          rect.height;

        const rotateX =
          (0.5 - y) * 2.2;

        const rotateY =
          (x - 0.5) * 2.2;

        interactive.style.setProperty(
          "--pointer-x",
          `${x}`
        );

        interactive.style.setProperty(
          "--pointer-y",
          `${y}`
        );

        interactive.style.setProperty(
          "--pointer-rx",
          `${rotateX}deg`
        );

        interactive.style.setProperty(
          "--pointer-ry",
          `${rotateY}deg`
        );
      });
    },
    {
      passive: true
    }
  );
}


/* =========================================================
   32. TOUCH SAFETY
   =========================================================

   IMPORTANT:

   There is deliberately NO global touchend handler here.

   Earlier versions of this kind of website often do:

       touchstart
       touchend
       if delta > X -> next scene

   That causes a serious UX problem on mobile:

       user tries to scroll text
              ↓
       JS thinks it is a swipe
              ↓
       scene changes

   For this project, vertical reading is more important.

   Scene changes therefore happen through:
   - buttons
   - explicit controls
   - keyboard
   - intentional direct scene controls

   This leaves normal:
       touch scrolling
       text selection
       pinch zoom
       momentum scrolling

   untouched.
   ========================================================= */


/* =========================================================
   33. PERSISTENCE
   ========================================================= */

function saveProgress() {
  try {
    const data = {
      scene:
        STATE.currentScene,

      timestamp:
        Date.now()
    };

    localStorage.setItem(
      CONFIG.storageKey,
      JSON.stringify(data)
    );
  } catch {
    // localStorage can be disabled.
  }
}


function loadSavedProgress() {
  try {
    const raw =
      localStorage.getItem(
        CONFIG.storageKey
      );

    if (!raw) {
      STATE.hasVisited = false;
      return;
    }

    const data =
      JSON.parse(raw);

    if (
      !data ||
      !Number.isFinite(
        Number(data.scene)
      )
    ) {
      STATE.hasVisited = false;
      return;
    }

    // We intentionally do not restore scene 10.
    // Opening the link again should not immediately
    // throw the user into the climax.
    const savedScene =
      clamp(
        Number(data.scene),
        CONFIG.firstScene,
        CONFIG.finalScene - 1
      );

    // Expire extremely old progress.
    const maxAge =
      1000 *
      60 *
      60 *
      24 *
      7;

    const isRecent =
      Number.isFinite(
        Number(data.timestamp)
      ) &&
      Date.now() -
        Number(data.timestamp) <
        maxAge;

    if (!isRecent) {
      STATE.hasVisited = false;
      return;
    }

    STATE.currentScene =
      savedScene;

    STATE.hasVisited = true;

  } catch {
    STATE.hasVisited = false;
  }
}


/* =========================================================
   34. IMAGE FALLBACK / BROKEN ASSETS
   ========================================================= */

function setupGlobalImageFallback() {
  document.addEventListener(
    "error",
    event => {
      const image =
        event.target;

      if (
        !(
          image instanceof
          HTMLImageElement
        )
      ) {
        return;
      }

      image.classList.add(
        "is-broken"
      );

      const wrapper =
        image.closest(
          "[data-image-wrapper], .photo-stage, .photo-card"
        );

      if (wrapper) {
        wrapper.classList.add(
          "has-image-error"
        );
      }
    },
    true
  );
}


/* =========================================================
   35. RESIZE HANDLING
   ========================================================= */

function setupResizeHandling() {
  let timeout = null;

  window.addEventListener(
    "resize",
    () => {
      clearTimeout(timeout);

      timeout = setTimeout(() => {
        updateViewportVariables();
      }, 120);
    },
    {
      passive: true
    }
  );

  updateViewportVariables();
}


function updateViewportVariables() {
  const viewportHeight =
    window.visualViewport?.height ||
    window.innerHeight;

  document.documentElement.style.setProperty(
    "--viewport-height",
    `${viewportHeight}px`
  );
}


/* =========================================================
   36. SAFE AREA / MOBILE VISUAL STATE
   ========================================================= */

function setupMobileState() {
  const update = () => {
    const width =
      window.innerWidth;

    const height =
      window.visualViewport?.height ||
      window.innerHeight;

    document.body.classList.toggle(
      "is-mobile",
      width <= 768
    );

    document.body.classList.toggle(
      "is-small-mobile",
      width <= 390
    );

    document.body.classList.toggle(
      "is-short-viewport",
      height <= 720
    );

    document.body.classList.toggle(
      "is-landscape",
      width > height
    );
  };

  update();

  window.addEventListener(
    "resize",
    update,
    {
      passive: true
    }
  );

  window.visualViewport?.addEventListener(
    "resize",
    update,
    {
      passive: true
    }
  );
}


/* =========================================================
   37. CLICK RIPPLE — VERY SUBTLE
   ========================================================= */

function setupButtonRipple() {
  if (STATE.reducedMotion) {
    return;
  }

  document.addEventListener(
    "pointerdown",
    event => {
      const button =
        event.target.closest(
          "button, [role='button'], .btn"
        );

      if (!button) {
        return;
      }

      const rect =
        button.getBoundingClientRect();

      const ripple =
        document.createElement(
          "span"
        );

      ripple.className =
        "button-ripple";

      ripple.style.left =
        `${event.clientX - rect.left}px`;

      ripple.style.top =
        `${event.clientY - rect.top}px`;

      button.appendChild(
        ripple
      );

      setTimeout(() => {
        ripple.remove();
      }, 650);
    }
  );
}


/* =========================================================
   38. LETTER MUSIC BUTTON STATE
   ========================================================= */

function setupMusicButtonState() {
  const button =
    DOM.enterLetterButton ||
    document.querySelector(
      "#enterLetterButton"
    );

  if (!button) {
    return;
  }

  button.addEventListener(
    "click",
    async event => {
      // This click is the canonical gesture
      // for beginning music 1.

      const started =
        await startMusic1();

      if (started) {
        button.classList.add(
          "music-started"
        );

        button.classList.remove(
          "music-awaiting"
        );

        document.body.classList.add(
          "letter-is-playing"
        );
      } else {
        button.classList.add(
          "music-awaiting"
        );
      }
    }
  );
}


/* =========================================================
   39. FIRST USER INTERACTION
   ========================================================= */

function setupFirstInteraction() {
  const markInteracted = () => {
    if (STATE.firstInteraction) {
      return;
    }

    STATE.firstInteraction = true;

    document.body.classList.add(
      "user-has-interacted"
    );
  };

  document.addEventListener(
    "pointerdown",
    markInteracted,
    {
      once: true,
      passive: true
    }
  );

  document.addEventListener(
    "keydown",
    markInteracted,
    {
      once: true
    }
  );
}


/* =========================================================
   40. FINAL TEXT PERSONALITY HOOKS
   ========================================================= */

function setupPersonalityHooks() {
  // These hooks do not rewrite the user's text.
  // They only allow CSS to react to certain personal
  // parts of the experience.

  const allText =
    document.querySelectorAll(
      "[data-personal-line]"
    );

  allText.forEach(element => {
    element.classList.add(
      "personal-line-ready"
    );
  });
}


/* =========================================================
   41. SCENE-SPECIFIC TYPING TRIGGERS
   ========================================================= */

function setupSceneTypingTriggers() {
  document.addEventListener(
    "click",
    event => {
      const trigger =
        event.target.closest(
          "[data-trigger-typing]"
        );

      if (!trigger) {
        return;
      }

      const targetSelector =
        trigger.dataset.triggerTyping;

      if (!targetSelector) {
        return;
      }

      const target =
        document.querySelector(
          targetSelector
        );

      if (!target) {
        return;
      }

      typeElement(
        target,
        {
          speed:
            Number(
              trigger.dataset.typingSpeed
            ) ||
            CONFIG.defaultTypingSpeed,

          delay:
            Number(
              trigger.dataset.typingDelay
            ) ||
            0,

          force:
            trigger.dataset.typingForce ===
            "true"
        }
      );
    }
  );
}


/* =========================================================
   42. ACCESSIBILITY
   ========================================================= */

function setupAccessibility() {
  // Make scene navigation explicit to assistive technology.
  DOM.scenes.forEach(scene => {
    if (!scene.hasAttribute("role")) {
      scene.setAttribute(
        "role",
        "region"
      );
    }

    if (!scene.hasAttribute("aria-label")) {
      const number =
        getSceneNumber(scene);

      scene.setAttribute(
        "aria-label",
        `Scene ${getSceneLabel(number)}`
      );
    }
  });

  // Buttons with no accessible label.
  document
    .querySelectorAll(
      "button"
    )
    .forEach(button => {
      if (
        !button.getAttribute(
          "aria-label"
        ) &&
        !button.textContent.trim()
      ) {
        const title =
          button.dataset.label ||
          button.title;

        if (title) {
          button.setAttribute(
            "aria-label",
            title
          );
        }
      }
    });
}


/* =========================================================
   43. REDUCED MOTION WATCHER
   ========================================================= */

function setupReducedMotionWatcher() {
  const media =
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

  const update = () => {
    STATE.reducedMotion =
      media.matches;

    document.body.classList.toggle(
      "reduced-motion",
      media.matches
    );
  };

  update();

  if (
    typeof media.addEventListener ===
    "function"
  ) {
    media.addEventListener(
      "change",
      update
    );
  } else if (
    typeof media.addListener ===
    "function"
  ) {
    media.addListener(
      update
    );
  }
}


/* =========================================================
   44. PREVENT DOUBLE TAP ZOOM ON INTERACTIVE CONTROLS
   =========================================================

   We do NOT disable zoom globally.

   Users should still be able to pinch zoom text.

   Only interaction elements get a small guard against
   accidental double-tap activation.
   ========================================================= */

function setupInteractionSafety() {
  let lastTap = 0;

  document.addEventListener(
    "touchend",
    event => {
      const target =
        event.target.closest(
          "button, a, [role='button']"
        );

      if (!target) {
        return;
      }

      const now =
        Date.now();

      if (
        now - lastTap < 280
      ) {
        event.preventDefault();
      }

      lastTap = now;
    },
    {
      passive: false
    }
  );
}


/* =========================================================
   45. VISUAL SCENE HOOKS
   ========================================================= */

function addSceneBodyClasses() {
  const observer =
    new MutationObserver(
      () => {
        const active =
          getCurrentScene();

        if (!active) return;

        const number =
          getSceneNumber(active);

        for (
          let i = 1;
          i <= CONFIG.finalScene;
          i++
        ) {
          document.body.classList.remove(
            `scene-${String(i).padStart(2, "0")}-active`
          );
        }

        document.body.classList.add(
          `scene-${String(number).padStart(2, "0")}-active`
        );

        document.body.classList.toggle(
          "before-final",
          number >= 8 &&
          number < CONFIG.finalScene
        );

        document.body.classList.toggle(
          "final-mode",
          number === CONFIG.finalScene
        );
      }
    );

  DOM.scenes.forEach(scene => {
    observer.observe(
      scene,
      {
        attributes: true,
        attributeFilter: [
          "class"
        ]
      }
    );
  });
}


/* =========================================================
   46. STARTUP SEQUENCE
   ========================================================= */

function bootEnhancements() {
  setupGlobalImageFallback();

  setupResizeHandling();

  setupMobileState();

  setupButtonRipple();

  setupMusicButtonState();

  setupFirstInteraction();

  setupPersonalityHooks();

  setupSceneTypingTriggers();

  setupAccessibility();

  setupReducedMotionWatcher();

  setupInteractionSafety();

  addSceneBodyClasses();
}


/* =========================================================
   47. DOM READY
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      bootEnhancements();
      init();
    },
    {
      once: true
    }
  );
} else {
  bootEnhancements();
  init();
}


/* =========================================================
   48. OPTIONAL PUBLIC API
   =========================================================

   Useful if later you want HTML buttons or another script
   to explicitly control the experience.

   Example:

       window.BoluUbi.goTo(8);

   or:

       window.BoluUbi.playMusic();

   ========================================================= */

window.BoluUbi = {
  goTo: scene => {
    goToScene(scene, {
      reason: "public-api"
    });
  },

  next: () => {
    goToScene(
      STATE.currentScene + 1,
      {
        reason: "public-api-next"
      }
    );
  },

  previous: () => {
    goToScene(
      STATE.currentScene - 1,
      {
        reason: "public-api-previous"
      }
    );
  },

  playMusic: () => {
    return startMusic1();
  },

  playClimaxMusic: () => {
    return transitionToClimaxMusic();
  },

  pauseMusic: () => {
    const music1 = getMusic1();
    const music2 = getMusic2();

    if (music1) {
      music1.pause();
    }

    if (music2) {
      music2.pause();
    }
  },

  restart: () => {
    restartExperience();
  },

  getState: () => ({
    currentScene:
      STATE.currentScene,

    music1Started:
      STATE.music1Started,

    music2Started:
      STATE.music2Started,

    finalUnlocked:
      STATE.finalUnlocked,

    letterEntered:
      STATE.letterEntered
  })
};


/* =========================================================
   END OF BOLU UBI SCRIPT
   ========================================================= */