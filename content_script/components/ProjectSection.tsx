import { motion, AnimatePresence } from "framer-motion";
import { Folder, FileText, ChevronRight } from "lucide-react";
import { UnifiedProject, UnifiedCanvas } from "../../shared/types";
import { PROJECT_SORT_CONSTANTS } from "../../shared/utils";

interface ProjectSectionProps {
  projects: UnifiedProject[];
  sortedProjects: UnifiedProject[];
  projectsToShow: UnifiedProject[];
  hasMoreProjects: boolean;
  showAllProjects: boolean;
  onShowAllProjectsToggle: () => void;
  collapsedProjects: Set<string>;
  selectedCanvasId: string | null;
  getCanvasesForProject: (projectId: string) => UnifiedCanvas[];
  onToggleProject: (projectId: string) => void;
  onProjectRightClick: (e: React.MouseEvent, project: UnifiedProject) => void;
  onCanvasSelect: (canvas: UnifiedCanvas) => void;
  onCanvasRightClick: (e: React.MouseEvent, canvas: UnifiedCanvas) => void;
  formatDate: (date: Date) => string;
  hoveredProject: UnifiedProject | null;
  onProjectHover: (project: UnifiedProject | null, position?: { x: number; y: number }) => void;
}

export function ProjectSection({
  projects,
  sortedProjects,
  projectsToShow,
  hasMoreProjects,
  showAllProjects,
  onShowAllProjectsToggle,
  collapsedProjects,
  selectedCanvasId,
  getCanvasesForProject,
  onToggleProject,
  onProjectRightClick,
  onCanvasSelect,
  onCanvasRightClick,
  formatDate,
  hoveredProject: _hoveredProject,
  onProjectHover,
}: ProjectSectionProps) {
  // hoveredProject parameter renamed to _hoveredProject to indicate it's managed by parent

  if (projects.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: "600",
            textTransform: "uppercase",
            color: "var(--theme-text-secondary)",
            letterSpacing: "0.5px",
          }}
        >
          Projects
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--theme-text-tertiary, rgba(0, 0, 0, 0.5))",
            background: "var(--theme-bg-secondary, rgba(0, 0, 0, 0.05))",
            padding: "2px 6px",
            borderRadius: "8px",
            fontWeight: "500",
          }}
        >
          {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          {projects.length > PROJECT_SORT_CONSTANTS.DEFAULT_PAGINATION_LIMIT && !showAllProjects && ` • showing top ${PROJECT_SORT_CONSTANTS.DEFAULT_PAGINATION_LIMIT}`}
          {projects.length > PROJECT_SORT_CONSTANTS.DEFAULT_PAGINATION_LIMIT && showAllProjects && ' • all shown'}
        </div>
      </div>

      <>
        {projectsToShow.map((project) => {
        const projectCanvases = getCanvasesForProject(project.id);
        const isCollapsed = collapsedProjects.has(project.id);

        return (
          <div key={project.id} style={{ marginBottom: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px",
                borderRadius: "6px",
                transition: "background-color 0.2s ease",
              }}
              onContextMenu={(e) => onProjectRightClick(e, project)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--theme-bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {/* Expand/Collapse Button */}
              <button
                style={{
                  background: "none",
                  border: "none",
                  padding: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "4px",
                  color: "var(--theme-text-secondary)",
                  transition: "all 0.15s ease",
                  width: "20px",
                  height: "20px",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleProject(project.id);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--theme-bg-secondary)";
                  e.currentTarget.style.color = "var(--theme-text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                  e.currentTarget.style.color = "var(--theme-text-secondary)";
                }}
                title={isCollapsed ? "Expand project" : "Collapse project"}
              >
                <motion.div
                  animate={{ rotate: isCollapsed ? 0 : 90 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <ChevronRight size={12} />
                </motion.div>
              </button>

              {/* Project Info Area */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flex: 1,
                  padding: "4px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
                role="button"
                tabIndex={0}
                aria-label={`${project.name}${project.description ? ` - ${project.description}` : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  // Optional: Add project selection logic here
                  // For now, we'll just expand/collapse as well
                  onToggleProject(project.id);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--theme-bg-secondary)";
                  if (project.description?.trim()) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onProjectHover(project, {
                      x: rect.right + 8,
                      y: rect.top + rect.height / 2
                    });
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  onProjectHover(null);
                }}
              >
                <Folder size={16} color={project.color} fill={project.color} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    flex: 1,
                    fontWeight: "500",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {project.name}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--theme-text-secondary)",
                    flexShrink: 0,
                  }}
                >
                  {projectCanvases.length}
                </span>
              </div>
            </div>

            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden" }}
                >
                  {projectCanvases.map((canvas) => (
                    <div
                      key={canvas.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 8px",
                        marginLeft: "20px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        transition: "background-color 0.2s ease",
                        backgroundColor:
                          selectedCanvasId === canvas.id
                            ? "var(--theme-bg-active)"
                            : "transparent",
                      }}
                      onClick={() => onCanvasSelect(canvas)}
                      onContextMenu={(e) => onCanvasRightClick(e, canvas)}
                      onMouseEnter={(e) => {
                        if (selectedCanvasId !== canvas.id) {
                          e.currentTarget.style.background = "var(--theme-bg-hover)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedCanvasId !== canvas.id) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <FileText size={12} />
                      <span
                        style={{
                          flex: 1,
                          fontSize: "13px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {canvas.name}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--theme-text-secondary)",
                          flexShrink: 0,
                        }}
                      >
                        {formatDate(canvas.createdAt)}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
            })}

            {/* Show More/Less button */}
            {hasMoreProjects && (
              <button
                onClick={onShowAllProjectsToggle}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  width: "100%",
                  padding: "6px 12px",
                  marginTop: "4px",
                  background: "transparent",
                  border: "1px dashed var(--theme-border-secondary, rgba(0, 0, 0, 0.15))",
                  borderRadius: "6px",
                  color: "var(--theme-text-secondary)",
                  fontSize: "11px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--theme-bg-hover, rgba(0, 0, 0, 0.05))";
                  e.currentTarget.style.borderColor = "var(--theme-border-primary)";
                  e.currentTarget.style.borderStyle = "solid";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "var(--theme-border-secondary, rgba(0, 0, 0, 0.15))";
                  e.currentTarget.style.borderStyle = "dashed";
                }}
              >
                {showAllProjects ? (
                  <>
                    Show Less ({sortedProjects.length - PROJECT_SORT_CONSTANTS.DEFAULT_PAGINATION_LIMIT} hidden)
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m18 15-6-6-6 6"/>
                    </svg>
                  </>
                ) : (
                  <>
                    Show More ({sortedProjects.length - PROJECT_SORT_CONSTANTS.DEFAULT_PAGINATION_LIMIT} more)
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </>
                )}
              </button>
            )}
      </>
    </div>
  );
}