/* ============================================================
   BOLU UBI 🐣
   Birthday Experience — Interaction & Emotional Engine

   Vanilla JavaScript only.
   No framework.
   No external dependency.

   DESIGN PRINCIPLE:
   The website should feel like a small emotional journey,
   not like a collection of web pages.

   CURVE:

   curiosity
       ↓
   playful teasing
       ↓
   personal memories
       ↓
   quiet observation
       ↓
   photo / emotional pause
       ↓
   sincerity
       ↓
   "you are loved"
       ↓
   warm playful celebration
============================================================ */


/* ============================================================
   01. PROJECT CONFIG
============================================================ */

const BOLU_UBI = {

    birthday: "2026-09-20",

    /*
     * We deliberately do NOT autoplay audio.
     *
     * The music becomes available only after the user reaches
     * the serious / letter portion of the experience.
     */

    music: {
        selector: ".music-box audio",
        playButtonSelector:
            ".music-box button, [data-music-play]",
        pauseButtonSelector:
            ".music-box [data-music-pause]"
    },

    transition: {
        exitDuration: 520,
        enterDuration: 900
    },

    /*
     * Small pause between scene changes.
     *
     * This is intentional.
     * Immediate scene switching feels like a normal website.
     * A tiny pause makes it feel like a story.
     */

    pacing: {
        scenePause: 120,
        letterPause: 520,
        photoPause: 700,
        finalPause: 900
    },

    /*
     * The scene order is deliberately explicit.
     *
     * If the HTML order changes later, the class names still
     * keep the emotional architecture intact.
     */

    sceneOrder: [
        ".scene-entrance",
        ".scene-birthday",
        ".scene-lore",
        ".scene-things-i-like",
        ".scene-i-know-you",
        ".scene-photo",
        ".scene-serious",
        ".scene-heart",
        ".scene-final"
    ]
};


/* ============================================================
   02. DOM HELPERS
============================================================ */

const $ = (selector, parent = document) =>
    parent.querySelector(selector);


const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];


const wait = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));


const clamp = (value, min, max) =>
    Math.min(Math.max(value, min), max);


const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;


/* ============================================================
   03. EXPERIENCE STATE
============================================================ */

const state = {
    scenes: [],
    currentIndex: 0,

    isTransitioning: false,

    hasEntered: false,

    musicUnlocked: false,
    musicPlaying: false,

    userHasInteracted: false,

    finalCelebrationTriggered: false,

    /*
     * Used to prevent a scene from replaying its choreography
     * every time it is visited.
     */
    animatedScenes: new Set(),

    /*
     * Used for browser history.
     */
    historyEnabled: true
};


/* ============================================================
   04. INITIALIZE
============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    initExperience();

});


function initExperience() {

    collectScenes();

    if (!state.scenes.length) {
        console.warn(
            "Bolu Ubi: No .scene elements were found."
        );

        return;
    }

    prepareScenes();

    prepareButtons();

    prepareSceneSpecificInteractions();

    prepareMusic();

    prepareKeyboardNavigation();

    prepareTouchPolish();

    prepareImagePolish();

    prepareFinalScene();

    /*
     * The first scene is deliberately quiet.
     *
     * We do not reveal everything immediately.
     */
    showInitialScene();

}


/* ============================================================
   05. COLLECT SCENES
============================================================ */

function collectScenes() {

    const explicitScenes = BOLU_UBI.sceneOrder
        .map(selector => $(selector))
        .filter(Boolean);

    /*
     * If the HTML has all expected classes,
     * use the intentional storyboard order.
     *
     * If not, gracefully fall back to DOM order.
     */
    const domScenes = $$(".scene");

    if (explicitScenes.length === domScenes.length) {
        state.scenes = explicitScenes;
    } else {
        state.scenes = domScenes;
    }

}


/* ============================================================
   06. PREPARE SCENES
============================================================ */

function prepareScenes() {

    state.scenes.forEach((scene, index) => {

        scene.dataset.sceneIndex = String(index);

        scene.setAttribute(
            "aria-hidden",
            index === 0 ? "false" : "true"
        );

        /*
         * The existing CSS hides scenes after the first one.
         *
         * We override that inline when the JS engine takes control.
         */
        if (index === 0) {

            scene.style.display = "flex";

            scene.style.opacity = "1";

            scene.style.visibility = "visible";

            scene.style.pointerEvents = "auto";

        } else {

            scene.style.display = "none";

            scene.style.opacity = "0";

            scene.style.visibility = "hidden";

            scene.style.pointerEvents = "none";

        }

        /*
         * Give interactive elements accessible labels if
         * the HTML has not supplied them.
         */
        improveAccessibility(scene);

    });

}


/* ============================================================
   07. INITIAL SCENE
============================================================ */

function showInitialScene() {

    const firstScene = state.scenes[0];

    if (!firstScene) return;

    /*
     * We allow CSS animations from the stylesheet to do their
     * initial work.
     */

    requestAnimationFrame(() => {

        firstScene.classList.add("is-active");

    });

}


/* ============================================================
   08. BUTTON SYSTEM
============================================================ */

