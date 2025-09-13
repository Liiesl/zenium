// -------------------------------------------------------------------
// |                      PLACEHOLDER CONTENT                        |
// |   This section contains the default code that will appear in    |
// |   the editor when the page loads.                               |
// -------------------------------------------------------------------

const placeholderHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zenium CodePad</title>

    <!-- To use the CSS from the CSS tab, you MUST include this link -->
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <h1>Hello, Zenium! ✨</h1>
    <p>This is a live code editor that mimics a real dev environment.</p>
    <p>Try removing the link/script tags from the HTML to see the CSS/JS tabs get ignored!</p>
    <button>Click Me</button>

    <!-- To use the JavaScript from the JS tab, you MUST include this script -->
    <script src="script.js"></script>
</body>
</html>`;

const placeholderCSS = `/* To apply this CSS, you must add the following to your HTML's <head>:
   <link rel="stylesheet" href="styles.css">
*/
body {
  font-family: sans-serif;
  text-align: center;
  padding-top: 50px;
  background-color: #f0f8ff;
  transition: background-color 0.3s ease;
}

h1 {
  color: #333;
}

button {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  background-color: #007acc;
  color: white;
  cursor: pointer;
  transition: transform 0.2s;
}

button:hover {
  transform: scale(1.1);
}
`;

const placeholderJS = `// To run this JS, you must add the following to your HTML body:
// <script src="script.js"></script>

function changeColor() {
  const colors = ['#ff6b6b', '#f06595', '#cc5de8', '#845ef7', '#5c7cfa', '#f0f8ff'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  document.body.style.backgroundColor = randomColor;
}

const button = document.querySelector('button');
if (button) {
    button.addEventListener('click', changeColor);
}
`;


// -------------------------------------------------------------------
// |                      EDITOR LOGIC                               |
// |   This section controls the functionality of the code editor.   |
// -------------------------------------------------------------------

// Wrap all DOM-dependent logic in a function
function initializeApp() {
    const htmlEditor = document.getElementById('html-editor');
    const cssEditor = document.getElementById('css-editor');
    const jsEditor = document.getElementById('js-editor');
    const previewFrame = document.getElementById('preview-frame');
    const tabs = document.querySelector('.tabs');
    const editorContainers = document.querySelectorAll('.editor');

    let updateTimeout;

    // ===================================================================
    // |                     MODIFIED UPDATE LOGIC                       |
    // | The logic below has been simplified. It no longer auto-injects  |
    // | code. It will ONLY add CSS or JS if the corresponding tags      |
    // | (<link...href="styles.css"> and <script...src="script.js">)       |
    // | are found in the HTML editor.                                   |
    // ===================================================================
    function updatePreview() {
        let htmlContent = htmlEditor.value;
        const cssContent = cssEditor.value;
        const jsContent = jsEditor.value;

        // Sanitize the JavaScript content to escape any closing script tags.
        const sanitizedJsContent = jsContent.replace(/<\/script>/g, '<\\/script>');

        // Create a regex to find the specific CSS link tag.
        const cssLinkTagRegex = /<link\s+[^>]*rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["'](?:\.\/|\/)?styles\.css["'][^>]*>/i;
        if (cssLinkTagRegex.test(htmlContent)) {
            // If the CSS link tag is found, replace it with the actual CSS content.
            const styleTag = `<style>\n${cssContent}\n</style>`;
            htmlContent = htmlContent.replace(cssLinkTagRegex, styleTag);
        }

        // Create a regex to find the specific JS script tag.
        const jsScriptTagRegex = /<script\s+[^>]*src\s*=\s*["'](?:\.\/|\/)?code\.js["'][^>]*>\s*<\/script>/i;
        if (jsScriptTagRegex.test(htmlContent)) {
            // If the JS script tag is found, replace it with the actual JS content.
            const scriptTag = `<script>\ntry {\n${sanitizedJsContent}\n} catch(e) { console.error(e); }\n</script>`;
            htmlContent = htmlContent.replace(jsScriptTagRegex, scriptTag);
        }

        // The final HTML is now directly based on the replacements.
        // No more fallback logic that auto-injects everything.
        previewFrame.srcdoc = htmlContent;
    }


    function scheduleUpdate() {
        // Debounce the update to avoid refreshing on every single keystroke
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(updatePreview, 250);
    }

    // Function to set up the initial state of the editor
    function initializeEditor() {
        htmlEditor.value = placeholderHTML;
        cssEditor.value = placeholderCSS;
        jsEditor.value = placeholderJS;
        updatePreview(); // Perform the initial render
    }

    // --- Event Listeners ---

    // Tab switching logic
    tabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
            const targetTab = e.target.dataset.tab;

            // Update active button
            document.querySelectorAll('.tab-button').forEach(button => {
                button.classList.remove('active');
            });
            e.target.classList.add('active');

            // Update active editor
            editorContainers.forEach(editor => {
                if (editor.id === `${targetTab}-container`) {
                    editor.classList.add('active');
                } else {
                    editor.classList.remove('active');
                }
            });
        }
    });

    // Update preview on input
    htmlEditor.addEventListener('input', scheduleUpdate);
    cssEditor.addEventListener('input', scheduleUpdate);
    jsEditor.addEventListener('input', scheduleUpdate);

    // Initialize the editor on page load
    initializeEditor();
}

// Wait for the DOM to be fully loaded before running the app logic
document.addEventListener('DOMContentLoaded', initializeApp);