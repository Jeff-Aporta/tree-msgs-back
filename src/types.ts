export type Env = {
  PUBLIC_BASE: string;
  TREE_MSGS_DATABASE_URL: string;
  LAB_JWT_SECRET: string;
  SYSTEM_LOGIN_URL?: string;
  SYSTEM_LOGIN_SVC?: Fetcher;
};

export type MessageJlog = {
  author?: string;
  kind?: "message" | "reply" | "quote";
  replyToPath?: string | null;
  quotePath?: string | null;
  [key: string]: unknown;
};

export type TreeMessageDto = {
  appId: string;
  contextKey: string;
  treePath: string;
  body: string;
  jlog: MessageJlog;
  active: boolean;
  archived: boolean;
  createdAt: unknown;
  updatedAt: unknown;
};