function prepareButtons() {

    /*
     * Any button with:
     *
     * data-next
     *
     * goes to the next scene.
     *
     * Example:
     *
     * <button data-next>tap to enter ♡</button>
     */

    $$("[data-next]").forEach(button => {

        button.addEventListener("click", () => {

            markInteraction();

            const currentScene =
                button.closest(".scene");

            const currentIndex =
                currentScene
                    ? Number(currentScene.dataset.sceneIndex)
                    : state.currentIndex;

            goToScene(currentIndex + 1);

        });

    });


    /*
     * data-prev
     *
     * Optional previous button.
     */

    $$("[data-prev]").forEach(button => {

        button.addEventListener("click", () => {

            markInteraction();

            const currentScene =
                button.closest(".scene");

            const currentIndex =
                currentScene
                    ? Number(currentScene.dataset.sceneIndex)
                    : state.currentIndex;

            goToScene(currentIndex - 1);

        });

    });


    /*
     * Fallback:
     *
     * If the HTML has not yet been given data-next,
     * the primary .scene-button inside a scene is treated
     * as a next button.
     *
     * This makes the JS forgiving while the HTML evolves.
     */

    state.scenes.forEach((scene, index) => {

        const button =
            $(".scene-button", scene);

        if (!button) return;

        /*
         * If this button already has explicit behavior,
         * don't override it.
         */
        if (
            button.hasAttribute("data-next") ||
            button.hasAttribute("data-prev") ||
            button.dataset.action
        ) {
            return;
        }

        /*
         * We assume the button is a progression button.
         */
        button.addEventListener("click", () => {

            markInteraction();

            goToScene(index + 1);

        });

    });

}


/* ============================================================
   09. SCENE NAVIGATION
============================================================ */

async function goToScene(targetIndex, options = {}) {

    const {
        replaceHistory = false,
        fromPopState = false
    } = options;


    if (state.isTransitioning) {
        return;
    }


    if (
        targetIndex < 0 ||
        targetIndex >= state.scenes.length
    ) {
        return;
    }


    if (targetIndex === state.currentIndex) {
        return;
    }


    const fromScene =
        state.scenes[state.currentIndex];

    const toScene =
        state.scenes[targetIndex];


    if (!fromScene || !toScene) {
        return;
    }


    state.isTransitioning = true;


    /*
     * First: tiny breathing pause.
     *
     * This prevents the interaction from feeling mechanically
     * instantaneous.
     */
    if (!prefersReducedMotion) {
        await wait(BOLU_UBI.pacing.scenePause);
    }


    /*
     * Exit current scene.
     */
    await animateSceneOut(fromScene);


    /*
     * Hide old scene completely before showing new one.
     */
    deactivateScene(fromScene);


    /*
     * Prepare new scene.
     */
    activateScene(toScene);


    /*
     * Let browser paint before animation.
     */
    await nextFrame();


    /*
     * Enter new scene.
     */
    await animateSceneIn(toScene);


    state.currentIndex = targetIndex;

    state.isTransitioning = false;


    /*
     * Browser history:
     *
     * Back/forward can work naturally without causing
     * duplicate entries when popstate itself triggered
     * the navigation.
     */
    if (
        state.historyEnabled &&
        !fromPopState
    ) {

        const url =
            new URL(window.location.href);

        url.hash =
            `scene-${targetIndex + 1}`;

        if (replaceHistory) {

            history.replaceState(
                {
                    boluUbiScene: targetIndex
                },
                "",
                url
            );

        } else {

            history.pushState(
                {
                    boluUbiScene: targetIndex
                },
                "",
                url
            );

        }

    }


    /*
     * Scene-specific behavior happens AFTER the scene
     * becomes visible.
     */
    await runSceneChoreography(
        toScene,
        targetIndex
    );

}


/* ============================================================
   10. SCENE ANIMATION
============================================================ */

async function animateSceneOut(scene) {

    if (prefersReducedMotion) {

        scene.style.opacity = "0";

        return;

    }


    /*
     * Web Animations API keeps transitions self-contained
     * and avoids adding more CSS just for scene movement.
     */

    const animation =
        scene.animate(
            [
                {
                    opacity: 1,
                    transform: "translateY(0) scale(1)"
                },
                {
                    opacity: 0,
                    transform: "translateY(-10px) scale(0.992)"
                }
            ],
            {
                duration:
                    BOLU_UBI.transition.exitDuration,

                easing:
                    "cubic-bezier(0.22, 1, 0.36, 1)",

                fill: "forwards"
            }
        );


    try {
        await animation.finished;
    } catch (_) {
        /*
         * Animation cancellation should never break
         * the website.
         */
    }


    scene.style.opacity = "0";

}


/* ============================================================
   11. SCENE ACTIVATION
============================================================ */

function activateScene(scene) {

    scene.style.display = "flex";

    scene.style.visibility = "visible";

    scene.style.pointerEvents = "auto";

    scene.style.opacity = "0";

    scene.setAttribute(
        "aria-hidden",
        "false"
    );

    scene.classList.add("is-active");

}


