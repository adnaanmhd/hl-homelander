---
phase: 02-mobile-shell-onboarding-permissions-compat-profile
plan: 11
id: 02-11-rig-tutorial-screen
name: RigTutorialScreen + "Don't have a rig yet" off-ramp
type: execute
wave: 2
depends_on: [02-05-navigation-skeleton]
files_modified:
  - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
  - apps/mobile/__tests__/screens/RigTutorialScreen.test.tsx
autonomous: true
requirements: [ONB-01, ONB-02]
must_haves:
  truths:
    - "RigTutorialScreen renders verbatim §5 copy: heading 'You'll need a head rig' + body 'Mount your phone on the head rig and make sure it is steady while recording.'"
    - "Sticky 'Next' button → navigates to MainTabs (Phase 4 inserts Practice between RigTutorial and MainTabs; Phase 2 stops here)"
    - "ONB-02 'Don't have a rig yet' off-ramp link opens a recovery sheet with contact info — does NOT soft-lock the user (no exit out of onboarding without explicit user choice)"
    - 'Off-ramp link mailto target uses the [EMAIL_ADDRESS] placeholder (Open Question 1; tracked in 02-21 manual smoke)'
  artifacts:
    - path: 'apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx'
      provides: 'Rig tutorial with off-ramp + Next CTA'
      contains: "You'll need a head rig"
  key_links:
    - from: 'apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx'
      to: 'apps/mobile/src/state/appStore.ts'
      via: 'store.setTutorialDone(googleSub)'
      pattern: 'setTutorialDone'
---

<objective>
Implement the verbatim §5 Rig tutorial screen and the ONB-02 "Don't have a rig yet" off-ramp.

Purpose: ONB-01 + ONB-02. Phase 2 ships only the Rig screen; Phase 4 inserts the practice-recording flow between RigTutorial and MainTabs. This plan stops at "Next → MainTabs" so onboarding is complete from Phase 2's POV.
Output: a screen with verbatim copy, Next CTA, off-ramp link, and tutorialDone flag persisted on Next tap.
</objective>

<execution_context>
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/workflows/execute-plan.md
@/Users/adnaan/Documents/hl-homelander/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-RESEARCH.md
@.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-PATTERNS.md
@apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx
@apps/mobile/src/state/appStore.ts
@design-spec.md

<interfaces>
<!-- design-spec.md §5 Rig tutorial copy -->
- Heading (30/36, 700): "You'll need a head rig"
- Body (17/25): "Mount your phone on the head rig and make sure it is steady while recording."
- Button (btn-primary): "Next"

<!-- ONB-02 off-ramp (research-derived; CONTEXT.md confirms it must NOT soft-lock) -->

- Secondary link: "Don't have a rig yet?"
- Tap → Sheet with recovery info + mailto:[EMAIL_ADDRESS]
- "Got it" closes sheet; user can still proceed via "Next" without a rig
  </interfaces>
  </context>

<threat_model>

## Trust Boundaries

| Boundary                            | Description                  |
| ----------------------------------- | ---------------------------- |
| User → mailto: → external email app | OS-mediated; Linking.openURL |

## STRIDE Threat Register

| Threat ID | Category               | Component                                                            | Disposition | Mitigation Plan                                                                                                                                                                                                        |
| --------- | ---------------------- | -------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.11-01 | Information Disclosure | The mailto target email is published in plain text in the bundled JS | accept      | This is the support email; intentionally public. Phase 2 ships with `[EMAIL_ADDRESS]` placeholder per Open Question 1; the canonical address replaces it before Play Store submission (tracked in 02-21 manual smoke). |

