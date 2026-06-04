# Trip Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only in-page trip editor that lets the admin drag-reorder days, inline-edit all fields, add/remove days and locations, then save to GitHub Gist for cross-device sync.

**Architecture:** All code goes in the single `index.html` file. The editor works on a deep copy (`editDraft`) of the active trip's data; on Save it commits back to `TRIP_DATA`, re-binds module globals, re-renders the trip view, and pushes to GitHub Gist (extending the existing sync payload with a `tripEdits` key). No external libraries — HTML5 Drag API for reordering.

**Tech Stack:** Vanilla JS, HTML5 Drag API, GitHub Gist API (existing `pushToGist`/`pullFromGist` infrastructure), Leaflet (existing `renderMap`)

---

## File Structure

**Only file modified:** `index.html`

Insertion points (search for these strings to find where to insert):
- **CSS** — insert before `</style>` (there is only one style block)
- **Overlay HTML** — insert just before the closing `</section>` of the travel section (which ends at `</div>\n    </section>`)
- **Edit button in trip header** — inside `openTrip()` after `document.getElementById('tripViewName').textContent=...`
- **Global variables** — after the existing `var githubToken=...` block (around line 1374)
- **JS functions** — insert as a new block after `function applyGistData` closing brace, before `// ===== Exchange rate =====`

---

## Task 1: Global state + CSS + overlay scaffold + Edit button

**Files:**
- Modify: `index.html` (CSS block, HTML body, JS globals, openTrip function)

- [ ] **Step 1: Add global variables**

Search for the line: `var githubToken=(function(){`

Insert immediately BEFORE that line:
```javascript
var editDraft=null;   // deep copy of trip being edited; null when editor is closed
var tripEdits={};     // {tripId: {nameZh,nameEn,subZh,subEn,days_arr}} persisted to Gist
```

- [ ] **Step 2: Add CSS**

Search for `</style>` (there is exactly one — at end of the `<style>` block). Insert immediately before it:
```css
/* ===== Trip Editor ===== */
#tripEditOverlay{display:none;position:fixed;inset:0;z-index:3100;background:rgba(10,10,9,.97);flex-direction:column;font-family:inherit;}
.te-header{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border);flex-shrink:0;}
.te-header-title{font-size:14px;font-weight:700;color:var(--text);flex:1;}
.te-header-sub{font-size:11px;color:var(--gold);font-weight:600;letter-spacing:.08em;}
.te-close-btn{background:none;border:1px solid var(--border);color:var(--text-soft);border-radius:8px;padding:4px 12px;cursor:pointer;font-size:12px;}
.te-close-btn:hover{border-color:var(--gold-dim);color:var(--text);}
.te-body{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:12px;}
.te-footer{display:flex;align-items:center;gap:10px;padding:12px 18px;border-top:1px solid var(--border);flex-shrink:0;}
.te-footer-status{flex:1;font-size:12px;color:var(--text-soft);}
.te-save-btn{background:var(--gold);color:#000;border:none;border-radius:10px;padding:7px 18px;font-size:12px;font-weight:700;cursor:pointer;}
.te-save-btn:hover{opacity:.88;}
.te-save-btn:disabled{opacity:.4;cursor:default;}
.te-cancel-btn{background:none;border:1px solid var(--border);color:var(--text-soft);border-radius:10px;padding:7px 14px;font-size:12px;cursor:pointer;}
.te-cancel-btn:hover{border-color:var(--gold-dim);color:var(--text);}
.te-trip-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;background:var(--surface-2);border-radius:10px;border:1px solid var(--border);}
.te-field-group{display:flex;flex-direction:column;gap:4px;}
.te-field-group label{font-size:10px;color:var(--text-faint);font-weight:600;letter-spacing:.06em;text-transform:uppercase;}
.te-input{background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:6px 9px;font-size:12px;color:var(--text);font-family:inherit;width:100%;box-sizing:border-box;}
.te-input:focus{outline:none;border-color:var(--gold-dim);}
.te-textarea{background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:6px 9px;font-size:11px;color:var(--text);font-family:inherit;width:100%;box-sizing:border-box;resize:vertical;min-height:52px;}
.te-textarea:focus{outline:none;border-color:var(--gold-dim);}
.te-select{background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:5px 8px;font-size:11px;color:var(--text);font-family:inherit;cursor:pointer;}
.te-section-label{font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.08em;margin-bottom:4px;}
.te-day-card{background:var(--surface-2);border-radius:10px;border:1px solid var(--border);overflow:hidden;transition:opacity .15s;}
.te-day-card.te-dragging{opacity:.4;border-style:dashed;}
.te-day-card.te-drag-over{border-color:var(--gold);box-shadow:0 0 0 2px rgba(201,168,92,.25);}
.te-day-header{display:grid;grid-template-columns:20px 1fr auto;gap:8px;align-items:start;padding:10px 12px;}
.te-drag-handle{color:var(--text-faint);cursor:grab;font-size:14px;line-height:24px;padding-top:2px;user-select:none;}
.te-drag-handle:active{cursor:grabbing;}
.te-day-fields{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.te-day-row{display:flex;gap:8px;align-items:center;margin-top:6px;}
.te-color-swatch{width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid rgba(255,255,255,.15);flex-shrink:0;transition:transform .1s;}
.te-color-swatch:hover{transform:scale(1.15);}
.te-day-actions{display:flex;gap:6px;align-items:center;padding-top:2px;}
.te-remove-btn{background:none;border:1px solid rgba(220,80,80,.3);color:rgba(220,80,80,.6);border-radius:7px;padding:3px 9px;font-size:11px;cursor:pointer;white-space:nowrap;transition:all .15s;}
.te-remove-btn:hover{border-color:rgba(220,80,80,.7);color:#e55;}
.te-remove-btn.te-confirm{background:rgba(220,80,80,.15);border-color:#e55;color:#e55;}
.te-remove-btn:disabled{opacity:.3;cursor:default;}
.te-locs-section{border-top:1px solid var(--border);padding:8px 12px;}
.te-locs-toggle{background:none;border:none;color:var(--text-soft);cursor:pointer;font-size:11px;padding:0;margin-bottom:6px;}
.te-locs-toggle:hover{color:var(--gold);}
.te-loc-list{display:flex;flex-direction:column;gap:6px;}
.te-loc-row{background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;}
.te-loc-row.te-dragging{opacity:.4;border-style:dashed;}
.te-loc-row.te-drag-over{border-color:var(--gold);}
.te-loc-summary{display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:default;}
.te-loc-summary .te-drag-handle{font-size:12px;line-height:1;}
.te-loc-time{font-size:11px;color:var(--text-soft);width:60px;flex-shrink:0;}
.te-loc-name{flex:1;font-size:11px;color:var(--text);}
.te-expand-btn{background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:13px;padding:0 4px;}
.te-expand-btn:hover{color:var(--gold);}
.te-loc-detail{padding:10px 12px;border-top:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:8px;display:none;}
.te-loc-detail.open{display:grid;}
.te-loc-detail .te-full{grid-column:1/-1;}
.te-add-btn{background:none;border:1px dashed var(--border);color:var(--text-faint);border-radius:8px;padding:6px 14px;font-size:11px;cursor:pointer;width:100%;text-align:center;margin-top:4px;}
.te-add-btn:hover{border-color:var(--gold-dim);color:var(--gold);}
.te-add-day-btn{background:none;border:1px dashed var(--gold-dim);color:var(--gold);border-radius:10px;padding:9px;font-size:12px;cursor:pointer;text-align:center;}
.te-add-day-btn:hover{background:rgba(201,168,92,.08);}
.te-token-row{grid-column:1/-1;display:flex;gap:6px;align-items:center;}
.te-token-row label{font-size:11px;color:var(--text-soft);flex-shrink:0;}
.te-token-input{flex:1;}
.te-token-save{background:none;border:1px solid var(--gold-dim);color:var(--gold);border-radius:7px;padding:4px 10px;font-size:11px;cursor:pointer;}
.trip-edit-btn{font-size:11px;padding:3px 10px;border-radius:8px;border:1px solid var(--gold-dim);background:none;color:var(--gold);cursor:pointer;margin-left:8px;}
.trip-edit-btn:hover{background:rgba(201,168,92,.1);}
```

