// Helper to map file extensions to Prism language aliases https://prismjs.com/#supported-languages
const filePatternToLanguage = {
    '*.csproj': 'markup',
    'directory.build.props': 'markup',
    'directory.build.targets': 'markup',
    'directory.packages.props': 'markup',
    'nuget.config': 'markup',
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
    
    // If no match found, return just the extension without the dot
    const extension = lowerFileName.substring(lowerFileName.lastIndexOf('.') + 1);
    return extension || null;
}

function processFileDiff(fileDiffElement) {
    let fileNameElement = fileDiffElement.querySelector('.repos-change-summary-file-icon-container + .flex-column .text-ellipsis');

    const fileName = fileNameElement ? fileNameElement.textContent.trim() : null;
    const language = getLanguageFromFileName(fileName);

    if (!language) {
        console.log(`No language mapping for: ${fileName || 'Unknown file'}`);
        return;
    }
    console.log(`Highlighting ${fileName} as ${language}`);

    // 2. Find all code lines within this file diff
    // For summary cards:
    let codeLineElements = fileDiffElement.querySelectorAll('.repos-line-content');

    codeLineElements.forEach(lineElement => {

        // We need to be careful. ADO sometimes has spans INSIDE repos-line-content for
        // inline diff highlighting (e.g. <span class="added-content">).
        // We should highlight the text content of `repos-line-content` itself.
        // If `repos-line-content` has only text, highlight directly.
        // If it has child spans (like `added-content`), we need to handle them carefully.
        // For simplicity, let's try highlighting the whole lineElement's text content.
        // A more robust solution would parse out the existing `added/removed-content` spans,
        // highlight their text, and then reconstruct.

        // Simple approach:
        if (!lineElement.classList.contains('ado-syntax-highlighted')) {
            let combinedText = '';
            Array.from(lineElement.childNodes).forEach(child => {
                // Skip screen-reader-only spans
                if (child.nodeType === Node.ELEMENT_NODE && child.classList.contains('screen-reader-only')) {
                    return;
                }
                
                if (child.nodeType === Node.TEXT_NODE) {
                    combinedText += child.textContent;
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    combinedText += child.textContent; // Or process recursively
                }
            });
        
            if (combinedText.trim()) {
                const code = document.createElement('code'); // Temporary element
                code.className = `language-${language}`;
                code.textContent = combinedText;
                Prism.highlightElement(code, false, () => {
                    // Create new highlighted line
                    const highlightedLine = lineElement.cloneNode(true);
                    
                    // Preserve the important spans from the original
                    const screenReaderSpan = lineElement.querySelector('.screen-reader-only');
                    const ariaHiddenSpan = lineElement.querySelector('[aria-hidden="true"]');
                    
                    // Clear the content but keep the structure
                    highlightedLine.innerHTML = '';
                    
                    // Add spans in the correct order
                    if (screenReaderSpan) {
                        highlightedLine.appendChild(screenReaderSpan.cloneNode(true));
                    }
                    if (ariaHiddenSpan) {
                        highlightedLine.appendChild(ariaHiddenSpan.cloneNode(true));
                    }
                    
                    // Add the highlighted content last
                    const contentDiv = document.createElement('div');
                    contentDiv.innerHTML = code.innerHTML;
                    highlightedLine.appendChild(contentDiv);
                    
                    highlightedLine.classList.add('ado-syntax-highlighted');
                    highlightedLine.classList.add(`language-${language}`);
                    
                    // Hide the original line.
                    // This is a hack to make the line comment button (and maybe other functionality) functional. Otherwise it breaks.
                    lineElement.style.display = 'none';
                    
                    // Insert the highlighted version after the original
                    lineElement.parentNode.insertBefore(highlightedLine, lineElement.nextSibling);
                });
            }
        }
    });
}

function applySyntaxHighlighting() {
    // Only apply highlighting if we're on a PR page
    if (!window.location.href.includes('/_git/') || !window.location.href.includes('/pullrequest/')) {
        return;
    }

    console.log("ADO Syntax Highlighter: Applying...");

    const fileDiffPanels = document.querySelectorAll('.repos-summary-header');
    fileDiffPanels.forEach(fileDiffPanel => {
        processFileDiff(fileDiffPanel);
    });
}

// Debounce function
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

console.log("ADO Syntax Highlighter: Content script loaded.");

// Initial run
applySyntaxHighlighting();

const debouncedApplyHighlighting = debounce(applySyntaxHighlighting, 500);

// Listen for URL changes
let lastUrl = location.href;
new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        debouncedApplyHighlighting();
    }
}).observe(document, { subtree: true, childList: true });

// Observe DOM changes for dynamically loaded content
const observer = new MutationObserver((mutationsList, observer) => {
    // Check if relevant nodes were added (e.g., diff rows, file containers)
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // A simple check: if a lot of 'repos-diff-contents-row' or 'bolt-card' got added.
            // Or if the main diff viewer content changed.
            let needsHighlighting = false;
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches && (node.matches('.repos-summary-code-diff, .vc-diff-viewer, .diff-frame, .repos-diff-contents-row, .bolt-card, .repos-pr-iteration-file-header'))) {
                        needsHighlighting = true;
                    }
                    if (node.querySelector && node.querySelector('.repos-summary-code-diff, .vc-diff-viewer, .diff-frame, .repos-diff-contents-row, .bolt-card, .repos-pr-iteration-file-header')) {
                        needsHighlighting = true;
                    }
                }
            });

            if (needsHighlighting) {
                debouncedApplyHighlighting();
                break; // No need to check other mutations if one already triggered
            }
        }
    }
});

// Start observing the document body for configured mutations
observer.observe(document.body, { childList: true, subtree: true });

// (optional) listen for messages from a popup for theme changes, etc.
// chrome.runtime.onMessage.addListener(...)
