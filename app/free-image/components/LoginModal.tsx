import { useState } from "react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (username: string) => void;
}

export default function LoginModal({
  isOpen,
  onClose,
  onLogin,
}: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 验证用户名
    if (!username.trim()) {
      setError("请输入用户名");
      return;
    }

    if (username.trim().length < 2) {
      setError("用户名至少需要 2 个字符");
      return;
    }

    // 登录成功
    onLogin(username.trim());
    setUsername("");
    setError("");
  };

  const handleClose = () => {
    setUsername("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* 模态框内容 */}
      <div className="relative w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800 shadow-2xl">
          {/* 头部 */}
          <div className="border-b border-slate-700/50 bg-slate-800/80 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-100">
                登录继续使用
              </h2>
              <button
                onClick={handleClose}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-6">
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                用户名
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                placeholder="输入您的昵称"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                autoFocus
              />
              {error && (
                <div className="mt-2 text-sm text-red-400">{error}</div>
              )}
            </div>

            {/* 提示信息 */}
            <div className="mb-6 rounded-lg bg-emerald-500/10 p-4">
              <div className="mb-2 flex items-center gap-2 font-medium text-emerald-400">
                <span>🎁</span>
                <span>登录福利</span>
              </div>
              <ul className="space-y-1 text-sm text-slate-300">
                <li>• 赠送 10 积分</li>
                <li>• 解锁快速生成模式</li>
                <li>• 保存生成历史记录</li>
              </ul>
            </div>

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-lg bg-slate-700 px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-600"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 font-semibold text-white shadow-lg transition-all hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-500/20"
              >
                登录
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
