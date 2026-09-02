'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import {
  Play,
  Stop,
  RotateCcw,
  Download,
  Copy,
  Maximize2,
  Minimize2,
  Terminal,
  Github,
  FileText,
  Settings,
  ChevronDown,
  X,
  RefreshCw,
} from 'lucide-react';

const languages = [
  { id: 'python', label: 'Python', mode: 'python', extension: 'py' },
  { id: 'javascript', label: 'JavaScript', mode: 'javascript', extension: 'js' },
  { id: 'typescript', label: 'TypeScript', mode: 'typescript', extension: 'ts' },
  { id: 'javascript', label: 'JavaScript (React)', mode: 'javascript', extension: 'jsx' },
  { id: 'typescript', label: 'TypeScript (React)', mode: 'typescript', extension: 'tsx' },
  { id: 'java', label: 'Java', mode: 'java', extension: 'java' },
  { id: 'cpp', label: 'C++', mode: 'cpp', extension: 'cpp' },
  { id: 'go', label: 'Go', mode: 'go', extension: 'go' },
  { id: 'rust', label: 'Rust', mode: 'rust', extension: 'rs' },
  { id: 'sql', label: 'SQL', mode: 'sql', extension: 'sql' },
  { id: 'html', label: 'HTML', mode: 'html', extension: 'html' },
  { id: 'css', label: 'CSS', mode: 'css', extension: 'css' },
  { id: 'json', label: 'JSON', mode: 'json', extension: 'json' },
  { id: 'markdown', label: 'Markdown', mode: 'markdown', extension: 'md' },
];

const defaultCode = {
  python: `def fibonacci(n):
    """Return the nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)


if __name__ == "__main__":
    for i in range(10):
        print(f"F({i}) = {fibonacci(i)}")`,
  javascript: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 10; i++) {
  console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}`,
  typescript: `function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 10; i++) {
  console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}`,
  javascript: `import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="p-4">
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <button onClick={() => setCount(c => c - 1)}>Decrement</button>
    </div>
  );
}

export default Counter;`,
  typescript: `import React, { useState } from 'react';

interface CounterProps {
  initialCount?: number;
}

export function Counter({ initialCount = 0 }: CounterProps) {
  const [count, setCount] = useState<number>(initialCount);

  return (
    <div className="p-4">
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <button onClick={() => setCount(c => c - 1)}>Decrement</button>
    </div>
  );
}`,
  java: `public class Fibonacci {
    public static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }

    public static void main(String[] args) {
        for (int i = 0; i < 10; i++) {
            System.out.println("F(" + i + ") = " + fibonacci(i));
        }
    }
}`,
  cpp: `#include <iostream>
using namespace std;

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    for (int i = 0; i < 10; i++) {
        cout << "F(" << i << ") = " << fibonacci(i) << endl;
    }
    return 0;
}`,
  go: `package main

import "fmt"

func fibonacci(n int) int {
    if n <= 1 {
        return n
    }
    return fibonacci(n-1) + fibonacci(n-2)
}

