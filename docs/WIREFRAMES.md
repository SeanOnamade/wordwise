# WordWise: Wireframes & UI Concepts

## Main Editor Interface

```
┌─────────────────────────────────────────────────────────────┐
│ WordWise                                    [User] [Export]  │
├─────────────────────────────────────────────────────────────┤
│ 📄 Document Title Here                                      │
│ Last saved 2 minutes ago • 1,247 words                     │
├─────────────────────────────────────────────────────────────┤
│ [B] [I] [U] [H1] [H2] [H3] [•] [1.] [≡] [⟲] [⟳]           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ This is sample text with some ~~grammatical~~ errors       │
│ that will be highlighted by the grammar checker.           │
│                                                             │
│ The system provides real-time feedback and allows          │
│ users to accept or dismiss suggestions ~~easily~~.         │
│                                                             │
│                                                             │
│                                                             │
│                                [Continue writing...]        │
└─────────────────────────────────────────────────────────────┘

Legend:
- ~~text~~ = highlighted grammar suggestions
- [B] [I] [U] = Bold, Italic, Underline buttons
- [H1] [H2] [H3] = Heading level buttons
- [•] [1.] = Bullet and numbered lists
- [≡] = Text alignment
- [⟲] [⟳] = Undo/Redo
```

## Suggestion Panel (Desktop)

```
┌─────────────────────────┐
│ Writing Suggestions (3) │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ GRAMMAR             │ │
│ │ "grammatical"       │ │
│ │ → "grammar"         │ │
│ │ Subject-verb error  │ │
│ │ [Accept] [Dismiss]  │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ STYLE               │ │
│ │ "easily"            │ │
│ │ → "with ease"       │ │
│ │ Consider alternative│ │
│ │ [Accept] [Dismiss]  │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ SPELLING            │ │
│ │ "recieve"           │ │
│ │ → "receive"         │ │
│ │ Common misspelling  │ │
│ │ [Accept] [Dismiss]  │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

## Mobile Interface

```
┌─────────────────┐
│ ☰ WordWise  👤  │
├─────────────────┤
│ Document Title  │
│ 1,247 words     │
├─────────────────┤
│ [B][I][U][H1]   │
│ [•][1.][≡][⟲]   │
├─────────────────┤
│                 │
│ This is sample  │
│ text with some  │
│ ~~errors~~ that │
│ will be found.  │
│                 │
│ [Continue...]   │
├─────────────────┤
│ Suggestions (3) │
│ ▼ Show Panel    │
└─────────────────┘

When suggestions panel expanded:
┌─────────────────┐
│ Suggestions ▲   │
├─────────────────┤
│ GRAMMAR         │
│ "errors" →      │
│ "mistakes"      │
│ [✓] [✗]         │
├─────────────────┤
│ Next: Ctrl+.    │
│ Prev: Ctrl+,    │
└─────────────────┘
```

## Export Dialog

```
┌───────────────────────────┐
│        Export Document    │
├───────────────────────────┤
│ Format:                   │
│ ○ PDF  ● DOCX  ○ HTML     │
│                           │
│ Include:                  │
│ ☑ Original formatting     │
│ ☐ Comments/suggestions    │
│ ☑ Page numbers           │
│                           │
│ ┌─────────────────────┐   │
│ │ Document_Title.docx │   │
│ └─────────────────────┘   │
│                           │
│     [Cancel] [Export]     │
└───────────────────────────┘
```

## Key Design Principles

### Visual Hierarchy
- **Primary**: Document content (largest, center focus)
- **Secondary**: Toolbar and suggestions (smaller, supportive)
- **Tertiary**: Status indicators and metadata (smallest)

### Accessibility Features
- **High Contrast**: Suggestions use distinct colors (red for grammar, yellow for style, blue for spelling)
- **Keyboard Navigation**: Tab order follows logical flow
- **Screen Reader**: All interactive elements have descriptive labels
- **Focus Indicators**: Clear visual feedback for keyboard users

### Responsive Design
- **Desktop**: Side-by-side editor and suggestions panel
- **Tablet**: Collapsible suggestion panel
- **Mobile**: Bottom sheet for suggestions, simplified toolbar

### Interaction Patterns
- **Hover States**: Subtle highlighting on suggestion hover
- **Loading States**: Skeleton screens during grammar checking
- **Success Feedback**: Green checkmarks for accepted suggestions
- **Error Handling**: Clear error messages with recovery options

## User Flow Examples

### New User Journey
1. **Landing**: Clean interface with sample text
2. **Sign Up**: Email link authentication flow
3. **First Edit**: Guided tour of suggestion features
4. **First Export**: Simple PDF download success

### Power User Workflow
1. **Quick Entry**: Paste text, immediate grammar checking
2. **Rapid Review**: Keyboard shortcuts for suggestion navigation
3. **Batch Accept**: Accept multiple suggestions quickly
4. **Export**: One-click PDF generation 