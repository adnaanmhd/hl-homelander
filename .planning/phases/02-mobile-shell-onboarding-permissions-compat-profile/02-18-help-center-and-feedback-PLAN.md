---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 18
id: 02-18-help-center-and-feedback
name: HelpCenterScreen + AccordionItem + ReportProblemSheet + feedbackService (POST /feedback multipart) + Help content build script
type: execute
wave: 4
depends_on: [02-17-profile-screen, 02-04-installation-id-and-telemetry-ring]
files_modified:
  - apps/mobile/scripts/build-help-content.mjs
  - apps/mobile/src/screens/help/content.json
  - apps/mobile/src/screens/help/HelpCenterScreen.tsx
  - apps/mobile/src/components/AccordionItem.tsx
  - apps/mobile/src/components/ReportProblemSheet.tsx
  - apps/mobile/src/services/feedbackService.ts
  - apps/mobile/__tests__/screens/HelpCenterScreen.test.tsx
  - apps/mobile/__tests__/components/AccordionItem.test.tsx
  - apps/mobile/__tests__/components/ReportProblemSheet.test.tsx
  - apps/mobile/__tests__/services/feedbackService.test.ts
  - apps/mobile/__tests__/scripts/build-help-content.test.ts
  - apps/mobile/package.json
  - apps/mobile/src/navigation/RootNativeStack.tsx
autonomous: true
requirements: [HELP-01, HELP-02, HELP-03, HELP-04, HELP-05]
must_haves:
  truths:
    - 'Help Center has 3 accordions in this exact order, all collapsed by default: Instructions Guide / FAQs / Troubleshooting (HELP-01)'
    - 'Help content is sourced verbatim from help-center-content.md via a build-time parser (apps/mobile/scripts/build-help-content.mjs) emitting apps/mobile/src/screens/help/content.json (D-HELP-01); the JSON is committed for review; editing the markdown re-runs the script (npm run prebuild) (HELP-02)'
    - 'Contact Support entry below the third accordion opens mailto: with [EMAIL_ADDRESS] placeholder (HELP-03; final email tracked as Open Question + flagged in 02-21 manual smoke)'
    - "HelpCenter is reachable ONLY from Profile (via PROF-04 row → RootStack 'HelpCenter' route); no other entry point (HELP-04)"
    - 'ReportProblemSheet posts to POST /feedback as multipart with { category, message, diagnostic } where diagnostic = JSON of { appVersion, buildIdentifier, osVersion, deviceModel, telemetryRing } (HELP-05; D-HELP-02)'
    - 'feedbackService.submitFeedback wraps apiClient multipart POST + idempotency-key ULID per call; Phase 1 endpoint accepts FEEDBACK_CATEGORIES enum'
    - 'Help build script is wired via package.json prebuild npm script so npm install / npm run start re-emits content.json deterministically'
  artifacts:
    - path: 'apps/mobile/scripts/build-help-content.mjs'
      provides: 'MD → JSON content baker; runs at npm prebuild'
      contains: 'help-center-content.md'
    - path: 'apps/mobile/src/screens/help/content.json'
      provides: 'Baked accordion content (Instructions Guide / FAQs / Troubleshooting)'
      contains: 'Instructions Guide'
    - path: 'apps/mobile/src/screens/help/HelpCenterScreen.tsx'
      provides: 'Help Center screen per design-spec §17'
      contains: 'Contact Support'
    - path: 'apps/mobile/src/services/feedbackService.ts'
      provides: 'submitFeedback({ category, message, diagnosticSnapshot })'
      contains: 'POST.*feedback'
  key_links:
    - from: 'apps/mobile/src/screens/help/HelpCenterScreen.tsx'
      to: 'apps/mobile/src/screens/help/content.json'
      via: "import content from './content.json'"
      pattern: 'content.json'
    - from: 'apps/mobile/src/components/ReportProblemSheet.tsx'
      to: 'apps/mobile/src/services/feedbackService.ts'
      via: 'submitFeedback({ category, message, diagnosticSnapshot })'
      pattern: 'submitFeedback'
    - from: 'apps/mobile/src/services/feedbackService.ts'
      to: 'apps/mobile/src/services/telemetryRing.ts'
      via: 'telemetryRing.snapshot() inside diagnostic snapshot'
      pattern: 'telemetryRing.snapshot'
---

<objective>
Ship the entire Help Center + Report-a-problem flow: build-time markdown parser baking help-center-content.md → content.json, the screen + accordions reading the baked content, the Contact Support mailto, and the in-app Report Problem sheet posting diagnostic snapshots to POST /feedback per HELP-05.

Purpose: Closes HELP-01..05. The build-time parsing decision (D-HELP-01) keeps content reviewable + deterministic + offline-friendly, with no runtime markdown dependency. The diagnostic snapshot (D-HELP-02) consumes the telemetry ring buffer shipped in plan 02-04.
Output: working Help Center reachable from Profile, accordion content from help-center-content.md verbatim, mailto button, Report-a-problem sheet posting multipart feedback with telemetry ring snapshot.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/src/services/telemetryRing.ts
@apps/mobile/src/services/api.ts
@apps/mobile/src/services/auth.ts
@apps/mobile/src/native/AppFlavor.ts
@apps/api/src/routes/feedback/post.ts
@shared/types/src/feedback.ts
@help-center-content.md
@design-spec.md
@idea-brief.md

