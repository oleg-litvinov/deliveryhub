# Making the 60-second concept video in Higgsfield

**Result:** a 58-second film. A driver scans the label at a Ring-style doorbell, the right package goes into the Delivery Box and it locks, the wrong package is turned away, and a thief can't get in.
**Time:** about 2 hours. **Tools:** Higgsfield (web), the live DeliveryHub app for screen recordings, and any editor (CapCut, iMovie, or the ffmpeg command at the end).

**How consistency works:** you first make **3 reference images** (porch, driver, homeowner). Every still after that is generated *with those references attached*, and every video clip is animated *from* one of those stills. Stills are cheap, so you fix them until they match. Videos are expensive, so you only animate stills you're happy with.

---

## Step 0: Before you start (5 min)

1. Check your credits: you have **100**. In Higgsfield, open the video generator, pick **Seedance 2.0**, set 720p / 5 s, and note the credit cost it shows. You need **8 clips**.
   - If 8 × that cost is more than about 80 credits, use **Seedance 2.0 Mini** (same settings) for all clips, or drop shots **2** and **9** (the film still works at about 48 s).
2. Create a folder on your computer: `concept/` with subfolders `refs/`, `frames/`, `clips/`, `screen/`, `audio/`.
3. **Settings for every generation:** aspect ratio **16:9**, no text, no logos.

### The two lines you paste into every prompt

**STYLE** (put this at the start of every prompt):
```
Photorealistic cinematic film still, 35mm lens, soft natural light, warm suburban morning, muted teal and warm-wood colour grade, shallow depth of field, 16:9. No text, no logos, no brand marks.
```

**CAST** (paste the descriptions you need, word for word, every time):
```
HOUSE: a light-grey craftsman house with a navy-blue front door, brass house number 123, a white porch with three wooden steps, a large terracotta planter with a fern to the left of the door.
DOORBELL: a small black rectangular video doorbell with a round camera lens and a glowing ring-shaped button, mounted to the right of the door at chest height, no logo.
BOX: a grey weatherproof parcel box about 60x40x40 cm on the porch to the right of the door, hinged lid, a small round status light on the front.
DRIVER: a delivery driver in his 30s, short black hair, trimmed beard, plain navy polo shirt and plain navy cap with no logo, khaki cargo shorts.
HOMEOWNER: a woman in her late 30s, South Asian, shoulder-length dark hair, mustard-yellow cardigan over a white top, small gold earrings.
```
Status light colours: **white = locked, teal = unlocked, green = secured, red = alert.**

---

## Step 1: Three reference images (Nano Banana Pro, 2k, 16:9 or 3:4)

Generate 2–4 versions of each and keep the best one. **Save it; you'll attach it to everything after this.**

| File | Model | Aspect | Prompt (STYLE + this) |
|---|---|---|---|
| `refs/R1-porch.png` | Nano Banana Pro | 16:9 | `Establishing shot of the HOUSE front porch with the DOORBELL and the BOX, sunny morning, empty, eye level from the front walkway. [paste HOUSE, DOORBELL, BOX]` |
| `refs/R2-driver.png` | Nano Banana Pro | 3:4 | `Character reference sheet of the DRIVER on a plain light-grey studio background: full body front view and three-quarter view side by side, neutral expression, holding a small cardboard parcel. [paste DRIVER]` |
| `refs/R3-priya.png` | Nano Banana Pro | 3:4 | `Character reference sheet of the HOMEOWNER on a plain light-grey studio background: full body front view and three-quarter view side by side, gentle smile. [paste HOMEOWNER]` |

**Check before moving on:** the box is clearly grey with a front light, the door is navy, there's no logo anywhere, and both characters look like real people with the same clothes in both views.

---

## Step 2: Eight start frames (Nano Banana Pro, 2k, 16:9, with references attached)

For each shot, attach the listed reference images as **image references** and use STYLE + CAST + the prompt. Regenerate until the porch, box and person match the references, then save it to `frames/`.

