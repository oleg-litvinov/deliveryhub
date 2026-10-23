<!-- Paste into Devpost "About the project". Generated from DEVPOST_DRAFT.md -->

## Inspiration

Ring can tell you that *a* package is on your porch. It can't tell you *which* one, or whether it was even meant for you. Packages land at the wrong house, medication sits in the sun, and the note "please put it in the cooler box" never reaches the driver who is standing at the door. Today the only address check is the driver glancing at the label. We wanted the doorbell, which sees the end of every delivery, to help the person standing there.

## What it does

1. **The homeowner** adds the packages they expect, each with a nickname and an optional instruction for the driver ("Medication, please put it in the cooler box").
2. **The driver** just holds the label up to the Ring doorbell. **Hands-free:** Ring's package-delivery motion event starts the check, so there's no button to press with a parcel in both hands. No app, no account. (Pressing the bell works too.)
3. **DeliveryHub** reads the barcode and the ship-to address from the doorbell frame, then checks them against the home and the expected list:
   - ✅ **Right house:** the driver hears the homeowner's instruction for *that* package, and the homeowner's app marks it **Delivered** with the doorbell photo as proof.
   - ❌ **Wrong house:** "Wait, this package is for 42 Oak St." The homeowner gets an alert.
   - ↻ **Can't read it:** the driver is asked to hold the label closer. We never guess.
   - ⓘ **Right house, but not on the expected list:** delivered and flagged as unexpected.
4. **Delivery Box (concept):** for a verified, expected package, a lockable box by the door unlocks for 60 seconds, then reports "Secured in box". It fails closed: never on an AI-only read, never for unexpected packages without the homeowner's one-tap approval, and any new unverified scan re-locks it immediately.

Every decision is explainable: the app shows the address read from the label next to the home address, the reason, and which reader (barcode / Bedrock / Textract) produced it.

## How we built it



- **Ring Partner API**, built to the spec we pulled through the **Ring Appstore Knowledge MCP server**:
  - `button_press` and `motion_detected` (`package_delivery`) webhooks with HMAC-SHA256 `X-Signature` verification and `meta.request_id` dedupe;
  - `media/image/download` (`at_timestamp`): on a motion event, a frame every ~1.5 s for up to 10 s, stopping at the first barcode; on a bell press, three frames around it. Frames are de-duplicated by `X-Media-Timestamp`, with backoff and jitter on `425`/`416` while the recording catches up. A look where nobody shows a label stays silent and keeps nothing;
  - **one-way account linking:** Token Exchange URL (code → tokens within 60 s), an Account Link page with the required sign-in and a consent disclosure, nonce = base64url(HMAC-SHA256(key, `time:account`)) checked in constant time within 600 s, then `POST` + `PATCH /v1/accounts/me/app-integrations`;
  - OAuth refresh with token rotation; `app_integration_removed` deletes the tokens.
- **Webhook Lambda:** verifies the signature, dedupes on `meta.request_id`, records a "Reading label…" scan and async-invokes the worker. ACKs in under a second (Ring requires 5 s).
- **Scan worker Lambda:**
  - zxing-wasm decodes the barcode into a tracking number. Matching uses containment, so USPS IMpb (`420` + ZIP + tracking) and FedEx 34-digit codes work.
  - **Amazon Bedrock (Nova Lite)** reads the ship-to address as JSON. The prompt never asks for the recipient's name.
  - **Amazon Textract** is the automatic OCR fallback.
  - A deterministic address matcher (USPS suffix normalization, Jaro-Winkler on the street name, strict number, unit and ZIP) produces the explainable verdict.
  - The Delivery Box policy runs on every scan.
  - **Amazon Polly** speaks the instruction, cached in S3 by hash.
- **Storage:** DynamoDB single table (packages, scans, box state, idempotency keys with TTL). S3 holds photos with a **30-day lifecycle rule**, so the retention promise is enforced by a mechanism.
- **Web:** React + Vite + Tailwind on S3 + CloudFront, on the same origin as the API. It has four views:
  - the homeowner app;
  - the Door Display (what the driver sees and hears);
  - the **Doorbell Simulator**, which sends the exact signed Ring webhook through the same pipeline with a simulated camera;
  - a live **eval page** anyone can rerun.
- **Ops:** one AWS SAM template; arm64 Lambdas; X-Ray tracing; CloudWatch Embedded Metric Format (`ScanLatencyMs` by verdict) and a dashboard.
- **Tests:** 49 unit tests covering address matching, tracking lookup, decisions, the Delivery Box policy and state machine, webhook signatures, account-linking nonces, Ring media retries and barcode decoding.
- **Ring content policy built in:** consent before any data is collected, "Delete my data" with confirmation and an audit log, data minimization (no names, no faces), and 30-day retention.

