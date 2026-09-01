import { useEffect } from "react";
import { getWebContainer } from "../lib/webcontainer";

export default function WebContainerDemo() {
  useEffect(() => {
    const startWebContainer = async () => {
      const container = await getWebContainer();

      console.log("WebContainer ready!");
      console.log(container);
    };

    startWebContainer();
  }, []);

  return (
    <div>
      <h1>Prompt-to-App</h1>
      <p>WebContainer Demo</p>
    </div>
  );
}