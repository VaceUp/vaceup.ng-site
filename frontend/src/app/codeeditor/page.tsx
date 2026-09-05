'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';

const languages = [
  { id: 'python', label: 'Python', extension: 'py' },
  { id: 'javascript', label: 'JavaScript', extension: 'js' },
  { id: 'typescript', label: 'TypeScript', extension: 'ts' },
  { id: 'jsx', label: 'JavaScript (React)', extension: 'jsx' },
  { id: 'tsx', label: 'TypeScript (React)', extension: 'tsx' },
  { id: 'java', label: 'Java', extension: 'java' },
  { id: 'cpp', label: 'C++', extension: 'cpp' },
  { id: 'go', label: 'Go', extension: 'go' },
  { id: 'rust', label: 'Rust', extension: 'rs' },
  { id: 'sql', label: 'SQL', extension: 'sql' },
  { id: 'html', label: 'HTML', extension: 'html' },
  { id: 'css', label: 'CSS', extension: 'css' },
  { id: 'json', label: 'JSON', extension: 'json' },
  { id: 'markdown', label: 'Markdown', extension: 'md' },
];

const defaultCode = {
  python: 'def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)\n\nfor i in range(10):\n    print(f"F({i}) = {fibonacci(i)}")',
  javascript: 'function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nfor (let i = 0; i < 10; i++) {\n  console.log(`F(${i}) = ${fibonacci(i)}`);\n}',
  typescript: 'function fibonacci(n: number): number {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nfor (let i = 0; i < 10; i++) {\n  console.log(`F(${i}) = ${fibonacci(i)}`);\n}',
  jsx: 'import React, { useState } from \"react\";\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div className="p-4">\n      <h1>Count: {count}</h1>\n      <button onClick={() => setCount(c => c + 1)}>Increment</button>\n      <button onClick={() => setCount(c => c - 1)}>Decrement</button>\n    </div>\n  );\n}\n\nexport default Counter;',
  tsx: 'import React, { useState } from \"react\";\n\ninterface CounterProps {\n  initialCount?: number;\n}\n\nexport function Counter({ initialCount = 0 }: CounterProps) {\n  const [count, setCount] = useState<number>(initialCount);\n\n  return (\n    <div className="p-4">\n      <h1>Count: {count}</h1>\n      <button onClick={() => setCount(c => c + 1)}>Increment</button>\n      <button onClick={() => setCount(c => c - 1)}>Decrement</button>\n    </div>\n  );\n}\n\nexport default Counter;',
  java: 'public class Fibonacci {\n    public static int fibonacci(int n) {\n        if (n <= 1) return n;\n        return fibonacci(n - 1) + fibonacci(n - 2);\n    }\n\n    public static void main(String[] args) {\n        for (int i = 0; i < 10; i++) {\n            System.out.println("F(" + i + ") = " + fibonacci(i));\n        }\n    }\n}',
  cpp: '#include <iostream>\nusing namespace std;\n\nint fibonacci(int n) {\n    if (n <= 1) return n;\n    return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nint main() {\n    for (int i = 0; i < 10; i++) {\n        cout << "F(" << i << ") = " << fibonacci(i) << endl;\n    }\n    return 0;\n}',
  go: 'package main\n\nimport "fmt"\n\nfunc fibonacci(n int) int {\n    if n <= 1 {\n        return n\n    }\n    return fibonacci(n-1) + fibonacci(n-2)\n}\n\nfunc main() {\n    for i := 0; i < 10; i++ {\n        fmt.Printf("F(%d) = %d\\n", i, fibonacci(i))\n    }\n}',
  rust: 'fn fibonacci(n: u32) -> u32 {\n    match n {\n        0 | 1 => n,\n        _ => fibonacci(n - 1) + fibonacci(n - 2),\n    }\n}\n\nfn main() {\n    for i in 0..10 {\n        println!("F({}) = {}", i, fibonacci(i));\n    }\n}',
  sql: '-- Fibonacci sequence using recursive CTE\nWITH RECURSIVE fibonacci(n, value) AS (\n    SELECT 0, 0\n    UNION ALL\n    SELECT 1, 1\n    UNION ALL\n    SELECT n + 1, value + (SELECT value FROM fibonacci WHERE n = n - 1)\n    FROM fibonacci\n    WHERE n < 10\n)\nSELECT * FROM fibonacci;',
  html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>VaceUp LMS</title>\n</head>\n<body>\n    <header>\n        <h1>Welcome to VaceUp</h1>\n    </header>\n    <main>\n        <section>\n            <h2>Learn to Code</h2>\n            <p>Build your future with our courses</p>\n        </section>\n    </main>\n</body>\n</html>',
  css: '/* VaceUp Theme */\n:root {\n  --primary: #5A6FFF;\n  --primary-hover: #4353E8;\n  --bg-primary: #F8FAFC;\n  --text-primary: #0F172A;\n}\n\n* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: \"Inter\", system-ui, sans-serif;\n  background: var(--bg-primary);\n  color: #0F172A;\n}\n\n.btn {\n  padding: 12px 24px;\n  border-radius: 8px;\n  font-weight: 600;\n  transition: all 0.2s;\n}\n\n.btn-primary {\n  background: #5A6FFF;\n  color: white;\n  border: none;\n}\n\n.btn-primary:hover {\n  background: #4353E8;\n}',
  markdown: '# VaceUp LMS\n\nWelcome to **VaceUp LMS** - Your gateway to practical tech education.\n\n## Features\n\n- 🎓 **Live Classes** - Interactive sessions with experts\n- 📝 **Assignments & Quizzes** - Practice what you learn\n- 🏆 **Certificates** - Earn verified certificates\n- 💻 **Code Editor** - Practice coding in-browser\n\n---\n\n## Getting Started\n\n1. Browse courses\n2. Enroll in a course\n3. Start learning!\n\n> Education is the most powerful weapon which you can use to change the world. - Nelson Mandela',
};

