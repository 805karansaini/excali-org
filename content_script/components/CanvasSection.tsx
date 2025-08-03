import { FileText } from "lucide-react";
import { UnifiedCanvas } from "../../shared/types";

interface CanvasSectionProps {
  unorganizedCanvases: UnifiedCanvas[];
  selectedCanvasId: string | null;
  onCanvasSelect: (canvas: UnifiedCanvas) => void;
  onCanvasRightClick: (e: React.MouseEvent, canvas: UnifiedCanvas) => void;
  formatDate: (date: Date) => string;
}

export function CanvasSection({
  unorganizedCanvases,
  selectedCanvasId,
  onCanvasSelect,
  onCanvasRightClick,
  formatDate,
}: CanvasSectionProps) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          fontSize: "12px",
          fontWeight: "600",
          textTransform: "uppercase",
          color: "var(--theme-text-secondary)",
          marginBottom: "8px",
          letterSpacing: "0.5px",
        }}
      >
        Recent
      </div>

      {unorganizedCanvases.length > 0 ? (
        unorganizedCanvases
          .sort(
            (a, b) =>
              // Sort by creation time (newest first) for stable, predictable order
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              // TODO LATERCOMMENTED: Sort by last edit time (canvases move when edited)
              // new Date(b.lastEditedAt || b.createdAt).getTime() -
              // new Date(a.lastEditedAt || a.createdAt).getTime(),
          )
          .map((canvas) => (
            <div
              key={canvas.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px",
                borderRadius: "6px",
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
              <FileText size={16} />
              <span
                style={{
                  flex: 1,
                  fontWeight: "500",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {canvas.name}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--theme-text-secondary)",
                  flexShrink: 0,
                }}
              >
                {formatDate(canvas.createdAt)}
                {/* COMMENTED: Show last edit time instead of creation time */}
                {/* {formatDate(canvas.lastEditedAt || canvas.createdAt)} */}
              </span>
            </div>
          ))
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "32px 16px",
            color: "var(--theme-text-secondary)",
          }}
        >
          <FileText
            size={48}
            style={{ opacity: 0.5, marginBottom: "12px" }}
          />
          <div style={{ fontWeight: "500", marginBottom: "4px" }}>
            No canvases yet
          </div>
          <div style={{ fontSize: "12px" }}>
            Create your first canvas to get started
          </div>
        </div>
      )}
    </div>
  );
}