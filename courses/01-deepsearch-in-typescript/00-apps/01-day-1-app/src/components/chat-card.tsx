import { useState } from "react";
import Link from "next/link";
import { Search, Globe, Zap, Settings, Info } from "lucide-react";
import type { DB } from "~/server/db/schema";

interface ChatCardProps {
  chat: DB.Chat;
  isActive: boolean;
  onUpdateSettings: (
    chatId: string,
    useSearchGrounding: boolean,
    useTavily: boolean,
  ) => void;
}

export const ChatCard = ({
  chat,
  isActive,
  onUpdateSettings,
}: ChatCardProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const [useSearchGrounding, setUseSearchGrounding] = useState(
    chat.useSearchGrounding ?? false,
  );
  const [useTavily, setUseTavily] = useState(chat.useTavily ?? true);

  const handleSearchModeChange = (newUseSearchGrounding: boolean) => {
    setUseSearchGrounding(newUseSearchGrounding);
    onUpdateSettings(chat.id, newUseSearchGrounding, useTavily);
  };

  const handleSearchMethodChange = (newUseTavily: boolean) => {
    setUseTavily(newUseTavily);
    onUpdateSettings(chat.id, useSearchGrounding, newUseTavily);
  };

  return (
    <div className="space-y-2">
      {/* Chat Link */}
      <div className="flex items-center gap-2">
        <Link
          href={`/?id=${chat.id}`}
          className={`flex-1 rounded-lg p-3 text-left text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
            isActive ? "bg-gray-700" : "hover:bg-gray-750 bg-gray-800"
          }`}
        >
          {chat.title}
        </Link>
        {isActive && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
            title="Chat Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Settings Panel (only shown for active chat) */}
      {isActive && showSettings && (
        <div className="space-y-3 rounded-lg bg-gray-800 p-3">
          {/* Search Mode Toggle */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-300">
                Search Mode:
              </span>
                             <div className="group relative">
                 <Info className="h-3 w-3 text-gray-400 hover:text-gray-300 cursor-help" />
                 <div className="absolute bottom-full left-1/2 z-10 mb-2 w-48 -translate-x-1/2 transform rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                   <strong>External Tool:</strong> More control, shows search
                   process
                   <br />
                   <strong>Search Grounding:</strong> Faster, native model search
                 </div>
               </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleSearchModeChange(false)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  !useSearchGrounding
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Search className="h-3 w-3" />
                External
              </button>
              <button
                onClick={() => handleSearchModeChange(true)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  useSearchGrounding
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Globe className="h-3 w-3" />
                Grounding
              </button>
            </div>
          </div>

          {/* Search Method Toggle */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-300">
                Search Method:
              </span>
              <div className="relative">
                <Info className="h-3 w-3 text-gray-400 hover:text-gray-300" />
                <div className="absolute bottom-full left-1/2 z-10 mb-2 w-48 -translate-x-1/2 transform rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity hover:opacity-100">
                  <strong>Tavily:</strong> Faster, single API call
                  <br />
                  <strong>Manual:</strong> More control, separate steps
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleSearchMethodChange(true)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  useTavily
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Zap className="h-3 w-3" />
                Tavily
              </button>
              <button
                onClick={() => handleSearchMethodChange(false)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  !useTavily
                    ? "bg-orange-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Settings className="h-3 w-3" />
                Manual
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
