import { getPreferenceValues, LocalStorage } from "@raycast/api";

type Prefs = {
  larkDomain: string;
  appId: string;
  appSecret: string;
  receiveIdType: "email" | "open_id" | "chat_id";
  receiveId: string;
  prefixTimestamp?: boolean;
};

export type ChatInfo = {
  chat_id: string;
  name: string;
  description?: string;
  chat_type: "p2p" | "group" | "bot";
  avatar?: string;
  is_default?: boolean;
};

// Bot情報のキャッシュ用型
type CachedBotInfo = {
  botInfo: ChatInfo;
  appId: string;
  receiveId: string;
  timestamp: number;
};

// Bot情報をローカルストレージに保存
async function saveCachedBotInfo(
  botInfo: ChatInfo,
  appId: string,
  receiveId: string
): Promise<void> {
  const cacheKey = `cached-bot-info-${appId}-${receiveId}`;
  const cachedData: CachedBotInfo = {
    botInfo,
    appId,
    receiveId,
    timestamp: Date.now(),
  };
  await LocalStorage.setItem(cacheKey, JSON.stringify(cachedData));
  console.log(`💾 Bot情報をキャッシュに保存: ${botInfo.name} (${cacheKey})`);
}

// ローカルストレージからBot情報を取得
async function getCachedBotInfo(appId: string, receiveId: string): Promise<ChatInfo | null> {
  const cacheKey = `cached-bot-info-${appId}-${receiveId}`;
  try {
    const cachedDataStr = await LocalStorage.getItem<string>(cacheKey);
    if (!cachedDataStr) {
      return null;
    }

    const cachedData: CachedBotInfo = JSON.parse(cachedDataStr);

    // キャッシュの有効期限チェック（24時間）
    const cacheAge = Date.now() - cachedData.timestamp;
    const maxCacheAge = 24 * 60 * 60 * 1000; // 24時間

    if (cacheAge > maxCacheAge) {
      console.log(`⏰ Bot情報キャッシュが期限切れ: ${cacheKey}`);
      await LocalStorage.removeItem(cacheKey);
      return null;
    }

    // AppIDとreceiveIdが一致するかチェック
    if (cachedData.appId === appId && cachedData.receiveId === receiveId) {
      console.log(`📦 キャッシュからBot情報を取得: ${cachedData.botInfo.name} (${cacheKey})`);
      return cachedData.botInfo;
    }

    return null;
  } catch (error) {
    console.warn(`キャッシュ取得エラー: ${cacheKey}`, error);
    return null;
  }
}

export async function getTenantAccessToken(preferences?: Partial<Prefs>): Promise<string> {
  let larkDomain: string, appId: string, appSecret: string;

  if (preferences && preferences.larkDomain && preferences.appId && preferences.appSecret) {
    // 引数で渡された値を使用（テスト時など）
    ({ larkDomain, appId, appSecret } = preferences as Prefs);
  } else {
    // 通常のPreferencesから読み込み
    const prefs = getPreferenceValues<Prefs>();
    ({ larkDomain, appId, appSecret } = prefs);
  }

  if (!larkDomain || !appId || !appSecret) {
    throw new Error("Preferences未設定（larkDomain/appId/appSecret）");
  }
  const url = `${larkDomain}/open-apis/auth/v3/tenant_access_token/internal`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data: any = await res.json();
  if (!res.ok || (data && data.code)) {
    throw new Error(`tenant_access_token error: ${data?.code ?? res.status} ${data?.msg ?? ""}`);
  }
  return data.tenant_access_token as string;
}

export async function sendTextMessage(token: string, text: string, preferences?: Partial<Prefs>) {
  console.log("🔌 sendTextMessage called with:", { text, hasPreferences: !!preferences });

  let larkDomain: string, receiveIdType: string, receiveId: string;

  if (preferences && preferences.larkDomain && preferences.receiveIdType && preferences.receiveId) {
    // 引数で渡された値を使用
    ({ larkDomain, receiveIdType, receiveId } = preferences as Prefs);
  } else {
    // 通常のPreferencesから読み込み
    const prefs = getPreferenceValues<Prefs>();
    ({ larkDomain, receiveIdType, receiveId } = prefs);
  }
  if (!receiveId || !receiveIdType) throw new Error("Preferences未設定（receiveId/receiveIdType）");
  const url = `${larkDomain}/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`;

  console.log("📮 送信するテキスト内容:", text);
  console.log("🏷️ テキストの長さ:", text.length);

  const body = { receive_id: receiveId, msg_type: "text", content: JSON.stringify({ text }) };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: any = await res.json();
  if (!res.ok || (data && data.code)) {
    throw new Error(`send message error: ${data?.code ?? res.status} ${data?.msg ?? ""}`);
  }
  return data;
}

