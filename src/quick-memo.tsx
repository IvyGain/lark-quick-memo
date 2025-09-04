import { Action, ActionPanel, Form, showHUD, getPreferenceValues, useNavigation } from "@raycast/api";
import { decorateWithTimestamp, withExponentialBackoff } from "./utils";
import { getTenantAccessToken, sendTextMessage } from "./lark";

type Prefs = {
  prefixTimestamp?: boolean;
};

export default function Command() {
  const { pop } = useNavigation();

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

  return (
    <Form actions={<ActionPanel><Action.SubmitForm title="送信" onSubmit={onSubmit} /></ActionPanel>}>
      <Form.TextArea id="memo" title="メモ" placeholder="送る内容…" autoFocus />
    </Form>
  );
}