function deactivateScene(scene) {

    scene.style.display = "none";

    scene.style.visibility = "hidden";

    scene.style.pointerEvents = "none";

    scene.style.opacity = "0";

    scene.classList.remove("is-active");

    scene.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* ============================================================
   12. SCENE ENTER ANIMATION
============================================================ */

async function animateSceneIn(scene) {

    if (prefersReducedMotion) {

        scene.style.opacity = "1";

        return;

    }


    const animation =
        scene.animate(
            [
                {
                    opacity: 0,
                    transform: "translateY(18px) scale(0.992)"
                },
                {
                    opacity: 1,
                    transform: "translateY(0) scale(1)"
                }
            ],
            {
                duration:
                    BOLU_UBI.transition.enterDuration,

                easing:
                    "cubic-bezier(0.16, 1, 0.3, 1)",

                fill: "forwards"
            }
        );


    try {
        await animation.finished;
    } catch (_) {
        /*
         * Ignore cancelled animations.
         */
    }


    scene.style.opacity = "1";

}


/* ============================================================
   13. SCENE CHOREOGRAPHY
============================================================ */

async function runSceneChoreography(
    scene,
    index
) {

    /*
     * A scene is only choreographed once.
     *
     * If Tata navigates backward and returns,
     * we don't force her to watch the entire animation again.
     */

    if (state.animatedScenes.has(index)) {

        /*
         * Still perform small scene-specific actions
         * where necessary.
         */
        if (
            scene.classList.contains("scene-serious")
        ) {
            unlockMusic();
        }

        if (
            scene.classList.contains("scene-final")
        ) {
            triggerFinalCelebration();
        }

        return;
    }


    state.animatedScenes.add(index);


    /*
     * Scene-specific emotional pacing.
     */

    if (
        scene.classList.contains("scene-entrance")
    ) {

        choreographEntrance(scene);

    }


    else if (
        scene.classList.contains("scene-birthday")
    ) {

        await choreographBirthday(scene);

    }


    else if (
        scene.classList.contains("scene-lore")
    ) {

        await choreographLore(scene);

    }


    else if (
        scene.classList.contains("scene-things-i-like")
    ) {

        await choreographTraits(scene);

    }


    else if (
        scene.classList.contains("scene-i-know-you")
    ) {

        await choreographFacts(scene);

    }


    else if (
        scene.classList.contains("scene-photo")
    ) {

        await choreographPhoto(scene);

    }


    else if (
        scene.classList.contains("scene-serious")
    ) {

        await choreographSerious(scene);

        unlockMusic();

    }


    else if (
        scene.classList.contains("scene-heart")
    ) {

        await choreographHeart(scene);

    }


    else if (
        scene.classList.contains("scene-final")
    ) {

        await choreographFinal(scene);

        triggerFinalCelebration();

    }

}


/* ============================================================
   14. ENTRANCE
============================================================ */

function choreographEntrance(scene) {

    /*
     * The first scene already has CSS animation.
     *
     * We add a tiny floating motion to the final button
     * only after the intro has settled.
     */

    const button =
        $(".scene-button", scene);

    if (!button || prefersReducedMotion) {
        return;
    }


    setTimeout(() => {

        button.animate(
            [
                {
                    transform:
                        "translateY(0)"
                },
                {
                    transform:
                        "translateY(-3px)"
                },
                {
                    transform:
                        "translateY(0)"
                }
            ],
            {
                duration: 2600,
                iterations: 2,
                easing:
                    "ease-in-out"
            }
        );

    }, 1800);

}


/* ============================================================
   15. BIRTHDAY SCENE
============================================================ */

async function choreographBirthday(scene) {

    const number =
        $(".big-number", scene);

    const greeting =
        $(".birthday-greeting", scene);

    const note =
        $(".teasing-note", scene);


    /*
     * The big "18" gets its own reveal.
     */
    if (number) {

        revealElement(
            number,
            {
                delay: 100,
                duration: 1000,
                fromY: 28,
                fromScale: 0.94
            }
        );

    }


    await wait(
        prefersReducedMotion
            ? 0
            : 380
    );


    if (greeting) {

        revealElement(
            greeting,
            {
                delay: 0,
                duration: 850,
                fromY: 18
            }
        );

    }


    await wait(
        prefersReducedMotion
            ? 0
            : 500
    );


    if (note) {

        revealElement(
            note,
            {
                delay: 0,
                duration: 900,
                fromY: 15
            }
        );

    }

}


/* ============================================================
   16. LORE / TIMELINE
============================================================ */

async function choreographLore(scene) {

    /*
     * The Bible intentionally describes the relationship as
     * something that gradually happened, not one magical scene.
     *
     * Therefore the cards reveal sequentially.
     */

    const cards =
        $$(".memory-card", scene);

    for (
        let i = 0;
        i < cards.length;
        i++
    ) {

        revealElement(
            cards[i],
            {
                delay: 0,
                duration: 750,
                fromY: 22,
                fromScale: 0.985
            }
        );


        if (!prefersReducedMotion) {

            await wait(
                i === cards.length - 1
                    ? 220
                    : 360
            );

        }

    }


    const quiet =
        $(".quiet-line", scene);

    if (quiet) {

        await wait(
            prefersReducedMotion
                ? 0
                : 380
        );

        revealElement(
            quiet,
            {
                duration: 1100,
                fromY: 18
            }
        );

    }

}


/* ============================================================
   17. THINGS I LIKE
============================================================ */

async function choreographTraits(scene) {

    const cards =
        $$(".trait-card", scene);

    /*
     * One at a time.
     *
     * This is important.
     *
     * If all six traits appear immediately,
     * it becomes a list.
     *
     * If they appear one by one,
     * it feels like observation.
     */

    for (
        let i = 0;
        i < cards.length;
        i++
    ) {

        revealElement(
            cards[i],
            {
                duration: 650,
                fromX:
                    i % 2 === 0
                        ? -12
                        : 12,
                fromY: 8
            }
        );


        if (!prefersReducedMotion) {

            await wait(260);

        }

    }


    const ending =
        $(".trait-ending", scene);

    if (ending) {

        await wait(
            prefersReducedMotion
                ? 0
                : 500
        );

        revealElement(
            ending,
            {
                duration: 1000,
                fromY: 18
            }
        );

    }

}


/* ============================================================
   18. PERSONAL FACTS
============================================================ */

async function choreographFacts(scene) {

    const cards =
        $$(".fact-card", scene);

    /*
     * Slightly faster than the traits.
     *
     * These are "oh, he remembers that" moments,
     * not the emotional climax yet.
     */

    for (
        let i = 0;
        i < cards.length;
        i++
    ) {

        revealElement(
            cards[i],
            {
                duration: 620,
                fromY: 16,
                fromScale: 0.98
            }
        );


        if (!prefersReducedMotion) {

            await wait(170);

        }

    }


    /*
     * Give the hydroponics card a subtle emphasis
     * because it represents their CURRENT shared life.
     */

    const wideCard =
        $(".fact-card-wide", scene);

    if (
        wideCard &&
        !prefersReducedMotion
    ) {

        await wait(500);

        subtlePulse(wideCard);

    }

}


/* ============================================================
   19. PHOTO REVEAL
============================================================ */

async function choreographPhoto(scene) {

    const intro =
        $(".photo-intro", scene);

    const figure =
        $(".birthday-photo", scene);


    /*
     * IMPORTANT:
     *
     * The photo is not thrown at the user immediately.
     *
     * We first create a quiet beat.
     */

    if (intro) {

        revealElement(
            intro,
            {
                duration: 1100,
                fromY: 14
            }
        );

    }


    await wait(
        prefersReducedMotion
            ? 0
            : BOLU_UBI.pacing.photoPause
    );


    if (figure) {

        revealElement(
            figure,
            {
                duration: 1400,
                fromY: 10,
                fromScale: 0.985
            }
        );

    }


    /*
     * Caption follows the photo.
     */

    const caption =
        figure
            ? $("figcaption", figure)
            : null;


    if (caption) {

        await wait(
            prefersReducedMotion
                ? 0
                : 650
        );

        revealElement(
            caption,
            {
                duration: 1000,
                fromY: 12
            }
        );

    }

}


/* ============================================================
   20. SERIOUS SECTION
============================================================ */

async function choreographSerious(scene) {

    /*
     * This is the largest tonal pivot.
     *
     * The JS intentionally slows down here.
     */

    const intro =
        $(".serious-intro", scene);

    if (intro) {

        revealElement(
            intro,
            {
                duration: 1200,
                fromY: 22
            }
        );

    }


    await wait(
        prefersReducedMotion
            ? 0
            : 700
    );


    /*
     * Music comes after the emotional doorway,
     * not before it.
     */

    const musicBox =
        $(".music-box", scene);

    if (musicBox) {

        revealElement(
            musicBox,
            {
                duration: 1000,
                fromY: 18,
                fromScale: 0.99
            }
        );

    }


    await wait(
        prefersReducedMotion
            ? 0
            : 550
    );


    /*
     * Letter paragraphs reveal progressively.
     *
     * This is NOT a typewriter effect.
     *
     * Typewriter can feel like a website.
     *
     * Soft paragraph reveal feels more like reading a message.
     */

    const letter =
        $(".birthday-letter", scene);

    if (letter) {

        const paragraphs =
            $$("p", letter);

        for (
            let i = 0;
            i < paragraphs.length;
            i++
        ) {

            revealElement(
                paragraphs[i],
                {
                    duration: 850,
                    fromY: 12
                }
            );


            if (!prefersReducedMotion) {

                await wait(
                    paragraphs[i]
                        .classList
                        .contains("chaotic-line")
                        ? 180
                        : 330
                );

            }

        }

    }

}


/* ============================================================
   21. MUSIC ENGINE
============================================================ */

function prepareMusic() {

    const audio =
        $(BOLU_UBI.music.selector);

    if (!audio) {
        return;
    }


    /*
     * NEVER autoplay.
     */

    audio.autoplay = false;

    audio.removeAttribute("autoplay");


    /*
     * Start muted in state only.
     *
     * We do not force mute attribute because the user should
     * be able to control volume normally.
     */

    audio.addEventListener(
        "play",
        () => {

            state.musicPlaying = true;

            updateMusicUI(true);

        }
    );


    audio.addEventListener(
        "pause",
        () => {

            state.musicPlaying = false;

            updateMusicUI(false);

        }
    );


    audio.addEventListener(
        "ended",
        () => {

            state.musicPlaying = false;

            updateMusicUI(false);

        }
    );


    audio.addEventListener(
        "error",
        () => {

            console.warn(
                "Bolu Ubi: music file could not be loaded."
            );

            disableBrokenMusicUI();

        }
    );


    /*
     * Explicit custom controls, if they exist.
     */

    $$(
        BOLU_UBI.music.playButtonSelector
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                markInteraction();

                playMusic();

            }
        );

    });


    $$(
        BOLU_UBI.music.pauseButtonSelector
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                markInteraction();

                pauseMusic();

            }
        );

    });


    /*
     * If there is only the native audio element,
     * the browser's own controls handle playback.
     */

}


