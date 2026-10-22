# Devpost submission pack: DeliveryHub for Ring

Deadline: **Fri Oct 23, 2026, 12:00 PM PT.** Devpost allows edits until then, so submit early and keep editing.
Every field below is ready to paste. Only the 🧑 items need you.

---

## Checklist

- [ ] 🧑 Record and upload the video (script below), **< 3:00**, public on YouTube, in English.
- [ ] 🧑 Devpost → Enter a Submission → paste the fields below.
- [ ] 🧑 Upload the gallery images from `docs/screenshots/` (in order).
- [ ] 🧑 Add all team members on Devpost.
- [x] Public GitHub repo with an MIT licence that GitHub detects (shown in About): https://github.com/oleg-litvinov/deliveryhub
- [x] The repo uses the track tech at runtime: `backend/src/ring/*` calls the Ring Partner API (`oauth.ring.com`, `api.amazonvision.com`) from the deployed Lambdas.
- [x] Live, judge-tryable demo with no login: https://dgnb2hmunowzj.cloudfront.net
- [x] Product feedback, friction log and feature requests (below).
- [ ] 🧑 Optional: send the Ring sandbox request (bottom of this file). If access arrives before the deadline, add a real-device clip to the video.

---

## 1. Basics

**Project name:** DeliveryHub for Ring

**Elevator pitch** (200 characters max):
> Show the label to your Ring doorbell: DeliveryHub confirms it's the right house, tells the driver your instructions for that package, and logs photo proof.

**Try it out links**
- https://dgnb2hmunowzj.cloudfront.net (live demo console, no login)
- https://github.com/oleg-litvinov/deliveryhub

**Video:** `🧑 YouTube URL`

**Built with:**
`ring-partner-api` `ring-appstore-mcp` `aws-lambda` `amazon-api-gateway` `amazon-dynamodb` `amazon-s3` `amazon-cloudfront` `amazon-bedrock` `amazon-nova` `amazon-textract` `amazon-polly` `amazon-cloudwatch` `aws-x-ray` `aws-sam` `typescript` `node.js` `react` `vite` `tailwindcss` `zxing`

**Tracks and challenges:** Ring (primary track) + AWS Builder (mini challenge)

**Was this built during the submission period?** Yes. It was built from scratch; the first commit is Oct 18, 2026, and the full history is public.

---

## 2. Gallery (upload in this order)

| File | Caption |
|---|---|
| `docs/screenshots/6-demo-console.png` | The whole flow on one screen: driver at the door → Door Display → homeowner app |
| `docs/screenshots/2-door-right-address.png` | Right house: the driver sees and hears the homeowner's instruction for *this* package, and the Delivery Box unlocks |
| `docs/screenshots/3-door-wrong-address.png` | Wrong house: "Wait, this package is for 42 Oak St." The box stays locked. |
| `docs/screenshots/4-homeowner-feed.png` | Homeowner feed: photo proof, the address read vs. the home address, why, and which reader decided |
| `docs/screenshots/1-simulator.png` | Doorbell Simulator: the same signed Ring webhook through the same pipeline, with wide-angle optics simulated |
| `docs/screenshots/5-ring-account-link.png` | Ring account linking: the required sign-in plus a plain-language consent before any data is collected |
| `docs/screenshots/7-architecture.png` | Architecture with Well-Architected pillar labels |
| `docs/screenshots/0-door-idle.png` | Door Display waiting for a delivery |

---

## 3. About the project (story)

Paste **[`DEVPOST_STORY.md`](DEVPOST_STORY.md)** as-is. It's the draft with every link made absolute and image links removed (upload images to the gallery instead).

---

## 4. AWS Builder mini challenge: which AWS services and how

