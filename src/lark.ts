import { getPreferenceValues } from "@raycast/api";

type Prefs = {
  larkDomain: string;
  appId: string;
  appSecret: string;
  receiveIdType: "email" | "open_id";
  receiveId: string;
  prefixTimestamp?: boolean;
};

export async function getTenantAccessToken(): Promise<string> {
  const { larkDomain, appId, appSecret } = getPreferenceValues<Prefs>();
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

export async function sendTextMessage(token: string, text: string) {
  const { larkDomain, receiveIdType, receiveId } = getPreferenceValues<Prefs>();
  if (!receiveId || !receiveIdType) throw new Error("Preferences未設定（receiveId/receiveIdType）");
  const url = `${larkDomain}/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`;
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