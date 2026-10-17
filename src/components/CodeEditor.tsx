
import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  fileName: string;
  code: string;
  onChange: (value: string) => void;
}

export default function CodeEditor({
  fileName,
  code,
  onChange,
}: CodeEditorProps) {
  return (
    <div
      style={{
        height: "500px",
        border: "1px solid #30363d",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          background: "#1e1e1e",
          color: "#cccccc",
          fontSize: "13px",
          borderBottom: "1px solid #30363d",
        }}
      >
        {fileName}
      </div>

      <Editor
        height="calc(100% - 38px)"
        language={
          fileName.endsWith(".tsx") || fileName.endsWith(".ts")
            ? "typescript"
            : fileName.endsWith(".css")
              ? "css"
              : fileName.endsWith(".json")
                ? "json"
                : fileName.endsWith(".html")
                  ? "html"
                  : "javascript"
        }
        theme="vs-dark"
        value={code}
        onChange={(value) => onChange(value ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
