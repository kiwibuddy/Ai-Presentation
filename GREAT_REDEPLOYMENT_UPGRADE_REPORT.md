# The Great Redeployment — Upgrade Report (Original → Final)

**Purpose:** Use this document in a **new project** when you have a fresh HTML deck and want to re-apply the **premium UI/UX**, **live AI demos** (voice + image/video), and **Vercel-backed APIs** from this finished iteration.

**Scope:** This report describes what was **added or changed** relative to a **typical earlier single-file deck** (simple crossfade navigation, block `.anim` fades, no serverless demos). It is **not** a line-by-line diff against a lost binary “original” file — it is a **feature and architecture inventory** you can implement again.

**Primary deliverables in this repo:**

| Item | Role |
|------|------|
| `The_Great_Redeployment.html` | Single-file deck: markup + large `<style>` + `<script>` |
| `api/*.js` | Vercel serverless routes (keys never in browser) |
| `vercel.json` | Root rewrite + function timeouts/memory |
| `package.json` | `"type": "module"` for ESM `import` in `/api` |
| `.env.example` | Documents required env vars (do not commit secrets) |

---

## 1. Executive summary

| Area | What changed |
|------|----------------|
| **Navigation / motion** | Replaced “always the same” feel with **clip-path wipes** (multiple directions), **3D perspective** on exit, **curtain** exits for session dividers, **scan-line flash**, **mesh-gradient** overlays on some dark slides; **rotating wipe directions** so transitions vary slide-to-slide. |
| **Reveals** | **Per-word** token splits (`.w-split` → `.tk-w`), **number scramble** on selected stats, **SVG stroke-draw** classes, **typewriter** quotes (`.quote-box blockquote`, `.brain-rule`), **magnetic hover** on card types, **particle burst** on S19 optimism cards. |
| **Discussion (D1–D4)** | **One question at a time** (hidden blocks + Space to advance), **conic-gradient countdown ring** (pause/resume on click). |
| **QoL** | **Speaker notes window** (`?speaker=1` + `BroadcastChannel`), **sessionStorage** slide recovery after reload, **image preload** hook for adjacent slides, **particle play-state** tied to active slide, **QR scan counter** via `/api/qr-hit`. |
| **Layout / density** | Global **larger typography** and **taller cards** (stat cards, level cards, info panels, callouts) so content fills the viewport more like a stage deck. |
| **Live demos** | Two slides: **voice clone** (after dark-side / S15 area) and **image→video** (after positive case / S19 area), both calling **same-origin `/api/*`** with graceful degradation when offline or on `file://`. |
| **Hosting** | **Vercel** project with **Node serverless** functions (not Edge in this implementation), CORS + simple rate limits in `api/_util.js`. |

---

## 2. New project layout (besides the HTML)

```
api/
  _util.js           # CORS helpers, IP, sliding-window rate limit
  clone-voice.js    # POST → ElevenLabs create voice (multipart)
  tts.js            # POST → ElevenLabs TTS stream (MP3)
  image-to-video.js # POST fal queue submit; GET poll status + fetch result
  health.js         # GET { ok, hasEleven, hasFal }
  qr-hit.js         # POST increments in-memory scan counter; GET returns count
vercel.json
package.json        # "type": "module"
.env.example
The_Great_Redeployment.html
```

---

## 3. HTML / CSS — premium UI & UX (what to port)

### 3.1 Deck shell

- **`#deck`**: `perspective: 1800px` for subtle 3D on slide exit.
- **Slide states**: `.pre-active` (incoming under outgoing), `.exiting` + variant classes for animation.
- **`data-transition="none"`** on **demo slides** so heavy clip animations do not fight custom demo UI.

### 3.2 Transition system (`go()` + CSS)

**Session dividers** (`.slide-inner.session-div`):

- **Curtain** clip-path exit (`exiting--curtain`).
- **Scanline** child `<div class="scanline">` inside each session divider; JS adds `.scan-active` briefly on enter.
- **Split session titles** (`.session-div-title.line-reveal` + `.session-split-top` / `.session-split-bot`).

**Standard slides**:

- **Rotating wipe sequence** (variable `wipeCycle`): cycles through  
  `exiting--wipe-fwd` → `exiting--wipe-dtu` → `exiting--wipe-utd` → `exiting--wipe-back`  
  so direction changes every navigation (less monotonous than a single wipe).
- Each wipe pairs with a slight **scale + rotateX + translateZ** in keyframes.

**Dark slides / overlays**:

