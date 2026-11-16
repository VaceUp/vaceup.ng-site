/** Turns the administrator's plain-text round rules into a structured, paged
 * rulebook. Administrators write headings as "1. Eligibility" or "# Eligibility"
 * and list points as dashes or numbers; everything else is a paragraph. */
export interface RuleItem {
  kind: 'bullet' | 'number' | 'text';
  text: string;
  marker?: string;
  nested?: boolean;
}
export interface RuleSection {
  number?: string;
  title: string;
  items: RuleItem[];
}
export interface ParsedRules {
  documentTitle: string;
  sections: RuleSection[];
}

const TERMINAL = /[.!?:;]\s*$/;

function parseHeading(line: string): { number?: string; title: string } | null {
  const body = line.trim();
  if (!body) return null;
  let number: string | undefined;
  let text = body;
  const markdown = text.match(/^#{1,4}\s+(.*)$/);
  if (markdown) text = markdown[1].trim();
  const numbered = text.match(/^(\d{1,2})\s*[.)]\s+(.*)$/);
  if (numbered) {
    number = numbered[1];
    text = numbered[2].trim();
    // "1. Eligibility" is a heading; "1. Complete the assigned task." is a list point.
    if (TERMINAL.test(text) || text.length > 72) return null;
  } else if (!markdown) {
    // An unnumbered line is a heading only when it reads like a title.
    if (TERMINAL.test(text) || text.length > 64) return null;
  }
  if (!text) return null;
  return { number, title: text };
}

function parseItem(line: string): RuleItem | null {
  const indent = line.length - line.trimStart().length;
  const body = line.trim();
  if (!body) return null;
  let text = body;
  let kind: RuleItem['kind'] = 'text';
  let marker: string | undefined;
  const dash = text.match(/^[-•*]\s+(.*)$/);
  if (dash) {
    kind = 'bullet';
    text = dash[1].trim();
  } else {
    const numbered = text.match(/^(\d{1,2})\s*[.)]\s+(.*)$/);
    if (numbered) {
      kind = 'number';
      marker = numbered[1];
      text = numbered[2].trim();
    }
  }
  return { kind, marker, text, nested: indent >= 2 };
}

export function parseRules(source: string): ParsedRules {
  const lines = (source || '').replace(/\r/g, '').split('\n');
  let documentTitle = '';
  const intro: string[] = [];
  const sections: RuleSection[] = [];
  let current: RuleSection | null = null;

  for (const raw of lines) {
    // parseHeading already rejects numbered list points ("1. Complete the
    // assigned task."), so a non-null result is always a real section heading.
    const heading = parseHeading(raw);
    if (heading) {
      if (!current && !documentTitle && !heading.number) {
        // The first title-like line before any section is the document title.
        documentTitle = heading.title;
        continue;
      }
      if (current) sections.push(current);
      current = { number: heading.number, title: heading.title, items: [] };
    } else if (parseItem(raw)) {
      const item = parseItem(raw) as RuleItem;
      if (current) current.items.push(item);
      else intro.push(item.text);
    } else if (raw.trim()) {
      if (current) current.items.push({ kind: 'text', text: raw.trim() });
      else intro.push(raw.trim());
    }
  }
  if (current) sections.push(current);

  if (!sections.length) {
    const paragraphs = [...intro].map((text) => ({ kind: 'text' as const, text }));
    return { documentTitle, sections: [{ title: 'Official rules', items: paragraphs }] };
  }
  return { documentTitle, sections };
}
