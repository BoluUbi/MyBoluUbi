/* =========================================================
   BOLU UBI — 18TH BIRTHDAY EXPERIENCE
   JavaScript / Interaction Engine

   Scene flow:
   01 — Entrance
   02 — Birthday
   03 — Flashback
   04 — Traits
   05 — Little Side Quest
   06 — Photo
   07 — Letter Intro + Music
   08 — Letter
   09 — Last Thing
   10 — Final

   Designed for:
   - Mobile
   - Laptop / desktop
   - Touch + mouse
   - Keyboard
   - Reduced motion
   - Accidental double-click protection
========================================================= */

(() => {
  "use strict";

  /* =======================================================
     01. CONFIGURATION
  ======================================================= */

  const CONFIG = {
    totalScenes: 10,

    // Transition duration should stay synchronized
    // with the CSS scene transition.
    sceneTransition: 760,

    // Small delay before the next scene begins revealing.
    revealDelay: 120,

    // Typing speed.
    typingSpeed: 42,
    typingSpeedFast: 24,

    // Music.
    musicFadeDuration: 2600,
    musicTargetVolume: 0.72,

    // Prevent accidental repeated navigation.
    navigationCooldown: 560,

    // Progress indicator.
    updateUrl: false,

    // Local storage.
    rememberProgress: false,

    // Confetti quantity.
    confettiCount: 85
  };


  /* =======================================================
     02. DOM REFERENCES
  ======================================================= */

  const scenes = Array.from(document.querySelectorAll(".scene"));

  const body = document.body;
  const app = document.querySelector(".app");

  const progress = document.querySelector("#sceneProgress");
  const currentSceneLabel = document.querySelector("#sceneCurrent");

  const birthdayMusic = document.querySelector("#birthdayMusic");

  const memoryTimeline = document.querySelector("#memoryTimeline");
  const photoStage = document.querySelector("#photoStage");
  const confettiLayer = document.querySelector("#confettiLayer");

  const enterLetterButton =
    document.querySelector("#enterLetterButton");

  const musicStatus =
    document.querySelector(".music-status");


  /* =======================================================
     03. STATE
  ======================================================= */

  const state = {
    currentScene: 1,
    previousScene: null,

    isTransitioning: false,
    lastNavigationTime: 0,

    musicStarted: false,
    musicUnlocked: false,

    reducedMotion:
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,

    hasInteracted: false,

    // Prevent repeated one-time effects.
    sceneEffects: new Set(),

    // Typing management.
    typingControllers: new WeakMap(),

    // Touch gesture state.
    touchStartX: 0,
    touchStartY: 0
  };


  /* =======================================================
     04. INITIALIZATION
  ======================================================= */

  function init() {
    if (!scenes.length) {
      console.warn(
        "[Bolu Ubi] Tidak ditemukan element .scene."
      );
      return;
    }

    normalizeScenes();
    bindNavigation();
    bindKeyboardNavigation();
    bindTouchNavigation();
    bindInteractiveElements();
    bindMusicEvents();
    bindVisibilityEvents();

    setupProgress();
    setupInitialScene();

    // A tiny first-load touch.
    requestAnimationFrame(() => {
      document.documentElement.classList.add("js-ready");
      body.classList.add("experience-ready");
    });
  }


  /* =======================================================
     05. SCENE NORMALIZATION
  ======================================================= */

  function normalizeScenes() {
    scenes.forEach((scene, index) => {
      const sceneNumber = index + 1;

      scene.dataset.scene = sceneNumber;

      // Make sure scene IDs remain usable.
      if (!scene.id) {
        scene.id = `scene-${String(sceneNumber).padStart(2, "0")}`;
      }

      scene.classList.remove("is-active", "is-leaving");

      // We intentionally don't use display:none directly here.
      // CSS controls the visual state.
      scene.setAttribute(
        "aria-hidden",
        sceneNumber === 1 ? "false" : "true"
      );
    });
  }


  /* =======================================================
     06. INITIAL SCENE
  ======================================================= */

  function setupInitialScene() {
    const initialScene =
      getSceneElement(1) || scenes[0];

    state.currentScene = 1;

    scenes.forEach((scene) => {
      scene.classList.remove("is-active", "is-leaving");
      scene.setAttribute(
        "aria-hidden",
        scene === initialScene ? "false" : "true"
      );
    });

    initialScene.classList.add("is-active");

    updateProgress(1);

    // Allow browser to paint the opening before
    // starting its entrance animation.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        revealScene(initialScene, 1);
      });
    });
  }


  /* =======================================================
     07. NAVIGATION
  ======================================================= */

  function bindNavigation() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest(
        "[data-next-scene]"
      );

      if (!button) return;

      const target =
        Number(button.dataset.nextScene);

      if (!Number.isFinite(target)) return;

      event.preventDefault();

      // Special scene 06 -> 07 music entrance.
      if (
        button === enterLetterButton ||
        button.dataset.startMusic === "true"
      ) {
        unlockAudio();
        startMusic();
      }

      goToScene(target);
    });


    // Back navigation, if included in HTML.
    document.addEventListener("click", (event) => {
      const button =
        event.target.closest("[data-prev-scene]");

      if (!button) return;

      const target =
        Number(button.dataset.prevScene);

      if (!Number.isFinite(target)) return;

      event.preventDefault();

      goToScene(target, {
        direction: "backward"
      });
    });


    // Generic "restart" button.
    document.addEventListener("click", (event) => {
      const button =
        event.target.closest("[data-restart]");

      if (!button) return;

      event.preventDefault();

      restartExperience();
    });
  }


  async function goToScene(
    targetScene,
    options = {}
  ) {
    const {
      direction = targetScene > state.currentScene
        ? "forward"
        : "backward"
    } = options;

    if (state.isTransitioning) return;

    if (
      targetScene < 1 ||
      targetScene > CONFIG.totalScenes
    ) {
      return;
    }

    if (targetScene === state.currentScene) {
      return;
    }

    const now = performance.now();

    if (
      now - state.lastNavigationTime <
      CONFIG.navigationCooldown
    ) {
      return;
    }

    state.lastNavigationTime = now;
    state.isTransitioning = true;

    const oldScene =
      getSceneElement(state.currentScene);

    const newScene =
      getSceneElement(targetScene);

    if (!newScene) {
      state.isTransitioning = false;
      return;
    }

    state.previousScene = state.currentScene;

    // Let CSS know the direction.
    body.dataset.sceneDirection = direction;

    newScene.dataset.enterDirection = direction;

    if (oldScene) {
      oldScene.classList.remove("is-active");
      oldScene.classList.add("is-leaving");

      oldScene.setAttribute("aria-hidden", "true");
    }

    // Prepare the new scene.
    newScene.classList.add("is-active");
    newScene.classList.remove("is-leaving");

    newScene.setAttribute("aria-hidden", "false");

    state.currentScene = targetScene;

    updateProgress(targetScene);

    // URL is intentionally not modified unless enabled.
    if (CONFIG.updateUrl) {
      updateUrl(targetScene);
    }

    // Scroll the scene container back to top.
    resetSceneScroll(newScene);

    // Give the browser one frame before revealing content.
    await nextFrame();

    revealScene(newScene, targetScene);

    // Scene-specific behavior.
    await runSceneEffects(targetScene);

    // Clean up previous scene.
    window.setTimeout(() => {
      if (oldScene) {
        oldScene.classList.remove("is-leaving");
      }

      state.isTransitioning = false;
    }, state.reducedMotion
      ? 80
      : CONFIG.sceneTransition
    );
  }


  function getSceneElement(number) {
    return (
      document.querySelector(
        `.scene[data-scene="${number}"]`
      ) ||
      document.querySelector(
        `#scene-${String(number).padStart(2, "0")}`
      ) ||
      document.querySelector(
        `#scene-${number}`
      ) ||
      document.querySelector(
        `#scene${number}`
      )
    );
  }


  function resetSceneScroll(scene) {
    const scrollable =
      scene.querySelector(
        ".scene__inner, .scene-content, .scene__content"
      );

    if (scrollable) {
      scrollable.scrollTop = 0;
    }

    window.scrollTo({
      top: 0,
      behavior: state.reducedMotion
        ? "auto"
        : "smooth"
    });
  }


  /* =======================================================
     08. SCENE REVEAL ENGINE
  ======================================================= */

  function revealScene(scene, sceneNumber) {
    if (!scene) return;

    // Generic reveal.
    scene.classList.add("scene-revealed");

    // Staggered content.
    const revealItems = scene.querySelectorAll(
      "[data-reveal], .reveal, .stagger"
    );

    revealItems.forEach((element, index) => {
      element.style.setProperty(
        "--reveal-index",
        index
      );

      if (state.reducedMotion) {
        element.classList.add("is-visible");
        return;
      }

      window.setTimeout(() => {
        element.classList.add("is-visible");
      }, CONFIG.revealDelay + index * 85);
    });

    // Automatic typing elements.
    startTypingElements(scene);

    // Special scene hooks.
    if (sceneNumber === 6) {
      animatePhotoStage(scene);
    }

    if (sceneNumber === 8) {
      prepareLetter(scene);
    }

    if (sceneNumber === 10) {
      triggerFinalAtmosphere();
    }
  }


  /* =======================================================
     09. TYPING ENGINE
  ======================================================= */

  function startTypingElements(scene) {
    const elements =
      scene.querySelectorAll(
        "[data-typing], .js-typing"
      );

    elements.forEach((element) => {
      // Don't accidentally type the same element twice.
      if (
        element.dataset.typingDone === "true"
      ) {
        return;
      }

      const originalText =
        element.dataset.typingText ||
        element.textContent.trim();

      if (!originalText) return;

      typeText(
        element,
        originalText,
        {
          speed:
            Number(element.dataset.typingSpeed) ||
            CONFIG.typingSpeed,

          delay:
            Number(element.dataset.typingDelay) ||
            0,

          preserveHTML:
            element.dataset.preserveHtml === "true"
        }
      );
    });
  }


  function typeText(
    element,
    text,
    options = {}
  ) {
    const {
      speed = CONFIG.typingSpeed,
      delay = 0
    } = options;

    // Cancel previous typing process for this element.
    const previousController =
      state.typingControllers.get(element);

    if (previousController) {
      previousController.cancelled = true;
    }

    const controller = {
      cancelled: false
    };

    state.typingControllers.set(
      element,
      controller
    );

    if (state.reducedMotion) {
      element.textContent = text;
      element.dataset.typingDone = "true";
      return;
    }

    element.textContent = "";

    window.setTimeout(() => {
      let index = 0;

      const tick = () => {
        if (controller.cancelled) return;

        if (index >= text.length) {
          element.dataset.typingDone = "true";
          return;
        }

        element.textContent += text[index];

        index += 1;

        let currentSpeed = speed;

        // Natural pause around punctuation.
        const previousChar =
          text[index - 1];

        if (
          [".", "!", "?"].includes(previousChar)
        ) {
          currentSpeed *= 3.2;
        } else if (
          [",", "…"].includes(previousChar)
        ) {
          currentSpeed *= 2;
        }

        window.setTimeout(
          tick,
          currentSpeed
        );
      };

      tick();
    }, delay);
  }


  /* =======================================================
     10. PROGRESS SYSTEM
  ======================================================= */

  function setupProgress() {
    if (!progress) return;

    progress.style.setProperty(
      "--scene-total",
      CONFIG.totalScenes
    );

    updateProgress(1);
  }


  function updateProgress(sceneNumber) {
    const percentage =
      ((sceneNumber - 1) /
        (CONFIG.totalScenes - 1)) *
      100;

    if (progress) {
      progress.style.setProperty(
        "--progress",
        `${percentage}%`
      );

      progress.setAttribute(
        "aria-valuenow",
        sceneNumber
      );

      progress.setAttribute(
        "aria-valuemax",
        CONFIG.totalScenes
      );
    }

    if (currentSceneLabel) {
      currentSceneLabel.textContent =
        String(sceneNumber).padStart(2, "0");
    }

    // Optional numbered progress nodes.
    document
      .querySelectorAll(
        "[data-progress-scene]"
      )
      .forEach((item) => {
        const itemScene =
          Number(item.dataset.progressScene);

        item.classList.toggle(
          "is-current",
          itemScene === sceneNumber
        );

        item.classList.toggle(
          "is-complete",
          itemScene < sceneNumber
        );
      });
  }


  /* =======================================================
     11. SCENE-SPECIFIC EFFECTS
  ======================================================= */

  async function runSceneEffects(sceneNumber) {
    switch (sceneNumber) {
      case 1:
        effectEntrance();
        break;

      case 2:
        effectBirthday();
        break;

      case 3:
        effectFlashback();
        break;

      case 4:
        effectTraits();
        break;

      case 5:
        effectSideQuest();
        break;

      case 6:
        effectPhoto();
        break;

      case 7:
        effectLetterEntrance();
        break;

      case 8:
        effectLetter();
        break;

      case 9:
        effectLastThing();
        break;

      case 10:
        effectFinal();
        break;

      default:
        break;
    }
  }


  /* =======================================================
     SCENE 01 — ENTRANCE
  ======================================================= */

  function effectEntrance() {
    const scene = getSceneElement(1);

    if (!scene) return;

    createTinyAmbientParticles(scene);

    // Very subtle "arrival" feeling.
    scene.classList.add("entrance-complete");
  }


  /* =======================================================
     SCENE 02 — BIRTHDAY
  ======================================================= */

  function effectBirthday() {
    const scene = getSceneElement(2);

    if (!scene) return;

    if (
      state.sceneEffects.has("birthday")
    ) {
      return;
    }

    state.sceneEffects.add("birthday");

    // Tiny celebratory burst — not full confetti yet.
    createMiniSparkles(scene);
  }


  /* =======================================================
     SCENE 03 — FLASHBACK
  ======================================================= */

  function effectFlashback() {
    const scene = getSceneElement(3);

    if (!scene) return;

    scene.classList.add("memory-mode");

    if (memoryTimeline) {
      memoryTimeline
        .querySelectorAll(
          "[data-memory-item], .memory-item"
        )
        .forEach((item, index) => {
          if (state.reducedMotion) {
            item.classList.add("is-visible");
            return;
          }

          window.setTimeout(() => {
            item.classList.add("is-visible");
          }, 250 + index * 170);
        });
    }
  }


  /* =======================================================
     SCENE 04 — TRAITS
  ======================================================= */

  function effectTraits() {
    const scene = getSceneElement(4);

    if (!scene) return;

    // Every trait can have its own micro interaction.
    const traits =
      scene.querySelectorAll(
        "[data-trait], .trait-card"
      );

    traits.forEach((trait, index) => {
      trait.style.setProperty(
        "--trait-index",
        index
      );
    });
  }


  /* =======================================================
     SCENE 05 — SIDE QUEST
  ======================================================= */

  function effectSideQuest() {
    const scene = getSceneElement(5);

    if (!scene) return;

    scene.classList.add("side-quest-mode");

    // Hydroponics detail remains interactive.
    setupHydroponicsDetail(scene);

    // Little progress animation.
    const progressBars =
      scene.querySelectorAll(
        "[data-sidequest-progress]"
      );

    progressBars.forEach((bar) => {
      const value =
        bar.dataset.sidequestProgress || "100";

      window.setTimeout(() => {
        bar.style.setProperty(
          "--sidequest-progress",
          `${value}%`
        );
      }, 250);
    });
  }


  /* =======================================================
     SCENE 06 — PHOTO
  ======================================================= */

  function effectPhoto() {
    const scene = getSceneElement(6);

    if (!scene) return;

    animatePhotoStage(scene);

    // Make the special next button more noticeable.
    if (enterLetterButton) {
      window.setTimeout(() => {
        enterLetterButton.classList.add(
          "is-ready"
        );

        enterLetterButton.setAttribute(
          "aria-label",
          "Lanjut ke bagian berikutnya"
        );
      }, state.reducedMotion ? 100 : 900);
    }
  }


  function animatePhotoStage(scene) {
    if (!photoStage) return;

    photoStage.classList.add(
      "photo-stage-visible"
    );

    const image =
      photoStage.querySelector("img");

    if (image) {
      image.addEventListener(
        "load",
        () => {
          photoStage.classList.add(
            "image-loaded"
          );
        },
        { once: true }
      );

      // Cached image.
      if (image.complete) {
        photoStage.classList.add(
          "image-loaded"
        );
      }
    }

    // Photo caption reveal.
    const caption =
      scene.querySelector(
        "[data-photo-caption]"
      );

    if (caption) {
      window.setTimeout(() => {
        caption.classList.add("is-visible");
      }, state.reducedMotion ? 0 : 700);
    }
  }


  /* =======================================================
     SCENE 07 — LETTER ENTRANCE + MUSIC
  ======================================================= */

  function effectLetterEntrance() {
    const scene = getSceneElement(7);

    if (!scene) return;

    scene.classList.add(
      "letter-entrance"
    );

    /*
      IMPORTANT:
      Music starts here because Scene 06's button
      explicitly unlocks audio and calls startMusic().

      This creates the feeling:
      "you just crossed into another chapter."
    */

    if (!state.musicStarted) {
      startMusic();
    }

    animateMusicStatus(scene);
  }


  function animateMusicStatus(scene) {
    const status =
      scene.querySelector(".music-status") ||
      musicStatus;

    if (!status) return;

    status.classList.add(
      "is-visible"
    );

    // Optional wave bars.
    status
      .querySelectorAll(
        ".sound-wave span, [data-wave]"
      )
      .forEach((bar, index) => {
        bar.style.setProperty(
          "--wave-index",
          index
        );
      });
  }


  /* =======================================================
     SCENE 08 — LETTER
  ======================================================= */

  function effectLetter() {
    const scene = getSceneElement(8);

    if (!scene) return;

    prepareLetter(scene);

    // Keep music alive but visually secondary.
    body.classList.add("letter-is-playing");
  }


  function prepareLetter(scene) {
    const parts =
      scene.querySelectorAll(
        ".letter__part, [data-letter-part]"
      );

    parts.forEach((part, index) => {
      if (
        state.reducedMotion
      ) {
        part.classList.add("is-visible");
        return;
      }

      // IntersectionObserver handles the real reveal.
      observeLetterPart(part, index);
    });
  }


  let letterObserver = null;


  function observeLetterPart(
    element,
    index
  ) {
    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      element.classList.add("is-visible");
      return;
    }

    if (!letterObserver) {
      letterObserver =
        new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) {
                return;
              }

              entry.target.classList.add(
                "is-visible"
              );

              letterObserver.unobserve(
                entry.target
              );
            });
          },
          {
            threshold: 0.18,
            rootMargin:
              "0px 0px -8% 0px"
          }
        );
    }

    element.style.setProperty(
      "--letter-index",
      index
    );

    letterObserver.observe(element);
  }


  /* =======================================================
     SCENE 09 — LAST THING
  ======================================================= */

  function effectLastThing() {
    const scene = getSceneElement(9);

    if (!scene) return;

    scene.classList.add(
      "quiet-mode"
    );

    // Reduce visual noise before final scene.
    body.classList.add(
      "before-final"
    );

    const finalLine =
      scene.querySelector(
        "[data-final-line]"
      );

    if (finalLine) {
      finalLine.classList.remove(
        "is-visible"
      );

      window.setTimeout(() => {
        finalLine.classList.add(
          "is-visible"
        );
      }, state.reducedMotion ? 0 : 650);
    }
  }


  /* =======================================================
     SCENE 10 — FINAL
  ======================================================= */

  function effectFinal() {
    const scene = getSceneElement(10);

    if (!scene) return;

    body.classList.remove(
      "before-final"
    );

    body.classList.add(
      "final-mode"
    );

    triggerFinalAtmosphere();
  }


  function triggerFinalAtmosphere() {
    if (
      state.sceneEffects.has(
        "final-atmosphere"
      )
    ) {
      return;
    }

    state.sceneEffects.add(
      "final-atmosphere"
    );

    if (state.reducedMotion) {
      return;
    }

    createConfetti();

    const finalScene =
      getSceneElement(10);

    if (finalScene) {
      finalScene.classList.add(
        "celebration-start"
      );
    }
  }


  /* =======================================================
     12. HYDROPONICS DETAIL
  ======================================================= */

  function setupHydroponicsDetail(scene) {
    const buttons =
      scene.querySelectorAll(
        "[data-toggle-detail]"
      );

    buttons.forEach((button) => {
      const targetName =
        button.dataset.toggleDetail;

      const target =
        document.getElementById(
          targetName
        );

      if (!target) return;

      button.setAttribute(
        "aria-expanded",
        "false"
      );

      button.addEventListener(
        "click",
        () => {
          const isOpen =
            target.classList.contains(
              "is-open"
            );

          // Close other detail panels.
          scene
            .querySelectorAll(
              ".is-open[data-detail-panel]"
            )
            .forEach((panel) => {
              panel.classList.remove(
                "is-open"
              );
            });

          scene
            .querySelectorAll(
              "[data-toggle-detail]"
            )
            .forEach((item) => {
              item.setAttribute(
                "aria-expanded",
                "false"
              );
            });

          if (!isOpen) {
            target.classList.add(
              "is-open"
            );

            button.setAttribute(
              "aria-expanded",
              "true"
            );
          }
        }
      );
    });
  }


  /* =======================================================
     13. MUSIC ENGINE
  ======================================================= */

  function bindMusicEvents() {
    if (!birthdayMusic) return;

    birthdayMusic.volume = 0;

    birthdayMusic.addEventListener(
      "play",
      () => {
        state.musicStarted = true;

        body.classList.add(
          "music-playing"
        );

        updateMusicUI(true);
      }
    );

    birthdayMusic.addEventListener(
      "pause",
      () => {
        body.classList.remove(
          "music-playing"
        );

        updateMusicUI(false);
      }
    );

    birthdayMusic.addEventListener(
      "ended",
      () => {
        state.musicStarted = false;

        body.classList.remove(
          "music-playing"
        );

        updateMusicUI(false);
      }
    );

    birthdayMusic.addEventListener(
      "error",
      () => {
        console.warn(
          "[Bolu Ubi] Music tidak dapat dimuat."
        );

        updateMusicUI(false, true);
      }
    );
  }


  function unlockAudio() {
    state.musicUnlocked = true;

    if (!birthdayMusic) return;

    /*
      Calling load() is intentionally avoided.
      The browser should preserve the current audio state.
    */

    birthdayMusic.setAttribute(
      "playsinline",
      ""
    );
  }


  async function startMusic() {
    if (!birthdayMusic) {
      return;
    }

    if (state.musicStarted) {
      return;
    }

    try {
      birthdayMusic.volume = 0;

      const playPromise =
        birthdayMusic.play();

      if (
        playPromise &&
        typeof playPromise.then === "function"
      ) {
        await playPromise;
      }

      state.musicStarted = true;

      fadeAudio(
        birthdayMusic,
        0,
        CONFIG.musicTargetVolume,
        CONFIG.musicFadeDuration
      );
    } catch (error) {
      /*
        Browser autoplay policies may still reject
        playback. The important part is that the
        request was made from a user gesture in the
        Scene 06 button flow.
      */

      console.warn(
        "[Bolu Ubi] Browser menahan playback musik.",
        error
      );

      state.musicStarted = false;
      updateMusicUI(false, true);
    }
  }


  function fadeAudio(
    audio,
    from,
    to,
    duration
  ) {
    if (!audio) return;

    if (state.reducedMotion) {
      audio.volume = to;
      return;
    }

    const start =
      performance.now();

    audio.volume = from;

    const animate = (now) => {
      const elapsed =
        now - start;

      const progress =
        Math.min(
          elapsed / duration,
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
        from +
        (to - from) * eased;

      if (progress < 1) {
        requestAnimationFrame(
          animate
        );
      }
    };

    requestAnimationFrame(
      animate
    );
  }


  function updateMusicUI(
    playing,
    error = false
  ) {
    document
      .querySelectorAll(
        ".music-status, [data-music-status]"
      )
      .forEach((element) => {
        element.classList.toggle(
          "is-playing",
          playing
        );

        element.classList.toggle(
          "has-error",
          error
        );
      });

    document
      .querySelectorAll(
        "[data-music-icon]"
      )
      .forEach((element) => {
        element.textContent =
          playing
            ? "♫"
            : "♪";
      });
  }


  /* =======================================================
     14. KEYBOARD NAVIGATION
  ======================================================= */

  function bindKeyboardNavigation() {
    document.addEventListener(
      "keydown",
      (event) => {
        // Don't hijack typing fields.
        const target =
          event.target;

        const isTypingField =
          target.matches(
            "input, textarea, select, [contenteditable='true']"
          );

        if (isTypingField) return;

        switch (event.key) {
          case "ArrowDown":
          case "ArrowRight":
          case "PageDown":
          case " ":
            event.preventDefault();

            goToScene(
              Math.min(
                state.currentScene + 1,
                CONFIG.totalScenes
              )
            );
            break;

          case "ArrowUp":
          case "ArrowLeft":
          case "PageUp":
            event.preventDefault();

            goToScene(
              Math.max(
                state.currentScene - 1,
                1
              ),
              {
                direction: "backward"
              }
            );
            break;

          case "Home":
            event.preventDefault();
            goToScene(1);
            break;

          case "End":
            event.preventDefault();
            goToScene(
              CONFIG.totalScenes
            );
            break;
        }
      }
    );
  }


  /* =======================================================
     15. TOUCH / SWIPE
  ======================================================= */

  function bindTouchNavigation() {
    document.addEventListener(
      "touchstart",
      (event) => {
        if (
          !event.touches ||
          !event.touches[0]
        ) {
          return;
        }

        state.touchStartX =
          event.touches[0].clientX;

        state.touchStartY =
          event.touches[0].clientY;
      },
      {
        passive: true
      }
    );


    document.addEventListener(
      "touchend",
      (event) => {
        if (
          !event.changedTouches ||
          !event.changedTouches[0]
        ) {
          return;
        }

        const touch =
          event.changedTouches[0];

        const deltaX =
          touch.clientX -
          state.touchStartX;

        const deltaY =
          touch.clientY -
          state.touchStartY;

        // Ignore tiny movements.
        if (
          Math.abs(deltaX) < 45 &&
          Math.abs(deltaY) < 45
        ) {
          return;
        }

        /*
          Vertical swipe is the primary gesture.
          Horizontal swipe is intentionally supported
          too because it feels natural on mobile.
        */

        if (
          Math.abs(deltaY) >
          Math.abs(deltaX)
        ) {
          if (deltaY < 0) {
            goToScene(
              Math.min(
                state.currentScene + 1,
                CONFIG.totalScenes
              )
            );
          } else {
            goToScene(
              Math.max(
                state.currentScene - 1,
                1
              ),
              {
                direction: "backward"
              }
            );
          }

          return;
        }

        if (deltaX < 0) {
          goToScene(
            Math.min(
              state.currentScene + 1,
              CONFIG.totalScenes
            )
          );
        } else {
          goToScene(
            Math.max(
              state.currentScene - 1,
              1
            ),
            {
              direction: "backward"
            }
          );
        }
      },
      {
        passive: true
      }
    );
  }


  /* =======================================================
     16. MICRO INTERACTIONS
  ======================================================= */

  function bindInteractiveElements() {
    bindMagneticButtons();
    bindHoverCards();
    bindClickHearts();
    bindPhotoTilt();
  }


  /* -------------------------------------------------------
     Magnetic buttons
  ------------------------------------------------------- */

  function bindMagneticButtons() {
    const buttons =
      document.querySelectorAll(
        ".scene-button, [data-magnetic]"
      );

    if (state.reducedMotion) {
      return;
    }

    buttons.forEach((button) => {
      button.addEventListener(
        "pointermove",
        (event) => {
          if (
            event.pointerType === "touch"
          ) {
            return;
          }

          const rect =
            button.getBoundingClientRect();

          const x =
            event.clientX -
            rect.left -
            rect.width / 2;

          const y =
            event.clientY -
            rect.top -
            rect.height / 2;

          const strength =
            Number(
              button.dataset.magneticStrength
            ) || 0.12;

          button.style.setProperty(
            "--magnetic-x",
            `${x * strength}px`
          );

          button.style.setProperty(
            "--magnetic-y",
            `${y * strength}px`
          );

          button.classList.add(
            "is-magnetic"
          );
        }
      );

      button.addEventListener(
        "pointerleave",
        () => {
          button.style.setProperty(
            "--magnetic-x",
            "0px"
          );

          button.style.setProperty(
            "--magnetic-y",
            "0px"
          );

          button.classList.remove(
            "is-magnetic"
          );
        }
      );
    });
  }


  /* -------------------------------------------------------
     Hover cards
  ------------------------------------------------------- */

  function bindHoverCards() {
    const cards =
      document.querySelectorAll(
        "[data-hover-card], .trait-card, .memory-item"
      );

    if (state.reducedMotion) {
      return;
    }

    cards.forEach((card) => {
      card.addEventListener(
        "pointermove",
        (event) => {
          if (
            event.pointerType === "touch"
          ) {
            return;
          }

          const rect =
            card.getBoundingClientRect();

          const x =
            event.clientX -
            rect.left;

          const y =
            event.clientY -
            rect.top;

          const rotateY =
            ((x / rect.width) - 0.5) *
            4;

          const rotateX =
            ((y / rect.height) - 0.5) *
            -4;

          card.style.setProperty(
            "--card-rotate-x",
            `${rotateX}deg`
          );

          card.style.setProperty(
            "--card-rotate-y",
            `${rotateY}deg`
          );

          card.style.setProperty(
            "--mouse-x",
            `${x}px`
          );

          card.style.setProperty(
            "--mouse-y",
            `${y}px`
          );

          card.classList.add(
            "is-hovering"
          );
        }
      );

      card.addEventListener(
        "pointerleave",
        () => {
          card.style.setProperty(
            "--card-rotate-x",
            "0deg"
          );

          card.style.setProperty(
            "--card-rotate-y",
            "0deg"
          );

          card.classList.remove(
            "is-hovering"
          );
        }
      );
    });
  }


  /* -------------------------------------------------------
     Click hearts
  ------------------------------------------------------- */

  function bindClickHearts() {
    document.addEventListener(
      "click",
      (event) => {
        const target =
          event.target.closest(
            "[data-heart-click]"
          );

        if (!target) return;

        if (state.reducedMotion) {
          return;
        }

        spawnHeartBurst(
          event.clientX,
          event.clientY
        );
      }
    );
  }


  function spawnHeartBurst(x, y) {
    const container =
      document.querySelector(
        ".app"
      ) || body;

    const hearts = [
      "♡",
      "♥",
      "✦",
      "·"
    ];

    for (let i = 0; i < 6; i++) {
      const heart =
        document.createElement("span");

      heart.className =
        "click-heart";

      heart.textContent =
        hearts[
          Math.floor(
            Math.random() *
            hearts.length
          )
        ];

      heart.style.left =
        `${x}px`;

      heart.style.top =
        `${y}px`;

      heart.style.setProperty(
        "--heart-x",
        `${(Math.random() - 0.5) * 100}px`
      );

      heart.style.setProperty(
        "--heart-y",
        `${-40 - Math.random() * 80}px`
      );

      heart.style.setProperty(
        "--heart-delay",
        `${i * 35}ms`
      );

      container.appendChild(
        heart
      );

      window.setTimeout(() => {
        heart.remove();
      }, 1100);
    }
  }


  /* -------------------------------------------------------
     Photo tilt
  ------------------------------------------------------- */

  function bindPhotoTilt() {
    if (!photoStage) return;

    if (state.reducedMotion) {
      return;
    }

    photoStage.addEventListener(
      "pointermove",
      (event) => {
        if (
          event.pointerType === "touch"
        ) {
          return;
        }

        const rect =
          photoStage.getBoundingClientRect();

        const x =
          event.clientX -
          rect.left;

        const y =
          event.clientY -
          rect.top;

        const rotateY =
          ((x / rect.width) - 0.5) *
          5;

        const rotateX =
          ((y / rect.height) - 0.5) *
          -5;

        photoStage.style.setProperty(
          "--photo-rotate-x",
          `${rotateX}deg`
        );

        photoStage.style.setProperty(
          "--photo-rotate-y",
          `${rotateY}deg`
        );
      }
    );

    photoStage.addEventListener(
      "pointerleave",
      () => {
        photoStage.style.setProperty(
          "--photo-rotate-x",
          "0deg"
        );

        photoStage.style.setProperty(
          "--photo-rotate-y",
          "0deg"
        );
      }
    );
  }


  /* =======================================================
     17. AMBIENT ATMOSPHERE
  ======================================================= */

  function createTinyAmbientParticles(
    scene
  ) {
    if (
      state.reducedMotion ||
      scene.dataset.ambientCreated
    ) {
      return;
    }

    scene.dataset.ambientCreated =
      "true";

    const container =
      scene.querySelector(
        ".ambient-particles"
      ) || scene;

    for (let i = 0; i < 10; i++) {
      const particle =
        document.createElement("span");

      particle.className =
        "ambient-particle";

      particle.style.setProperty(
        "--particle-x",
        `${Math.random() * 100}%`
      );

      particle.style.setProperty(
        "--particle-y",
        `${Math.random() * 100}%`
      );

      particle.style.setProperty(
        "--particle-delay",
        `${Math.random() * 5}s`
      );

      particle.style.setProperty(
        "--particle-duration",
        `${5 + Math.random() * 6}s`
      );

      container.appendChild(
        particle
      );
    }
  }


  function createMiniSparkles(scene) {
    if (state.reducedMotion) {
      return;
    }

    const container =
      scene.querySelector(
        ".sparkle-layer"
      ) || scene;

    for (let i = 0; i < 14; i++) {
      const sparkle =
        document.createElement("span");

      sparkle.className =
        "scene-sparkle";

      sparkle.style.setProperty(
        "--sparkle-x",
        `${10 + Math.random() * 80}%`
      );

      sparkle.style.setProperty(
        "--sparkle-y",
        `${10 + Math.random() * 80}%`
      );

      sparkle.style.setProperty(
        "--sparkle-delay",
        `${Math.random() * 1.8}s`
      );

      container.appendChild(
        sparkle
      );

      window.setTimeout(() => {
        sparkle.remove();
      }, 3600);
    }
  }


  /* =======================================================
     18. FINAL CONFETTI
  ======================================================= */

  function createConfetti() {
    if (
      state.reducedMotion ||
      !confettiLayer
    ) {
      return;
    }

    // Avoid creating it twice.
    if (
      confettiLayer.dataset.created ===
      "true"
    ) {
      return;
    }

    confettiLayer.dataset.created =
      "true";

    const symbols = [
      "✦",
      "✧",
      "♡",
      "·",
      "✿"
    ];

    const fragment =
      document.createDocumentFragment();

    for (
      let i = 0;
      i < CONFIG.confettiCount;
      i++
    ) {
      const piece =
        document.createElement("span");

      piece.className =
        "confetti-piece";

      piece.textContent =
        symbols[
          Math.floor(
            Math.random() *
            symbols.length
          )
        ];

      piece.style.setProperty(
        "--confetti-x",
        `${Math.random() * 100}%`
      );

      piece.style.setProperty(
        "--confetti-delay",
        `${Math.random() * 1.8}s`
      );

      piece.style.setProperty(
        "--confetti-duration",
        `${2.6 + Math.random() * 2.6}s`
      );

      piece.style.setProperty(
        "--confetti-drift",
        `${(Math.random() - 0.5) * 180}px`
      );

      piece.style.setProperty(
        "--confetti-rotate",
        `${Math.random() * 720 - 360}deg`
      );

      fragment.appendChild(
        piece
      );
    }

    confettiLayer.appendChild(
      fragment
    );

    // Keep DOM light.
    window.setTimeout(() => {
      confettiLayer.innerHTML = "";
      confettiLayer.dataset.created =
        "false";
    }, 7500);
  }


  /* =======================================================
     19. VISIBILITY / TAB HANDLING
  ======================================================= */

  function bindVisibilityEvents() {
    document.addEventListener(
      "visibilitychange",
      () => {
        if (!birthdayMusic) return;

        if (
          document.hidden
        ) {
          /*
            Don't destroy the experience when
            the user changes tabs.

            We simply lower volume.
          */
          if (
            !birthdayMusic.paused
          ) {
            fadeAudio(
              birthdayMusic,
              birthdayMusic.volume,
              0.12,
              500
            );
          }

          return;
        }

        if (
          state.musicStarted &&
          !birthdayMusic.paused
        ) {
          fadeAudio(
            birthdayMusic,
            birthdayMusic.volume,
            CONFIG.musicTargetVolume,
            800
          );
        }
      }
    );
  }


  /* =======================================================
     20. RESTART EXPERIENCE
  ======================================================= */

  function restartExperience() {
    state.isTransitioning = false;
    state.previousScene = null;
    state.sceneEffects.clear();

    body.classList.remove(
      "music-playing",
      "letter-is-playing",
      "before-final",
      "final-mode"
    );

    if (birthdayMusic) {
      birthdayMusic.pause();
      birthdayMusic.currentTime = 0;
      birthdayMusic.volume = 0;
    }

    state.musicStarted = false;

    if (confettiLayer) {
      confettiLayer.innerHTML = "";
      confettiLayer.dataset.created =
        "false";
    }

    scenes.forEach((scene) => {
      scene.classList.remove(
        "is-active",
        "is-leaving",
        "scene-revealed",
        "memory-mode",
        "side-quest-mode",
        "letter-entrance",
        "quiet-mode",
        "celebration-start"
      );

      scene.setAttribute(
        "aria-hidden",
        "true"
      );

      scene
        .querySelectorAll(
          ".is-visible"
        )
        .forEach((element) => {
          element.classList.remove(
            "is-visible"
          );
        });
    });

    const first =
      getSceneElement(1);

    if (!first) return;

    first.classList.add(
      "is-active"
    );

    first.setAttribute(
      "aria-hidden",
      "false"
    );

    state.currentScene = 1;

    updateProgress(1);

    resetSceneScroll(first);

    window.setTimeout(() => {
      revealScene(first, 1);
    }, 40);
  }


  /* =======================================================
     21. URL STATE — OPTIONAL
  ======================================================= */

  function updateUrl(sceneNumber) {
    try {
      const url =
        new URL(
          window.location.href
        );

      url.hash =
        `scene-${String(sceneNumber).padStart(2, "0")}`;

      window.history.replaceState(
        {},
        "",
        url
      );
    } catch {
      // URL updates are optional.
    }
  }


  /* =======================================================
     22. UTILITY
  ======================================================= */

  function nextFrame() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  }


  /* =======================================================
     23. RESIZE SAFETY
  ======================================================= */

  let resizeTimer = null;

  window.addEventListener(
    "resize",
    () => {
      clearTimeout(
        resizeTimer
      );

      resizeTimer = setTimeout(() => {
        // Recalculate photo state.
        if (
          photoStage &&
          state.currentScene === 6
        ) {
          photoStage.style.setProperty(
            "--photo-rotate-x",
            "0deg"
          );

          photoStage.style.setProperty(
            "--photo-rotate-y",
            "0deg"
          );
        }
      }, 120);
    },
    {
      passive: true
    }
  );


  /* =======================================================
     24. SAFETY: BROKEN IMAGE HANDLING
  ======================================================= */

  document
    .querySelectorAll("img")
    .forEach((image) => {
      image.addEventListener(
        "error",
        () => {
          image.classList.add(
            "image-load-error"
          );

          const wrapper =
            image.closest(
              "[data-photo-wrapper], .photo-stage, .photo-frame"
            );

          if (wrapper) {
            wrapper.classList.add(
              "has-image-error"
            );
          }
        },
        {
          once: true
        }
      );
    });


  /* =======================================================
     25. REDUCED MOTION — LIVE UPDATE
  ======================================================= */

  if (
    window.matchMedia
  ) {
    const motionQuery =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );

    const handleMotionChange =
      (event) => {
        state.reducedMotion =
          event.matches;

        if (state.reducedMotion) {
          document.documentElement.classList.add(
            "reduced-motion"
          );
        } else {
          document.documentElement.classList.remove(
            "reduced-motion"
          );
        }
      };

    if (
      typeof motionQuery.addEventListener ===
      "function"
    ) {
      motionQuery.addEventListener(
        "change",
        handleMotionChange
      );
    } else if (
      typeof motionQuery.addListener ===
      "function"
    ) {
      motionQuery.addListener(
        handleMotionChange
      );
    }

    handleMotionChange(
      motionQuery
    );
  }


  /* =======================================================
     26. START
  ======================================================= */

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