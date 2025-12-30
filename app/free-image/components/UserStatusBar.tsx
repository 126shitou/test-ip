import { UserState, IPUsageState } from "../types";

interface UserStatusBarProps {
  userState: UserState;
  ipUsage: IPUsageState;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

export default function UserStatusBar({
  userState,
  ipUsage,
  onLoginClick,
  onLogoutClick,
}: UserStatusBarProps) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-xl backdrop-blur">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        {/* 左侧：用户信息 */}
        <div className="flex items-center gap-4">
          {/* 头像图标 */}
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
              userState.isLoggedIn
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-slate-700 text-slate-400"
            }`}
          >
            {userState.isLoggedIn ? "👤" : "👻"}
          </div>

          {/* 用户名或访客标识 */}
          <div>
            <div className="text-lg font-semibold text-slate-100">
              {userState.isLoggedIn ? userState.username : "访客模式"}
            </div>
            {!userState.isLoggedIn && (
              <div className="text-sm text-slate-400">
                已使用 {ipUsage.ipUsageCount}/2 次免费额度
              </div>
            )}
          </div>
        </div>

        {/* 中间：积分徽章（登录用户） */}
        {userState.isLoggedIn && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/20 px-4 py-2">
            <span className="text-xl">💰</span>
            <div>
              <div className="text-xs text-amber-300">剩余积分</div>
              <div className="text-xl font-bold text-amber-400">
                {userState.credits}
              </div>
            </div>
          </div>
        )}

        {/* 右侧：登录/登出按钮 */}
        <div>
          {userState.isLoggedIn ? (
            <button
              onClick={onLogoutClick}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600"
            >
              登出
            </button>
          ) : (
            <button
              onClick={onLoginClick}
              className="rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-500/20"
            >
              登录
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
