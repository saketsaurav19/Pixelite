/**
 * Utility for cloud storage and public image sharing services
 */

const IMGUR_CLIENT_ID = 'e9f4a138c21a415'; // Public anonymous client ID for demonstration

export const uploadToImgur = async (base64Image: string): Promise<string> => {
  // Remove data:image/png;base64, prefix
  const base64Data = base64Image.split(',')[1];

  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: base64Data,
      type: 'base64',
    }),
  });

  const data = await response.json();

  if (data.success) {
    return data.data.link;
  } else {
    throw new Error(data.data.error || 'Failed to upload to Imgur');
  }
};

export const uploadToImageBB = async (base64Image: string, apiKey: string = '646b97645f782c5a278149f127419163'): Promise<string> => {
  const base64Data = base64Image.split(',')[1];
  const formData = new FormData();
  formData.append('image', base64Data);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (data.success) {
    return data.data.url;
  } else {
    throw new Error(data.error?.message || 'Failed to upload to ImageBB');
  }
};

export const saveToGoogleDrive = async (base64Image: string, filename: string, accessToken?: string): Promise<void> => {
  if (!accessToken) {
    throw new Error('Google Drive access token required. Please connect your account first.');
  }

  const base64Data = base64Image.split(',')[1];
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

export const CLOUD_PROVIDERS = [
  {
    id: 'google_drive',
    name: 'Google Drive',
    icon: 'Cloud',
    color: '#34A853',
    description: 'Save projects directly to your Google Drive.'
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: 'Box',
    color: '#0061FF',
    description: 'Keep your designs in sync with Dropbox.'
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    icon: 'Cloud',
    color: '#0078D4',
    description: 'Microsoft 364 integration for your workflow.'
  }
];

export interface CloudConnection {
  providerId: string;
  connected: boolean;
  lastSync?: string;
}