- [ ] **Step 3: Add overlay HTML**

Search for the exact string `</div>\n    </section>` in the travel section. It is the closing of the `<section id="travel">` block. The line reads:
```
      </div>
    </section>
```

Insert immediately before that `</section>` line:
```html
      <!-- Trip Editor Overlay -->
      <div id="tripEditOverlay">
        <div class="te-header">
          <span class="te-header-sub">ADMIN · EDIT TRIP</span>
          <span class="te-header-title" id="teHeaderTitle"></span>
          <button class="te-close-btn" onclick="closeTripEditor()">✕ Cancel</button>
        </div>
        <div class="te-body" id="tripEditBody"></div>
        <div class="te-footer">
          <span class="te-footer-status" id="teStatus"></span>
          <button class="te-cancel-btn" onclick="closeTripEditor()">Cancel</button>
          <button class="te-save-btn" id="teSaveBtn" onclick="saveTripEditor()">Save & Sync ↑</button>
        </div>
      </div>
```

- [ ] **Step 4: Add Edit button to trip header**

In `openTrip()`, search for this line (it is inside the function body):
```javascript
  document.getElementById('tripViewName').textContent=t[lang].title;
```

Add immediately after it:
```javascript
  // Admin edit button
  var existingEditBtn=document.getElementById('tripEditBtn');
  if(existingEditBtn)existingEditBtn.remove();
  if(isAdminMode()){
    var editBtn=document.createElement('button');
    editBtn.id='tripEditBtn';
    editBtn.className='trip-edit-btn';
    editBtn.textContent='✏ Edit';
    editBtn.onclick=openTripEditor;
    document.getElementById('tripViewName').parentNode.insertBefore(editBtn,document.getElementById('tripViewName').nextSibling);
  }
```

- [ ] **Step 5: Add stub functions**

Find the comment `// ===== Exchange rate =====` and insert immediately before it:
```javascript
// ===== Trip Editor =====
function openTripEditor(){
  if(!activeTripId||!TRIP_DATA[activeTripId])return;
  var td=TRIP_DATA[activeTripId];
  editDraft={
    nameZh:td.t_obj.zh.title,
    nameEn:td.t_obj.en.title,
    subZh:td.t_obj.zh.sub,
    subEn:td.t_obj.en.sub,
    days_arr:JSON.parse(JSON.stringify(td.days_arr))
  };
  document.getElementById('teHeaderTitle').textContent=editDraft.nameEn;
  document.getElementById('tripEditOverlay').style.display='flex';
  renderTripEditor();
}

function closeTripEditor(){
  editDraft=null;
  document.getElementById('tripEditOverlay').style.display='none';
  document.getElementById('teStatus').textContent='';
}

function renderTripEditor(){} // implemented in Task 2
function saveTripEditor(){} // implemented in Task 8
```

