export interface Config {
  readonly API_URL: string;
  readonly MODE: string;
}

const getConfigValue = <T>(key: string, defaultValue: T): T => {
  return import.meta.env[key] ? (import.meta.env[key] as T) : defaultValue;
};

export const BaseConfig: Config = {
  API_URL: getConfigValue("VITE_API_URL", "http://localhost:3000"),
  MODE: getConfigValue("VITE_MODE", "development"),
};

export const Config: Readonly<Config> = { ...BaseConfig };
