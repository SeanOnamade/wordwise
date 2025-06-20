import { Mark, mergeAttributes } from '@tiptap/core';

export interface GrammarHighlightOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    grammarHighlight: {
      setGrammarHighlight: (attributes?: { type: string; suggestionId: string; }) => ReturnType;
      toggleGrammarHighlight: (attributes?: { type: string; suggestionId: string; }) => ReturnType;
      unsetGrammarHighlight: () => ReturnType;
    };
  }
}

export const GrammarHighlight = Mark.create<GrammarHighlightOptions>({
  name: 'grammarHighlight',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      type: {
        default: 'grammar',
        parseHTML: element => element.getAttribute('data-type'),
        renderHTML: attributes => ({
          'data-type': attributes.type,
        }),
      },
      suggestionId: {
        default: null,
        parseHTML: element => element.getAttribute('data-suggestion-id'),
        renderHTML: attributes => ({
          'data-suggestion-id': attributes.suggestionId,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-grammar-highlight]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    console.log('🎨 renderHTML called!');
    console.log('🎨 HTMLAttributes:', HTMLAttributes);
    console.log('🎨 mark.attrs:', mark?.attrs);
    
    // Get type and suggestionId from mark attributes (this is the correct way)
    const type = mark?.attrs?.type || HTMLAttributes['data-type'] || 'grammar';
    const suggestionId = mark?.attrs?.suggestionId || HTMLAttributes['data-suggestion-id'];
    
    // Get the exact word boundaries for more accurate highlighting
    const text = mark?.attrs?.text || '';
    const wordStart = text.search(/\S/);
    const wordEnd = text.search(/\s+$/) === -1 ? text.length : text.search(/\s+$/);
    
    const attrs = mergeAttributes(
      {
        'data-grammar-highlight': '',
        'data-type': type,
        'data-suggestion-id': suggestionId,
        'class': `grammar-highlight grammar-highlight-${type}`,
        'style': `
          background-color: rgba(254, 242, 242, 0.8) !important;
          border-bottom: 2px solid #ef4444 !important;
          padding-left: ${wordStart}px !important;
          padding-right: ${text.length - wordEnd}px !important;
        `.trim()
      },
      this.options.HTMLAttributes,
      HTMLAttributes
    );
    
    console.log('🎨 Final attrs:', attrs);
    
    return [
      'span',
      attrs,
      0,
    ];
  },

  addCommands() {
    return {
      setGrammarHighlight:
        attributes =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      toggleGrammarHighlight:
        attributes =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
      unsetGrammarHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
}); 