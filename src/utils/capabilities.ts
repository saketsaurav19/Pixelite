// capabilities — central feature-flag / capability gates.
//
// Several menu features depend on optional infrastructure that may not be
// present at runtime (local AI models, WebRTC signaling, a backend server,
// etc.). Rather than shipping fake "coming soon" alerts, we expose a single
// query helper and a menu entry factory so disabled features render as
// greyed-out, tooltipped items that explain *why* they're unavailable.

export interface Capability {
  /** Whether the feature is currently usable. */
  available: boolean;
  /** Human-readable reason shown in the tooltip when unavailable. */
  reason: string;
}

/**
 * Inspect the environment to decide whether an optional capability is present.
 * Extend this as new feature backends are added — keep the logic here so menu
 * code stays declarative.
 */
export function getCapability(name: CapabilityName): Capability {
  switch (name) {
    case 'ai_image_models':
      // Requires a configured local model backend (e.g. LaMa / MAT for inpaint).
      // Today no backend is wired, so report unavailable.
      return {
        available: false,
        reason: 'Requires a local AI model backend (not configured).',
      };
    case 'webrtc_share':
      // WebRTC data channels are always available in modern browsers; the live
      // share feature is functional.
      return { available: true, reason: '' };
    case 'smart_objects':
      return { available: false, reason: 'Smart Objects are not implemented yet.' };
    case 'indexed_color':
      return { available: false, reason: 'Indexed color mode is not implemented yet.' };
    default:
      return { available: false, reason: 'Feature unavailable.' };
  }
}

export type CapabilityName =
  | 'ai_image_models'
  | 'webrtc_share'
  | 'smart_objects'
  | 'indexed_color';
