import React, { useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import { parseXmlToFileTree } from ./lib/Webcontainer.ts';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [webcontainer, setWebcontainer] = useState<WebContainer | null>(null);

  // Initialize WebContainer instance
  React.useEffect(() => {
    async function initWebContainer() {
      const instance = await WebContainer.boot();
      setWebcontainer(instance);
    }
    initWebContainer();
  }, []);

  const handleGenerate = async () => {
    if (!prompt || !webcontainer) return;
    setLoading(true);

    try {
      // 1. Call your Express endpoint
      const res = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      // 2. Parse XML into virtual file tree
      const fileTree = parseXmlToFileTree(data.result);

      // 3. Mount files into WebContainer memory
      await webcontainer.mount(fileTree);

      // 4. Run `npm install` inside the browser
      const installProcess = await webcontainer.spawn('npm', ['install']);
      await installProcess.exit;

      // 5. Start dev server
      await webcontainer.spawn('npm', ['run', 'dev']);

    } catch (err) {
      console.error('Error starting WebContainer project:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">PromptToApp (Gemini-Powered)</h1>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your app..."
          className="p-2 border rounded w-full"
        />
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Building...' : 'Generate'}
        </button>
      </div>
    </div>
  );
}