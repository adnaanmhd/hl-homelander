// Help Center markdown renderer — quick task 260510-004.
//
// Coverage:
//   - parseBlocks splits paragraphs / unordered lists / ordered lists correctly
//   - parseInline tokenizes **bold**, _italic_, `code` runs
//   - <Markdown> renders the parsed tree without leaking raw markdown glyphs
//   - HelpCenterScreen-style content with mixed bold + code renders cleanly

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Markdown, parseBlocks, parseInline } from '../../../src/screens/help/markdown';

afterEach(() => {
  cleanup();
});

describe('parseBlocks', () => {
  it('splits a single paragraph', () => {
    expect(parseBlocks('Hello world')).toEqual([{ kind: 'paragraph', text: 'Hello world' }]);
  });

  it('groups consecutive `- ` lines into one unordered list', () => {
    const src = '- one\n- two\n- three';
    expect(parseBlocks(src)).toEqual([{ kind: 'unordered', items: ['one', 'two', 'three'] }]);
  });

  it('groups consecutive `\\d+. ` lines into one ordered list', () => {
    const src = '1. first\n2. second\n3. third';
    expect(parseBlocks(src)).toEqual([{ kind: 'ordered', items: ['first', 'second', 'third'] }]);
  });

  it('separates paragraph from following bullet list', () => {
    const src = 'Intro line.\n- bullet one\n- bullet two';
    expect(parseBlocks(src)).toEqual([
      { kind: 'paragraph', text: 'Intro line.' },
      { kind: 'unordered', items: ['bullet one', 'bullet two'] },
    ]);
  });

  it('treats blank lines as block separators', () => {
    const src = 'para 1\n\npara 2';
    expect(parseBlocks(src)).toEqual([
      { kind: 'paragraph', text: 'para 1' },
      { kind: 'paragraph', text: 'para 2' },
    ]);
  });
});

describe('parseInline', () => {
  it('tokenizes a bold run', () => {
    expect(parseInline('Tap **Tasks** below')).toEqual([
      { kind: 'text', text: 'Tap ' },
      { kind: 'bold', text: 'Tasks' },
      { kind: 'text', text: ' below' },
    ]);
  });

  it('tokenizes an italic run', () => {
    expect(parseInline('say _hello_ now')).toEqual([
      { kind: 'text', text: 'say ' },
      { kind: 'italic', text: 'hello' },
      { kind: 'text', text: ' now' },
    ]);
  });

  it('tokenizes a code run', () => {
    expect(parseInline('email `[EMAIL_ADDRESS]` for help')).toEqual([
      { kind: 'text', text: 'email ' },
      { kind: 'code', text: '[EMAIL_ADDRESS]' },
      { kind: 'text', text: ' for help' },
    ]);
  });

  it('tokenizes mixed bold + code in one line', () => {
    expect(parseInline('Tap **Contact Support** to email `[EMAIL_ADDRESS]`.')).toEqual([
      { kind: 'text', text: 'Tap ' },
      { kind: 'bold', text: 'Contact Support' },
      { kind: 'text', text: ' to email ' },
      { kind: 'code', text: '[EMAIL_ADDRESS]' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('falls through unmatched delimiters as literal text', () => {
    // Defensive: a single stray `**` should not blank the rest of the line.
    expect(parseInline('a ** b c')).toEqual([{ kind: 'text', text: 'a ** b c' }]);
  });
});

describe('<Markdown>', () => {
  it('renders bold inside a paragraph WITHOUT raw asterisks visible', () => {
    render(<Markdown source="Tap **Tasks** below" />);
    // The actual word "Tasks" must be present.
    expect(screen.getAllByText(/Tasks/).length).toBeGreaterThan(0);
    // No raw `**Tasks**` literal anywhere on the rendered output.
    expect(screen.queryByText(/\*\*Tasks\*\*/)).toBeNull();
  });

  it('renders bullet items with a • glyph', () => {
    render(<Markdown source={'- one\n- two'} />);
    const bullets = screen.getAllByText('•');
    expect(bullets.length).toBe(2);
  });

  it('renders ordered items with 1. / 2. ordinals', () => {
    render(<Markdown source={'1. first\n2. second'} />);
    expect(screen.getByText('1.')).toBeTruthy();
    expect(screen.getByText('2.')).toBeTruthy();
  });

  it('renders code spans without backticks', () => {
    render(<Markdown source="email `[EMAIL_ADDRESS]` now" />);
    // Render text appears as a node; backticks should not be visible.
    expect(screen.getByText('[EMAIL_ADDRESS]')).toBeTruthy();
    expect(screen.queryByText(/`\[EMAIL_ADDRESS\]`/)).toBeNull();
  });
});