function unlockMusic() {

    if (state.musicUnlocked) {
        return;
    }

    state.musicUnlocked = true;


    const musicBox =
        $(".music-box");

    if (!musicBox) {
        return;
    }


    musicBox.classList.add(
        "music-unlocked"
    );


    /*
     * Tiny visual nudge.
     *
     * We don't automatically play.
     */

    if (!prefersReducedMotion) {

        musicBox.animate(
            [
                {
                    transform:
                        "translateY(0)"
                },
                {
                    transform:
                        "translateY(-4px)"
                },
                {
                    transform:
                        "translateY(0)"
                }
            ],
            {
                duration: 1000,
                easing:
                    "cubic-bezier(0.22, 1, 0.36, 1)"
            }
        );

    }

}


async function playMusic() {

    const audio =
        $(BOLU_UBI.music.selector);

    if (!audio) {
        return;
    }


    /*
     * Explicitly require user interaction.
     */
    if (!state.userHasInteracted) {
        return;
    }


    try {

        await audio.play();

    } catch (error) {

        console.warn(
            "Bolu Ubi: playback was blocked.",
            error
        );

        showMusicFallback();

    }

}


function pauseMusic() {

    const audio =
        $(BOLU_UBI.music.selector);

    if (!audio) {
        return;
    }

    audio.pause();

}


