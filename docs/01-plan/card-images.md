# Card images and simplified list

- Remove closed/trash sections and status selector from card UI; retain old records privately. Delete stays soft, with immediate undo instead of a trash section.
- Show official product image URLs only from a fixed approved list, alongside existing safe embedded images; do not fetch arbitrary URLs or publish user data.
- Confirmed products: Hana Travelog check Mastercard; Shinhan Global+ check standard (not Wally). Official sources: https://m.hanacard.co.kr/MKCDCM1010M.web?CD_PD_SEQ=15356 and https://www.shinhancard.com/pconts/html/card/apply/check/1192668_2206.html.
- Restore matching existing Travelog record rather than duplicating it; add Global+ only if absent. Unknown private billing/issue dates remain unset. No permanent deletion.

## Verified report
- Full npm check passed (73 tests). Synthetic browser confirms no closed/trash sections, two loaded official images and delete/undo restoration.
- Shinhan canonical HTML contains an obsolete PNG URL; actual rendered official page uses https://cdn.www.shinhancard.com/pconts/static/images/card/plate/BGCBUR_00_h_f_d.webp, verified loaded. Hana official image is an animated rotating-design representative, not a user-specific plate.
- Owner-scoped requested data updates verified separately, without publishing private rows. Image URL allowlist blocks arbitrary remote content; failed image hides without breaking editor.
- Revision 0aac1daf27d6b9e9. Synthetic screenshot outputs/card-images-qa.png excluded from git.
