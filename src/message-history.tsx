import {
  List,
  Action,
  ActionPanel,
  Icon,
  Color,
  showToast,
  Toast,
  Alert,
  confirmAlert,
  Clipboard,
  useNavigation,
} from "@raycast/api";
import { useState, useEffect } from "react";
import {
  MessageHistory,
  getMessageHistory,
  deleteMessageFromHistory,
  clearMessageHistory,
  searchMessageHistory,
  getHistoryStats,
} from "./utils/message-history";

export default function MessageHistoryManager() {
  const { pop } = useNavigation();
  const [history, setHistory] = useState<MessageHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    lastWeek: 0,
  });

  // 履歴を読み込む
  const loadHistory = async () => {
    try {
      setLoading(true);
      const [historyData, statsData] = await Promise.all([
        searchText ? searchMessageHistory(searchText) : getMessageHistory(),
        getHistoryStats(),
      ]);
      setHistory(historyData);
      setStats(statsData);
    } catch (error) {
      console.error("履歴読み込みエラー:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "履歴の読み込みに失敗しました",
      });
    } finally {
      setLoading(false);
    }
  };

  // 履歴項目を削除
  const deleteMessage = async (id: string) => {
    const confirmed = await confirmAlert({
      title: "メッセージを削除",
      message: "この履歴項目を削除しますか？",
      primaryAction: {
        title: "削除",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (confirmed) {
      await deleteMessageFromHistory(id);
      await loadHistory();
      await showToast({
        style: Toast.Style.Success,
        title: "履歴項目を削除しました",
      });
    }
  };

  // 全履歴をクリア
  const clearAllHistory = async () => {
    const confirmed = await confirmAlert({
      title: "全履歴を削除",
      message: "すべてのメッセージ履歴を削除しますか？この操作は取り消せません。",
      primaryAction: {
        title: "全削除",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (confirmed) {
      await clearMessageHistory();
      await loadHistory();
      await showToast({
        style: Toast.Style.Success,
        title: "全履歴を削除しました",
      });
    }
  };

  // メッセージをクリップボードにコピー
  const copyMessage = async (content: string) => {
    await Clipboard.copy(content);
    await showToast({
      style: Toast.Style.Success,
      title: "メッセージをコピーしました",
    });
  };

  // 検索テキストが変更されたときの処理
  const handleSearchTextChange = (text: string) => {
    setSearchText(text);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadHistory();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchText]);

  // 日時をフォーマット
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (days === 1) {
      return "昨日";
    } else if (days < 7) {
      return `${days}日前`;
    } else {
      return date.toLocaleDateString("ja-JP", {
        month: "short",
        day: "numeric",
      });
    }
  };

  // メッセージ内容を短縮
  const truncateMessage = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  return (
    <List
      isLoading={loading}
      searchText={searchText}
      onSearchTextChange={handleSearchTextChange}
      searchBarPlaceholder="メッセージ履歴を検索..."
      navigationTitle="📜 メッセージ履歴"
    >
      <List.Section
        title={`統計情報 (総数: ${stats.total}, 成功: ${stats.successful}, 失敗: ${stats.failed}, 今週: ${stats.lastWeek})`}
      >
        {history.length === 0 && !loading && (
          <List.EmptyView
            title={searchText ? "検索結果が見つかりません" : "メッセージ履歴がありません"}
            description={
              searchText
                ? "別のキーワードで検索してみてください"
                : "メッセージを送信すると履歴が表示されます"
            }
            icon={Icon.Message}
          />
        )}

        {history.map((message) => (
          <List.Item
            key={message.id}
            title={truncateMessage(message.content)}
            subtitle={`→ ${message.destinationName}`}
            accessories={[
              {
                text: formatDate(message.timestamp),
                icon: message.success
                  ? { source: Icon.CheckCircle, tintColor: Color.Green }
                  : { source: Icon.XMarkCircle, tintColor: Color.Red },
              },
            ]}
            actions={
              <ActionPanel>
                <Action
                  title="メッセージをコピー"
                  icon={Icon.Clipboard}
                  onAction={() => copyMessage(message.content)}
                />
                <Action
                  title="再送信用にコピー"
                  icon={Icon.ArrowClockwise}
                  onAction={() => {
                    copyMessage(message.content);
                    pop();
                  }}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                />
                <Action
                  title="削除"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={() => deleteMessage(message.id)}
                  shortcut={{ modifiers: ["cmd"], key: "delete" }}
                />
                <Action
                  title="全履歴を削除"
                  icon={Icon.ExclamationMark}
                  style={Action.Style.Destructive}
                  onAction={clearAllHistory}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }}
                />
                <Action
                  title="履歴を更新"
                  icon={Icon.ArrowClockwise}
                  onAction={loadHistory}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
