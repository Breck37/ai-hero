import { useState, memo } from "react";
import {
  SearchIcon,
  ChevronDownIcon,
  BrainIcon,
  MessageSquareIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { OurMessageAnnotation } from "../types";

type NewActionAnnotation = Extract<
  OurMessageAnnotation,
  { type: "NEW_ACTION" }
>;

export const ReasoningSteps = memo(
  ({ annotations }: { annotations: OurMessageAnnotation[] }) => {
    const [openStep, setOpenStep] = useState<number | null>(null);

    // Filter for NEW_ACTION annotations only
    const actionAnnotations = annotations.filter(
      (annotation): annotation is NewActionAnnotation =>
        annotation.type === "NEW_ACTION",
    );

    if (actionAnnotations.length === 0) return null;

    return (
      <div className="mb-4 w-full">
        <ul className="space-y-1">
          {actionAnnotations.map((annotation, index) => {
            const isOpen = openStep === index;
            if (!annotation.action.title || !annotation.action.reasoning) {
              return null;
            }
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
                      <ReactMarkdown>
                        {annotation.action.reasoning}
                      </ReactMarkdown>
                    </div>

                    {/* Show feedback if available */}
                    {annotation.action.feedback && (
                      <div className="mt-3 flex flex-col gap-2">
                        <div className="flex items-center gap-2 rounded-md bg-orange-950/40 px-2 py-1.5 text-sm text-orange-300/80">
                          <MessageSquareIcon className="size-4 text-orange-400" />
                          <span className="font-semibold">
                            Evaluation Feedback
                          </span>
                        </div>
                        <div className="rounded border border-orange-500/20 bg-orange-950/30 p-2">
                          <ReactMarkdown className="text-xs text-orange-200">
                            {annotation.action.feedback}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Show query plan for continue actions */}
                    {annotation.action.type === "continue" &&
                      annotation.queryPlan && (
                        <div className="mt-3 flex flex-col gap-2">
                          <div className="flex items-center gap-2 rounded-md bg-purple-950/40 px-2 py-1.5 text-sm text-purple-300/80">
                            <BrainIcon className="size-4 text-purple-400" />
                            <span className="font-semibold">Research Plan</span>
                          </div>
                          <div className="rounded border border-purple-500/20 bg-purple-950/30 p-2">
                            <ReactMarkdown className="text-xs text-purple-200">
                              {annotation.queryPlan.plan}
                            </ReactMarkdown>
                          </div>

                          <div className="flex items-center gap-2 rounded-md bg-purple-950/40 px-2 py-1.5 text-sm text-purple-300/80">
                            <SearchIcon className="size-4 text-purple-400" />
                            <span className="font-semibold">
                              Search Queries
                            </span>
                          </div>
                          {annotation.queryPlan.queries.map(
                            (query: string, idx: number) => (
                              <div
                                key={idx}
                                className="rounded border border-purple-500/20 bg-purple-950/30 p-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-purple-400">
                                    {idx + 1}.
                                  </span>
                                  <span className="font-mono text-xs text-purple-200">
                                    {query}
                                  </span>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      )}

                    {/* Show action type indicator */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-purple-400">Action:</span>
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          annotation.action.type === "continue"
                            ? "bg-blue-500/20 text-blue-300"
                            : annotation.action.type === "answer"
                              ? "bg-green-500/20 text-green-300"
                              : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {annotation.action.type === "continue"
                          ? "Continue Research"
                          : annotation.action.type === "answer"
                            ? "Provide Answer"
                            : "Error"}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
);

ReasoningSteps.displayName = "ReasoningSteps";
