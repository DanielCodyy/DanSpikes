# Web Mascot Assistant Asset Guide

This folder contains the asset and metadata package for a lightweight anime-style web mascot assistant used on a plain HTML/CSS/JavaScript personal website.

The assistant is not a chatbot. It appears occasionally as a floating webpage overlay and shows short comments based on browsing behavior such as scrolling, hovering, pausing, returning to the tab, or reaching the bottom of a page.

This implementation is designed for a static personal homepage with photography galleries. It does not require React, TypeScript, npm, bundlers, or any framework.

---

## 1. Recommended Folder Structure

```txt
/assistant/
  character_idle.webp
  character_talk.webp
  character_mocking.webp
  character_surprised.webp
  character_thinking.webp
  character_peek.webp
  character_bored.webp
  assistant-assets.json
  dialogue.json
  assistant.js
  assistant.css
  ASSET_GUIDE.md

/assistant/source/
  character_idle.png
  character_talk.png
  character_mocking.png
  character_surprised.png
  character_thinking.png
  character_peek.png
  character_bored.png
```

### Folder purpose

```txt
/assistant/
```

This is the runtime folder used by the webpage. The optimized WebP assets, JSON files, JavaScript file, and CSS file should be stored here.

```txt
/assistant/source/
```

This is the backup folder for original transparent PNG files. These files are not intended to be loaded by the webpage during normal runtime.

---

## 2. Runtime Files vs Backup Files

### Runtime files used by the webpage

The following files are used directly by the static website:

```txt
/assistant/character_idle.webp
/assistant/character_talk.webp
/assistant/character_mocking.webp
/assistant/character_surprised.webp
/assistant/character_thinking.webp
/assistant/character_peek.webp
/assistant/character_bored.webp
/assistant/assistant-assets.json
/assistant/dialogue.json
/assistant/assistant.js
/assistant/assistant.css
```

### Documentation-only or backup-only files

The following files should be kept for future editing, regeneration, or re-export, but should not be loaded by the webpage at runtime:

```txt
/assistant/source/character_idle.png
/assistant/source/character_talk.png
/assistant/source/character_mocking.png
/assistant/source/character_surprised.png
/assistant/source/character_thinking.png
/assistant/source/character_peek.png
/assistant/source/character_bored.png
/assistant/ASSET_GUIDE.md
```

Keep both versions:

- Keep PNG files in `/assistant/source/` as the original high-quality backups.
- Use WebP files in `/assistant/` as the optimized runtime files.

---

## 3. Image Optimization Workflow

### Source image requirements

Original PNG files should be stored in:

```txt
/assistant/source/
```

Each original PNG should meet these requirements:

```txt
- 1024x1024 canvas
- true alpha transparent background
- full body visible, except character_peek.png
- no checkerboard background pixels
- no text
- no watermark
- no background objects
- clean anti-aliased character edge
- consistent outfit, hairstyle, color palette, and art style
```

The `character_peek.png` file is the only asset that may be intentionally cropped by the canvas edge.

### Optimized WebP output location

Optimized WebP files should be stored directly in:

```txt
/assistant/
```

Example:

```txt
/assistant/source/character_idle.png
```

should become:

```txt
/assistant/character_idle.webp
```

### Recommended resize dimensions

Use the original 1024x1024 PNG files as source assets.

Recommended runtime dimensions:

```txt
Source asset size: 1024x1024
Optimized WebP size: 1024x1024 or 768x768
Displayed desktop height: 160px to 240px
Displayed tablet height: 130px to 180px
Displayed mobile height: 96px to 140px
```

For most personal websites, exporting the WebP files at `768x768` is enough. Use `1024x1024` if the mascot may appear large on high-DPI displays.

### Recommended file size goals

Target file sizes:

```txt
character_idle.webp: under 180 KB
character_talk.webp: under 180 KB
character_mocking.webp: under 180 KB
character_surprised.webp: under 200 KB
character_thinking.webp: under 180 KB
character_peek.webp: under 150 KB
character_bored.webp: under 180 KB
```

A practical overall goal is to keep all seven runtime WebP assets under 1.2 MB total.

### WebP quality settings

Recommended settings:

```txt
WebP quality: 80 to 88
Alpha quality: 85 to 95
Resize: 768x768 or 1024x1024
Fit mode: contain
Background: transparent
```

Do not flatten images onto a solid background.

### Example optimization command using ImageMagick

If ImageMagick is available:

```bash
magick assistant/source/character_idle.png -resize 1024x1024 -define webp:lossless=false -quality 85 assistant/character_idle.webp
magick assistant/source/character_talk.png -resize 1024x1024 -define webp:lossless=false -quality 85 assistant/character_talk.webp
magick assistant/source/character_mocking.png -resize 1024x1024 -define webp:lossless=false -quality 85 assistant/character_mocking.webp
magick assistant/source/character_surprised.png -resize 1024x1024 -define webp:lossless=false -quality 85 assistant/character_surprised.webp
magick assistant/source/character_thinking.png -resize 1024x1024 -define webp:lossless=false -quality 85 assistant/character_thinking.webp
magick assistant/source/character_peek.png -resize 1024x1024 -define webp:lossless=false -quality 85 assistant/character_peek.webp
magick assistant/source/character_bored.png -resize 1024x1024 -define webp:lossless=false -quality 85 assistant/character_bored.webp
```

