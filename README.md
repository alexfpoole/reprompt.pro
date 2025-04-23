# Reprompt.Pro Editor

A client-side web tool designed to help users generate structured instructions for Large Language Models (LLMs) to perform content edits. Paste your content, select specific portions, add instructions, and generate a formatted prompt for your LLM.


## Overview

This editor provides a visual interface to bridge the gap between raw content and the detailed, structured input often required for effective LLM-based editing. Instead of trying to describe edits vaguely, you can pinpoint exact text snippets (including HTML) and associate clear instructions with them. The tool then formats this information, along with the original content and a customizable preamble, into a prompt ready to be copied and used with an LLM.

**Key Features:**

*   ✨ **Content Pasting:** Easily paste your document text or code into the editor pane.
*   🖱️ **Text Selection & Commenting:** Select any text snippet to add a specific editing instruction via a pop-over.
*   🎨 **Visual Highlighting:** Selected text associated with a comment is highlighted in the editor. Highlight colors cycle through a predefined palette.
*   📝 **Instruction List:** All added instructions are clearly listed, showing the selected text snippet, the instruction, and the corresponding highlight color.
*   🗑️ **Delete Instructions:** Easily remove instructions and their associated highlights.
*   🖱️ **Highlight-to-Comment Linking:** Click on a highlight in the editor to scroll to and temporarily highlight the corresponding instruction in the list.
*   ⚙️ **Customizable LLM Preamble:** Edit the introductory text that precedes the content and instructions in the final prompt.
*   📋 **Formatted Prompt Generation:** Generates a structured prompt including the preamble, the cleaned original content, and a JSON array of instructions (selected string, context, comment).
*   ✂️ **Copy to Clipboard:** One-click copying of the fully formatted prompt.
*   💾 **Local State Persistence:** Save your current editor content, instructions, and custom prompt to your browser's `localStorage`.
*   ⬆️ **Load Saved State:** Load previously saved work from `localStorage`.
*   🧹 **Clear Saved State:** Remove saved work from `localStorage`.
*   🌗 **Dark/Light Mode:** Toggle between themes, with your preference saved in `localStorage`.
*   📱 **Responsive Design:** Adapts to different screen sizes.

## How to Use

1.  **Paste Content:** Copy your text or code and paste it into the left editor pane.
2.  **Select Text:** Highlight the specific portion of the content you want the LLM to edit.
3.  **Add Instruction:** A pop-over will appear. Type your editing instruction (e.g., "Rewrite this sentence formally", "Fix the typo: change 'teh' to 'the'", "Convert this list to bullet points") and press `Enter` (or `Shift+Enter` for a newline within the instruction).
4.  **Repeat:** Repeat steps 2-3 for all the edits you want to specify. You'll see highlights appear in the editor and instructions appear in the list on the right.
5.  **Customize Prompt (Optional):** Expand the "Customize LLM Prompt" section and modify the preamble text if needed.
6.  **Save (Optional):** Click the "Save" button to store your current work (content, instructions, prompt) in your browser's local storage for later use.
7.  **Load (Optional):** Click "Load" to retrieve previously saved work (this will overwrite your current session).
8.  **Copy Prompt:** When ready, click the "Copy Editor Prompt" button.
9.  **Use with LLM:** Paste the copied prompt into your preferred LLM interface.

## Technology Stack

*   **HTML5**
*   **CSS3:** (Utilizes CSS Variables for theming)
*   **JavaScript (ES6+)**
*   **jQuery:** (DOM manipulation and event handling)
*   **Bootstrap 5:** (Layout, components, utilities)
*   **Font Awesome 6:** (Icons)

## Running Locally

As this is a purely client-side application, you can run it directly by:

1.  **Cloning the repository:**
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```
2.  **Opening the HTML file:** Simply double-click the main `.html` file (e.g., `repromptv4_darkmode.html`) in your browser.

## Local Storage Usage

The "Save", "Load", and "Clear" buttons interact with your browser's `localStorage`.

*   **Saving:** Stores the editor's HTML content, the array of comment objects, and the custom LLM prompt text under a specific key (`llmEditorSavedState`).
*   **Scope:** This data is **specific to the browser and the domain** (e.g., `localhost:8000` or `file://` path) you are using. It won't be available in other browsers or if you serve the file from a different origin.
*   **Persistence:** It persists until you explicitly click "Clear", manually clear your browser's `localStorage` for the site, or potentially if your browser runs low on storage space.
*   **Not a Backup:** This is **not** a cloud backup. No data is sent to any server.

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

