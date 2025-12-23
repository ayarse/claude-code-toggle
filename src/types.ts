export interface Config {
  name: string;
  path: string;
}

type Action = "create" | "edit" | "delete" | "exit";

export type Choice =
  | { type: "config"; config: Config }
  | { type: "action"; action: Action };
