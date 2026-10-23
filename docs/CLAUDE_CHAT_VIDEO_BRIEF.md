# Brief for Claude chat (Higgsfield connector): DeliveryHub concept video, under 40 s

**How to use:** open a new Claude chat with the Higgsfield connector enabled. Attach these 3 real app screenshots from `deliveryhub/docs/screenshots/`:
- `2-door-right-address.png`
- `3-door-wrong-address.png`
- `4-homeowner-feed.png`

Then paste everything below the line.

---

You are producing a **short concept video (36–38 seconds, 16:9)** with the Higgsfield tools. Work step by step, show me results at each checkpoint, and keep characters, location and style **identical across every shot**.

## The idea (what the video must communicate)

**DeliveryHub for Ring** is an app for Ring video doorbells. Today Ring knows that *a* package is at the door, but not *which* one, or whether it was even meant for this house. With DeliveryHub, the delivery driver just holds the shipping label up to the doorbell camera, hands-free (no button: his hands are full). Within a few seconds the system reads the label and:
- **Right house, expected package:** a small screen by the door turns green and speaks the homeowner's instruction for that package ("This is medication, please put it in the cooler box"). A lockable **Delivery Box** next to the door unlocks for 60 seconds. The driver puts the parcel in and closes the lid, and the box locks. The homeowner's app shows "Package secured" with a photo.
- **Wrong house:** the screen turns red ("Wait, this package is for 42 Oak St"). The box stays locked, and the driver takes the parcel next door.
- **Thief:** someone pulls the box lid without a verified delivery. It stays shut, its light flashes red, and the homeowner gets an alert.

The app and its screens are real (the attached screenshots). **The Delivery Box is a concept:** the software exists, the hardware doesn't. The video should feel warm, calm and trustworthy, like a short product film. No tech jargon.

## Hard rules

1. **Consistency:** generate 3 reference images first (Step 1), then attach them as `image_references` to *every* later image and video. Reuse the STYLE and CAST text below **word for word** in every prompt.
2. **No logos or brand marks** anywhere in generated images (no Ring, Amazon, UPS, USPS, FedEx). Generic doorbell, plain uniform, plain van.
3. **Don't invent app UI.** Shots that show a screen must be animated from the attached real screenshots.
4. **16:9** for everything. **Silent clips** (`generate_audio: false`): audio is added later in the edit.
5. **Budget:** the workspace has about **100 credits**. Before generating any video, tell me the cost per clip. If 7 clips at `seedance_2_0` won't fit in about 80 credits, use `seedance_2_0_mini` instead. Never spend more than 95 credits in total without asking me.
6. **Checkpoints:** stop and show me (a) the 3 reference images and (b) the start frames before you generate any videos.

## STYLE (start every image and video prompt with this)

```
Photorealistic cinematic film still, 35mm lens, soft natural light, warm suburban morning, muted teal and warm-wood colour grade, shallow depth of field, 16:9. No text, no logos, no brand marks.
```

## CAST (paste the parts needed, word for word)

```
HOUSE: a light-grey craftsman house with a navy-blue front door, brass house number 123, a white porch with three wooden steps, a large terracotta planter with a fern to the left of the door.
DOORBELL: a small black rectangular video doorbell with a round camera lens and a glowing ring-shaped button, mounted to the right of the door at chest height, no logo.
BOX: a grey weatherproof parcel box about 60x40x40 cm standing on the porch to the right of the door, hinged lid, a small round status light on the front.
DRIVER: a delivery driver in his 30s, short black hair, trimmed beard, plain navy polo shirt and plain navy cap with no logo, khaki cargo shorts.
```
Box light colours: **white = locked, teal = unlocked, green = secured, red = alert.**

---

## Step 1: Reference images (`nano_banana_pro`, resolution 2k). CHECKPOINT A

| ID | Aspect | Prompt (STYLE + this) |
|---|---|---|
| R1 porch | 16:9 | `Establishing shot of the HOUSE front porch with the DOORBELL and the BOX, sunny morning, empty, eye level from the front walkway.` + HOUSE, DOORBELL, BOX |
| R2 driver | 3:4 | `Character reference sheet of the DRIVER on a plain light-grey studio background: full body front view and three-quarter view side by side, neutral expression, holding a small cardboard parcel.` + DRIVER |
| R3 box detail | 16:9 | `Product-style close-up of the BOX on the same porch as the reference, lid closed, status light glowing white, navy door partly visible.` + BOX (attach R1 as image reference) |

Show me R1–R3 and wait for my OK. Regenerate any I reject.

## Step 2: Start frames (`nano_banana_pro`, 2k, 16:9, attach the listed references). CHECKPOINT B

