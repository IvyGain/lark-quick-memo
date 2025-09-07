import { environment, LocalStorage } from "@raycast/api";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Extension Preferencesに設定を書き込む
 * Raycast内部ファイルを直接操作する方法
 */
export async function writeToExtensionPreferences(settings: {
  larkDomain: string;
  appId: string;
  appSecret: string;
  receiveIdType: string;
  receiveId: string;
  prefixTimestamp: boolean;
}): Promise<void> {
  try {
    console.log("🔧 Extension Preferencesへの書き込み開始...");
    
    // 方法1: 環境変数に設定
    process.env.LARK_DOMAIN = settings.larkDomain;
    process.env.LARK_APP_ID = settings.appId;
    process.env.LARK_APP_SECRET = settings.appSecret;
    process.env.LARK_RECEIVE_ID_TYPE = settings.receiveIdType;
    process.env.LARK_RECEIVE_ID = settings.receiveId;
    process.env.LARK_PREFIX_TIMESTAMP = settings.prefixTimestamp.toString();
    
    console.log("✅ 環境変数に設定を保存しました");
    
    // 方法2: Raycast設定ファイルへの書き込み試行
    try {
      const raycastConfigPath = join(environment.supportPath, "..", "..", "com.raycast.macos", "preferences");
      console.log("🔍 Raycast設定パス:", raycastConfigPath);
      
      if (existsSync(raycastConfigPath)) {
        console.log("📁 Raycast設定ディレクトリが見つかりました");
      }
    } catch (configError) {
      console.log("⚠️ Raycast設定ファイルアクセスは制限されています:", configError);
    }
    
    // 方法3: plist操作による設定書き込み
    try {
      const extensionId = "lark-quick-memo";
      const commands = [
        `defaults write com.raycast.macos "extensions.${extensionId}.larkDomain" "${settings.larkDomain}"`,
        `defaults write com.raycast.macos "extensions.${extensionId}.appId" "${settings.appId}"`,
        `defaults write com.raycast.macos "extensions.${extensionId}.appSecret" "${settings.appSecret}"`,
        `defaults write com.raycast.macos "extensions.${extensionId}.receiveIdType" "${settings.receiveIdType}"`,
        `defaults write com.raycast.macos "extensions.${extensionId}.receiveId" "${settings.receiveId}"`,
        `defaults write com.raycast.macos "extensions.${extensionId}.prefixTimestamp" -bool ${settings.prefixTimestamp}`
      ];
      
      for (const command of commands) {
        console.log("🔧 実行中:", command);
        execSync(command, { stdio: 'pipe' });
      }
      
      console.log("✅ defaults コマンドで設定を保存しました");
      
    } catch (plistError) {
      console.log("⚠️ plist操作でのエラー:", plistError);
    }
    
    // 方法4: Raycastの再読み込みを促す
    try {
      // Raycastに設定の再読み込みを通知
      execSync("killall -USR1 Raycast", { stdio: 'pipe' });
      console.log("🔄 Raycastに設定再読み込みを通知しました");
    } catch (reloadError) {
      console.log("⚠️ Raycast再読み込み通知エラー:", reloadError);
    }
    
  } catch (error) {
    console.error("❌ Extension Preferences書き込みエラー:", error);
    throw error;
  }
}

/**
 * Extension Preferencesから設定を読み込む
 */
export function readFromExtensionPreferences(): any {
  try {
    // 環境変数から読み込み
    return {
      larkDomain: process.env.LARK_DOMAIN || "",
      appId: process.env.LARK_APP_ID || "",
      appSecret: process.env.LARK_APP_SECRET || "",
      receiveIdType: process.env.LARK_RECEIVE_ID_TYPE || "email",
      receiveId: process.env.LARK_RECEIVE_ID || "",
      prefixTimestamp: process.env.LARK_PREFIX_TIMESTAMP === "true"
    };
  } catch (error) {
    console.error("Extension Preferences読み込みエラー:", error);
    return {};
  }
}