import clsx from "clsx";

import styles from "./WorkspaceModeToggle.module.scss";

export type WorkspaceMode = "whiteboard" | "3d";

type WorkspaceModeToggleProps = {
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
};

const MODE_DESCRIPTIONS: Record<WorkspaceMode, string> = {
  whiteboard: "Hand-drawn canvas",
  "3d": "Editing 3D space",
};

export const WorkspaceModeToggle = ({
  mode,
  onChange,
}: WorkspaceModeToggleProps) => {
  return (
    <div className={styles.container}>
      <span className={styles.label}>Workspace</span>
      <div
        role="group"
        aria-label="Workspace mode"
        className={styles.toggleGroup}
      >
        <button
          type="button"
          className={clsx(styles.toggle, {
            [styles.active]: mode === "whiteboard",
          })}
          aria-pressed={mode === "whiteboard"}
          onClick={() => onChange("whiteboard")}
        >
          Whiteboard
        </button>
        <button
          type="button"
          className={clsx(styles.toggle, { [styles.active]: mode === "3d" })}
          aria-pressed={mode === "3d"}
          onClick={() => onChange("3d")}
        >
          3D Mode
        </button>
      </div>
      <span className={styles.helperText}>{MODE_DESCRIPTIONS[mode]}</span>
    </div>
  );
};