| Shot | Attach | Prompt (STYLE + needed CAST + this) |
|---|---|---|
| F1 | R1 | `The same porch as the reference, but overcast and raining; a soggy cardboard parcel sits on the bottom step; wet boards and puddles; no people.` |
| F2 | R1, R2 | `Close-up: the DRIVER holds a cardboard parcel with both hands, its white shipping label about 10 cm in front of the DOORBELL's camera lens; navy door behind.` |
| F3 | R1, R2, R3 | `The DRIVER on the porch lifting the hinged lid of the BOX with one hand, holding a small cardboard parcel with a blue sticker in the other; the box status light glows teal.` |
| F4 | R1, R2, R3 | `The DRIVER on the porch reading a parcel label with a slightly puzzled expression; the BOX beside him with its status light white; the neighbouring house visible across the lawn.` |
| F5 | R1, R3 | `Evening on the same porch, warm porch light on, a person in a dark hoodie with their face hidden pulling at the closed lid of the BOX; the status light glows red; high security-camera angle from above the door.` |
| F6 end card | none | `Minimal dark navy title card, centred white text "DeliveryHub for Ring", smaller teal text below "The doorbell that checks the package", lots of empty space, no other elements.` (use `nano_banana_pro` for clean text) |

Show me F1–F5 next to R1 so I can confirm the porch, box and driver match. Wait for my OK.

## Step 3: Videos (`seedance_2_0`, mode `std`, 720p, 5 s, `generate_audio: false`, or `seedance_2_0_mini` per the budget rule)

For generated shots, use the start frame as `start_image` and attach the same references again as `image_references`. One action per clip, static camera unless stated.

| Clip | start_image | refs | Motion prompt |
|---|---|---|---|
| V1 | F1 | R1 | `Steady rain falls on the porch and the soaked parcel; slow gentle push-in toward the parcel; nothing else moves.` |
| V2 | F2 | R1, R2 | `The driver holds the parcel with both hands, label steady in front of the camera lens; the doorbell's ring light glows softly as it reads the label. Static close-up.` |
| V3 | **attached screenshot `2-door-right-address.png`** | none | `Subtle slow push-in on this screen; the green check mark gently pulses once. Keep all text and UI exactly as in the image, do not add or change any text.` |
| V4 | F3 | R1, R2, R3 | `He lowers the parcel into the box and closes the lid; the status light on the box changes from teal to green. Static medium shot.` |
| V5 | **attached screenshot `3-door-wrong-address.png`** | none | `Subtle slow push-in on this screen; the red X gently pulses once. Keep all text and UI exactly as in the image, do not add or change any text.` |
| V6 | F4 | R1, R2, R3 | `He looks at the label, shakes his head slightly, turns and walks off the porch toward the neighbouring house. The box light stays white.` |
| V7 | F5 | R1, R3 | `The hooded person pulls the box lid twice but it does not open; the red light blinks; they step back and walk away. Static high angle.` |

The 4th screenshot (`4-homeowner-feed.png`) is used as a **still** in the edit, so no generation is needed for it.

If a clip distorts the box, the face or the screen text, regenerate only that clip, once. If the text in V3/V5 still changes, tell me and we'll use the screenshot as a still instead.

## Step 4: Deliver

Give me a table with **every final asset URL** (R1–R3, F1–F6, V1–V7) and its credit cost, plus the edit timeline below, so I can assemble the video locally:

| Time | Asset | Caption | Sound (added later) |
|---|---|---|---|
| 0:00–0:04 | V1 | "Ring knows *a* package is here. Not *which* one." | rain |
| 0:04–0:08 | V2 | "Just hold the label up. Hands-free." | soft chime |
| 0:08–0:12 | V3 | "✓ Right house: your instruction, spoken" | real app voice: "…This is medication. Please put it in the cooler box." |
| 0:12–0:17 | V4 | "Box unlocks → parcel in → box locks" · tag "Concept" | lock click |
| 0:17–0:20 | screenshot `4-homeowner-feed.png` (still, slow zoom in the edit) | "Package secured, with photo proof" | soft ping |
| 0:20–0:23 | V5 (first 3 s) | "✕ Wrong house" | real app voice: "Wait, this package is for 42 Oak St…" |
| 0:23–0:27 | V6 (first 4 s) | "Box stays locked" | footsteps |
| 0:27–0:32 | V7 | "No verified label, no unlock" · tag "Concept" | tug, alarm chirp |
| 0:32–0:37 | F6 (still) | — | VO: "DeliveryHub for Ring. It knows which package, and whether it belongs here." |

**Total: 37 seconds.**
