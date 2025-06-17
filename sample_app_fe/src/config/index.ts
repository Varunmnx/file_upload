export interface Config {
  readonly MODE: string;
}

const getConfigValue = <T>(key: string, defaultValue: T): T => {
  return import.meta.env[key] ? (import.meta.env[key] as T) : defaultValue;
};

export const BaseConfig: Config = {
  MODE: getConfigValue("VITE_MODE", "development"),
};

export const Config: Readonly<Config> = { ...BaseConfig };
