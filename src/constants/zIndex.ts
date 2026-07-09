/**
 * Standardized Z-Index hierarchy for Pixelite.
 * Use these constants to assign layer depths consistently across TSX files.
 */
export const Z_INDEX = {
  // 1. Canvas Base & Layers
  canvasBase: 1,
  canvasLayer: 10,

  // 2. Workspace Layout Bars
  leftToolbar: 1001,
  optionsBar: 1002,
  sidebar: 1050,
  appHeader: 1300,

  // 3. Canvas Interactions & Overlays
  canvasOverlay: 1000,
  lightingOverlay: 1000,
  rulersOverlay: 1000,
  selectionOverlay: 1100,
  vectorOverlay: 1200,
  transformOverlay: 1500,
  slicesOverlay: 1500,
  samplersOverlay: 1600,
  guidesSvgOverlay: 1700,

  // 4. Inline Editors & Overlays (Crop, Text inputs, Artboards)
  cropOverlay: 10000,
  artboardOverlay: 10000,
  draftOverlay: 10000,
  perspectiveCropOverlay: 10000,
  textEditorOverlay: 10001,
  textEditorInput: 10001,
  textEditorSubmit: 20000,

  // 5. Popovers, Dropdowns & Menus
  fontDropdown: 10100,
  contextMenu: 2000,
  dropdownMenu: 2000,
  menuBarActive: 2100,
  colorPickerPopover: 999999, // Render above standard modaux/menus

  // 6. Modal Overlays, Welcome screens & Global alerts
  modalBackdrop: 2000,
  dialogOverlay: 10000,
  welcomeOverlay: 9999,
  systemAlert: 9999,
  globalNotification: 10000
};
