# Design Document

## Overview

This design document outlines the implementation of Google Drive integration to replace the current file upload system in articles and gallery (library) sections. The system will allow users to provide Google Drive links instead of uploading files directly to the server, significantly reducing server storage usage while maintaining the same user experience.

The integration will support both individual files and folders, with automatic detection of file accessibility and proper error handling for private or inaccessible content.

## Architecture

### Current System Analysis

The current system uses:
- **File Upload**: Multer middleware for handling multipart/form-data uploads
- **Storage**: Local filesystem storage in `uploads/` and `attached_assets/` directories
- **Database**: MongoDB with fields storing local file paths
- **Articles**: Single image field (`image: text`)
- **Library**: Multiple images field (`images: text[]`)

### New System Architecture

The new system will:
- **Replace file uploads** with Google Drive link inputs
- **Extend database schema** to support both local files and Google Drive links
- **Add Google Drive service** for fetching file metadata and content
- **Maintain backward compatibility** with existing uploaded files
- **Implement caching** for Google Drive API responses

## Components and Interfaces

### 1. Google Drive Service (`server/services/googleDrive.ts`)

```typescript
interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink: string;
  thumbnailLink?: string;
  size?: string;
}

interface GoogleDriveService {
  // Validate and extract file/folder ID from Google Drive URL
  extractFileId(url: string): string | null;
  
  // Check if file/folder is publicly accessible
  checkAccessibility(fileId: string): Promise<boolean>;
  
  // Get single file metadata
  getFileMetadata(fileId: string): Promise<GoogleDriveFile>;
  
  // Get folder contents (for folders with multiple files)
  getFolderContents(folderId: string): Promise<GoogleDriveFile[]>;
  
  // Get direct download/view URL for media files
  getMediaUrl(fileId: string): Promise<string>;
}
```

### 2. Media Source Detection (`shared/mediaUtils.ts`)

```typescript
interface MediaSource {
  type: 'local' | 'gdrive';
  url: string;
  fileId?: string; // For Google Drive files
}

interface MediaUtils {
  // Detect if URL is Google Drive link or local file
  detectMediaSource(url: string): MediaSource;
  
  // Validate Google Drive URL format
  isValidGoogleDriveUrl(url: string): boolean;
  
  // Generate display URL based on source type
  getDisplayUrl(source: MediaSource): Promise<string>;
}
```

### 3. Database Schema Extensions

```typescript
// Extended article schema
interface ArticleWithGDrive {
  // ... existing fields
  image: string; // Can be local path or Google Drive URL
  imageSource?: 'local' | 'gdrive'; // Source type indicator
  gdriveFileId?: string; // Google Drive file ID for caching
}

// Extended library schema  
interface LibraryItemWithGDrive {
  // ... existing fields
  images: string[]; // Can contain mix of local paths and Google Drive URLs
  imageSources?: ('local' | 'gdrive')[]; // Source type for each image
  gdriveFileIds?: string[]; // Google Drive file IDs for caching
}
```

### 4. Frontend Components

#### Google Drive Link Input Component
```typescript
interface GDriveLinkInputProps {
  value: string;
  onChange: (url: string) => void;
  onValidation: (isValid: boolean, error?: string) => void;
  placeholder?: string;
}
```

#### Media Display Component
```typescript
interface MediaDisplayProps {
  src: string; // Can be local or Google Drive URL
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}
```

## Data Models

### Google Drive URL Patterns

The system will support these Google Drive URL formats:
- **File sharing**: `https://drive.google.com/file/d/{fileId}/view`
- **Folder sharing**: `https://drive.google.com/drive/folders/{folderId}`
- **Direct links**: `https://drive.google.com/open?id={fileId}`

### Database Schema Changes

```sql
-- Add new fields to support Google Drive integration
ALTER TABLE articles ADD COLUMN image_source TEXT DEFAULT 'local';
ALTER TABLE articles ADD COLUMN gdrive_file_id TEXT;

-- For MongoDB, these will be added as optional fields
```