<interfaces>
<!-- shared/types FEEDBACK_CATEGORIES (Phase 1) -->
export const FEEDBACK_CATEGORIES = [
  'app-crashed', 'task-doesnt-start', 'upload-stuck', 'login-issue',
  'video-quality-issue', 'imu-issue', 'thermal-issue', 'other',
] as const;
export const FeedbackFieldsSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string().min(1).max(4000),
});

<!-- D-HELP-02 — diagnostic snapshot shape -->

{
appVersion: string, // BuildConfig.VERSION_NAME
buildIdentifier: string, // `${VERSION_NAME}-${flavor} (${VERSION_CODE})`
osVersion: string, // Platform.Version
deviceModel: string, // NativeModules.AppFlavor.deviceModel
telemetryRing: { name: string; ts: number; props: Record<string, string> }[],
}

<!-- design-spec §17 / help-center-content.md structure -->

Three accordions in this order, all collapsed by default:

1. Instructions Guide (subsections: Before you record / Starting / While / Stopping / Practice / Uploads / Payouts)
2. FAQs (Q/A pairs)
3. Troubleshooting (Issue → Resolution pairs)
   Footer: Contact Support → mailto:[EMAIL_ADDRESS] (placeholder; final email is OPEN QUESTION)
   </interfaces>
   </context>

<threat_model>

## Trust Boundaries

| Boundary                                             | Description                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| help-center-content.md → build script → content.json | committed; reviewed in PR; deterministic                                                                        |
| User-typed `message` → POST /feedback                | Phase 1 backend FeedbackFieldsSchema enforces 1-4000 chars                                                      |
| Telemetry ring → diagnostic snapshot                 | RESEARCH § Security V8 + Pitfall: ring contains no PII per engineering-handoff §11 — names + non-PII attrs only |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                         | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ---------------------- | ----------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.18-01 | Information Disclosure | Diagnostic snapshot leaks user PII via the telemetry ring         | mitigate    | Per RESEARCH § Security pattern row 8: telemetry events are pre-filtered (engineering-handoff §11 = event names + IDs/durations/sizes/network type only — NO name/email/task content/filenames). Plan 02-04 enforces the filter at append time. This plan adds a defensive grep test on telemetryRing.test.ts to assert no event uses 'email' / 'name' / 'filename' as a property key. |
| T-2.18-02 | Tampering              | Help build script writes attacker-controlled JSON into the bundle | accept      | Source file (help-center-content.md) is in-repo + reviewed in PR; script reads it from the repo root. Output is committed alongside the script change in the same PR.                                                                                                                                                                                                                  |
| T-2.18-03 | Spoofing               | Idempotency-Key reuse on POST /feedback (replay)                  | mitigate    | feedbackService mints a fresh ULID per submitFeedback call — same shape as profileService.patchMe (plan 02-17). Backend Phase 1 plan 01-08 enforces idempotency-key uniqueness in the global pre-handler with a per-flavor multipart fallback.                                                                                                                                         |