- [ ] **Step 6: Verify in browser**

Start local dev server (`npx serve . -p 8765` or `python -m http.server 8765` in the project directory).

Open `http://localhost:8765`. Enter admin password (triple-click nav logo → enter admin password `admin123`).

Open the LA 2026 trip. Verify:
- "✏ Edit" button appears to the right of the trip name in the back bar
- Click it: dark overlay appears with "ADMIN · EDIT TRIP" header and trip name
- Click ✕ or Cancel: overlay closes

- [ ] **Step 7: Commit**
```bash
git add index.html
git commit -m "feat: trip editor — scaffold overlay, edit button, CSS"
```

---

## Task 2: editDraft + trip-level fields

**Files:**
- Modify: `index.html` (replace `renderTripEditor` stub)

- [ ] **Step 1: Implement `renderTripEditor`**

Replace the stub `function renderTripEditor(){}` with:
```javascript
function renderTripEditor(){
  if(!editDraft)return;
  var body=document.getElementById('tripEditBody');
  var tk=getGithubToken();
  var html='';

  // Token warning (if missing)
  if(!tk){
    html+='<div style="background:rgba(201,168,92,.1);border:1px solid var(--gold-dim);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--gold);margin-bottom:4px">'+
      '⚠ No GitHub token — changes will be saved locally only. Enter a token below to enable Gist sync.</div>';
  }

  // Trip-level fields
  html+='<div class="te-section-label">TRIP INFO</div>'+
    '<div class="te-trip-fields">'+
    '<div class="te-field-group"><label>Title ZH</label><input class="te-input" id="te-nameZh" value="'+esc(editDraft.nameZh)+'" oninput="editDraft.nameZh=this.value;document.getElementById(\'teHeaderTitle\').textContent=editDraft.nameEn||editDraft.nameZh"></div>'+
    '<div class="te-field-group"><label>Title EN</label><input class="te-input" id="te-nameEn" value="'+esc(editDraft.nameEn)+'" oninput="editDraft.nameEn=this.value;document.getElementById(\'teHeaderTitle\').textContent=this.value||editDraft.nameZh"></div>'+
    '<div class="te-field-group"><label>Dates ZH</label><input class="te-input" id="te-subZh" value="'+esc(editDraft.subZh)+'" oninput="editDraft.subZh=this.value"></div>'+
    '<div class="te-field-group"><label>Dates EN</label><input class="te-input" id="te-subEn" value="'+esc(editDraft.subEn)+'" oninput="editDraft.subEn=this.value"></div>'+
    '</div>';

  // Days
  html+='<div class="te-section-label" style="margin-top:4px">DAYS ('+editDraft.days_arr.length+')</div>';
  editDraft.days_arr.forEach(function(day,i){
    html+=renderEditorDayCard(day,i);
  });
  html+='<button class="te-add-day-btn" onclick="addEditorDay()">+ Add Day</button>';

  // Token input (if missing)
  if(!tk){
    html+='<div style="margin-top:8px;display:flex;gap:8px;align-items:center">'+
      '<label style="font-size:11px;color:var(--text-soft);white-space:nowrap">GitHub Token:</label>'+
      '<input type="password" id="te-token-input" class="te-input" style="flex:1" placeholder="ghp_…">'+
      '<button class="te-token-save" onclick="var v=document.getElementById(\'te-token-input\').value.trim();if(v){saveGithubToken(v);renderTripEditor();}">Save</button>'+
      '</div>';
  }

  body.innerHTML=html;
  attachEditorListeners();
}
```

- [ ] **Step 2: Add `renderEditorDayCard` stub**

Add immediately after `renderTripEditor` (still before `// ===== Exchange rate =====`):
```javascript
function renderEditorDayCard(day,i){
  return '<div class="te-day-card" data-di="'+i+'" id="te-day-'+i+'" draggable="false">'+
    '<div class="te-day-header">'+
    '<span class="te-drag-handle" data-di="'+i+'">≡</span>'+
    '<div>'+
    '<div class="te-day-row" style="gap:8px;margin-bottom:6px">'+
    '<input class="te-input" style="width:100px" value="'+esc(day.date||'')+'" placeholder="YYYY-MM-DD" oninput="editDraft.days_arr['+i+'].date=this.value">'+
    '<span class="te-color-swatch" id="te-color-'+i+'" style="background:'+day.color+'" title="Click to cycle color" onclick="teCycleColor('+i+')"></span>'+
    '<select class="te-select" onchange="editDraft.days_arr['+i+'].intensity=this.value">'+
    ['light','easy','moderate','high','hard'].map(function(v){return '<option value="'+v+'"'+(day.intensity===v?' selected':'')+'>'+v+'</option>';}).join('')+
    '</select>'+
    '</div>'+
    '<div class="te-day-fields">'+
    '<div class="te-field-group"><label>Name ZH</label><input class="te-input" value="'+esc((day.dayName&&day.dayName.zh)||'')+'" oninput="editDraft.days_arr['+i+'].dayName.zh=this.value"></div>'+
    '<div class="te-field-group"><label>Name EN</label><input class="te-input" value="'+esc((day.dayName&&day.dayName.en)||'')+'" oninput="editDraft.days_arr['+i+'].dayName.en=this.value"></div>'+
    '<div class="te-field-group"><label>Area ZH</label><input class="te-input" value="'+esc((day.area&&day.area.zh)||'')+'" oninput="editDraft.days_arr['+i+'].area.zh=this.value"></div>'+
    '<div class="te-field-group"><label>Area EN</label><input class="te-input" value="'+esc((day.area&&day.area.en)||'')+'" oninput="editDraft.days_arr['+i+'].area.en=this.value"></div>'+
    '</div>'+
    '</div>'+
    '<div class="te-day-actions">'+
    '<button class="te-remove-btn" id="te-remove-day-'+i+'" '+(editDraft.days_arr.length<=1?'disabled':'')+' onclick="teRemoveDayClick('+i+')">✕ Day</button>'+
    '</div>'+
    '</div>'+
    renderEditorLocsSection(day,i)+
    '</div>';
}

function renderEditorLocsSection(day,i){
  var locs=day.locations||[];
  var html='<div class="te-locs-section">'+
    '<button class="te-locs-toggle" onclick="teToggleLocsSection('+i+')">'+
    '▶ Locations ('+locs.length+')</button>'+
    '<div class="te-loc-list" id="te-loclist-'+i+'" style="display:none">';
  locs.forEach(function(loc,li){html+=renderEditorLocRow(loc,i,li);});
  html+='<button class="te-add-btn" onclick="addEditorLocation('+i+')">+ Add Location</button>';
  html+='</div></div>';
  return html;
}

function teToggleLocsSection(di){
  var list=document.getElementById('te-loclist-'+di);
  var btn=list&&list.previousElementSibling;
  if(!list)return;
  var open=list.style.display==='none';
  list.style.display=open?'flex':'none';
  if(list.style.display==='flex')list.style.flexDirection='column';
  if(btn)btn.textContent=(open?'▼':'▶')+' Locations ('+(editDraft.days_arr[di].locations||[]).length+')';
}
```