- **`.mesh-grad`** on some `.ov-dk` overlays with slow `meshDrift` animation.

**Reduced motion**:

- `@media (prefers-reduced-motion: reduce)` and/or `html.reduce-motion-override` strip complex motion to short opacity fades.

### 3.3 Reveal & micro-interaction primitives

| Mechanism | Where / how |
|-----------|-------------|
| **Word split** | `initWordSplits()` + `.w-split` → `.tk-w`; stagger via `--ti` in `runSlideIn`. |
| **Title clip (S00)** | `.title-word-clip` for “The Great / Redeployment” style reveals. |
| **Scramble stats** | `.count-up[data-scramble]` + `scrambleCount()`. |
| **SVG stroke draw** | Paths with `.stroke-anim` + `.svg-drawn` on slide enter. |
| **Typewriter** | `twQuotes(slide)` on `.quote-box blockquote` and `.brain-rule`. |
| **Magnetic cards** | `mousemove` sets `--mx`, `--my`, `--rx`, `--ry` on listed card selectors. |
| **S19 burst** | `s19Bursts()` injects short-lived particles on green stat cards. |
| **S02 3D stat flip** | `.stat-flip3d` + `s02Flip()`. |
| **S13 donut** | `#donut-9010` with `@property --p10` + `.don-anim`; mini `.cal-mini` fill animation. |
| **S18 bars** | `.hbar-anim` + synced `%` label in `animCharts()` via `requestAnimationFrame`. |
| **S18 gap flash** | `.callout.lime.gap-data` shares `gapFlashLime` keyframes with `.gap-flash`. |
| **Reflective verse** | `#refl`, `#refl-verse-float` delayed `.in` class. |
| **Contact spotlight** | `#contact-photo-wrap` + `.spot-in` CSS variable animation. |

### 3.4 Discussion slides (D1–D4)

- Markup: `.d-slide`, `data-d-min="25"` (etc.), `.disc-q-block.hidden-qs` for unrevealed questions.
- **Space** on a discussion slide advances **one question** before advancing the deck (`discNext`).
- **`#disc-timer`**: conic ring driven by `--dt-p`; click toggles pause; `freezeL` stores remaining time.

### 3.5 Quality-of-life UI

| Feature | Behaviour |
|---------|-----------|
| **Crash recovery** | `sessionStorage` key `gr-slide`; restored in `finishVideo()` after intro skip. |
| **Preload** | `#preload-links` populated on slide change for adjacent background images. |
| **Particles** | `particlesForSlide()` pauses off-slide particle animations. |
| **Speaker view** | `?speaker=1` shows `#speaker-root`; main window posts slide updates on `BroadcastChannel('gr-deck')`. **Important:** `.speaker-panel[hidden]{display:none!important}` so the panel does not cover the deck when hidden. |
| **Notes button / Alt+N** | Opens speaker window. |
| **QR counter** | `#slide-qr` → `POST /api/qr-hit`; updates `#qr-hits`. |

### 3.6 “Full page” layout pass (density)

Global CSS increases (for stage-like slides):

- **`.s-body` / `.s-body.top`**: more vertical distribution (`space-evenly` on `.top`).
- **Larger** `.s-title.*`, `.s-sub`, `.stat-card`, `.s-num`, `.s-label`, `.level-card` (+ `min-height`), `.info-shift` width, `.is-title` / `.is-desc`, `.brain-*`, `.callout` padding/type.

Port these as a **block of overrides** in your new deck’s `<style>` if you are merging into different class names.

---

## 4. JavaScript engine (navigation & hooks)

**Core variables:** `cur`, `trans`, `started`, `slides`, `total`, `wipeCycle`, `disIdx`.

**Key functions:**

| Function | Role |
|----------|------|
| `getTransType(el)` | `none` if `data-transition="none"`; `curtain` if session divider; else wipe. |
| `go(n)` | Orchestrates exit class, `animationend` + timeout safety, updates `cur`, fires `deck-slide` event, `updNav()`. |
| `runSlideIn(slide)` | Token delays, line reveals, SVG draw, counts/scrambles, session divider scan, S02/S13/S18/S19 hooks, preload, particles, `discSetup`, `sessionStorage`. |
| `finishVideo()` | Ends intro; restores slide index from `sessionStorage`; activates correct slide. |
| `discSetup` / `discNext` | Timer + progressive questions. |

---

## 5. Demo A — Voice clone (`#demo-voice`)

### 5.1 Placement & UX

