# Concept video: "The doorbell that checks the package"

**Length:** about 75 s (a 25 s cut for the opening of the Devpost demo video is at the bottom)
**Purpose:** show the *idea* in a real-world setting: a driver scans the label at a Ring doorbell, the right package gets the homeowner's instruction and goes into the Delivery Box, the box locks, and the wrong package and a porch thief are both turned away.
**Tone:** calm, warm, a little suspense. No tech talk until the last line.
**Honesty label:** show **"Concept"** in a corner whenever the physical Delivery Box is on screen. We built the software and simulated the box, not the hardware.
**No push notifications yet:** the app shows banners and feed updates when it's open, so the phone shots show the app screen, not lock-screen notifications.
**Trademarks:** show a generic video doorbell and generic carrier vans and uniforms. No Ring, Amazon, UPS or USPS logos on props.

## Cast and props

- **Driver:** carrier uniform with no logo, carrying 2 parcels.
- **Homeowner (Priya):** at work, with a phone.
- **Porch:** a front door, a video doorbell, and a planter.
- **Delivery Box:** a grey weatherproof box (about 60 × 40 × 40 cm), a small status light on the front (white = locked, teal = unlocked, green = secured, red = alert), and a lid on a hinge.
- **Parcels:** one labelled "123 Maple St" (with a small blue "Rx / keep cool" sticker); one labelled "42 Oak St".
- **Phone:** the DeliveryHub homeowner app, as a screen recording of `/home`.
- **Door Display:** a small screen by the door showing `/door`. Its audio is the Polly voice.

---

## Script

| # | Time | Picture | Sound / voice-over (VO) | On-screen text |
|---|---|---|---|---|
| 1 | 0:00–0:06 | Rainy porch, wide shot. A parcel sits soaked on the step. Cut to a phone notification: "Package delivered". The homeowner frowns: *which* one? | Rain. Notification ping. | — |
| 2 | 0:06–0:12 | A different day, sunny. Priya at her office desk opens DeliveryHub and adds "Mom's medication" with the instruction *"This is medication. Please put it in the cooler box."* | **VO (Priya):** "I know what I'm expecting. I just need the doorbell to know too." | "Expected: Mom's medication" |
| 3 | 0:12–0:20 | The delivery van pulls up. The driver walks to the door, sees a small sticker next to the doorbell: *"Delivering? Just show the label to the camera."* | Footsteps. | — |
| 4 | 0:20–0:27 | **Close-up:** the driver, both hands on the parcel, simply holds the label about a hand's width from the doorbell lens. No button. Cut to the camera's POV (fisheye frame, label filling it). | Soft chime from the Door Display. | "Just hold the label up. Hands-free." |
| 5 | 0:27–0:35 | Door Display turns **green ✓ "Right address"**. The Delivery Box light turns **teal** with an audible *click* (unlocked). | **Door voice (Polly):** "Thanks, this is the right address. This is medication. Please put it in the cooler box. The delivery box is open for you." | "✓ Right house · Box unlocked for 60 s" + "Concept" |
| 6 | 0:35–0:42 | The driver lifts the lid, places the medication parcel inside and closes the lid. The light turns **green**, *clunk* (locked). The driver walks away. | Lid thud, lock clunk. | "Package in. Box locked." |
| 7 | 0:42–0:47 | Priya glances at the DeliveryHub app: **"Mom's medication: Secured in box"** with the doorbell photo. She smiles and goes back to work. | — | "Secured in box · photo proof" |
| 8 | 0:47–0:55 | Same driver, second parcel ("42 Oak St"). Holds the label up. The Door Display turns **red ✕**. The box light stays **white**: no click. The driver checks the label, nods, and walks next door. | **Door voice:** "Wait, this package is for 42 Oak Street. This is 123 Maple Street." | "✕ Wrong house · Box stays locked" |
| 9 | 0:55–1:03 | Evening. A hooded stranger walks up and tugs the box lid. The light flashes **red**. Cut to the DeliveryHub app on Priya's phone: the red banner **"Delivery box opened without a verified delivery"**. The stranger leaves. | Tug, alarm chirp. | "No verified label → no unlock" |
| 10 | 1:03–1:10 | Priya at home in the evening taps "Remote unlock" for an unexpected gift a neighbor left, then gets her packages out of the box. | **VO (Priya):** "Unexpected packages? I decide." | "Human in the loop" |
| 11 | 1:10–1:15 | End card: the DeliveryHub logo over the porch. | **VO:** "DeliveryHub for Ring. Ring knows a package is there. DeliveryHub knows which one, and whether it belongs here." | "DeliveryHub for Ring · built on the Ring API + AWS" |

