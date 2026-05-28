import QRCode from 'qrcode';

/**
 * Generate a QR code data URL for a room code.
 * Opens a URL that can be scanned to join the room.
 */
export async function generateRoomQR(roomCode: string): Promise<string> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sharedspace-ar.app';
  const joinUrl = `${baseUrl}/ar/${roomCode}`;

  try {
    const dataUrl = await QRCode.toDataURL(joinUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });

    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR code:', err);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate a QR code as a canvas element.
 */
export async function generateRoomQRCanvas(
  roomCode: string,
  size: number = 256
): Promise<HTMLCanvasElement> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sharedspace-ar.app';
  const joinUrl = `${baseUrl}/ar/${roomCode}`;

  try {
    const canvas = await QRCode.toCanvas(joinUrl, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });

    return canvas;
  } catch (err) {
    console.error('Failed to generate QR canvas:', err);
    throw new Error('Failed to generate QR code');
  }
}