- Full slide **after the dark-side / S15 block** (voice as “dark side capability” beat).
- `data-transition="none"` on the slide.
- Left: **waveform** (`#vo-wave` + `.wave-b` bars) + **Record / Stop**.
- Right: textarea + **Clone from recording** + **Speak as clone**.
- Copy explains HTTPS + consent; footer cites ElevenLabs + TTL delete.

### 5.2 Client flow (browser)

1. **`getHealth()`** → `GET /api/health` — requires `hasEleven: true` for a smooth path (otherwise user sees a clear message).
2. **Record** — `getUserMedia` + `MediaRecorder` (prefers `audio/webm;codecs=opus`).
3. **Stop** — builds `Blob`, reads as **base64** (strip `data:...;base64,` prefix).
4. **Clone** — `POST /api/clone-voice` JSON `{ audioBase64, mime: 'audio/webm' }` → `{ voiceId }`.
5. **Speak** — `POST /api/tts` JSON `{ voiceId, text }` → binary **MP3** → `URL.createObjectURL` → `Audio` play.

### 5.3 Server (`api/clone-voice.js`)

- Validates JSON body, decodes base64, builds **`FormData`** with `name` + `files` for ElevenLabs **`POST https://api.elevenlabs.io/v1/voices/add`**.
- Returns `{ voiceId }`.
- Schedules **`DELETE /v1/voices/{voiceId}`** after ~5 minutes (TTL cleanup).
- Rate limit: **8 / IP / minute** (adjust in file).

### 5.4 Server (`api/tts.js`)

- **`POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}/stream`**
- Model in code: **`eleven_flash_v2_5`** (if your account errors, change model id in this file).
- Returns **`audio/mpeg`** buffer.

### 5.5 How to test Demo A (checklist)

1. Deploy to **HTTPS** (or localhost with API on same origin).
2. Set **`ELEVENLABS_API_KEY`** in Vercel env → redeploy.
3. Open `/api/health` → confirm **`hasEleven: true`**.
4. Open deck → navigate to **Voice demo** slide.
5. Click **Record 15s** → allow mic → **Stop** (or wait auto-stop).
6. **Clone from recording** → wait for success message.
7. Edit sentence → **Speak as clone** → audio should play.
8. **Failure modes to expect**
   - `file://` — mic / mixed content issues; use deployed URL.
   - Missing key — `/api/health` shows `hasEleven: false`; clone returns 503-style JSON.

---

## 6. Demo B — Image → video (`#demo-i2v`)

### 6.1 Placement & UX

- Full slide **after positive-case / S19** area.
- `data-transition="none"`.
- Columns: **drop zone + file input** (`capture="user"`), **prompt textarea**, **Generate** + output region.
- **Floating pill** `#i2v-pill` — stays visible while you teach other slides; updates on `deck-slide` + poll ticks (`setI2vPill`, `tickI2vPill`).
- **`Cmd+Shift+F`** toggles `window.demoBMode` between **`i2v`** and **`img`** (faster Flux image fallback). Label updates in `#i2v-fallback-lbl`.

### 6.2 Client flow

1. **`getHealth()`** — prefers `hasFal: true`.
2. User loads image → `dataUrl` (data URL string).
3. **`POST /api/image-to-video`** body:
   - `{ imageBase64, prompt, mode: 'i2v'|'img', engine: 'seedance' }`  
   (engine is wired in client as `'seedance'` in the shipped version; server supports `'kling'` too.)
4. Response: `{ requestId, model }`.
5. **Poll** `GET /api/image-to-video?requestId=...&model=...` every **4s** (image mode uses **3s** interval in client).
6. When `done: true`, render `<video>` or `<img>` from `videoUrl` / `imageUrl`.

### 6.3 Server (`api/image-to-video.js`)

- **Queue base:** `https://queue.fal.run`
- **Default i2v model:** `bytedance/seedance-2.0/image-to-video`
- **Optional engine:** `fal-ai/kling-video/v1/standard/image-to-video`
- **Image fallback model:** `fal-ai/flux/dev` when `mode === 'img'`
- **POST** submits `{ input: { ... } }` to `POST {QUEUE}/{model}`
- **GET** polls `{QUEUE}/{model}/requests/{requestId}/status` then fetches **`response_url`** (or `/response`) when status is **`COMPLETED`**
- Extracts URLs via **`pickVideoUrl` / `pickImageUrl`** (multiple possible response shapes).

### 6.4 How to test Demo B (checklist)

