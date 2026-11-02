# WhatsApp return collection details

Updated 31 October 2026. Task 7 is implemented locally. The database migration is applied; worker version 33 is now deployed with the feature explicitly disabled and empty pilot allowlists. This is customer confirmation, not the automatic-booking worker.

## Customer flow

The existing order ownership and return-policy checks run first. Only an eligible saved return, an active Premium sandbox subscription and unchanged approved automatic-shipping settings can enter this test. Both the store ID and the sender must also be explicitly allowed for the sandbox.

1. Choose the city where the parcel is now. This sandbox supports Riyadh, Jeddah and Dammam.
2. Enter the district and street, plus an apartment number if needed.
3. Enter the four-digit National Address building number.
4. Enter the five-digit postal code. Western and Arabic digits work.
5. Review the city and masked building/postal endings. The full address remains visible in the customer's own WhatsApp messages, rather than being repeated into Reload's dashboard transcript. The review explains use of the WhatsApp number as the return contact and sharing details with the store.
6. Confirm details or edit a field. This saves one private confirmation against the existing case. It does not create a second return, shipment or charge.

The current order adapters do not expose a trusted collection address or verified parcel weight/dimensions. Therefore this implementation asks for the current address instead of inventing an original address, and ends with a clear parcel-review notice. No pickup time, courier label, delivery, inspection or refund is promised. Automatic booking, address serviceability and reliable package defaults remain Task 8 prerequisites; no need to ask customers to guess parcel dimensions.

## Example

Ahmed's order is verified and his shoes meet the store's return policy. He selects Riyadh, enters his street and National Address details, then reviews and confirms. Reload says his details are saved and the store must check the parcel information before shipping is arranged. If he asks for an update, it says that no courier booking is confirmed yet. The merchant still has the existing return case; the private support timeline shows the collection stage and the confirmation milestone, without address fields.

Arabic confirmation example:

> تم حفظ تفاصيل الإرجاع، شكرًا لك. يحتاج المتجر إلى تأكيد بيانات الطرد قبل ترتيب الشحن. لم نحجز موعد استلام بعد. يمكنك متابعة طلبك من هنا.

## Navigation and recovery

- Native WhatsApp buttons/lists; three reply buttons or at most ten list rows, bounded titles and message sizes. No custom CSS animation is possible inside a native WhatsApp conversation.
- BACK, edit, help, stop, menu and resume. Side questions stay in the current step and do not become address data or model prompts.
- Changing Arabic/English keeps collection progress, including after a menu pause. Shipping re-verification also retains the saved case through the established phone/email/manual identity paths.
- Each collection button carries a draft ID and revision. Old or copied buttons cannot confirm a newer draft. Plain typed CONFIRM does not submit.
- Fifteen-minute draft lifetime and the existing signed order-token expiry. Expiry offers a fresh verification of the same saved case; no duplicate case is created by that path.
- Stopping details does not cancel the saved return or an existing courier booking. A Continue details button restarts address entry against the same saved case, without creating another return.
- Help uses the existing reviewed support-ticket and merchant takeover flow. No address is inserted into the ticket draft. A store-owned conversation remains under human control until explicitly resumed.
- Database/provider failures retain the last saved draft and offer retry, merchant help and menu. Settings/policy/plan changes prevent a new confirmation and route back to merchant follow-up.

## Privacy and server controls

- New address fields live only in AES-GCM ciphertext in private flow state and private confirmation storage. Payloads bind store, conversation and case. No address is added to public return-case snapshots, dashboard transcripts, support diagnostics, model context or usage-learning data.
- Inbound collection messages are redacted before insertion into the public merchant message table. Outbound review messages contain only masked details.
- The private ordered inbox necessarily holds the incoming transport message until its reply/state transition commits. That same database transaction replaces the raw collection message with a hidden marker, preserving the prepared reply for safe delivery recovery. It is not scrubbed before that commit, since doing so could destroy a legitimate retry. Marked failed/uncertain collection transport messages are also scrubbed after 24 hours by migration 202610310004. Failed delivery still needs operational review; expiry does not claim delivery.
- Confirmed encrypted details expire after 24 hours. A 15-minute scheduled cleanup wipes expired confirmation ciphertext and expired active/paused collection drafts. Status never exposes ciphertext. The immutable confirmation milestone remains without the address.
- Database functions are service-only; raw private confirmation-table access is revoked even from the service role. Every read/write binds the same-store conversation to its existing linked case. Confirmation rechecks Premium, current policy, approved settings version, warehouse mapping and open eligible case; repeated confirmation returns the existing record.
- This does not prove physical deliverability, reserve shipping funds, check final shipping price, activate live shipping or bypass the future final booking gate.

## Configuration

Supabase WhatsApp worker settings, separate from the Next.js merchant settings flag:

- `WHATSAPP_SHIPPING_SANDBOX_ENABLED=false` by default.
- `WHATSAPP_SHIPPING_SANDBOX_STORE_IDS`: exact comma-separated authorized store UUIDs.
- `WHATSAPP_SHIPPING_SANDBOX_SENDERS`: exact authorized test WhatsApp numbers in `9665xxxxxxxx` form.
- Existing `INTEGRATION_ENCRYPTION_KEY` and `RETURN_TOKEN_SECRET`; do not rotate them for this feature.

Empty allowlists disable the feature. No production fallback or wildcard. No hosted feature flag was enabled in this task. The new `whatsapp-inbox` bundle is deployed. Configuring an authorized test pilot after merchant setup is still required before a real WhatsApp test. Do not bulk-upload the root environment inventory.

Migrations `202610310003_whatsapp_collection` and `202610310004_collection_transport_retention` are applied. It adds the collection flow step and also preserves the existing email-OTP step, which the prior database constraint omitted. It adds a private confirmation record, cleanup schedule, safe milestones, status function and atomic transport redaction. No actual customer confirmation was created while applying it.

## Checks and limits

The complete backend suite passed 140 tests, including four full conversational collection scenarios and nine collection unit tests. The isolated shipping SQL suite passed, including tenant/role denials, stale/paused/expired settings, changed policy, cancellation, replay, expiry, no-booking assertions and transactional redaction. Website TypeScript passed. These are simulated conversation and database checks, not proof of a real Meta send or customer pickup. Production webpack build and TypeScript passed. The retention job is installed; actual collection records remain zero. No real WhatsApp acceptance was performed.

Next: reliable merchant-approved parcel defaults, fresh order/policy/address/courier/price/funding checks, one reservation/submission, exact-attempt reconciliation and verified label/status delivery. Do not let an AI answer or a saved address alone trigger shipping.

31 October continuation: Task 8 now implements an additional default-off sandbox booking path using exact merchant-approved parcel profiles. When enabled and authorized, successful collection confirmation can enter fresh booking checks rather than stopping at the parcel-review message. See [booking implementation](oto-whatsapp-booking.md). Worker deployment and a real full WhatsApp test remain pending; this supersedes the earlier statement that no booking code is connected locally.
