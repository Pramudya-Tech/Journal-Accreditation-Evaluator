# Verification record

Verified locally on 28 September 2026 using Node.js 24.19.0 and Chromium, against the workbook supplied in this conversation.

- 32 criterion titles, eight section titles, and all 114 original option labels matched their source cells exactly.
- Original workbook SHA-256 matched the provenance recorded in `public/rubric.json`.
- Positive section maxima: 2, 22, 7, 3, 12, 34, 20 = 100. Disincentives tested down to −23.
- All 164 upward score transitions produced criterion-specific recommendations without undefined text.
- 18 automated test assertions/subtests passed (`npm test`), covering scoring and rank boundaries, incomplete assessments, abstract 2→3, schema validation, AI payload/parsing, authentication, ownership isolation, CSRF/origin checks, session revocation, password changes, private file blocking, and stale/concurrent updates.
- Browser workflow passed: public registration when explicitly enabled, login session, evaluation creation, section navigation, abstract 2→3 plan, condition/evidence notes, task owner/deadline/status, save/reload, missing-key guidance, print report, logout, and negative disincentives.
- Desktop viewport 1440×1050 and mobile viewport 390×844 checked. No page JavaScript errors or horizontal overflow in tested workflows.
- Browser print generated a four-page A4 report for the sample evaluation. This sample has one assessed positive criterion; real report length depends on answers and evidence.
- Interactive administrator account creation completed with no password echo; online SQLite backup completed successfully.
- Tailwind compiled successfully. Runtime does not require npm dependencies or a CSS CDN.

Screenshots under `docs/screenshots/` use an illustrative test journal and test account. They are interface examples, not an actual accreditation assessment.

Not performed: paid live OpenAI requests, production HTTPS deployment, Docker execution, independent security audit, migration of accounts/evaluations from the previous hosted application, or external verification of current national accreditation regulations. AI request structure and failure handling were tested locally; configure your key and run the documented live connection check after deployment.