export async function uploadFile(
  token: string,
  fileData: string,
  fileName: string,
  fileType: string
): Promise<string> {
  console.log("📤 uploadFile called:", { fileName, fileType, dataLength: fileData.length });

  const larkDomain = getPreferenceValues<Prefs>().larkDomain;
  const isImage = fileType.startsWith("image/");
  const endpoint = isImage ? "/open-apis/im/v1/images" : "/open-apis/im/v1/files";
  const url = `${larkDomain}${endpoint}`;

  console.log("📤 Upload URL:", url, "| isImage:", isImage);

  try {
    // Base64データをBlobに変換
    const binaryString = atob(fileData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: fileType });

    console.log("📤 Blob created:", { size: blob.size, type: blob.type });

    // FormDataを作成
    const formData = new FormData();

    if (isImage) {
      // 画像の場合は /open-apis/im/v1/images エンドポイント用のパラメータ
      formData.append("image_type", "message");
      formData.append("image", blob, fileName);
    } else {
      // ファイルの場合は /open-apis/im/v1/files エンドポイント用のパラメータ
      // 試行1: 標準的なパラメータ名を使用
      formData.append("file_type", "stream");
      formData.append("file_name", fileName);
      formData.append("file", blob, fileName);
    }

    console.log("📤 FormData prepared for", isImage ? "image" : "file", "endpoint");
    console.log("📤 FormData details:");
    if (isImage) {
      console.log(`  image_type: message`);
      console.log(`  image: Blob (size: ${blob.size}, type: ${blob.type})`);
    } else {
      console.log(`  file_type: stream`);
      console.log(`  file_name: ${fileName}`);
      console.log(`  file: Blob (size: ${blob.size}, type: ${blob.type})`);
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Content-Typeは自動設定されるため明示的に設定しない
      },
      body: formData,
    });

    console.log("📤 Upload response status:", res.status);
    console.log("📤 Upload response headers:", {
      "content-type": res.headers.get("content-type"),
      "content-length": res.headers.get("content-length"),
    });

    const responseText = await res.text();
    console.log("📤 Upload response text:", responseText);

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("📤 JSON parse error:", parseError);
      throw new Error(`レスポンスのJSONパースに失敗: ${responseText}`);
    }

    console.log("📤 Upload response data:", data);

    if (!res.ok) {
      const errorMsg = `ファイルアップロードエラー: HTTP ${res.status} ${res.statusText} - ${data?.msg || responseText}`;
      console.error("📤 Upload HTTP error:", errorMsg);
      throw new Error(errorMsg);
    }

    if (data && data.code && data.code !== 0) {
      const errorMsg = `ファイルアップロードエラー: ${data.code} ${data.msg || ""}`;
      console.error("📤 Upload API error:", errorMsg);
      throw new Error(errorMsg);
    }

    // レスポンスからキーを取得（画像とファイルで異なる）
    let fileKey: string;

    if (isImage) {
      // 画像の場合は image_key を期待
      if (!data || !data.data || !data.data.image_key) {
        const errorMsg = `画像アップロード応答が不正: image_keyが見つかりません`;
        console.error("📤 Upload response error:", errorMsg);
        throw new Error(errorMsg);
      }
      fileKey = data.data.image_key;
      console.log("📤 Upload successful, image_key:", fileKey);
    } else {
      // ファイルの場合は file_key を期待
      if (!data || !data.data || !data.data.file_key) {
        const errorMsg = `ファイルアップロード応答が不正: file_keyが見つかりません`;
        console.error("📤 Upload response error:", errorMsg);
        throw new Error(errorMsg);
      }
      fileKey = data.data.file_key;
      console.log("📤 Upload successful, file_key:", fileKey);
    }

    return fileKey;
  } catch (error) {
    console.error("📤 Upload exception:", error);
    throw error;
  }
}

