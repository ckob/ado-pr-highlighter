// Helper to map file extensions to Prism language aliases
const languageMap = {
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.py': 'python',
    '.java': 'java',
    '.cs': 'csharp', // Prism uses 'clike' for C-like, but 'csharp' is often an alias or separate component
    '.c': 'clike',
    '.cpp': 'clike',
    '.h': 'clike',
    '.html': 'markup', // 'markup' is Prism's term for HTML/XML/SVG
    '.xml': 'markup',
    '.svg': 'markup',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.sh': 'bash',
    '.ps1': 'powershell',
    '.sql': 'sql',
    '.csproj': 'markup', // Or a more specific XML if Prism has it
    '.sln': 'solution', // You might need a custom grammar or treat as plain
    // Add more mappings as needed
};

function getLanguageFromFileName(fileName) {
    if (!fileName) return null;
    const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    return languageMap[extension] || null; // Default to null (no highlighting) if unknown
}

function processFileDiff(fileDiffElement) {
    // 1. Determine the file name and language
    // The file name is in a structure like:
    // <div class="flex flex-center body-m font-weight-semibold text-ellipsis" role="heading" aria-level="3">
    //   <span class="text-ellipsis">Program.cs</span>
    // </div>
    // This might be in `repos-summary-header` or a similar structure for the full file view
    let fileNameElement = fileDiffElement.querySelector('.repos-change-summary-file-icon-container + .flex-column .text-ellipsis'); // For summary cards
    if (!fileNameElement) {
        // Try to find filename in the main diff view (selector might need adjustment)
        // This is a guess for the main diff view title when a file is selected:
        fileNameElement = document.querySelector('.vc-sparse-files-tree-selected-item .file-path-text');
        if (!fileNameElement) {
             // A more generic selector for the currently viewed file's header
            const headerTitle = document.querySelector('.repos-pr-iteration-file-header .bolt-header-title');
            if (headerTitle) {
                fileNameElement = headerTitle.querySelector('.text-ellipsis'); // Often the filename is in such a span
            }
        }
    }


    const fileName = fileNameElement ? fileNameElement.textContent.trim() : null;
    const language = getLanguageFromFileName(fileName);

    if (!language) {
        console.log(`No language mapping for: ${fileName || 'Unknown file'}`);
        return;
    }
    console.log(`Highlighting ${fileName} as ${language}`);


    // 2. Find all code lines within this file diff
    // For summary cards:
    let codeLineElements = fileDiffElement.querySelectorAll('.repos-summary-diff-blocks .repos-line-content');

    codeLineElements.forEach(lineElement => {
        // Delete the screen-reader-only span first
        const spanToDelete = lineElement.querySelector("span.screen-reader-only");
        if (spanToDelete) {
            spanToDelete.remove();
        }

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
            // We need to preserve the original structure if there are `added-content` or `removed-content` spans.
            // Let's iterate child nodes. If a child is a text node, wrap it and highlight.
            // If it's an element (like `added-content`), recurse or highlight its text.

            // This is a simplified approach, may need refinement for complex inline diffs
            const textNodesToHighlight = [];
            const walker = document.createTreeWalker(lineElement, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while(node = walker.nextNode()) {
                if (node.nodeValue.trim() !== '') {
                     // Check if parent is already a token (Prism might have run)
                    if (!node.parentElement.classList.contains('token')) {
                        textNodesToHighlight.push(node);
                    }
                }
            }

            if (textNodesToHighlight.length > 0) {
                // Wrap text nodes in spans so Prism can target them, then highlight
                // This is still tricky because Prism will replace the innerHTML.
                // A robust way is to take the full textContent of lineElement,
                // highlight it, then carefully replace, trying to preserve existing
                // ADO spans for +/-.

                // For now, let's try direct highlight on lineElement if no children.
                // If it has children, it's more complex.
                    // Handle lines with existing spans (e.g., inline diffs)
                    // This part is complex. We need to get the text of each segment,
                    // highlight it, and then reconstruct.
                    // For now, we'll mark it as highlighted to avoid reprocessing, but skip deep highlighting.
                    // A more advanced solution would be needed here.
                    let combinedText = '';
                    Array.from(lineElement.childNodes).forEach(child => {
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
                            lineElement.innerHTML = code.innerHTML; // Replace entire line content
                            lineElement.classList.add('ado-syntax-highlighted');
                            lineElement.classList.add(`language-${language}`);
                        });
                    }
            }
        }
    });
}

function applySyntaxHighlighting() {
    console.log("ADO Syntax Highlighter: Applying...");
      
    // Target summary cards on the "Files" overview
    const summaryDiffs = document.querySelectorAll('.repos-summary-code-diff');
    summaryDiffs.forEach(summaryDiff => {
        // The fileDiffElement for summary is the parent '.bolt-card'
        const fileCard = summaryDiff.closest('.bolt-card');
        if (fileCard && !fileCard.dataset.syntaxProcessed) {
            processFileDiff(fileCard);
            fileCard.dataset.syntaxProcessed = "true";
        }
    });

    // Target the main diff viewer when a file is selected
    // Common container class names can be '.vc-diff-viewer', '.diff-frame', '.file-content-viewer'
    const mainDiffViewer = document.querySelector('.vc-diff-viewer, .diff-frame, .page-content .repos-changes-viewer > .flex-row'); // This last one is a bit broad, might need refinement
    if (mainDiffViewer && !mainDiffViewer.dataset.syntaxProcessed) {
        processFileDiff(mainDiffViewer); // mainDiffViewer itself might contain the filename header
        mainDiffViewer.dataset.syntaxProcessed = "true"; // Mark the whole viewer as processed once. Lines will be marked individually.
    }
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

const debouncedApplyHighlighting = debounce(applySyntaxHighlighting, 500);

console.log("ADO Syntax Highlighter: Content script loaded.");
// Initial run
debouncedApplyHighlighting();

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
