
interface FileExplorerProps {
  files: string[];
  selectedFile: string;
  onSelect: (filePath: string) => void;
}

export default function FileExplorer({
  files,
  selectedFile,
  onSelect,
}: FileExplorerProps) {
  return (
    <div
      style={{
        width: "220px",
        minWidth: "180px",
        background: "#181818",
        color: "#cccccc",
        border: "1px solid #30363d",
        borderRadius: "8px",
        padding: "12px 0",
        fontSize: "13px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          padding: "0 14px 12px",
          fontWeight: 600,
          letterSpacing: "0.5px",
        }}
      >
        EXPLORER
      </div>

      {files.map((filePath) => {
        const isSelected = filePath === selectedFile;

        return (
          <button
            key={filePath}
            onClick={() => onSelect(filePath)}
            title={filePath}
            style={{
              display: "block",
              width: "100%",
              padding: "7px 14px",
              textAlign: "left",
              border: "none",
              cursor: "pointer",
              color: isSelected ? "#ffffff" : "#cccccc",
              background: isSelected ? "#37373d" : "transparent",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            📄 {filePath}
          </button>
        );
      })}

      {files.length === 0 && (
        <p style={{ padding: "0 14px", color: "#888888" }}>
          Generate an app to see files.
        </p>
      )}
    </div>
  );
}
