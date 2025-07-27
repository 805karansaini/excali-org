import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Search, FileText, Folder, Clock, ArrowLeft, ChevronRight } from "lucide-react";
import { useUnifiedState } from "../context/UnifiedStateProvider";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";
import { UnifiedCanvas, UnifiedProject } from "../../shared/types";

interface SearchResult {
  type: "canvas" | "project";
  item: UnifiedCanvas | UnifiedProject;
  matches: string[];
  score: number;
}

interface DrillDownState {
  mode: 'search' | 'project-canvases';
  selectedProject?: UnifiedProject;
  originalQuery?: string;
}

export function SearchModal() {
  const { state, dispatch } = useUnifiedState();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [drillDown, setDrillDown] = useState<DrillDownState>({ mode: 'search' });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Autofocus and trap focus within the modal
  useEffect(() => {
    const input = searchInputRef.current;
    if (!input) return;

    // Delay focus slightly to ensure the modal is fully rendered
    const focusTimeout = setTimeout(() => {
      input.focus();
    }, 100);

    // Trap focus
    const handleFocusTrap = (e: FocusEvent) => {
      if (
        e.target instanceof Node &&
        !searchInputRef.current?.contains(e.target)
      ) {
        input.focus();
      }
    };

    document.addEventListener("focusin", handleFocusTrap);

    return () => {
      clearTimeout(focusTimeout);
      document.removeEventListener("focusin", handleFocusTrap);
    };
  }, []);

  // Fuzzy search implementation
  const fuzzyMatch = (
    text: string,
    query: string,
  ): { score: number; matches: boolean } => {
    if (!query.trim()) return { score: 0, matches: false };

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact match gets highest score
    if (lowerText === lowerQuery) return { score: 100, matches: true };

    // Starts with gets high score
    if (lowerText.startsWith(lowerQuery)) return { score: 90, matches: true };

    // Contains gets medium score
    if (lowerText.includes(lowerQuery)) return { score: 70, matches: true };

    // Fuzzy matching - check if all characters of query appear in order
    let queryIndex = 0;
    let lastMatchIndex = -1;
    let score = 50;

    for (
      let i = 0;
      i < lowerText.length && queryIndex < lowerQuery.length;
      i++
    ) {
      if (lowerText[i] === lowerQuery[queryIndex]) {
        // Bonus for consecutive matches
        if (i === lastMatchIndex + 1) score += 5;
        lastMatchIndex = i;
        queryIndex++;
      }
    }

    if (queryIndex === lowerQuery.length) {
      // Penalty for scattered matches
      const firstMatchIndex = lowerText.indexOf(lowerQuery[0] || '');
      const spread = firstMatchIndex >= 0 ? lastMatchIndex - firstMatchIndex : 0;
      score = Math.max(20, score - spread * 2);
      return { score, matches: true };
    }

    return { score: 0, matches: false };
  };

  // Perform advanced search with fuzzy matching
  const performSearch = useCallback(
    (searchQuery: string) => {
      const searchResults: SearchResult[] = [];

      if (drillDown.mode === 'search') {
        // Regular search mode - search both canvases and projects
        if (!searchQuery.trim()) {
          setResults([]);
          setSelectedIndex(0);
          return;
        }

        // Search canvases
        state.canvases.forEach((canvas) => {
          const nameMatch = fuzzyMatch(canvas.name, searchQuery);

          if (nameMatch.matches) {
            searchResults.push({
              type: "canvas",
              item: canvas,
              matches: ["name"],
              score: nameMatch.score,
            });
          }
        });

        // Search projects
        state.projects.forEach((project) => {
          const nameMatch = fuzzyMatch(project.name, searchQuery);
          const descMatch = project.description
            ? fuzzyMatch(project.description, searchQuery)
            : { score: 0, matches: false };

          const bestMatch = Math.max(nameMatch.score, descMatch.score);
          const matches: string[] = [];

          if (nameMatch.matches) matches.push("name");
          if (descMatch.matches) matches.push("description");

          if (matches.length > 0) {
            searchResults.push({
              type: "project",
              item: project,
              matches,
              score: bestMatch,
            });
          }
        });
      } else if (drillDown.mode === 'project-canvases' && drillDown.selectedProject) {
        // Project drill-down mode - search only canvases within the selected project
        const selectedProject = drillDown.selectedProject;
        const projectCanvases = state.canvases.filter(canvas =>
          canvas.projectId === selectedProject.id
        );

        if (!searchQuery.trim()) {
          // Show all canvases in project when no query
          projectCanvases.forEach((canvas) => {
            searchResults.push({
              type: "canvas",
              item: canvas,
              matches: ["name"],
              score: 100, // All canvases get same score when no query
            });
          });
        } else {
          // Search within project canvases
          projectCanvases.forEach((canvas) => {
            const nameMatch = fuzzyMatch(canvas.name, searchQuery);

            if (nameMatch.matches) {
              searchResults.push({
                type: "canvas",
                item: canvas,
                matches: ["name"],
                score: nameMatch.score,
              });
            }
          });
        }
      }

      // Sort by score (highest first), then by name
      searchResults.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.item.name.localeCompare(b.item.name);
      });

      setResults(searchResults.slice(0, 20)); // Limit to top 20 results
      setSelectedIndex(0);
    },
    [state.canvases, state.projects, drillDown],
  );

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [query, performSearch]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (result.type === "canvas") {
        const canvas = result.item as UnifiedCanvas;
        dispatch({ type: "SET_SELECTED_CANVAS", payload: canvas.id });
        eventBus.emit(InternalEventTypes.CANVAS_SELECTED, canvas);
        eventBus.emit(InternalEventTypes.LOAD_CANVAS_TO_EXCALIDRAW, canvas);
        dispatch({ type: "SET_SEARCH_MODAL_OPEN", payload: false });
      } else {
        const project = result.item as UnifiedProject;
        if (drillDown.mode === 'search') {
          // Transition to project drill-down mode
          setDrillDown({
            mode: 'project-canvases',
            selectedProject: project,
            originalQuery: query
          });
          setQuery(''); // Clear query to show all canvases in project
          setSelectedIndex(0);
        } else {
          // In project-canvases mode, this shouldn't happen (only canvases should be shown)
          // But handle it gracefully by focusing on the project
          eventBus.emit(InternalEventTypes.PROJECT_SELECTED, project);
          dispatch({ type: "SET_SEARCH_MODAL_OPEN", payload: false });
        }
      }
    },
    [dispatch, drillDown.mode, query],
  );

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (drillDown.mode === 'project-canvases') {
      setDrillDown({ mode: 'search' });
      setQuery(drillDown.originalQuery || '');
      setSelectedIndex(0);
    } else {
      dispatch({ type: "SET_SEARCH_MODAL_OPEN", payload: false });
    }
  }, [drillDown, dispatch]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [results, selectedIndex, dispatch, handleSelect, handleBack]);

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // For exact and prefix matches, highlight the matching part
    if (lowerText.includes(lowerQuery)) {
      const startIndex = lowerText.indexOf(lowerQuery);
      const endIndex = startIndex + lowerQuery.length;

      return (
        <>
          {text.slice(0, startIndex)}
          <span
            style={{
              background: "var(--theme-highlight-bg, rgba(255, 255, 0, 0.2))",
              borderRadius: "2px",
              padding: "0 2px",
            }}
          >
            {text.slice(startIndex, endIndex)}
          </span>
          {text.slice(endIndex)}
        </>
      );
    }

    // For fuzzy matches, highlight individual characters
    const parts: React.ReactNode[] = [];
    const queryChars = lowerQuery.split("");
    let queryIndex = 0;

    for (let i = 0; i < text.length && queryIndex < queryChars.length; i++) {
      const char = text[i];
      if (lowerText[i] === queryChars[queryIndex]) {
        parts.push(
          <span
            key={i}
            style={{
              background: "var(--theme-highlight-bg, rgba(255, 255, 0, 0.2))",
              borderRadius: "2px",
              padding: "0 1px",
            }}
          >
            {char}
          </span>,
        );
        queryIndex++;
      } else {
        parts.push(char);
      }
    }

    return <>{parts}</>;
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getProjectCanvasCount = (project: UnifiedProject): number => {
    return state.canvases.filter(
      (canvas) => canvas.projectId === project.id
    ).length;
  };

  const panelStyles: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "var(--theme-bg-primary, #ffffff)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "10vh",
    zIndex: 9999999,
    pointerEvents: "auto",
  };

  const modalStyles: React.CSSProperties = {
    width: "100%",
    maxWidth: "600px",
    background: "var(--theme-bg-primary, #ffffff)",
    border: "1px solid var(--theme-border-primary, rgba(0, 0, 0, 0.1))",
    borderRadius: "16px",
    boxShadow: "var(--theme-shadow-lg, 0 20px 40px rgba(0, 0, 0, 0.1))",
    overflow: "hidden",
    margin: "0 16px",
  };

  const searchInputStyles: React.CSSProperties = {
    width: "100%",
    padding: "0",
    background: "transparent",
    border: "none",
    color: "var(--theme-text-primary)",
    fontSize: "18px",
    outline: "none",
  };

  const resultItemStyles: React.CSSProperties = {
    padding: "12px 24px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    transition: "all 0.2s ease",
    color: "var(--theme-text-secondary)",
  };

  return createPortal(
    <motion.div
      style={panelStyles}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          dispatch({ type: "SET_SEARCH_MODAL_OPEN", payload: false });
        }
      }}
    >
      <motion.div
        style={modalStyles}
        initial={{ scale: 0.9, y: -50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: -50 }}
        transition={{ type: "spring", damping: 30, stiffness: 400 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "20px 24px",
          }}
        >
          {drillDown.mode === 'project-canvases' && (
            <button
              onClick={handleBack}
              aria-label="Go back to main search"
              style={{
                background: "none",
                border: "none",
                color: "var(--theme-text-secondary, #6b7280)",
                cursor: "pointer",
                padding: "4px",
                marginRight: "8px",
                display: "flex",
                alignItems: "center",
                borderRadius: "4px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--theme-bg-hover, rgba(0, 0, 0, 0.05))";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
              }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <Search
            size={20}
            style={{
              color: "var(--theme-text-secondary, #6b7280)",
              marginRight: "12px",
            }}
          />
          <input
            ref={searchInputRef}
            style={searchInputStyles}
            placeholder={
              drillDown.mode === 'project-canvases'
                ? `Search in ${drillDown.selectedProject?.name || 'project'}...`
                : "Search canvases and projects..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {drillDown.mode === 'project-canvases' && drillDown.selectedProject && (
          <div
            style={{
              padding: "0 24px 16px",
              borderBottom: "1px solid var(--theme-border-tertiary, rgba(0, 0, 0, 0.1))",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                color: "var(--theme-text-secondary, #6b7280)",
              }}
            >
              <button
                onClick={handleBack}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--theme-accent-primary, #6366f1)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontSize: "14px",
                }}
              >
                All Results
              </button>
              <ChevronRight size={14} />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Folder
                  size={14}
                  color={drillDown.selectedProject.color || "#6366f1"}
                  fill={drillDown.selectedProject.color || "#6366f1"}
                />
                <span style={{ fontWeight: 500 }}>{drillDown.selectedProject.name}</span>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            maxHeight: "400px",
            overflowY: "auto",
            padding: "8px 0",
            borderTop: "1px solid var(--theme-border-primary)",
          }}
        >
          {results.length > 0 ? (
            results.map((result, index) => (
              <div
                key={`${result.type}-${result.item.id}`}
                style={{
                  ...resultItemStyles,
                  background:
                    index === selectedIndex
                      ? "var(--theme-bg-active)"
                      : "transparent",
                  color:
                    index === selectedIndex
                      ? "var(--theme-accent-primary)"
                      : "var(--theme-text-secondary)",
                }}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {result.type === "canvas" ? (
                    <FileText size={16} color="var(--theme-accent-primary, #6366f1)" />
                  ) : (
                    <Folder size={16} color={(result.item as UnifiedProject).color || "#6366f1"} fill={(result.item as UnifiedProject).color || "#6366f1"} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {highlightMatch(result.item.name, query)}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--theme-text-tertiary, #9ca3af)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {result.type === "canvas" ? (
                      <>
                        <Clock size={12} />
                        {formatDate(
                          (result.item as UnifiedCanvas).updatedAt ||
                            (result.item as UnifiedCanvas).createdAt,
                        )}
                      </>
                    ) : (
                      `${getProjectCanvasCount(result.item as UnifiedProject)} canvases`
                    )}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--theme-text-tertiary, #9ca3af)",
                    flexShrink: 0,
                  }}
                >
                  {result.type === "canvas" ? "Canvas" : "Project"}
                </div>
              </div>
            ))
          ) : query.trim() ? (
            <div
              style={{
                padding: "40px 24px",
                textAlign: "center",
                color: "var(--theme-text-tertiary)",
              }}
            >
              <Search
                size={48}
                style={{ margin: "0 auto 16px", opacity: 0.5 }}
              />
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 500,
                  marginBottom: "8px",
                }}
              >
                No results found
              </div>
              <div style={{ fontSize: "14px", lineHeight: 1.5 }}>
                {drillDown.mode === 'project-canvases'
                  ? `No canvases found in ${drillDown.selectedProject?.name || 'project'} matching "${query}"`
                  : "Try searching for a different canvas or project name"
                }
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "40px 24px",
                textAlign: "center",
                color: "var(--theme-text-tertiary)",
              }}
            >
              {drillDown.mode === 'project-canvases' && drillDown.selectedProject ? (
                <>
                  <Folder
                    size={48}
                    style={{ margin: "0 auto 16px", opacity: 0.5 }}
                    color={drillDown.selectedProject.color || "#6366f1"}
                    fill={drillDown.selectedProject.color || "#6366f1"}
                  />
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 500,
                      marginBottom: "8px",
                    }}
                  >
                    {drillDown.selectedProject.name}
                  </div>
                  <div style={{ fontSize: "14px", lineHeight: 1.5 }}>
                    {getProjectCanvasCount(drillDown.selectedProject)} canvases • Start typing to search
                  </div>
                </>
              ) : (
                <>
                  <Search
                    size={48}
                    style={{ margin: "0 auto 16px", opacity: 0.5 }}
                  />
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 500,
                      marginBottom: "8px",
                    }}
                  >
                    Search your canvases
                  </div>
                  <div style={{ fontSize: "14px", lineHeight: 1.5 }}>
                    Start typing to find canvases and projects
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--theme-border-tertiary)",
            background: "var(--theme-bg-tertiary)",
            display: "flex",
            gap: "16px",
            fontSize: "12px",
            color: "var(--theme-text-tertiary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                background: "var(--theme-bg-active)",
                border: "1px solid var(--theme-border-primary)",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "11px",
                fontFamily: "monospace",
              }}
            >
              ↑↓
            </span>
            <span>Navigate</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                background: "var(--theme-bg-active)",
                border: "1px solid var(--theme-border-primary)",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "11px",
                fontFamily: "monospace",
              }}
            >
              Enter
            </span>
            <span>{drillDown.mode === 'search' ? 'Select' : 'Open'}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                background: "var(--theme-bg-active)",
                border: "1px solid var(--theme-border-primary)",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "11px",
                fontFamily: "monospace",
              }}
            >
              Esc
            </span>
            <span>{drillDown.mode === 'project-canvases' ? 'Back' : 'Close'}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