function updateMusicUI(isPlaying) {

    const musicBox =
        $(".music-box");

    if (!musicBox) {
        return;
    }


    musicBox.dataset.playing =
        isPlaying ? "true" : "false";


    $$(
        "[data-music-label]",
        musicBox
    ).forEach(label => {

        label.textContent =
            isPlaying
                ? "playing..."
                : "🎧 put this on while you read";

    });

}


function disableBrokenMusicUI() {

    const musicBox =
        $(".music-box");

    if (!musicBox) {
        return;
    }


    musicBox.classList.add(
        "music-unavailable"
    );


    const message =
        $("[data-music-error]", musicBox);


    if (message) {

        message.hidden = false;

        message.textContent =
            "music-nya belum dipasang — lanjut baca dulu yaa.";

    }

}


function showMusicFallback() {

    const message =
        $("[data-music-error]");

    if (!message) {
        return;
    }


    message.hidden = false;

    message.textContent =
        "tap play sekali lagi kalau browser-nya masih malu-malu 🐣";

}


/* ============================================================
   22. HEART / EMOTIONAL PEAK
============================================================ */

async function choreographHeart(scene) {

    /*
     * The heart section must feel slower than everything
     * before it.
     */

    const message =
        $(".heart-message", scene);

    if (!message) {
        return;
    }


    const paragraphs =
        $$("p", message);


    for (
        let i = 0;
        i < paragraphs.length;
        i++
    ) {

        revealElement(
            paragraphs[i],
            {
                duration: 1100,
                fromY: 14
            }
        );


        if (!prefersReducedMotion) {

            await wait(
                650
            );

        }

    }


    /*
     * "You are loved" is deliberately treated separately.
     */

    const bigLine =
        $(".big-emotional-line", scene);


    if (bigLine) {

        await wait(
            prefersReducedMotion
                ? 0
                : 900
        );


        revealElement(
            bigLine,
            {
                duration: 1500,
                fromY: 20,
                fromScale: 0.96
            }
        );


        if (!prefersReducedMotion) {

            await wait(400);

            gentleEmotionalPulse(
                bigLine
            );

        }

    }


    const support =
        $(".support-line", scene);


    if (support) {

        await wait(
            prefersReducedMotion
                ? 0
                : 700
        );

        revealElement(
            support,
            {
                duration: 1000,
                fromY: 10
            }
        );

    }


    const signature =
        $(".signature", scene);


    if (signature) {

        await wait(
            prefersReducedMotion
                ? 0
                : 650
        );

        revealElement(
            signature,
            {
                duration: 1000,
                fromY: 10
            }
        );

    }

}


/* ============================================================
   23. FINAL SCENE
============================================================ */

