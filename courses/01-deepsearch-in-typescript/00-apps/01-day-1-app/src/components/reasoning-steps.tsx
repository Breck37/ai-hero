import { useState } from "react";
import { SearchIcon, LinkIcon, ChevronDownIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { OurMessageAnnotation } from "../run-agent-loop";

export const ReasoningSteps = ({
  annotations,
}: {
  annotations: OurMessageAnnotation[];
}) => {
  const [openStep, setOpenStep] = useState<number | null>(null);

  if (annotations.length === 0) return null;

  return (
    <div className="mb-4 w-full">
      <ul className="space-y-1">
        {annotations.map((annotation, index) => {
          const isOpen = openStep === index;
          return (
            <li key={index} className="relative">
              <button
                onClick={() => setOpenStep(isOpen ? null : index)}
                className={`min-w-34 group flex w-full flex-shrink-0 items-center rounded-lg px-3 py-2 text-left text-sm transition-all duration-200 hover:bg-purple-950/30 ${
                  isOpen
                    ? "border border-purple-500/50 bg-purple-950/40 text-purple-200"
                    : "border border-transparent text-gray-400 hover:border-purple-500/30 hover:text-purple-300"
                }`}
              >
                <span
                  className={`z-10 mr-3 flex size-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-200 ${
                    isOpen
                      ? "border-purple-400 bg-purple-500 text-white shadow-sm"
                      : "border-purple-500/60 bg-purple-950/60 text-purple-300 group-hover:border-purple-400 group-hover:bg-purple-500/20 group-hover:text-purple-200"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="flex-1">{annotation.action.title}</span>
                <ChevronDownIcon
                  className={`size-4 text-purple-400/70 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  isOpen ? "mt-2 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-3">
                  <div className="text-sm leading-relaxed text-purple-200/90">
                    <ReactMarkdown>{annotation.action.reasoning}</ReactMarkdown>
                  </div>
                  {annotation.action.type === "search" && (
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="flex items-center gap-2 rounded-md bg-purple-950/40 px-2 py-1.5 text-sm text-purple-300/80">
                        <SearchIcon className="size-4 text-purple-400" />
                        <span className="font-mono text-xs">
                          {annotation.action.query}
                        </span>
                      </div>
                      {annotation.action.results &&
                        annotation.action.results.length > 0 && (
                          <div className="mt-2">
                            {annotation.action.results.map((result, idx) => (
                              <div
                                key={idx}
                                className="mb-2 rounded border border-purple-500/20 bg-purple-950/30 p-2"
                              >
                                <div className="font-semibold text-purple-200">
                                  <a
                                    href={result.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                  >
                                    {result.title}
                                  </a>
                                  <span className="ml-2 text-xs text-purple-400">
                                    {result.date}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-purple-300">
                                  {result.snippet}
                                </div>
                                <div className="mt-2 text-xs text-purple-400">
                                  Scraped Content:
                                </div>
                                <div className="overflow-y-auto whitespace-pre-line rounded bg-purple-950/60 p-2 text-xs text-purple-100">
                                  {result.scrapedContent}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
