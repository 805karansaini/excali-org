import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { useUnifiedState } from "../context/UnifiedStateProvider";
import { getExtensionShortcuts } from "../hooks/useKeyboardShortcuts";


export function HelpOverlay() {
  const { dispatch } = useUnifiedState();
  const focusRef = useRef<HTMLDivElement>(null);

  // Auto-focus and trap focus within the modal
  useEffect(() => {
    const element = focusRef.current;
    if (!element) return;

    // Delay focus slightly to ensure the modal is fully rendered
    const focusTimeout = setTimeout(() => {
      element.focus();
    }, 100);

    // Trap focus
    const handleFocusTrap = (e: FocusEvent) => {
      if (
        e.target instanceof Node &&
        !element.contains(e.target)
      ) {
        element.focus();
      }
    };

    document.addEventListener("focusin", handleFocusTrap);

    return () => {
      clearTimeout(focusTimeout);
      document.removeEventListener("focusin", handleFocusTrap);
    };
  }, []);

  // Note: ESC key handling is done in the main keyboard shortcuts handler

  const shortcuts = getExtensionShortcuts();

  // Helper function to safely get shortcut or fallback
  const getShortcut = (key: string): string => {
    return shortcuts?.shortcuts?.[key as keyof typeof shortcuts.shortcuts] || "Not available";
  };

  // Group shortcuts by category
  const shortcutGroups = [
    {
      title: "Navigation",
      shortcuts: [
        { action: "Toggle Panel", shortcut: getShortcut("Toggle Panel") },
        { action: "Navigate Canvases", shortcut: getShortcut("Navigate Canvases") },
        { action: "Search", shortcut: getShortcut("Search") },
      ]
    },
    {
      title: "Canvas Operations",
      shortcuts: [
        { action: "New Canvas", shortcut: getShortcut("New Canvas") },
        { action: "Duplicate Canvas", shortcut: getShortcut("Duplicate Canvas") },
        { action: "Delete Canvas", shortcut: getShortcut("Delete Canvas") },
        { action: "Rename Canvas", shortcut: getShortcut("Rename Canvas") },
      ]
    },
    {
      title: "Project Operations",
      shortcuts: [
        { action: "New Project", shortcut: getShortcut("New Project") },
      ]
    },
    {
      title: "System",
      shortcuts: [
        { action: "Refresh Data", shortcut: getShortcut("Refresh Data") },
        { action: "Help", shortcut: getShortcut("Help") },
        { action: "Close Modals / Focus Panel", shortcut: getShortcut("Close Modals / Focus Panel") },
      ]
    }
  ];

  const panelStyles: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999999,
    pointerEvents: "auto",
    backdropFilter: "blur(4px)",
  };

  const modalStyles: React.CSSProperties = {
    width: "100%",
    maxWidth: "700px",
    maxHeight: "80vh",
    background: "var(--theme-bg-primary, #ffffff)",
    border: "1px solid var(--theme-border-primary, rgba(0, 0, 0, 0.1))",
    borderRadius: "16px",
    boxShadow: "var(--theme-shadow-lg, 0 20px 40px rgba(0, 0, 0, 0.2))",
    overflow: "hidden",
    margin: "0 16px",
    display: "flex",
    flexDirection: "column",
  };

  const headerStyles: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "24px 32px",
    borderBottom: "1px solid var(--theme-border-primary, rgba(0, 0, 0, 0.1))",
    background: "var(--theme-bg-secondary, #f8f9fa)",
  };

  const bodyStyles: React.CSSProperties = {
    padding: "32px",
    overflowY: "auto",
    flex: 1,
  };

  const keyStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    background: "var(--theme-bg-key, var(--theme-bg-tertiary, rgba(0, 0, 0, 0.08)))",
    color: "var(--theme-text-key, var(--theme-text-primary, #333333))",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, 'Cascadia Code', 'Segoe UI Mono', 'Roboto Mono', 'Oxygen Mono', 'Ubuntu Monospace', 'Source Code Pro', 'Fira Code', 'Droid Sans Mono', 'Courier New', monospace",
    border: "1px solid var(--theme-border-key, var(--theme-border-secondary, rgba(0, 0, 0, 0.1)))",
    boxShadow: "var(--theme-shadow-key, 0 1px 2px rgba(0, 0, 0, 0.1))",
    minWidth: "24px",
    justifyContent: "center",
  };

  const renderShortcutKey = (shortcut: string) => {
    const keys = shortcut.split(' + ');
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {keys.map((key, index) => (
          <React.Fragment key={index}>
            <span style={keyStyles}>{key}</span>
            {index < keys.length - 1 && <span style={{ color: "var(--theme-text-secondary, #666666)", fontSize: "12px" }}>+</span>}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return createPortal(
    <motion.div
      style={panelStyles}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          dispatch({ type: "SET_HELP_MODAL_OPEN", payload: false });
        }
      }}
    >
      <motion.div
        style={modalStyles}
        initial={{ scale: 0.9, y: -50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: -50 }}
        transition={{ type: "spring", damping: 30, stiffness: 400 }}
        ref={focusRef}
        tabIndex={-1}
      >
        <div style={headerStyles}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Keyboard
              size={24}
              style={{ color: "var(--theme-text-primary, #333333)" }}
            />
            <h2 style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: "600",
              color: "var(--theme-text-primary, #333333)"
            }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={() => dispatch({ type: "SET_HELP_MODAL_OPEN", payload: false })}
            style={{
              background: "none",
              border: "none",
              padding: "8px",
              cursor: "pointer",
              borderRadius: "6px",
              color: "var(--theme-text-secondary, #666666)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--theme-bg-hover, rgba(0, 0, 0, 0.05))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={bodyStyles}>
          <div style={{ display: "grid", gap: "32px" }}>
            {shortcutGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                <h3 style={{
                  margin: "0 0 16px 0",
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "var(--theme-text-primary, #333333)"
                }}>
                  {group.title}
                </h3>
                <div style={{ display: "grid", gap: "12px" }}>
                  {group.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        background: "var(--theme-bg-shortcut, var(--theme-bg-secondary, rgba(0, 0, 0, 0.03)))",
                        borderRadius: "8px",
                        border: "1px solid var(--theme-border-shortcut, var(--theme-border-secondary, rgba(0, 0, 0, 0.05)))",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span style={{
                        fontSize: "14px",
                        color: "var(--theme-text-primary, #333333)",
                        fontWeight: "500",
                      }}>
                        {shortcut.action}
                      </span>
                      {renderShortcutKey(shortcut.shortcut)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: "32px",
            padding: "16px",
            background: "var(--theme-bg-info, rgba(59, 130, 246, 0.1))",
            borderRadius: "8px",
            border: "1px solid var(--theme-border-info, rgba(59, 130, 246, 0.2))",
          }}>
            <p style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--theme-text-info, var(--theme-text-primary, #333333))",
              lineHeight: "1.5",
            }}>
              <strong>Note:</strong> These shortcuts work globally within Excalidraw, even when you're actively drawing or typing. Press <strong>Escape</strong> to close this help or any modal.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
