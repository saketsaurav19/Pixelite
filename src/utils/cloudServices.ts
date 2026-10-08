/**
 * Utility for cloud storage and public image sharing services
 */

const DEFAULT_IMGUR_CLIENT_ID = 'e9f4a138c21a415'; // Public anonymous client ID
const DEFAULT_IMAGEBB_API_KEY = '646b97645f782c5a278149f127419163'; // Default public API key

/**
 * Uploads a base64 image to Imgur.
 */
export const uploadToImgur = async (base64Image: string, customClientId?: string): Promise<string> => {
  const clientId = customClientId?.trim() || DEFAULT_IMGUR_CLIENT_ID;
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  let response: Response | null = null;

  try {
    response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${clientId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Data,
        type: 'base64',
      }),
    });
  } catch (err) {
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://api.imgur.com/3/image');
    response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${clientId}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Data,
        type: 'base64',
      }),
    });
  }

  if (response && response.ok) {
    const data = await response.json();
    if (data.success) {
      return data.data.link;
    }
    throw new Error(data.data?.error || data.data?.message || 'Failed to upload to Imgur');
  }
  throw new Error('Failed to connect to Imgur');
};

/**
 * Uploads a base64 image to ImageBB.
 */
export const uploadToImageBB = async (base64Image: string, customApiKey?: string): Promise<string> => {
  const apiKey = customApiKey?.trim() || DEFAULT_IMAGEBB_API_KEY;
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  const formData = new FormData();
  formData.append('image', base64Data);

  let response: Response | null = null;

  try {
    response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });
  } catch (err) {
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(`https://api.imgbb.com/1/upload?key=${apiKey}`);
    response = await fetch(proxyUrl, {
      method: 'POST',
      body: formData,
    });
  }

  if (response && response.ok) {
    const data = await response.json();
    if (data.success) {
      return data.data.url;
    }
    throw new Error(data.error?.message || 'Failed to upload to ImageBB');
  }
  throw new Error('Failed to connect to ImageBB');
};

/**
 * Uploads a base64 image to Catbox / Litterbox (free temporary & permanent public image host).
 */
export const uploadToCatbox = async (base64Image: string, time: '24h' | '72h' | '1h' = '72h'): Promise<string> => {
  const mimeMatch = base64Image.match(/data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  const binary = atob(base64Data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([array], { type: mimeType });

  const formData = new FormData();
  formData.append('reqtype', 'fileupload');
  formData.append('time', time);
  formData.append('fileToUpload', blob, `pixelite_${Date.now()}.${mimeType.split('/')[1] || 'png'}`);

  try {
    const response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const link = await response.text();
      if (link && link.startsWith('http')) {
        return link.trim();
      }
    }
  } catch (e) {
    // Retry with CORS proxy
  }

  // CORS Proxy Fallback
  const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://litterbox.catbox.moe/resources/internals/api.php');
  const response = await fetch(proxyUrl, {
    method: 'POST',
    body: formData,
  });

  if (response.ok) {
    const link = await response.text();
    if (link && link.startsWith('http')) {
      return link.trim();
    }
  }

  throw new Error('Failed to upload image to Catbox/Litterbox');
};

/**
 * Uploads a base64 image to FreeImageHost.
 */
export const uploadToFreeImageHost = async (base64Image: string, apiKey = '6d207e6079293d48382d422345673491'): Promise<string> => {
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const formData = new FormData();
  formData.append('key', apiKey);
  formData.append('action', 'upload');
  formData.append('source', base64Data);
  formData.append('format', 'json');

  let response: Response | null = null;

  try {
    response = await fetch('https://freeimage.host/api/1/upload', {
      method: 'POST',
      body: formData,
    });
  } catch (err) {
    // CORS or Network fallback via CORS Proxy
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://freeimage.host/api/1/upload');
    response = await fetch(proxyUrl, {
      method: 'POST',
      body: formData,
    });
  }

  if (response && response.ok) {
    const data = await response.json();
    if (data.status_code === 200 && data.image?.url) {
      return data.image.url;
    }
    throw new Error(data.error?.message || 'Failed to upload to FreeImageHost');
  }

  throw new Error('Failed to fetch from FreeImageHost');
};

/**
 * Unified Public Upload Helper with Automatic Provider Fallback Chain.
 */
export const uploadToPublicHost = async (
  base64Image: string,
  preferredService: string = 'imgur',
  options?: { customImgurClientId?: string; customImageBBKey?: string }
): Promise<{ url: string; service: string }> => {
  const providers = [preferredService, 'imgur', 'imagebb', 'catbox', 'freeimagehost'].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  let lastError: Error | null = null;

  for (const service of providers) {
    try {
      let url = '';
      if (service === 'imgur') {
        url = await uploadToImgur(base64Image, options?.customImgurClientId);
      } else if (service === 'imagebb') {
        url = await uploadToImageBB(base64Image, options?.customImageBBKey);
      } else if (service === 'catbox') {
        url = await uploadToCatbox(base64Image);
      } else if (service === 'freeimagehost' || service === 'postimages') {
        url = await uploadToFreeImageHost(base64Image);
      } else {
        url = await uploadToImgur(base64Image, options?.customImgurClientId);
      }

      if (url) {
        return { url, service };
      }
    } catch (err: any) {
      console.warn(`[PublicHost] Upload failed for provider "${service}". Trying fallback...`, err);
      lastError = err;
    }
  }

  throw lastError || new Error('All public hosting providers failed to upload image');
};

export const saveToGoogleDrive = async (base64Image: string, filename: string, accessToken?: string): Promise<void> => {
  if (!accessToken) {
    throw new Error('Google Drive access token required. Please connect your account first.');
  }

  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  const blob = await (await fetch(`data:image/png;base64,${base64Data}`)).blob();

  const metadata = {
    name: filename,
    mimeType: 'image/png',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to save to Google Drive');
  }
};

export const PUBLIC_HOST_SERVICES = [
  {
    id: 'imgur',
    name: 'Imgur',
    icon: 'Image',
    description: 'Fast public image hosting. Direct PNG/JPG link.',
    badge: 'Popular',
  },
  {
    id: 'imagebb',
    name: 'ImageBB',
    icon: 'Share2',
    description: 'High reliability image sharing service.',
    badge: 'Fast',
  },
  {
    id: 'catbox',
    name: 'Catbox / Litterbox',
    icon: 'CloudUpload',
    description: 'Zero-key, free temporary & permanent public hosting.',
    badge: 'Free',
  },
  {
    id: 'freeimagehost',
    name: 'FreeImageHost',
    icon: 'ExternalLink',
    description: 'Public image host with markdown & BBCode links.',
    badge: 'No Account',
  },
];

export const CLOUD_PROVIDERS = [
  {
    id: 'google_drive',
    name: 'Google Drive',
    icon: 'Cloud',
    color: '#34A853',
    description: 'Save projects directly to your Google Drive.',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: 'Box',
    color: '#0061FF',
    description: 'Keep your designs in sync with Dropbox.',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    icon: 'Cloud',
    color: '#0078D4',
    description: 'Microsoft 365 integration for your workflow.',
  },
];

export interface CloudConnection {
  providerId: string;
  connected: boolean;
  lastSync?: string;
}