export async function sendFileMessage(
  token: string,
  fileKey: string,
  fileName: string,
  fileType: string,
  preferences?: Partial<Prefs>
) {
  console.log("📨 sendFileMessage called:", { fileKey, fileName, fileType });

  let larkDomain: string, receiveIdType: string, receiveId: string;

  if (preferences && preferences.larkDomain && preferences.receiveIdType && preferences.receiveId) {
    ({ larkDomain, receiveIdType, receiveId } = preferences as Prefs);
  } else {
    const prefs = getPreferenceValues<Prefs>();
    ({ larkDomain, receiveIdType, receiveId } = prefs);
  }

  if (!larkDomain || !receiveIdType || !receiveId) {
    throw new Error("Preferences未設定（larkDomain/receiveIdType/receiveId）");
  }

  console.log("📨 Send config:", { larkDomain, receiveIdType, receiveId });

  const url = `${larkDomain}/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`;
  console.log("📨 Send URL:", url);

  const messageType = fileType.startsWith("image/") ? "image" : "file";
  const content =
    messageType === "image"
      ? JSON.stringify({ image_key: fileKey })
      : JSON.stringify({ file_key: fileKey });

  console.log("📨 Message payload:", { messageType, content });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: messageType,
        content: content,
      }),
    });

    console.log("📨 Send response status:", res.status);

    const data: any = await res.json();
    console.log("📨 Send response data:", data);

    if (!res.ok || (data && data.code)) {
      const errorMsg = `ファイル送信エラー: ${data?.code ?? res.status} ${data?.msg ?? ""}`;
      console.error("📨 Send error:", errorMsg);
      throw new Error(errorMsg);
    }

    console.log("📨 File message sent successfully");
    return data;
  } catch (error) {
    console.error("📨 Send exception:", error);
    throw error;
  }
}

// Bot情報を取得する関数（キャッシュ機能付き）
export async function getBotInfo(
  token: string,
  preferences?: Partial<Prefs>
): Promise<ChatInfo | null> {
  console.log("🤖 getBotInfo called");

  let larkDomain: string, appId: string, receiveId: string;

  if (preferences && preferences.larkDomain && preferences.appId && preferences.receiveId) {
    ({ larkDomain, appId, receiveId } = preferences as Prefs);
  } else {
    const prefs = getPreferenceValues<Prefs>();
    ({ larkDomain, appId, receiveId } = prefs);
  }

  if (!larkDomain || !appId || !receiveId) {
    throw new Error("Preferences未設定（larkDomain, appId, receiveId）");
  }

  try {
    const url = `${larkDomain}/open-apis/bot/v3/info`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data: any = await res.json();
    if (!res.ok || (data && data.code)) {
      console.warn(`get bot info warning: ${data?.code ?? res.status} ${data?.msg ?? ""}`);
      return null;
    }

    const botInfo = data.data?.bot;
    if (botInfo) {
      const chatInfo: ChatInfo = {
        chat_id: `bot_${botInfo.open_id || "default"}`,
        name: `🤖 ${botInfo.app_name || "Bot"}`,
        description: "連携アプリのBot",
        chat_type: "bot" as const,
        avatar: botInfo.avatar_url,
        is_default: true,
      };

      // Bot情報をキャッシュに保存
      await saveCachedBotInfo(chatInfo, appId, receiveId);

      return chatInfo;
    }
  } catch (error) {
    console.warn("Bot情報の取得に失敗:", error);
  }

  return null;
}

// キャッシュされたBot情報を即座に取得する関数
export async function getCachedBotInfoForDisplay(
  preferences?: Partial<Prefs>
): Promise<ChatInfo | null> {
  let appId: string, receiveId: string;

  if (preferences && preferences.appId && preferences.receiveId) {
    ({ appId, receiveId } = preferences as Prefs);
  } else {
    const prefs = getPreferenceValues<Prefs>();
    ({ appId, receiveId } = prefs);
  }

  if (!appId || !receiveId) {
    return null;
  }

  return await getCachedBotInfo(appId, receiveId);
}

