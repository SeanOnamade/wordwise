# WordWise - AI-Powered Writing Assistant

A sophisticated web-based writing assistant that helps ESL students, professionals, and content creators improve their writing through intelligent grammar and style suggestions.

## Features

- **Real-time Grammar Checking**: Powered by LanguageTool for enterprise-grade accuracy
- **Rich Text Editor**: TipTap-based editor with inline suggestions and visual highlighting
- **Personalized Feedback**: AI learns from your writing patterns and preferences
- **Smart Suggestions**: Accept/Reject controls with keyboard shortcuts (Ctrl+. / Ctrl+,)
- **Export Options**: Export to PDF and DOCX formats
- **Google Docs Integration**: Copy formatted text directly to Google Docs
- **Accessibility**: Full keyboard navigation and screen reader support
- **Secure Authentication**: Firebase Auth with email-link sign-in
- **Real-time Sync**: Automatic document saving and cross-device synchronization

## Architecture

![WordWise Architecture](public/architecture.png)

WordWise uses a modern, scalable architecture with Next.js frontend, LanguageTool for grammar checking, and Firebase for authentication and data storage.

## Prerequisites

- Node.js 18 or higher
- Firebase account
- Git

## Quick Start

1. **Clone and Install**:
   ```bash
   git clone https://github.com/yourusername/wordwise.git
   cd wordwise
   npm install
   ```

2. **Configure Firebase**:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication (Email Link sign-in)
   - Enable Firestore Database
   - Copy your config to `.env.local`:
   
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
   
   # Firebase Admin (for server-side operations)
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   
   # LanguageTool Cloud API (optional - defaults to public endpoint)
   NEXT_PUBLIC_LT_ENDPOINT=https://api.languagetool.org/v2/check
   ```

3. **Launch the App**:
   ```bash
   npm run dev
   ```

   Visit http://localhost:3000 to start writing!

## User Personas

WordWise is designed for three primary user types:

### 📚 **Sarah Chen - ESL Graduate Student**
- PhD candidate writing research papers and grant proposals
- Needs explanations for grammar corrections to improve learning
- Requires academic writing style guidance

### 💼 **Ben Rodriguez - Project Manager** 
- Manages international teams, writes business communications
- Needs quick, professional corrections for emails and proposals
- Values mobile-friendly interface for on-the-go editing

### ✍️ **Maya Patel - Content Creator with Dyslexia**
- Creates educational content and blog posts
- Needs accessible tools with visual highlighting
- Requires keyboard navigation and screen reader support

## Keyboard Shortcuts

WordWise supports extensive keyboard shortcuts for power users:

### Suggestion Navigation
- **Ctrl/Cmd + .** - Navigate to next suggestion
- **Ctrl/Cmd + ,** - Navigate to previous suggestion
- **A** - Accept suggestion (when focused)
- **X** - Dismiss suggestion (when focused)

### Text Formatting
- **Ctrl/Cmd + B** - Bold
- **Ctrl/Cmd + I** - Italic  
- **Ctrl/Cmd + U** - Underline
- **Ctrl/Cmd + Shift + X** - Strikethrough
- **Ctrl/Cmd + Shift + H** - Highlight

### Document Structure
- **Ctrl/Cmd + Alt + 1/2/3** - Heading levels
- **Ctrl/Cmd + Shift + 8** - Bullet list
- **Ctrl/Cmd + Shift + 7** - Numbered list

### Alignment
- **Ctrl/Cmd + Shift + L** - Align left
- **Ctrl/Cmd + Shift + E** - Center align
- **Ctrl/Cmd + Shift + R** - Align right
- **Ctrl/Cmd + Shift + J** - Justify

## Success Criteria

WordWise meets the following quality benchmarks:

- **Suggestion Accuracy**: ≥90% of LanguageTool suggestions are contextually appropriate
- **Response Time**: < 2000ms for grammar checking requests
- **Document Capacity**: Supports up to 5,000 words without performance degradation
- **Accessibility**: WCAG 2.1 AA compliance with screen reader support
- **Uptime**: 99.9% availability on Vercel infrastructure

### Stretch Goals
- **Multilingual Support**: Spanish language toggle for broader accessibility
- **Collaborative Editing**: Real-time multi-user document editing
- **Advanced AI Integration**: GPT-4 powered style suggestions for academic and business writing

## Testing & Quality Assurance

### Manual Testing Checklist

✅ **Performance Tests**
- [ ] Paste 5,000-word text – editor remains responsive (no freeze)
- [ ] `/api/generate` response time < 2000ms (check Network tab)
- [ ] Keyboard shortcuts respond within 100ms

✅ **Grammar & Suggestions**
- [ ] Text highlights appear as colored underlines
- [ ] Accept button removes highlight instantly
- [ ] Dismiss button hides suggestion permanently
- [ ] Ctrl+. and Ctrl+, navigate between suggestions

✅ **Data Persistence**  
- [ ] Refresh page – document reloads from Firestore
- [ ] Autosave indicator shows "Saving..." then "Last saved"
- [ ] Cross-device sync works within 5 seconds

✅ **Export & Integration**
- [ ] Export PDF downloads and opens correctly
- [ ] Share to Google Docs copies clean HTML
- [ ] Exported documents maintain formatting

✅ **Accessibility**
- [ ] Tab navigation reaches all interactive elements
- [ ] Screen readers announce button purposes
- [ ] Keyboard shortcuts work without mouse

## Project Structure

```
src/
├── app/                 # Next.js 13 app router pages
├── components/          # React components
├── lib/                 # Utility functions and Firebase config
├── store/              # Zustand store
└── types/              # TypeScript type definitions
```

## API Routes

| Route | Method | Purpose | Documentation |
|-------|--------|---------|---------------|
| `/api/saveDoc` | POST | Save document to Firestore | [API Docs](docs/API.md#save-document) |
| `/api/generate` | POST | Get grammar suggestions from LanguageTool | [API Docs](docs/API.md#grammar-check) |
| `/api/decision` | POST | Record user decisions for personalization | [API Docs](docs/API.md#record-decision) |
| `/api/export` | GET | Export to PDF/DOCX formats | [API Docs](docs/API.md#export-document) |
| `/api/lt-self-test` | GET | LanguageTool health check | [API Docs](docs/API.md#languagetool-health-check) |

## Documentation

- **[User Personas & Context](docs/Context%20&%20Personas.md)** - Target users and market opportunity
- **[Technical Architecture](docs/TECH_OVERVIEW.md)** - System design, technology choices, and execution phases
- **[Wireframes & UI Concepts](docs/WIREFRAMES.md)** - Interface mockups and design principles
- **[API Reference](docs/API.md)** - Complete API documentation with examples
- **[Architecture Diagram](public/architecture.png)** - Visual system overview

## Development Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production (includes diagram generation)
npm run start        # Start production server

# Quality Assurance  
npm run lint         # ESLint code checking
npm run typecheck    # TypeScript type checking
npm run test         # Run Jest test suite
npm run test:watch   # Watch mode for tests

# Utilities
npm run diagram      # Generate architecture diagram
```

