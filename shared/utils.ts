export const checkIsValidUrl = (url: string): boolean => {
  if (url.includes("https://excalidraw.com/")) {
    return true;
  }

  return false;
};