async function choreographFinal(scene) {

    /*
     * The ending should NOT feel like the emotional peak
     * suddenly disappeared.
     *
     * It should feel like someone smiling through tears.
     */

    const small =
        $(".final-small", scene);

    const title =
        $(".final-title", scene);

    const name =
        $(".final-name", scene);

    const badge =
        $(".age-unlocked", scene);

    const wishes =
        $(".final-wishes", scene);

    const playful =
        $(".playful-final-line", scene);

    const kopken =
        $(".kopken-note", scene);

    const signOff =
        $(".final-sign-off", scene);


    const sequence = [
        small,
        title,
        name,
        badge,
        wishes,
        playful,
        kopken,
        signOff
    ].filter(Boolean);


    for (
        let i = 0;
        i < sequence.length;
        i++
    ) {

        revealElement(
            sequence[i],
            {
                duration:
                    i === 1
                        ? 1300
                        : 850,

                fromY:
                    i === 1
                        ? 24
                        : 14,

                fromScale:
                    i === 1
                        ? 0.96
                        : 0.99
            }
        );


        if (!prefersReducedMotion) {

            await wait(
                i === 1
                    ? 500
                    : 320
            );

        }

    }

}


/* ============================================================
   24. FINAL CELEBRATION
============================================================ */

function triggerFinalCelebration() {

    if (
        state.finalCelebrationTriggered
    ) {
        return;
    }


    state.finalCelebrationTriggered =
        true;


    /*
     * Reduced-motion users still receive the celebration
     * through the visual content itself, without particle
     * animation.
     */

    if (prefersReducedMotion) {
        return;
    }


    setTimeout(() => {

        createConfettiBurst();

    }, BOLU_UBI.pacing.finalPause);

}


/* ============================================================
   25. RESTRAINED CONFETTI
============================================================ */

function createConfettiBurst() {

    const finalScene =
        $(".scene-final");

    if (!finalScene) {
        return;
    }


    /*
     * We create only a small number of pieces.
     *
     * This is deliberately NOT a party-template effect.
     */

    const count =
        window.innerWidth < 600
            ? 22
            : 34;


    const fragment =
        document.createDocumentFragment();


    for (
        let i = 0;
        i < count;
        i++
    ) {

        const piece =
            document.createElement("span");


        piece.setAttribute(
            "aria-hidden",
            "true"
        );


        const size =
            4 + Math.random() * 5;


        const x =
            Math.random() * 100;


        const drift =
            (Math.random() - 0.5) * 180;


        const duration =
            2.8 + Math.random() * 2.2;


        const delay =
            Math.random() * 0.8;


        /*
         * Use existing design tokens when possible.
         *
         * The JS does not introduce a rainbow palette.
         */

        const colors = [
            "var(--blush)",
            "var(--brown)",
            "var(--sage)",
            "var(--cream-0)"
        ];


        piece.style.position =
            "absolute";

        piece.style.left =
            `${x}%`;

        piece.style.top =
            "-10px";

        piece.style.width =
            `${size}px`;

        piece.style.height =
            `${size * 1.6}px`;

        piece.style.borderRadius =
            "3px";

        piece.style.background =
            colors[
                i % colors.length
            ];

        piece.style.opacity =
            String(
                0.45 +
                Math.random() * 0.45
            );

        piece.style.pointerEvents =
            "none";

        piece.style.zIndex =
            "20";


        const animation =
            piece.animate(
                [
                    {
                        transform:
                            `translate3d(0, -10px, 0) rotate(0deg)`,

                        opacity: 0
                    },

                    {
                        transform:
                            `translate3d(${drift * 0.25}px, 35vh, 0) rotate(${120 + Math.random() * 180}deg)`,

                        opacity: 1
                    },

                    {
                        transform:
                            `translate3d(${drift}px, 105vh, 0) rotate(${360 + Math.random() * 360}deg)`,

                        opacity: 0
                    }
                ],
                {
                    duration:
                        duration * 1000,

                    delay:
                        delay * 1000,

                    easing:
                        "cubic-bezier(0.22, 1, 0.36, 1)",

                    fill: "forwards"
                }
            );


        /*
         * Remove each piece after its animation.
         */

        animation.finished
            .then(() => {

                piece.remove();

            })
            .catch(() => {

                piece.remove();

            });


        fragment.appendChild(piece);

    }


    finalScene.appendChild(fragment);

}


/* ============================================================
   26. GENERIC REVEAL ENGINE
============================================================ */

function revealElement(
    element,
    options = {}
) {

    if (!element) {
        return;
    }


    const {
        delay = 0,
        duration = 800,
        fromX = 0,
        fromY = 18,
        fromScale = 0.985
    } = options;


    /*
     * Make sure repeated choreography doesn't stack
     * invisible styles.
     */

    element.style.willChange =
        "transform, opacity";


    if (prefersReducedMotion) {

        element.style.opacity =
            "1";

        element.style.transform =
            "none";

        return;

    }


    const animation =
        element.animate(
            [
                {
                    opacity: 0,

                    transform:
                        `translate3d(${fromX}px, ${fromY}px, 0) scale(${fromScale})`
                },

                {
                    opacity: 1,

                    transform:
                        "translate3d(0, 0, 0) scale(1)"
                }
            ],
            {
                duration,

                delay,

                easing:
                    "cubic-bezier(0.16, 1, 0.3, 1)",

                fill: "forwards"
            }
        );


    animation.finished
        .then(() => {

            element.style.opacity =
                "1";

            element.style.transform =
                "none";

            element.style.willChange =
                "auto";

        })
        .catch(() => {

            element.style.opacity =
                "1";

            element.style.transform =
                "none";

        });

}