> DeliveryHub's backend is a 9-service serverless pipeline, defined in one AWS SAM template (`infra/template.yaml`) and deployed in us-east-2:
> - **AWS Lambda** (Node.js 22, arm64): `webhook` verifies Ring's HMAC signature and dedupes on `request_id`, then async-invokes `worker` and ACKs in under a second. `worker` fetches Ring frames, decodes barcodes (zxing-wasm), reads the label, decides, applies the Delivery Box policy and speaks the instruction. `api` serves the app and simulator. `ringAuth` handles Ring's Token Exchange and Account Link URLs.
> - **Amazon API Gateway (HTTP API)**: Ring webhook, account-linking and app endpoints, with throttling.
> - **Amazon Bedrock (Amazon Nova Lite, Converse API with image input)**: reads the ship-to address and tracking number as JSON. The prompt never asks for names.
> - **Amazon Textract (DetectDocumentText)**: automatic OCR fallback, plus our deterministic ship-to parser. Our project's Bedrock daily-token quota is applied at 0 (documented in the friction log), so the live demo and the 120-case eval run on this path. The code switches back to Bedrock automatically once the quota is fixed.
> - **Amazon Polly**: the driver-facing voice. Clips are cached in S3 by hash. It falls back to the standard engine where neural isn't offered.
> - **Amazon DynamoDB**: a single table for packages, scans, Delivery Box state, Ring tokens, idempotency keys (TTL) and an audit log.
> - **Amazon S3**: doorbell photos and audio, with a **30-day lifecycle rule** that enforces the retention promise. Plus the static web app.
> - **Amazon CloudFront**: one origin for the app and the API, and a CloudFront Function for SPA routing.
> - **Amazon CloudWatch + AWS X-Ray**: Embedded Metric Format (`ScanLatencyMs` by verdict), a dashboard, and tracing on every Lambda.
>
> Dev workflow: we queried the **Ring Appstore Knowledge MCP server** from our coding agent to implement the webhook signature, image download and one-way account-linking specs exactly.

---

## 5. Product feedback (required, for every tool used)

Answers are in [`PRODUCT_FEEDBACK.md`](PRODUCT_FEEDBACK.md), in the five-part structure Devpost asks for: (1) tools and what for, (2) what worked well, (3) what needs work, (4) onboarding, (5) would you build with it again. Paste each tool's section.

🧑 Add one line about **your own** Ring onboarding experience in the "Onboarding" line of the Ring section. A draft based on what happened:
> Registering and creating a private app in the Ring Developer Portal was quick, and the credentials CSV download is convenient. But we could never reach a first `GET /v1/devices`: there's no device, and no documented way into the sandbox, so everything past account linking ran on our simulator.

---

## 6. Feature requests (optional)

