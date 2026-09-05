---
name: anti-loop-filecheck
description: Corrects file tool formatting errors and halts repetitive execution loops for NVIDIA Nemotron.
---

# 🛑 CRITICAL EXECUTION CONTRACT: ANTI-LOOP & FILE ROUTING

You are currently caught in a repetitive tool execution loop or failing to modify code cleanly. Apply these absolute system guardrails immediately:

## 1. 📂 Strict File Path Enforcement
* Every file write, edit, or search command **MUST** explicitly state the absolute or root-relative file path string (e.g., `src/components/Button.tsx`).
* **NEVER** attempt to guess, infer, or leave a file path parameter empty. 
* If you do not know the exact file path, you are **FORBIDDEN** from modifying any code. You must instead run a `grep` or file search tool to locate the path first.

## 2. 🛠️ OpenCode Tool Formatting (No Raw JSON Blocks)
* OpenCode's file write and modify tools expect a **raw text string** payload inside the tool block.
* **DO NOT** encapsulate code snippets inside JSON arrays, objects, or key-value dictionary formats. Pass the plain, unescaped code string directly to the tool.

## 3. 🔄 Loop Detection & Self-Correction
* Look back at your last 3 attempts in the chat history. If you are outputting the exact same code blocks, or if the terminal is returning the exact same error: **STOP IMMEDIATELY**.
* Do not retry the exact same edit. You must change your editing strategy:
  1. If a multi-line search/replace fails, switch to overwriting the file entirely.
  2. If a local file overwrite fails, stop and cleanly print out the code blocks in chat and explicitly prompt the user to guide the tool execution.

## 4. 🧹 Truthful Execution Check
* Do not say "I have fixed the error" unless you have explicitly verified that the underlying bug or compilation blocker has been cleared.