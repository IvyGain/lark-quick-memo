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
import { decorateWithTimestamp, withExponentialBackoff } from "./utils";
import { getTenantAccessToken, sendTextMessage } from "./lark";
import { isSetupComplete, getSetupStatus } from "./utils/setup-checker";
import { getEffectivePreferences, isEffectiveSetupComplete } from "./utils/preferences";
import OnboardingWizard from "./onboarding";
import { Language, getTranslation } from "./locales/translations";
import { clearAllStoredData, showCurrentSettings } from "./utils/test-helpers";

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
      // 新しいpreferencesシステムを使用
      const prefs = await getEffectivePreferences();
      
      // Mock getPreferenceValues for lark.ts compatibility
      const originalGet = getPreferenceValues;
      (global as any).getPreferenceValues = () => prefs;
      
      const token = await getTenantAccessToken();
      const decorated = decorateWithTimestamp(values.memo, !!prefs.prefixTimestamp);
      // 429対策: 1回だけ指数バックオフで再試行
      await withExponentialBackoff(() => sendTextMessage(token, decorated), { retries: 1, baseMs: 500 });
      
      // Restore original function
      (global as any).getPreferenceValues = originalGet;
      
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
        </ActionPanel>
      }
    >
      <Form.TextArea id="memo" title={t.memoTitle} placeholder={t.memoPlaceholder} autoFocus />
    </Form>
  );
}