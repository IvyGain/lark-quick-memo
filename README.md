# Lark Quick Memo

📨 A Raycast extension for sending quick memos to Lark/Feishu with one action. Supports both global and China endpoints with secure authentication.

## ✨ Features

- 🚀 **One-Action Memo**: Send text to your Lark DM with just `Cmd+Shift+M` → type → `Cmd+Enter`
- 🌍 **Global & China Support**: Switch between `open.larksuite.com` and `open.feishu.cn` endpoints
- ⏰ **Optional Timestamps**: Automatically prefix messages with `[YYYY-MM-DD HH:mm:ss]`
- 🔒 **Secure Authentication**: App credentials stored securely in Raycast Keychain
- ⚡ **Smart Retry**: Exponential backoff for rate limiting (429 errors)
- 📱 **Native UX**: HUD notifications for success/failure feedback

## 🛠️ Setup

### 1. Create Lark/Feishu App

1. Visit [Lark Developer Console](https://open.larksuite.com/app) or [Feishu Console](https://open.feishu.cn/app)
2. Create a **Custom App**
3. Grant **"Send messages as the app"** permission
4. Copy your **App ID** and **App Secret**

### 2. Install Extension

1. Open Raycast → **Extensions** → **Develop Extensions**
2. Add this project directory
3. Configure extension preferences:
   - **Lark Domain**: `https://open.larksuite.com` (or `https://open.feishu.cn`)
   - **App ID**: Your app ID from step 1
   - **App Secret**: Your app secret from step 1
   - **Receive ID Type**: `email` (recommended)
   - **Receive ID**: Your Lark login email
   - **Prefix Timestamp**: ✅ (optional)

### 3. Test

1. Press `Cmd+Shift+M` to launch
2. Type your memo
3. Press `Cmd+Enter` to send
4. Check your Lark DMs for the message

## 🏗️ Architecture

```
Raycast Extension → Lark Open API
                 ↓
    tenant_access_token (auth)
                 ↓
    im/v1/messages (send)
```

## 📁 Project Structure

```
lark-quick-memo/
├── package.json          # Raycast extension config
├── tsconfig.json         # TypeScript config
└── src/
    ├── command.tsx       # Main UI component
    ├── lark.ts          # Lark API client
    └── utils.ts         # Utilities (timestamp, retry)
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not found | Ensure `package.json` name matches directory |
| Preferences error | Check all required fields are filled |
| Auth error (401/403) | Verify App ID/Secret and permissions |
| Message not delivered | Confirm Receive ID is correct Lark email |

## 🛣️ Roadmap

- **Phase 2**: OAuth support (send as user instead of app)
- **Phase 3**: Clipboard/template sending
- **Phase 4**: Image/file attachments
- **Phase 5**: Message history and search

## 📄 License

MIT License - feel free to use and modify!

## 🤝 Contributing

PRs welcome! Please ensure:
- Code follows existing patterns
- TypeScript strict mode compliance
- Test manually before submitting

---

**Made with ❤️ and Claude Code**