| # | Request | Why it matters | Priority |
|---|---|---|---|
| 1 | **Audio playback on the doorbell's outdoor speaker** (short MP3 or text-to-speech; consented and rate-limited) | Every visitor-facing app (deliveries, accessibility, caretaking) needs to talk to the person at the door. Today only the indoor Chime can play app audio. | Critical |
| 2 | **Self-serve sandbox / virtual doorbell**: upload an image or clip, fire `button_press` / `motion_detected` | Teams without hardware can't test webhooks or snapshots. The docs mention a sandbox with synthetic devices but no way in. | Important |
| 3 | **"Live" still capture on button press**, or documented image latency after an event | Event-driven vision apps need the frame *at* the press. `at_timestamp` returns existing frames (±10 s) and the delay isn't documented. | Important |
| 4 | **Full-resolution still** (sensor resolution rather than the stream's) | Reading text and barcodes needs pixels. Our eval shows barcodes only decode within ≈ 9 cm at 1080p. | Nice-to-have |
| 5 | **OpenAPI spec + per-resource docs pages** | The reference is one 370k-character page, and code generation needs a spec. | Nice-to-have |

---

## 7. Friction log entries (optional, up to +10% bonus)

Paste each entry from [`FRICTION_LOG.md`](FRICTION_LOG.md). Each one already has task, steps, expected vs. actual, severity, workaround and suggestion:

1. No third-party audio on the doorbell speaker (High)
2. No official simulator, and no documented path into the sandbox (High)
3. The sample app's webhook auth differs from the documented HMAC `X-Signature` (Medium)
4. The API reference is a single ~370k-character page (Low–Medium)
5. Snapshot timing for event-driven apps is undocumented: existing frames only, ±10 s (Medium)
6. Amazon Polly neural voices are unavailable in us-east-2 (Medium)
7. The Bedrock tokens-per-day quota is applied at 0 on the project (High)

---

## 8. Video script (target 2:40; judges stop at 3:00)

**Setup before recording:**
- Open https://dgnb2hmunowzj.cloudfront.net full-screen on a laptop (1600 px wide or more).
- Click **Settings → Reset demo data** in the homeowner pane.
- Click **"Tap to enable voice"** in the Door Display pane, so Polly is audible in the recording.
- Record the screen plus microphone (QuickTime: File → New Screen Recording, with your mic).

| Time | On screen | Say |
|---|---|---|
| **0:00–0:15** | The Door Display idle screen, then cut to the homeowner app | "Ring can tell you *a* package is on your porch. It can't tell you *which* one, or whether it was even meant for you. And your note, 'medication, put it in the cooler box', never reaches the driver standing at the door." |
| **0:15–0:35** | Homeowner pane → **Packages**: show "Mom's medication" and its instruction, then type a new instruction into the add form to show how easy it is (no need to submit). | "This is DeliveryHub for Ring. I list what I'm expecting and leave an instruction for each package." |
| **0:35–1:10** | Simulator pane: select **Medication** and press 🔔. The Door Display turns green and speaks. The Delivery Box unlocks: click **Lift lid**, then **Close lid**. Homeowner pane: the feed shows the photo and "Secured in box". | "The driver just holds the label up to the doorbell and presses the bell. That's the consent. Within two seconds DeliveryHub reads the barcode and the address, confirms it's the right house, and plays *my* instruction for *this* package. Because it's an expected package confirmed by its barcode, the Delivery Box opens. I get the photo as proof." |
| **1:10–1:30** | Simulator: **Neighbor's package**, press. Door Display turns red. Homeowner pane: the red alert banner. | "Wrong house? The driver hears it immediately, 'this package is for 42 Oak Street', and the box stays locked. I get an alert." |
| **1:30–1:45** | Homeowner feed: zoom into a card (Label vs. Home, Why, Read by, Box). | "Every decision is explainable: what it read, my address, why, and which reader decided. If the label is blurry, it asks the driver to try again. It never guesses." |
| **1:45–2:15** | `7-architecture.png` full-screen, then `docs/EVAL.md` tables. | "Under the hood: Ring's signed doorbell webhooks and the image API, with full one-way account linking. Then a serverless AWS pipeline: Lambda, Bedrock with Nova Lite, Textract as a fallback, Polly, DynamoDB, and S3 with 30-day retention. We ran a 120-press eval through the live stack: 95% correct, zero wrong-house decisions, under 2.5 seconds at p90." |
| **2:15–2:40** | `DELIVERY_BOX.md` diagram, then back to the console. | "No names, no faces, and photos are deleted after 30 days. Next: the Delivery Box as a real accessory on AWS IoT Core and Sidewalk, an apartment front-desk mode, and the doorbell speaker as soon as Ring opens it. DeliveryHub: the doorbell finally helps the person standing at it." |

Tip: Ring's watermark isn't in simulated frames. Say "simulated doorbell" once during the 0:35 beat; the honesty helps.

---

## 9. Ring sandbox request (optional, send to Ring office hours / Developer Support)

> Hi! We're building DeliveryHub for the Build, Ship, Shape hackathon (Ring track): a doorbell-press → snapshot → package-label check. We have a private app with account linking and webhooks deployed, but no physical Ring device. The docs mention a sandbox with synthetic devices and events. How can we get sandbox access, or a test device on a staging account, to exercise `button_press` webhooks and `media/image/download`? Thanks!
