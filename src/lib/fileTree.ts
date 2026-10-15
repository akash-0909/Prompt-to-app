export interface WebContainerFileNode {
  file: {
    contents: string;
  };
}

export interface WebContainerDirectoryNode {
  directory: {
    [key: string]: WebContainerNode;
  };
}

export type WebContainerNode =
  | WebContainerFileNode
  | WebContainerDirectoryNode;

export type FileTree = Record<string, WebContainerNode>;

export function parseXmlToFileTree(xmlString: string): FileTree {
  const fileTree: FileTree = {};

  const fileRegex =
    /<file\s+path=["']([^"']+)["']\s*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/file>/gi;

  let match;

  while ((match = fileRegex.exec(xmlString)) !== null) {
    const filePath = match[1];

    const fileContent =
      (match[2] !== undefined ? match[2] : match[3]).trim();

    const parts = filePath.split("/");
    let current = fileTree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (i === parts.length - 1) {
        current[part] = {
          file: {
            contents: fileContent,
          },
        };
      } else {
        if (
          !current[part] ||
          !("directory" in current[part])
        ) {
          current[part] = {
            directory: {},
          };
        }

        current = (
          current[part] as WebContainerDirectoryNode
        ).directory;
      }
    }
  }

  return fileTree;
}