/* ============================================================
   BOLU UBI 🐣
   Interactive Birthday Experience
   ------------------------------------------------------------
   Vanilla JS
   No framework
   Mobile-first
   Touch-friendly
   Scroll NEVER changes scene
   ============================================================ */

(() => {
  "use strict";

  /* ==========================================================
     01. CONFIGURATION
     ========================================================== */

  const CONFIG = {
    sceneSelector: ".scene",

    scenes: [
      "scene-01",
      "scene-02",
      "scene-03",
      "scene-04",
      "scene-05",
      "scene-06",
      "scene-07",
      "scene-08",
      "scene-09",
      "scene-10"
    ],

    music: {
      primary: {
        id: "music1",
        fallbackId: "birthdayMusic",
        src: "assets/music1.mp3"
      },

      secondary: {
        id: "music2",
        src: "assets/music2.mp3"
      },

      fadeInDuration: 1800,
      fadeOutDuration: 1600,
      defaultVolume: 0.72
    },

    typing: {
      defaultSpeed: 26,
      fastSpeed: 18,
      slowSpeed: 42,
      pauseAfterPunctuation: 180,
      pauseAfterParagraph: 420
    },

    transitions: {
      duration: 720,
      lockDuration: 760
    },

    confetti: {
      count: 54,
      duration: 4200
    },

    storage: {
      musicConsent: "bolu-ubi-music-consent",
      visited: "bolu-ubi-visited"
    }
  };


  /* ==========================================================
     02. DOM HELPERS
     ========================================================== */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  const byId = (id) =>
    document.getElementById(id);

  const wait = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

  const clamp = (value, min, max) =>
    Math.min(Math.max(value, min), max);

  const prefersReducedMotion = () =>
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;


  /* ==========================================================
     03. GLOBAL STATE
     ========================================================== */

  const state = {
    currentSceneIndex: 0,

    isTransitioning: false,

    hasEntered: false,

    letterStarted: false,

    confessionRevealed: false,

    musicStarted: false,

    musicMuted: false,

    hydroponicsOpen: false,

    timelineIndex: 0,

    typedElements: new WeakMap(),

    typingControllers: new WeakMap(),

    audioTransitioning: false,

    confettiTriggered: false,

    sceneHistory: [],

    touchStartX: 0,
    touchStartY: 0,

    touchEndX: 0,
    touchEndY: 0
  };


  /* ==========================================================
     04. SCENE REGISTRY
     ========================================================== */

  const scenes = CONFIG.scenes
    .map(id => byId(id))
    .filter(Boolean);

  /*
   * Fallback:
   * If the HTML ever gains another .scene, we don't want the
   * entire navigation system to collapse.
   */

  if (!scenes.length) {
    console.warn("[Bolu Ubi] No scenes found.");
    return;
  }


  /* ==========================================================
     05. INITIAL PAGE STATE
     ========================================================== */

  document.documentElement.classList.add("js-ready");

  document.body.classList.add("story-ready");

  try {
    sessionStorage.setItem(
      CONFIG.storage.visited,
      "true"
    );
  } catch (_) {
    /* Storage can fail in private browsing. That's okay. */
  }


  /* ==========================================================
     06. SCENE UTILITIES
     ========================================================== */

  function getSceneIndex(sceneOrId) {
    if (typeof sceneOrId === "number") {
      return clamp(
        sceneOrId,
        0,
        scenes.length - 1
      );
    }

    if (!sceneOrId) {
      return state.currentSceneIndex;
    }

    if (typeof sceneOrId === "string") {

      /*
       * Accept:
       * "scene-07"
       * "7"
       * "#scene-07"
       */

      const normalized = sceneOrId
        .replace("#", "")
        .trim();

      if (/^\d+$/.test(normalized)) {
        const number = parseInt(normalized, 10);

        return clamp(
          number - 1,
          0,
          scenes.length - 1
        );
      }

      const index = scenes.findIndex(
        scene => scene.id === normalized
      );

      if (index !== -1) {
        return index;
      }
    }

    if (sceneOrId instanceof HTMLElement) {
      const index = scenes.indexOf(sceneOrId);

      if (index !== -1) {
        return index;
      }
    }

    return state.currentSceneIndex;
  }


  function getCurrentScene() {
    return scenes[state.currentSceneIndex];
  }


  function updateSceneAccessibility(scene, active) {
    if (!scene) return;

    scene.setAttribute(
      "aria-hidden",
      active ? "false" : "true"
    );

    if (active) {
      scene.removeAttribute("inert");
    } else {
      /*
       * `inert` is useful but can interfere with some custom
       * animations. We only use it when supported.
       */
      if ("inert" in scene) {
        scene.inert = true;
      }
    }
  }


  function resetSceneScroll(scene) {
    if (!scene) return;

    /*
     * Critical:
     *
     * Scene navigation does NOT depend on scroll position.
     *
     * Every scene gets its own internal scroll container.
     */

    scene.scrollTop = 0;

    const scrollContainers = $$(
      ".scene-scroll, .scene__scroll, .scene-inner, .scene-content",
      scene
    );

    scrollContainers.forEach(container => {
      if (
        container.scrollHeight >
        container.clientHeight
      ) {
        container.scrollTop = 0;
      }
    });
  }


  function updateProgress() {
    const current = state.currentSceneIndex + 1;
    const total = scenes.length;

    const progressCurrent =
      $("#sceneCurrent");

    const progressTotal =
      $("#sceneTotal");

    const progressBar =
      $("#sceneProgress");

    if (progressCurrent) {
      progressCurrent.textContent =
        String(current).padStart(2, "0");
    }

    if (progressTotal) {
      progressTotal.textContent =
        String(total).padStart(2, "0");
    }

    if (progressBar) {

      /*
       * Supports either:
       * width-based progress
       * transform-based progress
       */

      const percentage =
        ((current - 1) / Math.max(total - 1, 1)) * 100;

      progressBar.style.setProperty(
        "--progress",
        `${percentage}%`
      );

      progressBar.style.setProperty(
        "--scene-progress",
        `${percentage}%`
      );
    }

    $$(".progress-dot").forEach(
      (dot, index) => {

        dot.classList.toggle(
          "is-active",
          index === state.currentSceneIndex
        );

        dot.classList.toggle(
          "is-past",
          index < state.currentSceneIndex
        );

        dot.setAttribute(
          "aria-current",
          index === state.currentSceneIndex
            ? "step"
            : "false"
        );
      }
    );
  }


  /* ==========================================================
     07. SCENE TRANSITION ENGINE
     ========================================================== */

  async function goToScene(
    target,
    options = {}
  ) {

    const {
      force = false,
      instant = false,
      direction = null,
      trigger = null
    } = options;

    const targetIndex =
      getSceneIndex(target);

    if (
      targetIndex === state.currentSceneIndex &&
      !force
    ) {
      return;
    }

    if (state.isTransitioning && !force) {
      return;
    }

    const currentScene =
      getCurrentScene();

    const nextScene =
      scenes[targetIndex];

    if (!nextScene) return;

    state.isTransitioning = true;

    /*
     * Direction is only visual.
     * It NEVER determines navigation.
     */

    const movement =
      direction ||
      (
        targetIndex >
        state.currentSceneIndex
          ? "forward"
          : "backward"
      );

    document.body.dataset.sceneDirection =
      movement;

    if (trigger) {
      trigger.classList.add("is-used");

      window.setTimeout(() => {
        trigger.classList.remove("is-used");
      }, 500);
    }

    /*
     * Remember where we came from.
     */

    state.sceneHistory.push(
      state.currentSceneIndex
    );

    if (state.sceneHistory.length > 20) {
      state.sceneHistory.shift();
    }

    /*
     * PREPARE NEXT SCENE
     */

    nextScene.classList.add("scene-preparing");

    nextScene.style.setProperty(
      "--scene-direction",
      movement === "forward"
        ? "1"
        : "-1"
    );

    /*
     * Reset next scene before revealing.
     */

    resetSceneScroll(nextScene);

    /*
     * Leaving state.
     */

    if (currentScene) {
      currentScene.classList.add("scene-leaving");
      currentScene.classList.remove(
        "scene-entering"
      );
    }

    await wait(
      instant || prefersReducedMotion()
        ? 0
        : 70
    );

    /*
     * Update active state.
     */

    if (currentScene) {
      currentScene.classList.remove(
        "is-active",
        "active",
        "current"
      );

      updateSceneAccessibility(
        currentScene,
        false
      );
    }

    state.currentSceneIndex =
      targetIndex;

    nextScene.classList.remove(
      "scene-preparing",
      "scene-leaving"
    );

    nextScene.classList.add(
      "is-active",
      "active",
      "current",
      "scene-entering"
    );

    updateSceneAccessibility(
      nextScene,
      true
    );

    updateProgress();

    /*
     * Scene-specific initialization.
     */

    handleSceneEntered(
      nextScene,
      targetIndex
    );

    /*
     * Give the browser one paint before
     * removing transition class.
     */

    requestAnimationFrame(() => {

      requestAnimationFrame(() => {

        nextScene.classList.remove(
          "scene-entering"
        );

      });

    });

    await wait(
      instant || prefersReducedMotion()
        ? 0
        : CONFIG.transitions.lockDuration
    );

    if (currentScene) {
      currentScene.classList.remove(
        "scene-leaving"
      );
    }

    state.isTransitioning = false;
  }


  /* ==========================================================
     08. FIRST SCENE ACTIVATION
     ========================================================== */

  function initializeScenes() {

    scenes.forEach(
      (scene, index) => {

        const active =
          index === state.currentSceneIndex;

        scene.classList.toggle(
          "is-active",
          active
        );

        scene.classList.toggle(
          "active",
          active
        );

        scene.classList.toggle(
          "current",
          active
        );

        updateSceneAccessibility(
          scene,
          active
        );

        if (active) {
          resetSceneScroll(scene);
        }
      }
    );

    updateProgress();
  }


  /* ==========================================================
     09. BUTTON NAVIGATION
     ========================================================== */

  function parseNavigationTarget(button) {

    if (!button) {
      return null;
    }

    /*
     * Primary navigation contract:
     *
     * data-next-scene="7"
     * data-next-scene="scene-07"
     */

    const next =
      button.dataset.nextScene;

    if (next !== undefined) {
      return next;
    }

    const go =
      button.dataset.go;

    if (go !== undefined) {
      return go;
    }

    const target =
      button.dataset.sceneTarget;

    if (target !== undefined) {
      return target;
    }

    return null;
  }


  function setupNavigation() {

    const buttons =
      $$(
        "[data-next-scene], [data-go], [data-scene-target]"
      );

    buttons.forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.preventDefault();

          const target =
            parseNavigationTarget(button);

          if (
            target === null ||
            target === ""
          ) {
            return;
          }

          /*
           * Special music gate.
           *
           * This is intentionally initiated by
           * user interaction, satisfying browser
           * autoplay restrictions.
           */

          if (
            button.hasAttribute(
              "data-start-music"
            ) ||
            button.hasAttribute(
              "data-music-gate"
            )
          ) {

            startEmotionalMusic({
              transition: true
            });
          }

          goToScene(
            target,
            {
              trigger: button
            }
          );
        }
      );

    });


    /*
     * Generic NEXT buttons.
     *
     * These are intentionally limited to explicit classes.
     * We do NOT attach navigation to every button.
     */

    const nextButtons =
      $$(".next-btn, .next-button, .scene-next, .continue-btn");

    nextButtons.forEach(button => {

      /*
       * Don't double-bind if it already has data-next-scene.
       */

      if (
        button.matches(
          "[data-next-scene], [data-go], [data-scene-target]"
        )
      ) {
        return;
      }

      button.addEventListener(
        "click",
        event => {

          event.preventDefault();

          goToScene(
            state.currentSceneIndex + 1,
            {
              trigger: button
            }
          );
        }
      );
    });


    /*
     * BACK buttons.
     */

    const backButtons =
      $$(
        "[data-prev-scene], .prev-btn, .back-btn, .scene-prev"
      );

    backButtons.forEach(button => {

      if (
        button.matches(
          "[data-next-scene]"
        )
      ) {
        return;
      }

      button.addEventListener(
        "click",
        event => {

          event.preventDefault();

          const previous =
            button.dataset.prevScene;

          if (
            previous !== undefined
          ) {
            goToScene(
              previous,
              {
                trigger: button,
                direction: "backward"
              }
            );
            return;
          }

          goToScene(
            state.currentSceneIndex - 1,
            {
              trigger: button,
              direction: "backward"
            }
          );
        }
      );
    });

  }


  /* ==========================================================
     10. HARD RULE:
         SCROLL NEVER NAVIGATES SCENES
     ========================================================== */

  function setupScrollSafety() {

    /*
     * We intentionally DO NOT listen to:
     *
     * wheel
     * scroll
     * touchmove
     * intersection observer
     *
     * for scene navigation.
     *
     * This prevents the previous mobile bug where a user
     * simply trying to read the current scene accidentally
     * advanced to the next one.
     */

    scenes.forEach(scene => {

      scene.addEventListener(
        "scroll",
        () => {

          /*
           * Reading progress inside the scene can still
           * be detected if useful, but scene navigation
           * is never triggered.
           */

          scene.classList.add(
            "has-been-scrolled"
          );

        },
        {
          passive: true
        }
      );

    });

  }


  /* ==========================================================
     11. TOUCH SAFETY
     ========================================================== */

  function setupTouchHandling() {

    document.addEventListener(
      "touchstart",
      event => {

        if (!event.touches.length) {
          return;
        }

        const touch =
          event.touches[0];

        state.touchStartX =
          touch.clientX;

        state.touchStartY =
          touch.clientY;

      },
      {
        passive: true
      }
    );


    document.addEventListener(
      "touchend",
      event => {

        if (!event.changedTouches.length) {
          return;
        }

        const touch =
          event.changedTouches[0];

        state.touchEndX =
          touch.clientX;

        state.touchEndY =
          touch.clientY;

        /*
         * IMPORTANT:
         *
         * Swipe does NOT navigate scenes.
         *
         * The swipe data is deliberately ignored.
         *
         * This makes the experience predictable:
         * tap = action
         * scroll = read
         */

      },
      {
        passive: true
      }
    );

  }


  /* ==========================================================
     12. HYDROPONICS DETAIL
     ========================================================== */

  function setupHydroponics() {

    const toggles =
      $$(
        '[data-toggle-detail="hydroponics-detail"]'
      );

    const detail =
      $("#hydroponics-detail");

    if (!toggles.length || !detail) {
      return;
    }

    /*
     * Start closed.
     */

    state.hydroponicsOpen = false;

    detail.hidden = true;

    toggles.forEach(toggle => {

      toggle.setAttribute(
        "aria-expanded",
        "false"
      );

      toggle.setAttribute(
        "aria-controls",
        "hydroponics-detail"
      );

      toggle.addEventListener(
        "click",
        event => {

          event.preventDefault();

          toggleHydroponics(
            toggle,
            detail
          );

        }
      );

    });

  }


  function toggleHydroponics(
    toggle,
    detail
  ) {

    state.hydroponicsOpen =
      !state.hydroponicsOpen;

    toggle.setAttribute(
      "aria-expanded",
      String(
        state.hydroponicsOpen
      )
    );

    detail.setAttribute(
      "aria-hidden",
      String(
        !state.hydroponicsOpen
      )
    );

    if (
      prefersReducedMotion()
    ) {

      detail.hidden =
        !state.hydroponicsOpen;

      detail.classList.toggle(
        "is-open",
        state.hydroponicsOpen
      );

      return;
    }

    if (state.hydroponicsOpen) {

      detail.hidden = false;

      requestAnimationFrame(() => {

        detail.classList.add(
          "is-opening"
        );

        requestAnimationFrame(() => {

          detail.classList.add(
            "is-open"
          );

          detail.classList.remove(
            "is-opening"
          );

        });

      });

    } else {

      detail.classList.remove(
        "is-open"
      );

      window.setTimeout(
        () => {

          if (
            !state.hydroponicsOpen
          ) {
            detail.hidden = true;
          }

        },
        420
      );

    }

  }


  /* ==========================================================
     13. MEMORY TIMELINE
     ========================================================== */

  function setupMemoryTimeline() {

    const timeline =
      $("#memoryTimeline");

    if (!timeline) {
      return;
    }

    const memories =
      $$(
        "[data-memory]",
        timeline
      );

    if (!memories.length) {
      return;
    }

    memories.forEach(
      (memory, index) => {

        memory.setAttribute(
          "tabindex",
          "0"
        );

        memory.setAttribute(
          "role",
          "button"
        );

        memory.addEventListener(
          "click",
          event => {

            event.preventDefault();

            activateMemory(
              memories,
              index
            );

          }
        );

        memory.addEventListener(
          "keydown",
          event => {

            if (
              event.key === "Enter" ||
              event.key === " "
            ) {

              event.preventDefault();

              activateMemory(
                memories,
                index
              );
            }

          }
        );

      }
    );

    activateMemory(
      memories,
      0,
      true
    );

  }


  function activateMemory(
    memories,
    index,
    instant = false
  ) {

    state.timelineIndex =
      index;

    memories.forEach(
      (memory, memoryIndex) => {

        const active =
          memoryIndex === index;

        memory.classList.toggle(
          "is-active",
          active
        );

        memory.setAttribute(
          "aria-selected",
          String(active)
        );

        /*
         * Optional linked detail.
         */

        const targetId =
          memory.dataset.memory;

        if (!targetId) {
          return;
        }

        const target =
          byId(targetId);

        if (!target) {
          return;
        }

        target.classList.toggle(
          "is-active",
          active
        );

        target.hidden =
          !active;

      }
    );

    if (!instant) {
      requestAnimationFrame(() => {
        const activeMemory =
          memories[index];

        if (activeMemory) {
          activeMemory.scrollIntoView({
            behavior:
              prefersReducedMotion()
                ? "auto"
                : "smooth",
            block: "nearest",
            inline: "nearest"
          });
        }
      });
    }

  }


  /* ==========================================================
     14. PHOTO REVEAL
     ========================================================== */

  function setupPhotoStage() {

    const stage =
      $("#photoStage");

    const photo =
      $("#boluUbiPhoto");

    if (!stage || !photo) {
      return;
    }

    /*
     * Do not crop the photo.
     */

    photo.style.objectFit =
      "contain";

    photo.style.maxWidth =
      "100%";

    photo.style.height =
      "auto";


    /*
     * Wait until the browser knows the actual
     * image dimensions.
     */

    if (photo.complete) {

      requestAnimationFrame(
        () => revealPhoto(stage)
      );

    } else {

      photo.addEventListener(
        "load",
        () => revealPhoto(stage),
        {
          once: true
        }
      );

    }

  }


  function revealPhoto(stage) {

    stage.classList.add(
      "photo-ready"
    );

    /*
     * Trigger the reveal after a tiny delay
     * so the transition feels intentional.
     */

    window.setTimeout(
      () => {

        stage.classList.add(
          "photo-revealed"
        );

      },
      prefersReducedMotion()
        ? 0
        : 180
    );

  }


  /* ==========================================================
     15. TYPEWRITER ENGINE
     ========================================================== */

  function getTypingText(element) {

    /*
     * Priority:
     *
     * data-text
     * data-typing
     * textContent
     */

    if (
      element.dataset.text
    ) {
      return element.dataset.text;
    }

    if (
      element.dataset.typing
    ) {
      return element.dataset.typing;
    }

    return element.textContent.trim();

  }


  function calculateTypingDelay(
    character,
    previousCharacter,
    speed
  ) {

    let delay = speed;

    if (
      character === "." ||
      character === "!" ||
      character === "?"
    ) {

      delay +=
        CONFIG.typing.pauseAfterPunctuation;

    }

    if (
      character === "," ||
      character === ";"
    ) {

      delay += 70;

    }

    if (
      character === "\n"
    ) {

      delay +=
        CONFIG.typing.pauseAfterParagraph;

    }

    /*
     * Longer pause around ellipsis.
     */

    if (
      previousCharacter === "." &&
      character === "."
    ) {

      delay += 100;

    }

    return delay;

  }


  async function typeInto(
    element,
    options = {}
  ) {

    if (!element) {
      return;
    }

    const {
      speed =
        Number(
          element.dataset.typingSpeed
        ) ||
        CONFIG.typing.defaultSpeed,

      force = false,

      clear = true
    } = options;


    /*
     * Prevent duplicate typing.
     */

    if (
      state.typedElements.has(element) &&
      !force
    ) {
      return;
    }


    /*
     * Cancel previous controller.
     */

    const oldController =
      state.typingControllers.get(
        element
      );

    if (oldController) {
      oldController.abort();
    }


    const controller =
      new AbortController();

    state.typingControllers.set(
      element,
      controller
    );


    const fullText =
      getTypingText(element);


    /*
     * Store original text once.
     */

    if (
      !element.dataset.originalText
    ) {

      element.dataset.originalText =
        fullText;

    }


    if (clear) {
      element.textContent = "";
    }


    element.classList.add(
      "is-typing"
    );

    element.setAttribute(
      "aria-busy",
      "true"
    );


    /*
     * Reduced motion:
     * show text immediately.
     */

    if (
      prefersReducedMotion()
    ) {

      element.textContent =
        fullText;

      element.classList.remove(
        "is-typing"
      );

      element.classList.add(
        "is-typed"
      );

      element.removeAttribute(
        "aria-busy"
      );

      state.typedElements.set(
        element,
        true
      );

      return;
    }


    let output = "";

    for (
      let index = 0;
      index < fullText.length;
      index++
    ) {

      if (
        controller.signal.aborted
      ) {
        return;
      }

      const character =
        fullText[index];

      const previousCharacter =
        fullText[index - 1] || "";


      output += character;

      element.textContent =
        output;


      const delay =
        calculateTypingDelay(
          character,
          previousCharacter,
          speed
        );

      await wait(delay);

    }


    element.classList.remove(
      "is-typing"
    );

    element.classList.add(
      "is-typed"
    );

    element.removeAttribute(
      "aria-busy"
    );

    state.typedElements.set(
      element,
      true
    );

  }


  /* ==========================================================
     16. LETTER TYPING
     ========================================================== */

  function setupLetter() {

    const letter =
      $(".birthday-letter");

    if (!letter) {
      return;
    }

    /*
     * The actual typing is intentionally
     * delayed until Scene 07/08.
     */

    const parts =
      $$(
        "[data-letter-part], [data-typing]",
        letter
      );

    parts.forEach(part => {

      if (
        !part.dataset.originalText
      ) {

        part.dataset.originalText =
          part.textContent.trim();

      }

      /*
       * Don't automatically type every part
       * immediately. Scene pacing controls it.
       */

    });

  }


  async function startLetterSequence() {

    if (state.letterStarted) {
      return;
    }

    state.letterStarted = true;


    const letter =
      $(".birthday-letter");

    if (!letter) {
      return;
    }


    const parts =
      $$(
        "[data-letter-part], [data-typing]",
        letter
      );

    if (!parts.length) {
      return;
    }


    /*
     * Only type visible / meaningful parts.
     */

    for (
      const part of parts
    ) {

      if (
        !part.isConnected
      ) {
        continue;
      }

      await typeInto(
        part,
        {
          speed:
            Number(
              part.dataset.typingSpeed
            ) ||
            CONFIG.typing.defaultSpeed
        }
      );

      /*
       * A tiny breath between paragraphs.
       */

      await wait(
        prefersReducedMotion()
          ? 0
          : 240
      );

    }

  }


  /* ==========================================================
     17. MUSIC ENGINE
     ========================================================== */

  function getAudioElements() {

    const primary =
      byId(
        CONFIG.music.primary.id
      ) ||
      byId(
        CONFIG.music.primary.fallbackId
      );

    const secondary =
      byId(
        CONFIG.music.secondary.id
      );

    return {
      primary,
      secondary
    };

  }


  function configureAudio(audio) {

    if (!audio) {
      return;
    }

    audio.preload = "auto";

    audio.volume =
      CONFIG.music.defaultVolume;

    audio.setAttribute(
      "playsinline",
      ""
    );

    /*
     * We intentionally do not set autoplay.
     */

    audio.autoplay = false;

  }


  function setupAudio() {

    const {
      primary,
      secondary
    } = getAudioElements();

    configureAudio(primary);
    configureAudio(secondary);

    if (primary) {

      primary.addEventListener(
        "play",
        () => {

          state.musicStarted = true;

          updateMusicUI(
            true
          );

        }
      );

      primary.addEventListener(
        "pause",
        () => {

          if (
            !secondary ||
            secondary.paused
          ) {

            updateMusicUI(
              false
            );

          }

        }
      );

    }


    if (secondary) {

      secondary.addEventListener(
        "play",
        () => {

          state.musicStarted = true;

          updateMusicUI(
            true
          );

        }
      );

      secondary.addEventListener(
        "pause",
        () => {

          if (
            !primary ||
            primary.paused
          ) {

            updateMusicUI(
              false
            );

          }

        }
      );

    }

  }


  async function fadeAudio(
    audio,
    targetVolume,
    duration
  ) {

    if (!audio) {
      return;
    }

    if (
      prefersReducedMotion()
    ) {

      audio.volume =
        clamp(
          targetVolume,
          0,
          1
        );

      return;
    }


    const start =
      audio.volume;

    const target =
      clamp(
        targetVolume,
        0,
        1
      );

    const difference =
      target - start;

    const startTime =
      performance.now();


    return new Promise(resolve => {

      function frame(now) {

        const progress =
          clamp(
            (now - startTime) /
            duration,
            0,
            1
          );

        /*
         * Smoothstep.
         */

        const eased =
          progress *
          progress *
          (3 - 2 * progress);

        audio.volume =
          start +
          difference * eased;

        if (
          progress < 1
        ) {

          requestAnimationFrame(
            frame
          );

        } else {

          audio.volume =
            target;

          resolve();

        }

      }

      requestAnimationFrame(
        frame
      );

    });

  }


  async function playAudio(
    audio,
    volume = CONFIG.music.defaultVolume
  ) {

    if (!audio) {
      return false;
    }

    try {

      audio.volume = 0;

      const playPromise =
        audio.play();

      if (
        playPromise &&
        typeof playPromise.then ===
          "function"
      ) {

        await playPromise;

      }

      await fadeAudio(
        audio,
        volume,
        CONFIG.music.fadeInDuration
      );

      return true;

    } catch (error) {

      /*
       * Browser autoplay restrictions or
       * missing audio file.
       */

      console.warn(
        "[Bolu Ubi] Audio could not play:",
        error
      );

      return false;

    }

  }


  async function stopAudio(
    audio
  ) {

    if (!audio) {
      return;
    }

    try {

      await fadeAudio(
        audio,
        0,
        CONFIG.music.fadeOutDuration
      );

    } catch (_) {
      /* Ignore fade errors. */
    }

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (_) {
      /* Ignore unsupported operations. */
    }

  }


  async function startEmotionalMusic(
    options = {}
  ) {

    if (state.audioTransitioning) {
      return;
    }

    state.audioTransitioning = true;

    const {
      primary,
      secondary
    } = getAudioElements();


    if (!primary && !secondary) {

      console.warn(
        "[Bolu Ubi] No audio elements found."
      );

      state.audioTransitioning = false;

      return;
    }


    /*
     * If the secondary track already exists and
     * is playing, do nothing.
     */

    if (
      secondary &&
      !secondary.paused
    ) {

      state.audioTransitioning = false;

      return;
    }


    /*
     * Primary music begins first.
     */

    if (
      primary &&
      primary.paused
    ) {

      await playAudio(
        primary,
        CONFIG.music.defaultVolume
      );

    }


    state.musicStarted = true;

    updateMusicUI(
      true
    );

    state.audioTransitioning = false;

  }


  async function transitionToMusic2() {

    if (state.audioTransitioning) {
      return;
    }

    const {
      primary,
      secondary
    } = getAudioElements();

    if (!secondary) {
      return;
    }

    state.audioTransitioning = true;


    /*
     * Fade music 1 out first.
     */

    if (primary && !primary.paused) {

      await fadeAudio(
        primary,
        0,
        CONFIG.music.fadeOutDuration
      );

      try {
        primary.pause();
        primary.currentTime = 0;
      } catch (_) {}

    }


    /*
     * Then music 2 enters.
     */

    const success =
      await playAudio(
        secondary,
        CONFIG.music.defaultVolume
      );


    if (success) {

      state.musicStarted = true;

      updateMusicUI(
        true
      );

    }


    state.audioTransitioning = false;

  }


  function toggleMusic() {

    const {
      primary,
      secondary
    } = getAudioElements();


    const current =
      secondary &&
      !secondary.paused
        ? secondary
        : primary;


    if (!current) {
      return;
    }


    if (
      current.paused
    ) {

      playAudio(
        current,
        CONFIG.music.defaultVolume
      );

    } else {

      fadeAudio(
        current,
        0,
        600
      ).then(() => {

        current.pause();

        updateMusicUI(
          false
        );

      });

    }

  }


  function updateMusicUI(
    playing
  ) {

    document.body.classList.toggle(
      "music-playing",
      playing
    );

    document.body.classList.toggle(
      "music-paused",
      !playing
    );


    $$(".music-status").forEach(
      element => {

        element.textContent =
          playing
            ? "playing..."
            : "paused";

      }
    );


    $$(".music-toggle, .audio-toggle").forEach(
      button => {

        button.classList.toggle(
          "is-playing",
          playing
        );

        button.setAttribute(
          "aria-pressed",
          String(playing)
        );

        const label =
          playing
            ? "Pause music"
            : "Play music";

        button.setAttribute(
          "aria-label",
          label
        );

      }
    );

  }


  function setupMusicControls() {

    $$(".music-toggle, .audio-toggle").forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.preventDefault();

            toggleMusic();

          }
        );

      }
    );

  }


  /* ==========================================================
     18. MUSIC 1 → MUSIC 2 TRIGGER
     ========================================================== */

  function setupMusicGate() {

    const button =
      $("#enterLetterButton");

    if (!button) {
      return;
    }

    /*
     * Music 1 is started when this button is
     * pressed because this is an explicit
     * human interaction.
     */

    if (
      button.hasAttribute(
        "data-music-gate"
      ) ||
      button.dataset.startMusic === "true"
    ) {

      button.addEventListener(
        "click",
        () => {

          startEmotionalMusic({
            transition: true
          });

        },
        {
          once: false
        }
      );

    }

  }


  /*
   * The second music track is deliberately not
   * attached to scrolling.
   *
   * It can be triggered by an explicit button:
   *
   * data-switch-music="2"
   *
   * or:
   * data-music-transition="peak"
   */

  function setupMusicTransitionButtons() {

    $$(
      '[data-switch-music="2"], [data-music-transition="peak"]'
    ).forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.preventDefault();

            transitionToMusic2();

          }
        );

      }
    );

  }


  /* ==========================================================
     19. SCENE-SPECIFIC LOGIC
     ========================================================== */

  function handleSceneEntered(
    scene,
    index
  ) {

    if (!scene) {
      return;
    }

    /*
     * Remove stale scene markers.
     */

    document.body.dataset.scene =
      String(index + 1);

    document.body.dataset.sceneId =
      scene.id || "";


    /*
     * SCENE 01
     *
     * Keep it quiet.
     */

    if (index === 0) {

      scene.classList.add(
        "scene-has-been-seen"
      );

    }


    /*
     * SCENE 03
     *
     * Memory timeline.
     */

    if (
      index === 2
    ) {

      const timeline =
        $("#memoryTimeline");

      if (timeline) {

        timeline.classList.add(
          "timeline-awake"
        );

      }

    }


    /*
     * SCENE 05
     *
     * Personal facts.
     */

    if (
      index === 4
    ) {

      activateFactCards(scene);

    }


    /*
     * SCENE 06
     *
     * Photo.
     */

    if (
      index === 5
    ) {

      const photoStage =
        $("#photoStage");

      if (photoStage) {

        photoStage.classList.add(
          "scene-photo-active"
        );

      }

    }


    /*
     * SCENE 07
     *
     * Letter introduction.
     */

    if (
      index === 6
    ) {

      prepareLetterScene(
        scene
      );

    }


    /*
     * SCENE 08
     *
     * Main letter.
     */

    if (
      index === 7
    ) {

      startLetterSequence();

    }


    /*
     * SCENE 09
     *
     * Quiet emotional beat.
     */

    if (
      index === 8
    ) {

      activateQuietScene(
        scene
      );

    }


    /*
     * SCENE 10
     *
     * Final celebration.
     */

    if (
      index === 9
    ) {

      activateFinalScene(
        scene
      );

    }

  }


  /* ==========================================================
     20. FACT CARDS
     ========================================================== */

  function activateFactCards(
    scene
  ) {

    const cards =
      $$(
        ".fact-card, .fact-card-wide, [data-fact]",
        scene
      );

    if (!cards.length) {
      return;
    }

    /*
     * Cards don't all slam in simultaneously.
     */

    cards.forEach(
      (card, index) => {

        card.style.setProperty(
          "--fact-delay",
          `${Math.min(index * 90, 500)}ms`
        );

        window.setTimeout(
          () => {

            card.classList.add(
              "fact-visible"
            );

          },
          prefersReducedMotion()
            ? 0
            : index * 90
        );

      }
    );

  }


  /* ==========================================================
     21. LETTER SCENE PREPARATION
     ========================================================== */

  function prepareLetterScene(
    scene
  ) {

    scene.classList.add(
      "letter-scene-awake"
    );

    /*
     * Do not immediately dump the entire
     * letter on screen.
     */

    const parts =
      $$(
        "[data-letter-part], [data-typing]",
        scene
      );

    parts.forEach(part => {

      if (
        !part.dataset.originalText
      ) {

        part.dataset.originalText =
          part.textContent.trim();

      }

      /*
       * Keep original text hidden until
       * the typing sequence begins.
       */

      if (
        !part.classList.contains(
          "is-typed"
        )
      ) {

        part.textContent = "";

      }

    });

  }


  /* ==========================================================
     22. QUIET SCENE
     ========================================================== */

  function activateQuietScene(
    scene
  ) {

    scene.classList.add(
      "quiet-scene-awake"
    );

    /*
     * One final music/letter pause.
     *
     * No dramatic automatic jump.
     */

    const message =
      $(".heart-message", scene);

    if (message) {

      message.classList.add(
        "quiet-message-ready"
      );

    }

  }


  /* ==========================================================
     23. FINAL SCENE
     ========================================================== */

  function activateFinalScene(
    scene
  ) {

    scene.classList.add(
      "final-scene-awake"
    );

    /*
     * Only trigger once.
     */

    if (
      state.confettiTriggered
    ) {
      return;
    }

    state.confettiTriggered =
      true;

    /*
     * Small delay.
     *
     * The final scene first gets to breathe.
     */

    window.setTimeout(
      () => {

        createConfetti();

      },
      prefersReducedMotion()
        ? 0
        : 650
    );

  }


  /* ==========================================================
     24. CONFETTI
     ========================================================== */

  function createConfetti() {

    if (
      prefersReducedMotion()
    ) {
      return;
    }

    let layer =
      $("#confettiLayer");

    if (!layer) {

      layer =
        document.createElement(
          "div"
        );

      layer.id =
        "confettiLayer";

      layer.setAttribute(
        "aria-hidden",
        "true"
      );

      document.body.appendChild(
        layer
      );

    }


    layer.classList.add(
      "is-active"
    );


    /*
     * Clean previous particles.
     */

    layer.innerHTML = "";


    const fragment =
      document.createDocumentFragment();


    const shapes = [
      "square",
      "strip",
      "dot"
    ];


    for (
      let i = 0;
      i < CONFIG.confetti.count;
      i++
    ) {

      const piece =
        document.createElement(
          "span"
        );

      const shape =
        shapes[
          Math.floor(
            Math.random() *
            shapes.length
          )
        ];


      piece.className =
        `confetti-piece confetti-${shape}`;


      /*
       * CSS controls colors.
       * JS only controls geometry.
       */

      const x =
        Math.random() * 100;

      const delay =
        Math.random() * 0.65;

      const duration =
        2.4 +
        Math.random() * 1.8;

      const rotation =
        Math.random() * 720 -
        360;

      const drift =
        Math.random() * 180 -
        90;


      piece.style.setProperty(
        "--confetti-x",
        `${x}%`
      );

      piece.style.setProperty(
        "--confetti-delay",
        `${delay}s`
      );

      piece.style.setProperty(
        "--confetti-duration",
        `${duration}s`
      );

      piece.style.setProperty(
        "--confetti-rotation",
        `${rotation}deg`
      );

      piece.style.setProperty(
        "--confetti-drift",
        `${drift}px`
      );


      fragment.appendChild(
        piece
      );

    }


    layer.appendChild(
      fragment
    );


    window.setTimeout(
      () => {

        layer.classList.remove(
          "is-active"
        );

      },
      CONFIG.confetti.duration
    );

  }


  /* ==========================================================
     25. ACCESSIBILITY
     ========================================================== */

  function setupAccessibility() {

    /*
     * Buttons should never submit forms by accident.
     */

    $$("button").forEach(
      button => {

        if (
          !button.type
        ) {

          button.type =
            "button";

        }

      }
    );


    /*
     * External links should remain normal.
     */

    $$("a").forEach(
      link => {

        link.addEventListener(
          "click",
          () => {

            link.classList.add(
              "is-followed"
            );

          }
        );

      }
    );


    /*
     * Escape:
     * close hydroponics if open.
     */

    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key !== "Escape"
        ) {
          return;
        }

        const detail =
          $("#hydroponics-detail");

        const toggle =
          $(
            '[data-toggle-detail="hydroponics-detail"]'
          );

        if (
          detail &&
          !detail.hidden &&
          toggle
        ) {

          toggleHydroponics(
            toggle,
            detail
          );

        }

      }
    );

  }


  /* ==========================================================
     26. KEYBOARD NAVIGATION
     ========================================================== */

  function setupKeyboardNavigation() {

    document.addEventListener(
      "keydown",
      event => {

        /*
         * Never hijack keyboard navigation while
         * the user is typing into an input.
         */

        const target =
          event.target;

        if (
          target &&
          (
            target.matches(
              "input, textarea, select"
            ) ||
            target.isContentEditable
          )
        ) {
          return;
        }


        if (
          event.key === "ArrowRight"
        ) {

          event.preventDefault();

          goToScene(
            state.currentSceneIndex + 1,
            {
              direction: "forward"
            }
          );

        }


        if (
          event.key === "ArrowLeft"
        ) {

          event.preventDefault();

          goToScene(
            state.currentSceneIndex - 1,
            {
              direction: "backward"
            }
          );

        }

      }
    );

  }


  /* ==========================================================
     27. VISIBILITY / TAB SAFETY
     ========================================================== */

  function setupVisibilityHandling() {

    document.addEventListener(
      "visibilitychange",
      () => {

        const {
          primary,
          secondary
        } = getAudioElements();

        if (
          document.hidden
        ) {

          /*
           * Do not destroy the music state.
           * Browsers may pause audio automatically.
           */

          return;
        }

        /*
         * Do not autoplay upon returning to tab.
         */

        if (
          primary &&
          !primary.paused
        ) {
          updateMusicUI(true);
        }

        if (
          secondary &&
          !secondary.paused
        ) {
          updateMusicUI(true);
        }

      }
    );

  }


  /* ==========================================================
     28. RESIZE / ORIENTATION
     ========================================================== */

  function updateViewportUnit() {

    /*
     * Useful for older mobile browsers.
     */

    const height =
      window.innerHeight;

    document.documentElement.style.setProperty(
      "--app-height",
      `${height}px`
    );

  }


  function setupViewportHandling() {

    updateViewportUnit();

    let resizeTimer = null;

    window.addEventListener(
      "resize",
      () => {

        clearTimeout(
          resizeTimer
        );

        resizeTimer =
          setTimeout(
            () => {

              updateViewportUnit();

            },
            120
          );

      },
      {
        passive: true
      }
    );


    window.addEventListener(
      "orientationchange",
      () => {

        setTimeout(
          updateViewportUnit,
          220
        );

      },
      {
        passive: true
      }
    );

  }


  /* ==========================================================
     29. IMAGE ERROR HANDLING
     ========================================================== */

  function setupImageSafety() {

    $$("img").forEach(
      image => {

        image.addEventListener(
          "error",
          () => {

            image.classList.add(
              "asset-error"
            );

            console.warn(
              "[Bolu Ubi] Image failed:",
              image.src
            );

          },
          {
            once: true
          }
        );

      }
    );

  }


  /* ==========================================================
     30. AUDIO ERROR HANDLING
     ========================================================== */

  function setupAudioSafety() {

    const {
      primary,
      secondary
    } = getAudioElements();

    [primary, secondary]
      .filter(Boolean)
      .forEach(audio => {

        audio.addEventListener(
          "error",
          () => {

            document.body.classList.add(
              "audio-error"
            );

            console.warn(
              "[Bolu Ubi] Audio asset could not be loaded:",
              audio.currentSrc ||
              audio.src
            );

          }
        );

      });

  }


  /* ==========================================================
     31. SMART MUSIC SWITCH
     ========================================================== */

  function setupPrimaryTrackEnd() {

    const {
      primary,
      secondary
    } = getAudioElements();

    if (!primary) {
      return;
    }

    /*
     * If music 1 ends naturally, switch to
     * music 2 only if music 2 exists.
     *
     * This is not scrolling.
     * It is an audio lifecycle event.
     */

    primary.addEventListener(
      "ended",
      () => {

        if (
          secondary
        ) {

          transitionToMusic2();

        }

      }
    );

  }


  /* ==========================================================
     32. SPECIAL PEAK HOOKS
     ========================================================== */

  function setupPeakHooks() {

    /*
     * We support several possible semantic
     * controls from the HTML.
     */

    $$(
      "[data-peak], [data-confession], .confession-button"
    ).forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            state.confessionRevealed =
              true;

            document.body.classList.add(
              "confession-revealed"
            );

          }
        );

      }
    );

  }


  /* ==========================================================
     33. LETTER / CONFESSION MICRO-INTERACTIONS
     ========================================================== */

  function setupLetterMicroInteractions() {

    const letter =
      $(".birthday-letter");

    if (!letter) {
      return;
    }


    /*
     * Clicking a letter part can gently focus it.
     * This is deliberately subtle.
     */

    $$(
      "[data-letter-part]",
      letter
    ).forEach(
      part => {

        part.addEventListener(
          "click",
          () => {

            part.classList.add(
              "is-focused"
            );

            window.setTimeout(
              () => {

                part.classList.remove(
                  "is-focused"
                );

              },
              900
            );

          }
        );

      }
    );

  }


  /* ==========================================================
     34. PREVENT DOUBLE TAP ZOOM ON BUTTONS
     ========================================================== */

  function setupTouchTargets() {

    $$(
      "button, [role='button'], [data-next-scene]"
    ).forEach(
      element => {

        element.style.touchAction =
          "manipulation";

      }
    );

  }


  /* ==========================================================
     35. SCENE ENTER OBSERVER
     ----------------------------------------------------------
     This observer ONLY adds visual state.

     It NEVER changes scenes.
     ----------------------------------------------------------
     ========================================================== */

  function setupRevealObserver() {

    /*
     * This is intentionally scoped to elements
     * INSIDE the current scene.
     */

    if (
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const observer =
      new IntersectionObserver(
        entries => {

          entries.forEach(
            entry => {

              if (
                entry.isIntersecting
              ) {

                entry.target.classList.add(
                  "in-view"
                );

              }

            }
          );

        },
        {
          threshold: 0.14,
          rootMargin: "0px 0px -8% 0px"
        }
      );


    $$(".reveal-on-scroll, .reveal, [data-reveal]")
      .forEach(
        element => {

          observer.observe(
            element
          );

        }
      );

  }


  /* ==========================================================
     36. PERSONAL DETAIL MICRO-ANIMATION
     ========================================================== */

  function setupPersonalDetails() {

    const details =
      $$(
        "[data-personal-detail]"
      );

    details.forEach(
      (detail, index) => {

        detail.style.setProperty(
          "--detail-delay",
          `${index * 100}ms`
        );

      }
    );

  }


  /* ==========================================================
     37. FINAL SCENE RESTART
     ========================================================== */

  function setupReplay() {

    const replayButtons =
      $$(
        "[data-replay], .replay-btn"
      );

    replayButtons.forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.preventDefault();

            state.confettiTriggered =
              false;

            state.letterStarted =
              false;

            state.confessionRevealed =
              false;

            state.timelineIndex =
              0;

            document.body.classList.remove(
              "confession-revealed"
            );

            goToScene(
              0,
              {
                force: true,
                instant:
                  prefersReducedMotion()
              }
            );

          }
        );

      }
    );

  }


  /* ==========================================================
     38. DEBUG HELPERS
     ----------------------------------------------------------
     Exposed intentionally so development is easier.

     Open console:

     BoluUbi.next()
     BoluUbi.prev()
     BoluUbi.go(7)
     BoluUbi.music()
     BoluUbi.music2()
     BoluUbi.state()
     ========================================================== */

  window.BoluUbi = {

    next() {

      return goToScene(
        state.currentSceneIndex + 1,
        {
          direction: "forward"
        }
      );

    },

    prev() {

      return goToScene(
        state.currentSceneIndex - 1,
        {
          direction: "backward"
        }
      );

    },

    go(scene) {

      return goToScene(
        scene
      );

    },

    music() {

      return startEmotionalMusic();

    },

    music2() {

      return transitionToMusic2();

    },

    toggleMusic() {

      return toggleMusic();

    },

    state() {

      return {
        ...state
      };

    },

    currentScene() {

      return {
        index:
          state.currentSceneIndex,

        id:
          getCurrentScene()?.id ||
          null
      };

    }

  };


  /* ==========================================================
     39. INITIALIZATION
     ========================================================== */

  function init() {

    /*
     * IMPORTANT:
     * Nothing here should automatically play music.
     */

    initializeScenes();

    setupNavigation();

    setupScrollSafety();

    setupTouchHandling();

    setupHydroponics();

    setupMemoryTimeline();

    setupPhotoStage();

    setupLetter();

    setupAudio();

    setupMusicControls();

    setupMusicGate();

    setupMusicTransitionButtons();

    setupPrimaryTrackEnd();

    setupAccessibility();

    setupKeyboardNavigation();

    setupVisibilityHandling();

    setupViewportHandling();

    setupImageSafety();

    setupAudioSafety();

    setupPeakHooks();

    setupLetterMicroInteractions();

    setupTouchTargets();

    setupRevealObserver();

    setupPersonalDetails();

    setupReplay();


    /*
     * Initial body state.
     */

    document.body.classList.add(
      "app-initialized"
    );


    /*
     * Scene 01 gets a slightly delayed
     * entrance class.
     */

    const firstScene =
      scenes[0];

    if (firstScene) {

      window.setTimeout(
        () => {

          firstScene.classList.add(
            "scene-intro-ready"
          );

        },
        prefersReducedMotion()
          ? 0
          : 120
      );

    }


    /*
     * Tell CSS that JS has loaded successfully.
     */

    document.documentElement.classList.add(
      "js-loaded"
    );


    console.log(
      "%c🐣 Bolu Ubi is ready.",
      "font-size:16px;font-weight:700;"
    );

    console.log(
      "%cScroll = membaca. Tap = lanjut.",
      "font-size:12px;"
    );

  }


  /* ==========================================================
     40. START
     ========================================================== */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );

  } else {

    init();

  }

})();