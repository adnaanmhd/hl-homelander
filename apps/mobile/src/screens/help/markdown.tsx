/**
 * Tiny markdown renderer for Help Center body strings — quick task 260510-004.
 *
 * The Help Center content is hand-curated in `help-center-content.md` and
 * baked into `content.json` at build time (`build-help-content.mjs`). The
 * baked strings still contain markdown (verbatim from the source MD), which
 * the previous renderer dropped straight into <Text>{string}</Text>, leaving
 * raw `**`, `_`, `` ` ``, `-`, `1.` glyphs visible to the user.
 *
 * This renderer parses the *exact subset* the help content uses — no
 * dependency, no full CommonMark — and emits styled <Text> ranges through
 * the existing Text primitive.
 *
 * Subset:
 *   Block:
 *     - Paragraphs (consecutive non-list lines, joined with newlines)
 *     - Unordered lists (consecutive `^- ` lines)
 *     - Ordered lists (consecutive `^\d+\. ` lines)
 *   Inline (priority order, non-overlapping):
 *     - **bold**     -> fontWeight: '700'
 *     - _italic_     -> fontStyle: 'italic'
 *     - `code`       -> monospace family + line-color background pad
 *
 * Anything outside this subset (links, images, tables, headings, ~~strike~~,
 * ```code blocks```, blockquotes) is rendered as plain text. If the
 * help content needs richer formatting, extend the parser here — DO NOT
 * pull in a third-party markdown library without reopening STACK.md.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../ui/primitives/Text';
import { colors, spacing, typography } from '../../ui/tokens';

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'unordered'; items: string[] }
  | { kind: 'ordered'; items: string[] };

type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string };

const UL_RE = /^- (.*)$/;
const OL_RE = /^\d+\. (.*)$/;

export function parseBlocks(source: string): Block[] {
  const lines = source.split('\n');
  const blocks: Block[] = [];
  let paragraphBuf: string[] = [];
  let unorderedBuf: string[] = [];
  let orderedBuf: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuf.length === 0) return;
    blocks.push({ kind: 'paragraph', text: paragraphBuf.join('\n') });
    paragraphBuf = [];
  };
  const flushUnordered = () => {
    if (unorderedBuf.length === 0) return;
    blocks.push({ kind: 'unordered', items: unorderedBuf });
    unorderedBuf = [];
  };
  const flushOrdered = () => {
    if (orderedBuf.length === 0) return;
    blocks.push({ kind: 'ordered', items: orderedBuf });
    orderedBuf = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushUnordered();
    flushOrdered();
  };

  for (const line of lines) {
    const ulMatch = UL_RE.exec(line);
    const olMatch = OL_RE.exec(line);
    if (ulMatch) {
      flushParagraph();
      flushOrdered();
      unorderedBuf.push(ulMatch[1]!);
      continue;
    }
    if (olMatch) {
      flushParagraph();
      flushUnordered();
      orderedBuf.push(olMatch[1]!);
      continue;
    }
    // Blank line ends the current paragraph but does NOT introduce one of its
    // own. Lists already buffered earlier are flushed here too.
    if (line.trim() === '') {
      flushAll();
      continue;
    }
    flushUnordered();
    flushOrdered();
    paragraphBuf.push(line);
  }
  flushAll();
  return blocks;
}

/**
 * Inline tokenizer. Walks left-to-right and matches the earliest of the
 * three delimiter pairs at each position. Non-greedy so adjacent runs are
 * separable. Unmatched delimiters fall through as literal text — defensive
 * against malformed source so a single stray `**` never blanks the rest of
 * the line.
 */
export function parseInline(line: string): Segment[] {
  const segs: Segment[] = [];
  let i = 0;
  let buf = '';
  const flushText = () => {
    if (buf.length === 0) return;
    segs.push({ kind: 'text', text: buf });
    buf = '';
  };
  while (i < line.length) {
    const rest = line.slice(i);
    // **bold** — must be checked before single underscore + backtick.
    const boldMatch = /^\*\*(.+?)\*\*/.exec(rest);
    if (boldMatch) {
      flushText();
      segs.push({ kind: 'bold', text: boldMatch[1]! });
      i += boldMatch[0].length;
      continue;
    }
    // _italic_ — non-greedy, balanced by a closing underscore.
    const italicMatch = /^_(.+?)_/.exec(rest);
    if (italicMatch) {
      flushText();
      segs.push({ kind: 'italic', text: italicMatch[1]! });
      i += italicMatch[0].length;
      continue;
    }
    // `code` — non-greedy, single-line.
    const codeMatch = /^`([^`]+)`/.exec(rest);
    if (codeMatch) {
      flushText();
      segs.push({ kind: 'code', text: codeMatch[1]! });
      i += codeMatch[0].length;
      continue;
    }
    buf += rest[0];
    i += 1;
  }
  flushText();
  return segs;
}

function renderSegments(segments: Segment[]): React.ReactNode {
  return segments.map((seg, idx) => {
    if (seg.kind === 'bold') {
      return (
        <Text key={idx} variant="body" tone="secondary" style={styles.bold}>
          {seg.text}
        </Text>
      );
    }
    if (seg.kind === 'italic') {
      return (
        <Text key={idx} variant="body" tone="secondary" style={styles.italic}>
          {seg.text}
        </Text>
      );
    }
    if (seg.kind === 'code') {
      return (
        <Text key={idx} variant="body" tone="secondary" style={styles.code}>
          {seg.text}
        </Text>
      );
    }
    return (
      <Text key={idx} variant="body" tone="secondary">
        {seg.text}
      </Text>
    );
  });
}

export interface MarkdownProps {
  source: string;
}

export function Markdown({ source }: MarkdownProps): React.JSX.Element {
  const blocks = parseBlocks(source);
  return (
    <View accessibilityLabel="markdown-block">
      {blocks.map((block, bIdx) => {
        if (block.kind === 'paragraph') {
          return (
            <Text key={bIdx} variant="body" tone="secondary" style={styles.paragraph}>
              {renderSegments(parseInline(block.text))}
            </Text>
          );
        }
        if (block.kind === 'unordered') {
          return (
            <View key={bIdx} style={styles.list}>
              {block.items.map((item, iIdx) => (
                <View key={iIdx} style={styles.row}>
                  <Text variant="body" tone="secondary" style={styles.bullet}>
                    {'•'}
                  </Text>
                  <Text variant="body" tone="secondary" style={styles.itemText}>
                    {renderSegments(parseInline(item))}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        // ordered
        return (
          <View key={bIdx} style={styles.list}>
            {block.items.map((item, iIdx) => (
              <View key={iIdx} style={styles.row}>
                <Text variant="body" tone="secondary" style={styles.ordinal}>
                  {`${iIdx + 1}.`}
                </Text>
                <Text variant="body" tone="secondary" style={styles.itemText}>
                  {renderSegments(parseInline(item))}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export default Markdown;

const styles = StyleSheet.create({
  paragraph: { marginBottom: spacing.s },
  list: { marginBottom: spacing.s },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  bullet: { width: 16, lineHeight: 22 },
  ordinal: { width: 22, lineHeight: 22 },
  itemText: { flex: 1 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: {
    fontFamily: typography.fontFamily.mono,
    backgroundColor: colors.line,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