</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: build-help-content.mjs script + content.json + prebuild wiring</name>
  <files>apps/mobile/scripts/build-help-content.mjs, apps/mobile/src/screens/help/content.json, apps/mobile/__tests__/scripts/build-help-content.test.ts, apps/mobile/package.json</files>
  <read_first>
    - help-center-content.md (full file — input to the script)
    - apps/api/scripts/parse-taxonomy.ts (analog: Phase 1 markdown parsing pattern from .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md § "build-help-content" line 122)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-HELP-01 (build-time parse, JSON committed)
    - apps/mobile/package.json (current scripts — verify prebuild is or will be wired)
  </read_first>
  <action>
    Author `apps/mobile/scripts/build-help-content.mjs`:
    ```javascript
    #!/usr/bin/env node
    /**
     * D-HELP-01 — bake help-center-content.md into a typed JSON for HelpCenterScreen to render.
     *
     * Schema:
     *   {
     *     accordions: [
     *       { id: 'instructions-guide' | 'faqs' | 'troubleshooting',
     *         title: 'Instructions Guide' | 'FAQs' | 'Troubleshooting',
     *         items: [
     *           { kind: 'subsection', heading: string, body: string }     // Instructions Guide
     *         | { kind: 'qa', question: string, answer: string }           // FAQs
     *         | { kind: 'issue', heading: string, resolution: string }     // Troubleshooting
     *         ]
     *       },
     *       ...
     *     ],
     *     contactSupport: { headline: string, body: string }
     *   }
     *
     * Run via `npm run build:help` or auto-fired by `npm run prebuild`.
     */
    import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
    import { dirname, resolve } from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const SOURCE = resolve(__dirname, '../../../help-center-content.md');
    const OUT = resolve(__dirname, '../src/screens/help/content.json');

    function parseHelpCenter(md) {
      const lines = md.split(/\r?\n/);

      const accordions = [];
      const contactSupport = { headline: 'Need more help?', body: '' };

      let currentAccordion = null;
      let pendingItem = null;
      let bodyLines = [];

      const flushItem = () => {
        if (!pendingItem || !currentAccordion) return;
        const body = bodyLines.join('\n').trim();
        if (currentAccordion.id === 'instructions-guide') {
          currentAccordion.items.push({ kind: 'subsection', heading: pendingItem, body });
        } else if (currentAccordion.id === 'faqs') {
          currentAccordion.items.push({ kind: 'qa', question: pendingItem, answer: body });
        } else if (currentAccordion.id === 'troubleshooting') {
          currentAccordion.items.push({ kind: 'issue', heading: pendingItem, resolution: body });
        }
        pendingItem = null;
        bodyLines = [];
      };

      for (const line of lines) {
        // ## 1. Instructions Guide / 2. FAQs / 3. Troubleshooting / Contact Support
        const h2 = line.match(/^## (?:\d+\. )?(.+)$/);
        if (h2) {
          flushItem();
          currentAccordion = null;
          const title = h2[1].trim();
          if (title === 'Instructions Guide') {
            currentAccordion = { id: 'instructions-guide', title: 'Instructions Guide', items: [] };
            accordions.push(currentAccordion);
          } else if (title === 'FAQs') {
            currentAccordion = { id: 'faqs', title: 'FAQs', items: [] };
            accordions.push(currentAccordion);
          } else if (title === 'Troubleshooting') {
            currentAccordion = { id: 'troubleshooting', title: 'Troubleshooting', items: [] };
            accordions.push(currentAccordion);
          } else if (title === 'Contact Support') {
            currentAccordion = { id: '__contact', items: [] };
          }
          continue;
        }

        // ### Subsection (Instructions Guide only)
        const h3 = line.match(/^### (.+)$/);
        if (h3 && currentAccordion?.id === 'instructions-guide') {
          flushItem();
          pendingItem = h3[1].trim();
          continue;
        }

        // **Question** (FAQs and Troubleshooting both use bold-only Q-headlines)
        const bold = line.match(/^\*\*(.+?)\*\*$/);
        if (bold && (currentAccordion?.id === 'faqs' || currentAccordion?.id === 'troubleshooting')) {
          flushItem();
          pendingItem = bold[1].trim();
          continue;
        }

        if (currentAccordion?.id === '__contact') {
          contactSupport.body += (contactSupport.body ? '\n' : '') + line.trim();
          continue;
        }

        if (pendingItem != null) {
          bodyLines.push(line);
        }
      }
      flushItem();

      // Trim contactSupport body
      contactSupport.body = contactSupport.body.replace(/^---+$/gm, '').trim();

      return { accordions, contactSupport };
    }

    function main() {
      const md = readFileSync(SOURCE, 'utf-8');
      const parsed = parseHelpCenter(md);

      // Sanity: 3 accordions in the right order (HELP-01 invariant baked into the script)
      const order = parsed.accordions.map((a) => a.id);
      const expected = ['instructions-guide', 'faqs', 'troubleshooting'];
      if (order.length !== 3 || order.some((id, i) => id !== expected[i])) {
        throw new Error(`HELP-01 violation: expected accordions [${expected.join(', ')}], got [${order.join(', ')}]`);
      }
      if (parsed.accordions.some((a) => a.items.length === 0)) {
        throw new Error('HELP-02 violation: at least one accordion has 0 items — check help-center-content.md formatting');
      }

      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(OUT, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
      // eslint-disable-next-line no-console
      console.log(`build-help-content: wrote ${OUT} (${parsed.accordions.length} accordions, ${parsed.accordions.reduce((n, a) => n + a.items.length, 0)} items)`);
    }

    // Allow import without execution for tests.
    if (import.meta.url === `file://${process.argv[1]}`) {
      main();
    }

    export { parseHelpCenter };
    ```

    Author `apps/mobile/__tests__/scripts/build-help-content.test.ts`:
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { readFileSync } from 'node:fs';
    import { resolve, dirname } from 'node:path';
    import { fileURLToPath } from 'node:url';

    // @ts-ignore — .mjs ESM import
    import { parseHelpCenter } from '../../scripts/build-help-content.mjs';

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const md = readFileSync(resolve(__dirname, '../../../../help-center-content.md'), 'utf-8');

    describe('build-help-content', () => {
      it('parses 3 accordions in HELP-01 order', () => {
        const parsed = parseHelpCenter(md);
        expect(parsed.accordions.map((a: { id: string }) => a.id)).toEqual(['instructions-guide', 'faqs', 'troubleshooting']);
      });

      it('Instructions Guide has all 7 subsections', () => {
        const parsed = parseHelpCenter(md);
        const ig = parsed.accordions.find((a: { id: string }) => a.id === 'instructions-guide');
        const headings = ig.items.map((i: { heading: string }) => i.heading);
        expect(headings).toEqual([
          'Before you record', 'Starting a recording', 'While recording', 'Stopping a recording',
          'Your first recording (Practice)', 'Uploads', 'Payouts',
        ]);
      });

      it('FAQs accordion has multiple Q/A pairs (kind=qa)', () => {
        const parsed = parseHelpCenter(md);
        const faqs = parsed.accordions.find((a: { id: string }) => a.id === 'faqs');
        expect(faqs.items.length).toBeGreaterThanOrEqual(10);
        expect(faqs.items[0].kind).toBe('qa');
        expect(faqs.items[0].question).toMatch(/.+/);
        expect(faqs.items[0].answer).toMatch(/.+/);
      });

      it('Troubleshooting accordion items use kind=issue', () => {
        const parsed = parseHelpCenter(md);
        const ts = parsed.accordions.find((a: { id: string }) => a.id === 'troubleshooting');
        expect(ts.items[0].kind).toBe('issue');
      });

      it('Contact Support body contains [EMAIL_ADDRESS] placeholder until OPEN QUESTION resolves', () => {
        const parsed = parseHelpCenter(md);
        expect(parsed.contactSupport.body).toContain('[EMAIL_ADDRESS]');
      });
    });
    ```

    Update `apps/mobile/package.json`: add `"build:help": "node scripts/build-help-content.mjs"` and ensure `"prebuild": "npm run build:help"` runs before any production build (or wire into `start` if no separate prebuild step). After editing package.json, run the script once to generate `apps/mobile/src/screens/help/content.json` and commit it (D-HELP-01: JSON is committed for review).

    Run `cd apps/mobile && node scripts/build-help-content.mjs && npm run test -- build-help-content --run` — must pass.

  </action>
  <acceptance_criteria>
    - `test -f apps/mobile/scripts/build-help-content.mjs` succeeds.
    - `test -f apps/mobile/src/screens/help/content.json` succeeds.
    - `node -e "const c = require('./apps/mobile/src/screens/help/content.json'); if (c.accordions.length !== 3) process.exit(1); if (c.accordions[0].id !== 'instructions-guide') process.exit(2); if (c.accordions[1].id !== 'faqs') process.exit(3); if (c.accordions[2].id !== 'troubleshooting') process.exit(4);"` exits 0.
    - `grep -q "build:help" apps/mobile/package.json` succeeds.
    - `cd apps/mobile && npm run test -- build-help-content --run` exits 0; 5 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- build-help-content --run</automated>
  </verify>
  <done>Help content baked deterministically; HELP-01 order invariant enforced inside the script; tests cover the parsed shape.</done>