## Challenges we ran into (mini-COE)

**A correct package was announced as "wrong house."** Our first 120-press eval scored 97%, but all 4 errors were right-house packages reported as the wrong house, at the hardest setting (14 cm, 10° tilt, motion blur).
- *Why?* The OCR read "Reno, NV 89501".
- *Why?* That's the **return** address. The ship-to block was too blurry to read.
- *Why did we use it?* Our label parser fell back to "the last address on the label" when it couldn't find one after "SHIP TO".
- *Why was that allowed?* We tested only the happy path, not "the ship-to block is unreadable".
- **Mechanism:** an address only counts if it's printed after the ship-to marker; garbage street lines are rejected; a low-confidence mismatch asks the driver to retry instead of claiming "wrong house". Regression tests lock all three in. Result: wrong decisions went from **4 to 0**. The cases that used to be wrong now ask the driver to retry ([full COE](https://github.com/oleg-litvinov/deliveryhub/blob/main/docs/EVAL.md#coe-right-house-packages-announced-as-wrong-house)).

Other friction: there's no doorbell-speaker API (we built the Door Display), no Ring simulator and no documented way into the sandbox (we built a simulator), Polly has no neural voices in our Region, and our Bedrock quota is 0 (Textract carries the demo). All of it is in the friction log.

**Honest scope note:** we don't own a Ring device, and the sandbox isn't open to us. Ring's hackathon rules explicitly allow a simulator. Every Ring integration path is real code that is deployed and calls Ring at runtime (our credentials reach `oauth.ring.com`), but the frames in the demo and the eval come from the Doorbell Simulator.

## Accomplishments we're proud of

- **120-press live eval** (real signed webhooks through the deployed stack, simulated optics): **95% correct, 5% "please hold it closer", 0 wrong decisions, 0 false confirmations**. Press → decision in **1.9 s p50 / 2.4 s p90**. [Details](https://github.com/oleg-litvinov/deliveryhub/blob/main/docs/EVAL.md), and anyone can rerun it at https://dgnb2hmunowzj.cloudfront.net/eval.
- **100% correct out to ≈ 12 cm** from the lens, even with tilt and motion blur.

- **Zero false confirmations:** a neighbor's package has never been confirmed as ours in any eval run.
- Works for every carrier, because it reads the label itself.
- Responsible by design: it only acts when a driver *shows* a label, and frames without one are discarded; no names, no faces; 30-day photo retention enforced by S3; explainable decisions; fails closed.

## What we learned

- A wide-angle doorbell is not a barcode scanner. Our eval shows the label has to be within roughly 10–12 cm of the lens for reliable barcode reads, while the printed address stays readable further out. So we made the address the primary signal and the barcode the high-confidence one (required to unlock the box).
- "Ask again" is a feature. A confident wrong answer at the door is far worse than a retry.

## What's next

- Test with a real doorbell, then go through Ring Appstore certification.
- Doorbell-speaker audio when Ring exposes it. The Door Display is built to be swapped out.
- **Delivery Box** hardware partner via AWS IoT Core and Amazon Sidewalk ([design](https://github.com/oleg-litvinov/deliveryhub/blob/main/docs/DELIVERY_BOX.md)).
- An apartment and front-desk mode (Ring's *business systems* category).
- Carrier APIs, so the confirmation flows back to the shipper before the truck leaves.

## How we meet the judging criteria

| Criterion | Evidence |
|---|---|
| **Tech Implementation** | Ring webhooks with HMAC verification and idempotency, snapshots with retries and dedupe, OAuth refresh, and full one-way account linking. A 9-service serverless AWS pipeline in one SAM template. 49 unit tests. A live 120-case eval with p50/p90 latency. |
| **Design** | Zero new behaviour for the driver: hold the label up, hands-free. A Door Display readable at arm's length. A homeowner feed with photo proof and a "why" behind every decision. A three-pane demo console for judges. |
| **Potential Impact** | Targets Ring's *package/delivery management* priority. Works for every carrier. A path to the Ring Appstore, plus a hardware accessory (Delivery Box) and business/front-desk mode. |
| **Quality of the Idea** | Turns the doorbell camera into a *consented* helper for the person at the door rather than a surveillance tool: Ring knows *a* package is there; DeliveryHub knows *which* and *whether it belongs here*. |
