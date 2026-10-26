/**
 * Multimodal PDF & Image Extractor Service - Daniel AI Learning System
 * Dynamically loads Mozilla PDF.js (v3.11.174) when needed, extracts embedded text,
 * reads native PDF base64 payloads, and renders up to 15 scanned CamScanner PDF pages
 * & images into high-clarity JPEG snapshots (`scale: 1.35`, `quality: 0.78`)
 * for Gemini Vision multimodal processing.
 */

const PDFJS_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let _pdfJsLoadingPromise = null;

/**
 * Ensures `window.pdfjsLib` is loaded and configured with its worker.
 * @returns {Promise<object>}
 */
function ensurePdfJsLoaded() {
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    if (window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN_URL;
    }
    return Promise.resolve(window.pdfjsLib);
  }

  if (_pdfJsLoadingPromise) {
    return _pdfJsLoadingPromise;
  }

  _pdfJsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN_URL;
        resolve(window.pdfjsLib);
      } else {
        _pdfJsLoadingPromise = null;
        reject(new Error('PDF.js נטען אך window.pdfjsLib אינו זמין.'));
      }
    };
    script.onerror = () => {
      _pdfJsLoadingPromise = null;
      reject(new Error('כשל בטעינת ספריית PDF.js מהרשת.'));
    };
    document.head.appendChild(script);
  });

  return _pdfJsLoadingPromise;
}

/**
 * Reads a File as an ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`שגיאה בקריאת הקובץ: ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Reads a File as a raw base64 string (without the `data:...;base64,` prefix) via FileReader.readAsDataURL.
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsRawBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64WithoutPrefix = dataUrl.replace(/^data:[^;]+;base64,/, '');
      resolve(base64WithoutPrefix);
    };
    reader.onerror = () => reject(new Error(`שגיאה בקריאת קובץ ל-Base64: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Reads an image File, resizes it on an offscreen canvas (max dimension 1600px),
 * and encodes as JPEG quality 0.78 base64 with `dataUrl`.
 * @param {File} file
 * @param {number} pageNumber
 * @returns {Promise<{ mimeType: string, data: string, pageNumber: number, dataUrl: string }>}
 */
