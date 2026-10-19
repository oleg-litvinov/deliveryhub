# Friction log (Ring Partner API + AWS)

Each entry: Task · Steps · Expected vs actual · Severity · Workaround · Suggestion.

## 1. No way for a third-party app to speak through the doorbell
- **Task:** Tell the delivery driver "right address" plus the homeowner's instruction, through the doorbell speaker.
- **Steps:** Searched the Partner API reference for audio, two-way talk, quick replies and announcements.
- **Expected:** An endpoint to play a short clip (or TTS text) on the doorbell's outdoor speaker.
- **Actual:** The only audio endpoint is `POST /v1/devices/{id}/media/audio/playback`, documented for the **indoor Chime** with pre-provisioned `audio_ref` slots. Nothing for the doorbell speaker.
- **Severity:** High for any visitor-facing app (deliveries, accessibility, caretaking).
- **Workaround:** DeliveryHub shows the result on a "Door Display" web page with Amazon Polly audio.
- **Suggestion:** `POST /v1/devices/{id}/media/audio/playback` for doorbells, accepting a short MP3 URL or text (consented, rate-limited, watermark-style audio prefix if needed).

## 2. No official simulator or virtual device
- **Task:** Develop and let judges try a Ring app without hardware.
- **Expected:** The hackathon brief mentions "Ring APIs, SDKs, simulators". A virtual doorbell that emits signed webhooks and serves snapshots from an uploaded image.
- **Actual:** No simulator in the docs. The Getting Started glossary mentions a sandbox "with synthetic Ring devices and events", but no page says how to get access. Staging needs a real Ring account, a registered US device and an active Ring Protection plan. The `ring-api-helloworld` sample only offers a `curl` to its own test route.
- **Severity:** High (blocks teams without a doorbell).
- **Workaround:** Built a Doorbell Simulator that sends Ring-format, HMAC-signed `button_press` webhooks through the same endpoint, and serves frames keyed by device + timestamp like `media/image/download`.
- **Update (via the Ring Knowledge MCP):** the docs say Early Access scopes (chimes, sensors) "can be configured and tested in the sandbox/staging environment", but there is still no documented synthetic doorbell or camera you can drive.
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
- **Update (via the Ring Knowledge MCP):** `image_download.md` says the endpoint returns *existing* frames only (no new capture), with a ±10 s tolerance; the real frame time comes back in `X-Media-Timestamp`. That means two requests 1.5 s apart can return the same frame.
- **Workaround:** Retry 425/5xx with exponential backoff + jitter; request frames spaced further apart and drop duplicates by `X-Media-Timestamp`.
- **Suggestion:** Document expected latency, or add a `live` snapshot type for button presses.

## 6. Amazon Polly neural voices are not available in our project's Region
- **Task:** Speak the homeowner's instruction to the driver with a natural voice.
- **Steps:** `SynthesizeSpeech` with `Engine: neural`, `VoiceId: Joanna` from a Lambda in us-east-2.
- **Expected:** Neural voice, as in us-east-1.
- **Actual:** `ValidationException: The selected engine is not supported in this region`. `DescribeVoices` in us-east-2 returns 0 neural / generative / long-form voices and 8 standard en-US voices. Projects in the new AWS experience are pinned to one Region, so we can't call Polly in us-east-1.
- **Severity:** Medium (the first scan failed until we caught it).
- **Workaround:** Try neural, fall back to standard on `ValidationException`; speech is now best-effort so a voice error can never fail a delivery check.
- **Suggestion:** List engine availability per Region on the Polly voice page, and return the supported engines in the error message.

## 7. Bedrock "tokens per day" quota is 0 on the project
- **Task:** Read the ship-to address from the doorbell frame with Amazon Nova Lite (Converse API, image input).
- **Actual:** Every call throws `ThrottlingException: Too many tokens per day`. Service Quotas shows the applied account-level value as 0 (default 5.76B), not adjustable from the console; upgrading the project to the paid plan didn't change it. A support case is open.
- **Severity:** High for the AI half of the product.
- **Workaround:** The worker falls back to Amazon Textract OCR + our deterministic address parser automatically (`backend/src/lib/label.ts`). The demo works end to end on the fallback; every scan records which reader was used.
- **Suggestion:** Show "quota 0" as an explicit onboarding blocker with a one-click request, instead of a throttling error.
