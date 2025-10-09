# Changelog

All notable changes to the Lark Quick Memo extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-19

### 🎉 Initial Release

This is the first major release of Lark Quick Memo, featuring a comprehensive set of tools for efficient communication with Lark/Feishu.

### ✨ Added

#### Core Features
- **Quick Memo Sending**: Send text messages to Lark/Feishu with keyboard shortcut (`Cmd+Shift+M`)
- **File Attachments**: Upload and send files with native file picker integration
  - Support for images (PNG, JPG, JPEG, GIF, BMP, WebP)
  - Support for documents (PDF, DOC, DOCX, TXT, MD, CSV, XLS, XLSX)
  - Support for video files (MP4, MOV, AVI, MKV, WMV, FLV, WebM) with 50MB size limit
  - Multiple file selection capability
  - File preview and removal options
  - Intelligent file type detection and appropriate icons
- **Template Management System**: Create, organize, and use message templates
  - Custom template creation with name, category, and content
  - Preset templates for common use cases (meeting notes, daily reports, etc.)
  - Template categories for better organization
  - Template editing and deletion capabilities
- **Message History**: Comprehensive message tracking and management
  - View all sent messages with timestamps
  - Search functionality across message content
  - Message statistics and usage analytics
  - Individual message deletion and bulk clear options
  - Export capabilities for message history

#### Chat & Destination Management
- **Chat Destination Selection**: Choose where to send messages
  - Personal DM (default)
  - Group chats
  - Bot conversations
  - Custom chat destinations
- **Custom Chat Management**: Add and manage frequently used chat destinations
- **Smart Destination Detection**: Automatic chat type recognition

#### Platform & Localization
- **Multi-Platform Support**: 
  - Global Lark (open.larksuite.com)
  - China Feishu (open.feishu.cn)
- **Multi-Language Support**: 
  - Japanese interface
  - English interface
  - Dynamic language switching
- **Cross-Platform Compatibility**: Native macOS integration with Raycast

#### Advanced Features
- **Settings Management**: Comprehensive configuration options
  - Language preferences
  - Timestamp settings
  - Custom chat configuration
  - Data reset capabilities
- **Secure Authentication**: 
  - App credentials stored in Raycast Keychain
  - Secure token management
  - Automatic token refresh
- **Smart Retry Logic**: Exponential backoff for rate limiting (429 errors)
- **Native UX Integration**: 
  - HUD notifications for success/failure feedback
  - Native file picker integration
  - Raycast-native UI components

#### Developer Features
- **TypeScript Support**: Full TypeScript implementation with strict mode
- **Modular Architecture**: Clean separation of concerns
- **Error Handling**: Comprehensive error handling and user feedback
- **Logging**: Detailed logging for debugging and monitoring
- **API Integration**: Full Lark Open API integration
  - `im/v1/messages` for text messages
  - `im/v1/files` for file uploads
  - `im/v1/images` for image uploads
  - `im/v1/chats` for chat information

### 🔧 Technical Implementation

#### Architecture
- **Component-Based Design**: Modular React components for maintainability
- **State Management**: Local state management with persistent storage
- **API Client**: Robust Lark API client with error handling
- **File Handling**: Native file system integration for attachments
- **Data Persistence**: Local storage for templates, history, and settings

#### Performance
- **Optimized File Uploads**: Efficient handling of large files
- **Lazy Loading**: Components loaded on demand
- **Memory Management**: Proper cleanup and resource management
- **Network Optimization**: Smart retry logic and connection pooling

#### Security
- **Credential Security**: Secure storage in Raycast Keychain
- **Input Validation**: Comprehensive input sanitization
- **Error Sanitization**: Safe error message handling
- **API Security**: Proper authentication and authorization

### 📋 Supported File Formats

#### Images
- PNG (Portable Network Graphics)
- JPG/JPEG (Joint Photographic Experts Group)
- GIF (Graphics Interchange Format)

#### Documents
- PDF (Portable Document Format)

### 🌍 Supported Platforms

#### Lark Instances
- **Global**: open.larksuite.com (International users)
- **China**: open.feishu.cn (China mainland users)

#### Operating Systems
- **macOS**: Full support with Raycast integration

### 🔑 Required Permissions

The extension requires the following Lark app permissions:
- `im:message` - Send messages as the app
- `im:file` - Upload files and images
- `im:chat:readonly` - Get chat information for destination selection

### 📊 Statistics

- **Total Components**: 6 main components
- **Lines of Code**: ~2000+ lines of TypeScript
- **File Types Supported**: 4 (PNG, JPG, GIF, PDF)
- **Languages Supported**: 2 (Japanese, English)
- **API Endpoints**: 4 Lark API endpoints integrated

### 🎯 Use Cases

This release enables the following workflows:
1. **Quick Note Taking**: Rapid memo sending with keyboard shortcuts
2. **File Sharing**: Easy file attachment and sharing
3. **Template-Based Communication**: Standardized message formats
4. **Message Organization**: Historical tracking and search
5. **Multi-Destination Messaging**: Flexible chat destination management
6. **Cross-Language Communication**: Multi-language interface support

### 🚀 Getting Started

1. Install the extension from Raycast Store or manually
2. Configure your Lark app credentials in extension preferences
3. Set up your preferred language and destination settings
4. Start sending memos with `Cmd+Shift+M`

---

**Full Changelog**: https://github.com/your-username/lark-quick-memo/commits/v1.0.0