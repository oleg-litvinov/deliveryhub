# Higgsfield production plan: concept video

Turns [CONCEPT_VIDEO_SCRIPT.md](CONCEPT_VIDEO_SCRIPT.md) into generated shots. Characters, location and style stay consistent because every shot starts from the same reference images.

**Pipeline:** 3 reference stills → 1 start frame per shot (generated *from* the references) → animate each start frame → cut together with the real app screen recordings and the real Polly voice.

**Models (from the account's catalogue):**
- Stills: **Nano Banana Pro** (`nano_banana_pro`, 2k, 16:9). It takes multiple `image_references`, which is what keeps identity consistent.
- Video: **Seedance 2.0** (`seedance_2_0`, `mode: std`, 720p, 5 s, `generate_audio: false`). It takes `start_image` plus `image_references` ("consistent identity").

Audio is added in the edit: the real Door Display voice and our own voice-over. That keeps generated audio from drifting between shots.

---

## 0. Style bible (paste at the start of EVERY prompt)

> **STYLE:** photorealistic, cinematic, 35 mm lens, soft natural light, warm suburban Pacific-Northwest morning, muted teal-and-warm-wood colour grade, shallow depth of field, 16:9, no text, no logos, no brand marks.

**Fixed descriptions (reuse word for word):**
- **HOUSE:** "a light-grey craftsman house with a navy-blue front door, brass house number 123, a white porch with three wooden steps, a large terracotta planter with a fern to the left of the door"
- **DOORBELL:** "a small black rectangular video doorbell with a round camera lens and a glowing ring-shaped button, mounted right of the door at chest height, no logo"
- **BOX:** "a grey weatherproof parcel box about 60×40×40 cm on the porch right of the door, hinged lid, small round status light on the front"
- **DRIVER (Marcus):** "a delivery driver in his 30s, short black hair, trimmed beard, navy polo shirt and navy cap with no logo, khaki cargo shorts, carrying small cardboard parcels"
- **HOMEOWNER (Priya):** "a woman in her late 30s, South Asian, shoulder-length dark hair, mustard-yellow cardigan over a white top, small gold earrings"
- **STATUS LIGHT:** white = locked, teal = unlocked, green = secured, red = alert

---

## 1. Reference stills (generate first; pick the best of 2–4 each)

| ID | Model | Prompt (after the STYLE line) | Inputs |
|---|---|---|---|
| **R1 Porch** | nano_banana_pro 16:9 | "Establishing shot of HOUSE front porch with DOORBELL and BOX, daytime, empty, eye level from the front walkway." | — |
| **R2 Driver** | nano_banana_pro 3:4 | "Full-body character sheet of DRIVER standing on a plain light-grey background: front view and three-quarter view, neutral expression." | — |
| **R3 Priya** | nano_banana_pro 3:4 | "Full-body character sheet of HOMEOWNER standing on a plain light-grey background: front view and three-quarter view, gentle smile." | — |

Lock these three images. **Every later generation uses R1 plus whichever of R2/R3 are on screen as `image_references`.**

---

## 2. Start frames (nano_banana_pro 16:9, references as listed)

| Shot | Refs | Start-frame prompt (after STYLE) |
|---|---|---|
| S1 | R1 | "Same porch as the reference, overcast and raining, a soggy cardboard parcel sitting on the bottom step, wet boards, puddles, no people." |
| S2 | R3 | "HOMEOWNER at a bright office desk looking at her smartphone, laptop beside her, soft window light, medium shot." |
| S3 | R1, R2 | "DRIVER walking up the front path toward HOUSE carrying two parcels, seen from behind and to the side, sunny morning." |
| S4 | R1, R2 | "Close-up: DRIVER's hand holding a parcel label about 10 cm in front of DOORBELL's camera lens, his other index finger about to press the glowing button." |
| S6 | R1, R2 | "DRIVER on the porch lifting the hinged lid of BOX with one hand, holding a small parcel in the other, the box status light glowing teal." |
| S8 | R1, R2 | "DRIVER on the porch reading a parcel label with a slightly puzzled look, BOX beside him with its status light white, the neighbouring house visible across the lawn." |
| S9 | R1 | "Evening on the same porch, warm porch light on, a person in a dark hoodie with face hidden tugging at the closed lid of BOX, the box status light glowing red, security-camera angle from above the door." |
| S10 | R1, R3 | "Evening, HOMEOWNER on the porch opening BOX and smiling, taking out two small parcels, warm porch light." |

---

## 3. Animate (seedance_2_0, std, 720p, 5 s, audio off)

Pass the shot's start frame as `start_image` and the same refs as `image_references`. Keep the motion simple: one action per clip.

| Shot | Motion prompt |
|---|---|
| S1 | "Rain falls steadily, slow push-in toward the soaked parcel. Nothing else moves." |
| S2 | "She taps her phone twice and nods slightly. Static camera." |
| S3 | "The driver walks up the path and steps onto the porch. Smooth tracking from behind." |
| S4 | "The hand holds the label steady in front of the lens; the index finger presses the doorbell button, which glows brighter. Static close-up." |
| S6 | "He lowers the parcel into the box and closes the lid; the status light changes from teal to green. Static medium shot." |
| S8 | "He looks at the label, shakes his head slightly, turns and walks toward the neighbouring house. The box light stays white." |
| S9 | "The hooded person tugs the lid twice; it doesn't open; the red light blinks; they step back and leave. Static high angle." |
| S10 | "She lifts the lid, takes out two parcels and smiles. Static medium shot." |

Shots 5, 7 and the phone close-ups in 2 and 10 are **not generated**. They are screen recordings of the live app:
- `/door` turning green, with the box "Unlocked" and "Lift lid";
- `/home` showing "Secured in box", the tamper banner and "Remote unlock".

This keeps the UI real.

---

## 4. Edit (ffmpeg or any editor)

1. Follow the order and timings in CONCEPT_VIDEO_SCRIPT.md. Trim each 5 s clip to its slot.
2. Overlay "Concept" in the top-right corner on S6, S9 and S10 (the box shots).
3. Audio: rain, footsteps and chime from a free SFX library, plus the real Polly lines recorded from `/door` with voice enabled, plus our voice-over.
4. Export 1080p H.264. Keep the 25 s cut for the start of the Devpost video.

---

## Budget and status

- **Shots to generate:** 3 reference sets (about 2–4 images each) + 8 start frames + 8 five-second videos.
- **Credits:** the workspace has **100** (Plus plan). The connector can't show per-generation costs. Check the price shown in the Higgsfield UI before running: 8 Seedance clips may need more than 100 credits. If they do, switch S1/S3/S8 to `seedance_2_0_mini` or `grok_video_v15_lite`, but keep the same start frames so consistency holds.
- **Blocker for doing this from Claude:** the connected Higgsfield integration exposes only read-only tools in this session (balance, model catalogue, history, import). Generation needs the full tool set enabled for the connector.