- [ ] **Step 3: Add remaining stub functions**

Add after `teToggleLocsSection`:
```javascript
function renderEditorLocRow(loc,di,li){return '';} // Task 4
function attachEditorListeners(){} // Tasks 5-6
function addEditorDay(){} // Task 7
function teRemoveDayClick(di){} // Task 7
function addEditorLocation(di){} // Task 7
function teRemoveLocation(di,li){} // Task 7
function teCycleColor(di){
  var colors=['#c9a85c','#5b8dd9','#7dd9a0','#e67e5a','#9b7dd9','#d9815b'];
  var cur=editDraft.days_arr[di].color;
  var idx=colors.indexOf(cur);
  editDraft.days_arr[di].color=colors[(idx+1)%colors.length];
  var sw=document.getElementById('te-color-'+di);
  if(sw)sw.style.background=editDraft.days_arr[di].color;
}
```

- [ ] **Step 4: Verify in browser**

Open LA 2026 in admin mode, click Edit. Verify:
- 4 trip-level inputs show correct title/dates
- Editing Title EN updates the overlay header title in real time
- 6 day cards appear, each with date/color swatch/intensity/name/area fields
- Color swatch cycles through 6 colors on click
- Intensity dropdown works
- ✕ Day button is disabled when only 1 day remains (test by removing all but 1)
- "▶ Locations (N)" toggle opens/closes the location list

- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "feat: trip editor — trip fields + day cards render"
```

---

## Task 3: Location rows (expand/collapse + all fields)

**Files:**
- Modify: `index.html` (replace `renderEditorLocRow` stub)

- [ ] **Step 1: Implement `renderEditorLocRow`**

Replace `function renderEditorLocRow(loc,di,li){return '';}` with:
```javascript
function renderEditorLocRow(loc,di,li){
  var timeVal=typeof loc.time==='object'?(loc.time.en||loc.time.zh||''):String(loc.time||'');
  var lat=(loc.coords&&loc.coords[0]!=null)?loc.coords[0]:'';
  var lng=(loc.coords&&loc.coords[1]!=null)?loc.coords[1]:'';
  var reservationOpts=['free','must','rec','opt','fixed'];
  var specialOpts=['','arrival','departure','airbnb','hotel','viewpoint','sunset','drive','hiking','camping','restaurant','activity'];
  return '<div class="te-loc-row" data-di="'+di+'" data-li="'+li+'" id="te-loc-'+di+'-'+li+'">'+
    '<div class="te-loc-summary">'+
    '<span class="te-drag-handle" style="cursor:grab">≡</span>'+
    '<span class="te-loc-time">'+esc(timeVal)+'</span>'+
    '<span class="te-loc-name">'+esc((loc.name&&loc.name.en)||'(new)')+'</span>'+
    '<button class="te-expand-btn" onclick="teToggleLoc(\''+di+'-'+li+'\')" id="te-expbtn-'+di+'-'+li+'">▶</button>'+
    '<button class="te-remove-btn" style="padding:2px 7px;font-size:10px" onclick="teRemoveLocation('+di+','+li+')">✕</button>'+
    '</div>'+
    '<div class="te-loc-detail" id="te-loc-detail-'+di+'-'+li+'">'+
    '<div class="te-field-group"><label>Time</label><input class="te-input" value="'+esc(timeVal)+'" oninput="teSetLocTime('+di+','+li+',this.value)"></div>'+
    '<div class="te-field-group"><label>Special</label>'+
    '<select class="te-select" onchange="editDraft.days_arr['+di+'].locations['+li+'].special=this.value">'+
    specialOpts.map(function(v){return '<option value="'+v+'"'+(loc.special===v?' selected':'')+'>'+v+'</option>';}).join('')+
    '</select></div>'+
    '<div class="te-field-group"><label>Name ZH</label><input class="te-input" value="'+esc((loc.name&&loc.name.zh)||'')+'" oninput="editDraft.days_arr['+di+'].locations['+li+'].name.zh=this.value"></div>'+
    '<div class="te-field-group"><label>Name EN</label><input class="te-input" value="'+esc((loc.name&&loc.name.en)||'')+'" oninput="editDraft.days_arr['+di+'].locations['+li+'].name.en=this.value"></div>'+
    '<div class="te-field-group"><label>Lat</label><input class="te-input" type="number" step="0.000001" value="'+esc(lat)+'" oninput="teSetLocCoord('+di+','+li+',0,this.value)"></div>'+
    '<div class="te-field-group"><label>Lng</label><input class="te-input" type="number" step="0.000001" value="'+esc(lng)+'" oninput="teSetLocCoord('+di+','+li+',1,this.value)"></div>'+
    '<div class="te-field-group te-full"><label>Desc ZH</label><textarea class="te-textarea" oninput="editDraft.days_arr['+di+'].locations['+li+'].desc.zh=this.value">'+esc((loc.desc&&loc.desc.zh)||'')+'</textarea></div>'+
    '<div class="te-field-group te-full"><label>Desc EN</label><textarea class="te-textarea" oninput="editDraft.days_arr['+di+'].locations['+li+'].desc.en=this.value">'+esc((loc.desc&&loc.desc.en)||'')+'</textarea></div>'+
    '<div class="te-field-group te-full"><label>Notes ZH</label><textarea class="te-textarea" oninput="editDraft.days_arr['+di+'].locations['+li+'].notes.zh=this.value">'+esc((loc.notes&&loc.notes.zh)||'')+'</textarea></div>'+
    '<div class="te-field-group te-full"><label>Notes EN</label><textarea class="te-textarea" oninput="editDraft.days_arr['+di+'].locations['+li+'].notes.en=this.value">'+esc((loc.notes&&loc.notes.en)||'')+'</textarea></div>'+
    '<div class="te-field-group"><label>Reservation</label>'+
    '<select class="te-select" onchange="editDraft.days_arr['+di+'].locations['+li+'].reservation=this.value">'+
    reservationOpts.map(function(v){return '<option value="'+v+'"'+(loc.reservation===v?' selected':'')+'>'+v+'</option>';}).join('')+
    '</select></div>'+
    '<div class="te-field-group" style="flex-direction:row;align-items:center;gap:6px"><label>Optional</label>'+
    '<input type="checkbox" '+(loc.optional?'checked':'')+' onchange="editDraft.days_arr['+di+'].locations['+li+'].optional=this.checked"></div>'+
    '</div>'+
    '</div>';
}

