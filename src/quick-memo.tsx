import { 
  Action, 
  ActionPanel, 
  Form, 
  showHUD, 
  showToast,
  Toast,
  getPreferenceValues, 
  useNavigation,
  Detail,
  openExtensionPreferences,
  LocalStorage
} from "@raycast/api";
import { useState, useEffect } from "react";
import { withExponentialBackoff } from "./utils";
import { getTenantAccessToken, sendTextMessage } from "./lark";
import { isSetupComplete, getSetupStatus } from "./utils/setup-checker";
import { getEffectivePreferences, isEffectiveSetupComplete } from "./utils/preferences";
import OnboardingWizard from "./onboarding";
import { Language, getTranslation } from "./locales/translations";
import { clearAllStoredData, showCurrentSettings } from "./utils/test-helpers";
import { suggestSettingsToPreferences, syncPreferencesToLocalStorage, checkSettingsStatus } from "./utils/settings-sync";

type Prefs = {
  prefixTimestamp?: boolean;
};

export default function Command() {
  const { pop, push } = useNavigation();
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [language, setLanguage] = useState<Language>("ja");
  
  const t = getTranslation(language);

  useEffect(() => {
    const checkSetup = async () => {
      // Load saved language preference
      const savedLang = await LocalStorage.getItem<string>("preferred-language");
      if (savedLang === "en" || savedLang === "ja") {
        setLanguage(savedLang as Language);
      }
      
      // Check both Extension Preferences and LocalStorage
      const complete = await isEffectiveSetupComplete();
      setSetupComplete(complete);
      
      if (!complete) {
        // Show setup options instead of onboarding immediately
        setShowOnboarding(false);
      }
    };
    
    checkSetup();
  }, []);

  async function onSubmit(values: { memo: string }) {
    try {
      console.log("🚀 メッセージ送信開始");
      console.log("📨 入力されたメッセージ:", values.memo);
      
      // 新しいpreferencesシステムを使用
      const prefs = await getEffectivePreferences();
      console.log("⚙️ 取得した設定:", {
        ...prefs,
        appSecret: prefs.appSecret ? "***" : undefined
      });
      
      // 引数で設定を渡してAPI呼び出し
      const token = await getTenantAccessToken(prefs);
      
      // タイムスタンプは絶対に付けない
      const message = values.memo;
      console.log("📤 送信するメッセージ（タイムスタンプなし）:", message);
      console.log("🔍 メッセージ内容確認:", {
        original: values.memo,
        toSend: message,
        identical: values.memo === message
      });
      
      // 429対策: 1回だけ指数バックオフで再試行
      await withExponentialBackoff(() => sendTextMessage(token, message, prefs), { retries: 1, baseMs: 500 });
      
      await showHUD(t.sent);
      pop();
    } catch (e: any) {
      await showHUD(`${t.sendFailed}：${e?.message ?? t.unknownError}`);
      console.error(e);
    }
  }

  // Loading state
  if (setupComplete === null) {
    return (
      <Detail
        markdown={t.checkingSettings}
        actions={
          <ActionPanel>
            <Action title={t.cancel} onAction={pop} />
            <Action 
              title="🧪 テスト: データクリア" 
              onAction={async () => {
                await clearAllStoredData();
                // 強制的に再読み込み
                window.location.reload();
              }}
            />
            <Action 
              title="📊 設定確認" 
              onAction={showCurrentSettings}
            />
          </ActionPanel>
        }
      />
    );
  }

  // Show onboarding wizard
  if (showOnboarding) {
    return <OnboardingWizard />;
  }

  // Setup incomplete - show setup options
  if (!setupComplete) {
    const status = getSetupStatus();
    
    return (
      <Detail
        markdown={`# ⚙️ ${t.setupRequired}

Lark Quick Memoを使用するには、初期設定を完了してください。

## ❌ ${t.missingFields}

${status.missingFields.map(field => `- **${field}**`).join('\n')}

## 💡 ${t.setupMethods}

**選択肢1: ${t.guidedSetup}（推奨）**
- ${t.guidedSetupDesc}
- Larkアプリ作成から動作テストまで完全サポート
- ${t.guidedSetupTime}

**選択肢2: ${t.manualSetup}**
- Extension Preferencesで直接設定
- ${t.manualSetupDesc}
- ${t.manualSetupTime}

## 🚀 推奨事項

${t.recommendation}`}
        actions={
          <ActionPanel>
            <Action 
              title={t.guidedSetup} 
              onAction={() => setShowOnboarding(true)}
              icon="🚀"
            />
            <Action 
              title={t.manualSetup} 
              onAction={() => openExtensionPreferences()}
              icon="⚙️"
            />
            <Action title={t.setupLater} onAction={pop} />
            <Action 
              title="🧪 テスト: データクリア" 
              onAction={async () => {
                await clearAllStoredData();
                // 強制的に再読み込み
                setSetupComplete(null);
                setShowOnboarding(false);
                setLanguage("ja");
                // 設定確認を再実行
                const complete = isSetupComplete();
                setSetupComplete(complete);
              }}
            />
          </ActionPanel>
        }
      />
    );
  }

  // Setup complete - show normal memo form
  return (
    <Form 
      actions={
        <ActionPanel>
          <Action.SubmitForm title={t.sendMemo} onSubmit={onSubmit} />
          <Action title={t.changeSettings} onAction={() => openExtensionPreferences()} />
          <Action 
            title="🔄 Extension Preferencesに設定をコピー" 
            onAction={async () => {
              const settingsText = await suggestSettingsToPreferences();
              await Clipboard.copy(settingsText);
              showToast({
                style: Toast.Style.Success,
                title: "📋 設定をクリップボードにコピー",
                message: "Extension Preferencesで設定してください"
              });
              setTimeout(() => openExtensionPreferences(), 2000);
            }}
          />
          <Action 
            title="⬇️ Extension Preferencesから設定を取得" 
            onAction={async () => {
              const synced = await syncPreferencesToLocalStorage();
              if (synced) {
                showToast({
                  style: Toast.Style.Success,
                  title: "✅ 設定を同期しました",
                  message: "Extension Preferencesの設定を取得しました"
                });
              } else {
                showToast({
                  style: Toast.Style.Failure,
                  title: "⚠️ 同期できませんでした",
                  message: "Extension Preferencesに設定がありません"
                });
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea id="memo" title={t.memoTitle} placeholder={t.memoPlaceholder} autoFocus />
    </Form>
  );
}