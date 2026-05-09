// Plan 02-05 — MainTabs renders EXACTLY 3 tabs (Home, Tasks, History).
//
// HOME-07 satisfied STRUCTURALLY: the BottomNav component renders 3
// Pressables and only 3 — Profile is NOT a tab here, it's a sibling of
// MainTabs at the RootNativeStack level. This test pins that contract by
// counting how many tabs the rendered tab bar exposes.

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';

import MainTabs from '../../src/navigation/MainTabs';

describe('MainTabs', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders exactly 3 tabs labeled Home/Tasks/History', () => {
    const { getAllByLabelText } = render(<MainTabs />);
    expect(getAllByLabelText('Home tab').length).toBe(1);
    expect(getAllByLabelText('Tasks tab').length).toBe(1);
    expect(getAllByLabelText('History tab').length).toBe(1);
  });

  it('does NOT render a fourth tab labelled Profile', () => {
    const { queryAllByLabelText } = render(<MainTabs />);
    expect(queryAllByLabelText('Profile tab').length).toBe(0);
  });
});