function teToggleLoc(key){
  var detail=document.getElementById('te-loc-detail-'+key);
  var btn=document.getElementById('te-expbtn-'+key);
  if(!detail)return;
  var open=!detail.classList.contains('open');
  detail.classList.toggle('open',open);
  if(btn)btn.textContent=open?'▼':'▶';
}

function teSetLocTime(di,li,v){
  var loc=editDraft.days_arr[di].locations[li];
  if(typeof loc.time==='object'){loc.time.zh=v;loc.time.en=v;}
  else{loc.time=v;}
}

function teSetLocCoord(di,li,axis,v){
  var loc=editDraft.days_arr[di].locations[li];
  if(!loc.coords)loc.coords=[0,0];
  loc.coords[axis]=parseFloat(v)||0;
}
```

- [ ] **Step 2: Verify in browser**

Open LA 2026 editor. Expand a day's locations section. Click ▶ on a location row to expand it. Verify:
- All fields show correct existing values (time, name zh/en, lat/lng, desc zh/en, notes zh/en, reservation, special, optional)
- Editing name EN updates editDraft (check via browser console: `editDraft.days_arr[0].locations[0].name.en`)
- ▼/▶ toggle works for collapse/expand
- ✕ button appears on each location (click does nothing yet — implemented in Task 7)

- [ ] **Step 3: Commit**
```bash
git add index.html
git commit -m "feat: trip editor — location rows with all fields"
```

---

## Task 4: Drag-and-drop for days and locations

**Files:**
- Modify: `index.html` (replace `attachEditorListeners` stub)

- [ ] **Step 1: Implement `attachEditorListeners` with day and location drag**

Replace `function attachEditorListeners(){}` with:
```javascript
function attachEditorListeners(){
  attachEditorDayDrag();
  editDraft.days_arr.forEach(function(_,di){
    attachEditorLocDrag(di);
  });
}

function attachEditorDayDrag(){
  var cards=document.querySelectorAll('.te-day-card');
  var dragSrc=-1;
  cards.forEach(function(card){
    var handle=card.querySelector('.te-drag-handle[data-di]');
    if(!handle)return;
    handle.addEventListener('mousedown',function(){card.setAttribute('draggable','true');});
    card.addEventListener('dragstart',function(e){
      dragSrc=parseInt(card.dataset.di);
      card.classList.add('te-dragging');
      e.dataTransfer.effectAllowed='move';
    });
    card.addEventListener('dragend',function(){
      card.classList.remove('te-dragging');
      document.querySelectorAll('.te-day-card').forEach(function(c){c.classList.remove('te-drag-over');});
      card.setAttribute('draggable','false');
    });
    card.addEventListener('dragover',function(e){
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      if(dragSrc!==parseInt(card.dataset.di))card.classList.add('te-drag-over');
    });
    card.addEventListener('dragleave',function(){card.classList.remove('te-drag-over');});
    card.addEventListener('drop',function(e){
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove('te-drag-over');
      var src=dragSrc,dst=parseInt(card.dataset.di);
      if(src===dst||src<0)return;
      var moved=editDraft.days_arr.splice(src,1)[0];
      editDraft.days_arr.splice(dst,0,moved);
      renderTripEditor();
    });
  });
}

