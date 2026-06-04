# Trip Editor Feature — Design Spec

**Date:** 2026-06-04
**Site:** danielcodyy.github.io/DanSpikes
**Repo:** danielcodyy/DanSpikes (branch: main)

---

## Summary

Add an admin-only trip editor to the Travel section. When admin mode is active and a trip is open, an **Edit** button appears in the trip header. Clicking it opens a full-screen edit overlay where the admin can reorder days via drag-and-drop, inline-edit all day and location fields, and add or remove days and locations. On save, changes are written back to `TRIP_DATA` and pushed to GitHub Gist for cross-device sync.

---

## Architecture

The site is a single static `index.html`. All trip data lives in `TRIP_DATA[tripId]` (days_arr, t_obj, etc.). The editor works entirely in-memory on a **deep copy** (`editDraft`) of the current trip's data — nothing in `TRIP_DATA` is mutated until the admin clicks Save.

**Save flow:**
1. Deep copy `editDraft` back into `TRIP_DATA[activeTripId]`
2. Reassign the module-level globals (`days`, `t`, etc.) by calling `openTrip(activeTripId)` to re-bind them
3. Call `renderDayTabs()`, `renderTimeline()`, `renderMap()` to update the visible trip view
4. Call `pushToGist()` to sync to GitHub Gist

**Cancel flow:** Discard `editDraft`, close overlay, no re-render needed.

Authentication uses the existing `github_token` from localStorage (same as the photo upload feature). If no token is set, an inline token input appears above the Save button.

---

## Entry Point

In admin mode, when a trip is open (`activeTripId` is set), a small **✏ Edit** button appears in the trip header bar to the right of the day tabs. Styled as a gold-outlined admin button consistent with `.trip-vis-btn`.

When no trip is open (trip selector screen), the button is not shown.

---

## Edit Overlay

Dark full-screen overlay matching the existing admin modal style.

**Layout (top to bottom):**

1. **Header bar** — "Edit Trip" title + trip name + ✕ close button (= Cancel)
2. **Trip-level fields** — title zh/en, dates zh/en (four text inputs in a 2×2 grid)
3. **Days list** — scrollable, each day is a card (see Day Card below)
4. **+ Add Day** button — appends a new blank day after the last one
5. **Footer** — Cancel button + Save & Sync button + status indicator

---

## Day Card

Each day is a card with two zones:

**Card header (always visible):**
- Drag handle (≡) on the left — makes the card draggable for day reorder
- Date input (text, `YYYY-MM-DD`)
- Color swatch — clicking cycles through the 6 preset day colors: `['#c9a85c','#5b8dd9','#7dd9a0','#e67e5a','#9b7dd9','#d9815b']`
- Intensity dropdown: `light | easy | moderate | high | hard`
- Name zh/en inputs
- Area zh/en inputs
- ▼ / ▶ toggle to expand/collapse the locations section
- ✕ Remove Day button (with inline confirmation: button turns red and requires a second click)

**Locations section (collapsible):**
- List of location rows (see Location Row below)
- Drag-and-drop reorder within the day
- **+ Add Location** button at the bottom — appends a blank location

---

## Location Row

Each location has a collapsed summary row and an expanded detail panel.

**Collapsed summary:** drag handle · time · name (en) · expand/collapse toggle · ✕ remove button

**Expanded detail:**
| Field | Input type |
|---|---|
| Time | text (e.g. `10:00` or `Sunset / Evening`) |
| Name ZH | text |
| Name EN | text |
| Lat | number input (6 decimal places) |
| Lng | number input (6 decimal places) |
| Desc ZH | textarea |
| Desc EN | textarea |
| Notes ZH | textarea |
| Notes EN | textarea |
| Reservation | dropdown: `free \| must \| rec \| opt \| fixed` |
| Special | dropdown: `(none) \| arrival \| departure \| airbnb \| hotel \| viewpoint \| sunset \| drive \| hiking \| camping \| restaurant \| activity` |
| Optional | checkbox |

The `mapsLink` field is auto-regenerated on save from the coords: `https://www.google.com/maps/search/?api=1&query={lat},{lng}`.

The `id` field is preserved for existing locations. New locations get `id: 'e_' + Date.now() + '_' + index`.

---

## Transit

Transit entries are **not editable** in this version. They link location IDs and would silently break if locations are reordered or removed. Transit data is carried over unchanged from the original day object on save.

A note in the UI: each day card footer shows "Transit data preserved as-is" in faint text.

---

## Drag-and-Drop

Uses the HTML5 Drag API (`draggable="true"`, `dragstart`, `dragover`, `drop`, `dragend`).

**Day reorder:** Dragging a day card reorders `editDraft.days_arr`. Visual feedback: dragged card gets 40% opacity + dashed border; the drop target shows a gold top-border highlight.

**Location reorder within a day:** Same mechanism scoped to the location list of each day card.

Drag handles are the only drag initiation point (the `mousedown` on the handle sets `draggable=true` on the parent card, preventing accidental drags from input fields).

---

## Add / Remove

**Add Day:** Inserts at end of `editDraft.days_arr`:
```js
{
  date: /* last day's date + 1 day */,
  color: dayColors[days.length % dayColors.length],
  dayName: {zh:'', en:''},
  area: {zh:'', en:''},
  intensity: 'moderate',
  locations: [],
  transit: []
}
```

**Remove Day:** Two-click confirmation. First click turns button red with "Confirm?" label; second click removes. Resets if user clicks elsewhere.

**Add Location:** Appends to the day's `locations` array:
```js
{
  id: 'e_' + Date.now(),
  time: '',
  name: {zh:'', en:''},
  coords: [0, 0],
  mapsLink: '',
  desc: {zh:'', en:''},
  notes: {zh:'', en:''},
  reservation: 'free',
  special: '',
  optional: false
}
```

**Remove Location:** Single click with no confirmation (locations are cheap to re-add).

---

## Data Model

The editor reads from and writes back to the same `TRIP_DATA` shape:
- `days_arr` — array of day objects (mutated on save)
- `t_obj` — regenerated on save via `makeGenericT(nameZh, nameEn, subZh, subEn, days.length)`; the TRIPS selector entry is also updated

No other sub-objects (`reservations_arr`, `budget_arr`, `tips_obj`, `links_obj`) are touched by the editor.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| No GitHub token | Inline token input appears above Save button; saves to localStorage |
| Push fails (bad token / network) | Error shown in footer status; `TRIP_DATA` IS already updated locally — only Gist sync failed |
| Save with empty name fields | Allowed — no validation; admin takes responsibility |
| Remove last location from a day | Allowed — day can have zero locations |
| Remove last day | Blocked — must have at least 1 day; Remove button disabled when only 1 day remains |

---

## Constraints & Assumptions

- Feature is invisible outside admin mode
- Only the currently-open trip is editable; to edit another trip, navigate to it first
- `pushToGist()` serializes all of `TRIP_DATA` (existing behavior) — the entire dataset is synced on each save
- The editor does not touch `MAP_LOCS` — newly added locations do not appear on the photo map
- All existing Gist sync infrastructure (`pushToGist`, `pullFromGist`, `getGithubToken`, `getGistId`) is reused as-is
- The `t_obj` bilingual structure uses `t_obj.zh.title`, `t_obj.zh.sub`, `t_obj.en.title`, `t_obj.en.sub` for name and date range. On save, `t_obj` is fully regenerated via `makeGenericT(nameZh, nameEn, subZh, subEn, days.length)` — the rest of the UI strings inside `t_obj` are re-derived automatically
- No changes to `PHOTOS`, `MAP_LOCS`, or any Paris 2026 data
