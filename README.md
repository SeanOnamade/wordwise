# WordWise - ESL Writing Assistant

A web-based writing assistant that helps ESL students improve their academic writing through grammar and style suggestions.

## Features

- Real-time grammar and style suggestions using LanguageTool
- Rich text editor with inline suggestions
- Accept/Reject controls for each suggestion
- Export to DOCX and PDF formats
- Email-link authentication
- Responsive design with keyboard navigation support

## Prerequisites

- Node.js 18 or higher
- Docker Desktop (for LanguageTool)
- Firebase account

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/wordwise.git
   cd wordwise
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up LanguageTool:
   ```bash
   docker run -d --restart always --name languagetool -p 8010:8010 erikvl87/languagetool
   ```
   
   This will start LanguageTool on http://localhost:8010. The application will automatically fall back to a mock grammar checker if LanguageTool is not available.

4. Create a Firebase project and enable:
   - Authentication (Email Link sign-in)
   - Firestore Database
   - Hosting

5. Set up environment variables by copying `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   
   Then fill in your actual values:
   ```
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key-here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
   
   # Firebase Admin SDK (Server-side)
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   
   # Sentry Configuration (Optional)
   NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   SENTRY_ORG=your-org
   SENTRY_PROJECT=your-project
   ```

6. Run the development server:
   ```bash
   npm run dev
   ```

## Performance Requirements

WordWise is designed to meet the following performance criteria:

- **Grammar API Response Time**: < 2000ms for grammar checking requests
- **Document Size Limit**: Up to 5,000 words
- **Editor Responsiveness**: No freezing during large document editing
- **Firebase Performance**: Custom traces for monitoring suggestion generation

## Testing Checklist

To verify the application is working correctly:

✓ Paste 5,000-word text – editor remains responsive (no freeze)  
✓ `/api/generate` call duration < 2000 ms (Network tab)  
✓ Words inline are pastel-highlighted; Accept removes highlight instantly  
✓ Refresh page – doc reloads from Firestore  
✓ Click Export DOCX → downloads file that opens in Word  
✓ Sentry dashboard shows test error; Firebase Performance shows generate trace

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

- `POST /api/saveDoc` - Save document to Firestore
- `POST /api/generate` - Get grammar suggestions from LanguageTool
- `POST /api/decision` - Record user decisions on suggestions
- `GET /api/export` - Export document to DOCX/PDF

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

### Grammar checking (LanguageTool)

```bash
# One-time image download
docker run -d --restart always --name languagetool -p 8010:8010 erikvl87/languagetool
```

Set `NEXT_PUBLIC_LT_URL` if you deploy LT elsewhere, or `NEXT_PUBLIC_DISABLE_LT=true` to disable in CI.

The grammar checker uses LanguageTool for:
- Spelling mistakes
- Grammar errors
- Style suggestions
- Punctuation

You can test the connection by visiting `/api/lt-self-test` in development. 