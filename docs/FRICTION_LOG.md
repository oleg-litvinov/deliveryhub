# Friction log (Ring Partner API + AWS)

Each entry: Task · Steps · Expected vs actual · Severity · Workaround · Suggestion.

## 1. No way for a third-party app to speak through the doorbell
- **Task:** Tell the delivery driver "right address" plus the homeowner's instruction, through the doorbell speaker.
- **Steps:** Searched the Partner API reference for audio, two-way talk, quick replies and announcements.
- **Expected:** An endpoint to play a short clip (or TTS text) on the doorbell's outdoor speaker.
- **Actual:** The only audio endpoint is `POST /v1/devices/{id}/media/audio/playback`, documented for the **indoor Chime** with pre-provisioned `audio_ref` slots. Nothing for the doorbell speaker.
- **Severity:** High for any visitor-facing app (deliveries, accessibility, caretaking).
- **Workaround:** DoorCheck shows the result on a "Door Display" web page with Amazon Polly audio.
- **Suggestion:** `POST /v1/devices/{id}/media/audio/playback` for doorbells, accepting a short MP3 URL or text (consented, rate-limited, watermark-style audio prefix if needed).

## 2. No official simulator or virtual device
- **Task:** Develop and let judges try a Ring app without hardware.
- **Expected:** The hackathon brief mentions "Ring APIs, SDKs, simulators". A virtual doorbell that emits signed webhooks and serves snapshots from an uploaded image.
- **Actual:** No simulator in the docs. The Getting Started glossary mentions a sandbox "with synthetic Ring devices and events", but no page says how to get access. Staging needs a real Ring account, a registered US device and an active Ring Protection plan. The `ring-api-helloworld` sample only offers a `curl` to its own test route.
- **Severity:** High (blocks teams without a doorbell).
- **Workaround:** Built a Doorbell Simulator that sends Ring-format, HMAC-signed `button_press` webhooks through the same endpoint, and serves frames keyed by device + timestamp like `media/image/download`.
- **Suggestion:** Publish the sandbox, or a "virtual doorbell" in the Developer Portal where you upload an image/clip and fire events.

## 3. Webhook auth differs between the sample and the docs
- **Task:** Verify webhook authenticity.
- **Expected:** The sample app shows the documented scheme.
- **Actual:** Docs: `X-Signature: sha256=<hex HMAC-SHA256 of raw body>`. `ring-api-helloworld` `/api/webhook` checks `Authorization: Bearer <RING_WEBHOOK_SECRET>` instead.
- **Severity:** Medium (copying the sample ships an insecure check).
- **Workaround:** Implemented the documented HMAC check with a timing-safe compare (`backend/src/ring/signature.ts`).
- **Suggestion:** Update the sample to verify `X-Signature`.

## 4. API reference is one ~370k-character page
- **Task:** Find the snapshot request body and the webhook signature format.
- **Actual:** Everything is on a single page; the TOC lists sections whose content is far away, and community answers (e.g. "there is no snapshot API") are outdated against it.
- **Severity:** Low–Medium.
- **Suggestion:** Split per resource, add an OpenAPI spec and copy-paste examples for each webhook type.

## 5. Snapshot timing is unclear for event-driven apps
- **Task:** Grab the frame at the moment of a doorbell press.
- **Actual:** `media/image/download` with `at_timestamp` reads from recordings; `425 RECORDING_NOT_READY` is documented but no typical delay is given for images (clips say ~5 s).
- **Workaround:** Retry 425/5xx with exponential backoff + jitter, request two frames (press, press + 1.5 s).
- **Suggestion:** Document expected latency, or add a `live` snapshot type for button presses.