export async function getChatList(
  token: string,
  preferences?: Partial<Prefs>
): Promise<ChatInfo[]> {
  console.log("📋 getChatList called");

  let larkDomain: string;

  if (preferences && preferences.larkDomain) {
    ({ larkDomain } = preferences as Prefs);
  } else {
    const prefs = getPreferenceValues<Prefs>();
    ({ larkDomain } = prefs);
  }

  if (!larkDomain) {
    throw new Error("Preferences未設定（larkDomain）");
  }

  const chats: ChatInfo[] = [];

  // 1. 設定されたreceiveIdがある場合、まずキャッシュからBot情報を取得して即座に表示
  try {
    const prefs = preferences || getPreferenceValues<Prefs>();
    if (prefs.receiveId && prefs.receiveIdType) {
      console.log(`🔧 設定されたreceiveId: ${prefs.receiveId}, タイプ: ${prefs.receiveIdType}`);

      // まずキャッシュからBot情報を取得（即座に表示）
      const cachedBotInfo = await getCachedBotInfo(prefs.appId, prefs.receiveId);

      if (cachedBotInfo) {
        // キャッシュされたBot情報がある場合、即座に表示
        console.log(`⚡ キャッシュからBot情報を即座に表示: ${cachedBotInfo.name}`);
        const defaultBotChat: ChatInfo = {
          chat_id: prefs.receiveId, // 設定されたreceiveIdをそのまま使用
          name: "LarkCast", // 絵文字を削除、UIで表示時にアイコンを設定
          description: "設定で指定された送信先（デフォルト）",
          chat_type: "bot" as const,
          avatar: cachedBotInfo.avatar,
          is_default: true,
        };
        chats.push(defaultBotChat);
        console.log(
          `🤖 キャッシュからデフォルトBotを追加: ${defaultBotChat.name} (${defaultBotChat.chat_id})`
        );

        // バックグラウンドでBot情報を更新（非同期）
        (async () => {
          try {
            console.log(`🔄 バックグラウンドでBot情報を更新中...`);
            await getBotInfo(token, preferences);
            console.log(`✅ Bot情報のバックグラウンド更新完了`);
          } catch (error) {
            console.warn("バックグラウンドBot情報更新エラー:", error);
          }
        })();
      } else {
        // キャッシュがない場合、通常通りBot情報を取得
        console.log(`📡 キャッシュなし、Bot情報を取得中...`);
        const botInfo = await getBotInfo(token, preferences);
        console.log(`🤖 Bot情報取得結果:`, botInfo);

        if (botInfo && botInfo.name) {
          // Bot情報が取得できた場合、設定されたreceiveIdを使用してBot情報を作成
          console.log(`✅ Bot情報を使用: ${botInfo.name}`);
          const defaultBotChat: ChatInfo = {
            chat_id: prefs.receiveId, // 設定されたreceiveIdをそのまま使用
            name: "LarkCast", // 絵文字を削除、UIで表示時にアイコンを設定
            description: "設定で指定された送信先（デフォルト）",
            chat_type: "bot" as const,
            avatar: botInfo.avatar,
            is_default: true,
          };
          chats.push(defaultBotChat);
          console.log(`🤖 デフォルトBotを追加: ${defaultBotChat.name} (${defaultBotChat.chat_id})`);
        } else {
          // Bot情報が取得できない場合、LarkCastとして表示
          console.log(`⚠️ Bot情報取得失敗、フォールバック処理を実行`);
          const fallbackChat: ChatInfo = {
            chat_id: prefs.receiveId,
            name: "LarkCast", // 絵文字を削除、UIで表示時にアイコンを設定
            description: "設定で指定された送信先（デフォルト）",
            chat_type: "bot" as const, // フォールバックでもbotタイプに変更
            is_default: true,
          };
          chats.push(fallbackChat);
          console.log(`🤖 フォールバックBotを追加: ${fallbackChat.name} (${fallbackChat.chat_id})`);
        }
      }
    }
  } catch (error) {
    console.warn("デフォルト送信先の設定エラー:", error);
  }

  // 2. チャット一覧を取得（ページネーション対応）
  try {
    let pageToken = "";
    let hasMore = true;
    const maxPages = 5; // 最大5ページまで取得
    let currentPage = 0;

    while (hasMore && currentPage < maxPages) {
      const params = new URLSearchParams({
        page_size: "50", // 1ページあたり50件
        ...(pageToken && { page_token: pageToken }),
      });

      const url = `${larkDomain}/open-apis/im/v1/chats?${params}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data: any = await res.json();
      if (!res.ok || (data && data.code)) {
        console.warn(`get chat list warning: ${data?.code ?? res.status} ${data?.msg ?? ""}`);
        break;
      } else {
        // APIレスポンスからChatInfo形式に変換
        const apiChats: ChatInfo[] = (data.data?.items || []).map((chat: any) => ({
          chat_id: chat.chat_id,
          name: chat.name || chat.chat_id,
          description: chat.description,
          chat_type: chat.chat_type || "group", // デフォルトはgroup
          avatar: chat.avatar,
          is_default: false,
        }));

        // 重複を避けて追加（デフォルトBotとして既に追加されているものは除外）
        apiChats.forEach((apiChat) => {
          const existingChat = chats.find((chat) => chat.chat_id === apiChat.chat_id);
          if (!existingChat) {
            chats.push(apiChat);
          } else if (existingChat.is_default) {
            // デフォルトBotとして既に追加されている場合は、グループチャットとしては追加しない
            console.log(
              `🤖 デフォルトBotとして既に追加済み: ${existingChat.name} (${apiChat.chat_id})`
            );
          }
        });

        // 次のページがあるかチェック
        pageToken = data.data?.page_token || "";
        hasMore = data.data?.has_more || false;
        currentPage++;

        console.log(`📄 ページ ${currentPage}: ${apiChats.length}件のチャットを取得`);
      }
    }
  } catch (error) {
    console.warn("チャット一覧取得エラー:", error);
  }

  // 2.5. 個人チャット（P2P）の取得を試行
  try {
    // 個人チャット用のパラメータを試す
    const params = new URLSearchParams({
      page_size: "50",
      chat_type: "p2p", // 個人チャットのみ
    });

    const url = `${larkDomain}/open-apis/im/v1/chats?${params}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data: any = await res.json();
    if (res.ok && data && !data.code) {
      const p2pChats: ChatInfo[] = (data.data?.items || []).map((chat: any) => {
        // チャット名の改善：メールアドレスの場合は名前部分のみ表示
        let displayName = chat.name || chat.chat_id;
        if (!chat.name && chat.chat_id) {
          // メールアドレスの場合は@より前の部分を使用
          if (chat.chat_id.includes("@")) {
            const emailParts = chat.chat_id.split("@");
            displayName = emailParts[0];
          } else {
            displayName = chat.chat_id;
          }
        }

        return {
          chat_id: chat.chat_id,
          name: displayName,
          description: chat.description || "個人チャット",
          chat_type: "p2p" as const,
          avatar: chat.avatar,
          is_default: false,
        };
      });

      // 重複を避けて追加（デフォルトBotとして既に追加されているものは除外）
      p2pChats.forEach((p2pChat) => {
        const existingChat = chats.find((chat) => chat.chat_id === p2pChat.chat_id);
        if (!existingChat) {
          chats.push(p2pChat);
        } else if (existingChat.is_default) {
          // デフォルトBotとして既に追加されている場合は、P2Pチャットとしては追加しない
          console.log(
            `🤖 デフォルトBotとして既に追加済み: ${existingChat.name} (${p2pChat.chat_id})`
          );
        }
      });

      console.log(`👤 個人チャット: ${p2pChats.length}件を取得`);
    }
  } catch (error) {
    console.warn("個人チャット取得エラー:", error);
  }

  // 3. 重複チェック：設定されたreceiveIdが既に追加されているかチェック
  // （上記で既に処理済みなので、この処理は不要）

  console.log(`📋 取得したチャット数: ${chats.length}`);

  // ユーザーへの説明用ログ
  const defaultChats = chats.filter((chat) => chat.is_default);
  const groupChats = chats.filter((chat) => chat.chat_type === "group" && !chat.is_default);
  const p2pChats = chats.filter((chat) => chat.chat_type === "p2p" && !chat.is_default);

  console.log(`🤖 デフォルトBot: ${defaultChats.length}件`);
  console.log(`👥 グループチャット: ${groupChats.length}件`);
  console.log(`👤 個人チャット: ${p2pChats.length}件`);

  if (chats.length === 1 && defaultChats.length === 1) {
    console.log(
      "ℹ️ ボットが参加しているチャットのみ表示されます。他のチャットを表示するには、グループチャットにボットを追加してください。"
    );
  }

  return chats;
}

// メッセージ履歴を取得する関数
export async function getMessages(
  token: string,
  chatId: string,
  preferences?: Partial<Prefs>
): Promise<any[]> {
  let larkDomain: string;

  if (preferences && preferences.larkDomain) {
    ({ larkDomain } = preferences as Prefs);
  } else {
    const prefs = getPreferenceValues<Prefs>();
    ({ larkDomain } = prefs);
  }

  if (!larkDomain) {
    throw new Error("Preferences未設定（larkDomain）");
  }

  try {
    const params = new URLSearchParams({
      container_id_type: "chat_id",
      container_id: chatId,
      page_size: "10", // 最新10件を取得
    });

    const url = `${larkDomain}/open-apis/im/v1/messages?${params}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data: any = await res.json();
    if (!res.ok || (data && data.code)) {
      console.warn(`get messages warning: ${data?.code ?? res.status} ${data?.msg ?? ""}`);
      return [];
    }

    return data.data?.items || [];
  } catch (error) {
    console.warn("メッセージ取得エラー:", error);
    return [];
  }
}