</task>

<task type="auto">
  <name>Task 2: AccordionItem component + tests</name>
  <files>apps/mobile/src/components/AccordionItem.tsx, apps/mobile/__tests__/components/AccordionItem.test.tsx</files>
  <read_first>
    - apps/mobile/src/screens/SignIn.tsx (analog: Pressable + state pattern)
    - design-spec.md §17 (accordion row: 18 px vertical pad, 1 px bottom line, chevron rotates 180° on open)
    - apps/mobile/src/screens/help/content.json (Task 1 output)
  </read_first>
  <action>
    Author `apps/mobile/src/components/AccordionItem.tsx`. Use Text + Pressable primitives from `../ui/primitives/*`; tokens from `../ui/tokens` — NO hex literals:
    ```tsx
    import React, { useState, useCallback } from 'react';
    import { View, StyleSheet } from 'react-native';
    import { ChevronDown, ChevronUp } from 'lucide-react-native';
    import { Text } from '../ui/primitives/Text';
    import { Pressable } from '../ui/primitives/Pressable';
    import { colors, spacing } from '../ui/tokens';

    export interface AccordionItemProps {
      title: string;
      children: React.ReactNode;
      defaultOpen?: boolean;
      testID?: string;
    }

    export function AccordionItem({ title, children, defaultOpen = false, testID }: AccordionItemProps): React.JSX.Element {
      const [open, setOpen] = useState(defaultOpen);
      const toggle = useCallback(() => setOpen((v) => !v), []);

      return (
        <View style={styles.row} accessibilityLabel={testID ?? `accordion-${title}`}>
          <Pressable onPress={toggle} style={styles.header} accessibilityLabel={`accordion-toggle-${title}`} accessibilityRole="button" accessibilityState={{ expanded: open }}>
            <Text variant="btnLabel" style={styles.title}>{title}</Text>
            {open ? <ChevronUp size={18} color={colors.text2} /> : <ChevronDown size={18} color={colors.text2} />}
          </Pressable>
          {open ? <View style={styles.body} accessibilityLabel={`accordion-body-${title}`}>{children}</View> : null}
        </View>
      );
    }

    const styles = StyleSheet.create({
      row: { borderBottomWidth: 1, borderBottomColor: colors.line },
      header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.ll },
      title: {},
      body: { paddingBottom: spacing.ll },
    });
    ```

    Author `apps/mobile/__tests__/components/AccordionItem.test.tsx`:
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { render, screen, fireEvent } from '@testing-library/react';
    import React from 'react';
    import { AccordionItem } from '../../src/components/AccordionItem';

    describe('AccordionItem', () => {
      it('starts collapsed by default; body not rendered', () => {
        render(<AccordionItem title="Test"><div>body</div></AccordionItem>);
        expect(screen.queryByLabelText('accordion-body-Test')).toBeNull();
      });

      it('starts expanded when defaultOpen is true', () => {
        render(<AccordionItem title="Test" defaultOpen><div>body</div></AccordionItem>);
        expect(screen.getByLabelText('accordion-body-Test')).toBeTruthy();
      });

      it('tapping the header toggles open/closed', () => {
        render(<AccordionItem title="Test"><div>body</div></AccordionItem>);
        const toggle = screen.getByLabelText('accordion-toggle-Test');
        fireEvent.click(toggle);
        expect(screen.getByLabelText('accordion-body-Test')).toBeTruthy();
        fireEvent.click(toggle);
        expect(screen.queryByLabelText('accordion-body-Test')).toBeNull();
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- AccordionItem --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "AccordionItem" apps/mobile/src/components/AccordionItem.tsx` succeeds.
    - `grep -q "useState" apps/mobile/src/components/AccordionItem.tsx` succeeds.
    - `cd apps/mobile && npm run test -- AccordionItem --run` exits 0; 3 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- AccordionItem --run && (grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/components/AccordionItem.tsx; test $? -eq 1)</automated>
  </verify>
  <done>AccordionItem ships with collapse-by-default + toggle on tap. NO hex literals in AccordionItem.</done>
</task>

<task type="auto">
  <name>Task 3: feedbackService — POST /feedback multipart + diagnostic snapshot + tests</name>
  <files>apps/mobile/src/services/feedbackService.ts, apps/mobile/__tests__/services/feedbackService.test.ts</files>
  <read_first>
    - apps/mobile/src/services/auth.ts (analog: try/catch + apiClient pattern)
    - apps/mobile/src/services/api.ts (current — verify multipart support; if missing, extend `apiClient.postMultipart`)
    - apps/mobile/src/services/telemetryRing.ts (Phase 02-04 — snapshot() returns last 100 events)
    - apps/api/src/routes/feedback/post.ts (Phase 1 wire shape)
    - shared/types/src/feedback.ts (FEEDBACK_CATEGORIES + FeedbackFieldsSchema)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md § "Diagnostic snapshot for `POST /feedback`" lines 925-961
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § D-HELP-02
  </read_first>
  <action>
    Author `apps/mobile/src/services/feedbackService.ts`:
    ```typescript
    import { Platform, NativeModules } from 'react-native';
    import { ulid } from 'ulid';
    import { apiClient } from './api';
    import { telemetryRing } from './telemetryRing';

    /** Phase 1 wire enum — shared/types/src/feedback.ts. */
    export const FEEDBACK_CATEGORIES = [
      'app-crashed', 'task-doesnt-start', 'upload-stuck', 'login-issue',
      'video-quality-issue', 'imu-issue', 'thermal-issue', 'other',
    ] as const;
    export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

    interface DiagnosticSnapshot {
      appVersion: string;
      buildIdentifier: string;
      osVersion: string;
      deviceModel: string;
      telemetryRing: ReturnType<typeof telemetryRing.snapshot>;
    }

    /** D-HELP-02 — assemble the diagnostic snapshot from native + ring. */
    export function buildDiagnosticSnapshot(): DiagnosticSnapshot {
      const flav = NativeModules.AppFlavor as { versionName?: string; versionCode?: number; flavor?: string; deviceModel?: string } | undefined;
      const versionName = flav?.versionName ?? '0.0.0';
      const versionCode = flav?.versionCode ?? 0;
      const flavor = flav?.flavor ?? 'unknown';
      const deviceModel = flav?.deviceModel ?? 'unknown';
      return {
        appVersion: versionName,
        buildIdentifier: `${versionName}-${flavor} (${versionCode})`,
        osVersion: `${Platform.OS} ${Platform.Version}`,
        deviceModel,
        telemetryRing: telemetryRing.snapshot(),
      };
    }

    export interface SubmitFeedbackInput {
      category: FeedbackCategory;
      message: string;
    }

    /**
     * POST /feedback as multipart per RESEARCH § Code Examples lines 928-959 + Phase 1
     * route plan 01-08 (FEEDBACK_CATEGORIES enum, application/json `diagnostic` part).
     *
     * Idempotency-Key minted fresh per call.
     */
    export async function submitFeedback(input: SubmitFeedbackInput): Promise<void> {
      if (!FEEDBACK_CATEGORIES.includes(input.category)) {
        throw new Error(`feedback_invalid_category:${input.category}`);
      }
      if (input.message.length < 1 || input.message.length > 4000) {
        throw new Error('feedback_message_length_out_of_range');
      }

      const diagnostic = buildDiagnosticSnapshot();
      const form = new FormData();
      form.append('category', input.category);
      form.append('message', input.message);
      // application/json blob; Phase 1 backend expects 'diagnostic' multipart field
      form.append('diagnostic', {
        name: 'diagnostic.json',
        type: 'application/json',
        // RN's FormData polyfill expects a Blob-like; backends parse `string` here too via @fastify/multipart
        string: JSON.stringify(diagnostic),
      } as unknown as Blob);

      await apiClient.postMultipart('/feedback', form, {
        headers: { 'Idempotency-Key': ulid() },
      });
    }
    ```

    If `apiClient.postMultipart` is missing in api.ts, extend it in this same task. The shape mirrors `apiClient.post` but does NOT JSON-stringify the body and lets fetch set the boundary header.

    Author `apps/mobile/__tests__/services/feedbackService.test.ts`:
    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest';

    vi.mock('ulid', () => ({ ulid: () => 'fixed-ulid-fb' }));

    vi.mock('react-native', async () => {
      const real = await vi.importActual<any>('react-native');
      return {
        ...real,
        Platform: { OS: 'android', Version: 35 },
        NativeModules: { AppFlavor: { versionName: '0.1.0', versionCode: 1, flavor: 'apkRollout', deviceModel: 'Pixel 7a' } },
      };
    });

    const postMultipartMock = vi.fn();
    vi.mock('../../src/services/api', () => ({
      apiClient: { postMultipart: (...a: unknown[]) => postMultipartMock(...a) },
    }));

    vi.mock('../../src/services/telemetryRing', () => ({
      telemetryRing: { snapshot: () => [{ name: 'signup_success', ts: 1, props: { flavor: 'apkRollout' } }] },
    }));

    import { submitFeedback, buildDiagnosticSnapshot, FEEDBACK_CATEGORIES } from '../../src/services/feedbackService';

    beforeEach(() => postMultipartMock.mockReset());

    describe('feedbackService', () => {
      it('buildDiagnosticSnapshot assembles the expected D-HELP-02 shape', () => {
        const snap = buildDiagnosticSnapshot();
        expect(snap.appVersion).toBe('0.1.0');
        expect(snap.buildIdentifier).toBe('0.1.0-apkRollout (1)');
        expect(snap.osVersion).toBe('android 35');
        expect(snap.deviceModel).toBe('Pixel 7a');
        expect(snap.telemetryRing[0].name).toBe('signup_success');
      });

      it('submitFeedback POSTs multipart with category + message + diagnostic + idempotency-key', async () => {
        await submitFeedback({ category: 'upload-stuck', message: 'My upload is stuck' });
        expect(postMultipartMock).toHaveBeenCalledTimes(1);
        const [path, form, opts] = postMultipartMock.mock.calls[0];
        expect(path).toBe('/feedback');
        expect(form).toBeInstanceOf(FormData);
        expect(opts.headers['Idempotency-Key']).toBe('fixed-ulid-fb');
      });

      it('rejects an unknown category before hitting the network', async () => {
        await expect(submitFeedback({ category: 'invalid' as never, message: 'x' })).rejects.toThrow(/feedback_invalid_category/);
        expect(postMultipartMock).not.toHaveBeenCalled();
      });

      it('rejects empty message before hitting the network', async () => {
        await expect(submitFeedback({ category: 'other', message: '' })).rejects.toThrow(/length_out_of_range/);
      });

      it('rejects message > 4000 chars before hitting the network', async () => {
        await expect(submitFeedback({ category: 'other', message: 'a'.repeat(4001) })).rejects.toThrow(/length_out_of_range/);
      });

      it('FEEDBACK_CATEGORIES matches Phase 1 enum exactly (8 values)', () => {
        expect(FEEDBACK_CATEGORIES).toEqual([
          'app-crashed', 'task-doesnt-start', 'upload-stuck', 'login-issue',
          'video-quality-issue', 'imu-issue', 'thermal-issue', 'other',
        ]);
      });
    });
    ```

    Run `cd apps/mobile && npm run test -- feedbackService --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "export async function submitFeedback" apps/mobile/src/services/feedbackService.ts` succeeds.
    - `grep -q "buildDiagnosticSnapshot" apps/mobile/src/services/feedbackService.ts` succeeds.
    - `grep -q "Idempotency-Key" apps/mobile/src/services/feedbackService.ts` succeeds.
    - `grep -q "telemetryRing.snapshot" apps/mobile/src/services/feedbackService.ts` succeeds.
    - `grep -q "FEEDBACK_CATEGORIES" apps/mobile/src/services/feedbackService.ts` succeeds.
    - `cd apps/mobile && npm run test -- feedbackService --run` exits 0; 6 tests pass.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- feedbackService --run</automated>
  </verify>
  <done>feedbackService submits multipart + diagnostic snapshot per HELP-05 + D-HELP-02; idempotency-key minted per call; pre-network validation guards added.</done>
</task>

<task type="auto">
  <name>Task 4: HelpCenterScreen + ReportProblemSheet + RootStack registration</name>
  <files>apps/mobile/src/screens/help/HelpCenterScreen.tsx, apps/mobile/src/components/ReportProblemSheet.tsx, apps/mobile/__tests__/screens/HelpCenterScreen.test.tsx, apps/mobile/__tests__/components/ReportProblemSheet.test.tsx, apps/mobile/src/navigation/RootNativeStack.tsx</files>
  <read_first>
    - apps/mobile/src/components/AccordionItem.tsx (Task 2 output)
    - apps/mobile/src/screens/help/content.json (Task 1 output)
    - apps/mobile/src/services/feedbackService.ts (Task 3 output)
    - design-spec.md §17 (Help Center layout)
    - design-spec.md §18 (Modals — sheet pattern + scrim)
    - help-center-content.md (Contact Support section)
    - REQUIREMENTS.md HELP-01..05 verbatim
  </read_first>
  <action>
    Author `apps/mobile/src/screens/help/HelpCenterScreen.tsx`. Use Text + Button + ScreenContainer primitives from `../../ui/primitives/*`; tokens from `../../ui/tokens` — NO hex literals:
    ```tsx
    import React, { useState } from 'react';
    import { View, ScrollView, StyleSheet, Linking } from 'react-native';
    import { useNavigation } from '@react-navigation/native';
    import { Text } from '../../ui/primitives/Text';
    import { Button } from '../../ui/primitives/Button';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { spacing } from '../../ui/tokens';
    import { AccordionItem } from '../../components/AccordionItem';
    import { ReportProblemSheet } from '../../components/ReportProblemSheet';
    import content from './content.json';

    /** HELP-01..04 — Help Center screen reachable only from Profile (HELP-04). */
    const SUPPORT_EMAIL_PLACEHOLDER = '[EMAIL_ADDRESS]';

    export function HelpCenterScreen(): React.JSX.Element {
      const [reportOpen, setReportOpen] = useState(false);

      return (
        <ScreenContainer accessibilityLabel="help-center-screen" padding={0}>
          <ScrollView contentContainerStyle={styles.body}>
            {content.accordions.map((acc) => (
              <AccordionItem key={acc.id} title={acc.title} testID={`accordion-${acc.id}`}>
                {renderAccordion(acc)}
              </AccordionItem>
            ))}

            <Text variant="body" tone="secondary" style={styles.contactHeadline}>{content.contactSupport.headline}</Text>

            <View style={styles.ctaWrap}>
              <Button
                variant="primary"
                accessibilityLabel="help-contact-support-mailto"
                label="Contact Support"
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL_PLACEHOLDER}?subject=${encodeURIComponent('Help — Humyn Labs Capture')}`)}
              />
            </View>

            <View style={styles.ctaWrap}>
              <Button
                variant="outline"
                accessibilityLabel="help-report-problem"
                label="Report a problem"
                onPress={() => setReportOpen(true)}
              />
            </View>
          </ScrollView>

          {reportOpen ? <ReportProblemSheet onClose={() => setReportOpen(false)} /> : null}
        </ScreenContainer>
      );
    }

    function renderAccordion(acc: typeof content.accordions[number]): React.ReactNode {
      return acc.items.map((it, idx) => {
        if (it.kind === 'subsection') {
          return (
            <View key={idx} style={styles.subsection}>
              <Text variant="body" style={styles.subsectionHeading}>{it.heading}</Text>
              <Text variant="body" tone="secondary" style={styles.subsectionBody}>{it.body}</Text>
            </View>
          );
        }
        if (it.kind === 'qa') {
          return (
            <View key={idx} style={styles.qa}>
              <Text variant="body" style={styles.qaQuestion}>{it.question}</Text>
              <Text variant="body" tone="secondary" style={styles.qaAnswer}>{it.answer}</Text>
            </View>
          );
        }
        // troubleshooting issue
        return (
          <View key={idx} style={styles.qa}>
            <Text variant="body" style={styles.qaQuestion}>{it.heading}</Text>
            <Text variant="body" tone="secondary" style={styles.qaAnswer}>{it.resolution}</Text>
          </View>
        );
      });
    }

    const styles = StyleSheet.create({
      body: { padding: spacing.xl, paddingBottom: 60 },
      subsection: { marginBottom: spacing.mdl },
      subsectionHeading: { marginBottom: spacing.xs },
      subsectionBody: {},
      qa: { marginBottom: spacing.ll },
      qaQuestion: { marginBottom: spacing.s },
      qaAnswer: {},
      contactHeadline: { marginTop: spacing.xxxl, textAlign: 'center' },
      ctaWrap: { marginTop: spacing.md, alignSelf: 'center', maxWidth: 280, width: '100%' },
    });
    ```

    Author `apps/mobile/src/components/ReportProblemSheet.tsx`. Uses Text + Button + Pressable primitives from `../ui/primitives/*` for chips/CTAs; tokens from `../ui/tokens` — NO hex literals. Modal uses raw RN `Modal` (the Modal primitive in 02-02 ships a centered-card variant; this is a bottom sheet — different layout, raw RN is correct here):
    ```tsx
    import React, { useState } from 'react';
    import { View, TextInput, StyleSheet, ScrollView, Modal, Alert } from 'react-native';
    import { Text } from '../ui/primitives/Text';
    import { Button } from '../ui/primitives/Button';
    import { Pressable } from '../ui/primitives/Pressable';
    import { colors, spacing, radii } from '../ui/tokens';
    import { submitFeedback, FEEDBACK_CATEGORIES, type FeedbackCategory } from '../services/feedbackService';

    /** HELP-05 — in-app Report a problem form. */
    export function ReportProblemSheet({ onClose }: { onClose: () => void }): React.JSX.Element {
      const [category, setCategory] = useState<FeedbackCategory | null>(null);
      const [message, setMessage] = useState('');
      const [submitting, setSubmitting] = useState(false);

      const submit = async () => {
        if (!category) { Alert.alert('Pick a category', 'Choose what kind of problem you hit.'); return; }
        if (message.trim().length < 1) { Alert.alert('Add a message', 'Tell us what happened.'); return; }
        setSubmitting(true);
        try {
          await submitFeedback({ category, message: message.trim() });
          Alert.alert('Sent', 'Thanks — we got your report.');
          onClose();
        } catch (e) {
          Alert.alert('Failed', e instanceof Error ? e.message : 'Try again later.');
        } finally {
          setSubmitting(false);
        }
      };

      return (
        <Modal transparent visible animationType="slide" onRequestClose={onClose}>
          <View style={styles.scrim}>
            <View style={styles.sheet} accessibilityLabel="report-problem-sheet">
              <Text variant="bodyLg" style={styles.title}>Report a problem</Text>
              <ScrollView contentContainerStyle={styles.body}>
                <Text variant="formLabel" style={styles.label}>Category</Text>
                <View style={styles.categoryWrap}>
                  {FEEDBACK_CATEGORIES.map((c) => {
                    const selected = category === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setCategory(c)}
                        accessibilityLabel={`category-${c}`}
                        style={[styles.chip, selected && styles.chipSelected]}
                      >
                        <Text variant="caption" style={selected ? styles.chipTextSelected : styles.chipText}>{c}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text variant="formLabel" style={[styles.label, styles.labelGap]}>What happened?</Text>
                <TextInput
                  multiline
                  numberOfLines={6}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Tell us what you were doing and what went wrong."
                  style={styles.textarea}
                  accessibilityLabel="report-problem-message"
                  placeholderTextColor={colors.text3}
                />
              </ScrollView>

              <View style={styles.footer}>
                <View style={styles.footerBtn}>
                  <Button
                    variant="outline"
                    accessibilityLabel="report-problem-cancel"
                    label="Cancel"
                    onPress={onClose}
                  />
                </View>
                <View style={styles.footerBtn}>
                  <Button
                    variant="primary"
                    accessibilityLabel="report-problem-submit"
                    label={submitting ? 'Sending…' : 'Send report'}
                    onPress={submit}
                    disabled={submitting}
                  />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      );
    }

    const styles = StyleSheet.create({
      scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
      sheet: { backgroundColor: colors.surface, padding: spacing.xl, paddingBottom: spacing.h, borderTopLeftRadius: radii.modal, borderTopRightRadius: radii.modal, maxHeight: '80%' },
      title: { marginBottom: spacing.md, color: colors.text },
      body: { paddingBottom: spacing.md },
      label: { color: colors.text2, marginBottom: spacing.m },
      labelGap: { marginTop: spacing.mdl },
      categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m },
      chip: { paddingVertical: spacing.s, paddingHorizontal: spacing.ms, borderRadius: radii.pill, backgroundColor: colors.line },
      chipSelected: { paddingVertical: spacing.s, paddingHorizontal: spacing.ms, borderRadius: radii.pill, backgroundColor: colors.text },
      chipText: { color: colors.text },
      chipTextSelected: { color: colors.surface },
      textarea: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.input, padding: spacing.md, minHeight: 96, textAlignVertical: 'top', color: colors.text },
      footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.md, gap: spacing.ms },
      footerBtn: { minWidth: 120 },
    });
    ```

    Update `apps/mobile/src/navigation/RootNativeStack.tsx` to register `HelpCenter` as a stack-level screen pointing at HelpCenterScreen.

    Author both test files. HelpCenterScreen test verifies all 3 accordions render in order, Contact Support button calls Linking.openURL with mailto:, Report a problem button opens the sheet. ReportProblemSheet test verifies category chips render for all 8 FEEDBACK_CATEGORIES, submit fires submitFeedback on tap, Cancel calls onClose.

    Run `cd apps/mobile && npm run test -- "HelpCenterScreen|ReportProblemSheet" --run` — must pass.

  </action>
  <acceptance_criteria>
    - `grep -q "Contact Support" apps/mobile/src/screens/help/HelpCenterScreen.tsx` succeeds.
    - `grep -q "import content from './content.json'" apps/mobile/src/screens/help/HelpCenterScreen.tsx` succeeds.
    - `grep -q "mailto:" apps/mobile/src/screens/help/HelpCenterScreen.tsx` succeeds.
    - `grep -q "EMAIL_ADDRESS" apps/mobile/src/screens/help/HelpCenterScreen.tsx` succeeds (placeholder; tracked in 02-21).
    - `grep -q "submitFeedback" apps/mobile/src/components/ReportProblemSheet.tsx` succeeds.
    - `grep -q "FEEDBACK_CATEGORIES" apps/mobile/src/components/ReportProblemSheet.tsx` succeeds.
    - `grep -q 'name="HelpCenter"' apps/mobile/src/navigation/RootNativeStack.tsx` succeeds.
    - `cd apps/mobile && npm run test -- "HelpCenterScreen|ReportProblemSheet" --run` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run test -- "HelpCenterScreen|ReportProblemSheet" --run && (grep -nE "'#[0-9A-Fa-f]{3,6}'" apps/mobile/src/screens/help/HelpCenterScreen.tsx apps/mobile/src/components/ReportProblemSheet.tsx; test $? -eq 1)</automated>
  </verify>
  <done>HelpCenterScreen renders 3 accordions verbatim from content.json; mailto button opens system mail composer; Report-a-problem sheet posts feedback with diagnostic snapshot. NO hex literals in HelpCenterScreen or ReportProblemSheet.</done>
</task>

</tasks>

<verification>
- `cd apps/mobile && npm run test -- "(build-help-content|AccordionItem|feedbackService|HelpCenterScreen|ReportProblemSheet)" --run` — all pass.
- `node -e "JSON.parse(require('fs').readFileSync('apps/mobile/src/screens/help/content.json'))"` exits 0 (valid JSON).
- `grep -q "EMAIL_ADDRESS" apps/mobile/src/screens/help/content.json` returns truthy (the OPEN QUESTION placeholder is preserved end-to-end).
</verification>

<success_criteria>

- HELP-01..05 closed in code + tests.
- Help content baked deterministically; PR review covers content.json diff.
- Diagnostic snapshot includes telemetry ring (D-HELP-02).
- [EMAIL_ADDRESS] placeholder is consistent across CompatRecoveryScreen / HelpCenterScreen / content.json — tracked as Open Question for replacement at phase gate.
  </success_criteria>

<output>
After completion, create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-18-SUMMARY.md` per templates/summary.md.
</output>
