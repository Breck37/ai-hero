import { useState, memo } from "react";
import { ChevronDownIcon, SearchIcon, GlobeIcon } from "lucide-react";
import type { OurMessageAnnotation, SearchSource } from "../types";

type SearchSourcesAnnotation = Extract<
  OurMessageAnnotation,
  { type: "SEARCH_SOURCES" }
>;

export const SearchSources = memo(
  ({ annotations }: { annotations: OurMessageAnnotation[] }) => {
    const [openStep, setOpenStep] = useState<number | null>(null);

    // Filter for search source annotations
    const searchSourceAnnotations = annotations.filter(
      (annotation): annotation is SearchSourcesAnnotation =>
        annotation.type === "SEARCH_SOURCES",
    );

    if (searchSourceAnnotations.length === 0) return null;

    return (
      <div className="mb-4 w-full">
        <ul className="space-y-1">
          {searchSourceAnnotations.map((annotation, index) => {
            const isOpen = openStep === index;
            return (
              <li key={index} className="relative">
                <button
                  onClick={() => setOpenStep(isOpen ? null : index)}
                  className={`min-w-34 group flex w-full flex-shrink-0 items-center rounded-lg px-3 py-2 text-left text-sm transition-all duration-200 hover:bg-blue-950/30 ${
                    isOpen
                      ? "border border-blue-500/50 bg-blue-950/40 text-blue-200"
                      : "border border-transparent text-gray-400 hover:border-blue-500/30 hover:text-blue-300"
                  }`}
                >
                  <span
                    className={`z-10 mr-3 flex size-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-200 ${
                      isOpen
                        ? "border-blue-400 bg-blue-500 text-white shadow-sm"
                        : "border-blue-500/60 bg-blue-950/60 text-blue-300 group-hover:border-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-200"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="flex-1">
                    Search Results: {annotation.query}
                  </span>
                  <ChevronDownIcon
                    className={`size-4 text-blue-400/70 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isOpen ? "mt-2 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-3">
                    <div className="mb-3 flex items-center gap-2 rounded-md bg-blue-950/40 px-2 py-1.5 text-sm text-blue-300/80">
                      <SearchIcon className="size-4 text-blue-400" />
                      <span className="font-semibold">
                        Found {annotation.sources.length} sources
                      </span>
                    </div>

                    <div className="grid gap-3">
                      {annotation.sources.map((source, sourceIndex) => (
                        <div
                          key={sourceIndex}
                          className="rounded-lg border border-blue-500/20 bg-blue-950/30 p-3 transition-colors hover:bg-blue-950/40"
                        >
                          <div className="flex items-start gap-3">
                            {/* Favicon */}
                            <div className="flex-shrink-0">
                              {source.favicon ? (
                                <img
                                  src={source.favicon}
                                  alt=""
                                  className="size-4 rounded-sm"
                                  onError={(e) => {
                                    // Fallback to globe icon if favicon fails to load
                                    e.currentTarget.style.display = "none";
                                    e.currentTarget.nextElementSibling?.classList.remove(
                                      "hidden",
                                    );
                                  }}
                                />
                              ) : null}
                              <GlobeIcon
                                className={`size-4 text-blue-400 ${source.favicon ? "hidden" : ""}`}
                              />
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mb-1 block truncate text-sm font-semibold text-blue-200 transition-colors hover:text-blue-100"
                              >
                                {source.title}
                              </a>
                              <p
                                className="overflow-hidden text-xs leading-relaxed text-blue-300/80"
                                style={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                }}
                              >
                                {source.snippet}
                              </p>
                              <div className="mt-2 flex items-center justify-between">
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="max-w-[200px] truncate text-xs text-blue-400 transition-colors hover:text-blue-300"
                                >
                                  {source.url}
                                </a>
                                {source.date && (
                                  <span className="text-xs text-blue-400/60">
                                    {source.date}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
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

SearchSources.displayName = "SearchSources";
