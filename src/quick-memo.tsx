import { 
  Action, 
  ActionPanel, 
  Form, 
  showHUD, 
  getPreferenceValues, 
  useNavigation,
  Detail,
  openExtensionPreferences
} from "@raycast/api";
import { useState, useEffect } from "react";
import { decorateWithTimestamp, withExponentialBackoff } from "./utils";
import { getTenantAccessToken, sendTextMessage } from "./lark";
import { isSetupComplete, getSetupStatus } from "./utils/setup-checker";
import OnboardingWizard from "./onboarding";

type Prefs = {
  prefixTimestamp?: boolean;
};

export default function Command() {
  const { pop, push } = useNavigation();
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const checkSetup = async () => {
      const complete = isSetupComplete();
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
      const token = await getTenantAccessToken();
      const prefs = getPreferenceValues<Prefs>();
      const decorated = decorateWithTimestamp(values.memo, !!prefs.prefixTimestamp);
      // 429対策: 1回だけ指数バックオフで再試行
      await withExponentialBackoff(() => sendTextMessage(token, decorated), { retries: 1, baseMs: 500 });
      await showHUD("送信しました ✅");
      pop();
    } catch (e: any) {
      await showHUD(`送信失敗：${e?.message ?? "unknown error"}`);
      console.error(e);
    }
  }

  // Loading state
  if (setupComplete === null) {
    return (
      <Detail
        markdown="設定を確認中..."
        actions={
          <ActionPanel>
            <Action title="キャンセル" onAction={pop} />
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
        markdown={`# ⚙️ 初期設定が必要です

Lark Quick Memoを使用するには、初期設定を完了してください。

## ❌ 未設定項目

${status.missingFields.map(field => `- **${field}**`).join('\n')}

## 💡 設定方法

**選択肢1: ガイド付きセットアップ（推奨）**
- 詳細な手順で安全にセットアップ
- Larkアプリ作成から動作テストまで完全サポート
- 所要時間: 約10分

**選択肢2: 手動設定**
- Extension Preferencesで直接設定
- 上級者向け
- 所要時間: 約3分

## 🚀 推奨事項

初回利用の場合は「ガイド付きセットアップ」を選択してください。詳細な手順でスムーズに設定できます。`}
        actions={
          <ActionPanel>
            <Action 
              title="ガイド付きセットアップを開始" 
              onAction={() => setShowOnboarding(true)}
              icon="🚀"
            />
            <Action 
              title="手動設定（Extension Preferences）" 
              onAction={() => openExtensionPreferences()}
              icon="⚙️"
            />
            <Action title="後で設定する" onAction={pop} />
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
          <Action.SubmitForm title="送信" onSubmit={onSubmit} />
          <Action title="設定を変更" onAction={() => openExtensionPreferences()} />
        </ActionPanel>
      }
    >
      <Form.TextArea id="memo" title="メモ" placeholder="送る内容…" autoFocus />
    </Form>
  );
}