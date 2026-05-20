/* ================================================================
   YUI MASCOT ASSISTANT — assistant.js
   Vanilla JS floating mascot for DanSpikes (GitHub Pages).
   No React, no npm, no bundler. Works in all modern browsers.

   HOW THIS FILE WORKS:
   ─────────────────────────────────────────────────────────────────
   1. Loads ./assistant/assistant-assets.json (the manifest):
        - emotionToAsset  → which WebP file to display per emotion
        - sourceAsset     → PNG fallback paths (used only if WebP
                            fails to load — see onerror handler)
        - triggerMap      → emotion / position / animation / timing
                            per behavior trigger
        - animations      → maps animation names to CSS classes
        - positions       → maps position names to CSS classes
        - fallbacks       → defaults for missing values
        - behaviorLimits  → cooldown, session, typing, motion rules

   2. Loads ./assistant/dialogue.json for per-trigger text lines.

   3. Builds the mascot DOM overlay (fixed, pointer-events: none).

   4. Attaches behavior trigger detectors (scroll, idle, tab, etc.)
      and fires the appropriate emotion/dialogue combination.

   PNG FALLBACK:
   ─────────────────────────────────────────────────────────────────
   Production uses .webp files from /assistant/.
   If a .webp fails to load (e.g. not yet converted), the img
   onerror handler logs a console warning and loads the .png
   from /assistant/source/ instead.
   Once .webp files exist, fallback never fires.

   TO REPLACE ASSETS:
     Drop new .webp files into /assistant/ with the same names.
     Paths are built as: basePath + emotionToAsset[emotion]

   TO ADD A NEW TRIGGER:
     1. Add an entry to triggerMap{} in assistant-assets.json.
     2. Add dialogue lines to dialogue.json.
     3. Wire up a detector in the attachTriggers() section below.

   TO ADD A NEW EMOTION / POSITION / ANIMATION:
     1. Add CSS in assistant.css.
     2. Add the entry in assistant-assets.json.
     3. Reference it from triggerMap or assets[emotion].
   ================================================================ */

