import {
  Action,
  ActionPanel,
  Form,
  showHUD,
  showToast,
  Toast,
  useNavigation,
  Detail,
  openExtensionPreferences,
  LocalStorage,
  Icon,
  popToRoot,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { readFileSync, statSync } from "fs";
import { basename, extname } from "path";
import { withExponentialBackoff } from "./utils";
import {
  getTenantAccessToken,
  sendTextMessage,
  getChatList,
  getBotInfo,
  ChatInfo,
  uploadFile,
  sendFileMessage,
  getMessages,
  getCachedBotInfoForDisplay,
} from "./lark";
import { isSetupComplete, getSetupStatus } from "./utils/setup-checker";
import { getEffectivePreferences, isEffectiveSetupComplete } from "./utils/preferences";
import OnboardingWizard from "./onboarding";
import SettingsManager from "./settings-manager";
import TemplateManager from "./template-manager";
import MessageHistoryManager from "./message-history";
import { Language, getTranslation } from "./locales/translations";
import { clearAllStoredData, showCurrentSettings } from "./utils/test-helpers";
import {
  MemoTemplate,
  getTemplates,
  getTemplateById,
  setSelectedTemplate,
  getSelectedTemplateId,
  replaceTemplateVariables,
} from "./utils/template-manager";
import { addMessageToHistory, getRecentChatOrder } from "./utils/message-history";
import {
  AttachedFile,
  formatFileSize,
  getMimeType,
  removeFileById,
  getTotalFileSize,
  getTotalSizeLimit,
  getFileIcon,
} from "./utils/file-attachment";
import { CustomChatManager, CustomChat } from "./custom-chats";
import AddCustomChat from "./add-custom-chat";
import ManageCustomChats from "./manage-custom-chats";
import ChatSetupGuide from "./chat-setup-guide";

export default function Command() {
  const { pop, push } = useNavigation();
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [language, setLanguage] = useState<Language>("ja");
  const [chatList, setChatList] = useState<ChatInfo[]>([]);
  const [customChats, setCustomChats] = useState<CustomChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [loadingChats, setLoadingChats] = useState(true); // 初期状態は読み込み中

  // テンプレート関連の状態
  const [templates, setTemplates] = useState<MemoTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateIdState] = useState<string>("");
  const [memoContent, setMemoContent] = useState<string>("");

  // ファイル添付関連の状態
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const t = getTranslation(language);

  // テンプレート一覧を読み込む関数
  const loadTemplates = async () => {
    try {
      const allTemplates = await getTemplates();
      setTemplates(allTemplates);

      // 前回選択されたテンプレートを復元
      const lastSelectedId = await getSelectedTemplateId();
      if (lastSelectedId) {
        setSelectedTemplateIdState(lastSelectedId);
        const template = allTemplates.find((t) => t.id === lastSelectedId);
        if (template) {
          setMemoContent(replaceTemplateVariables(template.content));
        }
      }
    } catch (error) {
      console.error("テンプレート読み込みエラー:", error);
    }
  };

  // テンプレート選択時の処理
  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateIdState(templateId);
    await setSelectedTemplate(templateId);

    if (templateId) {
      const template = await getTemplateById(templateId);
      if (template) {
        setMemoContent(replaceTemplateVariables(template.content));
      }
    } else {
      setMemoContent("");
    }
  };

  // ファイル添付ハンドラー（ネイティブファイルピッカー版）
  const handleAttachFiles = async (selectedFiles?: string[]) => {
    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }

    try {
      console.log("📎 Processing selected files:", selectedFiles);

      const newFiles: AttachedFile[] = [];

      for (const filePath of selectedFiles) {
        try {
          const stats = statSync(filePath);
          const fileName = basename(filePath);
          const fileExtension = extname(filePath).toLowerCase();
          const mimeType = getMimeType(filePath);

          // ファイルサイズチェック
          if (stats.size > 10 * 1024 * 1024) {
            // 10MB制限
            await showToast({
              style: Toast.Style.Failure,
              title: "ファイルサイズエラー",
              message: `${fileName} は10MBを超えています`,
            });
            continue;
          }

          // Base64エンコード
          const fileData = readFileSync(filePath);
          const base64Data = fileData.toString("base64");

          const attachedFile: AttachedFile = {
            id: `${Date.now()}-${Math.random()}`,
            name: fileName,
            path: filePath,
            size: stats.size,
            type: fileExtension,
            data: base64Data,
            mimeType: mimeType,
            lastModified: stats.mtime,
          };

          newFiles.push(attachedFile);
          console.log("📎 File processed:", { name: fileName, size: stats.size, type: mimeType });
        } catch (error) {
          console.error("📎 Error processing file:", filePath, error);
          await showToast({
            style: Toast.Style.Failure,
            title: "ファイル処理エラー",
            message: `${basename(filePath)} の処理に失敗しました`,
          });
        }
      }

      if (newFiles.length > 0) {
        const allFiles = [...attachedFiles, ...newFiles];
        const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);

        if (totalSize > 50 * 1024 * 1024) {
          // 50MB制限
          await showToast({
            style: Toast.Style.Failure,
            title: "合計サイズ制限エラー",
            message: "添付ファイルの合計サイズが50MBを超えています",
          });
          return;
        }

        setAttachedFiles(allFiles);
        await showToast({
          style: Toast.Style.Success,
          title: "ファイル添付完了",
          message: `${newFiles.length}個のファイルを添付しました`,
        });
      }
    } catch (error) {
      console.error("📎 File attachment error:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "ファイル添付エラー",
        message: String(error),
      });
    }
  };

  // ファイル削除ハンドラー
  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles((prev) => removeFileById(prev, fileId));
  };

  // 全ファイル削除ハンドラー
  const handleClearAllFiles = () => {
    setAttachedFiles([]);
  };

  // カスタムチャット一覧を読み込む関数
  const loadCustomChats = async () => {
    try {
      const chats = await CustomChatManager.getCustomChats();
      setCustomChats(chats);
      console.log(`✅ カスタムチャット一覧を読み込みました: ${chats.length}件`);
    } catch (error) {
      console.error("カスタムチャット読み込みエラー:", error);
    }
  };

  // チャット一覧を読み込む関数
  const loadChatList = async () => {
    try {
      setLoadingChats(true);
      const prefs = await getEffectivePreferences();

      // アクセストークンの取得
      let token: string;
      try {
        token = await getTenantAccessToken(prefs);
      } catch (tokenError) {
        console.error("アクセストークン取得エラー:", tokenError);
        await showToast({
          style: Toast.Style.Failure,
          title: "認証に失敗しました",
          message: "アプリ設定を確認してください",
        });
        return;
      }

      // チャット一覧の取得
      const chats = await getChatList(token, prefs);

      // 履歴順に並び替え（Botは最上部固定）
      const recentChatOrder = await getRecentChatOrder();
      const sortedChats = [...chats].sort((a, b) => {
        // Botは常に最上部
        if (a.chat_type === "bot" && b.chat_type !== "bot") return -1;
        if (b.chat_type === "bot" && a.chat_type !== "bot") return 1;
        if (a.chat_type === "bot" && b.chat_type === "bot") {
          // Bot同士の場合はデフォルトBotを優先
          if (a.is_default && !b.is_default) return -1;
          if (b.is_default && !a.is_default) return 1;
          return 0;
        }

        // Bot以外は履歴順
        const aIndex = recentChatOrder.indexOf(a.chat_id);
        const bIndex = recentChatOrder.indexOf(b.chat_id);

        // 両方とも履歴にある場合は履歴順
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }

        // 片方だけ履歴にある場合は履歴にある方を優先
        if (aIndex !== -1 && bIndex === -1) return -1;
        if (bIndex !== -1 && aIndex === -1) return 1;

        // 両方とも履歴にない場合は元の順序を維持
        return 0;
      });

      setChatList(sortedChats);

      if (chats.length === 0) {
        await showToast({
          style: Toast.Style.Failure,
          title: "利用可能なチャットがありません",
          message: "Larkでチャットを作成してから再試行してください",
        });
        return;
      }

      // ボットが参加しているチャットが少ない場合の説明
      const nonDefaultChats = chats.filter((chat) => !chat.is_default);
      if (nonDefaultChats.length === 0 && chats.length === 1) {
        await showToast({
          style: Toast.Style.Animated,
          title: "ℹ️ チャット一覧について",
          message:
            "ボットが参加しているチャットのみ表示されます。グループチャットにボットを追加してください。",
        });
      }

      // デフォルト選択の優先順位:
      // 1. デフォルトBot（設定されたreceiveId）
      // 2. 前回選択されたチャット（存在する場合）
      // 3. 最初のチャット
      const defaultBot = chats.find((chat) => chat.is_default);
      if (defaultBot) {
        setSelectedChatId(defaultBot.chat_id);
        console.log("🤖 デフォルトBotを選択:", defaultBot.name);
      } else {
        const lastSelectedChatId = await LocalStorage.getItem<string>("selected-chat-id");
        if (lastSelectedChatId && chats.some((chat) => chat.chat_id === lastSelectedChatId)) {
          setSelectedChatId(lastSelectedChatId);
          console.log("📝 前回選択されたチャットを選択:", lastSelectedChatId);
        } else if (chats.length > 0) {
          // 最初のチャットを選択
          setSelectedChatId(chats[0].chat_id);
          console.log("📋 最初のチャットを選択:", chats[0].name);
        }
      }

      console.log(`✅ チャット一覧を読み込みました: ${chats.length}件`);
    } catch (error) {
      console.error("チャット一覧読み込みエラー:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "チャット一覧の読み込みに失敗しました",
        message: error instanceof Error ? error.message : "不明なエラーが発生しました",
      });
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    const quickStart = async () => {
      try {
        const complete = await isEffectiveSetupComplete();
        setSetupComplete(complete);

        if (complete) {
          // 事前にデフォルトBotを選択（UIが表示される前に）
          const lastSelectedChatId = await LocalStorage.getItem<string>("selectedChatId");
          if (lastSelectedChatId) {
            setSelectedChatId(lastSelectedChatId);
            console.log("🚀 前回選択されたチャットを事前選択:", lastSelectedChatId);
          }

          // 超高速起動：設定から即座にデフォルトBot表示
          const prefs = await getEffectivePreferences();

          // 設定が完了している場合、即座にデフォルトBotを表示
          if (prefs.appId && prefs.receiveId) {
            console.log("⚡ 設定からデフォルトBot情報を即座に表示");

            // キャッシュされたBot情報を試行
            const cachedBotInfo = await getCachedBotInfoForDisplay(prefs);

            const instantBotChat: ChatInfo = {
              chat_id: prefs.receiveId,
              name: cachedBotInfo?.name || "FlashLarkPost",
              description: "設定で指定された送信先（デフォルト）",
              chat_type: "bot" as const,
              avatar: cachedBotInfo?.avatar,
              is_default: true,
            };

            setChatList([instantBotChat]);
            setSelectedChatId(instantBotChat.chat_id);
            setLoadingChats(false);
            console.log("🚀 即座表示完了 - ユーザーはすぐにメモ入力可能");

            // バックグラウンドで完全なチャット一覧を読み込み
            (async () => {
              try {
                console.log("🔄 バックグラウンドでチャット一覧を更新中...");

                // アクセストークンを取得
                let token: string;
                try {
                  token = await getTenantAccessToken(prefs);
                } catch (tokenError) {
                  console.error("バックグラウンドアクセストークン取得エラー:", tokenError);
                  return;
                }

                // チャット一覧、カスタムチャット、テンプレートを並列読み込み
                const [chats] = await Promise.all([
                  getChatList(token, prefs),
                  loadTemplates(),
                  loadCustomChats(),
                ]);

                // 履歴順に並び替え（Botは最上部固定）
                const recentChatOrder = await getRecentChatOrder();
                const sortedChats = [...chats].sort((a, b) => {
                  // Botは常に最上部
                  if (a.chat_type === "bot" && b.chat_type !== "bot") return -1;
                  if (b.chat_type === "bot" && a.chat_type !== "bot") return 1;
                  if (a.chat_type === "bot" && b.chat_type === "bot") {
                    // Bot同士の場合はデフォルトBotを優先
                    if (a.is_default && !b.is_default) return -1;
                    if (b.is_default && !a.is_default) return 1;
                    return 0;
                  }

                  // Bot以外は履歴順
                  const aIndex = recentChatOrder.indexOf(a.chat_id);
                  const bIndex = recentChatOrder.indexOf(b.chat_id);

                  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                  if (aIndex !== -1 && bIndex === -1) return -1;
                  if (bIndex !== -1 && aIndex === -1) return 1;
                  return 0;
                });

                setChatList(sortedChats);
                console.log(
                  `✅ バックグラウンド更新完了: ${sortedChats.length}件のチャットを読み込み`
                );
              } catch (error) {
                console.error("バックグラウンドチャット一覧更新エラー:", error);
              }
            })();

            return; // 即座表示が完了したので、通常の読み込み処理をスキップ
          }

          // 設定が不完全な場合は通常の読み込み処理を実行
          console.log("📡 設定不完全、通常の読み込み処理を実行");

          // アクセストークンを事前取得
          let token: string;
          try {
            token = await getTenantAccessToken(prefs);
          } catch (tokenError) {
            console.error("アクセストークン取得エラー:", tokenError);
            await showToast({
              style: Toast.Style.Failure,
              title: "認証に失敗しました",
              message: "アプリ設定を確認してください",
            });
            return;
          }

          // チャット一覧、カスタムチャット、テンプレートを並列読み込み（高速化）
          const [chats] = await Promise.all([
            getChatList(token, prefs),
            loadTemplates(),
            loadCustomChats(),
          ]);

          // 履歴順に並び替え（Botは最上部固定）
          const recentChatOrder = await getRecentChatOrder();
          const sortedChats = [...chats].sort((a, b) => {
            // Botは常に最上部
            if (a.chat_type === "bot" && b.chat_type !== "bot") return -1;
            if (b.chat_type === "bot" && a.chat_type !== "bot") return 1;
            if (a.chat_type === "bot" && b.chat_type === "bot") {
              // Bot同士の場合はデフォルトBotを優先
              if (a.is_default && !b.is_default) return -1;
              if (b.is_default && !a.is_default) return 1;
              return 0;
            }

            // Bot以外は履歴順
            const aIndex = recentChatOrder.indexOf(a.chat_id);
            const bIndex = recentChatOrder.indexOf(b.chat_id);

            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1 && bIndex === -1) return -1;
            if (bIndex !== -1 && aIndex === -1) return 1;
            return 0;
          });

          setChatList(sortedChats);
          setLoadingChats(false);

          // デフォルトBotを即座に選択（超クイック起動）
          const defaultBot = sortedChats.find((chat) => chat.is_default);
          if (defaultBot) {
            setSelectedChatId(defaultBot.chat_id);
            console.log("🚀 デフォルトBotを即座に選択:", defaultBot.name);
          } else if (sortedChats.length > 0) {
            // デフォルトBotがない場合は最初のチャットを選択
            setSelectedChatId(sortedChats[0].chat_id);
            console.log("📋 最初のチャットを選択:", sortedChats[0].name);
          }

          console.log(`🚀 超クイック起動完了: ${sortedChats.length}件のチャットを読み込み`);
        }
      } catch (error) {
        console.error("クイック起動エラー:", error);
        setSetupComplete(false);
        setLoadingChats(false);
      }
    };

    quickStart();
  }, []);

  const onSubmit = async (values: { memo: string; destination?: string }) => {
    try {
      console.log("📨 入力されたメッセージ:", values.memo);
      console.log("🎯 送信先:", values.destination || selectedChatId);
      console.log("📎 添付ファイル数:", attachedFiles.length);

      // 送信先が選択されているかチェック
      const targetChatId = values.destination || selectedChatId;
      if (!targetChatId) {
        await showToast({
          style: Toast.Style.Failure,
          title: "送信先を選択してください",
        });
        return;
      }

      // メッセージまたはファイルのいずれかが必要
      if (!values.memo.trim() && attachedFiles.length === 0) {
        await showToast({
          style: Toast.Style.Failure,
          title: "メッセージまたはファイルを入力してください",
        });
        return;
      }

      // カスタムチャットかどうかを確認
      const customChat = customChats.find((chat) => chat.id === targetChatId);

      if (customChat) {
        // カスタムチャットの場合
        console.log("⭐ カスタムチャット送信:", customChat.name);

        if (customChat.type === "webhook" && customChat.webhookUrl) {
          // Webhook URLを使用してメッセージを送信
          try {
            const response = await fetch(customChat.webhookUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                msg_type: "text",
                content: {
                  text: values.memo,
                },
              }),
            });

            if (!response.ok) {
              throw new Error(`Webhook送信失敗: ${response.status} ${response.statusText}`);
            }

            console.log("✅ Webhook送信完了");
          } catch (error) {
            console.error("❌ Webhook送信エラー:", error);
            await showToast({
              style: Toast.Style.Failure,
              title: "Webhook送信に失敗しました",
              message: String(error),
            });
            return;
          }
        } else {
          // 通常のカスタムチャット（Chat IDを使用）
          const prefs = await getEffectivePreferences();
          const token = await getTenantAccessToken(prefs);

          const targetPrefs = {
            ...prefs,
            receiveId: customChat.chatId || customChat.id,
            receiveIdType: "chat_id" as const,
          };

          // メッセージを送信
          if (values.memo.trim()) {
            await sendTextMessage(token, values.memo, targetPrefs);
          }

          // ファイルを送信（添付がある場合）
          for (const file of attachedFiles) {
            try {
              console.log("📎 カスタムチャット用ファイル送信中:", file.name);
              console.log("📎 ファイル詳細:", {
                name: file.name,
                size: file.size,
                mimeType: file.mimeType,
                hasData: !!file.data,
                dataLength: file.data?.length || 0,
              });

              if (!file.data) {
                throw new Error(`ファイルデータが見つかりません: ${file.name}`);
              }

              const mimeType = file.mimeType || getMimeType(file.path);
              console.log("📎 使用するMIMEタイプ:", mimeType);

              const fileKey = await uploadFile(token, file.data, file.name, mimeType);
              console.log("📎 アップロード完了、fileKey:", fileKey);

              await sendFileMessage(token, fileKey, file.name, mimeType, targetPrefs);
              console.log("✅ カスタムチャット用ファイル送信完了:", file.name);
            } catch (error) {
              console.error("❌ カスタムチャット用ファイル送信エラー:", file.name, error);
              await showToast({
                style: Toast.Style.Failure,
                title: `${file.name}の送信に失敗しました`,
                message: String(error),
              });
              // ファイル送信エラーでも他のファイルの送信は続行
            }
          }
        }

        // 送信成功をメッセージ履歴に記録
        const messageContent = values.memo.trim()
          ? values.memo
          : `📎 ${attachedFiles.length}個のファイル`;

        await addMessageToHistory(messageContent, targetChatId, customChat.name, true);

        // 状態をリセット
        setMemoContent("");
        setAttachedFiles([]);

        // ウィンドウを即座に閉じる
        pop();

        // ウィンドウを閉じてから美しい緑色の送信完了通知を表示
        setTimeout(async () => {
          await showToast({
            style: Toast.Style.Success,
            title: "🎉 送信完了！",
            message: `✨ ${customChat.name}に送信しました`,
          });
        }, 100);

        return;
      }

      // 通常のチャット処理（既存のコード）
      // 有効な設定を取得
      const prefs = await getEffectivePreferences();

      // 選択されたチャットがBotかどうかを確認
      const selectedChat = chatList.find((chat) => chat.chat_id === targetChatId);
      const isBotChat = selectedChat?.is_default === true || selectedChat?.chat_type === "bot";

      console.log("🤖 Bot判定:", {
        chatId: targetChatId,
        chatName: selectedChat?.name,
        chatType: selectedChat?.chat_type,
        isDefault: selectedChat?.is_default,
        isBotChat: isBotChat,
      });

      // 送信中トーストを表示
      const sendingToast = await showToast({
        style: Toast.Style.Animated,
        title: "📤 送信中...",
        message: `${selectedChat?.name || "チャット"}に送信しています`,
      });

      // アクセストークンを取得
      const token = await getTenantAccessToken(prefs);

      // 送信先の設定を準備
      let targetPrefs;
      if (isBotChat && selectedChat?.is_default) {
        // デフォルトBotの場合は、設定で指定されたreceiveIdとreceiveIdTypeを使用
        targetPrefs = prefs;
        console.log("🤖 デフォルトBot送信設定:", {
          receiveId: prefs.receiveId,
          receiveIdType: prefs.receiveIdType,
        });
      } else {
        // 通常のチャットの場合はchat_idを使用
        targetPrefs = {
          ...prefs,
          receiveId: targetChatId,
          receiveIdType: "chat_id" as const,
        };
        console.log("💬 通常チャット送信設定:", {
          receiveId: targetChatId,
          receiveIdType: "chat_id",
        });
      }

      // メッセージを送信（テキストがある場合）
      if (values.memo.trim()) {
        const message = values.memo;
        console.log("📝 テキストメッセージ送信:", message);
        await withExponentialBackoff(() => sendTextMessage(token, message, targetPrefs), {
          retries: 1,
          baseMs: 500,
        });
      }

      // ファイルを送信（添付がある場合）
      for (const file of attachedFiles) {
        try {
          console.log("📎 ファイル送信中:", file.name);
          console.log("📎 ファイル詳細:", {
            name: file.name,
            size: file.size,
            mimeType: file.mimeType,
            hasData: !!file.data,
            dataLength: file.data?.length || 0,
          });

          if (!file.data) {
            throw new Error(`ファイルデータが見つかりません: ${file.name}`);
          }

          const mimeType = file.mimeType || getMimeType(file.path);
          console.log("📎 使用するMIMEタイプ:", mimeType);

          const fileKey = await uploadFile(token, file.data, file.name, mimeType);
          console.log("📎 アップロード完了、fileKey:", fileKey);

          await sendFileMessage(token, fileKey, file.name, mimeType, targetPrefs);
          console.log("✅ ファイル送信完了:", file.name);
        } catch (error) {
          console.error("❌ ファイル送信エラー:", file.name, error);
          await showToast({
            style: Toast.Style.Failure,
            title: `${file.name}の送信に失敗しました`,
            message: String(error),
          });
          // ファイル送信エラーでも他のファイルの送信は続行
        }
      }

      // 選択されたチャットを保存
      await LocalStorage.setItem("selected-chat-id", targetChatId);

      // 送信成功をメッセージ履歴に記録
      const targetChat = chatList.find((chat) => chat.chat_id === targetChatId);
      const messageContent = values.memo.trim()
        ? values.memo
        : `📎 ${attachedFiles.length}個のファイル`;

      await addMessageToHistory(
        messageContent,
        targetChatId,
        targetChat?.name || "不明なチャット",
        true
      );

      // 送信中トーストを隠す
      sendingToast.hide();

      // Bot名を正しく取得して表示
      let displayName = targetChat?.name || "チャット";
      if (isBotChat && selectedChat?.is_default) {
        // デフォルトBotの場合、最新のBot情報を取得
        try {
          const botInfo = await getBotInfo(token, targetPrefs);
          if (botInfo && botInfo.name) {
            displayName = botInfo.name;
          }
        } catch (error) {
          console.warn("Bot名取得エラー:", error);
        }
      }

      // 状態をリセット
      setMemoContent("");
      setAttachedFiles([]);

      // ウィンドウを即座に閉じる
      pop();

      // ウィンドウを閉じてから美しい緑色の送信完了通知を表示
      setTimeout(async () => {
        await showToast({
          style: Toast.Style.Success,
          title: "🎉 送信完了！",
          message: `✨ ${displayName}に送信しました`,
        });
      }, 100); // ウィンドウが閉じるのを待ってから表示

      // Bot通知機能：Botチャットの場合は応答を非同期で待機（バックグラウンドで実行）
      if (isBotChat) {
        // 非同期でBot応答を待機（UIをブロックしない）
        (async () => {
          try {
            console.log("🤖 Bot応答を待機中...");

            // 送信前のメッセージ数を記録
            const messagesBefore = await getMessages(token, targetChatId, targetPrefs);
            const messageCountBefore = messagesBefore.length;

            // 最大10秒間Bot応答を待機
            const maxWaitTime = 10000; // 10秒
            const checkInterval = 1000; // 1秒間隔
            let waitTime = 0;

            while (waitTime < maxWaitTime) {
              await new Promise((resolve) => setTimeout(resolve, checkInterval));
              waitTime += checkInterval;

              try {
                const messagesAfter = await getMessages(token, targetChatId, targetPrefs);
                if (messagesAfter.length > messageCountBefore) {
                  // 新しいメッセージがある場合
                  const newMessages = messagesAfter.slice(messageCountBefore);
                  const latestMessage = newMessages[newMessages.length - 1];

                  if (
                    latestMessage &&
                    latestMessage.sender &&
                    latestMessage.sender.sender_type === "app"
                  ) {
                    // Botからの応答
                    const responseText = latestMessage.body?.content?.text || "応答を受信しました";
                    const shortText =
                      responseText.length > 50
                        ? responseText.substring(0, 50) + "..."
                        : responseText;

                    await showHUD(`🤖 ${shortText}`);
                    console.log("✅ Bot応答を受信:", responseText);
                    break;
                  }
                }
              } catch (error) {
                console.warn("Bot応答チェックエラー:", error);
                break;
              }
            }
          } catch (error) {
            console.warn("Bot通知エラー:", error);
            // エラーの場合も通知しない（バックグラウンド処理のため）
          }
        })();
      }
    } catch (e: any) {
      // 送信失敗をメッセージ履歴に記録
      const targetChatId = values.destination || selectedChatId;
      const targetChat =
        chatList.find((chat) => chat.chat_id === targetChatId) ||
        customChats.find((chat) => chat.id === targetChatId);
      const messageContent = values.memo.trim()
        ? values.memo
        : `📎 ${attachedFiles.length}個のファイル`;

      await addMessageToHistory(
        messageContent,
        targetChatId,
        targetChat?.name || "不明なチャット",
        false,
        e?.message ?? t.unknownError
      );

      await showHUD(`${t.sendFailed}：${e?.message ?? t.unknownError}`);
      console.error(e);
    }
  };

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
                await popToRoot();
              }}
            />
            <Action title="📊 設定確認" onAction={showCurrentSettings} />
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

