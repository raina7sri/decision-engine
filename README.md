# Decision Engine

[Use Decision Engine](https://raina7sri.github.io/decision-engine/) · [GitHub repository](https://github.com/raina7sri/decision-engine) · [Checks and deployment](https://github.com/raina7sri/decision-engine/actions/workflows/checks-and-pages.yml)

An editable comparison matrix that makes tradeoffs inspectable and preserves the human decision behind them. Built for leaders, operators, and teams choosing among alternatives—from positioning to a fictional vendor selection. It needs no account, backend, paid model, or MOS setup.

## The problem

High-stakes choices often leave behind a recommendation without the criteria, evidence, uncertainty, or rationale needed to understand it later. Decision Engine keeps those parts together in a versioned, portable record. A weighted score supports judgment; it does not replace it.

## Workflow

1. Start blank or load the original illustrative positioning example. Define the decision question and edit criteria, descriptions, weights, and options in one matrix.
2. Enter integer scores from 0–10. Blank means unknown; zero is a deliberate score. Add rationale, source/reference, and uncertainty to each score. Set criterion-level **Must meet** thresholds only when they are real eligibility requirements.
3. Inspect the comparison. No leader is declared until every score is complete. Failed thresholds exclude an option from leadership; ties produce no unique recommendation. One complete eligible leader permits deterministic recommendation drafting.
4. Review or change the draft, name the human recorder, explain the final call, and record it. Later comparison or decision edits invalidate the earlier confirmation.
5. Save a local checkpoint, download a lossless JSON backup, or download a readable Markdown report. Import JSON to continue on another browser or device. A current confirmed decision can optionally produce an MOS handoff.

People own criteria, evidence judgment, eligibility requirements, and the final call. The Engine calculates, blocks false leaders, applies eligibility rules, prepares a deterministic recommendation, persists records, and invalidates stale confirmations. It does not independently research or verify sources.

## Run locally

Requires Node.js 22.13+ and pnpm 11.19.0. Install pnpm using your usual Node package manager (`npm install -g pnpm@11.19.0`).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000/decision-engine/`.

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

The original 17 tests include Markdown reports, blank/zero handling, weighted arithmetic, eligibility, ties, migrations, confirmation invalidation, JSON round trips, and MOS boundaries. See [the tests](app/decision-record.test.ts).

## Architecture and portability

- `app/page.tsx`: the original matrix UI, browser-local persistence, checkpoint/recovery controls, and downloads.
- `app/decision-handoff.tsx`: human decision form and provenance presentation.
- `app/decision-record.ts`: shared Zod contracts, comparison, deterministic drafting, confirmation/invalidation, migration, Markdown rendering, and optional MOS adapter. These functions can be reused without React.
- `app/data.ts`: blank model, original positioning example, and System Map content.
- `components/ui/`, `app/globals.css`, and `vendor/`: accessible UI primitives and preserved presentation.

Next.js statically exports the application into `out/`. All decision processing runs in the browser. Local storage keeps the active draft, an explicit saved checkpoint, and a prior draft for recovery. They are not a server audit trail. JSON is the canonical portable record; Markdown is a readable companion and cannot be imported. See [DecisionRecord 3.1 and MOSAlignmentHandoff 2.1](DECISION-HANDOFF.md).

## Examples

The in-app positioning example retains ten original criteria, the first five at double weight, and the three illustrative directions: AI-visible content, branded/customizable content, and content velocity. These compare which promise leads, not necessarily mutually exclusive capabilities. All example scores are synthetic demonstrations, not historical evidence or measured business results.

The [examples](examples/) include a fictional non-GTM vendor decision and positioning backups/reports. They contain no client evidence. A generic record does not require MOS. Never publish a real backup without reviewing its question, notes, references, and named decision maker.

## Deploy to GitHub Pages

The included GitHub Actions workflow runs tests, typecheck, lint, and build on pull requests and pushes to `main`. On `main`, it uploads `out/` and deploys it to Pages. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions**. The workflow requires `contents: read`, `pages: write`, and `id-token: write`; it uses no application secrets.

The default build path is `/decision-engine`, matching a project repository named `decision-engine`. For another repository, set `NEXT_PUBLIC_BASE_PATH` to `/<repository-name>` at build time; for a root domain use an empty value. The favicon uses the same prefix. Publish the contents of `out/`, not the source tree. No server, database, or edge worker is needed.

## Limitations

- Browser-local data can be cleared and does not sync automatically. Export backups for durable or cross-device use; private-prototype drafts must be exported there and imported here because browser origins differ.
- Human-entered evidence labels and references are not independently verified. There are no paid model calls, simulated research, or automatic retrieval.
- Named confirmation is a local attestation, not authenticated identity, a digital signature, or a tamper-proof approval log.
- Weighted scoring is sensitive to human choices of criteria, scales, and weights. The tool makes those choices visible, not objectively correct.
- MOS transfer is a downloaded adapter, not a connected integration. A strategic decision grants no messaging, claim, proof, or generation approval. Consumer compatibility must be independently validated.
- The matrix scrolls horizontally on narrow screens; very large comparisons can be cumbersome. A 320px minimum page width is retained.
- Markdown includes human-authored text; review it before rendering or publishing. Use a renderer that sanitizes HTML for untrusted reports.
- The System Map describes a wider operating system and is not evidence that every connection is implemented.

## Source and license

This is a behavior-preserving transfer of the completed version 7 source, not a recreated prototype. The application logic and original tests are retained; release changes remove starter/Sites infrastructure, configure static hosting, and add documentation and automation. See [release verification](RELEASE-VERIFICATION.md) for the checks, browser acceptance, and public deployment evidence.

MIT licensed. Vendored third-party styles retain their own [MIT notice](vendor/shadcn-tailwind-4.13.0.LICENSE.md); dependencies retain their respective licenses.
