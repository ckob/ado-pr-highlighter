// Helper to map file extensions to Prism language aliases https://prismjs.com/#supported-languages
const defaultFilePatternToLanguage = {
  '*.csproj': 'markup',
  'directory.build.props': 'markup',
  'directory.build.targets': 'markup',
  'directory.packages.props': 'markup',
  'nuget.config': 'markup',
  '*.feature': 'gherkin',
  '*.(cls|trigger)': 'apex'
};

// Custom patterns loaded from storage (takes priority)
let customFilePatterns = {};
let themePreference = 'auto';

// Load custom patterns and theme preference from storage
async function loadSettings() {
  try {
    const result = await browser.storage.sync.get(['customFilePatterns', 'themePreference']);
    customFilePatterns = result.customFilePatterns || {};
    themePreference = result.themePreference || 'auto';
  } catch (error) {
    console.error('ADO Syntax Highlighter: Error loading settings:', error);
    customFilePatterns = {};
    themePreference = 'auto';
  }
}

function getLanguageFromFileName(fileName) {
  if (!fileName) return null;
  const lowerFileName = fileName.toLowerCase();

  for (const [pattern, value] of Object.entries(customFilePatterns)) {
    const regexPattern = pattern
      .replaceAll('.', String.raw`\.`)
      .replaceAll('*', '.*');
    const regex = new RegExp(`^${regexPattern}$`);

    if (regex.test(lowerFileName)) {
      return value;
    }
  }

  for (const [pattern, value] of Object.entries(defaultFilePatternToLanguage)) {
    const regexPattern = pattern
      .replaceAll('.', String.raw`\.`)
      .replaceAll('*', '.*');
    const regex = new RegExp(`^${regexPattern}$`);

    if (regex.test(lowerFileName)) {
      return value;
    }
  }

  const extension = lowerFileName.substring(lowerFileName.lastIndexOf('.') + 1);
  return extension || null;
}

let theme = "";
function getTheme(element) {
  if (themePreference !== 'auto') {
    return themePreference;
  }
  if (theme) return theme;
  const color = window.getComputedStyle(element).color;

  // Extract RGB components
  const rgb = color.match(/\d+/g).map(Number);
  let [r, g, b] = rgb;

  // Convert to relative luminance (sRGB)
  [r, g, b] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928
      ? c / 12.92
      : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  theme = luminance > 0.5 ? 'prism-tomorrow-night' : 'prism-one-light';
  return theme;
}

function processFileDiff(fileDiffElement) {
  if (fileDiffElement.querySelector('.ado-syntax-highlighted')) {
    return;
  }

  let fileNameElement = fileDiffElement.querySelector('.repos-change-summary-file-icon-container + .flex-column .text-ellipsis');

  const fileName = fileNameElement ? fileNameElement.textContent.trim() : null;
  const language = getLanguageFromFileName(fileName);

  let originalLineElements = fileDiffElement.querySelectorAll('.monospaced-text > .repos-line-content');

  originalLineElements.forEach(originalLineElement => {
    if (!originalLineElement.classList.contains('ado-syntax-highlighted')) {

      const elementsToPreserve = [];
      const nonCodeQuery = '.screen-reader-only, span[aria-hidden="true"]';
      originalLineElement.querySelectorAll(nonCodeQuery).forEach(el => {
        elementsToPreserve.push(el.cloneNode(true));
      });

      const codeContainer = originalLineElement.cloneNode(true);
      codeContainer.querySelectorAll(nonCodeQuery).forEach(el => el.remove());
      const codeToHighlight = codeContainer.innerHTML;

      const highlightedLine = originalLineElement.cloneNode(true);

      const code = document.createElement('code'); // Temporary element
      code.className = `language-${language}`;
      code.innerHTML = codeToHighlight;
      Prism.highlightElement(code, false, () => {
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = code.innerHTML;
        contentDiv.classList.add(getTheme(originalLineElement));
        highlightedLine.innerHTML = '';

        elementsToPreserve.forEach(el => {
          highlightedLine.appendChild(el);
        });

        highlightedLine.appendChild(contentDiv);
        highlightedLine.classList.add('ado-syntax-highlighted');

        // Hide the original line.
        // This is a hack to make the line comment button functional. Otherwise it breaks.
        originalLineElement.style.display = 'none';

        // Insert the highlighted version after the original
        originalLineElement.parentNode.insertBefore(highlightedLine, originalLineElement.nextSibling)
      });
    }
  });
}

const ADO_SH_TIMING = true; // set to false to silence perf logging

function applySyntaxHighlighting() {
  if (!window.location.href.includes('/_git/')) {
    return;
  }

  const t0 = ADO_SH_TIMING ? performance.now() : 0;

  const fileDiffPanels = document.querySelectorAll('.repos-summary-header');
  fileDiffPanels.forEach(fileDiffPanel => {
    processFileDiff(fileDiffPanel);
  });

  if (ADO_SH_TIMING) {
    console.log(`ADO Syntax Highlighter: highlight pass over ${fileDiffPanels.length} panel(s) took ${(performance.now() - t0).toFixed(2)}ms`);
  }
}

console.debug("ADO Syntax Highlighter: Content script loaded.");

// Load custom patterns and then apply highlighting
loadSettings().then(() => {
  applySyntaxHighlighting();
});

// Coalesce rapid DOM mutations into a single highlight pass on the next
// animation frame (~16ms at 60fps) instead of waiting a fixed debounce delay.
// Bursts of mutations (e.g. Azure DevOps rendering many diff cards at once) are
// batched into a single render, while latency drops from ~250ms to one frame.
let rafPending = false;
let mutationSeenAt = 0;
function scheduleApplyHighlighting() {
  if (rafPending) {
    return;
  }

  rafPending = true;
  if (ADO_SH_TIMING) {
    mutationSeenAt = performance.now();
  }
  requestAnimationFrame(() => {
    rafPending = false;
    if (ADO_SH_TIMING) {
      console.log(`ADO Syntax Highlighter: mutation -> frame scheduling delay ${(performance.now() - mutationSeenAt).toFixed(2)}ms`);
    }
    applySyntaxHighlighting();
  });
}

// Listen for URL changes
window.addEventListener('popstate', scheduleApplyHighlighting);

// Observe DOM changes for dynamically loaded content
new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    if (!(mutation.type === 'childList' && mutation.addedNodes.length > 0)) {
      continue;
    }
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }
      if (
        node.matches?.('.repos-summary-code-diff, .vc-diff-viewer, .diff-frame, .repos-diff-contents-row, .bolt-card, .repos-pr-iteration-file-header') ||
        node.querySelector?.('.repos-summary-code-diff, .vc-diff-viewer, .diff-frame, .repos-diff-contents-row, .bolt-card, .repos-pr-iteration-file-header')
      ) {
        scheduleApplyHighlighting();
        return;
      }
    }
  }
}).observe(document.body, { childList: true, subtree: true });
