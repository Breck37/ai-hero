"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Settings } from "lucide-react";
import type { Message } from "ai";

interface ModelOption {
  provider: string;
  name: string;
  model: string;
}

interface ModelSwitcherProps {
  onModelChange: (provider: string, model: string) => void;
  currentModel?: { provider: string; model: string };
  disabled?: boolean;
}

export function ModelSwitcher({
  onModelChange,
  currentModel,
  disabled = false,
}: ModelSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch available models from the API
    const fetchModels = async () => {
      try {
        const response = await fetch("/api/models");
        if (response.ok) {
          const models = await response.json();
          setAvailableModels(models);
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []);

  const handleModelSelect = (provider: string, model: string) => {
    onModelChange(provider, model);
    setIsOpen(false);
  };

  const getCurrentModelName = () => {
    if (!currentModel) return "Select Model";

    const model = availableModels.find(
      (m) =>
        m.provider === currentModel.provider && m.model === currentModel.model,
    );

    return model ? model.name : "Select Model";
  };

  const groupedModels = availableModels.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider]!.push(model);
      return acc;
    },
    {} as Record<string, ModelOption[]>,
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-400">
        <Settings className="size-4 animate-spin" />
        Loading models...
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:hover:bg-gray-800"
      >
        <Settings className="size-4" />
        <span className="truncate">{getCurrentModelName()}</span>
        <ChevronDown
          className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded border border-gray-700 bg-gray-800 shadow-lg">
          <div className="max-h-64 overflow-y-auto p-2">
            {Object.entries(groupedModels).map(([provider, models]) => (
              <div key={provider} className="mb-3">
                <div className="mb-1 px-2 py-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  {provider}
                </div>
                {models.map((model) => {
                  const isSelected =
                    currentModel?.provider === model.provider &&
                    currentModel?.model === model.model;

                  return (
                    <button
                      key={`${model.provider}-${model.model}`}
                      type="button"
                      onClick={() =>
                        handleModelSelect(model.provider, model.model)
                      }
                      className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "text-gray-200 hover:bg-gray-700"
                      }`}
                    >
                      {model.name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