1. Set **`FAL_KEY`** in Vercel → redeploy.
2. `/api/health` → **`hasFal: true`**.
3. On demo slide: pick a **small** JPEG/PNG (fast upload).
4. **Generate** — pill should show **Submitting…** then **Rendering… mm:ss**.
5. Navigate away and back — pill should still update until complete.
6. Result: **MP4** in `<video controls autoplay loop playsinline>` or **image** if in `img` mode.
7. Press **`Cmd+Shift+F`** → retry in **image** mode for a quicker fallback test.

**Failure modes**

- Wrong / missing `FAL_KEY` → 503 JSON from API.
- Model input schema drift on fal → check Vercel function logs; adjust `input` object in `api/image-to-video.js`.
- Large images → stay under Vercel body limits; compress test images.

---

## 7. Vercel connection (end-to-end)

### 7.1 Environment variables (Vercel → Settings → Environment Variables)

| Variable | Required for |
|----------|----------------|
| `ELEVENLABS_API_KEY` | Demo A + `/api/health.hasEleven` |
| `FAL_KEY` | Demo B + `/api/health.hasFal` |
| `ALLOWED_ORIGINS` (optional) | Extra origins for CORS (see `api/_util.js`) |

Use **`.env.example`** as the checklist. Never commit real keys.

### 7.2 `vercel.json` (this repo)

- **Rewrite:** `/` → `/The_Great_Redeployment.html` (so the deck is the homepage).
- **Function limits:** longer `maxDuration` + more memory on `clone-voice` and `image-to-video` (heavy payloads).

### 7.3 `package.json`

- **`"type": "module"`** so `api/*.js` can use `import` / `export`.

### 7.4 CORS + rate limiting

- Implemented in **`api/_util.js`** (`setCors`, `preflight`, `rateLimit`, `getClientIP`).
- Each route calls **`preflight`** for `OPTIONS` and sets CORS on responses.

### 7.5 Browser → API base URL

In the HTML:

```js
const API_BASE = (location.protocol === 'file:') ? 'https://ai-and-discipleship.vercel.app' : '';
```

**Meaning:**

- On **`https://your-deployment/...`** all `/api/*` calls are **same-origin** (`API_BASE` empty).
- On **`file://`** opens, demos try the **hard-coded** production host so you can still smoke-test (mic may still be blocked by browser policy — prefer HTTPS for real rehearsals).

**When you fork to a new domain:** change that fallback string to your new Vercel URL (or remove `file://` fallback entirely).

---

## 8. Porting checklist (apply to your *new* HTML deck)

Use this as a work order in the next repo:

1. **Copy** `api/` folder, `vercel.json`, `package.json`, `.env.example`.
2. **Merge CSS blocks** from this deck’s `<style>` into yours (transitions, reveals, discussion, demos, layout density).
3. **Merge JS blocks** — at minimum:
   - `go()` / `runSlideIn()` / `getTransType()` / reduced motion
   - Discussion timer + progressive questions
   - `API_BASE`, `getHealth()`, `initDemoVoice()`, `initDemoI2V()`, pill logic
   - Speaker view + `BroadcastChannel`
   - `sessionStorage` restore + preload + QR hook (optional)
4. **Add HTML** for:
   - `#disc-timer`, `#i2v-pill`, `#speaker-root`, `#preload-links`
   - Demo slides with correct **ids** (`demo-voice`, `demo-i2v`) and **controls** matching JS selectors
5. **Wire Vercel** env vars and deploy.
6. Run **§5.5** and **§6.4** test checklists on the **deployed HTTPS URL**.

---

## 9. Known design decisions / caveats

- **Serverless runtime:** Node functions with `Buffer`, `FormData`, `Blob` — not Vercel Edge in this codebase.
- **QR counter:** in-memory per server instance (resets on cold start). For durable counts use Vercel KV / DB (out of scope here).
- **Speaker panel:** must keep **`[hidden]` + `display:none`** rule or it can cover the deck on some browsers.
- **Demo slide transitions disabled** intentionally (`data-transition="none"`).

---

## 10. Quick reference — API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | `{ ok, hasEleven, hasFal }` |
| `/api/clone-voice` | POST | `{ audioBase64, mime?, name? }` → `{ voiceId }` |
| `/api/tts` | POST | `{ voiceId, text }` → MP3 bytes |
| `/api/image-to-video` | POST | Submit fal queue job → `{ requestId, model }` |
| `/api/image-to-video` | GET | `?requestId=&model=` → `{ done, videoUrl?, imageUrl?, state?, raw? }` |
| `/api/qr-hit` | POST / GET | Increment / read scan counter |

---

*End of report — safe to commit or upload alongside your new deck source.*