</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RigTutorialScreen with off-ramp sheet</name>
  <files>apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx, apps/mobile/__tests__/screens/RigTutorialScreen.test.tsx (NEW)</files>
  <read_first>
    - design-spec.md §5 lines 256-264 (verbatim Rig tutorial copy)
    - apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx (current 02-05 stub)
    - apps/mobile/src/state/appStore.ts (setTutorialDone action)
    - apps/mobile/src/services/auth.ts (extract googleSub from current JWT)
    - apps/mobile/src/ui/primitives/Sheet.tsx (Task 02-02)
    - .planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-CONTEXT.md § domain ("Phase 2 lands the Rig screen and stops there")
  </read_first>
  <behavior>
    Test 1: Renders heading "You'll need a head rig" + body "Mount your phone on the head rig and make sure it is steady while recording.".
    Test 2: Renders "Next" CTA + "Don't have a rig yet?" secondary link.
    Test 3: Tap "Next" → store.setTutorialDone(googleSub) called → navigation.getParent().replace('MainTabs') called.
    Test 4: Tap "Don't have a rig yet?" → off-ramp sheet opens; sheet body mentions the mailto target.
    Test 5: After viewing the off-ramp sheet, user can still tap "Next" — sheet does NOT block onboarding completion.
    Test 6: rig_tutorial_shown analytics event fires on mount; rig_no_rig_link_tapped fires on off-ramp link tap.
  </behavior>
  <action>
    Replace `apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx`:
    ```tsx
    import React, { useEffect, useState } from 'react';
    import { View, StyleSheet, Linking } from 'react-native';
    import { useNavigation } from '@react-navigation/native';
    import { ScreenContainer } from '../../ui/primitives/ScreenContainer';
    import { Text } from '../../ui/primitives/Text';
    import { Button } from '../../ui/primitives/Button';
    import { Pressable } from '../../ui/primitives/Pressable';
    import { Sheet } from '../../ui/primitives/Sheet';
    import { colors, spacing } from '../../ui/tokens';
    import { useAppStore } from '../../state/appStore';
    import { logEvent } from '../../util/analytics';

    const SUPPORT_EMAIL = '[EMAIL_ADDRESS]'; // Open Question 1 — tracked in 02-21 manual smoke

    function decodeGoogleSubFromJwt(jwt: string | null): string {
      if (!jwt) return '';
      const parts = jwt.split('.');
      if (parts.length !== 3) return '';
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload?.sub === 'string' ? payload.sub : '';
      } catch (_e) {
        return '';
      }
    }

    export default function RigTutorialScreen() {
      const navigation = useNavigation<any>();
      const setTutorialDone = useAppStore((s) => s.setTutorialDone);
      const jwt = useAppStore((s) => s.jwt);
      const [offRampOpen, setOffRampOpen] = useState(false);

      useEffect(() => {
        logEvent('rig_tutorial_shown');
      }, []);

      const handleNext = () => {
        const googleSub = decodeGoogleSubFromJwt(jwt);
        setTutorialDone(googleSub);
        // Phase 2 stops onboarding here. Phase 4 will splice Practice between this and MainTabs.
        const parent = navigation.getParent();
        if (parent) parent.replace('MainTabs');
        else navigation.replace('MainTabs');
      };

      const handleNoRig = () => {
        setOffRampOpen(true);
        logEvent('rig_no_rig_link_tapped');
      };

      return (
        <ScreenContainer style={{ paddingTop: 24, paddingHorizontal: 28, paddingBottom: 28 }}>
          <View style={styles.center}>
            {/* Illustration placeholder — design-spec calls for 280 px high illustration; Phase 2 uses
                a simple Pressable spacer + an emoji-free placeholder Text since assets aren't sourced.
                Refinement is planner-level + design-system follow-up. */}
            <View style={styles.illustrationStub} accessibilityLabel="rig illustration placeholder" />
            <View style={{ height: spacing.xl }} />
            <Text variant="tutorialHeading" tone="primary" style={{ textAlign: 'center' }} accessibilityLabel="rig tutorial heading">
              You'll need a head rig
            </Text>
            <View style={{ height: spacing.m }} />
            <Text variant="tutBody" tone="secondary" style={{ textAlign: 'center' }} accessibilityLabel="rig tutorial body">
              Mount your phone on the head rig and make sure it is steady while recording.
            </Text>
            <View style={{ height: spacing.l }} />
            <Pressable onPress={handleNoRig} accessibilityRole="link" accessibilityLabel="Don't have a rig yet">
              <Text variant="caption" style={{ color: colors.accent, textDecorationLine: 'underline' }}>
                Don't have a rig yet?
              </Text>
            </Pressable>
          </View>
          <Button variant="primary" onPress={handleNext} accessibilityLabel="Next">
            Next
          </Button>
          <Sheet visible={offRampOpen} onClose={() => setOffRampOpen(false)} accessibilityLabel="No rig off-ramp sheet">
            <Text variant="sheetTitle" tone="primary" accessibilityLabel="off-ramp title">
              No rig yet?
            </Text>
            <View style={{ height: spacing.m }} />
            <Text variant="body" tone="primary" accessibilityLabel="off-ramp body">
              You'll need a head rig to record. We're working on getting rigs to contributors. Email us at{' '}
              {SUPPORT_EMAIL} and we'll let you know when one ships your way. You can keep exploring the app in the meantime.
            </Text>
            <View style={{ height: spacing.l }} />
            <Button
              variant="primary"
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=No%20rig%20yet`)}
              accessibilityLabel="Email support about rig"
            >
              Email support
            </Button>
            <View style={{ height: spacing.m }} />
            <Button variant="outline" onPress={() => setOffRampOpen(false)} accessibilityLabel="Got it close off-ramp">
              Got it
            </Button>
          </Sheet>
        </ScreenContainer>
      );
    }

    const styles = StyleSheet.create({
      center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
      illustrationStub: {
        width: 240, height: 280, backgroundColor: colors.accentSoft, borderRadius: 24,
      },
    });
    ```

    Author `__tests__/screens/RigTutorialScreen.test.tsx` covering the 6 behaviors. Mock the navigation hook (`useNavigation` returns `{replace, getParent: () => ({ replace })}`); mock `useAppStore` selectors; mock `Linking.openURL` via `vi.spyOn(Linking, 'openURL')`.

  </action>
  <acceptance_criteria>
    - `grep -q "You'll need a head rig" apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` succeeds.
    - `grep -q "Mount your phone on the head rig and make sure it is steady while recording." apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` succeeds.
    - `grep -q "Don't have a rig yet?" apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` succeeds.
    - `grep -q "MainTabs" apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` succeeds.
    - `grep -q "\\[EMAIL_ADDRESS\\]" apps/mobile/src/screens/tutorial/RigTutorialScreen.tsx` succeeds (placeholder still present; Open Question 1 tracker).
    - `cd apps/mobile && npm run test -- __tests__/screens/RigTutorialScreen.test.tsx` passes (6 tests).
    - `cd apps/mobile && npm run typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>cd apps/mobile && npm run typecheck && npm run test -- __tests__/screens/RigTutorialScreen.test.tsx</automated>
  </verify>
  <done>RigTutorialScreen ships verbatim copy + off-ramp sheet; tutorialDone is persisted on Next; 6 unit tests pass.</done>
</task>

</tasks>

<verification>
- Verbatim §5 copy in screen.
- "Don't have a rig yet" off-ramp opens a sheet with mailto link; does NOT block "Next".
- tutorialDone flag persisted on Next tap with the user's googleSub.
- 6 unit tests.
</verification>

<success_criteria>

- ONB-01 + ONB-02 implemented.
- Phase 4 plan owners can splice Practice between this screen's "Next" and MainTabs without restructuring.
- [EMAIL_ADDRESS] placeholder is in the code; 02-21 manual smoke tracks the swap.
  </success_criteria>

<output>
Create `.planning/phases/02-mobile-shell-onboarding-permissions-compat-profile/02-11-SUMMARY.md` listing the verbatim copy delta vs design-spec §5, the off-ramp design, and the [EMAIL_ADDRESS] placeholder location.
</output>
