/** Signals screenshot specs that a gallery (or view) has rendered its content. */
export function markGalleryReady(): void {
  document.body.dataset.galleryReady = "1";
}
