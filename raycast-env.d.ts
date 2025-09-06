/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Lark Domain - Choose your Lark/Feishu environment */
  "larkDomain": "https://open.larksuite.com" | "https://open.feishu.cn",
  /** App ID - Your Lark app ID from developer console */
  "appId"?: string,
  /** App Secret - Your Lark app secret from developer console */
  "appSecret"?: string,
  /** Receive ID Type - Type of recipient identifier */
  "receiveIdType": "email" | "open_id",
  /** Receive ID - Your Lark login email or open_id */
  "receiveId"?: string,
  /** Prefix Timestamp - Add timestamp prefix to messages */
  "prefixTimestamp": boolean
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `quick-memo` command */
  export type QuickMemo = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `quick-memo` command */
  export type QuickMemo = {}
}

