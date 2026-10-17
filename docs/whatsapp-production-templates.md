# Reload return updates for Meta review

Create these as **Utility** templates in WhatsApp Manager for both `ar` and `en_US`. Each body has one variable, `{{1}}`, containing the return reference (for example `RL-1234ABCD`). The backend sends ordinary replies while the customer service window is open and uses these templates for later status updates. Do not enable later status updates until Meta approves the templates.

| Template name | Arabic body (`ar`) | English body (`en_US`) |
| --- | --- | --- |
| `reload_return_approved` | `تحديث طلب الإرجاع {{1}}: وافق المتجر على الطلب. يرجى إرسال المنتج أو تسليمه وفق تعليمات المتجر.` | `Return {{1}}: The store approved your request. Please send or deliver the item using the store’s instructions.` |
| `reload_return_item_received` | `تحديث طلب الإرجاع {{1}}: استلم المتجر المنتج المرتجع. المبلغ المسترد بانتظار التأكيد النهائي.` | `Return {{1}}: The store received your item. Your refund is awaiting final confirmation.` |
| `reload_return_completed` | `تحديث طلب الإرجاع {{1}}: أكمل المتجر طلب الإرجاع. لمعرفة موعد استرداد المبلغ، تواصل مع المتجر.` | `Return {{1}}: The store marked your return complete. Please check with the store for the refund timing.` |
| `reload_return_cancelled` | `تحديث طلب الإرجاع {{1}}: أُلغيت حالة الإرجاع. أرسل رداً إذا احتجت إلى مساعدة.` | `Return {{1}}: Your return case was cancelled. Reply if you need help.` |

These templates describe a **case status**, not payment or shipping execution. Reload does not issue the refund or book return shipping in the current flow. The customer may send a photo; Reload stores provided evidence privately and creates a merchant-visible case when the published policy returns eligible or manual review. Image analysis only provides a review note. The merchant remains responsible for the physical item and the refund.

The registered WhatsApp number is `+966 55 236 2631` (Phone Number ID `1418354908018050`, WABA ID `2165590787358223`). Configure the RELOAD Meta app webhook to `https://clwczcvxosudfevjznmk.supabase.co/functions/v1/whatsapp-webhook`, enter the value of the Supabase `WHATSAPP_VERIFY_TOKEN` secret, and subscribe the `messages` field. Keep the access token, app secret, and verify token in Supabase Edge Function secrets only.

## Reconciliation on 2026-10-13

The owner later confirmed live-number WABA 2165590787358223 and successfully subscribed it to the app; earlier setup notes listed 2003054410376909. Verify the current phone-to-WABA association in Meta before changing hosted secrets. Hosted secrets-list checks cannot reveal their actual stored values. Live replies were confirmed by the owner in chat; template approvals, payment method, limits and business-verification state were not rechecked in this documentation audit. Product photos are optional. Never interpret a case status as a bank refund confirmation.
