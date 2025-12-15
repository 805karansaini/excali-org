import { v4 as uuidv4 } from "uuid";
import { CANVAS_DEFAULTS } from "./constants";
import { ExcalidrawElement } from "./excalidraw-types";
import { UnifiedCanvas } from "./types";

export interface CanvasFactoryOptions {
  existingNames: string[];
  baseName?: string;
  width?: number;
  height?: number;
  theme?: "light" | "dark";
}

const makeUniqueName = (existingNames: string[], baseName: string): string => {
  let counter = 1;
  let candidate = baseName;

  while (existingNames.includes(candidate)) {
    candidate = `${baseName} ${counter}`;
    counter += 1;
  }

  return candidate;
};

export const createDefaultCanvas = ({
  existingNames,
  baseName = CANVAS_DEFAULTS.BASE_NAME,
  width = CANVAS_DEFAULTS.DEFAULT_WIDTH,
  height = CANVAS_DEFAULTS.DEFAULT_HEIGHT,
  theme = "light",
}: CanvasFactoryOptions): UnifiedCanvas => {
  const name = makeUniqueName(existingNames, baseName);
  const now = new Date();

  const textElement: ExcalidrawElement = {
    id: uuidv4(),
    type: "text",
    x: 100,
    y: 100,
    width: 250,
    height: 50,
    angle: 0,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    text: `Welcome to ${name}!`,
    fontSize: 20,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    originalText: `Welcome to ${name}!`,
    lineHeight: 1.25,
    version: 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    roundness: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };

  return {
    id: uuidv4(),
    name,
    elements: [textElement],
    appState: {
      zoom: { value: 1 },
      scrollX: 0,
      scrollY: 0,
      width,
      height,
      viewBackgroundColor: "#ffffff",
      theme,
      selectedElementIds: {},
      editingGroupId: null,
      viewModeEnabled: false,
      currentItemFontSize: 20,
      currentItemStrokeColor: "#000000",
    },
    createdAt: now,
    updatedAt: now,
    projectId: undefined,
  };
};