### Example optimization workflow using an online converter

If using an online image converter:

1. Upload the PNG source file from `/assistant/source/`.
2. Choose WebP as output format.
3. Keep transparency enabled.
4. Set quality around 85.
5. Keep dimensions at 1024x1024 or resize to 768x768.
6. Download the optimized file.
7. Rename it exactly according to the file naming rules below.
8. Place the final WebP file directly in `/assistant/`.

---

## 4. Transparent Background Requirements

All runtime WebP files must preserve true alpha transparency.

Check for these problems before deployment:

```txt
- no gray/white checkerboard pattern embedded in the image
- no white box around the character
- no dark halo around the character edge
- no accidental background layer
- no cropped full-body assets except character_peek.webp
```

If checkerboard pixels appear in the actual image, the asset is not transparent. Regenerate or remove the background before optimization.

---

## 5. File Naming Consistency Requirements

Use exactly these source PNG names:

```txt
character_idle.png
character_talk.png
character_mocking.png
character_surprised.png
character_thinking.png
character_peek.png
character_bored.png
```

Use exactly these optimized WebP names:

```txt
character_idle.webp
character_talk.webp
character_mocking.webp
character_surprised.webp
character_thinking.webp
character_peek.webp
character_bored.webp
```

The names in `assistant-assets.json` must match the files exactly. Avoid spaces, capital letters, or alternate suffixes.

Correct:

```txt
character_idle.webp
```

Incorrect:

```txt
Character Idle.webp
character-idle.webp
character_idle_v2.webp
idle.webp
```

---

## 6. Asset Meanings

| Emotion | Runtime asset | Use case |
|---|---|---|
| idle | character_idle.webp | Default state when the mascot is visible but not speaking |
| talk | character_talk.webp | Normal dialogue or short comments |
| mocking | character_mocking.webp | Light teasing or harmless behavioral roasts |
| surprised | character_surprised.webp | Sudden scrolling, tab return, errors, or unexpected behavior |
| thinking | character_thinking.webp | Long hover, form pause, reading, or careful comparison |
| peek | character_peek.webp | Edge entrance, page enter, or exit intent |
| bored | character_bored.webp | Long inactivity or long dwell time |

---

## 7. assistant-assets.json Usage

`assistant-assets.json` is the main runtime manifest for vanilla JavaScript.

It contains:

```txt
- optimized asset paths
- original source backup paths
- emotion-to-asset mapping
- trigger-to-emotion mapping
- trigger-to-position mapping
- CSS animation names
- fallback behavior
- recommended display sizes
```

The JavaScript implementation should load it with:

```js
fetch("assistant/assistant-assets.json")
  .then(function (response) {
    return response.json();
  })
  .then(function (manifest) {
    console.log("Mascot manifest loaded:", manifest);
  });
```

No framework is required.

---

## 8. Emotion-to-Asset Mapping

The manifest includes this mapping:

```txt
idle      -> assistant/character_idle.webp
talk      -> assistant/character_talk.webp
mocking   -> assistant/character_mocking.webp
surprised -> assistant/character_surprised.webp
thinking  -> assistant/character_thinking.webp
peek      -> assistant/character_peek.webp
bored     -> assistant/character_bored.webp
```

The JavaScript implementation can use this mapping to switch images.

Example:

```js
function setMascotEmotion(manifest, emotion) {
  var fallbackEmotion = manifest.fallbacks.missingEmotion;
  var selectedEmotion = manifest.emotionToAsset[emotion] ? emotion : fallbackEmotion;
  var imagePath = manifest.emotionToAsset[selectedEmotion];

  var mascotImage = document.querySelector("[data-mascot-image]");
  if (mascotImage) {
    mascotImage.src = imagePath;
    mascotImage.alt = "Mascot assistant: " + selectedEmotion;
  }
}
```

---

## 9. Trigger-to-Emotion and Trigger-to-Position Mapping

The manifest includes trigger behavior for these events:

```txt
page_enter
idle_30s
idle_60s
scroll_fast
scroll_to_bottom
repeated_click
hover_cta
pricing_section
faq_section
form_pause
tab_return
exit_intent
error_or_failed_action
long_reading
random_comment
```

Each trigger defines:

```txt
emotion
position
animation
cooldownMs
displayMs
```

Example trigger map entry:

```json
"scroll_fast": {
  "emotion": "surprised",
  "position": "mid-right",
  "animation": "popIn",
  "cooldownMs": 14000,
  "displayMs": 3600
}
```

