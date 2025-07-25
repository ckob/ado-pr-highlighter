// Helper to map file extensions to Prism language aliases https://prismjs.com/#supported-languages
const filePatternToLanguage = {
  '*.csproj': 'markup',
  'directory.build.props': 'markup',
  'directory.build.targets': 'markup',
  'directory.packages.props': 'markup',
  'nuget.config': 'markup',
  '*.feature': 'gherkin',
  '*.(cls|trigger)': 'apex'
};

function getLanguageFromFileName(fileName) {
  if (!fileName) return null;
  const lowerFileName = fileName.toLowerCase();

  for (const [pattern, value] of Object.entries(filePatternToLanguage)) {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
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

  theme = luminance > 0.5 ? 'prismjs-tomorrow-night' : 'prism-one-light';
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
      code.innerHTML =  codeToHighlight;
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

function applySyntaxHighlighting() {
  if (!window.location.href.includes('/_git/')) {
    return;
  }

  console.debug("ADO Syntax Highlighter: Applying...");

  const fileDiffPanels = document.querySelectorAll('.repos-summary-header');
  fileDiffPanels.forEach(fileDiffPanel => {
    processFileDiff(fileDiffPanel);
  });
}

console.debug("ADO Syntax Highlighter: Content script loaded.");

// Initial run
applySyntaxHighlighting();

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
const debouncedApplyHighlighting = debounce(applySyntaxHighlighting, 250);

// Listen for URL changes
window.addEventListener('popstate', debouncedApplyHighlighting);

// Observe DOM changes for dynamically loaded content
new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (
            node.matches?.('.repos-summary-code-diff, .vc-diff-viewer, .diff-frame, .repos-diff-contents-row, .bolt-card, .repos-pr-iteration-file-header') ||
            node.querySelector?.('.repos-summary-code-diff, .vc-diff-viewer, .diff-frame, .repos-diff-contents-row, .bolt-card, .repos-pr-iteration-file-header')
          ) {
            debouncedApplyHighlighting();
            return;
          }
        }
      }
    }
  }
}).observe(document.body, { childList: true, subtree: true });