function processImageFileToBase64(file, pageNumber) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1600;
          let width = img.naturalWidth || img.width || 1200;
          let height = img.naturalHeight || img.height || 1600;

          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
          const base64WithoutPrefix = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
          resolve({
            mimeType: 'image/jpeg',
            data: base64WithoutPrefix,
            pageNumber,
            dataUrl: 'data:image/jpeg;base64,' + base64WithoutPrefix
          });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error(`שגיאה בפענוח תמונה: ${file.name}`));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error(`שגיאה בקריאת תמונה: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts text, native PDF base64 payload, and rendered page snapshots from a single PDF file
 * (up to `maxPagesRemaining = 15`).
 * If `ensurePdfJsLoaded()` fails for any network/CDN reason, gracefully falls back to returning
 * the native `application/pdf` base64 object so Gemini Vision reads the PDF directly.
 * @param {File} file
 * @param {number} startPageOffset
 * @param {number} maxPagesRemaining
 * @param {function} [onProgress]
 * @returns {Promise<{ text: string, images: Array, pageSnapshots: Array, rawPdfPart: object|null, pagesProcessed: number }>}
 */
async function processPdfFile(file, startPageOffset = 0, maxPagesRemaining = 15, onProgress = null) {
  let rawPdfBase64 = '';
  try {
    rawPdfBase64 = await readFileAsRawBase64(file);
  } catch (readErr) {
    console.warn('[PDFExtractor] Could not read raw PDF base64:', readErr);
  }

  const rawPdfPart = rawPdfBase64
    ? {
        mimeType: 'application/pdf',
        data: rawPdfBase64,
        pageNumber: startPageOffset + 1,
        isNativePdf: true
      }
    : null;

  let pdfjsLib = null;
  try {
    pdfjsLib = await ensurePdfJsLoaded();
  } catch (cdnErr) {
    console.warn('[PDFExtractor] PDF.js CDN unavailable, falling back to native PDF payload:', cdnErr);
    const fallbackImages = rawPdfPart ? [rawPdfPart] : [];
    return {
      text: '',
      images: fallbackImages,
      pageSnapshots: [],
      rawPdfPart,
      pagesProcessed: 1
    };
  }

  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

    const numPages = Math.min(pdfDoc.numPages, maxPagesRemaining);
    const pageTexts = [];
    const pageSnapshots = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const globalPageNumber = startPageOffset + pageNum;
      if (typeof onProgress === 'function') {
        onProgress(`קורא וסורק עמוד ${pageNum} מתוך ${numPages} בקובץ השיעור...`);
      }

      const page = await pdfDoc.getPage(pageNum);

      // 1. Extract selectable/embedded text while preserving line breaks, table rows & numbered questions
      try {
        const textContent = await page.getTextContent();
        const items = Array.isArray(textContent.items) ? textContent.items : [];
        let reconstructed = '';
        let prevY = null;

        for (const item of items) {
          const chunk = typeof item.str === 'string' ? item.str : '';
          const currY = (Array.isArray(item.transform) && typeof item.transform[5] === 'number')
            ? item.transform[5]
            : null;

          if (prevY !== null && currY !== null && Math.abs(currY - prevY) > 4) {
            if (!reconstructed.endsWith('\n')) {
              reconstructed += '\n';
            }
          } else if (
            reconstructed &&
            !reconstructed.endsWith('\n') &&
            !reconstructed.endsWith(' ') &&
            chunk &&
            !chunk.startsWith(' ')
          ) {
            reconstructed += ' ';
          }

          reconstructed += chunk;

          if (item.hasEOL) {
            if (!reconstructed.endsWith('\n')) {
              reconstructed += '\n';
            }
            prevY = null;
          } else if (currY !== null) {
            prevY = currY;
          }
        }

        const pageStr = reconstructed
          .split('\n')
          .map(line => line.replace(/[ \t]+/g, ' ').trim())
          .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
          .join('\n')
          .trim();

        if (pageStr) {
          pageTexts.push(`--- עמוד ${globalPageNumber} ---\n${pageStr}`);
        }
      } catch (textErr) {
        console.warn(`[PDFExtractor] Failed extracting text from page ${pageNum}:`, textErr);
      }

      // 2. Render page onto offscreen canvas (scale 1.35, JPEG quality 0.78) for optimal Hebrew table/text clarity
      try {
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        const base64WithoutPrefix = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

        pageSnapshots.push({
          mimeType: 'image/jpeg',
          data: base64WithoutPrefix,
          pageNumber: globalPageNumber,
          dataUrl: 'data:image/jpeg;base64,' + base64WithoutPrefix
        });
      } catch (renderErr) {
        console.warn(`[PDFExtractor] Failed rendering page ${pageNum} to image:`, renderErr);
      }
    }

    const hasRenderedSnapshots = pageSnapshots.length > 0;
    const sendRawPdfWithImages = !hasRenderedSnapshots;
    const images = hasRenderedSnapshots
      ? [...pageSnapshots]
      : (rawPdfPart ? [rawPdfPart] : []);
    const fallbackRawPdfPart = sendRawPdfWithImages ? rawPdfPart : null;

    return {
      text: pageTexts.join('\n\n'),
      images,
      pageSnapshots,
      rawPdfPart: fallbackRawPdfPart,
      sendRawPdfWithImages,
      pagesProcessed: numPages
    };
  } catch (pdfParseErr) {
    console.warn('[PDFExtractor] Error parsing PDF with PDF.js, using native PDF fallback:', pdfParseErr);
    const fallbackImages = rawPdfPart ? [rawPdfPart] : [];
    return {
      text: '',
      images: fallbackImages,
      pageSnapshots: [],
      rawPdfPart,
      pagesProcessed: 1
    };
  }
}

const PDFExtractor = {
  /**
   * Accepts one or more uploaded files (.pdf or .jpg/.jpeg/.png/.webp) and an optional
   * `onProgress(statusText)` callback, extracting embedded text, rendered page snapshots,
   * and native PDF base64 payloads for up to 15 pages in sequential order.
   * @param {FileList|Array<File>} fileList
   * @param {function} [onProgress]
   * @returns {Promise<{ extractedText: string, inlineImages: Array, pageSnapshots: Array, rawPdfPart: object|null, pageCount: number }>}
   */
  async extractFromFiles(fileList, onProgress = null) {
    const files = Array.from(fileList || []);
    if (files.length === 0) {
      return {
        extractedText: '',
        inlineImages: [],
        pageSnapshots: [],
        rawPdfPart: null,
        pageCount: 0
      };
    }

    const MAX_TOTAL_PAGES = 15;
    const textChunks = [];
    const inlineImages = [];
    const pageSnapshots = [];
    let primaryRawPdfPart = null;
    let totalPages = 0;

    for (const file of files) {
      if (totalPages >= MAX_TOTAL_PAGES) break;

      const fileName = (file.name || '').toLowerCase();
      const mime = (file.type || '').toLowerCase();
      const isPdf = mime === 'application/pdf' || fileName.endsWith('.pdf');
      const isImage =
        mime.startsWith('image/') ||
        /\.(jpg|jpeg|png|webp)$/i.test(fileName);

      if (isPdf) {
        const remaining = MAX_TOTAL_PAGES - totalPages;
        const pdfResult = await processPdfFile(file, totalPages, remaining, onProgress);
        if (pdfResult.text) {
          textChunks.push(pdfResult.text);
        }
        if (pdfResult.rawPdfPart && !primaryRawPdfPart) {
          primaryRawPdfPart = pdfResult.rawPdfPart;
        }
        if (Array.isArray(pdfResult.pageSnapshots) && pdfResult.pageSnapshots.length > 0) {
          pageSnapshots.push(...pdfResult.pageSnapshots);
        }
        if (Array.isArray(pdfResult.images) && pdfResult.images.length > 0) {
          inlineImages.push(...pdfResult.images);
        }
        totalPages += pdfResult.pagesProcessed;
      } else if (isImage) {
        totalPages += 1;
        if (typeof onProgress === 'function') {
          onProgress(`קורא וסורק תמונה ${totalPages}...`);
        }
        const imgObj = await processImageFileToBase64(file, totalPages);
        pageSnapshots.push(imgObj);
        inlineImages.push(imgObj);
      }
    }

    return {
      extractedText: textChunks.join('\n\n').trim(),
      inlineImages,
      pageSnapshots,
      rawPdfPart: pageSnapshots.length === 0 ? primaryRawPdfPart : null,
      pageCount: totalPages
    };
  }
};

if (typeof window !== 'undefined') {
  window.PDFExtractor = PDFExtractor;
}
