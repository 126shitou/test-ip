import { useState } from "react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
}

// 预设的快速提示词标签
const QUICK_PROMPTS = [
  "一只可爱的猫咪",
  "美丽的日落风景",
  "未来科技城市",
  "梦幻森林",
  "太空星球",
  "海底世界",
  "山水画",
  "抽象艺术",
];

// 随机提示词库
const RANDOM_PROMPTS = [
  "一只在彩虹上跳舞的独角兽",
  "漂浮在云端的梦幻城堡",
  "发光的水晶洞穴",
  "机器人在花园里种花",
  "夜空中的极光",
  "神秘的古老遗迹",
  "赛博朋克风格的街道",
  "魔法森林中的精灵",
  "深海中的发光生物",
  "蒸汽朋克风格的飞艇",
  "冰雪覆盖的山峰",
  "樱花飘落的庭院",
  "星际旅行的宇宙飞船",
  "古代东方宫殿",
  "火山喷发的壮观景象",
];

export default function PromptInput({ value, onChange }: PromptInputProps) {
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);

  // 随机生成提示词
  const handleRandomPrompt = () => {
    const randomIndex = Math.floor(Math.random() * RANDOM_PROMPTS.length);
    onChange(RANDOM_PROMPTS[randomIndex]);
  };

  // 选择快速提示词
  const handleQuickPrompt = (prompt: string) => {
    onChange(prompt);
    setShowQuickPrompts(false);
  };

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-xl backdrop-blur">
      <div className="border-b border-slate-700/50 bg-slate-800/80 px-5 py-3">
        <h2 className="font-semibold text-slate-200">✨ 图片描述</h2>
      </div>
      <div className="p-5">
        {/* 输入框 */}
        <div className="mb-4">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="描述你想要生成的图片，例如：一只可爱的猫咪..."
            rows={3}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <div className="mt-2 text-xs text-slate-500">
            {value.length} 字符
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2">
          {/* 随机生成按钮 */}
          <button
            onClick={handleRandomPrompt}
            className="rounded-lg bg-purple-500/20 px-4 py-2 text-sm font-medium text-purple-400 transition-colors hover:bg-purple-500/30"
          >
            🎲 随机生成
          </button>

          {/* 快速选择按钮 */}
          <button
            onClick={() => setShowQuickPrompts(!showQuickPrompts)}
            className="rounded-lg bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30"
          >
            ⚡ 快速选择
          </button>

          {/* 清空按钮 */}
          {value && (
            <button
              onClick={() => onChange("")}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-600"
            >
              🗑️ 清空
            </button>
          )}
        </div>

        {/* 快速提示词标签 */}
        {showQuickPrompts && (
          <div className="mt-4 animate-fade-in rounded-lg bg-slate-900/50 p-4">
            <div className="mb-2 text-sm font-medium text-slate-400">
              选择一个提示词：
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-all hover:bg-emerald-600 hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 动画 CSS */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