/* ============================================================
   27. SUBTLE PULSE
============================================================ */

function subtlePulse(element) {

    if (
        !element ||
        prefersReducedMotion
    ) {
        return;
    }


    element.animate(
        [
            {
                transform:
                    "translateY(0)"
            },

            {
                transform:
                    "translateY(-3px)"
            },

            {
                transform:
                    "translateY(0)"
            }
        ],
        {
            duration: 1200,
            easing:
                "cubic-bezier(0.22, 1, 0.36, 1)"
        }
    );

}


/* ============================================================
   28. EMOTIONAL PULSE
============================================================ */

function gentleEmotionalPulse(element) {

    if (
        !element ||
        prefersReducedMotion
    ) {
        return;
    }


    element.animate(
        [
            {
                opacity: 1,
                transform:
                    "scale(1)"
            },

            {
                opacity: 0.88,
                transform:
                    "scale(1.015)"
            },

            {
                opacity: 1,
                transform:
                    "scale(1)"
            }
        ],
        {
            duration: 1700,

            easing:
                "cubic-bezier(0.16, 1, 0.3, 1)"
        }
    );

}


/* ============================================================
   29. ACCESSIBILITY
============================================================ */

function improveAccessibility(scene) {

    /*
     * Scene itself behaves like a region.
     */

    if (!scene.hasAttribute("role")) {

        scene.setAttribute(
            "role",
            "region"
        );

    }


    /*
     * Buttons should have an accessible name.
     */

    $$("button", scene).forEach(button => {

        const visibleText =
            button.textContent.trim();


        if (
            visibleText &&
            !button.getAttribute("aria-label")
        ) {

            button.setAttribute(
                "aria-label",
                visibleText
            );

        }

    });


    /*
     * Decorative emoji / visual-only elements can be marked
     * aria-hidden manually in HTML, but we don't blindly
     * hide all emoji because some are meaningful in the text.
     */

}


/* ============================================================
   30. KEYBOARD NAVIGATION
============================================================ */

function prepareKeyboardNavigation() {

    document.addEventListener(
        "keydown",
        event => {

            /*
             * Don't hijack keyboard controls while the user
             * is typing inside an input/textarea.
             */

            const target =
                event.target;


            if (
                target &&
                (
                    target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.isContentEditable
                )
            ) {
                return;
            }


            if (
                event.key === "ArrowRight" ||
                event.key === "Enter"
            ) {

                /*
                 * Enter is only navigation if focus isn't
                 * already on a button.
                 */

                if (
                    event.key === "Enter" &&
                    target &&
                    target.tagName === "BUTTON"
                ) {
                    return;
                }


                markInteraction();


                goToScene(
                    state.currentIndex + 1
                );

            }


            if (
                event.key === "ArrowLeft"
            ) {

                markInteraction();


                goToScene(
                    state.currentIndex - 1
                );

            }

        }
    );

}


/* ============================================================
   31. BROWSER HISTORY
============================================================ */

window.addEventListener(
    "popstate",
    event => {

        const sceneIndex =
            event.state &&
            typeof event.state.boluUbiScene === "number"
                ? event.state.boluUbiScene
                : getSceneFromHash();


        if (
            typeof sceneIndex !== "number" ||
            sceneIndex < 0 ||
            sceneIndex >= state.scenes.length
        ) {
            return;
        }


        goToScene(
            sceneIndex,
            {
                fromPopState: true
            }
        );

    }
);


function getSceneFromHash() {

    const hash =
        window.location.hash;


    const match =
        hash.match(
            /^#scene-(\d+)$/
        );


    if (!match) {
        return 0;
    }


    return (
        parseInt(match[1], 10) - 1
    );

}


/* ============================================================
   32. TOUCH POLISH
============================================================ */

function prepareTouchPolish() {

    /*
     * Add a tiny pressed state without requiring hover.
     */

    $$(
        "button, .scene-button"
    ).forEach(element => {

        element.addEventListener(
            "pointerdown",
            () => {

                element.dataset.pressed =
                    "true";

            }
        );


        const release = () => {

            delete element.dataset.pressed;

        };


        element.addEventListener(
            "pointerup",
            release
        );


        element.addEventListener(
            "pointercancel",
            release
        );


        element.addEventListener(
            "pointerleave",
            release
        );

    });

}


/* ============================================================
   33. IMAGE POLISH
============================================================ */

function prepareImagePolish() {

    const image =
        $(".birthday-photo img");

    if (!image) {
        return;
    }


    /*
     * We deliberately don't add aggressive filters.
     *
     * The photo should remain itself.
     */

    image.addEventListener(
        "load",
        () => {

            image.classList.add(
                "is-loaded"
            );

        }
    );


    /*
     * If the image is already cached.
     */

    if (image.complete) {

        image.classList.add(
            "is-loaded"
        );

    }

}


