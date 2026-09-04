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

  return (
    <div>
      <h1>Prompt-to-App</h1>

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