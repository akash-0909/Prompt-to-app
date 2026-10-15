import { useEffect, useState } from "react";
import { getWebContainer } from "../lib/webcontainer";
const files = {
  "package.json": {
    file: {
      contents: JSON.stringify({
        scripts: {
          dev: "vite --host 0.0.0.0",
        },
        dependencies: {
          vite: "latest",
        },
      }),
    },
  },

  "index.html": {
    file: {
      contents: `
<!DOCTYPE html>
<html>
  <head>
    <title>Generated App</title>
  </head>

  <body>
    <h1>Hello from Prompt-to-App </h1>
    <p>This app is running inside WebContainer!</p>
  </body>
</html>
      `,
    },
  },
};

export default function WebContainerDemo() {
  const [responseText, setResponseText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const startWebContainer = async () => {
      try {
        const container = await getWebContainer();

        console.log("WebContainer ready!");

        await container.mount(files);

        console.log("Files mounted!");

        const installProcess = await container.spawn(
          "npm",
          ["install"]
        );

        const installExitCode = await installProcess.exit;

        console.log(
          "npm install finished with code:",
          installExitCode
        );

        container.on("server-ready", (port, url) => {
          console.log("Server ready!");
          console.log("Port:", port);
          console.log("URL:", url);

          setUrl(url);
        });

        await container.spawn("npm", ["run", "dev"]);

        console.log("Dev server process started!");
      } catch (error) {
        console.error("WebContainer error:", error);
      }
    };

    startWebContainer();
  }, []);
  const testBackend = async () => {
    try {
      setResponseText("");
      setIsGenerating(true);

      const response = await fetch(
        "http://localhost:5000/api/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: "Create a simple todo application",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body is empty");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        // Convert bytes → string
        buffer += decoder.decode(value, {
          stream: true,
        });

        // SSE events are separated by a blank line
        const events = buffer.split(/\r?\n\r?\n/);

        // Last part may be incomplete
        buffer = events.pop() ?? "";

        for (const event of events) {
          const lines = event.split(/\r?\n/);

          for (const line of lines) {
            if (!line.startsWith("data: ")) {
              continue;
            }

            const data = line.slice(6);

            if (data === "[DONE]") {
              continue;
            }

            const text = JSON.parse(data);

            setResponseText((prev) => prev + text);
          }
        }
      }

    } catch (error) {
      console.error("Streaming error:", error);
    } finally {
      setIsGenerating(false);
    }
  };
  return (
    <div>
      <h1>Prompt-to-App</h1>
      <button onClick={testBackend} disabled={isGenerating}>
        {isGenerating ? "Generating..." : "Test Gemini"}
      </button>
      <div>
        <h2>Gemini Response</h2>

        <pre
          style={{
            whiteSpace: "pre-wrap",
            border: "1px solid #ccc",
            padding: "10px",
            minHeight: "200px",
          }}
        >
          {responseText}
        </pre>

        {isGenerating && <p>Generating...</p>}
      </div>
      {url ? (
        <iframe
          src={url}
          title="Generated App Preview"
          style={{
            width: "100%",
            height: "500px",
            border: "1px solid #ccc",
          }}
        />
      ) : (
        <p>Starting generated application...</p>
      )}
    </div>
  );
}