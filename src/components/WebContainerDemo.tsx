
import { useEffect, useState } from "react";
import type { WebContainer } from "@webcontainer/api";
import { getWebContainer } from "../lib/webcontainer";
import {
  parseXmlToFileTree,
  type FileTree,
  type WebContainerNode,
} from "../lib/fileTree";
import CodeEditor from "./CodeEditor";
import FileExplorer from "./FileExplorer";

function flattenFileTree(
  tree: FileTree,
  prefix = "",
  result: Record<string, string> = {}
): Record<string, string> {
  for (const [name, node] of Object.entries(tree)) {
    const path = prefix ? `${prefix}/${name}` : name;

    if ("file" in node) {
      result[path] = node.file.contents;
    } else {
      flattenFileTree(node.directory, path, result);
    }
  }

  return result;
}

function updateFileTree(
  tree: FileTree,
  path: string,
  contents: string
): FileTree {
  const parts = path.split("/");
  const updated = { ...tree };
  let current = updated;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const node = current[part];

    if (!node || !("directory" in node)) {
      throw new Error(`Directory not found: ${part}`);
    }

    const copiedDirectory = { ...node.directory };
    current[part] = { directory: copiedDirectory };
    current = copiedDirectory;
  }

  current[parts[parts.length - 1]] = {
    file: { contents },
  };

  return updated;
}