### Caching Strategy

```typescript
interface GDriveCache {
  fileId: string;
  metadata: GoogleDriveFile;
  accessibleAt: Date;
  expiresAt: Date;
}
```

## Error Handling

### Google Drive API Errors

1. **Private/Inaccessible Files**
   - Error: "File is private and cannot be accessed by the server"
   - Action: Display error message, prevent form submission

2. **Invalid URLs**
   - Error: "Invalid Google Drive URL format"
   - Action: Show format examples, highlight correct patterns

3. **API Rate Limiting**
   - Error: "Google Drive API limit reached, please try again later"
   - Action: Implement exponential backoff, cache responses

4. **Network Failures**
   - Error: "Unable to connect to Google Drive"
   - Action: Retry mechanism, fallback to cached data

### Frontend Error States

```typescript
interface ValidationState {
  isValidating: boolean;
  isValid: boolean;
  error?: string;
  suggestion?: string;
}
```

## Testing Strategy

### Unit Tests

1. **Google Drive Service Tests**
   - URL parsing and validation
   - File accessibility checking
   - Metadata fetching
   - Error handling scenarios

2. **Media Utils Tests**
   - Source detection accuracy
   - URL format validation
   - Display URL generation

3. **Database Integration Tests**
   - Schema compatibility
   - Data migration scenarios
   - Mixed source handling

### Integration Tests

1. **API Endpoint Tests**
   - Article creation with Google Drive links
   - Library item creation with mixed sources
   - Error response handling

2. **Frontend Component Tests**
   - Link input validation
   - Media display rendering
   - Error state handling

### End-to-End Tests

1. **User Workflow Tests**
   - Complete article creation flow
   - Gallery item management
   - Error recovery scenarios

2. **Backward Compatibility Tests**
   - Existing content display
   - Mixed content scenarios
   - Migration edge cases

## Performance Considerations

### Caching Strategy

1. **Metadata Caching**
   - Cache Google Drive file metadata for 1 hour
   - Invalidate cache on access errors
   - Store in Redis or memory cache

2. **Image Optimization**
   - Use Google Drive thumbnail URLs when available
   - Implement lazy loading for gallery items
   - Progressive image loading

### API Rate Limiting

1. **Request Batching**
   - Batch multiple file requests when possible
   - Implement request queuing for high traffic

2. **Fallback Mechanisms**
   - Graceful degradation when API limits reached
   - Display cached thumbnails during outages

## Security Considerations

### Access Control

1. **Public File Validation**
   - Verify files are publicly accessible before storing
   - Regular accessibility checks for stored links

2. **URL Sanitization**
   - Validate and sanitize all Google Drive URLs
   - Prevent injection attacks through malformed URLs

### Privacy Protection

1. **No Authentication Required**
   - System only accesses publicly shared files
   - No user Google account integration needed

2. **Data Minimization**
   - Store only necessary file metadata
   - Automatic cleanup of inaccessible files

## Migration Strategy

### Backward Compatibility

1. **Dual Support**
   - Support both local files and Google Drive links
   - Automatic source detection in display components

2. **Gradual Migration**
   - New content uses Google Drive links
   - Existing content remains unchanged
   - Optional migration tools for administrators

### Database Migration

```typescript
// Migration script to add new fields
async function migrateDatabase() {
  // Add source type fields with default 'local' value
  await db.articles.updateMany({}, { 
    $set: { imageSource: 'local' } 
  });
  
  await db.library.updateMany({}, { 
    $set: { imageSources: [] } 
  });
}
```

## Implementation Phases

### Phase 1: Core Infrastructure
- Google Drive service implementation
- Media source detection utilities
- Database schema extensions

### Phase 2: Backend Integration
- API endpoint modifications
- Validation and error handling
- Caching implementation

### Phase 3: Frontend Components
- Google Drive link input components
- Media display component updates
- Form validation integration

### Phase 4: Testing and Optimization
- Comprehensive testing suite
- Performance optimization
- Documentation and deployment