(function () {
  'use strict';

  /* ── Paths ── */
  var MANIFEST_URL = './assistant/assistant-assets.json';
  var DIALOGUE_URL = './assistant/dialogue.json';

  /* ── SessionStorage key: prevents re-showing after user closes ── */
  var SESSION_KEY = 'yui_mascot_closed_v1';

  /* ── Loaded data ── */
  var manifest = null;
  var dialogue  = null;

  /* ── DOM references (set in buildDOM) ── */
  var elOverlay       = null;
  var elContainer     = null;
  var elImg           = null;
  var elDialogue      = null;
  var elDialogueText  = null;

  /* ── Runtime state ── */
  var state = {
    closed:           false,
    visible:          false,
    currentEmotion:   'idle',
    appearanceCount:  0,
    isTyping:         false,
    hideTimer:        null,  /* displayMs countdown */
    hideOverlayTimer: null,  /* 360ms slide-away delay */
    lastGlobalMs:     0,
    lastTriggerMs:    {},    /* triggerName -> timestamp */
    nearTarget:       null,  /* element to position near */
  };

  /* ── Background-removal cache (emotion → data URL) ── */
  var bgCache = {};

  /* ── Scroll tracking (for fast-scroll + bottom detection) ── */
  var scroll = { lastY: 0, lastMs: 0 };

  /* ── Repeated-click tracking ── */
  var clicks = { el: null, count: 0, timer: null };

  /* ── Idle tracking ── */
  var idle = {
    lastActivity: Date.now(),
    timer30: null, fired30: false,
    timer60: null, fired60: false,
  };

  /* ── Long-reading tracking ── */
  var reading = { timer: null, lastScrollY: 0 };


  /* ================================================================
     INIT
     ================================================================ */

  function init() {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;

    Promise.all([
      fetch(MANIFEST_URL).then(function (r) { return r.json(); }),
      fetch(DIALOGUE_URL).then(function (r) { return r.json(); }),
    ]).then(function (data) {
      manifest = data[0];
      dialogue = data[1];
      buildDOM();
      attachTriggers();
      /* Fire page_enter after a 1.4s delay so the page settles first */
      setTimeout(function () { fireTrigger('page_enter'); }, 1400);
    }).catch(function (err) {
      console.warn('[Yui] Could not load mascot manifest or dialogue:', err);
    });
  }


  /* ================================================================
     DOM CONSTRUCTION
     ================================================================ */

  function buildDOM() {
    /* Overlay — full viewport, passes all pointer events through */
    elOverlay = document.createElement('div');
    elOverlay.id = 'yui-mascot-overlay';
    elOverlay.className = 'mascot-overlay mascot-hidden';
    elOverlay.setAttribute('aria-hidden', 'true');

    /* Container — positioned by mascot-position-* classes */
    elContainer = document.createElement('div');
    elContainer.className = 'mascot-container mascot-position-bottom-right';
    elContainer.setAttribute('data-mascot-container', '');

    /* Speech bubble */
    elDialogue = document.createElement('div');
    elDialogue.className = 'mascot-dialogue';
    elDialogue.setAttribute('data-mascot-dialogue', '');

    elDialogueText = document.createElement('p');
    elDialogueText.className = 'mascot-dialogue-text';
    elDialogueText.setAttribute('data-mascot-dialogue-text', '');
    elDialogue.appendChild(elDialogueText);
    elContainer.appendChild(elDialogue);

    /* Character image with WebP → PNG fallback */
    elImg = document.createElement('img');
    elImg.className = 'mascot-img mascot-animation-idleFloat loading';
    elImg.setAttribute('data-mascot-image', '');
    elImg.alt = 'Yui';
    elImg.width  = 200;
    elImg.height = 200;

    elImg.onload = function () {
      elImg.classList.remove('loading');
    };

    loadEmotion('idle');
    elContainer.appendChild(elImg);

    /* Close button — only element with pointer-events: auto */
    var closeBtn = document.createElement('button');
    closeBtn.className = 'mascot-close';
    closeBtn.setAttribute('data-mascot-close', '');
    closeBtn.setAttribute('aria-label', 'Close mascot');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      hideMascot(true /* permanent for this session */);
    });
    elContainer.appendChild(closeBtn);

    elOverlay.appendChild(elContainer);
    document.body.appendChild(elOverlay);
  }


  /* ================================================================
     ASSET LOADING
     ================================================================ */

  /* Build WebP path from manifest for a given emotion key */
  function getWebPPath(emotion) {
    var em  = manifest.emotionToAsset[emotion]
                ? emotion
                : manifest.fallbacks.missingEmotion;
    return manifest.basePath + manifest.emotionToAsset[em];
  }

  /* Set the character image to the given emotion.
   * Re-attaches onerror on every call so each WebP → PNG fallback
   * fires correctly, not just the first one.
   * When WebP is missing, falls back to PNG with JS background removal. */
  function loadEmotion(emotion) {
    var valid = manifest.emotionToAsset[emotion]
                  ? emotion
                  : manifest.fallbacks.missingEmotion;
    state.currentEmotion = valid;

    elImg.onerror = function () {
      elImg.onerror = null;
      var pngPath = manifest.basePath + manifest.sourceAsset[valid];
      console.warn('[Yui] WebP missing for "' + valid + '" — removing PNG background. Run optimize-assets.sh for production WebP files.');
      removeBgThenLoad(valid, pngPath);
    };

    elImg.classList.add('loading');
    elImg.src = getWebPPath(valid);
    elImg.alt = 'Yui — ' + valid;
  }

  /*
   * removeBgThenLoad(emotion, pngSrc)
   *
   * Draws the PNG onto an off-screen 512×512 canvas, flood-fills from
   * all four edges to mark connected near-white pixels as transparent,
   * then sets elImg.src to the resulting data URL.
   * Results are cached per emotion so processing happens only once.
   */
  function removeBgThenLoad(emotion, pngSrc) {
    if (bgCache[emotion]) {
      elImg.src = bgCache[emotion];
      return;
    }

    var tmpImg = new Image();

    tmpImg.onload = function () {
      var SZ  = 512;
      var cvs = document.createElement('canvas');
      cvs.width = cvs.height = SZ;
      var ctx = cvs.getContext('2d');
      ctx.drawImage(tmpImg, 0, 0, SZ, SZ);

      try {
        var imgData = ctx.getImageData(0, 0, SZ, SZ);
        var d       = imgData.data;
        var visited = new Uint8Array(SZ * SZ);
        var queue   = [];
        /* Pixels where ALL channels ≥ THRESH are treated as background white.
           218 is conservative enough not to flood into lightly-tinted character
           features while still catching the solid white background. */
        var THRESH  = 218;

        function enqueue(x, y) {
          if (x < 0 || x >= SZ || y < 0 || y >= SZ) return;
          var idx = y * SZ + x;
          if (visited[idx]) return;
          var p = idx * 4;
          if (d[p] < THRESH || d[p+1] < THRESH || d[p+2] < THRESH) return;
          visited[idx] = 1;
          queue.push(idx);
        }

        /* Seed from all four edges */
        for (var ex = 0; ex < SZ; ex++) { enqueue(ex, 0);    enqueue(ex, SZ-1); }
        for (var ey = 0; ey < SZ; ey++) { enqueue(0,  ey);   enqueue(SZ-1, ey); }

        /* BFS flood fill — marks hard background as alpha 0 */
        var qi = 0;
        while (qi < queue.length) {
          var idx = queue[qi++];
          d[idx * 4 + 3] = 0;
          var fx = idx % SZ, fy = (idx / SZ) | 0;
          enqueue(fx-1, fy); enqueue(fx+1, fy);
          enqueue(fx, fy-1); enqueue(fx, fy+1);
        }

        /* Feathering pass — softens anti-aliased fringe pixels.
           For each opaque pixel that borders a transparent (background) pixel,
           if the pixel is uniformly light (min channel > 155) it is faded out
           proportionally so the edge blends smoothly into the page background.
           The min-channel heuristic targets background bleed without touching
           colored character features (hair, skin, clothing). */
        for (var iy = 0; iy < SZ; iy++) {
          for (var ix = 0; ix < SZ; ix++) {
            var ci = (iy * SZ + ix) * 4;
            if (d[ci + 3] === 0) continue;                /* already transparent */

            /* Check whether any 4-connected neighbour is transparent */
            var atEdge = (
              (ix > 0     && d[ci - 4 + 3]          === 0) ||
              (ix < SZ-1  && d[ci + 4 + 3]          === 0) ||
              (iy > 0     && d[ci - SZ*4 + 3]       === 0) ||
              (iy < SZ-1  && d[ci + SZ*4 + 3]       === 0)
            );
            if (!atEdge) continue;

            /* Fade near-white edge pixels: fully opaque at minCh ≤ 155,
               fully transparent at minCh = 255 */
            var minCh = Math.min(d[ci], d[ci+1], d[ci+2]);
            if (minCh > 155) {
              d[ci + 3] = Math.round(255 * (255 - minCh) / (255 - 155));
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        var dataUrl        = cvs.toDataURL('image/png');
        bgCache[emotion]   = dataUrl;
        elImg.src          = dataUrl;
      } catch (e) {
        /* Canvas blocked (e.g. tainted) — fall back to raw PNG */
        console.warn('[Yui] Background removal failed:', e.message, '— showing raw PNG.');
        elImg.src = pngSrc;
      }
    };

    tmpImg.onerror = function () {
      console.warn('[Yui] PNG source also missing for "' + emotion + '".');
    };

    tmpImg.src = pngSrc;
  }


  /* ================================================================
     POSITION, ANIMATION, EMOTION CONTROL
     ================================================================ */

  /* All known position class names */
  var ALL_POSITION_CLASSES = [
    'mascot-position-bottom-right',
    'mascot-position-bottom-left',
    'mascot-position-mid-right',
    'mascot-position-mid-left',
    'mascot-position-top-peek',
    'mascot-position-bottom-peek',
    'mascot-position-near-element',
  ];

  /* All known animation class names */
  var ALL_ANIMATION_CLASSES = [
    'mascot-animation-idleFloat',
    'mascot-animation-popIn',
    'mascot-animation-talkBounce',
    'mascot-animation-slideMove',
    'mascot-animation-peekIn',
    'mascot-animation-slideAway',
  ];

  function applyPosition(position, nearEl) {
    ALL_POSITION_CLASSES.forEach(function (c) {
      elContainer.classList.remove(c);
    });

    var valid = manifest.positions[position]
                  ? position
                  : manifest.fallbacks.missingPosition;

    elContainer.classList.add('mascot-position-' + valid);

    if (valid === 'near-element' && nearEl) {
      placeNearElement(nearEl);
    } else {
      /* Clear any inline positioning from a previous near-element call */
      elContainer.style.top       = '';
      elContainer.style.left      = '';
      elContainer.style.right     = '';
      elContainer.style.bottom    = '';
      elContainer.style.transform = '';
    }
  }

  /* Compute pixel position so the mascot floats near a page element */
  function placeNearElement(el) {
    var rect = el.getBoundingClientRect();
    var vw   = window.innerWidth;
    var mW   = 220;  /* approx mascot + bubble width */
    var mH   = 280;  /* approx mascot + bubble height */

    var top  = rect.top - mH - 12;
    var left = rect.left + rect.width / 2 - mW / 2;

    /* Flip below the element if not enough room above */
    if (top < 10) top = rect.bottom + 12;
    /* Clamp horizontally */
    if (left + mW > vw - 10) left = vw - mW - 10;
    if (left < 10) left = 10;

    elContainer.style.top       = top  + 'px';
    elContainer.style.left      = left + 'px';
    elContainer.style.right     = 'auto';
    elContainer.style.bottom    = 'auto';
    elContainer.style.transform = 'none';
  }

  function applyAnimation(animName) {
    /* Force a reflow so re-adding the same class replays the animation */
    ALL_ANIMATION_CLASSES.forEach(function (c) {
      elContainer.classList.remove(c);
    });
    void elContainer.offsetHeight;

    var valid = manifest.animations[animName]
                  ? animName
                  : manifest.fallbacks.missingAnimation;
    elContainer.classList.add('mascot-animation-' + valid);
  }


  /* ================================================================
     DIALOGUE
     ================================================================ */

  /* Read the current language from the site's global variable */
  function getLang() {
    if (typeof window.lang === 'string' &&
        (window.lang === 'zh' || window.lang === 'en')) {
      return window.lang;
    }
    return 'en';
  }

  /* Pick a random dialogue line for the given trigger */
  function pickLine(trigger) {
    if (!dialogue || !dialogue.triggers) return null;
    var lines = dialogue.triggers[trigger];
    if (!lines || lines.length === 0) return null;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function showDialogue(line) {
    if (!line || !line.text) {
      elDialogue.classList.remove('visible');
      return;
    }
    var lang = getLang();
    var text = line.text[lang] || line.text['en'] || '';
    if (!text) { elDialogue.classList.remove('visible'); return; }
    elDialogueText.textContent = text;
    elDialogue.classList.remove('visible');
    void elDialogue.offsetHeight; /* force reflow to replay transition */
    elDialogue.classList.add('visible');
  }

  function hideDialogue() {
    elDialogue.classList.remove('visible');
  }


  /* ================================================================
     TRIGGER SYSTEM — decides if and when the mascot can appear
     ================================================================ */

  function canFire(triggerName) {
    if (state.closed)  return false;
    if (!manifest)     return false;

    var limits = manifest.behaviorLimits;
    if (state.appearanceCount >= limits.maxAppearancesPerSession) return false;
    if (state.isTyping && limits.pauseWhileTyping)                 return false;

    var now          = Date.now();
    var globalMs     = limits.globalCooldownMs || 25000;
    if (now - state.lastGlobalMs < globalMs) return false;

    var cfg          = manifest.triggerMap[triggerName];
    var sameCooldown = limits.sameTriggerCooldownMs ||
                       (cfg ? cfg.cooldownMs : manifest.fallbacks.missingCooldownMs);
    var last         = state.lastTriggerMs[triggerName] || 0;
    if (now - last < sameCooldown) return false;

    return true;
  }

  /*
   * fireTrigger(triggerName, nearEl?)
   *
   * Priority for emotion and position:
   *   1. dialogue.json line (per-line overrides)
   *   2. assistant-assets.json triggerMap defaults
   *   3. assistant-assets.json fallbacks
   */
  function fireTrigger(triggerName, nearEl) {
    if (!manifest || !dialogue) return;
    if (!canFire(triggerName))  return;

    var cfg = manifest.triggerMap[triggerName] || {};
    var line = pickLine(triggerName);

    var emotion   = (line && line.emotion)               || cfg.emotion   || manifest.fallbacks.missingEmotion;
    var position  = (line && line.recommended_position)  || cfg.position  || manifest.fallbacks.missingPosition;
    var animation = cfg.animation || manifest.fallbacks.missingAnimation;
    var displayMs = cfg.displayMs || manifest.fallbacks.missingDisplayMs;

    showMascot(emotion, position, animation, line, nearEl, displayMs);

    var now = Date.now();
    state.lastTriggerMs[triggerName] = now;
    state.lastGlobalMs               = now;
    state.appearanceCount           += 1;
  }


  /* ================================================================
     SHOW / HIDE
     ================================================================ */

  function showMascot(emotion, position, animation, line, nearEl, displayMs) {
    if (state.closed) return;

    /* Cancel both pending timers: the displayMs timer and the
       hide-overlay timer (360ms delay inside hideMascot).
       Without cancelling the latter, a new trigger firing during
       the slideAway animation would be re-hidden 360ms later. */
    if (state.hideTimer)        { clearTimeout(state.hideTimer);        state.hideTimer        = null; }
    if (state.hideOverlayTimer) { clearTimeout(state.hideOverlayTimer); state.hideOverlayTimer = null; }

    loadEmotion(emotion);
    applyPosition(position, nearEl || state.nearTarget);
    applyAnimation(animation);
    showDialogue(line);

    elOverlay.classList.remove('mascot-hidden');
    state.visible = true;

    state.hideTimer = setTimeout(function () {
      hideMascot(false);
    }, displayMs || manifest.fallbacks.missingDisplayMs);
  }

  function hideMascot(permanent) {
    if (permanent) {
      state.closed = true;
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
    }

    hideDialogue();
    applyAnimation('slideAway');

    /* Wait for slideAway animation, then hide the overlay.
       Tracked in state.hideOverlayTimer so showMascot can cancel it
       if a new trigger fires during the slide-away. */
    var delay = 360;
    if (manifest && manifest.behaviorLimits.respectReducedMotion) {
      try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          delay = 0;
        }
      } catch (e) {}
    }

    state.hideOverlayTimer = setTimeout(function () {
      elOverlay.classList.add('mascot-hidden');
      state.visible = false;
      state.hideOverlayTimer = null;
    }, delay);
  }


  /* ================================================================
     BEHAVIOR TRIGGER DETECTORS
     ================================================================ */

  function attachTriggers() {
    attachActivityTracking();
    attachIdleTriggers();
    attachScrollTriggers();
    attachClickTrigger();
    attachTabReturnTrigger();
    attachExitIntentTrigger();
    attachSectionTriggers();
    attachSectionNavTrigger();
    attachMapMarkerTrigger();
    attachPhotoLightboxTrigger();
    attachGalleryFilterTrigger();
    attachTripSelectTrigger();
    attachFormPauseTrigger();
    attachLongReadingTrigger();
    attachHoverCtaTrigger();
    attachErrorTrigger();
    attachRandomCommentTrigger();
  }


  /* ── Activity reset ────────────────────────────────────────────── */
  /* Resets the idle timers on any user interaction */

  function resetIdle() {
    idle.lastActivity = Date.now();

    if (idle.timer30) { clearTimeout(idle.timer30); idle.timer30 = null; }
    if (idle.timer60) { clearTimeout(idle.timer60); idle.timer60 = null; }
    idle.fired30 = false;
    idle.fired60 = false;

    scheduleIdleTimers();
  }

  function attachActivityTracking() {
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(function (e) {
      document.addEventListener(e, resetIdle, { passive: true, capture: true });
    });
    scheduleIdleTimers();
  }


  /* ── Idle triggers ─────────────────────────────────────────────── */

  function scheduleIdleTimers() {
    idle.timer30 = setTimeout(function () {
      if (!idle.fired30) {
        idle.fired30 = true;
        fireTrigger('idle_30s');
        idle.timer60 = setTimeout(function () {
          if (!idle.fired60) {
            idle.fired60 = true;
            fireTrigger('idle_60s');
          }
        }, 30000);
      }
    }, 30000);
  }

  function attachIdleTriggers() {
    /* scheduleIdleTimers is called from attachActivityTracking */
  }


  /* ── Scroll triggers ───────────────────────────────────────────── */
  /* Uses capture phase to catch scroll from inner overflow containers
     (the site uses overflow-y:auto on section divs, not window). */

  function attachScrollTriggers() {
    document.addEventListener('scroll', function (e) {
      var target  = e.target;
      var scrollY = target.scrollTop !== undefined ? target.scrollTop : window.scrollY;
      var now     = Date.now();
      var delta   = Math.abs(scrollY - scroll.lastY);
      var elapsed = now - scroll.lastMs;

      /* Fast scroll: >280px scrolled in <350ms */
      if (elapsed > 0 && elapsed < 350 && delta > 280) {
        fireTrigger('scroll_fast');
      }

      /* Scroll to bottom: within 60px of the scrollable bottom */
      if (target.scrollTop !== undefined) {
        var atBottom = (target.scrollTop + target.clientHeight) >= (target.scrollHeight - 60);
        if (atBottom && delta > 0) fireTrigger('scroll_to_bottom');
      }

      scroll.lastY  = scrollY;
      scroll.lastMs = now;
    }, { passive: true, capture: true });
  }


  /* ── Repeated click ────────────────────────────────────────────── */
  /* Fires after 3 clicks on the same element within 2s */

  function attachClickTrigger() {
    document.addEventListener('click', function (e) {
      var el = e.target;
      /* Ignore the close button */
      if (el === elOverlay || elContainer.contains(el)) return;

      if (el === clicks.el) {
        clicks.count += 1;
        if (clicks.count >= 3) {
          clicks.count = 0;
          state.nearTarget = el;
          fireTrigger('repeated_click', el);
        }
      } else {
        clicks.el    = el;
        clicks.count = 1;
      }

      if (clicks.timer) clearTimeout(clicks.timer);
      clicks.timer = setTimeout(function () {
        clicks.el    = null;
        clicks.count = 0;
      }, 2000);
    });
  }


  /* ── Tab return ────────────────────────────────────────────────── */

  function attachTabReturnTrigger() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        fireTrigger('tab_return');
      }
    });
  }


  /* ── Exit intent ───────────────────────────────────────────────── */
  /* Fires when the mouse cursor leaves via the top edge of the viewport */

  function attachExitIntentTrigger() {
    document.addEventListener('mouseleave', function (e) {
      if (e.clientY <= 0) fireTrigger('exit_intent');
    });
  }


  /* ── Section triggers ──────────────────────────────────────────── */
  /* Watches for pricing / FAQ sections entering the viewport.
     On this site these sections may not exist — the observer is
     a no-op if no matching elements are found. */

  function attachSectionTriggers() {
    if (!window.IntersectionObserver) return;

    var sectionSelectors = {
      pricing_section: '[data-section="pricing"], .pricing, #pricing',
      faq_section:     '[data-section="faq"], .faq, #faq, details',
    };

    Object.keys(sectionSelectors).forEach(function (trigger) {
      var els = document.querySelectorAll(sectionSelectors[trigger]);
      if (!els.length) return;

      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) fireTrigger(trigger);
        });
      }, { threshold: 0.3 });

      els.forEach(function (el) { obs.observe(el); });
    });
  }


  /* ── Section navigation ───────────────────────────────────────── */
  /* Fires a section-specific trigger whenever the user switches between
     HOME / PHOTOGRAPHY / MAP / TRAVEL sections.
     Uses MutationObserver on the 'active' CSS class toggled by the
     site's own switchSection() function. */

  function attachSectionNavTrigger() {
    if (!window.MutationObserver) return;
    var sections = document.querySelectorAll('.section');
    if (!sections.length) return;

    var sectionToTrigger = {
      'sec-photography': 'enter_photography',
      'sec-map':         'enter_map',
      'sec-travel':      'enter_travel',
      'sec-home':        'random_comment',
    };

    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mut = mutations[i];
        if (mut.attributeName !== 'class') continue;
        /* Only fire when 'active' is being ADDED (section becoming visible) */
        var hadActive = mut.oldValue && mut.oldValue.indexOf('active') >= 0;
        if (!hadActive && mut.target.classList.contains('active')) {
          var secId  = mut.target.id;
          var trigger = sectionToTrigger[secId] || 'random_comment';
          fireTrigger(trigger);
          break; /* one trigger per navigation event is enough */
        }
      }
    });

    sections.forEach(function (sec) {
      obs.observe(sec, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    });
  }


  /* ── Map marker clicks ─────────────────────────────────────────── */
  /* Fires map_marker_click when the user clicks a Leaflet photo
     marker in the sec-map section. Delegates on the map container
     rather than individual markers so it works even after Leaflet
     re-renders the layer. */

  function attachMapMarkerTrigger() {
    var mapSection = document.getElementById('sec-map');
    if (!mapSection) return;

    mapSection.addEventListener('click', function (e) {
      var target = e.target;
      /* Leaflet markers are either .leaflet-marker-icon or SVG paths
         inside .leaflet-interactive. Walk up a few levels to check. */
      var el = target;
      for (var d = 0; d < 5; d++) {
        if (!el) break;
        if (
          el.classList && (
            el.classList.contains('leaflet-marker-icon') ||
            el.classList.contains('leaflet-interactive') ||
            el.classList.contains('photo-marker')
          )
        ) {
          fireTrigger('map_marker_click');
          return;
        }
        el = el.parentElement;
      }
    });
  }


  /* ── Photo lightbox ────────────────────────────────────────────── */
  /* Fires when the user opens a photo in fullscreen lightbox view.
     Watches for .show being added to #photoLb via MutationObserver. */

  function attachPhotoLightboxTrigger() {
    var lb = document.getElementById('photoLb');
    if (!lb || !window.MutationObserver) return;

    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mut = mutations[i];
        if (mut.attributeName !== 'class') continue;
        var wasShown = mut.oldValue && mut.oldValue.indexOf('show') >= 0;
        if (!wasShown && lb.classList.contains('show')) {
          fireTrigger('photo_lightbox_open');
          break;
        }
      }
    });

    obs.observe(lb, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  }


  /* ── Gallery filter change ─────────────────────────────────────── */
  /* Fires when the user switches photo category (PEOPLE/CITY/NATURE/TIME).
     Delegates on .photo-filter-bar and ignores clicks on already-active btn. */

  function attachGalleryFilterTrigger() {
    var filterBar = document.querySelector('.photo-filter-bar');
    if (!filterBar) return;

    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.pcat-btn') : null;
      if (!btn) return;
      if (!btn.classList.contains('active')) {
        fireTrigger('gallery_filter_change');
      }
    });
  }


  /* ── Trip card select ──────────────────────────────────────────── */
  /* Fires when the user opens a trip itinerary from the trip grid.
     Delegates on #tripGrid; skips private-locked cards. */

  function attachTripSelectTrigger() {
    var grid = document.getElementById('tripGrid');
    if (!grid) return;

    grid.addEventListener('click', function (e) {
      var card = e.target.closest ? e.target.closest('.trip-card') : null;
      if (!card) return;
      if (card.classList.contains('private-locked')) return;
      fireTrigger('trip_select');
    });
  }


  /* ── Form pause ────────────────────────────────────────────────── */
  /* Fires when the user has been inside a form field for 3s
     without typing (abandoned input). */

  function attachFormPauseTrigger() {
    var formTimer   = null;
    var activeInput = null;

    document.addEventListener('focus', function (e) {
      var el = e.target;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        activeInput      = el;
        state.isTyping   = true;
      }
    }, true);

    document.addEventListener('blur', function (e) {
      if (e.target === activeInput) {
        state.isTyping = false;
        activeInput    = null;
        if (formTimer) { clearTimeout(formTimer); formTimer = null; }
      }
    }, true);

    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
      state.isTyping = true;
      if (formTimer) clearTimeout(formTimer);
      formTimer = setTimeout(function () {
        state.isTyping = false;
        if (activeInput) fireTrigger('form_pause', activeInput);
      }, 3000);
    });
  }


  /* ── Long reading ──────────────────────────────────────────────── */
  /* Fires when the user scrolls slowly (reading pace) and stays
     in the same scroll area for 8s without a large jump. */

  function attachLongReadingTrigger() {
    document.addEventListener('scroll', function (e) {
      var target  = e.target;
      var scrollY = target.scrollTop !== undefined ? target.scrollTop : window.scrollY;
      var delta   = Math.abs(scrollY - reading.lastScrollY);

      if (delta < 180) {
        if (!reading.timer) {
          reading.timer = setTimeout(function () {
            fireTrigger('long_reading');
            reading.timer = null;
          }, 8000);
        }
      } else {
        if (reading.timer) { clearTimeout(reading.timer); reading.timer = null; }
      }
      reading.lastScrollY = scrollY;
    }, { passive: true, capture: true });
  }


  /* ── Hover CTA ─────────────────────────────────────────────────── */
  /* Fires when the user hovers over a link or button for ≥1.5s */

  function attachHoverCtaTrigger() {
    var ctaTimer  = null;
    var ctaTarget = null;
    var CTA_SEL   = 'a[href], button, [role="button"]';

    document.addEventListener('mouseover', function (e) {
      var el = e.target.closest ? e.target.closest(CTA_SEL) : null;
      if (!el || elContainer.contains(el)) return; /* ignore close btn */
      if (el === ctaTarget) return;

      ctaTarget = el;
      if (ctaTimer) clearTimeout(ctaTimer);
      ctaTimer = setTimeout(function () {
        if (ctaTarget) {
          state.nearTarget = ctaTarget;
          fireTrigger('hover_cta', ctaTarget);
        }
      }, 1500);
    });

    document.addEventListener('mouseout', function (e) {
      var el = e.target.closest ? e.target.closest(CTA_SEL) : null;
      if (el && el === ctaTarget) {
        if (ctaTimer) { clearTimeout(ctaTimer); ctaTimer = null; }
        ctaTarget = null;
      }
    });
  }


  /* ── Error or failed action ────────────────────────────────────── */
  /* Listens for uncaught JS errors or unhandled promise rejections */

  function attachErrorTrigger() {
    window.addEventListener('error', function () {
      fireTrigger('error_or_failed_action');
    });
    window.addEventListener('unhandledrejection', function () {
      fireTrigger('error_or_failed_action');
    });
  }


  /* ── Random comment ────────────────────────────────────────────── */
  /* Fires a spontaneous comment every 2–3 minutes at random */

  function attachRandomCommentTrigger() {
    function schedule() {
      var delay = 120000 + Math.random() * 60000; /* 2–3 min */
      setTimeout(function () {
        fireTrigger('random_comment');
        schedule();
      }, delay);
    }
    /* First random comment no earlier than 90s after page load */
    setTimeout(schedule, 90000);
  }


  /* ================================================================
     DEBUG API — only active on localhost, not shipped to production
     Exposes window.__yuiMascot for browser console testing.
     ================================================================ */

  if (true) { /* TEMP: debug API exposed for trigger testing — revert after */
    window.__yuiMascot = {
      /* Fire any trigger by name, bypassing cooldowns */
      fire: function (triggerName, nearEl) {
        state.lastGlobalMs = 0;
        state.lastTriggerMs[triggerName] = 0;
        state.appearanceCount = 0;
        state.closed = false;
        fireTrigger(triggerName, nearEl);
      },
      /* Reset all cooldowns and session state */
      reset: function () {
        state.lastGlobalMs = 0;
        state.lastTriggerMs = {};
        state.appearanceCount = 0;
        state.closed = false;
        sessionStorage.removeItem('yui_mascot_closed_v1');
      },
      /* Read current state */
      getState: function () { return JSON.parse(JSON.stringify(state)); },
      /* Show mascot with explicit parameters */
      show: function (emotion, position, animation) {
        showMascot(emotion, position || 'bottom-right', animation || 'popIn', null, null, 5000);
      }
    };
  }


  /* ================================================================
     BOOT
     ================================================================ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
