# Eval: accuracy and latency on the live pipeline

**Run it yourself:** https://dgnb2hmunowzj.cloudfront.net/eval (about 4 minutes; downloads raw JSON). Code: [`web/src/pages/Eval.tsx`](../web/src/pages/Eval.tsx).

Each case is a **real, HMAC-signed `button_press` webhook** going through the deployed stack: API Gateway → webhook Lambda → scan worker (barcode decode, label read, decision) → DynamoDB. Only the camera is simulated. The Doorbell Simulator renders a 4×6 label, holds it up in front of a porch scene, and applies wide-angle barrel distortion, tilt, motion blur, a watermark and JPEG compression at 1920×1080 (the maximum the Ring snapshot API returns).

**Grid:** 4 labels × 5 distances × 2 tilts × 3 blur levels = **120 presses**, run 4 at a time.
Labels: medication (USPS, expected), shoes (UPS, expected), the neighbor's package (UPS, 42 Oak St = wrong house), a surprise gift (USPS, right house, not expected).
**Reader:** Amazon Textract for every case, because Bedrock is blocked by a 0 quota (friction #7). The Bedrock path is wired and falls back automatically.
**Run date:** 2026-10-18, us-east-2.

## Headline (after the fix below)

| Metric | Result |
|---|---|
| Correct decision | **114 / 120 (95%)** |
| Asked the driver to retry ("hold it closer") | 6 / 120 (5%) |
| **Wrong decision** (right ↔ wrong house) | **0** |
| **False confirmation** (neighbor's package accepted) | **0 / 30** |
| Address read from the label | 114 / 120 (95%) |
| Barcode decoded | 44 / 120 (37%) |
| Latency, press → decision (server) | **p50 1.9 s · p90 2.4 s · max 3.6 s** |

## By distance from the lens

| Distance | n | Correct | Retry | Wrong | Barcode read | Address read |
|---|---|---|---|---|---|---|
| ≈ 8 cm | 24 | 100% | 0% | 0 | 67% | 100% |
| ≈ 9 cm | 24 | 100% | 0% | 0 | 67% | 100% |
| ≈ 10 cm | 24 | 100% | 0% | 0 | 33% | 100% |
| ≈ 12 cm | 24 | 100% | 0% | 0 | 17% | 100% |
| ≈ 14 cm | 24 | 75% | 25% | 0 | 0% | 75% |

## By motion blur and tilt

| Condition | n | Correct | Retry | Wrong | Barcode read |
|---|---|---|---|---|---|
| Blur 0 px | 40 | 100% | 0% | 0 | 70% |
| Blur 1 px | 40 | 95% | 5% | 0 | 40% |
| Blur 2 px | 40 | 90% | 10% | 0 | 0% |
| Tilt 0° | 60 | 100% | 0% | 0 | 37% |
| Tilt 10° | 60 | 90% | 10% | 0 | 37% |

All 6 retries happened at ≈ 14 cm **with** 10° tilt **and** blur.

## What this tells us

1. **The printed address is the workhorse; the barcode is the high-confidence signal.** The address was read in 95% of cases, out to 14 cm. The barcode only decodes reliably when the label is ≤ 9 cm from the lens and steady. So the address decides "right / wrong house", and the barcode is **required** for anything irreversible, like unlocking the Delivery Box ([policy](DELIVERY_BOX.md)).
2. **Driver guidance:** "Hold the label about a hand's width from the camera" (≈ 10 cm) puts us in the 100% band.
3. **Failure mode is a retry, never a wrong answer.** Every miss asks the driver to try again.
4. **Fast enough for the doorstep:** under 2.5 s at p90 from press to decision, including Ring-style frame retrieval, barcode decoding, OCR, matching, DynamoDB and S3 writes.

## Follow-up: 2D codes survive where 1D barcodes don't

After adding an Amazon-style label with a **QR code** (the third expected package), we pushed it through the same simulated optics and our Lambda's zxing-wasm decoder:

| Condition | Code128 (eval above) | QR code |
|---|---|---|
| ≈ 9 cm, 4° tilt, sharp | decodes | ✅ decodes |
| ≈ 12 cm, 4° tilt, sharp | 17% | ✅ decodes |
| ≈ 14 cm, 10° tilt, sharp | 0% | ✅ decodes |
| ≈ 9 cm, 10° tilt, 2 px blur | 0% | ✅ decodes |
| ≈ 14 cm, 10° tilt, 2 px blur | 0% | ✅ decodes |

(5 spot checks, run locally, not a full 120-case run.) The takeaway for the product: on a wide-angle doorbell, the **2D code** (QR, DataMatrix or MaxiCode, which most carrier labels already print) is the reliable machine-readable signal. That makes the barcode-required rule for unlocking the Delivery Box realistic at normal holding distances.

## COE: "right house" packages announced as "wrong house"

**Impact.** In the first run, 4 of 120 presses (3%) told the driver a correct package belonged to another house. All 4 were at ≈ 14 cm with 10° tilt and blur. No neighbor's package was ever accepted.

**Five whys**
1. *Why "wrong house"?* The matcher compared the home with **"Reno, NV 89501"**.
2. *Why that address?* It's the **return** address. The ship-to block was too blurry for OCR.
3. *Why did the parser use the return address?* When it found no address after "SHIP TO", it fell back to "the last address on the label", which was the return address.
4. *Why didn't a test catch it?* Our unit tests covered readable labels, not "ship-to unreadable, return address readable".
5. *Why did a weak read produce a confident claim?* The wrong-address verdict reported at least 0.9 confidence, whatever the OCR confidence was.

**Mechanisms (all with regression tests)**
- If a label has a "SHIP TO" marker, only an address printed **after** it counts. No fallback (`parseAddressFromLines`).
- A street line must be a number followed by a real word, so OCR debris like "9 -" is rejected.
- A mismatch from a read with confidence under 0.6 asks for a retry instead of claiming "wrong house". The verdict now carries the reader's real confidence.

**Result:** wrong decisions went from 4 to **0**. Correct went from 97% to 95%. The difference is honest: before the fix, 2 of the neighbor's packages at 14 cm were "correct" only because the parser read the return address, which happened to be a different address too. They're now retries.

| Run | Correct | Retry | Wrong |
|---|---|---|---|
| Before fix | 116 (97%) | 0 | **4** |
| After fix | 114 (95%) | 6 | **0** |

## Limitations

- Frames are simulated: the optics model is barrel distortion plus blur plus JPEG, not a real Ring sensor. Validating on a real doorbell is the next step.
- 4 label designs, all with fictional addresses and clean print. Real labels have more layouts, wrinkles and glare.
- Textract only. Bedrock (Nova Lite) will be evaluated with the same harness once the quota is fixed.
