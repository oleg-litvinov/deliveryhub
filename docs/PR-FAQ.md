# PRESS RELEASE

**DeliveryHub for Ring makes sure your package reaches your door, not your neighbor's**
*Drivers show the label to your Ring doorbell. DeliveryHub confirms the address, tells them your instructions, and logs the delivery with a photo.*

SEATTLE — October 2026 — Today we announced DeliveryHub, an app for Ring video doorbells. It helps homeowners know exactly which package arrived, and it stops misdeliveries at the door before they happen.

**The problem.** Ring can tell you that *a* package is at your door. It can't tell you *which* one, or whether it was even meant for you. Packages go to the wrong house, medication sits in the sun, and "leave it behind the planter" notes never reach the driver who is standing at the door. Today the only address check is the driver glancing at the label.

**The solution.** The driver simply holds the shipping label up to the Ring doorbell, hands-free. Within seconds, DeliveryHub reads the label and checks it against the home's address and the homeowner's list of expected packages. If it's the right house, the driver hears the homeowner's instructions for that specific package, and the homeowner's app marks it "Delivered" with a photo. If it's the wrong house, the driver is told right away, and the homeowner gets an alert.

**Quote from us.** "Ring already watches the porch. We wanted it to help the person standing there: confirm the house, pass on the instructions, and never open the door to a mistake." — DeliveryHub team

**How it works.**
1. Add the packages you're expecting (tracking number, a nickname, an optional note for the driver).
2. The driver holds the label up to the doorbell. No button, no app.
3. DeliveryHub confirms the address, speaks your instruction, and logs the delivery with a photo.

**Customer quote.** "My mom's insulin used to sit on the step for hours. Now the driver is told to put it in the cooler box, and I get a photo the moment it's there." — Priya, caregiver in Springfield *(illustrative persona)*

**Get started.** Try the live demo at https://dgnb2hmunowzj.cloudfront.net. It needs no login: click "Driver holds the label up" in the simulator and watch the Door Display and the homeowner app react.

---

# FAQ

## Customer FAQ

1. **Who is this for?** Ring doorbell owners who get regular deliveries, especially for things that can't sit outside or go missing: medication, groceries, documents, expensive items. And caregivers managing deliveries for a parent.
2. **What does the driver have to do?** Hold the label up to the doorbell, about a hand's width from the camera. That's it: no button, no app, no account. Ring's package-motion event starts the check (pressing the bell works too).
3. **What does DeliveryHub read? Is it private?** Only the ship-to address and the tracking number. It never asks for or stores the recipient's name. There is no face recognition. DeliveryHub only acts when a driver deliberately shows a label to the doorbell; frames without a label are discarded and never stored. Photos are deleted automatically after 30 days.
4. **What if the AI gets it wrong?** Every decision shows the address it read next to your home address, with the reason. If the label can't be read, the driver is asked to hold it closer instead of being given a guess. A misread can never unlock the Delivery Box, because that requires an exact barcode match.
5. **How is this different from Ring package alerts?** Package alerts say *something* was left. DeliveryHub knows *which* package it is, whether it's yours, and gives the driver your instructions for it.

## Internal FAQ

1. **Why now?** The Ring Appstore and Partner API (2026) opened doorbell events and snapshots to third parties for the first time. Vision models on Amazon Bedrock can read a label from a single frame.
2. **How big is the opportunity?** Millions of Ring doorbells sit at the exact point where every delivery ends. Misdelivery and porch theft are a recurring cost for carriers, retailers and households, so a per-delivery confirmation is valuable to all three.
3. **Which AWS services and why?** Lambda (event-driven, scales to zero), API Gateway (webhook and app API), DynamoDB (packages, scans, box state), S3 (photos with a 30-day lifecycle rule), Amazon Bedrock with Nova Lite (reads the address from the frame), Amazon Textract (OCR fallback when Bedrock is unavailable), Amazon Polly (driver voice), CloudFront (one origin for the app and the API), CloudWatch (latency metrics and dashboard).
4. **What does it cost to run?** All services are serverless and pay-per-use. The biggest per-scan costs are one Textract page or one Nova Lite image call, plus a few cents per thousand Lambda and DynamoDB calls. That keeps it to a fraction of a cent per delivery. Polly audio for repeated phrases is cached in S3.
5. **Biggest risks?**
   - *Doorbell optics:* a wide-angle lens needs the label held close. Our eval measures exactly how close (see [EVAL.md](EVAL.md)).
   - *No doorbell speaker API:* we use a Door Display and filed a feature request.
   - *Driver adoption:* it takes under 5 seconds and gives the driver something useful back.
   - *Responsible AI:* no names, no faces, explainable decisions, and it fails closed.
6. **What did we leave out?** Alexa+ ("what got delivered today?"), carrier email import, damage detection, multi-home accounts and a native mobile app. One flow, done well.
7. **How will we measure success?** Correct-decision rate on real doorbell frames (target ≥ 90%, with **zero** wrong-house confirmations), press-to-answer latency (target p90 < 6 s), and the share of deliveries with photo proof.
8. **Tenets.** (1) The driver's action is the consent. (2) Never confirm a guess: if unsure, ask again. (3) The decision is explainable. (4) A lock never opens on AI alone. (5) Works for every carrier.
9. **What's next?** Certification on the Ring Appstore. Real doorbell testing. Doorbell-speaker audio when Ring opens it. The **Delivery Box** accessory ([DELIVERY_BOX.md](DELIVERY_BOX.md)). An apartment and front-desk mode for business systems. Carrier APIs, so the confirmation flows back to the shipper.
