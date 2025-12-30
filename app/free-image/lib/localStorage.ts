import {
  UserState,
  IPUsageState,
  GenerationHistory,
  DEFAULT_USER_STATE,
  DEFAULT_IP_USAGE,
} from "../types";

// LocalStorage 键名
const KEYS = {
  USER_STATE: "free_image_user_state",
  IP_USAGE: "free_image_ip_usage",
  HISTORY: "free_image_history",
};

// 内存降级存储（当 localStorage 不可用时）
let memoryStorage: {
  userState: UserState;
  ipUsage: IPUsageState;
  history: GenerationHistory[];
} = {
  userState: DEFAULT_USER_STATE,
  ipUsage: DEFAULT_IP_USAGE,
  history: [],
};

// 检测 localStorage 是否可用
export function isLocalStorageAvailable(): boolean {
  try {
    const test = "__localStorage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

// 通用的读取函数
function getItem<T>(key: string, defaultValue: T): T {
  if (!isLocalStorageAvailable()) {
    // 使用内存存储
    if (key === KEYS.USER_STATE) return memoryStorage.userState as T;
    if (key === KEYS.IP_USAGE) return memoryStorage.ipUsage as T;
    if (key === KEYS.HISTORY) return memoryStorage.history as T;
    return defaultValue;
  }

  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch (e) {
    console.error(`Error reading from localStorage (${key}):`, e);
    return defaultValue;
  }
}

// 通用的写入函数
function setItem<T>(key: string, value: T): void {
  if (!isLocalStorageAvailable()) {
    // 使用内存存储
    if (key === KEYS.USER_STATE) memoryStorage.userState = value as UserState;
    if (key === KEYS.IP_USAGE) memoryStorage.ipUsage = value as IPUsageState;
    if (key === KEYS.HISTORY)
      memoryStorage.history = value as GenerationHistory[];
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // 处理 QuotaExceededError
    if ((e as Error).name === "QuotaExceededError") {
      console.warn("localStorage quota exceeded, clearing old history...");
      // 尝试清理历史记录
      if (key === KEYS.HISTORY) {
        const history = value as GenerationHistory[];
        const trimmedHistory = history.slice(0, 10); // 只保留最近 10 条
        try {
          localStorage.setItem(key, JSON.stringify(trimmedHistory));
        } catch (retryError) {
          console.error("Failed to save even after clearing:", retryError);
        }
      }
    } else {
      console.error(`Error writing to localStorage (${key}):`, e);
    }
  }
}

// ===== 用户状态 =====

export function getUserState(): UserState {
  return getItem(KEYS.USER_STATE, DEFAULT_USER_STATE);
}

export function setUserState(state: UserState): void {
  setItem(KEYS.USER_STATE, state);
}

// ===== IP 使用记录 =====

export function getIPUsage(): IPUsageState {
  const usage = getItem(KEYS.IP_USAGE, DEFAULT_IP_USAGE);

  // 检查日期是否过期（每天重置）
  const today = new Date().toISOString().split("T")[0];
  if (usage.lastUsedDate !== today) {
    const resetUsage: IPUsageState = {
      ipUsageCount: 0,
      lastUsedDate: today,
    };
    setIPUsage(resetUsage);
    return resetUsage;
  }

  return usage;
}

export function setIPUsage(usage: IPUsageState): void {
  setItem(KEYS.IP_USAGE, usage);
}

export function incrementIPUsage(): IPUsageState {
  const current = getIPUsage();
  const updated: IPUsageState = {
    ...current,
    ipUsageCount: current.ipUsageCount + 1,
  };
  setIPUsage(updated);
  return updated;
}

// ===== 生成历史 =====

export function getHistory(): GenerationHistory[] {
  return getItem(KEYS.HISTORY, []);
}

export function addHistory(record: GenerationHistory): void {
  const history = getHistory();
  const updated = [record, ...history].slice(0, 20); // 只保留最近 20 条
  setItem(KEYS.HISTORY, updated);
}

export function clearHistory(): void {
  setItem(KEYS.HISTORY, []);
}

// ===== 工具函数 =====

export function resetAllData(): void {
  setUserState(DEFAULT_USER_STATE);
  setIPUsage(DEFAULT_IP_USAGE);
  clearHistory();
}