| # | File | Attach | Prompt (STYLE + CAST lines needed + this) |
|---|---|---|---|
| 1 | `F1-rain.png` | R1 | `The same porch as the reference image, but overcast and raining, a soggy cardboard parcel sitting on the bottom step, wet boards, puddles, no people.` |
| 2 | `F2-priya-office.png` | R3 | `The HOMEOWNER sitting at a bright modern office desk looking at her smartphone with a calm, focused expression, laptop beside her, soft window light, medium shot.` |
| 3 | `F3-arrive.png` | R1, R2 | `The DRIVER walking up the front path toward the HOUSE carrying two small cardboard parcels, seen from behind and slightly to the side, sunny morning, the BOX and DOORBELL visible on the porch.` |
| 4 | `F4-scan.png` | R1, R2 | `Close-up: the DRIVER's hand holds a white shipping label about 10 cm in front of the DOORBELL's camera lens; his other index finger is just about to press the glowing doorbell button; navy door behind.` |
| 6 | `F6-deposit.png` | R1, R2 | `The DRIVER on the porch lifting the hinged lid of the BOX with one hand and holding a small cardboard parcel with a blue sticker in the other; the box status light glows teal.` |
| 8 | `F8-wrong.png` | R1, R2 | `The DRIVER on the porch reading a parcel label with a slightly puzzled expression; the BOX beside him with its status light glowing white; the neighbouring house visible across the lawn.` |
| 9 | `F9-thief.png` | R1 | `Evening on the same porch, warm porch light on, a person in a dark hoodie with their face hidden pulling at the closed lid of the BOX; the box status light glows red; high security-camera angle from above the door.` |
| 10 | `F10-home.png` | R1, R3 | `Evening on the same porch, warm porch light, the HOMEOWNER opening the lid of the BOX and smiling as she lifts out a small parcel with a blue sticker.` |

**Tip:** if the box keeps changing shape, add `exactly like the box in the reference image` to the prompt, and attach R1 first.

---

## Step 3: Animate the eight frames (Seedance 2.0, 720p, 5 s, audio OFF)