function attachEditorLocDrag(di){
  var list=document.getElementById('te-loclist-'+di);
  if(!list)return;
  var rows=list.querySelectorAll('.te-loc-row');
  var dragSrc=-1;
  rows.forEach(function(row){
    var handle=row.querySelector('.te-drag-handle');
    if(!handle)return;
    handle.addEventListener('mousedown',function(){row.setAttribute('draggable','true');});
    row.addEventListener('dragstart',function(e){
      dragSrc=parseInt(row.dataset.li);
      row.classList.add('te-dragging');
      e.dataTransfer.effectAllowed='move';
      e.stopPropagation(); // prevent day card from also dragging
    });
    row.addEventListener('dragend',function(){
      row.classList.remove('te-dragging');
      list.querySelectorAll('.te-loc-row').forEach(function(r){r.classList.remove('te-drag-over');});
      row.setAttribute('draggable','false');
    });
    row.addEventListener('dragover',function(e){
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect='move';
      if(dragSrc!==parseInt(row.dataset.li))row.classList.add('te-drag-over');
    });
    row.addEventListener('dragleave',function(){row.classList.remove('te-drag-over');});
    row.addEventListener('drop',function(e){
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove('te-drag-over');
      var src=dragSrc,dst=parseInt(row.dataset.li);
      if(src===dst||src<0)return;
      var locs=editDraft.days_arr[di].locations;
      var moved=locs.splice(src,1)[0];
      locs.splice(dst,0,moved);
      // Re-render just this day's location list
      var locsOpen=list.style.display!=='none';
      var day=editDraft.days_arr[di];
      var newLocHtml='';
      day.locations.forEach(function(loc,li){newLocHtml+=renderEditorLocRow(loc,di,li);});
      newLocHtml+='<button class="te-add-btn" onclick="addEditorLocation('+di+')">+ Add Location</button>';
      list.innerHTML=newLocHtml;
      list.style.display=locsOpen?'flex':'none';
      if(locsOpen)list.style.flexDirection='column';
      attachEditorLocDrag(di);
      // Update toggle label count
      var toggleBtn=list.previousElementSibling;
      if(toggleBtn)toggleBtn.textContent=(locsOpen?'▼':'▶')+' Locations ('+day.locations.length+')';
    });
  });
}
```

- [ ] **Step 2: Verify in browser**

Open LA 2026 editor. Test day drag:
1. Click and hold the ≡ handle on Day 2, drag it onto Day 4 — release
2. Day order should update: what was Day 4 is now before Day 2, re-numbered D1–D6

Test location drag:
1. Open a day's locations section
2. Click and hold a location's ≡ handle, drag it to a different position within the same day
3. Location order updates

Verify that dragging a location row does NOT accidentally drag its parent day card (stopPropagation).

- [ ] **Step 3: Commit**
```bash
git add index.html
git commit -m "feat: trip editor — drag-and-drop days and locations"
```

---

## Task 5: Add / Remove days and locations

**Files:**
- Modify: `index.html` (replace stub functions)

- [ ] **Step 1: Implement add/remove functions**

Replace these stubs:
```javascript
function addEditorDay(){}
function teRemoveDayClick(di){}
function addEditorLocation(di){}
function teRemoveLocation(di,li){}
```

With:
```javascript
function addEditorDay(){
  var colors=['#c9a85c','#5b8dd9','#7dd9a0','#e67e5a','#9b7dd9','#d9815b'];
  var last=editDraft.days_arr[editDraft.days_arr.length-1];
  var nextDate='';
  if(last&&last.date){
    var d=new Date(last.date);
    d.setDate(d.getDate()+1);
    nextDate=d.toISOString().substring(0,10);
  }
  editDraft.days_arr.push({
    date:nextDate,
    color:colors[editDraft.days_arr.length%colors.length],
    dayName:{zh:'',en:''},
    area:{zh:'',en:''},
    intensity:'moderate',
    locations:[],
    transit:[]
  });
  renderTripEditor();
  // Scroll to bottom so new card is visible
  var body=document.getElementById('tripEditBody');
  if(body)body.scrollTop=body.scrollHeight;
}

function teRemoveDayClick(di){
  var btn=document.getElementById('te-remove-day-'+di);
  if(!btn||btn.disabled)return;
  if(btn.dataset.confirm==='1'){
    editDraft.days_arr.splice(di,1);
    renderTripEditor();
  } else {
    btn.dataset.confirm='1';
    btn.classList.add('te-confirm');
    btn.textContent='Confirm?';
    setTimeout(function(){
      if(btn.dataset.confirm==='1'){
        btn.dataset.confirm='0';
        btn.classList.remove('te-confirm');
        btn.textContent='✕ Day';
      }
    },3000);
  }
}

