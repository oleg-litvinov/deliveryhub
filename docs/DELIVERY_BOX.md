# Delivery Box: design for a self-unlocking package box

> **Status:** concept. We built the software side: the unlock policy, the state machine, a virtual box in the app, and unit tests. We did not build hardware. This document describes how a real box would plug in.

## The idea

A weatherproof, lockable box sits next to the front door, in view of the Ring doorbell. It opens **only** when DeliveryHub has verified that the package belongs to this home:

1. The driver holds the label up to the doorbell and presses the bell.
2. DeliveryHub reads the barcode and the address, and finds the package on the homeowner's expected list.
3. The box unlocks for 60 seconds. The Door Display and the voice prompt tell the driver it's open.
4. The driver drops the package in and closes the lid. The box relocks.
5. The homeowner sees **"Secured in box"** with the doorbell photo as proof.

This protects packages from porch theft and from bad weather. It works with **any carrier**, because the check uses the label itself rather than a carrier integration or a driver app.

## Tenets

- **Fail closed.** If anything is uncertain, the box stays locked and the package goes by the door as usual.
- **Never unlock on AI alone.** A tracking number that only an AI model read cannot open the box. The barcode must match.
- **A human decides the exceptions.** Unexpected packages need the homeowner's one-tap remote unlock.
- **Short and single-use.** Each unlock is a 60-second, one-time token.

## Unlock policy

Code: [`backend/src/core/box.ts`](../backend/src/core/box.ts) · Tests: [`backend/test/box.test.ts`](../backend/test/box.test.ts)

The box unlocks only if **all** of these hold:

| # | Check | Why |
|---|---|---|
| 1 | Verdict is `right_address` | Never open for the neighbor's package |
| 2 | The package is on the homeowner's **expected** list | Unknown packages need a human |
| 3 | The tracking number came from the **barcode** | An AI misread can't open a lock |
| 4 | The address didn't mismatch, and confidence ≥ 0.85 | Uncertainty fails closed |
| 5 | The box isn't `OPEN` or in `TAMPER` | A second verified parcel while it's `UNLOCKED` restarts the 60 s window with a fresh token, and the old token stops working |
| 6 | Fewer than 3 unlocks in the last hour | Limits abuse with replayed labels |

## State machine

```
            unlock (policy ok, or homeowner remote unlock)
  LOCKED ─────────────────────────────────────────► UNLOCKED ── 60 s timeout, or a new ──► LOCKED
                                                                unverified scan (relock)
    ▲                                                   │ lid_open (valid token)
    │                                                   ▼
    │                                                 OPEN
    │                                                   │ lid_close
    │  homeowner empties box                            ▼
    └──────────────────────────────────────────────── SECURED  (package → "secured_in_box")

  lid_open without a valid token (any state) ──► TAMPER  (alert + doorbell snapshot)
```

## Production architecture (not deployed)

```
scan-worker ── policy ok ──► AWS IoT Core device shadow
                               desired: { lock: "unlocked", token, expiresAt }
                                      │ MQTT over TLS, X.509 certificate per box
                                      ▼
                         Delivery Box firmware (FreeRTOS / AWS IoT ExpressLink)
                         reported: { lock, lid, occupancy }
                                      │ IoT Rule
                                      ▼
                         Lambda → DynamoDB (status "secured_in_box") → homeowner app
```

- **Security ("job zero"):** each box has its own certificate, and its IoT policy allows access to **only its own shadow**. Tokens are single-use and expire after 60 s. Every command and state change is logged for audit.
- **Static stability:** if the cloud or Wi-Fi is down, the box stays locked. The homeowner can always open it with a local PIN or a key.
- **Connectivity:** Amazon Sidewalk through a nearby Ring or Echo bridge, so the box needs no Wi-Fi setup and keeps working over longer range.
- **Retrieval:** the homeowner unlocks from the app. Later, "Alexa, open my delivery box" with a voice PIN.

## What's in the hackathon build

| Piece | Where |
|---|---|
| Unlock policy and state machine (pure functions, unit-tested) | `backend/src/core/box.ts` |
| Policy evaluated on every scan, with the reason stored in the scan record | `backend/src/handlers/worker.ts` |
| Virtual box "firmware": lift lid / close lid / force open (tamper test) | `POST /api/box/lid` |
| Homeowner remote unlock (human-in-the-loop for unexpected packages) | `POST /api/box/unlock` |
| Box widget on the Door Display and in the homeowner app | `web/src/components/ui.tsx` |

In production, `VirtualBox` is replaced by the IoT shadow adapter. The policy, the state machine and the app UI stay the same.

## Threats considered

| Threat | Mitigation |
|---|---|
| Thief prints a fake label with this address | Tracking number must match an **expected** package (rule 2), by barcode (rule 3) |
| Replaying a photo of a real label | Unlock is rate-limited, single-use and expires in 60 s. The package is marked delivered after the first scan, so it's no longer "expected". |
| Prying the lid open | `TAMPER` state, alert to the homeowner, and a doorbell snapshot |
| Cloud outage | Box stays locked (fails closed). Local PIN override. |
| Someone else walks up while the box is still unlocked for a verified driver | Any new scan that fails the policy (wrong house, unknown or unreadable label) **re-locks the box immediately** |
| AI misreads an address | The box never opens without a barcode match, and address mismatches always block |
