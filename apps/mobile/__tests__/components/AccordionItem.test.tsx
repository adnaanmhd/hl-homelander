// AccordionItem — verifies the design-spec §17 disclosure contract: starts
// collapsed by default, opens on header tap, closes on a second tap, and
// honours `defaultOpen`. Body element is queryable by `accordion-body-{title}`
// so closed/open state asserts via screen.queryByLabelText (no React-state
// peeking).
//
// Pattern: relies on the canonical react-native + lucide-react-native mocks
// from vitest.setup.ts. Pressable's `onPress` is mapped to `onClick` so
// fireEvent.click drives the toggle.

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { AccordionItem } from '../../src/components/AccordionItem';

describe('AccordionItem', () => {
  afterEach(() => {
    cleanup();
  });

  it('starts collapsed by default; body not rendered', () => {
    render(
      <AccordionItem title="Test">
        <span>body</span>
      </AccordionItem>,
    );
    expect(screen.queryByLabelText('accordion-body-Test')).toBeNull();
  });

  it('starts expanded when defaultOpen is true', () => {
    render(
      <AccordionItem title="Test" defaultOpen>
        <span>body</span>
      </AccordionItem>,
    );
    expect(screen.getByLabelText('accordion-body-Test')).toBeTruthy();
  });

  it('tapping the header toggles open/closed', () => {
    render(
      <AccordionItem title="Test">
        <span>body</span>
      </AccordionItem>,
    );
    const toggle = screen.getByLabelText('accordion-toggle-Test');
    fireEvent.click(toggle);
    expect(screen.getByLabelText('accordion-body-Test')).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByLabelText('accordion-body-Test')).toBeNull();
  });
});
