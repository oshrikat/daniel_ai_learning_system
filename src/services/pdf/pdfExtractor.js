/**
 * Multimodal PDF & Image Extractor Service - Daniel AI Learning System
 * Dynamically loads Mozilla PDF.js (v3.11.174) when needed, extracts embedded text,
 * and renders scanned CamScanner PDF pages & images to clean base64 JPEG objects
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
 * Reads an image File, resizes it on an offscreen canvas (max dimension 1600px),
 * and encodes as JPEG quality 0.82 base64 without the data URI prefix.
 * @param {File} file
 * @param {number} pageNumber
 * @returns {Promise<{ mimeType: string, data: string, pageNumber: number }>}
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

          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          const base64WithoutPrefix = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
          resolve({
            mimeType: 'image/jpeg',
            data: base64WithoutPrefix,
            pageNumber
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
 * Extracts text and rendered page images from a single PDF file (up to maxPages).
 * @param {File} file
 * @param {number} startPageOffset
 * @param {number} maxPagesRemaining
 * @returns {Promise<{ text: string, images: Array, pagesProcessed: number }>}
 */
async function processPdfFile(file, startPageOffset = 0, maxPagesRemaining = 6) {
  const pdfjsLib = await ensurePdfJsLoaded();
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const numPages = Math.min(pdfDoc.numPages, maxPagesRemaining);
  const pageTexts = [];
  const images = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const globalPageNumber = startPageOffset + pageNum;

    // 1. Extract any selectable/embedded text on the page
    try {
      const textContent = await page.getTextContent();
      const pageStr = (textContent.items || [])
        .map(item => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageStr) {
        pageTexts.push(`--- עמוד ${globalPageNumber} ---\n${pageStr}`);
      }
    } catch (textErr) {
      console.warn(`[PDFExtractor] Failed extracting text from page ${pageNum}:`, textErr);
    }

    // 2. Render page onto offscreen canvas (scale 1.5, JPEG quality 0.82) for CamScanner / Vision support
    try {
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      const base64WithoutPrefix = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

      images.push({
        mimeType: 'image/jpeg',
        data: base64WithoutPrefix,
        pageNumber: globalPageNumber
      });
    } catch (renderErr) {
      console.warn(`[PDFExtractor] Failed rendering page ${pageNum} to image:`, renderErr);
    }
  }

  return {
    text: pageTexts.join('\n\n'),
    images,
    pagesProcessed: numPages
  };
}

const PDFExtractor = {
  /**
   * Accepts one or more uploaded files (.pdf or .jpg/.jpeg/.png/.webp),
   * extracts embedded text and base64 page/image representations in sequential order.
   * @param {FileList|Array<File>} fileList
   * @returns {Promise<{ extractedText: string, inlineImages: Array<{ mimeType: string, data: string, pageNumber: number }>, pageCount: number }>}
   */
  async extractFromFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) {
      return { extractedText: '', inlineImages: [], pageCount: 0 };
    }

    const MAX_TOTAL_PAGES = 6;
    const textChunks = [];
    const inlineImages = [];
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
        const pdfResult = await processPdfFile(file, totalPages, remaining);
        if (pdfResult.text) {
          textChunks.push(pdfResult.text);
        }
        if (Array.isArray(pdfResult.images) && pdfResult.images.length > 0) {
          inlineImages.push(...pdfResult.images);
        }
        totalPages += pdfResult.pagesProcessed;
      } else if (isImage) {
        totalPages += 1;
        const imgObj = await processImageFileToBase64(file, totalPages);
        inlineImages.push(imgObj);
      }
    }

    return {
      extractedText: textChunks.join('\n\n').trim(),
      inlineImages,
      pageCount: totalPages
    };
  }
};

if (typeof window !== 'undefined') {
  window.PDFExtractor = PDFExtractor;
}
