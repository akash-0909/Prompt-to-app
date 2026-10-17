
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
    <div style={{ padding: 20, color: "#ddd", background: "#111", minHeight: "100vh" }}>
      <h1>Prompt-to-App</h1>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe the application you want..."
        rows={3}
        style={{
          width: "100%",
          padding: 10,
          boxSizing: "border-box",
          marginBottom: 10,
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

      {error && <p style={{ color: "#ff7777" }}>Error: {error}</p>}

      <h2>Gemini Response</h2>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          border: "1px solid #444",
          padding: 10,
          maxHeight: 200,
          overflowY: "auto",
        }}
      >
        {responseText}
      </pre>

      <h2>Generated Code</h2>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "stretch",
          flexWrap: "wrap",
        }}
      >
        <FileExplorer
          files={Object.keys(files).sort()}
          selectedFile={selectedFile}
          onSelect={setSelectedFile}
        />

        <div style={{ flex: 1, minWidth: 300 }}>
          <CodeEditor
            fileName={selectedFile || "No file selected"}
            code={files[selectedFile] ?? ""}
            onChange={handleFileChange}
          />
        </div>
      </div>

      <h2>Live Preview</h2>

      {url ? (
        <iframe
          src={url}
          title="Generated App Preview"
          style={{
            width: "100%",
            height: 500,
            border: "1px solid #444",
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