---

## Box behaviour shown (it must match the real software)

| Moment | Box state in the app | Rule from [DELIVERY_BOX.md](DELIVERY_BOX.md) |
|---|---|---|
| Shot 5 | `UNLOCKED` (60 s single-use token) | Right house + expected package + barcode match |
| Shot 6 | `OPEN` → `SECURED` | Lid opened with a valid token, then closed |
| Shot 8 | stays `LOCKED` (and any open window re-locks) | A failed scan never unlocks, and re-locks if needed |
| Shot 9 | `TAMPER` | Lid opened without a valid token |
| Shot 10 | `UNLOCKED` by the homeowner | Remote unlock = human in the loop |

You can show every state on screen with the live app: run `/sim` → `/door` (Lift lid / Close lid), and test tampering from the box's "force open" path (`POST /api/box/lid {"action":"force"}`).

---

## How to make it fast

**Option A, screen-only (fastest, about 1 h).** Use shots 2, 4–8 and 10 as screen recordings of the live demo console (`/`). Replace the live-action porch with still photos or stock footage of a porch, a driver and a doorbell, and add the box as a simple animated graphic (the `DeliveryBoxArt` lid animation from the app, scaled up). Record the voice-over on a phone.

**Option B, AI-generated shots.** Generate the live-action shots (1, 3, 4, 6, 8, 9) as 4–6 s clips, then cut them together with screen recordings of the real app for the phone and Door Display (shots 2, 5, 7, 10). Keep the real app UI real, and generate only the porch scenes. Prompts:

- **Shot 1:** "Rainy suburban front porch, a cardboard parcel getting soaked on the step, overcast light, handheld, cinematic, 16:9"
- **Shot 3:** "Delivery driver in a plain navy uniform without logos walks up a sunny suburban path to a front door holding two parcels, medium shot, natural light"
- **Shot 4:** "Close-up: a delivery driver holds a parcel with both hands, its shipping label about 10 cm from a small video doorbell camera, shallow depth of field"
- **Shot 6:** "A driver lifts the lid of a grey weatherproof parcel box beside a front door, places a small parcel inside and closes the lid; a small status light on the box turns green; daytime"
- **Shot 8:** "Delivery driver looks at a parcel label, shakes head slightly, and walks toward the neighbouring house, suburban street, daytime"
- **Shot 9:** "Evening porch, a hooded stranger tugs at the lid of a locked grey parcel box, a small red light flashes on the box, the stranger walks away, security-camera angle"

**Audio:** use the real Door Display voice. Open `/door`, tap "enable voice" and screen-record it, so the Polly lines in shots 5 and 8 are exactly what the product says.

---

## 25-second cut (opening of the Devpost demo video)

| Time | Shot | VO / sound |
|---|---|---|
| 0:00–0:04 | Shot 1 (soaked parcel) | "Ring knows *a* package is here. Not *which* one." |
| 0:04–0:10 | Shot 4 (label held up to the doorbell, hands-free) | Soft chime |
| 0:10–0:16 | Shot 5 + 6 (green ✓, box unlocks, parcel in, box locks) | Polly: "…This is medication. Please put it in the cooler box. The delivery box is open for you." |
| 0:16–0:21 | Shot 8 (red ✕, box stays locked) | Polly: "Wait, this package is for 42 Oak Street." |
| 0:21–0:25 | Shot 7 (phone: Secured in box) → cut to the live demo console | "This is DeliveryHub for Ring. Here's how it works." |

Then continue with the demo script from [SUBMISSION.md](SUBMISSION.md) §8, starting at the 0:15 beat. The total still has to stay under 3:00.
