import type React from "react";
import { useState } from "react";
import clsx from "clsx";

import { t } from "../i18n";

import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { sprayPointerToolIcon, extraToolsIcon } from "./icons";
import { setCursorForShape } from "../cursor";
import {
  MAX_SPRAY_INTENSITY,
  MAX_SPRAY_SIZE,
  MIN_SPRAY_INTENSITY,
  MIN_SPRAY_SIZE,
} from "../constants";

import type { AppClassProperties, AppState, UIAppState } from "../types";

import "./ToolIcon.scss";
import "./SprayPointerButton.scss";

interface SprayPointerButtonProps {
  title?: string;
  checked: boolean;
  onToggle: () => void;
  app: AppClassProperties;
  appState: UIAppState;
  setAppState: React.Component<any, AppState>["setState"];
}

export const SprayPointerButton = ({
  title,
  checked,
  onToggle,
  app,
  appState,
  setAppState,
}: SprayPointerButtonProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSettingsChange = (
    partial: Partial<AppState["sprayPointer"]>,
  ) => {
    const nextSettings = { ...appState.sprayPointer, ...partial };
    setAppState({ sprayPointer: nextSettings });

    if (appState.activeTool.type === "spray") {
      setCursorForShape(app.interactiveCanvas, {
        ...appState,
        sprayPointer: nextSettings,
      });
    }
  };

  return (
    <div className="SprayPointerControl">
      <label
        className={clsx("ToolIcon", "ToolIcon__SprayPointer")}
        title={title}
      >
        <input
          className="ToolIcon_type_checkbox"
          type="checkbox"
          onChange={onToggle}
          checked={checked}
          aria-label={title}
        />
        <div className="ToolIcon__icon">{sprayPointerToolIcon}</div>
      </label>
      <DropdownMenu open={isMenuOpen} placement="bottom">
        <DropdownMenu.Trigger
          className="ToolIcon ToolIcon__spray-settings-trigger"
          onToggle={() => setIsMenuOpen((open) => !open)}
          aria-label={t("toolBar.spray")}
          title={t("toolBar.spray")}
        >
          <div className="ToolIcon__icon">{extraToolsIcon}</div>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={() => setIsMenuOpen(false)}
          className="SprayPointerMenu__dropdown"
        >
          <div className="SprayPointerMenu">
            <label>
              <span>{t("spray.size")}</span>
              <input
                type="range"
                min={MIN_SPRAY_SIZE}
                max={MAX_SPRAY_SIZE}
                step={2}
                value={appState.sprayPointer.size}
                onChange={(event) =>
                  handleSettingsChange({ size: Number(event.target.value) })
                }
              />
              <span className="SprayPointerMenu__value">
                {appState.sprayPointer.size}px
              </span>
            </label>
            <label>
              <span>{t("spray.intensity")}</span>
              <input
                type="range"
                min={MIN_SPRAY_INTENSITY}
                max={MAX_SPRAY_INTENSITY}
                step={1}
                value={appState.sprayPointer.intensity}
                onChange={(event) =>
                  handleSettingsChange({
                    intensity: Number(event.target.value),
                  })
                }
              />
              <span className="SprayPointerMenu__value">
                {appState.sprayPointer.intensity}
              </span>
            </label>
            <label>
              <span>{t("spray.color")}</span>
              <input
                type="color"
                value={appState.sprayPointer.color}
                onChange={(event) =>
                  handleSettingsChange({ color: event.target.value })
                }
                aria-label={t("spray.color")}
              />
            </label>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};
