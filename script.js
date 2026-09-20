/* ============================================================
   BOLU UBI 🐣
   FINAL INTEGRATION / DEBUG ENGINE
   ------------------------------------------------------------
   index.html
   style.css
   script.js

   IMPORTANT DESIGN RULES
   ------------------------------------------------------------
   1. HTML MUST remain visible if JS fails.
   2. Scroll NEVER changes scenes.
   3. Touch NEVER changes scenes accidentally.
   4. Scene navigation is explicit.
   5. Music requires user interaction.
   6. Missing optional elements must NOT crash the app.
   7. Mobile first.
   8. No framework.
   ============================================================ */

(() => {
  "use strict";


  /* ==========================================================
     01. CONFIG
     ========================================================== */

  const CONFIG = {

    /*
     * We support both:
     *
     * #scene-01
     * #scene-1
     * .scene
     *
     * so a small HTML naming difference won't destroy
     * the whole experience.
     */

    sceneSelectors: [
      ".scene",
      "[data-scene]"
    ],

    transitionDuration: 620,

    music: {
      primary: "music1.mp3",
      secondary: "music2.mp3",
      volume: 0.68,
      fadeIn: 1600,
      fadeOut: 1400
    },

    typing: {
      normal: 28,
      slow: 40,
      fast: 18
    },

    confetti: {
      amount: 52
    }

  };


  /* ==========================================================
     02. BASIC HELPERS
     ========================================================== */

  const $ = (
    selector,
    parent = document
  ) => parent.querySelector(selector);


  const $$ = (
    selector,
    parent = document
  ) => Array.from(
    parent.querySelectorAll(selector)
  );


  const wait = ms =>
    new Promise(resolve =>
      setTimeout(resolve, ms)
    );


  const reducedMotion = () =>
    window.matchMedia &&
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;


  /* ==========================================================
     03. STATE
     ========================================================== */

  const state = {

    scenes: [],

    current: 0,

    transitioning: false,

    musicStarted: false,

    music2Started: false,

    letterStarted: false,

    hydroponicsOpen: false,

    finalShown: false

  };


  /* ==========================================================
     04. SAFE SCENE DISCOVERY
     ========================================================== */

  function discoverScenes() {

    let found = [];

    for (
      const selector of
      CONFIG.sceneSelectors
    ) {

      found.push(
        ...$$(selector)
      );

    }


    /*
     * Remove duplicates.
     */

    found = [
      ...new Set(found)
    ];


    /*
     * Sort by explicit scene number if available.
     */

    found.sort(
      (a, b) => {

        const getNumber = element => {

          const source =
            element.dataset.scene ||
            element.id ||
            "";

          const match =
            source.match(
              /(\d+)/
            );

          return match
            ? Number(match[1])
            : 9999;

        };

        return (
          getNumber(a) -
          getNumber(b)
        );

      }
    );


    state.scenes = found;

    return found;

  }


  /* ==========================================================
     05. CRITICAL VISIBILITY FIX
     ----------------------------------------------------------
     This is the part that prevents the dreaded:

     "cream background + nothing else"

     situation.
     ========================================================== */

  function forceInitialVisibility() {

    const scenes =
      state.scenes;


    if (!scenes.length) {

      console.warn(
        "[Bolu Ubi] No .scene elements found."
      );

      /*
       * IMPORTANT:
       *
       * Do NOT hide the page.
       */

      document.body.classList.add(
        "scene-engine-failed"
      );

      return;

    }


    /*
     * Find existing active scene first.
     */

    let activeIndex =
      scenes.findIndex(
        scene =>
          scene.classList.contains(
            "is-active"
          ) ||
          scene.classList.contains(
            "active"
          ) ||
          scene.classList.contains(
            "current"
          ) ||
          scene.dataset.active === "true"
      );


    /*
     * If nothing is active:
     * FIRST SCENE ALWAYS WINS.
     */

    if (activeIndex === -1) {
      activeIndex = 0;
    }


    state.current =
      activeIndex;


    scenes.forEach(
      (scene, index) => {

        const active =
          index === activeIndex;


        /*
         * CSS classes.
         */

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


        /*
         * Inline fallback.
         *
         * This is deliberate.
         *
         * If style.css accidentally says:
         *
         * .scene { visibility:hidden }
         *
         * but the active selector fails,
         * the first scene is STILL visible.
         */

        if (active) {

          scene.style.visibility =
            "visible";

          scene.style.opacity =
            "1";

          scene.style.pointerEvents =
            "auto";

          scene.style.display =
            "block";

          scene.removeAttribute(
            "aria-hidden"
          );

        } else {

          scene.style.visibility =
            "hidden";

          scene.style.opacity =
            "0";

          scene.style.pointerEvents =
            "none";

          scene.setAttribute(
            "aria-hidden",
            "true"
          );

        }

      }
    );


    document.body.classList.add(
      "engine-ready"
    );

  }


  /* ==========================================================
     06. RESET SCENE
     ========================================================== */

  function resetSceneScroll(scene) {

    if (!scene) return;

    scene.scrollTop = 0;

    /*
     * Do NOT scroll the entire page.
     *
     * Each scene is responsible for its own content.
     */

    const inner =
      scene.querySelector(
        ".scene-inner, .scene-content, .scene-scroll"
      );

    if (inner) {
      inner.scrollTop = 0;
    }

  }


  /* ==========================================================
     07. UPDATE PROGRESS
     ========================================================== */

  function updateProgress() {

    const total =
      state.scenes.length;

    const current =
      state.current + 1;


    const currentEl =
      $("#sceneCurrent");

    const totalEl =
      $("#sceneTotal");

    const progressEl =
      $("#sceneProgress");


    if (currentEl) {

      currentEl.textContent =
        String(current).padStart(
          2,
          "0"
        );

    }


    if (totalEl) {

      totalEl.textContent =
        String(total).padStart(
          2,
          "0"
        );

    }


    if (progressEl) {

      const percentage =
        total <= 1
          ? 100
          : (
              state.current /
              (total - 1)
            ) * 100;


      progressEl.style.setProperty(
        "--progress",
        `${percentage}%`
      );

      progressEl.style.width =
        `${percentage}%`;

    }


    $$(".progress-dot")
      .forEach(
        (dot, index) => {

          dot.classList.toggle(
            "is-active",
            index === state.current
          );

          dot.classList.toggle(
            "is-past",
            index < state.current
          );

        }
      );

  }


  /* ==========================================================
     08. SCENE TRANSITION
     ========================================================== */

  async function goToScene(
    target,
    options = {}
  ) {

    if (
      state.transitioning
    ) {
      return;
    }


    const scenes =
      state.scenes;


    if (!scenes.length) {
      return;
    }


    let targetIndex;


    /*
     * Number:
     *
     * goToScene(5)
     *
     * means scene number 5,
     * not array index 5.
     */

    if (
      typeof target === "number"
    ) {

      /*
       * If caller sends next array index,
       * it will be handled separately.
       */

      targetIndex =
        target >= 1
          ? target - 1
          : target;

    }


    /*
     * String.
     */

    else if (
      typeof target === "string"
    ) {

      const clean =
        target
          .replace("#", "")
          .trim();


      /*
       * "scene-07"
       */

      const exact =
        scenes.findIndex(
          scene =>
            scene.id === clean
        );


      if (exact !== -1) {

        targetIndex =
          exact;

      } else {

        const number =
          clean.match(
            /(\d+)/
          );


        if (number) {

          targetIndex =
            Number(
              number[1]
            ) - 1;

        }

      }

    }


    /*
     * Default.
     */

    if (
      typeof targetIndex !== "number" ||
      Number.isNaN(targetIndex)
    ) {

      return;

    }


    /*
     * Clamp.
     */

    targetIndex =
      Math.max(
        0,
        Math.min(
          targetIndex,
          scenes.length - 1
        )
      );


    /*
     * Nothing to do.
     */

    if (
      targetIndex ===
      state.current
    ) {

      return;

    }


    const oldScene =
      scenes[state.current];

    const newScene =
      scenes[targetIndex];


    if (!newScene) {
      return;
    }


    state.transitioning =
      true;


    const forward =
      targetIndex >
      state.current;


    document.body.dataset.direction =
      forward
        ? "forward"
        : "backward";


    /*
     * Prepare next.
     */

    newScene.classList.add(
      "scene-preparing"
    );


    /*
     * New scene must be visible
     * BEFORE animation begins.
     */

    newScene.style.display =
      "block";

    newScene.style.visibility =
      "visible";

    newScene.style.pointerEvents =
      "auto";


    await wait(
      reducedMotion()
        ? 0
        : 30
    );


    /*
     * Remove old scene.
     */

    if (oldScene) {

      oldScene.classList.remove(
        "is-active",
        "active",
        "current"
      );

      oldScene.classList.add(
        "scene-leaving"
      );

      oldScene.style.visibility =
        "hidden";

      oldScene.style.opacity =
        "0";

      oldScene.style.pointerEvents =
        "none";

      oldScene.setAttribute(
        "aria-hidden",
        "true"
      );

    }


    /*
     * Activate new scene.
     */

    state.current =
      targetIndex;


    newScene.classList.remove(
      "scene-preparing"
    );

    newScene.classList.add(
      "is-active",
      "active",
      "current"
    );

    newScene.classList.add(
      "scene-entering"
    );


    newScene.style.visibility =
      "visible";

    newScene.style.opacity =
      "1";

    newScene.style.pointerEvents =
      "auto";

    newScene.style.display =
      "block";


    newScene.removeAttribute(
      "aria-hidden"
    );


    resetSceneScroll(
      newScene
    );


    updateProgress();


    /*
     * Scene-specific initialization.
     */

    sceneEntered(
      newScene,
      state.current
    );


    await wait(
      reducedMotion()
        ? 0
        : CONFIG.transitionDuration
    );


    newScene.classList.remove(
      "scene-entering"
    );


    if (oldScene) {

      oldScene.classList.remove(
        "scene-leaving"
      );

    }


    state.transitioning =
      false;

  }


  /* ==========================================================
     09. NAVIGATION BUTTONS
     ========================================================== */

  function getNavigationTarget(
    button
  ) {

    if (!button) {
      return null;
    }


    if (
      button.dataset.nextScene
    ) {

      return button.dataset.nextScene;

    }


    if (
      button.dataset.scene
    ) {

      return button.dataset.scene;

    }


    if (
      button.dataset.go
    ) {

      return button.dataset.go;

    }


    if (
      button.dataset.target
    ) {

      return button.dataset.target;

    }


    return null;

  }


  function setupNavigation() {

    /*
     * Explicit navigation only.
     */

    $$(
      "[data-next-scene], [data-go], [data-scene-target]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.preventDefault();


            const target =
              getNavigationTarget(
                button
              );


            if (
              target === null
            ) {

              return;

            }


            /*
             * Music can begin from
             * an explicit user action.
             */

            if (
              button.hasAttribute(
                "data-music-gate"
              ) ||
              button.dataset.startMusic ===
                "true"
            ) {

              startMusic1();

            }


            goToScene(
              target
            );

          }
        );

      }
    );


    /*
     * Generic NEXT.
     */

    $$(
      ".next-btn, .next-button, .scene-next, .continue-btn"
    )
    .forEach(
      button => {

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


            if (
              state.current <
              state.scenes.length - 1
            ) {

              goToScene(
                state.current + 2
              );

            }

          }
        );

      }
    );


    /*
     * BACK.
     */

    $$(
      "[data-prev-scene], .prev-btn, .back-btn, .scene-prev"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.preventDefault();


            const explicit =
              button.dataset.prevScene;


            if (
              explicit
            ) {

              goToScene(
                explicit
              );

              return;

            }


            if (
              state.current > 0
            ) {

              goToScene(
                state.current
              );

            }

          }
        );

      }
    );

  }


  /* ==========================================================
     10. IMPORTANT:
         SCROLL IS NOT NAVIGATION
     ========================================================== */

  function setupScrollSafety() {

    /*
     * Intentionally empty.
     *
     * There is NO:
     *
     * wheel listener
     * scroll listener for navigation
     * touchmove navigation
     * swipe navigation
     *
     * This is intentional.
     */

    $$(".scene")
      .forEach(
        scene => {

          scene.addEventListener(
            "scroll",
            () => {

              scene.classList.add(
                "has-scrolled"
              );

            },
            {
              passive: true
            }
          );

        }
      );

  }


  /* ==========================================================
     11. HYDROPONICS
     ========================================================== */

  function setupHydroponics() {

    const detail =
      $("#hydroponics-detail");


    const toggles =
      $$(
        '[data-toggle-detail="hydroponics-detail"], [data-hydroponics-toggle]'
      );


    if (
      !detail ||
      !toggles.length
    ) {

      return;

    }


    detail.hidden = true;


    toggles.forEach(
      toggle => {

        toggle.setAttribute(
          "aria-expanded",
          "false"
        );


        toggle.addEventListener(
          "click",
          event => {

            event.preventDefault();


            state.hydroponicsOpen =
              !state.hydroponicsOpen;


            const open =
              state.hydroponicsOpen;


            detail.hidden =
              !open;


            detail.classList.toggle(
              "is-open",
              open
            );


            toggle.setAttribute(
              "aria-expanded",
              String(open)
            );

          }
        );

      }
    );

  }


  /* ==========================================================
     12. MEMORY TIMELINE
     ========================================================== */

  function setupTimeline() {

    const timeline =
      $("#memoryTimeline");


    if (!timeline) {
      return;
    }


    const cards =
      $$(
        "[data-memory]",
        timeline
      );


    cards.forEach(
      card => {

        card.setAttribute(
          "tabindex",
          "0"
        );


        card.addEventListener(
          "click",
          () => {

            activateMemory(
              card,
              timeline
            );

          }
        );


        card.addEventListener(
          "keydown",
          event => {

            if (
              event.key ===
                "Enter" ||
              event.key ===
                " "
            ) {

              event.preventDefault();


              activateMemory(
                card,
                timeline
              );

            }

          }
        );

      }
    );

  }


  function activateMemory(
    card,
    timeline
  ) {

    const cards =
      $$(
        "[data-memory]",
        timeline
      );


    cards.forEach(
      item => {

        const active =
          item === card;


        item.classList.toggle(
          "is-active",
          active
        );


        const targetId =
          item.dataset.memory;


        if (!targetId) {
          return;
        }


        const target =
          document.getElementById(
            targetId
          );


        if (!target) {
          return;
        }


        target.hidden =
          !active;


        target.classList.toggle(
          "is-active",
          active
        );

      }
    );

  }


  /* ==========================================================
     13. TYPING ENGINE
     ========================================================== */

  const typed =
    new WeakSet();


  async function typeElement(
    element
  ) {

    if (!element) {
      return;
    }


    if (
      typed.has(element)
    ) {

      return;

    }


    const original =
      element.dataset.originalText ||
      element.dataset.text ||
      element.textContent.trim();


    if (!original) {
      return;
    }


    element.dataset.originalText =
      original;


    /*
     * Reduced motion:
     * immediately reveal.
     */

    if (
      reducedMotion()
    ) {

      element.textContent =
        original;

      typed.add(element);

      return;

    }


    element.textContent = "";


    element.classList.add(
      "is-typing"
    );


    for (
      let i = 0;
      i < original.length;
      i++
    ) {

      element.textContent +=
        original[i];


      let delay =
        Number(
          element.dataset.typingSpeed
        ) ||
        CONFIG.typing.normal;


      if (
        ".!?".includes(
          original[i]
        )
      ) {

        delay += 180;

      }


      if (
        original[i] === ","
      ) {

        delay += 60;

      }


      if (
        original[i] === "\n"
      ) {

        delay += 300;

      }


      await wait(delay);

    }


    element.classList.remove(
      "is-typing"
    );


    element.classList.add(
      "is-typed"
    );


    typed.add(element);

  }


  function setupTyping() {

    /*
     * IMPORTANT:
     *
     * We only automatically type things that
     * explicitly ask to be typed.
     */

    $$(
      "[data-typing]"
    )
    .forEach(
      element => {

        element.dataset.originalText =
          element.dataset.text ||
          element.textContent.trim();

        /*
         * Preserve content until the
         * relevant scene appears.
         */

      }
    );

  }


  async function typeCurrentScene(
    scene
  ) {

    if (!scene) {
      return;
    }


    const elements =
      $$(
        "[data-typing]",
        scene
      );


    for (
      const element of elements
    ) {

      await typeElement(
        element
      );


      await wait(
        reducedMotion()
          ? 0
          : 160
      );

    }

  }


  /* ==========================================================
     14. LETTER
     ========================================================== */

  function startLetter() {

    if (
      state.letterStarted
    ) {

      return;

    }


    state.letterStarted =
      true;


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

      /*
       * If the HTML simply has normal paragraphs,
       * reveal them naturally rather than blanking them.
       */

      letter.classList.add(
        "letter-ready"
      );

      return;

    }


    (async () => {

      for (
        const part of parts
      ) {

        await typeElement(
          part
        );


        await wait(
          reducedMotion()
            ? 0
            : 230
        );

      }

    })();

  }


  /* ==========================================================
     15. PHOTO
     ========================================================== */

  function setupPhoto() {

    const stage =
      $("#photoStage");


    if (!stage) {
      return;
    }


    const image =
      stage.querySelector(
        "img"
      );


    if (image) {

      image.style.objectFit =
        "contain";

      image.style.maxWidth =
        "100%";

      image.style.height =
        "auto";


      const reveal =
        () => {

          stage.classList.add(
            "photo-ready"
          );


          requestAnimationFrame(
            () => {

              stage.classList.add(
                "photo-revealed"
              );

            }
          );

        };


      if (
        image.complete
      ) {

        reveal();

      } else {

        image.addEventListener(
          "load",
          reveal,
          {
            once: true
          }
        );

      }

    }

  }


  /* ==========================================================
     16. AUDIO
     ========================================================== */

  let music1 = null;
  let music2 = null;


  function setupAudio() {

    music1 =
      document.getElementById(
        "music1"
      );


    music2 =
      document.getElementById(
        "music2"
      );


    /*
     * If HTML audio elements don't exist,
     * create them safely.
     */

    if (!music1) {

      music1 =
        document.createElement(
          "audio"
        );

      music1.id =
        "music1";

      music1.preload =
        "auto";

      music1.src =
        CONFIG.music.primary;

      music1.setAttribute(
        "playsinline",
        ""
      );

      document.body.appendChild(
        music1
      );

    }


    if (!music2) {

      music2 =
        document.createElement(
          "audio"
        );

      music2.id =
        "music2";

      music2.preload =
        "auto";

      music2.src =
        CONFIG.music.secondary;

      music2.setAttribute(
        "playsinline",
        ""
      );

      document.body.appendChild(
        music2
      );

    }


    music1.preload =
      "auto";

    music2.preload =
      "auto";


    music1.volume = 0;

    music2.volume = 0;


    music1.addEventListener(
      "ended",
      () => {

        /*
         * Natural end of music 1 →
         * music 2.
         */

        startMusic2();

      }
    );


    /*
     * Audio errors should NEVER
     * break the website.
     */

    [music1, music2]
      .forEach(
        audio => {

          audio.addEventListener(
            "error",
            () => {

              console.warn(
                "[Bolu Ubi] Audio unavailable:",
                audio.src
              );

            }
          );

        }
      );

  }


  async function fade(
    audio,
    target,
    duration
  ) {

    if (!audio) {
      return;
    }


    if (
      reducedMotion()
    ) {

      audio.volume =
        target;

      return;

    }


    const start =
      audio.volume;


    const difference =
      target - start;


    const startTime =
      performance.now();


    return new Promise(
      resolve => {

        function frame(
          now
        ) {

          const progress =
            Math.min(
              1,
              (
                now -
                startTime
              ) /
              duration
            );


          const eased =
            progress *
            progress *
            (
              3 -
              2 *
              progress
            );


          audio.volume =
            start +
            difference *
            eased;


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

      }
    );

  }


  async function startMusic1() {

    if (
      !music1
    ) {

      return;

    }


    /*
     * Already playing.
     */

    if (
      !music1.paused
    ) {

      return;

    }


    try {

      music1.volume =
        0;


      await music1.play();


      state.musicStarted =
        true;


      await fade(
        music1,
        CONFIG.music.volume,
        CONFIG.music.fadeIn
      );


      document.body.classList.add(
        "music-playing"
      );


    } catch (error) {

      console.warn(
        "[Bolu Ubi] Music 1 could not start.",
        error
      );

    }

  }


  async function startMusic2() {

    if (
      !music2
    ) {

      return;

    }


    if (
      state.music2Started
    ) {

      return;

    }


    state.music2Started =
      true;


    /*
     * Music 1 exits gently.
     */

    if (
      music1 &&
      !music1.paused
    ) {

      await fade(
        music1,
        0,
        CONFIG.music.fadeOut
      );


      try {

        music1.pause();

      } catch (_) {}

    }


    try {

      music2.volume =
        0;


      await music2.play();


      await fade(
        music2,
        CONFIG.music.volume,
        CONFIG.music.fadeIn
      );


    } catch (error) {

      console.warn(
        "[Bolu Ubi] Music 2 could not start.",
        error
      );

    }

  }


  function setupMusicButtons() {

    $$(
      ".music-toggle, .audio-toggle"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.preventDefault();


            if (
              music1 &&
              !music1.paused
            ) {

              fade(
                music1,
                0,
                500
              )
              .then(
                () => {

                  music1.pause();

                }
              );

            }


            else if (
              music2 &&
              !music2.paused
            ) {

              fade(
                music2,
                0,
                500
              )
              .then(
                () => {

                  music2.pause();

                }
              );

            }


            else {

              if (
                state.music2Started
              ) {

                music2.play();

              } else {

                startMusic1();

              }

            }

          }
        );

      }
    );


    /*
     * Explicit music transition button.
     */

    $$(
      "[data-switch-music='2'], [data-music-transition='peak']"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.preventDefault();

            startMusic2();

          }
        );

      }
    );

  }


  /* ==========================================================
     17. CONFETTI
     ========================================================== */

  function createConfetti() {

    if (
      reducedMotion()
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


    layer.innerHTML =
      "";


    for (
      let i = 0;
      i < CONFIG.confetti.amount;
      i++
    ) {

      const piece =
        document.createElement(
          "span"
        );


      piece.className =
        "confetti-piece";


      piece.style.left =
        `${Math.random() * 100}%`;


      piece.style.animationDelay =
        `${Math.random() * 0.7}s`;


      piece.style.animationDuration =
        `${2.5 + Math.random() * 2}s`;


      piece.style.setProperty(
        "--drift",
        `${Math.random() * 180 - 90}px`
      );


      layer.appendChild(
        piece
      );

    }


    layer.classList.add(
      "is-active"
    );


    setTimeout(
      () => {

        layer.classList.remove(
          "is-active"
        );

      },
      5000
    );

  }


  /* ==========================================================
     18. SCENE-SPECIFIC BEHAVIOR
     ========================================================== */

  function sceneEntered(
    scene,
    index
  ) {

    if (!scene) {
      return;
    }


    document.body.dataset.scene =
      String(index + 1);


    /*
     * Scene 03
     */

    if (
      index === 2
    ) {

      scene.classList.add(
        "lore-awake"
      );

    }


    /*
     * Scene 04
     */

    if (
      index === 3
    ) {

      $$(
        ".fact-card, [data-fact]",
        scene
      )
      .forEach(
        (card, i) => {

          setTimeout(
            () => {

              card.classList.add(
                "fact-visible"
              );

            },
            reducedMotion()
              ? 0
              : i * 90
          );

        }
      );

    }


    /*
     * Scene 06
     */

    if (
      index === 5
    ) {

      setupPhoto();

    }


    /*
     * Scene 07
     */

    if (
      index === 6
    ) {

      scene.classList.add(
        "serious-mode"
      );

    }


    /*
     * Scene 08
     */

    if (
      index === 7
    ) {

      startLetter();

    }


    /*
     * Scene 09
     */

    if (
      index === 8
    ) {

      scene.classList.add(
        "quiet-mode"
      );

    }


    /*
     * Scene 10
     */

    if (
      index === 9
    ) {

      scene.classList.add(
        "final-mode"
      );


      if (
        !state.finalShown
      ) {

        state.finalShown =
          true;


        setTimeout(
          createConfetti,
          reducedMotion()
            ? 0
            : 500
        );

      }

    }


    /*
     * Explicit typing inside scene.
     */

    typeCurrentScene(
      scene
    );

  }


  /* ==========================================================
     19. KEYBOARD
     ========================================================== */

  function setupKeyboard() {

    document.addEventListener(
      "keydown",
      event => {

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
          event.key ===
            "ArrowRight"
        ) {

          event.preventDefault();


          if (
            state.current <
            state.scenes.length - 1
          ) {

            goToScene(
              state.current + 2
            );

          }

        }


        if (
          event.key ===
            "ArrowLeft"
        ) {

          event.preventDefault();


          if (
            state.current > 0
          ) {

            goToScene(
              state.current
            );

          }

        }

      }
    );

  }


  /* ==========================================================
     20. REPLAY
     ========================================================== */

  function setupReplay() {

    $$(
      "[data-replay], .replay-btn"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.preventDefault();


            state.current =
              0;

            state.letterStarted =
              false;

            state.music2Started =
              false;

            state.finalShown =
              false;


            if (music1) {

              music1.pause();

              music1.currentTime =
                0;

              music1.volume =
                0;

            }


            if (music2) {

              music2.pause();

              music2.currentTime =
                0;

              music2.volume =
                0;

            }


            forceInitialVisibility();

            updateProgress();

          }
        );

      }
    );

  }


  /* ==========================================================
     21. IMAGE SAFETY
     ========================================================== */

  function setupImageSafety() {

    $$("img")
      .forEach(
        image => {

          image.addEventListener(
            "error",
            () => {

              image.classList.add(
                "asset-error"
              );


              console.warn(
                "[Bolu Ubi] Image failed:",
                image.getAttribute(
                  "src"
                )
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
     22. VIEWPORT SAFETY
     ========================================================== */

  function setupViewport() {

    const setHeight =
      () => {

        document.documentElement
          .style
          .setProperty(
            "--app-height",
            `${window.innerHeight}px`
          );

      };


    setHeight();


    window.addEventListener(
      "resize",
      setHeight,
      {
        passive: true
      }
    );


    window.addEventListener(
      "orientationchange",
      () => {

        setTimeout(
          setHeight,
          250
        );

      },
      {
        passive: true
      }
    );

  }


  /* ==========================================================
     23. DEBUG PANEL
     ========================================================== */

  function exposeDebugAPI() {

    window.BoluUbi = {

      next: () => {

        if (
          state.current <
          state.scenes.length - 1
        ) {

          return goToScene(
            state.current + 2
          );

        }

      },


      previous: () => {

        if (
          state.current > 0
        ) {

          return goToScene(
            state.current
          );

        }

      },


      go: scene => {

        return goToScene(
          scene
        );

      },


      music: () => {

        return startMusic1();

      },


      music2: () => {

        return startMusic2();

      },


      state: () => ({
        ...state
      }),


      inspect: () => {

        console.table({

          scenes:
            state.scenes.length,

          current:
            state.current + 1,

          currentId:
            state.scenes[
              state.current
            ]?.id,

          music1:
            Boolean(music1),

          music2:
            Boolean(music2),

          letter:
            state.letterStarted,

          hydroponics:
            state.hydroponicsOpen

        });

      }

    };

  }


  /* ==========================================================
     24. INIT
     ========================================================== */

  function init() {

    console.log(
      "%c🐣 BOLU UBI — initializing...",
      "font-size:16px;font-weight:bold;"
    );


    /*
     * Discover FIRST.
     */

    discoverScenes();


    /*
     * Critical visibility repair.
     */

    forceInitialVisibility();


    /*
     * Core systems.
     */

    updateProgress();

    setupNavigation();

    setupScrollSafety();

    setupHydroponics();

    setupTimeline();

    setupTyping();

    setupPhoto();

    setupAudio();

    setupMusicButtons();

    setupKeyboard();

    setupReplay();

    setupImageSafety();

    setupViewport();

    exposeDebugAPI();


    document.documentElement.classList.add(
      "js-loaded"
    );


    document.body.classList.add(
      "app-initialized"
    );


    console.log(
      "%c✓ Scenes:",
      "font-weight:bold;",
      state.scenes.length
    );


    console.log(
      "%c✓ Current scene:",
      "font-weight:bold;",
      state.current + 1
    );


    console.log(
      "%c✓ Scroll navigation:",
      "font-weight:bold;",
      "DISABLED"
    );


    console.log(
      "%c✓ Music autoplay:",
      "font-weight:bold;",
      "DISABLED"
    );


    console.log(
      "%c✓ Bolu Ubi engine ready 🐣",
      "font-weight:bold;"
    );

  }


  /* ==========================================================
     25. START SAFELY
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