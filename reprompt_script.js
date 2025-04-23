$(document).ready(function() {
        // Configuration
        const CONTEXT_CHARS = 30;
        const FEEDBACK_TIMEOUT = 1500;
        const POPOVER_OFFSET_Y = 8;
        const CUSTOM_POPOVER_ID = 'custom-comment-popover-element';
        const HIGHLIGHT_PALETTE = [
            'rgba(255, 255, 0, 0.3)', 'rgba(173, 216, 230, 0.4)', 'rgba(255, 192, 203, 0.35)',
            'rgba(144, 238, 144, 0.35)', 'rgba(255, 182, 193, 0.3)', 'rgba(255, 160, 122, 0.35)',
            'rgba(221, 160, 221, 0.35)', 'rgba(240, 230, 140, 0.4)', 'rgba(175, 238, 238, 0.4)',
            'rgba(211, 211, 211, 0.45)'
        ];
        const LOCAL_STORAGE_KEY = 'llmEditorSavedState';
        const THEME_STORAGE_KEY = 'repromptProTheme';

        // --- Default Prompt Text ---
        const defaultLlmPrompt = `You are a skilled document editor acting on the following content and list of instructions provided in JSON format. The content may contain special <span class="editor-highlight"> tags with inline background colors for internal tracking; these should be ignored or removed during your editing process unless the instruction explicitly targets them.

Your task is to process each instruction in the \`instructions\` array:
1. Locate the specific snippet specified by the \`selectedString\` field (which might contain HTML tags) within the \`originalContent\` document. Use the \`textBeforeContext\` and \`textAfterContext\` fields (which represent the plain text surrounding the selection) primarily as guides to help pinpoint the correct instance if \`selectedString\` appears multiple times. Prioritize finding the exact \`selectedString\` fragment. If still ambiguous, edit the first matching instance found.
2. Apply the edit requested in the corresponding \`comment\` field to that located snippet. Interpret the comment naturally to perform the edit correctly within the context of the surrounding content.
3. After processing all instructions, return the **complete, modified content** with all edits applied. Ensure any temporary editor highlight spans (like <span...> including their style attributes) are removed from the final output. Do not return explanations, confirmations, or summaries, only the final edited content.

Here is the content and the instructions:
`;

        // State Variables
        let currentSelectionDetails = null;
        let comments = [];
        let copyTimeout = null;
        let saveStateTimeout = null;
        let loadStateTimeout = null;
        let clearStateTimeout = null;


        // DOM References
        const editorContainer = $('#editor-container');
        const editorContent = $('#editor-content');
        const commentList = $('#commentList');
        const copyPromptBtn = $('#copyPromptBtn');
        const llmPromptTextarea = $('#llmPromptTextarea');
        const promptCollapseContainer = document.getElementById('promptCollapseContainer');
        const promptCaretIcon = $('#promptCaretIcon');
        const saveStateBtn = $('#saveStateBtn');
        const loadStateBtn = $('#loadStateBtn');
        const clearStateBtn = $('#clearStateBtn');
        const darkModeSwitch = $('#darkModeSwitch');
        const htmlElement = $('html');


        // --- Theme Handling Functions ---
        function applyTheme(theme) {
            htmlElement.attr('data-theme', theme);
            darkModeSwitch.prop('checked', theme === 'dark');
            localStorage.setItem(THEME_STORAGE_KEY, theme);
            //console.log(`Theme applied: ${theme}`);
            // Optional: If highlight colors need specific theme adjustments beyond CSS vars
            // renderCommentList();
        }

        function toggleTheme() {
            const currentTheme = htmlElement.attr('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
        }

        function loadInitialTheme() {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
            applyTheme(initialTheme);
        }
        // --- End Theme Handling ---


        // --- Utility Functions ---
        function getSelectedContentFragment() {
            let fragment = "";
            if (window.getSelection) {
                const sel = window.getSelection();
                if (sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    const container = document.createElement("div");
                    container.appendChild(range.cloneContents());
                    fragment = container.innerHTML;
                }
            }
            else if (document.selection && document.selection.type != "Control") {
                fragment = document.selection.createRange().htmlText;
            }
            return fragment;
        }
        function escapeHtml(unsafe) {
            if (typeof unsafe !== 'string') {
                return '';
            }
            // Double-escape HTML entities
            return unsafe.replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }
        function decodeHtmlEntities(encodedString) {
            if (typeof encodedString !== 'string') {
                return '';
            }
            // Only decode if entities are likely present
            if (encodedString.indexOf('&') === -1 && encodedString.indexOf('<') === -1 && encodedString.indexOf('>') === -1 && encodedString.indexOf('"') === -1 && encodedString.indexOf('\'') === -1) {
            return encodedString;
        }
        try {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = encodedString; // This handles decoding
            return textarea.value;
        } catch (e) {
            console.error("Error decoding HTML entities:", e, "Input:", encodedString);
            return encodedString; // Return original on error
        }
    }
    function destroyCustomPopoverElement() {
        const popover = document.getElementById(CUSTOM_POPOVER_ID);
        if (popover) {
            popover.remove();
        }
    }
    function cancelAndDestroyPopover() {
        if (currentSelectionDetails) {
            currentSelectionDetails = null;
        }
        destroyCustomPopoverElement();
    }
    function getTextContentWithoutHighlights(element) {
        const clone = element.cloneNode(true);
        $(clone).find('.editor-highlight').contents().unwrap();
        return $(clone).text();
    }
    function highlightCommentListItem(index) {
        const indexNum = parseInt(index, 10);
        if (isNaN(indexNum) || indexNum < 0 || indexNum >= comments.length) {
            console.warn("Invalid index provided:", index);
            return;
        }
        const listItem = commentList.find(`li[data-comment-list-index="${indexNum}"]`);
        if (listItem.length) {
            listItem[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            listItem.addClass('comment-item-highlighted');
            setTimeout(() => {
                listItem.removeClass('comment-item-highlighted');
            }, 1500);
        } else {
            console.warn(`Comment list item ${indexNum} not found.`);
        }
    }
    function showCustomPopover(selectionRect) {
        destroyCustomPopoverElement();
        const popover = document.createElement('div');
        popover.id = CUSTOM_POPOVER_ID;
        popover.className = 'custom-comment-popover';
        popover.style.position = 'fixed';
        popover.style.top = '-9999px';
        popover.style.left = '-9999px';
        popover.style.visibility = 'visible';
        popover.style.display = 'block';

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'custom-popover-close-btn';
        closeButton.innerHTML = '×';
        closeButton.setAttribute('aria-label', 'Close');
        closeButton.id = 'custom-popover-close';

        const textarea = document.createElement('textarea');
        textarea.className = 'form-control form-control-sm';
        textarea.rows = 3;
        textarea.placeholder = 'Add instruction...';
        textarea.id = 'custom-popover-textarea';

        const instructionDiv = document.createElement('div');
        instructionDiv.className = 'popover-instruction-text';
        instructionDiv.innerHTML = `
                <i class="fa-solid fa-info-circle fa-fw"></i>
                <span>Press <strong><Enter></strong> to save, <strong><Shift>+<Enter></strong> for newline.</span>
            `; // Ensure inner HTML is properly escaped if needed, here it's basic

        popover.appendChild(closeButton);
        popover.appendChild(textarea);
        popover.appendChild(instructionDiv);
        document.body.appendChild(popover);

        // Positioning logic (unchanged)
        const popoverRect = popover.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const boundaryMargin = 5;
        let potentialTopBelow = selectionRect.bottom + POPOVER_OFFSET_Y;
        let potentialTopAbove = selectionRect.top - popoverRect.height - POPOVER_OFFSET_Y;
        let potentialBottomBelow = potentialTopBelow + popoverRect.height;
        let isBelowValid = (potentialBottomBelow <= viewportHeight - boundaryMargin);
        let isAboveValid = (potentialTopAbove >= boundaryMargin);
        let finalTop;
        if (isBelowValid) { finalTop = potentialTopBelow; }
        else if (isAboveValid) { finalTop = potentialTopAbove; }
        else { finalTop = Math.max(boundaryMargin, viewportHeight - popoverRect.height - boundaryMargin); }
        let popoverLeft = selectionRect.left + (selectionRect.width / 2) - (popoverRect.width / 2);
        popoverLeft = Math.max(boundaryMargin, Math.min(popoverLeft, viewportWidth - popoverRect.width - boundaryMargin));
        popover.style.top = `${finalTop}px`;
        popover.style.left = `${popoverLeft}px`;
        // End Positioning

        closeButton.addEventListener('click', cancelAndDestroyPopover);
        textarea.addEventListener('keydown', handlePopoverTextareaKeydown);
        textarea.focus();
    }

    // --- Event Handlers for Custom Popover ---
    function handleSaveComment() {
        const textarea = document.getElementById('custom-popover-textarea');
        const commentText = textarea ? textarea.value.trim() : '';

        if (currentSelectionDetails && currentSelectionDetails.range && commentText) {
            let highlightSpanId = null;
            let rangeForHighlight = currentSelectionDetails.range;

            if (!rangeForHighlight || !editorContent[0].contains(rangeForHighlight.commonAncestorContainer)) {
                console.warn("Stored range invalid. Comment added without highlight.");
                rangeForHighlight = null;
            }

            const commentIndex = comments.length;
            const colorIndex = commentIndex % HIGHLIGHT_PALETTE.length;
            const highlightColor = HIGHLIGHT_PALETTE[colorIndex];

            const newComment = {
                selectedString: currentSelectionDetails.selectedString,
                textBeforeContext: currentSelectionDetails.textBeforeContext,
                textAfterContext: currentSelectionDetails.textAfterContext,
                comment: commentText,
                highlightId: null,
                highlightColor: highlightColor
            };
            comments.push(newComment);

            if (rangeForHighlight) {
                highlightSpanId = `editor-highlight-${Date.now()}-${commentIndex}`;
                const span = document.createElement('span');
                span.id = highlightSpanId;
                span.className = 'editor-highlight';
                span.dataset.commentIndex = commentIndex;
                span.style.backgroundColor = highlightColor;

                try {
                    rangeForHighlight.surroundContents(span);
                    comments[commentIndex].highlightId = highlightSpanId;
                    console.log(`Highlight ${highlightSpanId} added.`);
                } catch (e) {
                    console.error("Error surrounding contents:", e);
                    comments[commentIndex].highlightId = null;
                    console.log("Could not apply highlight. Comment added without highlight.");
                    // Attempt to re-apply selection if highlighting failed badly
                    if (window.getSelection) {
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        // Maybe try to reselect original range? Could be complex.
                    }
                }
            } else {
                console.log("Comment added without highlight.");
            }

            // Clear the browser selection explicitly after processing
            const currentSelection = window.getSelection();
            if (currentSelection) { currentSelection.removeAllRanges(); }

            renderCommentList();
            const commentListElement = commentList[0];
            if (commentListElement) { commentListElement.scrollTop = commentListElement.scrollHeight; }

            currentSelectionDetails = null; // Clear selection details AFTER processing
            destroyCustomPopoverElement();

        } else if (!commentText) {
            alert("Please enter an instruction before saving.");
            if(textarea) { textarea.focus(); }
        } else {
            console.warn("Save failed: Context/comment missing.", currentSelectionDetails, commentText);
            destroyCustomPopoverElement();
            currentSelectionDetails = null;
        }
    }
    function handlePopoverTextareaKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSaveComment();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelAndDestroyPopover();
        }
    }

    // --- Local Storage Functions ---
    function updateLocalStorageButtonStates() {
        try {
            const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
            const stateExists = savedState !== null && savedState !== undefined;
            loadStateBtn.prop('disabled', !stateExists);
            clearStateBtn.prop('disabled', !stateExists);
            // Save button is always enabled unless in feedback state
            // saveStateBtn.prop('disabled', false); // Assuming not in feedback state
        } catch (e) {
            console.error("Could not access local storage to update button states:", e);
            loadStateBtn.prop('disabled', true);
            clearStateBtn.prop('disabled', true);
            // saveStateBtn.prop('disabled', true); // Disable save too if storage fails? Maybe not.
        }
    }
    function handleSaveState() {
        cancelAndDestroyPopover(); // Close popover before saving
        console.log("Attempting to save state...");
        const stateToSave = {
            editorContentHTML: editorContent.html(),
            commentsArray: comments,
            llmPromptText: llmPromptTextarea.val()
        };

        try {
            const jsonString = JSON.stringify(stateToSave);
            localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
            console.log("State saved successfully to local storage.");

            // Feedback animation for Save button
            const originalHtml = saveStateBtn.html();
            saveStateBtn.html('<i class="fa-solid fa-check me-1"></i> Saved!');
            saveStateBtn.addClass('btn-save-feedback').prop('disabled', true); // Disable during feedback

            updateLocalStorageButtonStates(); // Update Load/Clear state

            if (saveStateTimeout) clearTimeout(saveStateTimeout);
            saveStateTimeout = setTimeout(() => {
                saveStateBtn.html(originalHtml).removeClass('btn-save-feedback').prop('disabled', false); // Re-enable
                saveStateTimeout = null;
            }, FEEDBACK_TIMEOUT);

        } catch (error) {
            console.error("Error saving state to local storage:", error);
            if (error.name === 'QuotaExceededError') {
                alert("Error saving: Local storage quota exceeded. Please clear some space or reduce content size.");
            } else {
                alert("An error occurred while trying to save the state. Check the console for details.");
            }
            updateLocalStorageButtonStates(); // Ensure buttons reflect current state
        }
    }
    function handleLoadState() {
        cancelAndDestroyPopover();
        console.log("Attempting to load state...");
        if (!window.confirm("Loading saved work will replace your current content, comments, and prompt. Are you sure?")) {
            console.log("Load cancelled by user.");
            return;
        }

        let savedStateString;
        try {
            savedStateString = localStorage.getItem(LOCAL_STORAGE_KEY);
        } catch (e) {
            console.error("Error accessing local storage:", e);
            alert("Could not access local storage. Unable to load.");
            return;
        }

        if (!savedStateString) {
            alert("No saved state found in local storage.");
            console.log("No saved state found.");
            updateLocalStorageButtonStates(); // Should disable load/clear if nothing found
            return;
        }

        try {
            const parsedData = JSON.parse(savedStateString);

            // Basic validation of loaded data
            if (!parsedData || typeof parsedData !== 'object') {
                throw new Error("Saved data format is invalid or corrupted.");
            }

            editorContent.html(parsedData.editorContentHTML || ''); // Handle potentially missing content
            comments = Array.isArray(parsedData.commentsArray) ? parsedData.commentsArray : []; // Handle potentially missing/invalid comments
            llmPromptTextarea.val(parsedData.llmPromptText || defaultLlmPrompt.trim()); // Handle potentially missing prompt

            renderCommentList(); // Re-render comments and highlights
            console.log("State loaded successfully.");

            // Feedback animation for Load button
            const originalHtml = loadStateBtn.html();
            loadStateBtn.html('<i class="fa-solid fa-check me-1"></i> Loaded!');
            loadStateBtn.addClass('btn-load-feedback').prop('disabled', true); // Disable during feedback

            if (loadStateTimeout) clearTimeout(loadStateTimeout);
            loadStateTimeout = setTimeout(() => {
                loadStateBtn.html(originalHtml).removeClass('btn-load-feedback');
                updateLocalStorageButtonStates(); // Re-evaluate button states after load completes
                loadStateTimeout = null;
            }, FEEDBACK_TIMEOUT);

        } catch (error) {
            console.error("Error loading or parsing state:", error);
            alert("An error occurred while trying to load the saved state. It might be corrupted. The corrupted data will be removed.");
            try {
                // Attempt to remove corrupted data
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            } catch (clearError) {
                console.error("Failed to clear potentially corrupted data:", clearError);
            }
            updateLocalStorageButtonStates(); // Update buttons after clearing potentially bad data
        }
    }
    function handleClearState() {
        cancelAndDestroyPopover();
        console.log("Attempting to clear saved state...");
        if (!window.confirm("Are you sure you want to permanently delete the saved work from your browser storage? This cannot be undone.")) {
            console.log("Clear cancelled by user.");
            return;
        }

        try {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            console.log("Saved state cleared successfully.");

            // Feedback animation for Clear button
            const originalHtml = clearStateBtn.html();
            clearStateBtn.html('<i class="fa-solid fa-check me-1"></i> Cleared!');
            clearStateBtn.addClass('btn-clear-feedback').prop('disabled', true); // Disable during feedback

            updateLocalStorageButtonStates(); // Update Load/Clear state immediately

            if (clearStateTimeout) clearTimeout(clearStateTimeout);
            clearStateTimeout = setTimeout(() => {
                clearStateBtn.html(originalHtml).removeClass('btn-clear-feedback');
                // Buttons should already be disabled by updateLocalStorageButtonStates
                clearStateTimeout = null;
            }, FEEDBACK_TIMEOUT);

        } catch (error) {
            console.error("Error clearing state from local storage:", error);
            alert("An error occurred while trying to clear the saved state. Check the console for details.");
            updateLocalStorageButtonStates(); // Ensure buttons reflect current state
        }
    }


    // --- General Event Handlers ---
    editorContent.on('mouseup', function(e) {
        // Ignore clicks inside the popover itself or on existing highlights
        const popoverElement = document.getElementById(CUSTOM_POPOVER_ID);
        if ((popoverElement && popoverElement.contains(e.target)) || $(e.target).closest('.editor-highlight').length > 0) {
            return; // Do nothing if click is within popover or on a highlight
        }

        // Use setTimeout to allow selection to finalize
        setTimeout(() => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || selection.rangeCount === 0 || selection.type !== "Range") {
                // No valid selection, ensure any existing popover is closed
                currentSelectionDetails = null;
                destroyCustomPopoverElement();
                return;
            }

            let range;
            try {
                range = selection.getRangeAt(0);
                // Crucial check: Ensure the selection is actually *within* the editable area
                if (!editorContent[0].contains(range.commonAncestorContainer)) {
                    console.log("Selection ended outside editor content area.");
                    currentSelectionDetails = null;
                    destroyCustomPopoverElement();
                    return;
                }
            } catch (rangeError) {
                console.error("Error getting selection range:", rangeError);
                currentSelectionDetails = null;
                destroyCustomPopoverElement();
                return;
            }

            // Selection is valid and within the editor
            destroyCustomPopoverElement(); // Destroy any previous popover before creating a new one

            const selectedString = getSelectedContentFragment(); // Gets HTML fragment
            const selectedTextOnly = selection.toString().trim(); // Gets plain text

            if (selectedTextOnly !== '') { // Only proceed if there's actual text selected
                try {
                    currentSelectionDetails = null; // Clear previous details first
                    const selectionRect = range.getBoundingClientRect();

                    // Check for zero-dimension rect, which sometimes happens with complex selections
                    if (selectionRect.width === 0 && selectionRect.height === 0 && selectedTextOnly.length > 0) {
                        console.warn("Selection rectangle has zero dimensions, popover position might be inaccurate.");
                        // Consider alternative positioning or just proceed
                    }

                    // Context Calculation (using plain text of the whole editor)
                    const fullTextForContext = getTextContentWithoutHighlights(editorContent[0]);
                    let startIndex = -1, endIndex = -1;

                    try {
                        // Get text before the selection start within the editor
                        const preSelectionRange = document.createRange();
                        preSelectionRange.selectNodeContents(editorContent[0]);
                        preSelectionRange.setEnd(range.startContainer, range.startOffset);
                        const tempDivPre = document.createElement('div');
                        tempDivPre.appendChild(preSelectionRange.cloneContents());
                        const textBeforeSelection = getTextContentWithoutHighlights(tempDivPre); // Use helper to ignore highlights
                        startIndex = textBeforeSelection.length;
                        endIndex = startIndex + selectedTextOnly.length; // Use length of *trimmed* plain text selection

                        // Verification step (optional but recommended)
                        const extractedText = fullTextForContext.substring(startIndex, endIndex);
                        if (extractedText.trim() !== selectedTextOnly) {
                            console.warn(`Context index mismatch. Expected "${selectedTextOnly}", got "${extractedText}". Falling back to simple indexOf.`);
                            const fallbackIndex = fullTextForContext.indexOf(selectedTextOnly);
                            if (fallbackIndex !== -1) {
                                startIndex = fallbackIndex;
                                endIndex = startIndex + selectedTextOnly.length;
                                console.log(`Fallback indices used: ${startIndex}-${endIndex}`);
                            } else {
                                console.error("Fallback indexOf failed to find the selected text. Context will be empty.");
                                startIndex = -1; // Mark as failed
                                endIndex = -1;
                            }
                        }
                    } catch (indexError) {
                        console.error("Error calculating context indices:", indexError);
                        startIndex = -1; // Mark as failed
                        endIndex = -1;
                    }

                    let textBeforeContext = "", textAfterContext = "";
                    if (startIndex !== -1 && endIndex !== -1) {
                        textBeforeContext = fullTextForContext.substring(Math.max(0, startIndex - CONTEXT_CHARS), startIndex);
                        textAfterContext = fullTextForContext.substring(endIndex, Math.min(fullTextForContext.length, endIndex + CONTEXT_CHARS));
                    } else {
                        console.warn("Could not determine context due to index errors.");
                    }
                    // End Context Calculation

                    // Store selection details including the range object
                    currentSelectionDetails = {
                        selectedString: selectedString, // HTML fragment
                        textBeforeContext: textBeforeContext,
                        textAfterContext: textAfterContext,
                        range: range.cloneRange() // Store a clone of the range
                    };

                    console.log("Showing popover for valid selection.");
                    showCustomPopover(selectionRect); // Show the popover positioned relative to selection

                } catch (error) {
                    console.error("Error processing selection:", error);
                    alert("An error occurred while trying to process your selection.");
                    currentSelectionDetails = null;
                    destroyCustomPopoverElement(); // Clean up popover on error
                }
            } else {
                // Selection was whitespace only or empty after trim
                console.log("Selection text empty after trim.");
                currentSelectionDetails = null;
                destroyCustomPopoverElement(); // Clean up popover
            }
        }, 10); // Small delay
    });
    commentList.on('click', '.delete-comment-btn', function() {
        cancelAndDestroyPopover(); // Close popover if open
        const indexToDelete = parseInt($(this).data('index'), 10);

        if (!isNaN(indexToDelete) && indexToDelete >= 0 && indexToDelete < comments.length) {
            const commentToDelete = comments[indexToDelete];

            // 1. Remove the highlight span from the editor content if it exists
            if (commentToDelete && commentToDelete.highlightId) {
                const spanToRemove = document.getElementById(commentToDelete.highlightId);
                if (spanToRemove) {
                    try {
                        // Use jQuery's unwrap to replace the span with its contents
                        $(spanToRemove).contents().unwrap();
                        console.log(`Removed highlight ${commentToDelete.highlightId}`);
                    } catch(unwrapError) {
                        console.error("Error removing highlight span:", unwrapError);
                        // Fallback: If unwrap fails, try removing the node directly (might lose content)
                        // spanToRemove.parentNode.removeChild(spanToRemove); // Use with caution
                    }
                } else {
                    console.warn(`Highlight span with ID ${commentToDelete.highlightId} not found in the editor.`);
                }
            }

            // 2. Remove the comment object from the array
            comments.splice(indexToDelete, 1);

            // 3. Re-index remaining highlights' data attributes in the DOM
            // This is crucial so clicking subsequent highlights points to the correct (new) index
            $('.editor-highlight', editorContent).each(function() {
                const span = $(this);
                const oldIndex = parseInt(span.data('commentIndex'), 10);
                if (!isNaN(oldIndex) && oldIndex > indexToDelete) {
                    const newIndex = oldIndex - 1;
                    span.data('commentIndex', newIndex); // Update jQuery data
                    span.attr('data-comment-index', newIndex); // Update HTML attribute
                    // Also update the ID if it contains the index (optional, but good practice)
                    // Example: if ID was `editor-highlight-timestamp-oldIndex`
                    // let idParts = span.attr('id').split('-');
                    // if (idParts.length >= 3) {
                    //     idParts[idParts.length - 1] = newIndex;
                    //     span.attr('id', idParts.join('-'));
                    // }
                    // Update the corresponding comment object's highlightId if changed
                    // if (comments[newIndex] && comments[newIndex].highlightId === originalId) {
                    //    comments[newIndex].highlightId = span.attr('id');
                    // }
                }
            });
            // Note: Re-indexing comment objects' highlightIds might be needed if IDs change.
            // Simpler if IDs don't contain the index.

            // 4. Re-render the comment list UI
            renderCommentList();

        } else {
            console.error("Invalid index for deletion:", $(this).data('index'));
            alert("Error deleting item. Invalid index specified.");
        }
    });
    copyPromptBtn.on('click', function() {
        cancelAndDestroyPopover();
        if (comments.length === 0) {
            alert("No instructions specified. Please select text and add instructions first.");
            return;
        }

        const currentLlmPrompt = llmPromptTextarea.val();

        // Create a clone of the editor content to clean it without affecting the live editor
        const editorClone = editorContent.clone();
        // Remove all highlight spans, keeping their inner content
        editorClone.find('.editor-highlight').contents().unwrap();
        // Get the cleaned HTML content
        const cleanedRawOriginalContent = editorClone.html().trim();
        // Decode HTML entities for the JSON string (LLM might prefer raw text)
        // This step depends heavily on whether the LLM expects HTML or decoded text.
        // Let's assume decoded text is safer for JSON.
        const decodedOriginalContentForJson = decodeHtmlEntities(cleanedRawOriginalContent);

        // Prepare instructions, decoding selectedString as well
        const processedInstructions = comments.map(instruction => ({
            selectedString: decodeHtmlEntities(instruction.selectedString), // Decode HTML in selection
            textBeforeContext: instruction.textBeforeContext,
            textAfterContext: instruction.textAfterContext,
            comment: instruction.comment.trim() // Ensure comment is trimmed
        }));

        // Construct the final data object
        const submissionData = {
            originalContent: decodedOriginalContentForJson, // Use decoded content
            instructions: processedInstructions
        };

        try {
            // Format the JSON nicely
            const formattedJson = JSON.stringify(submissionData, null, 2);
            // Combine the preamble prompt with the JSON data
            const fullClipboardText = currentLlmPrompt.trim() + "\n\n" + formattedJson;

            // Use Clipboard API
            navigator.clipboard.writeText(fullClipboardText).then(() => {
                console.log('Prompt copied (content cleaned, HTML decoded for JSON).');
                // Feedback animation for Copy button
                const originalHtml = copyPromptBtn.html();
                copyPromptBtn.html('<i class="fa-solid fa-check me-1"></i> Copied!');
                copyPromptBtn.addClass('btn-copy-feedback').prop('disabled', true); // Use primary color feedback

                if (copyTimeout) clearTimeout(copyTimeout);
                copyTimeout = setTimeout(() => {
                    copyPromptBtn.html(originalHtml).removeClass('btn-copy-feedback').prop('disabled', false);
                    copyTimeout = null;
                }, FEEDBACK_TIMEOUT);

            }).catch(err => {
                console.error('Failed to copy text using Clipboard API: ', err);
                // Fallback attempt using document.execCommand (legacy)
                try {
                    const textArea = document.createElement("textarea");
                    textArea.value = fullClipboardText;
                    textArea.style.position = "fixed"; // Prevent scrolling to bottom
                    textArea.style.top = "0";
                    textArea.style.left = "0";
                    textArea.style.width = "2em";
                    textArea.style.height = "2em";
                    textArea.style.padding = "0";
                    textArea.style.border = "none";
                    textArea.style.outline = "none";
                    textArea.style.boxShadow = "none";
                    textArea.style.background = "transparent";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    const successful = document.execCommand('copy');
                    if (successful) {
                        console.log('Prompt copied using fallback execCommand.');
                        // Feedback animation (repeat as above)
                        const originalHtml = copyPromptBtn.html();
                        copyPromptBtn.html('<i class="fa-solid fa-check me-1"></i> Copied!');
                        copyPromptBtn.addClass('btn-copy-feedback').prop('disabled', true);
                        if (copyTimeout) clearTimeout(copyTimeout);
                        copyTimeout = setTimeout(() => {
                            copyPromptBtn.html(originalHtml).removeClass('btn-copy-feedback').prop('disabled', false);
                            copyTimeout = null;
                        }, FEEDBACK_TIMEOUT);
                    } else {
                        throw new Error('Fallback execCommand failed.');
                    }
                    document.body.removeChild(textArea);
                } catch (fallbackErr) {
                    console.error('Fallback copy method failed:', fallbackErr);
                    alert('Failed to copy prompt to clipboard. Please try copying manually or check browser permissions/console.');
                }
            });
        } catch (error) {
            console.error("Error preparing data for clipboard:", error);
            alert("Sorry, could not prepare the data for copying. Check the console for details.");
        }
    });
    promptCollapseContainer.addEventListener('show.bs.collapse', function () {
        promptCaretIcon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
    });
    promptCollapseContainer.addEventListener('hide.bs.collapse', function () {
        promptCaretIcon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
    });
    editorContent.on('click', '.editor-highlight', function(e) {
        e.stopPropagation(); // Prevent editor mouseup handler from firing
        e.preventDefault(); // Prevent any default span behavior

        const commentIndex = $(this).data('comment-index');
        console.log(`Clicked highlight associated with comment index: ${commentIndex}`);

        if (typeof commentIndex !== 'undefined') {
            highlightCommentListItem(commentIndex); // Highlight the corresponding comment in the list
        } else {
            console.warn("Clicked highlight span does not have a valid data-comment-index attribute.");
        }

        // Ensure any open popover is closed when clicking a highlight
        cancelAndDestroyPopover();
    });


    // --- Core Functions ---
    function renderCommentList() {
        commentList.empty(); // Clear existing list items
        if (comments.length === 0) {
            // Display placeholder when no comments exist
            const placeholderHtml = `<li class="list-group-item text-muted d-flex align-items-center justify-content-center" id="no-comments-placeholder" style="min-height: 60px;">No instructions added yet.</li>`;
            commentList.append(placeholderHtml);
        } else {
            // Render each comment item
            comments.forEach((item, index) => {
                // Sanitize and prepare display text for selected string
                const maxDisplayLength = 50; // Max length for the snippet preview
                const decodedHtmlFragment = decodeHtmlEntities(item.selectedString || ''); // Decode entities for display
                const escapedHtmlFragment = escapeHtml(decodedHtmlFragment); // Escape for safe insertion into HTML attribute/display
                const displayText = escapedHtmlFragment.length > maxDisplayLength
                    ? escapedHtmlFragment.substring(0, maxDisplayLength) + '...'
                    : escapedHtmlFragment;
                const tooltipText = escapedHtmlFragment; // Full text for tooltip

                // Use the stored highlight color, default if missing
                const itemColor = item.highlightColor || '#cccccc'; // Fallback color

                // Sanitize comment text for display
                const escapedCommentText = escapeHtml(item.comment || '');

                // Construct list item HTML (ensure all dynamic content is escaped)
                const listItem = `
                        <li class="list-group-item" data-comment-list-index="${index}">
                            <span class="color-indicator" style="background-color: ${itemColor};" title="Highlight Color"></span>
                            <span class="selected-text" title="${tooltipText}">
                                "${displayText}"
                            </span>
                            <span class="comment-content">
                                <span class="comment-text">${escapedCommentText}</span>
                                <button type="button" class="delete-comment-btn" data-index="${index}" title="Delete instruction">
                                    <i class="fa-solid fa-trash-can fa-fw"></i>
                                </button>
                            </span>
                        </li>
                    `;
                commentList.append(listItem);
            });
        }
        // Ensure Load/Clear buttons reflect whether state exists AFTER rendering potentially loaded data
        updateLocalStorageButtonStates();
    }


    // --- Initialisation ---
    llmPromptTextarea.val(defaultLlmPrompt.trim()); // Set default prompt text
    // Initial content for the editor
    const initialContent = `1. Paste your document text or code here.
2. Select a portion of the text you want to change.
3. An input box will appear - type your instruction for the change (e.g., "Rewrite this sentence to be more formal", "Fix the typo", "Convert this list to a table").
4. Press Enter to save the instruction.
5. Repeat for all desired edits.
6. Add/remove lines, paste code like <link rel="stylesheet" href="..."> etc.
7. Use the Save/Load buttons to persist your work *in this browser*. (No data is ever sent to a server from this tool.)
8. Click 'Copy Editor Prompt' to get the full prompt for your LLM.
9. Paste this into your chosen LLM and watch it perform the exact edits you requested.`;
    editorContent.text(initialContent);
    renderCommentList(); // Render the initial empty comment list (with placeholder)

    // Attach handlers for local storage buttons
    saveStateBtn.on('click', handleSaveState);
    loadStateBtn.on('click', handleLoadState);
    clearStateBtn.on('click', handleClearState);

    // Set initial state of Load/Clear buttons based on local storage
    updateLocalStorageButtonStates();

    // Initialize Theme and Attach Toggle Handler
    loadInitialTheme();
    darkModeSwitch.on('change', toggleTheme);
    // Optional: Listen for system preference changes (only if no user preference saved)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        // Only change if no theme explicitly set by user via toggle/storage
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
            applyTheme(event.matches ? 'dark' : 'light');
        }
    });


    // Global click listener to close popover when clicking outside relevant areas
    $(document).on('click', function(event) {
        const popoverElement = document.getElementById(CUSTOM_POPOVER_ID);
        const $target = $(event.target);

        // Check if the popover is currently visible
        if (popoverElement && popoverElement.style.visibility === 'visible') {
            // Check if the click occurred outside the popover AND outside the editor AND not on a highlight
            if (!popoverElement.contains(event.target) &&
                !$target.closest('#editor-content').length &&
                !$target.closest('.editor-highlight').length)
                // Optional: Add checks for other elements that shouldn't close the popover if needed
                // && !$target.closest('#copyPromptBtn').length ... etc.
            {
                console.log("Click outside popover/editor detected. Closing popover.");
                cancelAndDestroyPopover();
            }
        }
    });

    // Optional: Add focus listener to editor to close popover if user starts typing elsewhere
    // editorContent.on('focus', function() {
    //      cancelAndDestroyPopover();
    // });

    }); // End of $(document).ready()