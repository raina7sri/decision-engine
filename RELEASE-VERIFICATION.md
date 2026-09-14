# Release verification

## Local release candidate — September 13, 2026

Prepared from the supplied completed version 7 archive. The comparison matrix UI, DecisionHandoff component, shared DecisionRecord logic, original positioning example, and 17 original tests are unchanged. The System Map received its authorized post-verification release update. The original visual rules are preserved; explicit Tailwind source declarations ensure utilities are emitted when building from a hidden workspace folder.

Release changes: static Next.js export with `/decision-engine` base path and matching favicon; removal of Sites, edge-worker, database, authentication, and unused starter infrastructure; MIT license; project documentation; generic/positioning examples; CI and Pages workflow; one additional Markdown regression test. No runtime decision data is included in the repository.

### Checks performed

- All 17 original tests passed; the additional Markdown table/invalidated-decision test passed (18 total).
- TypeScript typecheck passed.
- ESLint passed.
- Production static build passed, including its TypeScript check.
- Source scan found no Sites project/version identifiers, internal source URLs, credentials, or runtime state in the release application files.
- Canonical JSON round trips passed for both committed synthetic examples.

### Browser acceptance on the production export

Tested the actual static output at `/decision-engine/`, using desktop (1440 × 1000) and mobile (375 × 812) viewports.

- Incomplete comparison has no leader; blank remains distinct from explicit zero.
- Equal complete scores show a tie; failed Must meet thresholds prevent a recommendation; one eligible leader produces the deterministic draft.
- A fictional non-GTM vendor comparison was created and confirmed by a named fictional recorder without MOS setup.
- Score rationale, source/reference, and uncertainty survived saved-draft recovery and appeared in the downloaded report.
- Both decision-rationale edits and score edits invalidated confirmation.
- Actual downloaded JSON was imported through the guarded file picker and re-exported; the parsed files matched exactly.
- Actual downloaded Markdown parsed and visually rendered with its matrix, thresholds, evidence notes, named recorder, and provenance intact.
- Saved checkpoint reopening and prior-draft restoration succeeded through replacement guards.
- Criterion, description, weight, option, and score editing worked; temporary criteria/options were added and removed.
- Original positioning criterion `Marketing Screenshot` and the ten-criterion example remained available.
- Mobile matrix editing and click/touch help worked. Horizontal overflow was contained within the matrix rather than the page.
- Desktop/mobile presentation was visually inspected after the Tailwind build fix. No browser console errors were observed.

## Publication status

The [public repository](https://github.com/raina7sri/decision-engine) and [GitHub Pages deployment](https://raina7sri.github.io/decision-engine/) were verified. The first published source tree exactly matched the locally verified candidate. [GitHub Actions run 34793075196](https://github.com/raina7sri/decision-engine/actions/runs/34793075196) passed installation, all 18 tests, typecheck, lint, production build, artifact upload, and deployment on commit `087cd0e7d127faf13ba5e554fd81c01230e9b812`.

The public URL was opened in a browser and verified with a fictional non-GTM decision, named confirmation, and actual Markdown download. Mobile layout at 375 × 812 loaded the repository-prefixed stylesheet correctly with no page-level overflow; no browser console errors were observed.

Only after that verification, the System Map Decision Engine entry changed directly from “Prototype built” to “Shipped — Open Source.” It now links both verified URLs, names the requested inputs and outputs, and preserves the explicit human/system boundaries. Other map entries, the private Site, and the MOS repository were not modified.

## Scope and limitations

This is local-browser acceptance, not an exhaustive accessibility audit or cross-browser certification. The private live page required a separate sign-in; parity was checked against the supplied source rather than an authenticated live-page comparison. Browser-local storage, human-entered evidence, local attestation, manual MOS export, and the absence of automatic cross-tool stale-state synchronization remain unchanged limitations.
