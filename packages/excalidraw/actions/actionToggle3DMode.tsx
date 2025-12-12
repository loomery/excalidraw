import { KEYS } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";
import { register } from "./register";

export const actionToggle3DMode = register({
  name: "toggle3DMode",
  label: "buttons.toggle3DMode",
  keywords: ["3d", "three", "dimension"],
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.threeDModeEnabled,
  },
  perform(elements, appState) {
    const newValue = !this.checked!(appState);
    console.log("Toggling 3D mode:", { from: appState.threeDModeEnabled, to: newValue });
    return {
      appState: {
        ...appState,
        threeDModeEnabled: newValue,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.threeDModeEnabled,
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.altKey && event.key === "3",
});