function addEditorLocation(di){
  var locs=editDraft.days_arr[di].locations;
  locs.push({
    id:'e_'+Date.now()+'_'+locs.length,
    time:'',
    name:{zh:'',en:''},
    coords:[0,0],
    mapsLink:'',
    desc:{zh:'',en:''},
    notes:{zh:'',en:''},
    reservation:'free',
    special:'',
    optional:false
  });
  // Re-render just this day's location list
  var list=document.getElementById('te-loclist-'+di);
  if(list){
    var locsOpen=list.style.display!=='none';
    var day=editDraft.days_arr[di];
    var newLocHtml='';
    day.locations.forEach(function(loc,li){newLocHtml+=renderEditorLocRow(loc,di,li);});
    newLocHtml+='<button class="te-add-btn" onclick="addEditorLocation('+di+')">+ Add Location</button>';
    list.innerHTML=newLocHtml;
    list.style.display='flex';
    list.style.flexDirection='column';
    attachEditorLocDrag(di);
    var toggleBtn=list.previousElementSibling;
    if(toggleBtn)toggleBtn.textContent='▼ Locations ('+day.locations.length+')';
    // Scroll new location into view
    var lastRow=list.querySelector('.te-loc-row:last-of-type');
    if(lastRow)lastRow.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
}

function teRemoveLocation(di,li){
  editDraft.days_arr[di].locations.splice(li,1);
  var list=document.getElementById('te-loclist-'+di);
  if(list){
    var locsOpen=list.style.display!=='none';
    var day=editDraft.days_arr[di];
    var newLocHtml='';
    day.locations.forEach(function(loc,li2){newLocHtml+=renderEditorLocRow(loc,di,li2);});
    newLocHtml+='<button class="te-add-btn" onclick="addEditorLocation('+di+')">+ Add Location</button>';
    list.innerHTML=newLocHtml;
    if(locsOpen){list.style.display='flex';list.style.flexDirection='column';}
    attachEditorLocDrag(di);
    var toggleBtn=list.previousElementSibling;
    if(toggleBtn)toggleBtn.textContent=(locsOpen?'▼':'▶')+' Locations ('+day.locations.length+')';
  }
}
```

- [ ] **Step 2: Verify in browser**

Test Add Day:
1. Click "+ Add Day" at the bottom of the day list
2. A new card appears with auto-incremented date, next color in rotation
3. All fields are empty and editable

Test Remove Day:
1. Click "✕ Day" on a day card — button turns red and shows "Confirm?"
2. Click again within 3 seconds — day is removed, editor re-renders
3. With only 1 day remaining, the ✕ Day button is disabled (greyed out)
4. Click elsewhere without confirming — button resets to "✕ Day" after 3 seconds

Test Add Location:
1. Open a day's locations section
2. Click "+ Add Location" — blank location row appears at bottom

Test Remove Location:
1. Click ✕ on a location row — location is immediately removed (no confirmation)

- [ ] **Step 3: Commit**
```bash
git add index.html
git commit -m "feat: trip editor — add/remove days and locations"
```

---

## Task 6: Save logic + Gist extension

**Files:**
- Modify: `index.html` (replace `saveTripEditor` stub, extend `buildSyncPayload` and `applyGistData`)

- [ ] **Step 1: Add `tripEdits` to the Gist sync payload**

Find `function buildSyncPayload(){` and replace its body:
```javascript
function buildSyncPayload(){
  var p={v:1,checkins:checkins,bookings:bookings,expenses:expenses,adhocLocs:adHocLocations,at:new Date().toISOString()};
  if(Object.keys(tripEdits).length>0)p.tripEdits=tripEdits;
  return JSON.stringify(p);
}
```

Find `async function applyGistData(data){` and add after the existing 4 lines (before closing `}`):
```javascript
  if(data.tripEdits){
    Object.keys(data.tripEdits).forEach(function(id){
      var e=data.tripEdits[id];
      if(!e||!e.days_arr)return;
      tripEdits[id]=e;
      if(TRIP_DATA[id]){
        TRIP_DATA[id].days_arr=JSON.parse(JSON.stringify(e.days_arr));
        TRIP_DATA[id].t_obj=makeGenericT(e.nameZh,e.nameEn,e.subZh,e.subEn,e.days_arr.length);
        var tripEntry=TRIPS.find(function(tr){return tr.id===id;});
        if(tripEntry){tripEntry.name_zh=e.nameZh;tripEntry.name_en=e.nameEn;tripEntry.dates_zh=e.subZh;tripEntry.dates_en=e.subEn;}
      }
    });
  }
```

- [ ] **Step 2: Implement `saveTripEditor`**

Replace `function saveTripEditor(){}` with:
```javascript
async function saveTripEditor(){
  if(!editDraft||!activeTripId)return;
  var saveBtn=document.getElementById('teSaveBtn');
  var statusEl=document.getElementById('teStatus');
  if(saveBtn)saveBtn.disabled=true;
  statusEl.textContent='Saving…';

  // Commit draft to TRIP_DATA
  var td=TRIP_DATA[activeTripId];
  td.days_arr=editDraft.days_arr;
  td.t_obj=makeGenericT(editDraft.nameZh,editDraft.nameEn,editDraft.subZh,editDraft.subEn,editDraft.days_arr.length);

  // Update TRIPS selector entry
  var tripEntry=TRIPS.find(function(tr){return tr.id===activeTripId;});
  if(tripEntry){
    tripEntry.name_zh=editDraft.nameZh;
    tripEntry.name_en=editDraft.nameEn;
    tripEntry.dates_zh=editDraft.subZh;
    tripEntry.dates_en=editDraft.subEn;
  }

  // Regenerate mapsLink for all locations from coords
  td.days_arr.forEach(function(day){
    day.locations.forEach(function(loc){
      if(loc.coords&&(loc.coords[0]||loc.coords[1])){
        loc.mapsLink='https://www.google.com/maps/search/?api=1&query='+loc.coords[0]+','+loc.coords[1];
      }
    });
  });

  // Record in tripEdits for Gist persistence
  tripEdits[activeTripId]={
    nameZh:editDraft.nameZh,nameEn:editDraft.nameEn,
    subZh:editDraft.subZh,subEn:editDraft.subEn,
    days_arr:JSON.parse(JSON.stringify(editDraft.days_arr))
  };

  // Re-bind module globals
  t=td.t_obj;days=td.days_arr;

  // Keep currentDay in bounds
  if(currentDay>=days.length)currentDay=days.length-1;
  if(currentDay<0)currentDay=0;

  // Update DOM title/sub
  document.getElementById('topTitle').textContent=t[lang].title;
  document.getElementById('topSub').textContent=t[lang].sub;
  document.getElementById('tripViewName').textContent=t[lang].title;

  // Re-render trip view
  renderDayTabs();
  renderTimeline();
  if(tripMap)renderMap();

  // Close overlay
  editDraft=null;
  document.getElementById('tripEditOverlay').style.display='none';

  // Push to Gist (best-effort)
  var tk=getGithubToken();
  if(!tk){
    statusEl.textContent='Saved locally. No token — Gist sync skipped.';
    if(saveBtn)saveBtn.disabled=false;
    return;
  }
  try{
    await pushToGist();
    // Show brief toast since overlay is closed
    showEditorToast('✓ Saved & synced to Gist');
  }catch(e){
    showEditorToast('⚠ Saved locally — Gist sync failed: '+(e.message||e));
  }
  if(saveBtn)saveBtn.disabled=false;
}

function showEditorToast(msg){
  var toast=document.getElementById('teToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='teToast';
    toast.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:9px 18px;font-size:12px;color:var(--text);z-index:4000;transition:opacity .4s';
    document.body.appendChild(toast);
  }
  toast.textContent=msg;
  toast.style.opacity='1';
  clearTimeout(toast._t);
  toast._t=setTimeout(function(){toast.style.opacity='0';},3500);
}
```

- [ ] **Step 3: Verify in browser**

Test Save (with GitHub token set):
1. Open LA 2026 editor
2. Change Day 1's name EN to "Modified Arrival Day"
3. Add a blank location to Day 2
4. Click "Save & Sync ↑"
5. Overlay closes; trip view re-renders showing updated Day 1 name
6. Map re-renders (may flicker)
7. Toast appears: "✓ Saved & synced to Gist"

Test cross-device restore (pull from Gist):
1. In the Sync tab of the trip assistant (ℹ button → Sync tab), click Pull
2. Reload the page fresh
3. The edits should be restored (LA 2026 Day 1 name still shows "Modified Arrival Day")

Test Save without token:
1. Clear GitHub token: `localStorage.removeItem('github_token')` in browser console, reload
2. Open editor, edit something, Save
3. Overlay closes, changes appear in trip view
4. Toast shows "Saved locally. No token — Gist sync skipped."

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "feat: trip editor — save logic + extend Gist sync with tripEdits"
```

---

## Task 7: End-to-end test + push to GitHub

**Files:**
- Modify: `index.html` (bug fixes only if needed)

- [ ] **Step 1: Full workflow test on LA 2026**

In admin mode, open LA 2026 trip. Click Edit. Perform all these actions:
1. Change Title EN to "LA – Onion Valley 2026 (edited)"
2. Drag Day 3 to Day 1 position — verify day order updates
3. Open Day 1 (was Day 3), expand its first location
4. Change Name EN to something new, change Lat/Lng slightly
5. Add a new location to Day 2 — expand it, fill in name "Test Stop"
6. Remove the test location you just added (click ✕)
7. Add a new day — verify it appears at bottom with tomorrow's date
8. Remove the new day (two-click confirmation)
9. Click "Save & Sync ↑"

Verify:
- Trip view shows updated title in topbar and back bar
- Day tabs show new order
- Timeline shows updated location name
- Map re-renders with updated markers at new coords
- Toast shows sync success

- [ ] **Step 2: Verify Gist restore**

1. Open Sync tab (ℹ → Sync → Pull)
2. Confirm pull — existing Gist data merged
3. Hard-reload the page (`Ctrl+Shift+R`)
4. Open LA 2026 — title should still be "LA – Onion Valley 2026 (edited)"

- [ ] **Step 3: Fix any bugs found during testing**

Common issues to watch for:
- `editDraft.days_arr[i].dayName` is undefined for new days → already handled (template sets `{zh:'',en:''}`)
- `renderMap()` errors if location has `coords:[0,0]` → map adds a marker at 0,0 which is acceptable
- `currentDay` out-of-bounds after removing days → already handled in `saveTripEditor`
- After saving, the Edit button may disappear → re-add it: in `saveTripEditor`, after `document.getElementById('tripViewName').textContent=t[lang].title;`, add the same edit button injection logic from Task 1 Step 4

If the Edit button disappears after save, add this to `saveTripEditor` after updating `tripViewName`:
```javascript
  // Re-inject edit button (topTitle update may have cleared it)
  var existingEditBtn=document.getElementById('tripEditBtn');
  if(existingEditBtn)existingEditBtn.remove();
  if(isAdminMode()){
    var editBtn=document.createElement('button');
    editBtn.id='tripEditBtn';
    editBtn.className='trip-edit-btn';
    editBtn.textContent='✏ Edit';
    editBtn.onclick=openTripEditor;
    document.getElementById('tripViewName').parentNode.insertBefore(editBtn,document.getElementById('tripViewName').nextSibling);
  }
```

- [ ] **Step 4: Push to GitHub**
```bash
git add index.html
git commit -m "feat: admin trip editor — drag reorder, inline edit, add/remove, Gist sync"
git push
```

After pushing, wait ~60 seconds for GitHub Pages to rebuild, then verify at `https://danielcodyy.github.io/DanSpikes` that the trip editor works end-to-end in the live site.
