'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ForwardedRef,
} from 'react';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderText,
  rectangularSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  snippet,
  snippetCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { cpp } from '@codemirror/lang-cpp';
import { css } from '@codemirror/lang-css';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { suggestionsFor, type CodeSuggestion } from '@/lib/code-editor-languages';
import styles from './code-editor.module.css';

export interface CodeEditorHandle {
  /** Insert a suggestion at the caret and return focus to the editor. */
  applySuggestion(suggestion: CodeSuggestion): void;
  focus(): void;
}

interface CodeEditorProps {
  language: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
}

const languageCompartment = new Compartment();

function languageExtension(id: string): Extension {
  switch (id) {
    case 'python': return python();
    case 'javascript':
    case 'jsx':
    case 'typescript':
    case 'tsx': return javascript({ jsx: true });
    case 'java': return java();
    case 'cpp': return cpp();
    case 'go': return go();
    case 'rust': return rust();
    case 'sql': return sql();
    case 'html': return html();
    case 'css': return css();
    case 'json': return json();
    case 'markdown': return markdown();
    default: return [];
  }
}

const vaceUpHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.operatorKeyword], color: 'var(--code-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--code-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [tags.definition(tags.variableName), tags.variableName], color: 'var(--code-text)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--code-function)' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--code-type)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--code-keyword)' },
  { tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket], color: 'var(--code-punctuation)' },
  { tag: [tags.tagName], color: 'var(--code-keyword)' },
  { tag: [tags.heading], color: 'var(--code-function)', fontWeight: '700' },
  { tag: [tags.link, tags.url], color: 'var(--code-string)', textDecoration: 'underline' },
  { tag: [tags.invalid], color: 'var(--workspace-error)' },
]);

const vaceUpTheme = EditorView.theme({
  '&': {
    color: 'var(--code-text)',
    backgroundColor: 'var(--code-surface)',
    fontSize: '0.875rem',
    minHeight: '22rem',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    caretColor: 'var(--code-focus)',
    padding: '0.75rem 0.5rem',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--code-active)',
    color: 'var(--code-muted)',
    border: 'none',
    borderRight: '1px solid var(--code-line)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--code-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--code-active)', color: 'var(--code-focus)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--code-focus)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--code-selection)',
    color: 'var(--code-selection-text)',
  },
  '.cm-tooltip': {
    border: '1px solid var(--code-line)',
    backgroundColor: 'var(--code-menu)',
    color: 'var(--code-text)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-glass)',
  },
  '.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    maxHeight: '15rem',
    padding: '0.25rem',
  },
  '.cm-tooltip-autocomplete > ul > li': { padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-sm)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--code-selection)',
    color: 'var(--code-selection-text)',
  },
  '.cm-completionDetail': { fontStyle: 'italic', marginLeft: '0.75rem', opacity: '0.75' },
  '.cm-placeholder': { color: 'var(--code-muted)' },
}, { dark: false });

function toCompletion(suggestion: CodeSuggestion): Completion {
  const type: Completion['type'] =
    suggestion.kind === 'keyword' ? 'keyword'
      : suggestion.kind === 'class' ? 'class'
        : suggestion.kind === 'function' ? 'function'
          : suggestion.kind === 'snippet' ? 'snippet'
            : 'variable';
  if (suggestion.template) {
    return snippetCompletion(suggestion.template, {
      label: suggestion.label,
      detail: suggestion.detail,
      type: 'snippet',
    });
  }
  return { label: suggestion.label, detail: suggestion.detail, type };
}

/**
 * Completion source for the active language. Snippets win over a keyword of
 * the same name so "def" always expands the template rather than inserting a
 * bare keyword.
 */
function createCompletionSource(languageId: string) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w$]+/);
    if (!word && !context.explicit) return null;
    const from = word ? word.from : context.pos;
    const suggestions = suggestionsFor(languageId);
    const snippetLabels = new Set(suggestions.filter((item) => item.template).map((item) => item.label));
    const prefix = word ? word.text.toLowerCase() : '';
    const options = suggestions
      .filter((item) => !(snippetLabels.has(item.label) && item.kind === 'keyword'))
      .filter((item) => !prefix || item.label.toLowerCase().startsWith(prefix))
      .map(toCompletion);
    if (!options.length) return null;
    return { from, options: options.slice(0, 60), validFor: /^[\w$]*$/ };
  };
}

const CodeEditor = forwardRef(function CodeEditor(
  { language, value, onChange, label }: CodeEditorProps,
  ref: ForwardedRef<CodeEditorHandle>,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageRef = useRef(language);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  languageRef.current = language;
  valueRef.current = value;
  onChangeRef.current = onChange;

  useImperativeHandle(ref, () => ({
    applySuggestion(suggestion) {
      const view = viewRef.current;
      if (!view) return;
      if (suggestion.template) {
        const { from, to } = view.state.selection.main;
        snippet(suggestion.template)(view, null, from, to);
      } else if (suggestion.apply) {
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: suggestion.apply },
          selection: { anchor: from + suggestion.apply.length },
        });
      }
      view.focus();
    },
    focus() {
      viewRef.current?.focus();
    },
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      doc: valueRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        rectangularSelection(),
        crosshairCursor(),
        history(),
        EditorView.lineWrapping,
        indentUnit.of('    '),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        autocompletion({
          override: [createCompletionSource(languageRef.current)],
          activateOnTyping: true,
          maxRenderedOptions: 30,
        }),
        syntaxHighlighting(vaceUpHighlight),
        languageCompartment.of(languageExtension(languageRef.current)),
        placeholderText('Start typing to get suggestions for this language.'),
        EditorView.contentAttributes.of({
          'aria-label': label,
          'aria-multiline': 'true',
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
        vaceUpTheme,
      ],
      parent: host,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [label]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: languageCompartment.reconfigure(languageExtension(language)),
    });
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div className={styles.editor} ref={hostRef} data-testid="code-editor" />;
});

export default CodeEditor;
export { styles as codeEditorStyles };
