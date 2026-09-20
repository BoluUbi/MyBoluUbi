/* =========================================================
   BOLU UBI — EXPERIENCE ENGINE v2

   JS owns:
   - scene navigation + history
   - smooth touch / keyboard interaction
   - paced progressive reveals
   - photo readiness
   - local music (never autoplay)
   - final celebration
   - accessibility + reduced motion
   - defensive behavior on slow / small devices

   HTML owns the story.
   CSS owns the visual language.

   IMPORTANT:
   This version is deliberately conservative with animation.
   It avoids stacking JS animation with the CSS scene animation,
   which keeps the experience smooth on both phones and laptops.
   ========================================================= */

(() => {
    "use strict";


    /* =====================================================
       01. CONFIG
       ===================================================== */

    const CONFIG = Object.freeze({
        sceneSelector: ".scene",
        revealSelector: "[data-reveal], .reveal-item",
        nextSelector: "[data-next], .js-next, [data-action='next']",
        prevSelector: "[data-prev], .js-prev, [data-action='prev']",
        enterSelector: "[data-enter], .js-enter, [data-action='enter']",
        musicButtonSelector: "[data-music-toggle], .js-music-toggle",
        musicSelector: "audio.story-audio, audio",
        confettiSelector: "#confetti-container",

        /*
         * Scene changes are intentionally short.
         * The emotional pacing comes from the content reveal,
         * not a long page animation.
         */
        transitionOutMs: 220,

        /*
         * Progressive reveal timing.
         * Kept deliberately gentle so it doesn't feel like
         * a slideshow or presentation template.
         */
        revealBaseMs: 110,
        revealStepMs: 105,
        revealMaxDelayMs: 1050,

        /*
         * Swipe:
         * enough movement to feel intentional,
         * but still easy on a phone.
         */
        swipeDistance: 56,
        swipeRatio: 1.35,
        swipeMaxDuration: 850,

        /*
         * Wheel should never fire repeatedly from
         * one trackpad gesture.
         */
        wheelThreshold: 30,
        wheelLockMs: 720,

        /*
         * Restrained celebration.
         * This is not meant to become a party template.
         */
        confettiCount: 38,
        confettiLifetimeMs: 6800,

        storageKey: "bolu-ubi-progress-v2",
        hashPrefix: "scene-"
    });


    /* =====================================================
       02. STATE
       ===================================================== */

    const state = {
        scenes: [],
        currentIndex: 0,

        transitioning: false,
        transitionToken: 0,

        revealTimers: new Set(),

        wheelLocked: false,

        celebrationDone: false,

        touch: {
            x: 0,
            y: 0,
            time: 0,
            active: false
        },

        music: {
            audio: null,
            button: null
        },

        reducedMotion: false,
        motionMedia: null
    };


    /* =====================================================
       03. DOM HELPERS
       ===================================================== */

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    const clamp = (value, min, max) =>
        Math.min(Math.max(value, min), max);

    const nextFrame = () =>
        new Promise(resolve =>
            requestAnimationFrame(resolve)
        );

    const sleep = ms =>
        new Promise(resolve =>
            window.setTimeout(resolve, ms)
        );

    function reducedMotion() {
        return (
            state.reducedMotion ||
            document.documentElement.hasAttribute(
                "data-reduced-motion"
            )
        );
    }

    function isTypingTarget(
        element = document.activeElement
    ) {
        if (!element) return false;

        const tag = element.tagName;

        return (
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            tag === "SELECT" ||
            element.isContentEditable
        );
    }

    function matchesAny(element, selector) {
        return Boolean(
            element &&
            element.matches &&
            element.matches(selector)
        );
    }


    /* =====================================================
       04. SCENE DISCOVERY + ACCESSIBILITY
       ===================================================== */

    function collectScenes() {
        const experience = $("#experience");

        if (!experience) {
            console.warn(
                "[Bolu Ubi] #experience tidak ditemukan."
            );

            return [];
        }

        const scenes = $$(
            CONFIG.sceneSelector,
            experience
        );

        scenes.forEach((scene, index) => {
            scene.dataset.sceneIndex =
                String(index);

            if (!scene.dataset.scene) {
                scene.dataset.scene =
                    `${CONFIG.hashPrefix}${String(
                        index + 1
                    ).padStart(2, "0")}`;
            }

            const heading =
                scene.querySelector("h1, h2");

            if (heading && !heading.id) {
                heading.id =
                    `${scene.dataset.scene}-title`;
            }

            setSceneA11y(
                scene,
                scene.classList.contains("is-active")
            );
        });

        return scenes;
    }


    function setSceneA11y(scene, visible) {
        if (!scene) return;

        scene.setAttribute(
            "aria-hidden",
            String(!visible)
        );

        if (visible) {
            scene.removeAttribute("inert");
        } else {
            scene.setAttribute("inert", "");
        }
    }


    function updateTitle(scene) {
        if (!scene) return;

        const title =
            scene.dataset.title ||
            scene
                .querySelector("h1, h2")
                ?.textContent
                ?.trim();

        if (title) {
            document.title =
                `${title} · Bolu Ubi`;
        }
    }


    function focusSceneHeading(scene) {
        if (!scene || reducedMotion()) {
            return;
        }

        const heading =
            scene.querySelector("h1, h2");

        if (!heading) return;

        heading.setAttribute(
            "tabindex",
            "-1"
        );

        window.setTimeout(() => {
            if (
                state.scenes[state.currentIndex] !==
                scene
            ) {
                return;
            }

            try {
                heading.focus({
                    preventScroll: true
                });
            } catch {
                heading.focus();
            }
        }, 80);
    }


    /* =====================================================
       05. HASH / HISTORY
       ===================================================== */

    function sceneIndexFromHash() {
        const raw =
            window.location.hash
                .replace(/^#/, "")
                .trim();

        if (!raw) return 0;

        const exact =
            state.scenes.findIndex(
                scene =>
                    scene.dataset.scene === raw
            );

        if (exact >= 0) {
            return exact;
        }

        const match =
            raw.match(/(\d+)/);

        if (!match) return 0;

        const index =
            Number(match[1]) - 1;

        return (
            Number.isInteger(index) &&
            index >= 0 &&
            index < state.scenes.length
        )
            ? index
            : 0;
    }


    function writeHash(
        scene,
        replace = false
    ) {
        if (!scene) return;

        const hash =
            `#${scene.dataset.scene}`;

        if (
            window.location.hash === hash
        ) {
            return;
        }

        const method =
            replace
                ? "replaceState"
                : "pushState";

        history[method](
            {
                boluUbiScene:
                    state.currentIndex
            },
            "",
            hash
        );
    }


    /* =====================================================
       06. PROGRESS
       ===================================================== */

    function saveProgress() {
        try {
            localStorage.setItem(
                CONFIG.storageKey,
                JSON.stringify({
                    scene:
                        state.currentIndex,
                    savedAt:
                        Date.now()
                })
            );
        } catch {
            /*
             * Storage is optional.
             * Never break the story because
             * localStorage is unavailable.
             */
        }
    }


    /* =====================================================
       07. PROGRESSIVE REVEAL
       ===================================================== */

    function getRevealItems(scene) {
        if (!scene) return [];

        return $$(
            CONFIG.revealSelector,
            scene
        );
    }


    function clearRevealTimers() {
        state.revealTimers.forEach(
            timer => {
                window.clearTimeout(timer);
            }
        );

        state.revealTimers.clear();
    }


    function prepareRevealItems(scene) {
        const items =
            getRevealItems(scene);

        items.forEach(item => {
            item.classList.remove(
                "is-revealed"
            );
        });
    }


    function revealScene(scene) {
        clearRevealTimers();

        const items =
            getRevealItems(scene);

        if (!items.length) {
            return;
        }

        /*
         * IMPORTANT:
         *
         * Do NOT add .is-entering here.
         *
         * style.css already has a separate
         * .reveal-item transition.
         *
         * Running both animations simultaneously
         * creates unnecessary work and makes the
         * reveal feel less intentional.
         */

        if (reducedMotion()) {
            items.forEach(item => {
                item.classList.add(
                    "is-revealed"
                );
            });

            return;
        }

        items.forEach((item, index) => {
            const delay =
                Math.min(
                    CONFIG.revealBaseMs +
                        index *
                            CONFIG.revealStepMs,
                    CONFIG.revealMaxDelayMs
                );

            const timer =
                window.setTimeout(() => {
                    item.classList.add(
                        "is-revealed"
                    );

                    state.revealTimers.delete(
                        timer
                    );
                }, delay);

            state.revealTimers.add(timer);
        });
    }


    function prepareAndReveal(scene) {
        prepareRevealItems(scene);
        revealScene(scene);
    }


    /* =====================================================
       08. SCENE TRANSITION
       ===================================================== */

    async function transitionTo(
        index,
        options = {}
    ) {
        if (!state.scenes.length) {
            return;
        }

        const targetIndex =
            clamp(
                Number(index) || 0,
                0,
                state.scenes.length - 1
            );

        const current =
            state.scenes[state.currentIndex];

        const target =
            state.scenes[targetIndex];

        if (!target) return;

        /*
         * Same-scene navigation is ignored.
         */
        if (
            targetIndex ===
                state.currentIndex &&
            target.classList.contains(
                "is-active"
            )
        ) {
            return;
        }

        /*
         * Prevent double-taps / repeated
         * trackpad events from creating
         * overlapping transitions.
         */
        if (state.transitioning) {
            return;
        }

        state.transitioning = true;

        const token =
            ++state.transitionToken;

        clearRevealTimers();

        if (current) {
            current.classList.add(
                "is-leaving"
            );
        }

        if (!reducedMotion()) {
            await sleep(
                CONFIG.transitionOutMs
            );
        }

        /*
         * Safety check.
         */
        if (
            token !==
            state.transitionToken
        ) {
            state.transitioning =
                false;
            return;
        }

        if (current) {
            current.classList.remove(
                "is-active",
                "is-leaving"
            );

            setSceneA11y(
                current,
                false
            );
        }

        state.currentIndex =
            targetIndex;

        target.classList.remove(
            "is-leaving"
        );

        target.classList.add(
            "is-active"
        );

        setSceneA11y(
            target,
            true
        );

        /*
         * Let display:block paint before
         * starting the reveal sequence.
         */
        await nextFrame();

        if (
            token !==
            state.transitionToken
        ) {
            state.transitioning =
                false;
            return;
        }

        updateTitle(target);

        prepareAndReveal(target);

        updateNavigationState();

        if (!options.skipHash) {
            writeHash(
                target,
                Boolean(
                    options.replaceHash
                )
            );
        }

        saveProgress();

        state.transitioning =
            false;

        focusSceneHeading(target);

        /*
         * Only the final scene gets confetti.
         */
        if (
            targetIndex ===
            state.scenes.length - 1
        ) {
            triggerFinalCelebration(
                target
            );
        }
    }


    /* =====================================================
       09. NAVIGATION ACTIONS
       ===================================================== */

    function nextScene() {
        if (
            state.currentIndex <
            state.scenes.length - 1
        ) {
            transitionTo(
                state.currentIndex + 1
            );
        }
    }


    function previousScene() {
        if (
            state.currentIndex > 0
        ) {
            transitionTo(
                state.currentIndex - 1
            );
        }
    }


    function enterStory() {
        /*
         * Scene 01 is the entrance.
         *
         * "tap to enter ♡"
         * MUST move to Scene 02.
         */
        if (
            state.currentIndex === 0
        ) {
            nextScene();
            return;
        }

        transitionTo(1);
    }


    function goToSceneNumber(number) {
        const index =
            Number(number) - 1;

        if (
            !Number.isInteger(index)
        ) {
            return;
        }

        if (
            index < 0 ||
            index >= state.scenes.length
        ) {
            return;
        }

        transitionTo(index);
    }


    function updateNavigationState() {
        const last =
            state.scenes.length - 1;

        $$(CONFIG.nextSelector)
            .forEach(button => {
                const scene =
                    button.closest(
                        CONFIG.sceneSelector
                    );

                const belongsToCurrentScene =
                    !scene ||
                    scene ===
                        state.scenes[
                            state.currentIndex
                        ];

                const disabled =
                    state.currentIndex >=
                        last &&
                    belongsToCurrentScene;

                button.disabled =
                    disabled;

                button.setAttribute(
                    "aria-disabled",
                    String(disabled)
                );
            });


        $$(CONFIG.prevSelector)
            .forEach(button => {
                const scene =
                    button.closest(
                        CONFIG.sceneSelector
                    );

                const belongsToCurrentScene =
                    !scene ||
                    scene ===
                        state.scenes[
                            state.currentIndex
                        ];

                const disabled =
                    state.currentIndex <=
                        0 &&
                    belongsToCurrentScene;

                button.disabled =
                    disabled;

                button.setAttribute(
                    "aria-disabled",
                    String(disabled)
                );
            });
    }


    /* =====================================================
       10. CLICK / KEYBOARD CONTROLS
       ===================================================== */

    function bindClickControls() {
        document.addEventListener(
            "click",
            event => {
                const target =
                    event.target.closest(
                        [
                            CONFIG.nextSelector,
                            CONFIG.prevSelector,
                            CONFIG.enterSelector
                        ].join(",")
                    );

                if (!target) return;


                if (
                    matchesAny(
                        target,
                        CONFIG.enterSelector
                    )
                ) {
                    event.preventDefault();
                    enterStory();
                    return;
                }


                if (
                    matchesAny(
                        target,
                        CONFIG.nextSelector
                    )
                ) {
                    event.preventDefault();
                    nextScene();
                    return;
                }


                if (
                    matchesAny(
                        target,
                        CONFIG.prevSelector
                    )
                ) {
                    event.preventDefault();
                    previousScene();
                }
            }
        );


        /*
         * Support Enter / Space on custom
         * non-button controls.
         */
        document.addEventListener(
            "keydown",
            event => {
                if (!event.target) {
                    return;
                }

                const target =
                    event.target.closest?.(
                        [
                            CONFIG.nextSelector,
                            CONFIG.prevSelector,
                            CONFIG.enterSelector
                        ].join(",")
                    );

                if (!target) return;

                if (
                    event.key !== "Enter" &&
                    event.key !== " "
                ) {
                    return;
                }

                event.preventDefault();

                target.click();
            }
        );
    }


    function bindKeyboardNavigation() {
        document.addEventListener(
            "keydown",
            event => {
                if (isTypingTarget()) {
                    return;
                }

                if (state.transitioning) {
                    return;
                }

                switch (event.key) {
                    case "ArrowRight":
                    case "PageDown":
                        event.preventDefault();
                        nextScene();
                        break;

                    case "ArrowLeft":
                    case "PageUp":
                        event.preventDefault();
                        previousScene();
                        break;

                    case "Home":
                        event.preventDefault();
                        transitionTo(0);
                        break;

                    case "End":
                        event.preventDefault();
                        transitionTo(
                            state.scenes.length - 1
                        );
                        break;

                    default:
                        break;
                }
            }
        );
    }


    /* =====================================================
       11. TOUCH / SWIPE
       ===================================================== */

    function bindSwipeNavigation() {
        document.addEventListener(
            "touchstart",
            event => {
                if (
                    event.touches.length !==
                    1
                ) {
                    return;
                }

                const touch =
                    event.touches[0];

                state.touch.x =
                    touch.clientX;

                state.touch.y =
                    touch.clientY;

                state.touch.time =
                    performance.now();

                state.touch.active =
                    true;
            },
            {
                passive: true
            }
        );


        document.addEventListener(
            "touchend",
            event => {
                if (!state.touch.active) {
                    return;
                }

                state.touch.active =
                    false;

                if (
                    state.transitioning
                ) {
                    return;
                }

                const touch =
                    event.changedTouches[0];

                if (!touch) return;

                const dx =
                    touch.clientX -
                    state.touch.x;

                const dy =
                    touch.clientY -
                    state.touch.y;

                const elapsed =
                    performance.now() -
                    state.touch.time;

                /*
                 * A swipe is only horizontal
                 * when it is clearly more horizontal
                 * than vertical.
                 *
                 * This prevents accidental scene
                 * changes while scrolling the letter.
                 */
                const horizontal =
                    Math.abs(dx) >=
                        CONFIG.swipeDistance &&
                    Math.abs(dx) >
                        Math.abs(dy) *
                            CONFIG.swipeRatio;

                if (
                    !horizontal ||
                    elapsed >
                        CONFIG.swipeMaxDuration
                ) {
                    return;
                }

                if (dx < 0) {
                    nextScene();
                } else {
                    previousScene();
                }
            },
            {
                passive: true
            }
        );
    }


    /* =====================================================
       12. DESKTOP WHEEL
       ===================================================== */

    function bindWheelNavigation() {
        document.addEventListener(
            "wheel",
            event => {
                /*
                 * Desktop only.
                 * Touch devices keep native scrolling.
                 */
                if (window.innerWidth < 800) {
                    return;
                }

                if (
                    state.transitioning ||
                    state.wheelLocked
                ) {
                    return;
                }

                if (
                    Math.abs(event.deltaY) <
                    CONFIG.wheelThreshold
                ) {
                    return;
                }

                const scene =
                    state.scenes[
                        state.currentIndex
                    ];

                if (!scene) return;

                /*
                 * IMPORTANT:
                 *
                 * Long scenes, especially Scene 08,
                 * must remain scrollable.
                 *
                 * We only turn the wheel into
                 * scene navigation when the user
                 * has reached the corresponding edge.
                 */
                const maxScroll =
                    Math.max(
                        0,
                        scene.scrollHeight -
                            scene.clientHeight
                    );

                const atTop =
                    scene.scrollTop <= 2;

                const atBottom =
                    scene.scrollTop >=
                    maxScroll - 2;

                const movingDown =
                    event.deltaY > 0;

                const canChangeScene =
                    movingDown
                        ? atBottom
                        : atTop;

                /*
                 * If there is still content to read,
                 * let the browser handle normal scrolling.
                 */
                if (
                    maxScroll > 8 &&
                    !canChangeScene
                ) {
                    return;
                }

                event.preventDefault();

                state.wheelLocked =
                    true;

                if (movingDown) {
                    nextScene();
                } else {
                    previousScene();
                }

                window.setTimeout(() => {
                    state.wheelLocked =
                        false;
                }, CONFIG.wheelLockMs);
            },
            {
                passive: false
            }
        );
    }


    /* =====================================================
       13. HISTORY
       ===================================================== */

    function bindHistory() {
        const handleHistory = () => {
            const index =
                sceneIndexFromHash();

            if (
                index !==
                state.currentIndex
            ) {
                transitionTo(
                    index,
                    {
                        skipHash: true
                    }
                );
            }
        };

        window.addEventListener(
            "popstate",
            handleHistory
        );

        window.addEventListener(
            "hashchange",
            handleHistory
        );
    }


    /* =====================================================
       14. PHOTO READINESS
       ===================================================== */

    function initializePhoto() {
        const scene =
            $(
                "[data-scene='scene-06'], .scene-photo"
            );

        const image =
            scene?.querySelector("img");

        if (!image) return;

        image.classList.add(
            "photo-ready"
        );

        const markReady = () => {
            scene.dataset.photoReady =
                "true";
        };

        if (image.complete) {
            markReady();
        } else {
            image.addEventListener(
                "load",
                markReady,
                { once: true }
            );

            image.addEventListener(
                "error",
                markReady,
                { once: true }
            );
        }

        /*
         * decode() prevents the visual reveal
         * from racing the image decoding process.
         */
        if (
            typeof image.decode ===
                "function" &&
            !image.complete
        ) {
            image
                .decode()
                .then(markReady)
                .catch(() => {});
        }
    }


    /* =====================================================
       15. MUSIC
       ===================================================== */

    function initializeMusic() {
        const audio =
            $(CONFIG.musicSelector);

        if (!audio) return;

        state.music.audio =
            audio;

        /*
         * Autoplay is explicitly disabled.
         */
        audio.autoplay = false;

        audio.preload =
            "metadata";

        const button =
            $(CONFIG.musicButtonSelector);

        state.music.button =
            button;

        if (button) {
            updateMusicButton();

            button.addEventListener(
                "click",
                toggleMusic
            );
        }

        [
            "play",
            "pause",
            "ended",
            "loadedmetadata"
        ].forEach(eventName => {
            audio.addEventListener(
                eventName,
                updateMusicButton,
                {
                    passive: true
                }
            );
        });

        audio.addEventListener(
            "error",
            () => {
                if (!button) return;

                button.disabled = true;

                button.setAttribute(
                    "aria-disabled",
                    "true"
                );

                const label =
                    button.querySelector(
                        "[data-music-label]"
                    );

                if (label) {
                    label.textContent =
                        "music unavailable";
                }
            }
        );
    }


    function updateMusicButton() {
        const {
            audio,
            button
        } = state.music;

        if (!audio || !button) {
            return;
        }

        const playing =
            !audio.paused &&
            !audio.ended;

        const label =
            playing
                ? (
                    button.dataset
                        .pauseLabel ||
                    "pause"
                )
                : (
                    button.dataset
                        .playLabel ||
                    "play"
                );

        button.classList.toggle(
            "is-playing",
            playing
        );

        button.setAttribute(
            "aria-pressed",
            String(playing)
        );

        button.setAttribute(
            "aria-label",
            label
        );

        const labelTarget =
            button.querySelector(
                "[data-music-label]"
            );

        if (labelTarget) {
            labelTarget.textContent =
                label;
        }
    }


    async function toggleMusic() {
        const audio =
            state.music.audio;

        if (!audio) return;

        try {
            if (audio.paused) {
                await audio.play();
            } else {
                audio.pause();
            }
        } catch (error) {
            console.warn(
                "[Bolu Ubi] Musik tidak dapat diputar.",
                error
            );
        }

        updateMusicButton();
    }


    /* =====================================================
       16. FINAL CELEBRATION
       ===================================================== */

    function triggerFinalCelebration(
        scene
    ) {
        const container =
            $(
                CONFIG.confettiSelector,
                scene
            ) ||
            $(
                CONFIG.confettiSelector
            );

        if (!container) return;

        if (state.celebrationDone) {
            return;
        }

        state.celebrationDone =
            true;

        container.dataset.celebrated =
            "true";

        if (reducedMotion()) {
            return;
        }

        createConfetti(container);
    }


    function createConfetti(
        container
    ) {
        const fragment =
            document.createDocumentFragment();

        const count =
            clamp(
                CONFIG.confettiCount,
                0,
                70
            );

        for (
            let index = 0;
            index < count;
            index += 1
        ) {
            const piece =
                document.createElement(
                    "span"
                );

            piece.className =
                "confetti-piece";

            piece.style.left =
                `${Math.random() * 100}%`;

            piece.style.setProperty(
                "--fall-duration",
                `${3.2 + Math.random() * 2.4}s`
            );

            piece.style.setProperty(
                "--fall-delay",
                `${Math.random() * 0.65}s`
            );

            piece.style.setProperty(
                "--drift",
                `${-70 + Math.random() * 140}px`
            );

            fragment.appendChild(
                piece
            );
        }

        container.appendChild(
            fragment
        );

        /*
         * Remove confetti afterward so it doesn't
         * remain in the DOM forever.
         */
        window.setTimeout(() => {
            $$(
                ".confetti-piece",
                container
            ).forEach(piece => {
                piece.remove();
            });
        }, CONFIG.confettiLifetimeMs);
    }


    /* =====================================================
       17. REDUCED MOTION
       ===================================================== */

    function bindMotionPreference() {
        if (!window.matchMedia) {
            return;
        }

        const media =
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            );

        state.motionMedia =
            media;

        state.reducedMotion =
            media.matches;

        const update =
            event => {
                state.reducedMotion =
                    event.matches;

                if (
                    event.matches &&
                    state.scenes[
                        state.currentIndex
                    ]
                ) {
                    clearRevealTimers();

                    getRevealItems(
                        state.scenes[
                            state.currentIndex
                        ]
                    ).forEach(item => {
                        item.classList.add(
                            "is-revealed"
                        );
                    });
                }
            };

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


    /* =====================================================
       18. VIEWPORT SAFETY
       ===================================================== */

    function bindViewportSafety() {
        let resizeTimer =
            null;

        window.addEventListener(
            "resize",
            () => {
                window.clearTimeout(
                    resizeTimer
                );

                resizeTimer =
                    window.setTimeout(
                        () => {
                            updateNavigationState();
                        },
                        120
                    );
            },
            {
                passive: true
            }
        );
    }


    /* =====================================================
       19. INITIAL STATE
       ===================================================== */

    async function setInitialState() {
        if (!state.scenes.length) {
            return;
        }

        const index =
            clamp(
                sceneIndexFromHash(),
                0,
                state.scenes.length - 1
            );

        state.currentIndex =
            index;

        state.scenes.forEach(
            (
                scene,
                sceneIndex
            ) => {
                const active =
                    sceneIndex === index;

                scene.classList.remove(
                    "is-entering",
                    "is-leaving"
                );

                scene.classList.toggle(
                    "is-active",
                    active
                );

                setSceneA11y(
                    scene,
                    active
                );

                if (!active) {
                    prepareRevealItems(
                        scene
                    );
                }
            }
        );

        const current =
            state.scenes[index];

        updateTitle(current);

        prepareAndReveal(
            current
        );

        updateNavigationState();

        /*
         * Normalize the URL without creating
         * a history entry on first load.
         */
        writeHash(
            current,
            true
        );

        if (
            index ===
            state.scenes.length - 1
        ) {
            triggerFinalCelebration(
                current
            );
        }
    }


    /* =====================================================
       20. DEBUG API
       ===================================================== */

    function exposeDebugAPI() {
        window.BoluUbi = {
            next: nextScene,

            prev: previousScene,

            go: goToSceneNumber,

            getState() {
                return {
                    currentScene:
                        state.currentIndex + 1,

                    totalScenes:
                        state.scenes.length,

                    transitioning:
                        state.transitioning,

                    reducedMotion:
                        reducedMotion(),

                    musicPlaying:
                        Boolean(
                            state.music.audio &&
                            !state.music.audio.paused
                        )
                };
            }
        };
    }


    /* =====================================================
       21. INIT
       ===================================================== */

    function makeCustomControlsAccessible() {
        $$(
            [
                CONFIG.nextSelector,
                CONFIG.prevSelector,
                CONFIG.enterSelector
            ].join(",")
        ).forEach(element => {
            if (
                element.tagName !==
                    "BUTTON" &&
                element.tagName !==
                    "A" &&
                !element.hasAttribute(
                    "tabindex"
                )
            ) {
                element.setAttribute(
                    "tabindex",
                    "0"
                );
            }
        });
    }


    async function init() {
        state.scenes =
            collectScenes();

        if (!state.scenes.length) {
            return;
        }

        bindMotionPreference();

        bindClickControls();

        bindKeyboardNavigation();

        bindSwipeNavigation();

        bindWheelNavigation();

        bindHistory();

        bindViewportSafety();

        initializePhoto();

        initializeMusic();

        makeCustomControlsAccessible();

        await setInitialState();

        exposeDebugAPI();

        console.info(
            `[Bolu Ubi] Experience ready — ` +
            `${state.scenes.length} scenes.`
        );
    }


    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );
    } else {
        init();
    }

})();