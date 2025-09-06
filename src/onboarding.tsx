import {
  Action,
  ActionPanel,
  Detail,
  Form,
  showHUD,
  showToast,
  Toast,
  useNavigation,
  openExtensionPreferences,
  getPreferenceValues,
} from "@raycast/api";
import { useState } from "react";
import { getTenantAccessToken, sendTextMessage } from "./lark";
import { decorateWithTimestamp } from "./utils";

type OnboardingStep = "welcome" | "lark-setup" | "basic-config" | "receiver-config" | "test-connection" | "complete";

interface OnboardingState {
  currentStep: OnboardingStep;
  hasLarkApp: boolean;
  domain: string;
  appId: string;
  appSecret: string;
  receiveId: string;
  receiveIdType: "email" | "open_id";
}

export default function OnboardingWizard() {
  const { pop } = useNavigation();
  const [state, setState] = useState<OnboardingState>({
    currentStep: "welcome",
    hasLarkApp: false,
    domain: "https://open.larksuite.com",
    appId: "",
    appSecret: "",
    receiveId: "",
    receiveIdType: "email",
  });

  const nextStep = () => {
    const stepOrder: OnboardingStep[] = ["welcome", "lark-setup", "basic-config", "receiver-config", "test-connection", "complete"];
    const currentIndex = stepOrder.indexOf(state.currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setState({ ...state, currentStep: stepOrder[currentIndex + 1] });
    }
  };

  const prevStep = () => {
    const stepOrder: OnboardingStep[] = ["welcome", "lark-setup", "basic-config", "receiver-config", "test-connection", "complete"];
    const currentIndex = stepOrder.indexOf(state.currentStep);
    if (currentIndex > 0) {
      setState({ ...state, currentStep: stepOrder[currentIndex - 1] });
    }
  };

  const testConnection = async () => {
    try {
      showToast({ style: Toast.Style.Animated, title: "接続テスト中..." });
      
      // Temporarily set preferences for testing
      const testPrefs = {
        larkDomain: state.domain,
        appId: state.appId,
        appSecret: state.appSecret,
        receiveIdType: state.receiveIdType,
        receiveId: state.receiveId,
        prefixTimestamp: true,
      };

      // Mock getPreferenceValues for testing
      const originalGet = getPreferenceValues;
      (global as any).getPreferenceValues = () => testPrefs;

      const token = await getTenantAccessToken();
      const testMessage = "🎉 Lark Quick Memo セットアップ完了！\nおめでとうございます。正常に動作しています。";
      const decoratedMessage = decorateWithTimestamp(testMessage, true);
      
      await sendTextMessage(token, decoratedMessage);
      
      // Restore original function
      (global as any).getPreferenceValues = originalGet;
      
      showToast({ style: Toast.Style.Success, title: "接続成功！", message: "Larkにテストメッセージを送信しました。" });
      nextStep();
    } catch (error: any) {
      showToast({ 
        style: Toast.Style.Failure, 
        title: "接続失敗", 
        message: error.message || "設定を確認してください。" 
      });
    }
  };

  const completeSetup = async () => {
    try {
      // Open extension preferences to save settings
      await openExtensionPreferences();
      showHUD("設定画面を開きました。設定を保存してください。");
    } catch (error) {
      console.error("Failed to open preferences:", error);
    }
  };

  if (state.currentStep === "welcome") {
    return (
      <Detail
        markdown={`# 🚀 Lark Quick Memo へようこそ！

RaycastからLark/Feishuへワンアクションでメモを送信できる拡張機能です。

## ✨ 主な機能

- **ワンアクション送信**: \`Cmd+Shift+M\` → テキスト入力 → \`Cmd+Enter\`
- **タイムスタンプ自動付与**: メッセージに日時を自動追加
- **Global/China対応**: どちらの環境でも利用可能
- **セキュア**: 認証情報は安全に保管

## 🎯 セットアップの流れ

1. **Larkアプリ作成**: 開発者コンソールでBot作成
2. **基本設定**: App ID・Secretの設定
3. **受信者設定**: メール送信先の設定
4. **動作テスト**: 実際にテスト送信

所要時間: 約10分

準備はできましたか？`}
        actions={
          <ActionPanel>
            <Action title="セットアップ開始" onAction={nextStep} />
            <Action title="後で設定する" onAction={pop} />
          </ActionPanel>
        }
      />
    );
  }

  if (state.currentStep === "lark-setup") {
    return (
      <Detail
        markdown={`# 📱 Larkアプリの作成

まず、Lark/Feishuでカスタムアプリを作成する必要があります。

## 🔗 開発者コンソールへアクセス

**Global版（推奨）:**
- [https://open.larksuite.com/app](https://open.larksuite.com/app)

**China版:**
- [https://open.feishu.cn/app](https://open.feishu.cn/app)

## 📋 作成手順

### 1. アプリ作成
- **「Create App」** をクリック
- **「Custom App」** を選択
- **App Name**: \`Quick Memo\` （任意）
- **Description**: \`Raycast extension for quick memos\`

### 2. Bot機能を有効化
- **「Add features and capabilities」** タブ
- **「Bot」** を選択して有効化

### 3. 権限設定
- **「Permissions & Scopes」** タブ
- 以下の権限を追加:
  - ✅ \`im:message\` - Send messages as the app
  - ✅ \`im:message:send_as_bot\` - Send messages as bot

### 4. アプリをリリース
- **「Version Management & Release」** タブ
- **「Create Version」** → **「Submit for Release」**
- 社内リリース完了まで待機

### 5. 認証情報を取得
- **「Credentials」** タブで以下をコピー:
  - **App ID** (例: \`cli_a1b2c3d4e5f6g7h8\`)
  - **App Secret** (例: \`abcdef123456...\`)

すべて完了しましたか？`}
        actions={
          <ActionPanel>
            <Action title="完了しました" onAction={nextStep} />
            <Action title="戻る" onAction={prevStep} />
          </ActionPanel>
        }
      />
    );
  }

  if (state.currentStep === "basic-config") {
    return (
      <Form
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title="次へ"
              onSubmit={(values: any) => {
                setState({
                  ...state,
                  domain: values.domain,
                  appId: values.appId,
                  appSecret: values.appSecret,
                });
                nextStep();
              }}
            />
            <Action title="戻る" onAction={prevStep} />
          </ActionPanel>
        }
      >
        <Form.Description text="Larkアプリの基本設定を入力してください。" />
        
        <Form.Dropdown
          id="domain"
          title="Lark Domain"
          defaultValue={state.domain}
          info="あなたのLark/Feishu環境を選択してください"
        >
          <Form.Dropdown.Item value="https://open.larksuite.com" title="Global (open.larksuite.com)" />
          <Form.Dropdown.Item value="https://open.feishu.cn" title="China (open.feishu.cn)" />
        </Form.Dropdown>

        <Form.PasswordField
          id="appId"
          title="App ID"
          placeholder="cli_xxxxxxxxxxxxxxxx"
          defaultValue={state.appId}
          info="Lark開発者コンソールの「Credentials」タブからコピー"
        />

        <Form.PasswordField
          id="appSecret"
          title="App Secret"
          placeholder="xxxxxxxxxxxxxxxxxxxxxx"
          defaultValue={state.appSecret}
          info="Lark開発者コンソールの「Credentials」タブからコピー"
        />
      </Form>
    );
  }

  if (state.currentStep === "receiver-config") {
    return (
      <Form
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title="次へ"
              onSubmit={(values: any) => {
                setState({
                  ...state,
                  receiveIdType: values.receiveIdType,
                  receiveId: values.receiveId,
                });
                nextStep();
              }}
            />
            <Action title="戻る" onAction={prevStep} />
          </ActionPanel>
        }
      >
        <Form.Description text="メッセージの送信先を設定してください。" />
        
        <Form.Dropdown
          id="receiveIdType"
          title="Receive ID Type"
          defaultValue={state.receiveIdType}
          info="メールアドレス形式を推奨します"
        >
          <Form.Dropdown.Item value="email" title="Email（推奨）" />
          <Form.Dropdown.Item value="open_id" title="Open ID（上級者向け）" />
        </Form.Dropdown>

        <Form.TextField
          id="receiveId"
          title="Receive ID"
          placeholder="your.email@company.com"
          defaultValue={state.receiveId}
          info={
            state.receiveIdType === "email" 
              ? "あなたのLarkログインメールアドレスを正確に入力してください"
              : "LarkプロフィールからOpen IDをコピーして入力してください"
          }
        />

        <Form.Separator />
        
        <Form.Description text="💡 ヒント: Larkアプリでプロフィール → アカウント設定から正確なメールアドレスを確認できます。" />
      </Form>
    );
  }

  if (state.currentStep === "test-connection") {
    return (
      <Detail
        markdown={`# 🧪 接続テスト

設定した内容でLarkへの接続をテストします。

## 📝 設定内容確認

- **Domain**: ${state.domain}
- **App ID**: ${state.appId.substring(0, 8)}...
- **Receive ID**: ${state.receiveId}
- **Receive ID Type**: ${state.receiveIdType}

## 🔄 テスト手順

1. **「接続テスト」**をクリック
2. Larkにテストメッセージが送信されます
3. 受信確認後、セットアップ完了

準備ができたらテストを開始してください。`}
        actions={
          <ActionPanel>
            <Action title="接続テスト" onAction={testConnection} />
            <Action title="設定を修正" onAction={prevStep} />
          </ActionPanel>
        }
      />
    );
  }

  if (state.currentStep === "complete") {
    return (
      <Detail
        markdown={`# 🎉 セットアップ完了！

Lark Quick Memoの設定が正常に完了しました。

## ✅ 設定済み内容

- ✅ Larkアプリ接続確認済み
- ✅ メッセージ送信テスト成功
- ✅ 全ての設定が正常動作

## 🚀 使用方法

1. **\`Cmd + Shift + M\`** で拡張を起動
2. **メモを入力**
3. **\`Cmd + Enter\`** で送信
4. **Larkで受信確認**

## ⚙️ 設定の保存

最後に、Extension Preferencesで設定を保存してください。`}
        actions={
          <ActionPanel>
            <Action title="設定を保存" onAction={completeSetup} />
            <Action title="完了" onAction={pop} />
          </ActionPanel>
        }
      />
    );
  }

  return null;
}