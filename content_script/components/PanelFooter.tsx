import { Github, HelpCircle } from "lucide-react";

interface PanelFooterProps {
  onHelpOpen: () => void;
}

export function PanelFooter({ onHelpOpen }: PanelFooterProps) {
  return (
    <div
      style={{
        borderTop: `1px solid var(--theme-border-primary)`,
        padding: "12px 16px",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
      }}
    >
      <a
        href="https://github.com/805karansaini/excali-org"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: "var(--theme-text-secondary)",
          textDecoration: "none",
          fontSize: "12px",
          padding: "4px 6px",
          borderRadius: "4px",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--theme-bg-hover)";
          e.currentTarget.style.color = "var(--theme-text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--theme-text-secondary)";
        }}
        title="Visit GitHub Profile"
      >
        <Github size={14} />
        <span>GitHub</span>
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
          transition: "all 0.2s ease",
        }}
        onClick={onHelpOpen}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--theme-bg-hover)";
          e.currentTarget.style.color = "var(--theme-text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--theme-text-secondary)";
        }}
        title="Show Keyboard Shortcuts (F1)"
      >
        <HelpCircle size={16} />
      </button>
    </div>
  );
}