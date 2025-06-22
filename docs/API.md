# WordWise API Documentation

## Overview

WordWise provides a RESTful API built on Next.js API routes for document management, grammar checking, and export functionality.

Base URL: `https://your-domain.vercel.app/api`

## Authentication

All endpoints require Firebase Authentication. Include the Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

## API Endpoints

### 1. Save Document

**Endpoint:** `POST /api/saveDoc`

**Description:** Saves or updates a document in Firestore

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <firebase-id-token>
```

**Request Body:**
```json
{
  "docId": "document-uuid",
  "content": "<p>Document HTML content</p>",
  "title": "Document Title",
  "lastModified": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "docId": "document-uuid",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.vercel.app/api/saveDoc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "docId": "doc-123",
    "content": "<p>Hello world</p>",
    "title": "My Document"
  }'
```

### 2. Grammar Check

**Endpoint:** `POST /api/generate`

**Description:** Generates grammar and style suggestions using LanguageTool

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <firebase-id-token>
```

**Request Body:**
```json
{
  "text": "This is the text to check for grammar errors.",
  "language": "en-US"
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "id": "suggestion-uuid",
      "type": "grammar",
      "ruleKey": "UPPERCASE_SENTENCE_START",
      "original": "this",
      "replacement": "This",
      "explanation": "Sentences should start with a capital letter",
      "range": {
        "from": 0,
        "to": 4
      },
      "status": "new"
    }
  ],
  "processingTime": 245
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "text": "this is a test sentence with errors.",
    "language": "en-US"
  }'
```

### 3. Record Decision

**Endpoint:** `POST /api/decision`

**Description:** Records user's decision on a grammar suggestion for personalization

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <firebase-id-token>
```

**Request Body:**
```json
{
  "suggestionId": "suggestion-uuid",
  "action": "applied",
  "ruleKey": "UPPERCASE_SENTENCE_START",
  "original": "this",
  "replacement": "This"
}
```

**Response:**
```json
{
  "success": true,
  "recorded": true
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.vercel.app/api/decision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "suggestionId": "sugg-123",
    "action": "applied",
    "ruleKey": "GRAMMAR_ERROR"
  }'
```

### 4. Export Document

**Endpoint:** `GET /api/export`

**Description:** Exports document to PDF or DOCX format

**Query Parameters:**
- `docId` (required): Document ID to export
- `format` (optional): Export format (`pdf` or `docx`, defaults to `pdf`)
- `title` (optional): Document title for the export

**Headers:**
```
Authorization: Bearer <firebase-id-token>
```

**Response:** Binary file download with appropriate Content-Type header

**cURL Example:**
```bash
curl -X GET "https://your-domain.vercel.app/api/export?docId=doc-123&format=pdf" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -o "document.pdf"
```

### 5. LanguageTool Health Check

**Endpoint:** `GET /api/lt-self-test`

**Description:** Tests LanguageTool service connectivity and performance

**Headers:**
```
Authorization: Bearer <firebase-id-token>
```

**Response:**
```json
{
  "status": "healthy",
  "languageToolVersion": "6.3",
  "responseTime": 156,
  "testResult": {
    "originalText": "This are a test.",
    "suggestionsFound": 1,
    "suggestions": [
      {
        "message": "Subject-verb disagreement",
        "replacement": "This is a test."
      }
    ]
  }
}
```

**cURL Example:**
```bash
curl -X GET https://your-domain.vercel.app/api/lt-self-test \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": true,
  "message": "Detailed error description",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Error Codes

- `UNAUTHORIZED`: Missing or invalid Firebase token
- `VALIDATION_ERROR`: Invalid request parameters
- `DOCUMENT_NOT_FOUND`: Requested document doesn't exist
- `LANGUAGE_TOOL_ERROR`: Grammar checking service unavailable
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server-side error

## Rate Limits

- Grammar checking (`/api/generate`): 60 requests per minute per user
- Document saving (`/api/saveDoc`): 120 requests per minute per user
- Export (`/api/export`): 10 requests per minute per user
- Other endpoints: 200 requests per minute per user

## Response Times

- Document save: < 200ms
- Grammar checking: < 2000ms
- PDF export: < 5000ms
- DOCX export: < 3000ms

## Monitoring

All API endpoints are monitored with:
- Response time tracking
- Error rate monitoring
- Firebase Performance traces
- Sentry error reporting

Access monitoring dashboards through the Firebase Console and Vercel Analytics. 