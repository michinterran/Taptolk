# Admin Command Center Design QA

## Reference

- Source concept: `생성된 이미지 3.png` supplied by the operator.
- Target: authenticated Super Admin command center and its management-company, managed-location,
  QR production, operations, report, revenue, account, and profile workspaces.
- Review viewport: 1487 × 1058 CSS pixels for the desktop comparison, followed by responsive
  checks at 320, 768, and 1280 CSS pixels.

## Comparison result

- The reference and implementation were reviewed together at the same desktop viewport and state.
- The implementation now follows the reference's compact left rail, low-height page header,
  restrained card density, table-first portfolio, concise metric strip, and right-sized actions.
- The previous oversized hero typography, duplicated shortcut cards, ambiguous customer hierarchy,
  and page-level horizontal overflow were removed.
- The 320px implementation keeps the document within the viewport; wide operational tables scroll
  inside their own region instead of widening the page.
- The immutable Taptolk logo remains byte-identical to the approved source.

## Browser evidence

- Authenticated desktop review: platform dashboard, management companies, QR production,
  operations, reports, revenue, accounts, and profile — PASS.
- Authenticated responsive review: dashboard at 320, 768, and 1280; QR production at 320 and 768 —
  PASS with no page-level horizontal overflow.
- Core interactions reviewed: left navigation, account menu, hierarchy links, company/site detail
  navigation, QR wizard disclosure, template choices, quantity controls, and role-specific pages.
- Visual screenshots were retained only in the local Codex visualization workspace and do not
  contain credentials, tokens, phone numbers, messages, or QR activation material.

## Remaining hands-on checks

- Real iOS/Android device and screen-reader journeys.
- Computed contrast inspection in the final Production browser state.
- Physical 85mm print, trim, adhesive, and scan-distance validation with approved artwork.
- Licensed apartment or managed-location brand assets supplied by their rights holder.
