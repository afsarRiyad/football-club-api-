
const extractPublicId = (cloudinaryUrl) => {
  if (!cloudinaryUrl) return null;

  // Match the part after /upload/ and before the file extension
  const match = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?(.+?)\.\w+$/);
  return match ? match[1] : null;
};

/**
 * Determine if a URL points to a video on Cloudinary.
 */
const isVideoUrl = (url) => {
  if (!url) return false;
  return /\/video\//.test(url);
};

/**
 * Build a Cloudinary transformation URL.
 * @param {string} url - Original Cloudinary URL
 * @param {object} options - Transformation options
 * @returns {string} Transformed URL
 */
const getTransformedUrl = (url, options = {}) => {
  if (!url) return url;

  const transformations = [];
  if (options.width) transformations.push(`w_${options.width}`);
  if (options.height) transformations.push(`h_${options.height}`);
  if (options.crop) transformations.push(`c_${options.crop}`);
  if (options.quality) transformations.push(`q_${options.quality}`);
  if (options.format) transformations.push(`f_${options.format}`);
  if (options.radius) transformations.push(`r_${options.radius}`);

  if (transformations.length === 0) return url;

  return url.replace("/upload/", `/upload/${transformations.join(",")}/`);
};

module.exports = {
  extractPublicId,
  isVideoUrl,
  getTransformedUrl,
};
