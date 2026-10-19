# DoorCheck

**The driver holds the label up to the Ring doorbell and presses the bell. DoorCheck confirms it's the right house, marks the package delivered with photo proof, and tells the driver the homeowner's instructions for that package.**

Ring already knows *a* package is at the door. DoorCheck knows *which* package it is and *whether it belongs here*.

> **Live demo:** https://d2or6kgd4x3om0.cloudfront.net (no login; open on a laptop for the three-pane console)
>
> Built for the [Build, Ship, Shape: Amazon Developer Hackathon](https://amazonappdev2026.devpost.com/) — Ring track + AWS Builder mini challenge.

## How it works

```
Ring doorbell ─ button_press webhook (HMAC-signed) ─► API Gateway → webhook Lambda ── verify, dedupe, ACK < 1 s
 (or Doorbell Simulator: identical signed payload)                     │ async
                                                                       ▼
                                                       scan-worker Lambda
                                                         ├─ Ring media/image/download (2 frames, retry 425)
                                                         ├─ zxing-wasm barcode decode → tracking number
                                                         ├─ Amazon Bedrock (Nova Lite) vision → ship-to address
                                                         │    └─ fallback: Amazon Textract OCR
                                                         ├─ deterministic address match + expected-package lookup (DynamoDB)
                                                         ├─ Delivery Box unlock policy (fails closed)
                                                         └─ Amazon Polly instruction → S3 (30-day lifecycle)
Door Display (driver)  ◄─ poll ─ CloudFront ─► homeowner app (feed, photo proof, alerts, remote box unlock)
```

## Repo layout

| Path | What |
|---|---|
| `backend/src/core` | Pure, unit-tested logic: address matching, tracking lookup, decisions, Delivery Box policy and state machine |
| `backend/src/ring` | Ring Partner API client (OAuth refresh, snapshots), webhook parsing and HMAC verification |
| `backend/src/handlers` | Lambda handlers: `webhook`, `worker`, `api` |
| `infra/template.yaml` | AWS SAM: HTTP API, Lambdas, DynamoDB, S3, CloudFront, CloudWatch dashboard |
| `web/` | Homeowner app, Door Display, Doorbell Simulator |
| `docs/` | Friction log, Delivery Box design, PR-FAQ |

## Run the tests

```bash
make test
```

## Deploy

Requires AWS SAM CLI and an AWS profile (set `PROFILE=`; Region `us-east-2`).

```bash
make deploy PARAMS="RingWebhookSecret=<hmac key> RingClientId=<id> RingClientSecret=<secret> RingRefreshToken=<token> RingDeviceIds=<device id>"
make deploy-web
make outputs
```

Then paste `RingWebhookUrl` into the Ring Developer Portal.

## Privacy

- The scan starts when the driver presses the bell while showing the label (an explicit action). No face recognition.
- Only the ship-to address and tracking number are extracted; the recipient name is never requested or stored.
- Snapshots are deleted automatically after 30 days (S3 lifecycle rule).
- Every decision shows the address read next to the home address, with the reason.

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