${status.missingFields.map((field) => `- **${field}**`).join("\n")}

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
            <Action title={t.guidedSetup} onAction={() => setShowOnboarding(true)} icon="🚀" />
            <Action title={t.manualSetup} onAction={() => openExtensionPreferences()} icon="⚙️" />
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
          <Action
            title="📝 テンプレート管理"
            icon={Icon.Document}
            onAction={() => push(<TemplateManager />)}
            shortcut={{ modifiers: ["cmd"], key: "t" }}
          />
          <Action
            title="📜 メッセージ履歴"
            icon={Icon.List}
            onAction={() => push(<MessageHistoryManager />)}
            shortcut={{ modifiers: ["cmd"], key: "h" }}
          />
          <Action
            title="⭐ カスタムチャット追加"
            icon={Icon.Plus}
            onAction={() => push(<AddCustomChat onSave={loadCustomChats} />)}
            shortcut={{ modifiers: ["cmd"], key: "a" }}
          />
          <Action
            title="⚙️ カスタムチャット管理"
            icon={Icon.Gear}
            onAction={() => push(<ManageCustomChats />)}
            shortcut={{ modifiers: ["cmd"], key: "m" }}
          />
          <Action
            title="📋 チャット追加ガイド"
            icon={Icon.QuestionMark}
            onAction={() => push(<ChatSetupGuide />)}
            shortcut={{ modifiers: ["cmd"], key: "g" }}
          />
          <Action
            title="ファイル添付"
            icon={Icon.Paperclip}
            onAction={handleAttachFiles}
            shortcut={{ modifiers: ["cmd"], key: "f" }}
          />
          <Action
            title="ℹ️ チャット一覧について"
            icon={Icon.Info}
            onAction={() =>
              showHUD(
                "ボットが参加しているチャットのみ表示されます。他のチャットを表示するには、グループチャットにボットを追加してください。"
              )
            }
            shortcut={{ modifiers: ["cmd"], key: "i" }}
          />
          {attachedFiles.length > 0 && (
            <>
              <ActionPanel.Submenu title="🗑️ ファイル削除" icon={Icon.Trash}>
                <Action
                  title="全ファイル削除"
                  icon={Icon.Trash}
                  onAction={handleClearAllFiles}
                  style={Action.Style.Destructive}
                />
                <ActionPanel.Section title="個別削除">
                  {attachedFiles.map((file, index) => (
                    <Action
                      key={file.id}
                      title={`${index + 1}. ${file.name}`}
                      icon={getFileIcon(file)}
                      onAction={() => handleRemoveFile(file.id)}
                      style={Action.Style.Destructive}
                    />
                  ))}
                </ActionPanel.Section>
              </ActionPanel.Submenu>
            </>
          )}
          <Action
            title="🔄 チャット一覧を更新"
            icon={Icon.ArrowClockwise}
            onAction={loadChatList}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
          <Action
            title={`⚙️ ${t.linkSettings}`}
            icon={Icon.Gear}
            onAction={() => push(<SettingsManager />)}
            shortcut={{ modifiers: ["cmd"], key: "," }}
          />
          <Action title={t.changeSettings} onAction={() => openExtensionPreferences()} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="template"
        title="📋 テンプレート"
        placeholder="テンプレートを選択（任意）"
        value={selectedTemplateId}
        onChange={handleTemplateChange}
      >
        <Form.Dropdown.Item value="" title="テンプレートなし" />
        {templates.map((template) => (
          <Form.Dropdown.Item
            key={template.id}
            value={template.id}
            title={template.name}
            icon={template.isPreset ? "🔧" : "📝"}
          />
        ))}
      </Form.Dropdown>

      <Form.Dropdown
        id="destination"
        title="📤 送信先"
        placeholder={
          loadingChats
            ? "📡 チャット一覧を読み込み中..."
            : chatList.length > 0
              ? `📤 送信先を選択 (${chatList.length}件)`
              : "送信先を選択"
        }
        value={selectedChatId}
        onChange={(value) => setSelectedChatId(value)}
        isLoading={loadingChats}
        filtering={true}
        searchBarPlaceholder="チャット名で検索..."
        info="ボット参加チャットのみ"
      >
        {/* デフォルトBot */}
        {chatList
          .filter((chat) => chat.is_default)
          .map((chat) => (
            <Form.Dropdown.Item
              key={chat.chat_id}
              value={chat.chat_id}
              title="FlashLarkPost"
              icon="🤖"
            />
          ))}

        {/* セパレーター（デフォルトBotがある場合のみ） */}
        {chatList.some((chat) => chat.is_default) && chatList.some((chat) => !chat.is_default) && (
          <Form.Dropdown.Section title="──────────────" />
        )}

        {/* カスタムチャット */}
        {(() => {
          return (
            customChats.length > 0 && (
              <Form.Dropdown.Section title={`⭐ カスタムチャット (${customChats.length}件)`}>
                {customChats.map((chat) => (
                  <Form.Dropdown.Item
                    key={chat.id}
                    value={chat.id}
                    title={chat.name}
                    icon={chat.type === "group" ? "👥" : chat.type === "personal" ? "👤" : "🔗"}
                  />
                ))}
              </Form.Dropdown.Section>
            )
          );
        })()}

        {/* Bot チャット */}
        {(() => {
          const botChats = chatList.filter((chat) => !chat.is_default && chat.chat_type === "bot");
          return (
            botChats.length > 0 && (
              <Form.Dropdown.Section title={`🤖 Bot (${botChats.length}件)`}>
                {botChats.map((chat) => (
                  <Form.Dropdown.Item
                    key={chat.chat_id}
                    value={chat.chat_id}
                    title={chat.name}
                    icon="🤖"
                  />
                ))}
              </Form.Dropdown.Section>
            )
          );
        })()}

        {/* グループチャット */}
        {(() => {
          const groupChats = chatList.filter(
            (chat) => !chat.is_default && chat.chat_type === "group"
          );
          return (
            groupChats.length > 0 && (
              <Form.Dropdown.Section title={`👥 グループチャット (${groupChats.length}件)`}>
                {groupChats.map((chat) => (
                  <Form.Dropdown.Item
                    key={chat.chat_id}
                    value={chat.chat_id}
                    title={chat.name}
                    icon="👥"
                  />
                ))}
              </Form.Dropdown.Section>
            )
          );
        })()}

        {/* 個人チャット */}
        {(() => {
          const p2pChats = chatList.filter((chat) => !chat.is_default && chat.chat_type === "p2p");
          return (
            p2pChats.length > 0 && (
              <Form.Dropdown.Section title={`👤 個人チャット (${p2pChats.length}件)`}>
                {p2pChats.map((chat) => (
                  <Form.Dropdown.Item
                    key={chat.chat_id}
                    value={chat.chat_id}
                    title={chat.name}
                    icon="👤"
                  />
                ))}
              </Form.Dropdown.Section>
            )
          );
        })()}

        {/* その他のチャット */}
        {(() => {
          const otherChats = chatList.filter(
            (chat) => !chat.is_default && !["bot", "group", "p2p"].includes(chat.chat_type)
          );
          return (
            otherChats.length > 0 && (
              <Form.Dropdown.Section title={`💬 その他のチャット (${otherChats.length}件)`}>
                {otherChats.map((chat) => (
                  <Form.Dropdown.Item
                    key={chat.chat_id}
                    value={chat.chat_id}
                    title={chat.name}
                    icon="💬"
                  />
                ))}
              </Form.Dropdown.Section>
            )
          );
        })()}
      </Form.Dropdown>

      <Form.TextArea
        id="memo"
        title={t.memoTitle}
        placeholder="メッセージを入力…"
        value={memoContent}
        onChange={setMemoContent}
        autoFocus
      />

      <Form.FilePicker
        id="filePicker"
        title="📎 ファイル添付"
        allowMultipleSelection={true}
        canChooseDirectories={false}
        canChooseFiles={true}
        onChange={(files) => {
          console.log("FilePicker onChange called with files:", files);
          if (files && files.length > 0) {
            handleAttachFiles(files);
          }
        }}
      />

      <Form.Separator />

      {attachedFiles.length > 0 && (
        <>
          <Form.Description
            title="📎 添付ファイル"
            text={`${attachedFiles.length}個のファイル (合計: ${formatFileSize(getTotalFileSize(attachedFiles))} / ${formatFileSize(getTotalSizeLimit())})`}
          />
          {attachedFiles.map((file, index) => (
            <Form.Description
              key={file.id}
              title={`${index + 1}. ${getFileIcon(file)} ${file.name}`}
              text={`サイズ: ${formatFileSize(file.size)}${file.mimeType ? ` | タイプ: ${file.mimeType}` : ""}${file.lastModified ? ` | 更新: ${file.lastModified.toLocaleDateString()}` : ""}`}
            />
          ))}
          <Form.Separator />
        </>
      )}
    </Form>
  );
}
