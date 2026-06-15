// 07-11 G-09 closure — UploadStatusChip variant labels resolved via
// `t('uploadChip.*')` and the source file no longer carries hardcoded
// English literals. Two checks:
//
//   Test 1: render the chip for each variant; the rendered text matches
//           en.json's `uploadChip.{variant}` value. The `progress` variant
//           with a percentage suffix preserves the appended " 47%" interpolation.
//   Test 2: source-grep — UploadStatusChip.tsx maps each variant to a
//           `uploadChip.*` key string (LABEL_KEYS) and consumes
//           `useTranslation()`.

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import enCatalog from '../../src/i18n/locales/en.json';
import { UploadStatusChip } from '../../src/components/UploadStatusChip';

describe('UploadStatusChip — 07-11 G-09', () => {
  afterEach(() => {
    cleanup();
  });

  // (Enh 3 / D1, 2026-06-04: the 'verifying' variant was removed.)

  it('failed variant renders en.json `uploadChip.failed`', () => {
    render(<UploadStatusChip variant="failed" />);
    expect(screen.getByText(enCatalog.uploadChip.failed)).toBeTruthy();
  });

  it('success variant renders en.json `uploadChip.success`', () => {
    render(<UploadStatusChip variant="success" />);
    expect(screen.getByText(enCatalog.uploadChip.success)).toBeTruthy();
  });

  it('paused-offline variant renders en.json `uploadChip.pausedOffline`', () => {
    render(<UploadStatusChip variant="paused-offline" />);
    expect(screen.getByText(enCatalog.uploadChip.pausedOffline)).toBeTruthy();
  });

  it('progress variant with no percent renders bare `Uploading…`', () => {
    render(<UploadStatusChip variant="progress" />);
    expect(screen.getByText(enCatalog.uploadChip.uploading)).toBeTruthy();
  });

  it('progress variant with percent=47 renders `Uploading… 47%`', () => {
    render(<UploadStatusChip variant="progress" percent={47} />);
    expect(screen.getByText(`${enCatalog.uploadChip.uploading} 47%`)).toBeTruthy();
  });

  it('source file consumes useTranslation and maps variants to `uploadChip.*` keys', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../../src/components/UploadStatusChip.tsx'),
      'utf8',
    );
    expect(source).toContain('useTranslation');
    expect(source).toContain("progress: 'uploadChip.uploading'");
    expect(source).toContain("failed: 'uploadChip.failed'");
    expect(source).toContain("success: 'uploadChip.success'");
    expect(source).toContain("'paused-offline': 'uploadChip.pausedOffline'");
    // No hardcoded English literals in the LABEL_KEYS map.
    expect(source).not.toMatch(/progress: 'Uploading…'/);
    expect(source).not.toMatch(/failed: 'Upload failed'/);
  });
});
