export const stripHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/&nbsp;/g, ' ')    // Replace non-breaking spaces
    .replace(/&amp;/g, '&')     // Replace ampersand
    .replace(/&lt;/g, '<')      // Replace less than
    .replace(/&gt;/g, '>')      // Replace greater than
    .replace(/&quot;/g, '"')    // Replace quotes
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim();
};