For each clip:
1. Upload the start frame as the **start image**.
2. Attach the same references again as **image references**.
3. Set mode **std** (or Seedance 2.0 Mini if you're short on credits).
4. Turn **audio off**: you'll add the real app voice and sound later, so audio stays consistent across clips.

Keep the camera static unless a shot says otherwise, and give each clip one action.

| # | Start image | Motion prompt | Save as |
|---|---|---|---|
| 1 | F1 | `Steady rain falls on the porch and the soaked parcel; slow, gentle push-in toward the parcel. Nothing else moves.` | `clips/C1.mp4` |
| 2 | F2 | `She taps her phone screen twice, then gives a small satisfied nod. Static camera.` | `clips/C2.mp4` |
| 3 | F3 | `The driver walks up the path and climbs the porch steps toward the door. Smooth tracking shot from behind.` | `clips/C3.mp4` |
| 4 | F4 | `The hand holds the label steady in front of the camera lens, then the index finger presses the doorbell button and the button glows brighter. Static close-up.` | `clips/C4.mp4` |
| 6 | F6 | `He lowers the parcel into the box and closes the lid; the status light on the box changes from teal to green. Static medium shot.` | `clips/C6.mp4` |
| 8 | F8 | `He looks at the label, shakes his head slightly, turns and walks off the porch toward the neighbouring house. The box light stays white.` | `clips/C8.mp4` |
| 9 | F9 | `The hooded person pulls the box lid twice but it does not open; the red light blinks; they step back and walk away. Static high angle.` | `clips/C9.mp4` |
| 10 | F10 | `She lifts a parcel out of the box, closes the lid and smiles. Static medium shot.` | `clips/C10.mp4` |

If a clip warps the box or the face, regenerate **that clip only**. Don't change the start frame.

---

## Step 4: Screen recordings from the real app (15 min, no credits)

These shots show the real product. Open https://dgnb2hmunowzj.cloudfront.net on a laptop and use QuickTime (File → New Screen Recording) at 1080p.

1. **Reset:** open `/home` → Settings → **Reset demo data**.
2. **`screen/S5-door-right.mov`:** open `/sim` in one window and `/door` in another (side by side, or record only `/door`). On `/door`, click **"Tap to enable voice"**. In `/sim`, keep **Medication** and press **🔔**. Record `/door` turning green, speaking, and showing the box as **"Unlocked for driver"**. Click **Lift lid**, then **Close lid**. About 8 s.
3. **`screen/S7-home-secured.mov`:** open `/home` at phone size (Chrome DevTools → device toolbar → iPhone 14). Record the feed card and the box showing **"Package secured"**. About 3 s.
4. **`screen/S8-door-wrong.mov`:** in `/sim`, choose **Neighbor's package** and press 🔔. Record `/door` turning red and saying *"Wait, this package is for 42 Oak St…"*. About 4 s.
5. **`screen/S9-tamper.mov`:** run this in the terminal, then record `/home` showing the red **tamper banner**. About 2 s.
   ```bash
   curl -s -X POST -H 'content-type: application/json' -d '{"action":"force"}' https://dgnb2hmunowzj.cloudfront.net/api/box/lid
   ```
6. **`screen/S10-remote-unlock.mov`:** on `/home`, click **Acknowledge**, then **Remote unlock**. Record it. About 2 s.
7. Finish with **Settings → Reset demo data**.

The Polly voice in S5 and S8 is the real product voice, so keep that audio.

---

## Step 5: Voice-over (5 min)

Record on your phone in a quiet room and save to `audio/`:
- `VO1.m4a`: "Ring knows *a* package is at your door. Not *which* one."
- `VO2.m4a`: "Unexpected packages? I decide."
- `VO3.m4a`: "DeliveryHub for Ring. Ring knows a package is there. DeliveryHub knows which one, and whether it belongs here."

Plus 3 free sound effects (e.g. from pixabay.com/sound-effects): rain, doorbell chime, lock click.

---

## Step 6: Edit to 58 seconds

| Time | Picture | Sound | On-screen text |
|---|---|---|---|
| 0:00–0:04 | C1 (rain) | rain SFX + **VO1** | — |
| 0:04–0:08 | C2 (Priya at the office, first 4 s) | — | "Expected: Mom's medication · *put it in the cooler box*" |
| 0:08–0:12 | C3 (driver arrives, 4 s) | footsteps | — |
| 0:12–0:16 | C4 (label → press) | doorbell chime | "Show the label. Press the bell." |
| 0:16–0:24 | S5 (Door Display green, box unlocked) | **real Polly voice** | "✓ Right house · box unlocked for 60 s" |
| 0:24–0:29 | C6 (parcel in, lid closes, light green) | lock click | "Package in. Box locked." · **"Concept"** corner tag |
| 0:29–0:32 | S7 (app: Package secured) | — | "Secured in box · photo proof" |
| 0:32–0:36 | S8 (Door Display red) | **real Polly voice** | "✕ Wrong house" |
| 0:36–0:40 | C8 (driver walks next door) | — | "Box stays locked" |
| 0:40–0:45 | C9 (thief, 5 s) | tug + alarm chirp | "No verified label, no unlock" · **"Concept"** |
| 0:45–0:47 | S9 (tamper banner) | — | — |
| 0:47–0:52 | C10 + S10 (remote unlock, Priya opens the box) | **VO2** | "Human in the loop" · **"Concept"** |
| 0:52–0:58 | End card: dark background, "DeliveryHub for Ring" + live URL | **VO3** | "Ring API + AWS · github.com/oleg-litvinov/deliveryhub" |

Export **1080p, H.264, 30 fps**. Upload to YouTube (Unlisted or Public). Use it as a standalone teaser, or put its first 25 s in front of the Devpost demo. The total must stay under 3:00.

### Optional: rough cut with ffmpeg (no editor)

If you name the trimmed pieces `01.mp4` … `13.mp4` in timeline order (all 1920×1080, 30 fps):
```bash
cd concept && for f in 0*.mp4 1*.mp4; do echo "file '$f'"; done > list.txt && ffmpeg -f concat -safe 0 -i list.txt -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac concept.mp4
```
Ask Claude to do the trimming, scaling, captions and audio mix once the clips are in `concept/`. It can run ffmpeg locally.

---

## Rules to keep

- **"Concept"** tag on every shot that shows the physical box.
- **No logos** in generated shots (Ring, Amazon, UPS, USPS). The doorbell is a generic one.
- The app shown is the **real live app**. Don't fake UI in generated shots.
- Budget fallback: Seedance 2.0 Mini for all clips, or drop C2 and C9 (about 48 s).