## Deployment

### Vercel (Recommended)

1. **Connect Repository**:
   ```bash
   npm install -g vercel
   vercel --prod
   ```

2. **Environment Variables**:
   Add all Firebase config variables in Vercel Dashboard → Settings → Environment Variables

3. **Custom Domain** (Optional):
   - Add domain in Vercel Dashboard
   - Update Firebase Auth authorized domains

### Docker Deployment

```bash
# Build and run with Docker
docker build -t wordwise .
docker run -p 3000:3000 wordwise
```

### Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

## Why Now?

The convergence of several technological and social trends makes this the perfect time for WordWise:

🌍 **Global Remote Work**: 1.5+ billion people now work remotely, requiring clear written communication across languages and cultures

🤖 **AI Democratization**: Large language models have made sophisticated writing assistance accessible to individual developers, not just big tech companies

📱 **Web-First Tools**: Browser-based applications now rival desktop software in performance while offering better collaboration and accessibility

🎓 **ESL Education Boom**: Online education growth has created demand for personalized, AI-powered learning tools that adapt to individual needs

## Contributing

We welcome contributions! Please see our [contribution guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests: `npm run test && npm run lint && npm run typecheck`
4. Commit your changes (`git commit -m 'Add some amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for writers worldwide** | [Live Demo](https://wordwise.vercel.app) | [Documentation](docs/) | [Report Issues](https://github.com/yourusername/wordwise/issues)