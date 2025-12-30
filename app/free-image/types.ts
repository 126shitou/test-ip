// 用户状态
export interface UserState {
  isLoggedIn: boolean;
  username: string | null;
  credits: number;
  loginTimestamp: number | null;
}

// IP 使用记录（访客）
export interface IPUsageState {
  ipUsageCount: number; // 0-2
  lastUsedDate: string; // ISO date
}

// 单张图片
export interface GeneratedImage {
  id: string;
  url: string;
  timestamp: number;
}

// 生成记录
export interface GenerationHistory {
  id: string;
  timestamp: number;
  mode: "fast" | "slow";
  images: GeneratedImage[];
  username: string | null; // 访客为 null
}

// API 请求（POST /api/image）
export interface ImageGenerationRequest {
  mode: "fast" | "slow";
  isLoggedIn: boolean;
  prompt?: string; // 用户输入的提示词
}

// API 响应（快速模式 - JSON）
export interface FastModeResponse {
  success: boolean;
  images: string[]; // Array of 4 image URLs
  error?: string;
}

// API 响应（慢速模式 - ReadableStream）
// Stream format: JSON lines, one per image
export interface SlowModeStreamChunk {
  index: number; // 0-3
  url: string;
  timestamp: number;
}

// 错误响应
export interface ErrorResponse {
  success: false;
  error: string;
}

// 默认值
export const DEFAULT_USER_STATE: UserState = {
  isLoggedIn: false,
  username: null,
  credits: 0,
  loginTimestamp: null,
};

export const DEFAULT_IP_USAGE: IPUsageState = {
  ipUsageCount: 0,
  lastUsedDate: new Date().toISOString().split("T")[0],
};
