# Reload design system

## Direction

Monochrome-first Brand System 3.0: warm off-white/ink surfaces, one restrained selection accent, separate semantic status colours and readable evidence. Revised 2026-10-13 against the workspace and public-site code.

## Tokens

Brand System 3.0 is monochrome first. Light mode is ink `#0F0F12` on off-white `#F8F7F4` with white cards and stone `#E7E9EF` borders; dark mode inverts to off-white on ink. Primary actions are solid ink (white in dark mode). Blue-violet is a 10% signal for focus and selection only: deep accent `#4557C7` on light (text-safe at 5.70:1) and soft accent `#AEB8F5` on dark, exposed as `--brand-accent` and `--ring`. Eligibility/status colours stay separate from brand colour. Tokens are defined as CSS variables in `src/index.css` and consumed through Tailwind utilities.

## Typography

Sora is used for display headings. Manrope is used for body copy, labels, navigation, tables, and forms. Both are bundled through Fontsource with system fallbacks.

## Layout

Public marketing content uses a maximum width near 1200px. Merchant content uses a maximum width near 1280px with a stable sidebar. Customer forms use a maximum width near 520px. Mobile flows stack content and keep primary actions full width.

## Motion and interaction

Buttons use short transitions. Cards use subtle border or shadow changes. Disclosures use Radix keyboard behavior. Reduced motion disables translated movement and prolonged animation. There are no decorative looping animations or forced scroll effects.

## Accessibility and RTL

Controls use visible focus styles, semantic labels, keyboard-friendly Radix primitives, and separate outcome/status labels. Arabic and English with RTL are implemented. Use logical spacing and direction-aware icons; verify both directions at desktop and 390px with no sideways scrolling.

## Shared implementation rules

Reuse `src/components/desk/primitives.tsx` (TWEEN, QUICK, EASE, Segmented, Metric, Panel, EmptyState), ProgressRing and integration steppers. PageHeader unifies merchant headings/help; SetupChecklist reflects real setup state. Use rounded-2xl cards and rounded-xl controls, shaped skeletons and brief 200–350ms transitions; reduced-motion users must not get translated/looping effects. Use AlertDialog for destructive confirmations.

The current public footer is a normal footer with a faded wordmark, not the former curtain reveal. Workspace Inbox supports larger/full conversation views and collapsible context panels. Knowledge import explains how to find Zid/Salla public-page links and offers pasted text or guided setup. Native WhatsApp messages cannot run custom CSS animations.
