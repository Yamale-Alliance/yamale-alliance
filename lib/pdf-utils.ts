/**
 * Utility functions for PDF exports
 */

/**
 * Get platform logo URL for PDF exports (server-side)
 * Use this in PDF generation code to include the logo
 */
export async function getLogoForPDF(): Promise<string | null> {
  try {
    const { getPlatformLogo } = await import('@/lib/platform-settings');
    return await getPlatformLogo();
  } catch (error) {
    console.error('Failed to get logo for PDF:', error);
    return null;
  }
}

/**
 * Get platform favicon URL (server-side)
 */
export async function getFaviconForPDF(): Promise<string | null> {
  try {
    const { getPlatformFavicon } = await import('@/lib/platform-settings');
    return await getPlatformFavicon();
  } catch (error) {
    console.error('Failed to get favicon:', error);
    return null;
  }
}
