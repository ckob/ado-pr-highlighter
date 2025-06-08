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
        // TODO: TMP, instead of deleing it we should add it before the highlighted content
        // const spanToDelete = lineElement.querySelector("span.screen-reader-only");
        // if (spanToDelete) {
        //     spanToDelete.remove();
        // }

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
                    if (node.parentElement.classList.contains('screen-reader-only')) {
                        continue;
                    }
                     // Check if parent is already a token (Prism might have run)
                    if (!node.parentElement.classList.contains('token')) {
                        textNodesToHighlight.push(node);
                    }
                }
            }
            // TODO: Remove all this textNodesToHighlight stuff. We are already iterating next
            
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
                        // This is a hack to make the line comment button (and maybe other functionality) be functional. Otherwise it breaks.
                        lineElement.style.display = 'none';
                        
                        // Insert the highlighted version after the original
                        lineElement.parentNode.insertBefore(highlightedLine, lineElement.nextSibling);
                    });
                }
            }
        }
    });
}

function applySyntaxHighlighting() {
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