/* ============================================================
   34. MARK USER INTERACTION
============================================================ */

function markInteraction() {

    state.userHasInteracted =
        true;


    if (!state.hasEntered) {

        state.hasEntered =
            true;

    }

}


/* ============================================================
   35. NEXT FRAME
============================================================ */

function nextFrame() {

    return new Promise(resolve => {

        requestAnimationFrame(() => {

            requestAnimationFrame(resolve);

        });

    });

}


/* ============================================================
   36. SERIOUS SECTION — SMART MUSIC BUTTON
============================================================ */

/*
 * If the HTML only has a normal button with class
 * .scene-button inside the music box, we don't want the global
 * scene navigation handler to treat it as "next scene".
 *
 * So this function can be called safely after DOM initialization.
 */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const musicBox =
            $(".music-box");

        if (!musicBox) {
            return;
        }


        const musicButtons =
            $$("button", musicBox);


        musicButtons.forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    markInteraction();

                    if (state.musicPlaying) {

                        pauseMusic();

                    } else {

                        playMusic();

                    }

                }
            );

        });

    }
);


/* ============================================================
   37. SMART FALLBACK FOR SIMPLE HTML
============================================================ */

/*
 * The HTML may initially be very simple.
 *
 * If a scene doesn't have data-next,
 * this engine can still progress through .scene-button.
 *
 * This keeps the project forgiving while we iterate.
 */

function prepareSimpleNavigation() {

    state.scenes.forEach(
        (scene, index) => {

            const buttons =
                $$(
                    ".scene-button",
                    scene
                );


            buttons.forEach(button => {

                if (
                    button.closest(".music-box")
                ) {
                    return;
                }


                if (
                    button.dataset.boundNavigation
                ) {
                    return;
                }


                button.dataset.boundNavigation =
                    "true";


                button.addEventListener(
                    "click",
                    () => {

                        markInteraction();

                        goToScene(
                            index + 1
                        );

                    }
                );

            });

        }
    );

}


/* ============================================================
   38. RUN SIMPLE NAVIGATION
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /*
         * Run after all other initial listeners have been
         * registered.
         */
        setTimeout(
            prepareSimpleNavigation,
            0
        );

    }
);


/* ============================================================
   39. OPTIONAL DATA-REVEAL SYSTEM
============================================================ */

/*
 * This allows future HTML additions such as:
 *
 * <span data-reveal>...</span>
 *
 * without rewriting the JS.
 *
 * It is intentionally opt-in.
 */

function prepareDataReveals() {

    $$("[data-reveal]").forEach(
        element => {

            const delay =
                Number(
                    element.dataset.revealDelay || 0
                );


            /*
             * Only animate elements when they belong
             * to an active scene.
             */

            element.dataset.revealReady =
                "true";


            if (
                element.closest(".scene") ===
                state.scenes[state.currentIndex]
            ) {

                setTimeout(
                    () => {

                        revealElement(
                            element,
                            {
                                duration: 800,
                                fromY: 15
                            }
                        );

                    },
                    delay
                );

            }

        }
    );

}


document.addEventListener(
    "DOMContentLoaded",
    () => {

        prepareDataReveals();

    }
);


/* ============================================================
   40. PAGE VISIBILITY / AUDIO SAFETY
============================================================ */

document.addEventListener(
    "visibilitychange",
    () => {

        const audio =
            $(BOLU_UBI.music.selector);

        if (!audio) {
            return;
        }


        /*
         * Don't unexpectedly continue blasting music when
         * Tata leaves the browser/app.
         */

        if (
            document.hidden &&
            !audio.paused
        ) {

            audio.pause();

        }

    }
);


/* ============================================================
   41. RESIZE SAFETY
============================================================ */

let resizeTimer = null;


window.addEventListener(
    "resize",
    () => {

        clearTimeout(resizeTimer);


        resizeTimer =
            setTimeout(
                () => {

                    /*
                     * No layout calculations are forced here.
                     *
                     * This listener exists only to ensure that
                     * future responsive logic has a safe place
                     * to live without creating a resize storm.
                     */

                },
                150
            );

    },
    {
        passive: true
    }
);


/* ============================================================
   42. DEBUG MODE
============================================================ */

/*
 * To debug locally, add:
 *
 * ?debug=true
 *
 * to the URL.
 *
 * This does NOT affect the actual experience.
 */

const DEBUG =
    new URLSearchParams(
        window.location.search
    ).get("debug") === "true";


if (DEBUG) {

    window.BOLU_UBI_DEBUG = {

        state,

        config: BOLU_UBI,

        goToScene,

        playMusic,

        pauseMusic,

        triggerFinalCelebration

    };

    console.info(
        "Bolu Ubi debug mode enabled.",
        window.BOLU_UBI_DEBUG
    );

}


/* ============================================================
   43. FINAL INITIALIZATION MARKER
============================================================ */

document.documentElement.dataset.boluUbi =
    "ready";