The JavaScript implementation should use the trigger map to determine which asset, position, animation, and display duration to use.

---

## 10. CSS Animation Names

Do not create a separate file named `css-animation-mapping`.

The animation mapping is included directly in `assistant-assets.json` using:

```txt
assets.[emotion].defaultAnimation
triggerMap.[trigger].animation
animations
```

The actual CSS classes and `@keyframes` should be implemented later in:

```txt
/assistant/assistant.css
```

Claude Code should implement these animation names in `assistant.css`:

```txt
idleFloat
popIn
talkBounce
slideMove
peekIn
slideAway
```

Recommended interpretation:

| Animation name | Intended behavior |
|---|---|
| idleFloat | gentle floating loop |
| popIn | quick entrance pop or surprise reaction |
| talkBounce | subtle bounce while dialogue is shown |
| slideMove | smooth repositioning movement |
| peekIn | slide in from viewport edge |
| slideAway | exit animation before hiding |

Recommended CSS class naming pattern:

```txt
mascot-animation-idleFloat
mascot-animation-popIn
mascot-animation-talkBounce
mascot-animation-slideMove
mascot-animation-peekIn
mascot-animation-slideAway
```

The JavaScript implementation can apply animation classes like this:

```js
function applyMascotAnimation(element, animationName) {
  var allowed = ["idleFloat", "popIn", "talkBounce", "slideMove", "peekIn", "slideAway"];
  var fallback = "idleFloat";
  var selected = allowed.indexOf(animationName) >= 0 ? animationName : fallback;

  element.classList.remove(
    "mascot-animation-idleFloat",
    "mascot-animation-popIn",
    "mascot-animation-talkBounce",
    "mascot-animation-slideMove",
    "mascot-animation-peekIn",
    "mascot-animation-slideAway"
  );

  element.classList.add("mascot-animation-" + selected);
}
```

---

## 11. Position Names

These positions should be implemented in `assistant.css`:

```txt
bottom-right
bottom-left
mid-right
mid-left
top-peek
bottom-peek
near-element
```

Recommended CSS class naming pattern:

```txt
mascot-position-bottom-right
mascot-position-bottom-left
mascot-position-mid-right
mascot-position-mid-left
mascot-position-top-peek
mascot-position-bottom-peek
mascot-position-near-element
```

The `near-element` position should be computed dynamically in `assistant.js` from a target element's bounding rectangle.

---

## 12. Dialogue Integration

`dialogue.json` should contain short bilingual dialogue lines grouped by trigger. Each line should include:

```txt
text
emotion
intensity
recommended_position
```

The JavaScript implementation may either:

1. Use the emotion and position from `dialogue.json`, or
2. Use the default trigger behavior from `assistant-assets.json`.

Recommended priority:

```txt
1. dialogue.json line emotion and recommended_position
2. assistant-assets.json triggerMap defaults
3. assistant-assets.json fallbacks
```

---

## 13. Implementation Notes for a Static Personal Website

Recommended behavior rules:

```txt
- Do not show the mascot immediately on every page load if it feels intrusive.
- Use page_enter with peek only once per page session.
- Use idle_30s and idle_60s sparingly.
- Add a cooldown between triggers.
- Avoid covering navigation, gallery controls, lightbox controls, or important buttons.
- Disable pointer events on the mascot unless click interaction is intentionally added.
- Respect prefers-reduced-motion in CSS.
- Keep comments short so they do not distract from photography content.
- Avoid using mocking too frequently.
```

Recommended default behavior:

```txt
Page enter: peek
Normal comment: talk
Long reading: thinking
Long inactivity: bored
Fast scroll: surprised
Repeated click: mocking
Exit intent: peek
```

---

## 14. Future Expansion

Possible future assets:

```txt
character_wave.webp
character_confused.webp
character_success.webp
character_error.webp
character_sleeping.webp
character_camera.webp
character_gallery.webp
character_pointing.webp
```

For a photography homepage, especially useful future states would be:

```txt
character_camera.webp
character_gallery.webp
character_wow.webp
character_zoom.webp
```

Potential future triggers:

```txt
gallery_open
gallery_next_many_times
photo_zoom
photo_hover_long
lightbox_close
copy_email_click
dark_mode_toggle
language_switch
```

When adding new assets, update:

```txt
assistant-assets.json
dialogue.json
assistant.css
assistant.js
```

Do not change existing file names unless the manifest is updated at the same time.

---

## 15. Final Pre-Deployment Checklist

Before deployment, confirm:

```txt
- All WebP files exist in /assistant/.
- All PNG source files exist in /assistant/source/.
- assistant-assets.json is valid JSON.
- dialogue.json is valid JSON.
- assistant.js loads both JSON files successfully.
- assistant.css defines all required position classes.
- assistant.css defines all required animation classes.
- Mascot does not block important page controls.
- Assets display correctly on desktop, tablet, and mobile.
- prefers-reduced-motion is respected.
- There are no checkerboard artifacts in production images.
```
