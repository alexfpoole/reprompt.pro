# Reprompt.Pro Editor

A client-side web tool to help generate structured instructions for LLMs to perform content edits. Paste content, select text, add instructions, and generate a formatted prompt.

## Key Features

*   Paste content (text/code).
*   Select text & add editing instructions via pop-over.
*   Visually highlights selected text linked to instructions.
*   Lists all instructions clearly.
*   Customize the LLM preamble.
*   Generate and copy a structured prompt (preamble, content, instructions).
*   Save/Load/Clear work using browser `localStorage`. Nothing is sent to the server so your data remains private.
*   Dark/Light mode toggle.
*   Responsive design.

## How to Use

1.  **Paste Content:** Paste into the left editor pane.
2.  **Select Text:** Highlight the portion to edit.
3.  **Add Instruction:** Type your instruction in the pop-over and press `Enter`.
4.  **Repeat:** Add instructions for all desired edits.
5.  **Customize (Optional):** Modify the LLM preamble text.
6.  **Save/Load (Optional):** Use buttons to manage work in `localStorage`.
7.  **Copy Prompt:** Click "Copy Editor Prompt".
8.  **Use with LLM:** Paste the copied prompt into your LLM.

## Running Locally

1.  Clone the repository.
2.  Open `index.html` directly in your browser.

## Technology Stack

*   HTML5, CSS3 (Variables), JavaScript (ES6+)
*   jQuery, Bootstrap 5, Font Awesome 6

## Local Storage

The Save/Load/Clear buttons use browser `localStorage` to store your session (content, instructions, prompt) *locally*. This data is specific to your browser and the origin you load the file from. It's not a cloud backup.

## Contributing

Pull requests are welcome. Please open an issue first for major changes.
