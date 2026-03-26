// Helper to map file extensions to Prism language aliases https://prismjs.com/#supported-languages
const defaultFilePatternToLanguage = {
  '*.csproj': 'markup',
  'directory.build.props': 'markup',
  'directory.build.targets': 'markup',
  'directory.packages.props': 'markup',
  'nuget.config': 'markup',
  '*.feature': 'gherkin',
  '*.(cls|trigger)': 'apex',
  '*.tfvars': 'hcl',
  '*.tf': 'hcl'
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

function getFileNameFromHeading() {
  const heading = document.querySelector('.repos-compare-toolbar span.text-ellipsis[role="heading"]');

  return heading ? heading.textContent.trim() : null;
}

/**
 * Flatten Prism's token stream into a flat array of `{ text, classes }` entries.
 *
 * `Prism.tokenize()` returns a `TokenStream`: an array of strings (plain text)
 * and Token objects (with `.type`, `.content`, `.alias`). Tokens can nest; their
 * `.content` can itself be a `TokenStream`. This function recursively flattens
 * that into a simple sequence of leaf text segments, each annotated with the
 * full set of CSS classes it would receive (e.g. `['token', 'keyword']`).
 *
 * @param {Array} tokens - Prism token stream from `Prism.tokenize()`
 * @returns {Array<{text: string, classes: string[]}>}
 */
function flattenPrismTokenStream(tokens) {
  const result = [];

  function walk(tokenOrString, inheritedClasses) {
    if (typeof tokenOrString === 'string') {
      if (tokenOrString.length > 0) {
        result.push({ text: tokenOrString, classes: [...inheritedClasses] });
      }

      return;
    }

    // It's a Prism Token object with .type, .content, .alias
    const token = tokenOrString;
    const classes = [...inheritedClasses, 'token', token.type];
    if (token.alias) {
      if (Array.isArray(token.alias)) {
        classes.push(...token.alias);
      } else {
        classes.push(token.alias);
      }
    }

    if (typeof token.content === 'string') {
      if (token.content.length > 0) {
        result.push({ text: token.content, classes });
      }
    } else if (Array.isArray(token.content)) {
      for (const child of token.content) {
        walk(child, classes);
      }
    } else if (token.content) {
      // Single nested Token (not wrapped in an array)
      walk(token.content, classes);
    }
  }

  for (const t of tokens) {
    walk(t, []);
  }

  return result;
}

/**
 * Cache of resolved Prism token colors per theme.
 *
 * Structure: Map<themeClass, Map<classListKey, string|null>>
 *
 * We create a hidden element with the theme class and probe computed colors
 * for each unique set of Prism token classes. This is cached so each unique
 * token class combination is resolved at most once per theme per page load.
 */
const prismColorCache = new Map();

/**
 * Get a hidden probe element for resolving Prism token colors.
 * The probe is a <div> with the theme class attached to it, appended to
 * document.body but invisible. Token color probes are created as children.
 */
const themeProbes = new Map();

function getThemeProbe(themeClass) {
  if (themeProbes.has(themeClass)) {
    return themeProbes.get(themeClass);
  }

  const probe = document.createElement('div');
  probe.className = themeClass;
  probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;';
  document.body.appendChild(probe);
  themeProbes.set(themeClass, probe);

  return probe;
}

/**
 * Resolve the CSS color for a set of Prism token classes under a given theme.
 *
 * The theme CSS (built by Makefile) wraps each Prism theme inside a scoping
 * class like `.prism-one-light { .token.keyword { color: ... } }`. By placing
 * a probe element inside a container with that theme class, getComputedStyle
 * will resolve the correct color.
 *
 * @param {string[]} classes - Prism token classes (e.g. ['token', 'keyword'])
 * @param {string} themeClass - Theme scope class (e.g. 'prism-one-light')
 * @returns {string|null} - Resolved CSS color string, or null if no override
 */
function resolvePrismColor(classes, themeClass) {
  if (!prismColorCache.has(themeClass)) {
    prismColorCache.set(themeClass, new Map());
  }

  const cache = prismColorCache.get(themeClass);
  const key = classes.join(' ');
  if (cache.has(key)) {
    return cache.get(key);
  }

  const probe = getThemeProbe(themeClass);
  const span = document.createElement('span');

  for (const cls of classes) {
    span.classList.add(cls);
  }

  probe.appendChild(span);
  const resolved = window.getComputedStyle(span).color;
  probe.removeChild(span);

  // Compare against the probe container's own color (the "no override" baseline).
  // If the resolved color matches the container's default, Prism has no specific
  // rule for this token type, so return null to leave Monaco's color intact.
  const baseColor = window.getComputedStyle(probe).color;
  const color = (resolved && resolved !== baseColor) ? resolved : null;
  cache.set(key, color);

  return color;
}

/**
 * Get a plain-text fingerprint for a Monaco .view-line element,
 * used to detect when Monaco has recycled a node with new content.
 * This uses the raw textContent which is fast and avoids full parsing.
 */
function getMonacoLineFingerprint(viewLineElement) {
  const lineSpan = viewLineElement.querySelector('span');

  return lineSpan ? lineSpan.textContent : '';
}

/**
 * Process all visible lines within a single Monaco `.view-lines` container.
 * Monaco virtualizes lines (only renders visible ones), so this function
 * is called repeatedly as the user scrolls.
 *
 * CSS-only approach: instead of replacing Monaco's DOM (which breaks mouse
 * hit-testing due to `className` checks and stale `CharacterMapping`), we:
 * 1. Extract the line's plain text
 * 2. Tokenize with `Prism.tokenize()` to get token types + character ranges
 * 3. Walk Monaco's existing mtk* spans and apply inline color styles
 *    based on which Prism token covers each span's characters
 * 4. Never modify DOM structure (Monaco's hit-testing stays intact)
 */
function processMonacoViewLines(viewLinesElement, language, themeClass) {
  const grammar = Prism.languages[language];
  if (!grammar) {
    return;
  }

  const viewLines = viewLinesElement.querySelectorAll('.view-line');

  viewLines.forEach(viewLine => {
    const fingerprint = getMonacoLineFingerprint(viewLine);

    if (viewLine.dataset.adoHighlightedText === fingerprint) {
      return; // Content unchanged, skip
    }

    // Get the inner span wrapper that contains token spans
    const lineSpan = viewLine.querySelector('span');
    if (!lineSpan) {
      return;
    }

    // 1. Extract plain text from the line for Prism tokenization.
    // We need to map character positions between Monaco spans and Prism tokens.
    // Build an array of { node, startOffset, length } for each Monaco child span.
    const monacoSpans = [];
    let totalLength = 0;
    for (const child of lineSpan.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const len = child.textContent.length;
        if (len > 0) {
          monacoSpans.push({ node: child, start: totalLength, length: len, isWhitespace: false });
          totalLength += len;
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const text = child.textContent;
        const len = text.length;
        const isWhitespace = child.classList.contains('mtkw');
        if (len > 0) {
          monacoSpans.push({ node: child, start: totalLength, length: len, isWhitespace });
          totalLength += len;
        }
      }
    }

    if (monacoSpans.length === 0) {
      return;
    }

    // Build the full plain text. For whitespace spans, substitute actual spaces
    // so Prism sees syntactically valid code (Monaco uses · and → glyphs).
    let plainText = '';
    for (const ms of monacoSpans) {
      if (ms.isWhitespace) {
        plainText += ' '.repeat(ms.length);
      } else {
        plainText += ms.node.textContent;
      }
    }

    // 2. Tokenize with Prism
    const tokens = Prism.tokenize(plainText, grammar);
    const flatTokens = flattenPrismTokenStream(tokens);

    // 3. Build a character→color map from the flat Prism tokens.
    // Each flat token has { text, classes } and covers a contiguous character range.
    const tokenColors = [];
    let tokenOffset = 0;
    for (const ft of flatTokens) {
      const color = ft.classes.length > 0 ? resolvePrismColor(ft.classes, themeClass) : null;
      tokenColors.push({ start: tokenOffset, end: tokenOffset + ft.text.length, color });
      tokenOffset += ft.text.length;
    }

    // 4. For each Monaco span, find the Prism color that covers it.
    // If a Monaco span straddles multiple Prism tokens with different colors,
    // we use the color at the start of the span (the dominant visual token).
    // This is a pragmatic trade-off: splitting spans would break CharacterMapping.
    let tokenIdx = 0;
    for (const ms of monacoSpans) {
      if (ms.isWhitespace) {
        continue; // Don't color whitespace markers
      }
      if (ms.node.nodeType !== Node.ELEMENT_NODE) {
        continue; // Skip bare text nodes
      }

      const spanStart = ms.start;

      // Advance tokenIdx to the Prism token that covers spanStart
      while (tokenIdx < tokenColors.length && tokenColors[tokenIdx].end <= spanStart) {
        tokenIdx++;
      }

      if (tokenIdx < tokenColors.length && tokenColors[tokenIdx].color) {
        ms.node.style.color = tokenColors[tokenIdx].color;
      } else {
        // No Prism override — remove any previously applied color
        ms.node.style.removeProperty('color');
      }
    }

    // Mark as highlighted (using data attribute only, no class changes on .view-line)
    viewLine.dataset.adoHighlightedText = fingerprint;
  });
}

/**
 * Find and process all Monaco editor views on the page.
 * This handles both diff views (side-by-side or inline, with two `.view-lines`
 * containers) and non-diff views (e.g. new files with a single `.view-lines`
 * container). By targeting `.view-lines` directly, the same logic works for
 * any Monaco editor regardless of the surrounding container structure.
 */
function processMonacoEditors() {
  const fileName = getFileNameFromHeading();
  const language = getLanguageFromFileName(fileName);
  if (!language) {
    console.debug('ADO Syntax Highlighter: Could not determine language for Monaco editor:', fileName);

    return;
  }

  const viewLinesContainers = document.querySelectorAll('.view-lines');
  viewLinesContainers.forEach(container => {
    const firstLine = container.querySelector('.view-line');
    if (!firstLine) {
      return;
    }

    const themeClass = getTheme(firstLine);
    processMonacoViewLines(container, language, themeClass);
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

  processMonacoEditors();
}

console.debug("ADO Syntax Highlighter: Content script loaded.");

// Load custom patterns and then apply highlighting
loadSettings().then(() => {
  applySyntaxHighlighting();
});

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

// Selectors that trigger re-highlighting when new matching elements appear in the DOM.
// Summary diff view selectors:
//   .repos-summary-code-diff, .repos-diff-contents-row, .bolt-card - summary diff cards
// Single-file view selectors:
//   .vc-diff-viewer, .diff-frame - diff viewer containers
//   .repos-pr-iteration-file-header - file header when switching files/iterations
//   .repos-diff-editor - Monaco diff editor container
const MUTATION_TRIGGER_SELECTOR = [
  '.repos-summary-code-diff',
  '.vc-diff-viewer',
  '.diff-frame',
  '.repos-diff-contents-row',
  '.bolt-card',
  '.repos-pr-iteration-file-header',
  '.repos-diff-editor'
].join(', ');

// Monaco virtualizes lines: only visible lines are in the DOM, and they are
// added/removed/recycled as the user scrolls. Use requestAnimationFrame
// to process new lines on the next paint frame rather than waiting a fixed
// debounce delay. Multiple mutations within the same frame are coalesced
// into a single rAF callback (~16ms at 60fps vs the old 100ms debounce).
let monacoRafPending = false;
function scheduleMonacoHighlighting() {
  if (monacoRafPending) {
    return;
  }

  monacoRafPending = true;
  requestAnimationFrame(() => {
    monacoRafPending = false;
    if (!window.location.href.includes('/_git/')) {
      return;
    }

    processMonacoEditors();
  });
}

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

      // Check for Monaco line additions (.view-line inside .view-lines)
      // This handles scroll virtualization where Monaco adds new lines dynamically.
      if (
        node.matches?.('.view-line') ||
        node.querySelector?.('.view-line')
      ) {
        scheduleMonacoHighlighting();
        // Don't return here — also check for structural changes below
      }

      // Check for structural diff container changes
      if (
        node.matches?.(MUTATION_TRIGGER_SELECTOR) ||
        node.querySelector?.(MUTATION_TRIGGER_SELECTOR)
      ) {
        debouncedApplyHighlighting();

        return;
      }
    }
  }
}).observe(document.body, { childList: true, subtree: true });
