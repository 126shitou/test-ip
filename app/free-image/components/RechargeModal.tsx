import { useState } from "react";

interface RechargeModalProps {
  isOpen: boolean;
  currentCredits: number;
  onClose: () => void;
  onSwitchToSlow: () => void;
}

export default function RechargeModal({
  isOpen,
  currentCredits,
  onClose,
  onSwitchToSlow,
}: RechargeModalProps) {
  const [showToast, setShowToast] = useState(false);

  if (!isOpen) return null;

  const handleRecharge = () => {
    // 显示"功能开发中" Toast
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  const handleSwitchToSlow = () => {
    onSwitchToSlow();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* 遮罩层 */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* 模态框内容 */}
        <div className="relative w-full max-w-md">
          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800 shadow-2xl">
            {/* 头部 */}
            <div className="border-b border-slate-700/50 bg-slate-800/80 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-100">
                  积分不足
                </h2>
                <button
                  onClick={onClose}
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

            {/* 内容 */}
            <div className="p-6">
              {/* 警告信息 */}
              <div className="mb-6 rounded-lg bg-amber-500/10 p-4">
                <div className="mb-2 flex items-center gap-2 text-lg font-medium text-amber-400">
                  <span>⚠️</span>
                  <span>积分余额不足</span>
                </div>
                <div className="text-sm text-slate-300">
                  快速模式需要 <span className="font-bold text-amber-400">4 积分</span>，
                  您当前仅有 <span className="font-bold text-amber-400">{currentCredits} 积分</span>
                </div>
              </div>

              {/* 选项卡片 */}
              <div className="space-y-3">
                {/* 选项 1: 充值积分 */}
                <button
                  onClick={handleRecharge}
                  className="w-full rounded-lg border-2 border-emerald-600 bg-emerald-500/10 p-4 text-left transition-all hover:bg-emerald-500/20"
                >
                  <div className="mb-1 flex items-center gap-2 font-semibold text-emerald-400">
                    <span className="text-xl">💳</span>
                    <span>充值积分</span>
                  </div>
                  <div className="text-sm text-slate-400">
                    购买更多积分继续使用快速模式
                  </div>
                </button>

                {/* 选项 2: 切换慢速模式 */}
                <button
                  onClick={handleSwitchToSlow}
                  className="w-full rounded-lg border-2 border-blue-600 bg-blue-500/10 p-4 text-left transition-all hover:bg-blue-500/20"
                >
                  <div className="mb-1 flex items-center gap-2 font-semibold text-blue-400">
                    <span className="text-xl">🐌</span>
                    <span>切换到慢速模式</span>
                  </div>
                  <div className="text-sm text-slate-400">
                    免费使用慢速模式生成图片（约 20 秒）
                  </div>
                </button>
              </div>

              {/* 取消按钮 */}
              <button
                onClick={onClose}
                className="mt-4 w-full rounded-lg bg-slate-700 px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-600"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast 提示 */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-[60] animate-slide-up">
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚧</span>
              <div>
                <div className="font-semibold text-slate-100">功能开发中</div>
                <div className="text-sm text-slate-400">
                  充值功能即将上线，敬请期待
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast 动画 */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
