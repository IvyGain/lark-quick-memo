import { getPreferenceValues, LocalStorage } from "@raycast/api";

type Prefs = {
  larkDomain?: string;
  appId?: string;
  appSecret?: string;
  receiveIdType?: "email" | "open_id";
  receiveId?: string;
  prefixTimestamp?: boolean;
};

/**
 * 設定値を取得します。LocalStorageとPreferencesの両方から読み込み、
 * LocalStorageの値がある場合は優先します。
 */
export async function getEffectivePreferences(): Promise<Prefs> {
  try {
    // Extension Preferencesから基本設定を取得
    const extensionPrefs = getPreferenceValues<Prefs>();
    
    // LocalStorageから設定を取得（オンボーディングで保存された値）
    const [
      larkDomain,
      appId,
      appSecret,
      receiveIdType,
      receiveId,
      prefixTimestamp
    ] = await Promise.all([
      LocalStorage.getItem<string>("larkDomain"),
      LocalStorage.getItem<string>("appId"),
      LocalStorage.getItem<string>("appSecret"), 
      LocalStorage.getItem<string>("receiveIdType"),
      LocalStorage.getItem<string>("receiveId"),
      LocalStorage.getItem<string>("prefixTimestamp")
    ]);
    
    // LocalStorageの値がある場合は優先、なければExtension Preferencesを使用
    const effectivePrefs: Prefs = {
      larkDomain: larkDomain || extensionPrefs.larkDomain || "https://open.larksuite.com",
      appId: appId || extensionPrefs.appId,
      appSecret: appSecret || extensionPrefs.appSecret,
      receiveIdType: (receiveIdType as "email" | "open_id") || extensionPrefs.receiveIdType || "email",
      receiveId: receiveId || extensionPrefs.receiveId,
      prefixTimestamp: prefixTimestamp === "true" || extensionPrefs.prefixTimestamp === true
    };
    
    console.log("📊 Effective preferences:", {
      ...effectivePrefs,
      appSecret: effectivePrefs.appSecret ? "***" : undefined
    });
    
    return effectivePrefs;
    
  } catch (error) {
    console.error("Failed to get effective preferences:", error);
    // フォールバックとしてExtension Preferencesのみを返す
    return getPreferenceValues<Prefs>();
  }
}

/**
 * 設定が完全に設定されているかチェックします
 */
export async function isEffectiveSetupComplete(): Promise<boolean> {
  try {
    const prefs = await getEffectivePreferences();
    
    const requiredFields = [
      prefs.larkDomain,
      prefs.appId,
      prefs.appSecret,
      prefs.receiveId,
      prefs.receiveIdType
    ];
    
    const isComplete = requiredFields.every(field => 
      field !== undefined && 
      field !== "" && 
      field.toString().trim() !== ""
    );
    
    console.log("✅ Setup completion check:", {
      isComplete,
      hasAppId: !!prefs.appId,
      hasAppSecret: !!prefs.appSecret,
      hasReceiveId: !!prefs.receiveId
    });
    
    return isComplete;
  } catch (error) {
    console.error("Failed to check setup completion:", error);
    return false;
  }
}