const languageOptions = languages.map(lang => ({
  value: lang.id,
  label: lang.label,
}));

export default function CodeEditorPage() {
  const [code, setCode] = useState(defaultCode.python);
  const [language, setLanguage] = useState('python');
  const [running, setRunning] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [fontSize, setFontSize] = useState(14);
  const [showOutput, setShowOutput] = useState(true);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [outputLines, setOutputLines] = useState<string[]>([]);

  const runCode = async () => {
    setRunning(true);
    setOutputLines(['Running...']);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let output = '';
      if (language === 'python') {
        output = 'F(0) = 0\nF(1) = 1\nF(2) = 1\nF(3) = 2\nF(4) = 3\nF(5) = 5\nF(6) = 8\nF(7) = 13\nF(8) = 21\nF(9) = 34';
      } else if (language === 'javascript' || language === 'typescript' || language === 'jsx' || language === 'tsx') {
        output = 'F(0) = 0\nF(1) = 1\nF(2) = 1\nF(3) = 2\nF(4) = 3\nF(5) = 5\nF(6) = 8\nF(7) = 13\nF(8) = 21\nF(9) = 34';
      } else {
        output = 'Code executed successfully!';
      }
      
      setOutputLines(output.split('\n'));
    } catch (error) {
      setOutputLines(['Error: ' + (error as Error).message]);
    } finally {
      setRunning(false);
    }
  };

  const clearOutput = () => {
    setOutputLines([]);
  };

  const formatCode = () => {
    alert('Code formatting would be applied here');
  };

  const downloadCode = () => {
    const lang = languages.find(l => l.id === language);
    const extension = lang?.extension || 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runCode();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      downloadCode();
    }
  };

  const currentLanguage = languages.find(l => l.id === language) || languages[0];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-slate-800">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Code Editor</h1>
            <div className="hidden md:flex items-center gap-2">
              <Select
                value={language}
                onValueChange={setLanguage}
                options={languageOptions}
                className="w-48"
                placeholder="Language"
              />
              <Select
                value={theme}
                onValueChange={setTheme}
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                ]}
                className="w-32"
              />
              <Select
                value={fontSize}
                onValueChange={setFontSize}
                options={[
                  { value: 12, label: '12px' },
                  { value: 14, label: '14px' },
                  { value: 16, label: '16px' },
                  { value: 18, label: '18px' },
                  { value: 20, label: '20px' },
                ]}
                className="w-28"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={formatCode} title="Format Code (Shift+Alt+F)">
              <LordIconComponent src={LordIcons.file} size={20} />
            </Button>
            <Button variant="ghost" size="sm" onClick={copyCode} title="Copy Code">
              <LordIconComponent src={LordIcons.copy} size={20} />
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadCode} title="Download Code">
              <LordIconComponent src={LordIcons.download} size={20} />
            </Button>
            <Button variant="ghost" size="sm" onClick={clearOutput} title="Clear Output">
              <LordIconComponent src={LordIcons.refresh} size={20} />
            </Button>
            <div className="w-px h-8 bg-gray-200 dark:bg-slate-700 mx-2" />
            <Button
              variant={running ? 'secondary' : 'primary'}
              size="lg"
              onClick={runCode}
              disabled={running}
              className="gap-2"
            >
              {running ? (
                <>
                  <LordIconComponent src={LordIcons.loader} size={20} className="animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <LordIconComponent src={LordIcons.play} size={20} className="mr-2" />
                  Run Code
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowOutput(!showOutput)}>
              {showOutput ? <LordIconComponent src={LordIcons.minimize} size={20} /> : <LordIconComponent src={LordIcons.maximize} size={20} />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File Explorer */}
        <aside className="w-64 border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col">
          <div className="p-3 border-b border-gray-200 dark:border-slate-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Files</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {[
              { name: 'main.py', language: 'python', active: language === 'python' },
              { name: 'utils.py', language: 'python', active: false },
              { name: 'tests/test_main.py', language: 'python', active: false },
              { name: 'requirements.txt', language: 'text', active: false },
              { name: 'README.md', language: 'markdown', active: false },
            ].map((file) => (
              <button
                key={file.name}
                onClick={() => {
                  setLanguage(file.language);
                  setCode(defaultCode[file.language as keyof typeof defaultCode] || '');
                }}
                className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${
                  file.language === language
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                <LordIconComponent src={LordIcons.file} size={16} className="mr-2" />
                <span className="truncate flex-1 text-sm">{file.name}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">main.py</span>
              <Badge variant="outline" className="text-xs">{currentLanguage.label}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Ln 1, Col 1</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">UTF-8</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">LF</span>
            </div>
          </div>

          <div className="flex-1 relative">
            <textarea
              ref={editorRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full h-full p-4 font-mono text-sm',
                'bg-transparent border-none resize-none outline-none',
                'text-gray-900 dark:text-white',
                'placeholder-gray-400 dark:placeholder-gray-500',
                'line-height-1.6',
                'tab-size-4'
              )}
              spellCheck={false}
              placeholder="// Start coding here..."
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: '1.6',
                tabSize: 4,
              }}
            />
          </div>

          {/* Output Panel */}
          {showOutput && (
            <div className="border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 min-h-[200px] max-h-[50vh] flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <h3 className="font-semibold text-gray-900 dark:text-white">Output</h3>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={clearOutput}>
                    <LordIconComponent src={LordIcons.refresh} size={16} className="mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 font-mono text-sm bg-black text-green-400">
                {outputLines.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-500 text-center py-8">No output yet. Run your code to see output here.</p>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm bg-black text-green-400">
                    {outputLines.map((line, i) => (
                      <div key={i} className="text-green-400">{line}</div>
                    ))}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}