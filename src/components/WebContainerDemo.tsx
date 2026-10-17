
import { useEffect, useState } from "react";
import type { WebContainer } from "@webcontainer/api";
import { getWebContainer } from "../lib/webcontainer";
import { parseXmlToFileTree } from "../lib/fileTree";

export default function WebContainerDemo() {
  const [container, setContainer] = useState<WebContainer | null>(null);
  const [prompt, setPrompt] = useState(
    "Create a simple todo application"
  );
  const [responseText, setResponseText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const startWebContainer = async () => {
      try {
        const instance = await getWebContainer();

        if (cancelled) return;

        instance.on("server-ready", (_port, serverUrl) => {
          if (!cancelled) {
            setUrl(serverUrl);
            setIsRunning(false);
          }
        });

        setContainer(instance);
        console.log("WebContainer ready!");
      } catch (err) {
        console.error("WebContainer error:", err);
        if (!cancelled) {
          setError("Could not start WebContainer.");
        }
      }
    };

    startWebContainer();

    return () => {
      cancelled = true;
    };
  }, []);

  const generateApp = async () => {
    if (!container || !prompt.trim() || isGenerating || isRunning) {
      return;
    }

    setResponseText("");
    setError("");
    setIsGenerating(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt }),
        }
      );

      if (!response.ok) {
        throw new Error(`Backend returned HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response stream is empty.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let generatedCode = "";
      let receivedDone = false;

      const processEvent = (event: string) => {
        for (const line of event.split(/\r?\n/)) {
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6);

          if (data === "[DONE]") {
            receivedDone = true;
            continue;
          }

          const chunk: unknown = JSON.parse(data);

          if (
            typeof chunk === "object" &&
            chunk !== null &&
            "error" in chunk
          ) {
            throw new Error(String(chunk.error));
          }

          if (typeof chunk !== "string") {
            throw new Error("Unexpected data from the generation API.");
          }

          generatedCode += chunk;
          setResponseText((previous) => previous + chunk);
        }
      };

      while (!receivedDone) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";

        for (const event of events) {
          processEvent(event);
          if (receivedDone) break;
        }
      }

      buffer += decoder.decode();

      if (receivedDone) {
        // Process any remaining complete event before the DONE marker
        // was received only if it is present in the remaining buffer.
        if (buffer.trim()) {
          processEvent(buffer);
        }
      }

      if (!receivedDone) {
        throw new Error("Generation ended before the DONE marker.");
      }

      const fileTree = parseXmlToFileTree(generatedCode);

      if (Object.keys(fileTree).length === 0) {
        throw new Error(
          "No files were parsed. Check Gemini's file-tag format."
        );
      }

      if (!fileTree["package.json"]) {
        throw new Error(
          "Generated output must include a root package.json."
        );
      }

      console.log("Generated file tree:", fileTree);

      setIsRunning(true);
      setUrl("");

      await container.mount(fileTree);

      const install = await container.spawn("npm", ["install"]);
      const installExitCode = await install.exit;

      if (installExitCode !== 0) {
        throw new Error("npm install failed. Check the generated package.json.");
      }

      const devProcess = await container.spawn("npm", ["run", "dev"]);

      // Keep the dev server process alive inside WebContainer.
      void devProcess;

      console.log("Generated app started!");
    } catch (err) {
      console.error("Generation or execution error:", err);
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
      setIsRunning(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Prompt-to-App</h1>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe the application you want..."
        rows={4}
        style={{
          width: "100%",
          padding: "10px",
          boxSizing: "border-box",
        }}
      />

      <button
        onClick={generateApp}
        disabled={!container || isGenerating || isRunning || !prompt.trim()}
      >
        {!container
          ? "Starting WebContainer..."
          : isGenerating
            ? "Generating..."
            : isRunning
              ? "Installing and starting app..."
              : "Generate & Run App"}
      </button>

      {error && (
        <p style={{ color: "red" }}>
          Error: {error}
        </p>
      )}

      <h2>Gemini Response</h2>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          border: "1px solid #ccc",
          padding: "10px",
          minHeight: "150px",
          maxHeight: "350px",
          overflowY: "auto",
        }}
      >
        {responseText}
      </pre>

      <h2>Live Preview</h2>

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
        <p>
          {isRunning
            ? "Installing dependencies and starting the app..."
            : "Your generated app will appear here."}
        </p>
      )}
    </div>
  );
}
