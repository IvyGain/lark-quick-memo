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
  LocalStorage,
  List,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { getTenantAccessToken, sendTextMessage } from "./lark";
import { decorateWithTimestamp } from "./utils";
import { Language, getTranslation } from "./locales/translations";

type OnboardingStep = "language" | "welcome" | "lark-setup" | "basic-config" | "receiver-config" | "test-connection" | "complete";

interface OnboardingState {
  currentStep: OnboardingStep;
  language: Language;
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
    currentStep: "language",
    language: "ja",
    hasLarkApp: false,
    domain: "https://open.larksuite.com",
    appId: "",
    appSecret: "",
    receiveId: "",
    receiveIdType: "email",
  });
  
  const t = getTranslation(state.language);
  
  useEffect(() => {
    // Load saved language preference
    LocalStorage.getItem<string>("preferred-language").then((lang) => {
      if (lang === "en" || lang === "ja") {
        setState(prev => ({ ...prev, language: lang as Language }));
      }
    });
  }, []);

  const nextStep = () => {
    const stepOrder: OnboardingStep[] = ["language", "welcome", "lark-setup", "basic-config", "receiver-config", "test-connection", "complete"];
    const currentIndex = stepOrder.indexOf(state.currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setState({ ...state, currentStep: stepOrder[currentIndex + 1] });
    }
  };

  const prevStep = () => {
    const stepOrder: OnboardingStep[] = ["language", "welcome", "lark-setup", "basic-config", "receiver-config", "test-connection", "complete"];
    const currentIndex = stepOrder.indexOf(state.currentStep);
    if (currentIndex > 0) {
      setState({ ...state, currentStep: stepOrder[currentIndex - 1] });
    }
  };
  
  const selectLanguage = async (language: Language) => {
    await LocalStorage.setItem("preferred-language", language);
    setState({ ...state, language, currentStep: "welcome" });
  };

  const testConnection = async () => {
    try {
      showToast({ style: Toast.Style.Animated, title: t.testing });
      
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
      const testMessage = state.language === "ja" 
        ? "🎉 Lark Quick Memo セットアップ完了！\nおめでとうございます。正常に動作しています。"
        : "🎉 Lark Quick Memo Setup Complete!\nCongratulations! Everything is working correctly.";
      const decoratedMessage = decorateWithTimestamp(testMessage, true);
      
      await sendTextMessage(token, decoratedMessage);
      
      // Restore original function
      (global as any).getPreferenceValues = originalGet;
      
      showToast({ style: Toast.Style.Success, title: t.testSuccess, message: t.testSuccessMsg });
      nextStep();
    } catch (error: any) {
      showToast({ 
        style: Toast.Style.Failure, 
        title: t.testFailed, 
        message: error.message || t.checkSettings 
      });
    }
  };

  const completeSetup = async () => {
    try {
      // Open extension preferences to save settings
      await openExtensionPreferences();
      showHUD(state.language === "ja" 
        ? "設定画面を開きました。設定を保存してください。"
        : "Settings opened. Please save your configuration.");
    } catch (error) {
      console.error("Failed to open preferences:", error);
    }
  };

  if (state.currentStep === "language") {
    return (
      <List 
        navigationTitle={t.selectLanguage}
        searchBarPlaceholder={t.languagePrompt}
      >
        <List.Item
          title={t.japanese}
          subtitle="セットアップを日本語で進めます"
          icon="🇯🇵"
          actions={
            <ActionPanel>
              <Action title={t.japanese} onAction={() => selectLanguage("ja")} />
            </ActionPanel>
          }
        />
        <List.Item
          title={t.english}
          subtitle="Continue setup in English"
          icon="🇺🇸"
          actions={
            <ActionPanel>
              <Action title={t.english} onAction={() => selectLanguage("en")} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  if (state.currentStep === "welcome") {
    return (
      <Detail
        markdown={`# 🚀 ${t.welcomeTitle}

${t.welcomeDesc}

## ✨ ${t.features}

- **${t.featureQuick}**: ${t.featureQuickDesc}
- **${t.featureTimestamp}**: ${t.featureTimestampDesc}
- **${t.featureGlobal}**: ${t.featureGlobalDesc}
- **${t.featureSecure}**: ${t.featureSecureDesc}

## 🎯 ${t.setupFlow}

1. **${t.setupStep1}**: ${t.setupStep1Desc}
2. **${t.setupStep2}**: ${t.setupStep2Desc}
3. **${t.setupStep3}**: ${t.setupStep3Desc}
4. **${t.setupStep4}**: ${t.setupStep4Desc}

${t.estimatedTime}

${t.readyQuestion}`}
        actions={
          <ActionPanel>
            <Action title={t.startSetup} onAction={nextStep} />
            <Action title={t.setupLater} onAction={pop} />
          </ActionPanel>
        }
      />
    );
  }

  if (state.currentStep === "lark-setup") {
    return (
      <Detail
        markdown={`# 📱 ${t.larkSetupTitle}

${t.larkSetupIntro}

## 🔗 ${t.devConsole}

**${t.globalVersion}:**
- [https://open.larksuite.com/app](https://open.larksuite.com/app)

**${t.chinaVersion}:**
- [https://open.feishu.cn/app](https://open.feishu.cn/app)

## 📋 ${t.createAppSteps}

### 1. ${t.step1CreateApp}
${t.step1Details.map(d => `- ${d}`).join('\n')}

### 2. ${t.step2EnableBot}
${t.step2Details.map(d => `- ${d}`).join('\n')}

### 3. ${t.step3Permissions}
${t.step3Details.map(d => `- ${d}`).join('\n')}

### 4. ${t.step4Release}
${t.step4Details.map(d => `- ${d}`).join('\n')}

### 5. ${t.step5GetCredentials}
${t.step5Details.map(d => `- ${d}`).join('\n')}

${t.allDoneQuestion}`}
        actions={
          <ActionPanel>
            <Action title={t.completed} onAction={nextStep} />
            <Action title={t.back} onAction={prevStep} />
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
              title={t.next}
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
            <Action title={t.back} onAction={prevStep} />
          </ActionPanel>
        }
      >
        <Form.Description text={t.basicConfigDesc} />
        
        <Form.Dropdown
          id="domain"
          title={t.larkDomain}
          defaultValue={state.domain}
          info={t.selectEnv}
        >
          <Form.Dropdown.Item value="https://open.larksuite.com" title="Global (open.larksuite.com)" />
          <Form.Dropdown.Item value="https://open.feishu.cn" title="China (open.feishu.cn)" />
        </Form.Dropdown>

        <Form.PasswordField
          id="appId"
          title={t.appId}
          placeholder={t.appIdPlaceholder}
          defaultValue={state.appId}
          info={t.appIdInfo}
        />

        <Form.PasswordField
          id="appSecret"
          title={t.appSecret}
          placeholder={t.appSecretPlaceholder}
          defaultValue={state.appSecret}
          info={t.appSecretInfo}
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
              title={t.next}
              onSubmit={(values: any) => {
                setState({
                  ...state,
                  receiveIdType: values.receiveIdType,
                  receiveId: values.receiveId,
                });
                nextStep();
              }}
            />
            <Action title={t.back} onAction={prevStep} />
          </ActionPanel>
        }
      >
        <Form.Description text={t.receiverConfigDesc} />
        
        <Form.Dropdown
          id="receiveIdType"
          title={t.receiveIdType}
          defaultValue={state.receiveIdType}
          info={t.receiveIdTypeInfo}
        >
          <Form.Dropdown.Item value="email" title={t.emailRecommended} />
          <Form.Dropdown.Item value="open_id" title={t.openIdAdvanced} />
        </Form.Dropdown>

        <Form.TextField
          id="receiveId"
          title={t.receiveId}
          placeholder={t.receiveIdPlaceholder}
          defaultValue={state.receiveId}
          info={
            state.receiveIdType === "email" 
              ? t.receiveIdEmailInfo
              : t.receiveIdOpenInfo
          }
        />

        <Form.Separator />
        
        <Form.Description text={"💡 " + t.receiverHint} />
      </Form>
    );
  }

  if (state.currentStep === "test-connection") {
    return (
      <Detail
        markdown={`# 🧪 ${t.testConnectionTitle}

${t.testConnectionIntro}

## 📝 ${t.configReview}

- **${t.domain}**: ${state.domain}
- **${t.appId}**: ${state.appId.substring(0, 8)}...
- **${t.receiveId}**: ${state.receiveId}
- **${t.receiveIdType}**: ${state.receiveIdType}

## 🔄 ${t.testSteps}

1. ${t.testStep1}
2. ${t.testStep2}
3. ${t.testStep3}

${t.readyToTest}`}
        actions={
          <ActionPanel>
            <Action title={t.startTest} onAction={testConnection} />
            <Action title={t.fixSettings} onAction={prevStep} />
          </ActionPanel>
        }
      />
    );
  }

  if (state.currentStep === "complete") {
    return (
      <Detail
        markdown={`# 🎉 ${t.completeTitle}

${t.completeDesc}

## ✅ ${t.completedItems}

- ✅ ${t.larkConnected}
- ✅ ${t.messageTestSuccess}
- ✅ ${t.allSettingsOk}

## 🚀 ${t.usage}

1. ${t.usageStep1}
2. ${t.usageStep2}
3. ${t.usageStep3}
4. ${t.usageStep4}

## ⚙️ ${t.saveSettings}

${t.saveSettingsDesc}`}
        actions={
          <ActionPanel>
            <Action title={t.saveSettingsBtn} onAction={completeSetup} />
            <Action title={t.complete} onAction={pop} />
          </ActionPanel>
        }
      />
    );
  }

  return null;
}