export default function WebContainerDemo() {
  const [previewKey, setPreviewKey] = useState(0);
  const [container, setContainer] = useState<WebContainer | null>(null);
  const [prompt, setPrompt] = useState(
    "Create a simple todo application"
  );
  const [responseText, setResponseText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const [fileTree, setFileTree] = useState<FileTree>({});
  const [files, setFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState("");

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
          headers: { "Content-Type": "application/json" },
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

      if (!receivedDone) {
        throw new Error("Generation ended before the DONE marker.");
      }

      const parsedTree = parseXmlToFileTree(generatedCode);

      if (Object.keys(parsedTree).length === 0) {
        throw new Error("No files were parsed from Gemini's response.");
      }

      if (
        !parsedTree["package.json"] ||
        !("file" in parsedTree["package.json"])
      ) {
        throw new Error("Generated output needs a root package.json.");
      }

      const flatFiles = flattenFileTree(parsedTree);

      if (!flatFiles["package.json"]) {
        throw new Error("The generated package.json is empty.");
      }

      setIsRunning(true);
      setUrl("");

      await container.mount(parsedTree);

      setFileTree(parsedTree);
      setFiles(flatFiles);
      setSelectedFile(Object.keys(flatFiles)[0] ?? "");

      const install = await container.spawn("npm", ["install"]);
      const installExitCode = await install.exit;

      if (installExitCode !== 0) {
        throw new Error("npm install failed.");
      }

      const devProcess = await container.spawn("npm", ["run", "dev"]);
      void devProcess;

      console.log("Generated app started!");
    } catch (err) {
      console.error("Generation or execution error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsRunning(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = async (contents: string) => {
    if (!container || !selectedFile) return;

    setFiles((previous) => ({
      ...previous,
      [selectedFile]: contents,
    }));

    setFileTree((previous) =>
      updateFileTree(previous, selectedFile, contents)
    );

    try {
      await container.fs.writeFile(`/${selectedFile}`, contents);
    } catch (err) {
      console.error("Could not write file:", err);
      setError(
        `Could not save ${selectedFile} to the WebContainer filesystem.`
      );
    }
  };

  
return (
  <div
   style={{
  width: "100%",
  minHeight: "100vh",
  background: "#111318",
  color: "#e5e7eb",
  padding: "16px 20px",
  boxSizing: "border-box",
}}
  >
    {/* Header */}
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 16,
      }}
    >
      <div>
        <h1 style={{ margin: 0 }}>Prompt-to-App</h1>
        <p style={{ color: "#9ca3af", margin: "6px 0 0" }}>
          Build, edit, and preview AI-generated applications
        </p>
      </div>

      <button
        onClick={generateApp}
        disabled={
          !container ||
          isGenerating ||
          isRunning ||
          !prompt.trim()
        }
        style={{
          padding: "10px 18px",
          border: 0,
          borderRadius: 8,
          background: "#635bff",
          color: "#fff",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        {!container
          ? "Starting WebContainer..."
          : isGenerating
            ? "Generating..."
            : isRunning
              ? "Installing and starting..."
              : "Generate & Run"}
      </button>
    </header>

    {/* Prompt */}
    <div style={{ marginBottom: 12 }}>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe the app you want to build..."
        rows={2}
        style={{
          width: "100%",
          padding: 12,
          boxSizing: "border-box",
          border: "1px solid #343844",
          borderRadius: 8,
          background: "#1b1e26",
          color: "#fff",
          resize: "vertical",
        }}
      />
    </div>

    {error && (
      <p style={{ color: "#f87171" }}>
        {error}
      </p>
    )}

    {/* Generation output */}
    <details style={{ marginBottom: 16 }}>
      <summary style={{ cursor: "pointer", color: "#a5b4fc" }}>
        Gemini response — {responseText.length} characters
      </summary>

      <pre
        style={{
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          maxHeight: 220,
          overflow: "auto",
          padding: 12,
          background: "#1b1e26",
          border: "1px solid #343844",
          borderRadius: 8,
        }}
      >
        {responseText || "Generated source will appear here."}
      </pre>
    </details>

    {/* Three-panel workspace */}
    <div
      style={{
  display: "grid",
  gridTemplateColumns:
    "minmax(200px, 0.75fr) minmax(400px, 1.5fr) minmax(400px, 1.5fr)",
  gap: 12,
  alignItems: "stretch",
  width: "100%",
  minHeight: "calc(100vh - 230px)",
}}
    >
      {/* File Explorer */}
      <section
        style={{
          minWidth: 0,
          background: "#181a20",
          border: "1px solid #343844",
          borderRadius: 8,
          padding: 8,
          overflow: "auto",
        }}
      >
        <FileExplorer
          files={Object.keys(files).sort()}
          selectedFile={selectedFile}
          onSelect={setSelectedFile}
        />
      </section>

      {/* Code Editor */}
      <section
        style={{
          minWidth: 0,
          background: "#181a20",
          border: "1px solid #343844",
          borderRadius: 8,
          padding: 8,
          overflow: "hidden",
        }}
      >
        <h3
          style={{
            margin: "8px 8px 14px",
            fontSize: 13,
            overflowWrap: "anywhere",
          }}
        >
          {selectedFile || "CODE EDITOR"}
        </h3>

        <CodeEditor
          fileName={selectedFile || "No file selected"}
          code={files[selectedFile] ?? ""}
          onChange={handleFileChange}
        />
      </section>

      {/* Live Preview */}
      <section
        style={{
          minWidth: 0,
          background: "#181a20",
          border: "1px solid #343844",
          borderRadius: 8,
          padding: 8,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            margin: "0 4px 12px",
          }}
        >
          <h3 style={{ margin: 4, fontSize: 13 }}>
            LIVE PREVIEW
          </h3>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setPreviewKey((key) => key + 1)}
              disabled={!url}
              title="Reload preview"
            >
              ↻ Refresh
            </button>

            <button
              onClick={() => {
                if (url) {
                  window.open(url, "_blank", "noopener,noreferrer");
                }
              }}
              disabled={!url}
              title="Open preview in a new tab"
            >
              ↗ Open
            </button>
          </div>
        </div>

        {url ? (
          <iframe
            key={previewKey}
            src={url}
            title="Generated app preview"
            style={{
              width: "100%",
              flex: 1,
              minHeight: 560,
              border: "1px solid #343844",
              borderRadius: 6,
              background: "#fff",
            }}
          />
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 560,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: "#9ca3af",
              padding: 16,
            }}
          >
            {isGenerating
              ? "Generating your application..."
              : isRunning
                ? "Installing dependencies and starting the server..."
                : "Generate an app to see its preview here."}
          </div>
        )}
      </section>
    </div>
  </div>
);

}