func main() {
    for i := 0; i < 10; i++ {
        fmt.Printf("F(%d) = %d\\n", i, fibonacci(i))
    }
}`,
  rust: `fn fibonacci(n: u32) -> u32 {
    match n {
        0 | 1 => n,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn main() {
    for i in 0..10 {
        println!("F({}) = {}", i, fibonacci(i));
    }
}`,
  sql: `-- Fibonacci sequence using recursive CTE
WITH RECURSIVE fibonacci(n, value) AS (
    SELECT 0, 0
    UNION ALL
    SELECT 1, 1
    UNION ALL
    SELECT n + 1, value + (SELECT value FROM fibonacci WHERE n = n - 1)
    FROM fibonacci
    WHERE n < 10
)
SELECT * FROM fibonacci;`,
  html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VaceUp LMS</title>
</head>
<body>
    <header>
        <h1>Welcome to VaceUp</h1>
    </header>
    <main>
        <section>
            <h2>Learn to Code</h2>
            <p>Build your future with our courses</p>
        </section>
    </main>
</body>
</html>`,
  css: `/* VaceUp Theme */
:root {
  --primary: #5A6FFF;
  --primary-hover: #4353E8;
  --bg-primary: #F8FAFC;
  --text-primary: #0F172A;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg-primary);
  color: #0F172A;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-primary {
  background: #5A6FFF;
  color: white;
  border: none;
}

.btn-primary:hover {
  background: #4353E8;
}`,
  markdown: `# VaceUp LMS

Welcome to **VaceUp LMS** - Your gateway to practical tech education.

## Features

- 🎓 **Live Classes** - Interactive sessions with experts
- 📝 **Assignments & Quizzes** - Practice what you learn
- 🏆 **Certificates** - Earn verified certificates
- 💻 **Code Editor** - Practice coding in-browser

---

## Getting Started

1. Browse courses
2. Enroll in a course
3. Start learning!

> Education is the most powerful weapon which you can use to change the world. - Nelson Mandela`,

  rust: `fn fibonacci(n: u32) -> u32 {
    match n {
        0 | 1 => n,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn main() {
    for i in 0..10 {
        println!("F({}) = {}", i, fibonacci(i));
    }
}`,
  csharp: `using System;

class Program {
    static int Fibonacci(int n) {
        if (n <= 1) return n;
        return Fibonacci(n - 1) + Fibonacci(n - 2);
    }

    static void Main() {
        for (int i = 0; i < 10; i++) {
            Console.WriteLine($"F({i}) = {Fibonacci(i)}");
        }
    }
}`,
  bash: `#!/bin/bash

# Fibonacci sequence generator
fibonacci() {
    local n=$1
    if [ $n -le 1 ]; then
        echo $n
    else
        echo $(( $(fibonacci $((n-1))) + $(fibonacci $((n-1))) ))
    }
}

for i in {0..9}; do
    echo "F($i) = $(fibonacci $i)"
done`,
};

export default function CodeEditorPage() {
  const [code, setCode] = useState(defaultCode.python);
  const [language, setLanguage] = useState('python');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [fontSize, setFontSize] = useState(14);
  const [showOutput, setShowOutput] = useState(true);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const [outputLines, setOutputLines] = useState<string[]>([]);

  const languageOptions = languages.map(lang => ({
    value: lang.id,
    label: lang.label,
  }));

  const runCode = async () => {
    setRunning(true);
    setOutputLines(['Running...']);

    try {
      // Simulate code execution
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock output based on language
      let output = '';
      if (language === 'python') {
        output = `F(0) = 0\nF(1) = 1\nF(2) = 1\nF(3) = 2\nF(4) = 3\nF(5) = 5\nF(6) = 8\nF(7) = 13\nF(8) = 21\nF(9) = 34`;
      } else if (language === 'javascript' || language === 'typescript') {
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
    // In a real app, this would use Prettier
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
              <FileText className="w-4 h-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={copyCode} title="Copy Code">
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadCode} title="Download Code">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={clearOutput} title="Clear Output">
              <RefreshCw className="w-4 h-4" />
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
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Code
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowOutput(!showOutput)}>
              {showOutput ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
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
              ].map((file, i) => (
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
                  <FileText className="w-4 h-4 mr-2" />
                  <span className="truncate flex-1 text-sm">{file.name}</span>
                </div>
              ))}
            </div>
          </div>

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
                onScroll={(e) => {
                  // Sync scroll with line numbers if needed
                }}
              />
              {/* Line numbers would go here in a real implementation */}
            </div>

            {/* Output Panel */}
            {showOutput && (
              <div className="border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950 min-h-[200px] max-h-[50vh] flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Output</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={clearOutput}>
                      <RefreshCw className="w-4 h-4" />
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 font-mono text-sm bg-black text-green-400">
                  {outputLines.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-500 text-center py-8">No output yet. Run your code to see output here.</                      </p>
                    ) : (
                      <pre className="whitespace-pre-wrap font-mono text-sm">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      <CodeEditorContent />
    </div>
  );
}

export default CodeEditorPage;