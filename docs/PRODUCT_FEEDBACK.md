# Product feedback

Required for each tool, API and SDK we used. Detailed repro steps are in [FRICTION_LOG.md](FRICTION_LOG.md).
Items marked `[[team]]` need first-hand input from the team before submission.

## Ring Partner API (Amazon Vision API)

**Used for:** `button_press` / `motion_detected` webhooks (the trigger), `POST /v1/devices/{id}/media/image/download` (the frame we read the label from), OAuth 2.0 refresh flow, `GET /v1/devices`.

**What worked well**
- The event model fits the use case: `button_press` is an explicit, consented trigger, and `motion_detected` with `sub_type: package_delivery` is a natural second trigger.
- The webhook contract is solid: HMAC-SHA256 over the raw body, `meta.request_id` for idempotency, and a clear 5-second ACK rule.
- The snapshot API is well designed for event-driven apps: `at_timestamp`, plus a 303 redirect to a pre-signed URL. The documented 425 `RECORDING_NOT_READY` makes retry logic straightforward.
- Server-side watermarking is a sensible privacy default.

**What needs work**
- **No audio playback on the doorbell speaker** (friction #1). This is our #1 feature request: visitor-facing apps (deliveries, accessibility, caretaking) need to talk to the person at the door.
- **No simulator or virtual device** (friction #2), even though the hackathon brief mentions simulators. The "sandbox with synthetic devices" in the glossary isn't documented.
- **The sample app verifies webhooks differently from the docs** (friction #3).
- **One 370k-character reference page** (friction #4). An OpenAPI spec would help a lot.
- **Snapshot latency after an event isn't documented** (friction #5).
- Staging needs a US device and an active Ring Protection plan per test user. That's a real barrier for international teams and students.

**Onboarding (zero to hello world):** `[[team]]` registration and staging-app experience, plus time to first `GET /v1/devices`.

**Would we build with it again?** Yes. The doorbell is the one device that sees every delivery, and the API gives exactly the right primitives (events + frames). Speaker access would unlock a whole category of apps.

## Ring Appstore Knowledge MCP server (`knowledge.appstore-mcp.ring.amazon.dev/mcp`)

**Used for:** querying the official docs from our coding agent (`search_docs`, `get_doc`). It confirmed the exact `X-Signature` format, the image-download semantics (existing frames only, ±10 s tolerance, `X-Media-Timestamp`), chime audio slots (Early Access), and the Appstore content policy's consent and data-deletion rules.
**Worked well:** fast, needs no auth, and `get_doc` returns full markdown pages with code samples. Much easier than the single 370k-character web page.
**Needs work:** natural-language queries often surface ring.com product pages (doorbell spec sheets) instead of developer docs. Some reasonable queries returned nothing ("image snapshot latency after button press", "computer vision OCR content policy") until we rephrased them as short titles. A `source: developer-docs` filter would help.
**Again?** Yes. It became our first stop for Ring API questions.

## ring-api-helloworld (sample)

**Used for:** reference for the OAuth refresh flow and the webhook payload shape (adapted under MIT, credited in NOTICE).
**Worked well:** clear README; covers both Playground access tokens and refresh tokens.
**Needs work:** uses a bearer secret instead of the documented `X-Signature` HMAC. No snapshot example. Webhook types in the sample (`person_detected`) don't match the docs (`button_press`, `sub_type`).
**Again?** Yes, as a starting point.

## Amazon Bedrock (Nova Lite, Converse API with image input)

**Used for:** reading the ship-to address and tracking number from a doorbell frame as structured JSON.
**Worked well:** the Converse API takes image bytes and text in one call, with the same code for any model. IAM scoping to `foundation-model/*` in-Region is simple.
**Needs work:** the project's "tokens per day" quotas are applied at **0**, so every call throttles (friction #7). Nothing in onboarding flags this. You find out from a `ThrottlingException` at runtime.
**Onboarding:** the SDK call took minutes. Access has been blocked for days.
**Again?** Yes, once the quota is fixed. We built the fallback so the product doesn't depend on it.

## Amazon Textract (DetectDocumentText)

**Used for:** OCR fallback when Bedrock is unavailable. Our deterministic parser then finds the ship-to block.
**Worked well:** fast (well under a second per frame in our eval), with per-line confidence and no setup.
**Needs work:** returns lines in reading order only, so we had to write label-layout logic ourselves. That logic once picked the *return* address (see the COE in [EVAL.md](EVAL.md)).
**Again?** Yes, as the reliable floor under an LLM.

## Amazon Polly

**Used for:** speaking the homeowner's instruction to the driver.
**Worked well:** a single call, and MP3 output caches nicely in S3.
**Needs work:** neural voices aren't offered in us-east-2, and the error doesn't say which engines are (friction #6).
**Again?** Yes.

## AWS Lambda, API Gateway (HTTP API), DynamoDB, S3, CloudFront, CloudWatch, AWS SAM

**Used for:** the whole serverless backend and hosting. The infrastructure is one SAM template (`infra/template.yaml`).
**Worked well:**
- SAM HTTP API events made routing trivial.
- Async `Invoke` let us ACK Ring in under a second.
- DynamoDB single-table design with a TTL for idempotency keys.
- S3 lifecycle rules enforce our 30-day photo retention promise.
- CloudFront put the app and the API on one origin (no CORS).
- Embedded Metric Format gave us latency metrics with zero extra API calls.

**Needs work:**
- `Path: /api/{proxy+}` inside a YAML flow mapping fails to parse unless it's quoted. The error points at a column, not at the cause.
- A SAM `HttpApi` can't be referenced from its own functions' environment (circular dependency), so we derive the URL from the request context.
- CloudFront custom error pages apply to every origin, which forced a CloudFront Function for SPA routing.

**Onboarding:** from template to the first deployed stack took about 15 minutes.
**Again?** Yes.
