# WordWise Deployment Guide

## Overview
This guide covers deploying WordWise to Vercel with Firebase backend services.

## Prerequisites
- Node.js 18+ installed
- Firebase account
- Vercel account
- Git repository

## Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named "wordwise"
3. Enable Google Analytics (optional)

### 2. Enable Required Services

#### Firestore Database
1. Go to Firestore Database
2. Create database in production mode
3. Set up security rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /documents/{document} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.ownerUid;
    }
  }
}
```

#### Authentication
1. Go to Authentication > Sign-in method
2. Enable Email/Password authentication
3. Configure authorized domains (add your Vercel domain)

#### Performance Monitoring
1. Go to Performance Monitoring
2. Enable Performance Monitoring

### 3. Get Firebase Configuration
1. Go to Project Settings > General
2. Add a web app
3. Copy the configuration object
4. Generate a service account key:
   - Go to Project Settings > Service Accounts
   - Generate new private key
   - Download the JSON file

## Vercel Deployment

### 1. Environment Variables
Set up these environment variables in Vercel:

```bash
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key\n-----END PRIVATE KEY-----\n"

# Sentry (Optional)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

### 2. Deploy to Vercel

#### Option A: Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

#### Option B: GitHub Integration
1. Connect your GitHub repository to Vercel
2. Import the project
3. Set environment variables
4. Deploy

### 3. Configure Custom Domain (Optional)
1. Go to your Vercel project settings
2. Add your custom domain
3. Configure DNS records

## LanguageTool Setup (Optional)

For production grammar checking, set up LanguageTool server:

### Docker Setup
```bash
docker run -d -p 8010:8010 erikvl87/languagetool
```

### Environment Variable
```bash
LANGUAGETOOL_URL=http://your-languagetool-server:8010
```

## Post-Deployment Checklist

### 1. Test Core Features
- [ ] User registration/login
- [ ] Document creation and editing
- [ ] Grammar suggestions
- [ ] Document saving to Firestore
- [ ] PDF/DOCX export
- [ ] Responsive design on mobile

### 2. Performance Verification
- [ ] Page load time < 3 seconds
- [ ] Grammar check response < 2 seconds
- [ ] Export functionality < 3 seconds
- [ ] Lighthouse score ≥ 90

### 3. Security Verification
- [ ] Firebase security rules working
- [ ] HTTPS enabled
- [ ] Environment variables secured
- [ ] No sensitive data in client bundle

### 4. Monitoring Setup
- [ ] Sentry error tracking active
- [ ] Firebase Performance monitoring active
- [ ] Vercel analytics configured

## Troubleshooting

### Common Issues

#### Firebase Connection Errors
- Verify environment variables are set correctly
- Check Firebase project settings
- Ensure authorized domains include your Vercel URL

#### Build Failures
- Check Node.js version compatibility
- Verify all dependencies are installed
- Review build logs for specific errors

#### Performance Issues
- Enable Vercel Edge Functions if needed
- Optimize bundle size
- Configure caching headers

## Monitoring and Maintenance

### Performance Monitoring
- Monitor Firebase Performance console
- Check Vercel analytics
- Review Sentry error reports

### Updates
```bash
# Update dependencies
npm update

# Deploy updates
vercel --prod
```

### Backup
- Firebase data is automatically backed up
- Export Firestore data regularly for additional safety

## Support
For deployment issues:
1. Check Vercel deployment logs
2. Review Firebase console for errors
3. Monitor Sentry for runtime errors
4. Check browser developer tools for client-side issues

## Security Notes
- Never commit environment variables to git
- Regularly rotate Firebase service account keys
- Monitor for unusual authentication activity
- Keep dependencies updated for security patches 