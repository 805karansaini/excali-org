import { Plus, Search, Pin, PinOff, FolderPlus } from "lucide-react";

interface PanelHeaderProps {
  isPanelPinned: boolean;
  onTogglePin: () => void;
  onNewCanvas: () => void;
  onNewProject: () => void;
  onSearchOpen: () => void;
  shortcuts: Record<string, string>;
}

export function PanelHeader({
  isPanelPinned,
  onTogglePin,
  onNewCanvas,
  onNewProject,
  onSearchOpen,
  shortcuts,
}: PanelHeaderProps) {
  return (
    <div
      style={{
        padding: "16px",
        borderBottom: `1px solid var(--theme-border-primary)`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <a
          href="https://excali.org"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            cursor: "pointer",
            textDecoration: "none",
            transition: "all 0.3s ease",
            borderRadius: "8px",
            padding: "4px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.02)";
            const glow = e.currentTarget.querySelector('.icon-glow') as HTMLElement;
            if (glow) {
              glow.style.opacity = "0.3";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            const glow = e.currentTarget.querySelector('.icon-glow') as HTMLElement;
            if (glow) {
              glow.style.opacity = "0";
            }
          }}
        >
          <div style={{ position: "relative" }}>
            <img
              src={chrome.runtime.getURL("icon-64.png")}
              alt="Excali Organizer"
              style={{
                width: "32px",
                height: "32px",
                display: "block",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "0",
                background: "linear-gradient(135deg, var(--theme-accent-primary, #6366f1), var(--theme-accent-secondary, #8b5cf6))",
                borderRadius: "50%",
                filter: "blur(12px)",
                opacity: "0",
                transition: "opacity 0.3s ease",
                zIndex: "-1",
              }}
              className="icon-glow"
            />
          </div>
          <span
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              background: "linear-gradient(135deg, var(--theme-accent-primary, #6366f1), var(--theme-accent-secondary, #8b5cf6))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              transition: "all 0.3s ease",
            }}
          >
            Excali Organizer
          </span>
        </a>
        <button
          style={{
            background: "transparent",
            border: "none",
            color: "var(--theme-text-secondary)",
            cursor: "pointer",
            padding: "4px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            opacity: isPanelPinned ? 1 : 0.6,
            transition: "opacity 0.2s ease",
          }}
          onClick={onTogglePin}
          title={isPanelPinned ? "Unpin panel" : "Pin panel"}
        >
          {isPanelPinned ? (
            <Pin size={16} />
          ) : (
            <PinOff size={16} />
          )}
        </button>
      </div>

      <button
        style={{
          background:
            "linear-gradient(135deg, var(--theme-accent-primary, #6366f1), var(--theme-accent-secondary, #8b5cf6))",
          color: "var(--theme-text-on-accent, #ffffff)",
          border: "none",
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "14px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          width: "100%",
          marginBottom: "8px",
          transition: "transform 0.1s ease",
        }}
        onClick={onNewCanvas}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "scale(0.98)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <Plus size={16} />
        <span>New Canvas</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "12px",
            opacity: 0.8,
            fontFamily: "monospace",
          }}
        >
          {shortcuts["New Canvas"]}
        </span>
      </button>

      <button
        style={{
          background: "var(--theme-bg-active)",
          color: "var(--theme-text-secondary)",
          border: `1px solid var(--theme-border-primary)`,
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "14px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          width: "100%",
          marginBottom: "8px",
          transition: "background-color 0.2s ease",
        }}
        onClick={onNewProject}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--theme-bg-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--theme-bg-active)";
        }}
      >
        <FolderPlus size={16} />
        <span>New Project</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "12px",
            opacity: 0.7,
            fontFamily: "monospace",
          }}
        >
          {shortcuts["New Project"]}
        </span>
      </button>

      <button
        style={{
          background: "var(--theme-bg-active)",
          color: "var(--theme-text-secondary)",
          border: `1px solid var(--theme-border-primary)`,
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "14px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          width: "100%",
          transition: "background-color 0.2s ease",
        }}
        onClick={onSearchOpen}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--theme-bg-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--theme-bg-active)";
        }}
      >
        <Search size={16} />
        <span>Search canvases...</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "12px",
            opacity: 0.7,
            fontFamily: "monospace",
          }}
        >
          {shortcuts["Search"]}
        </span>
      </button>
    </div>
  );
}