/**
 * Language catalogue for the practice code editor.
 *
 * Each language carries three suggestion groups:
 *  - keywords the language reserves,
 *  - builtins and standard-library entry points learners reach for most,
 *  - snippets (templates with ${placeholders}) that expand into real code.
 *
 * The same data powers both the inline autocomplete list and the visible
 * "quick insert" suggestions, so the two can never drift apart.
 */

export type SuggestionKind = 'keyword' | 'function' | 'class' | 'variable' | 'snippet';

export interface CodeSuggestion {
  label: string;
  kind: SuggestionKind;
  detail: string;
  /** Literal text inserted on accept. */
  apply?: string;
  /** Template with ${placeholders}, expanded on accept. */
  template?: string;
}

export interface LanguageDefinition {
  id: string;
  label: string;
  extension: string;
  keywords: string[];
  builtins: string[];
  snippets: CodeSuggestion[];
}

const snippet = (label: string, detail: string, template: string): CodeSuggestion => ({
  label, kind: 'snippet', detail, template,
});

export const LANGUAGES: LanguageDefinition[] = [
  {
    id: 'python',
    label: 'Python',
    extension: 'py',
    keywords: [
      'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif',
      'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda',
      'match', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
      'True', 'False', 'None',
    ],
    builtins: [
      'abs', 'all', 'any', 'bool', 'dict', 'dir', 'enumerate', 'filter', 'float', 'format', 'getattr',
      'hasattr', 'id', 'input', 'int', 'isinstance', 'len', 'list', 'map', 'max', 'min', 'next',
      'open', 'print', 'range', 'repr', 'reversed', 'round', 'set', 'setattr', 'sorted', 'str', 'sum',
      'super', 'tuple', 'type', 'zip',
      'datetime', 'json', 'math', 'os', 'random', 're', 'sys', 'time',
      'Counter', 'defaultdict', 'deque', 'namedtuple',
      'Exception', 'IndexError', 'KeyError', 'TypeError', 'ValueError',
    ],
    snippets: [
      snippet('def', 'Define a function', 'def ${name}(${params}):\n    ${body}'),
      snippet('class', 'Define a class', 'class ${Name}:\n    def __init__(self${params}):\n        ${body}'),
      snippet('if', 'Conditional block', 'if ${condition}:\n    ${body}\nelse:\n    ${alternative}'),
      snippet('for', 'Loop over a sequence', 'for ${item} in ${iterable}:\n    ${body}'),
      snippet('while', 'Loop while a condition holds', 'while ${condition}:\n    ${body}'),
      snippet('try', 'Handle errors', 'try:\n    ${body}\nexcept ${Error} as ${error}:\n    ${handler}'),
      snippet('with', 'Open a resource safely', 'with open(${path}) as ${file}:\n    ${body}'),
      snippet('import', 'Import a module', 'import ${module}'),
      snippet('list comprehension', 'Build a list from a sequence', '[${expression} for ${item} in ${iterable}]'),
      snippet('main guard', 'Run code only when executed directly', 'if __name__ == "__main__":\n    ${body}'),
    ],
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    extension: 'js',
    keywords: [
      'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
      'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in',
      'instanceof', 'let', 'new', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw', 'try',
      'typeof', 'var', 'void', 'while', 'yield',
    ],
    builtins: [
      'Array', 'Boolean', 'Date', 'Error', 'JSON', 'Map', 'Math', 'Number', 'Object', 'Promise',
      'RegExp', 'Set', 'String', 'Symbol', 'WeakMap', 'WeakSet',
      'alert', 'clearInterval', 'clearTimeout', 'console', 'document', 'fetch', 'globalThis',
      'isNaN', 'localStorage', 'navigator', 'parseFloat', 'parseInt', 'prompt', 'requestAnimationFrame',
      'sessionStorage', 'setInterval', 'setTimeout', 'window',
      'Array.from', 'Array.isArray', 'JSON.parse', 'JSON.stringify', 'Object.entries',
      'Object.keys', 'Object.values', 'Promise.all', 'Promise.reject', 'Promise.resolve',
    ],
    snippets: [
      snippet('function', 'Declare a function', 'function ${name}(${params}) {\n  ${body}\n}'),
      snippet('arrow function', 'Declare an arrow function', 'const ${name} = (${params}) => {\n  ${body}\n};'),
      snippet('async function', 'Declare an async function', 'async function ${name}(${params}) {\n  ${body}\n}'),
      snippet('class', 'Declare a class', 'class ${Name} {\n  constructor(${params}) {\n    ${body}\n  }\n}'),
      snippet('if/else', 'Conditional block', 'if (${condition}) {\n  ${body}\n} else {\n  ${alternative}\n}'),
      snippet('try/catch', 'Handle errors', 'try {\n  ${body}\n} catch (${error}) {\n  ${handler}\n}'),
      snippet('for', 'Loop over an index', 'for (let ${index} = 0; ${index} < ${length}; ${index}++) {\n  ${body}\n}'),
      snippet('for...of', 'Loop over values', 'for (const ${item} of ${items}) {\n  ${body}\n}'),
      snippet('map', 'Transform a list', 'const ${result} = ${items}.map((${item}) => ${expression});'),
      snippet('filter', 'Keep matching values', 'const ${result} = ${items}.filter((${item}) => ${condition});'),
      snippet('reduce', 'Fold a list into one value', 'const ${result} = ${items}.reduce((${accumulator}, ${item}) => ${expression}, ${initial});'),
      snippet('fetch', 'Call an API', 'const response = await fetch(${url});\nconst data = await response.json();'),
    ],
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    extension: 'ts',
    keywords: [
      'abstract', 'any', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const',
      'continue', 'declare', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'finally',
      'for', 'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'keyof', 'let',
      'namespace', 'new', 'of', 'private', 'protected', 'public', 'readonly', 'return', 'static',
      'super', 'switch', 'this', 'throw', 'try', 'type', 'typeof', 'var', 'void', 'while', 'yield',
    ],
    builtins: [
      'Array', 'Boolean', 'Date', 'Error', 'JSON', 'Map', 'Math', 'Number', 'Object', 'Promise',
      'Record', 'Readonly', 'Set', 'String', 'Symbol', 'unknown', 'any',
      'console', 'document', 'fetch', 'localStorage', 'navigator', 'setTimeout', 'window',
      'JSON.parse', 'JSON.stringify', 'Object.keys', 'Object.values',
    ],
    snippets: [
      snippet('interface', 'Declare a shape', 'interface ${Name} {\n  ${property}: ${type};\n}'),
      snippet('type alias', 'Declare a type', 'type ${Name} = ${type};'),
      snippet('function', 'Declare a function', 'function ${name}(${params}: ${types}): ${ReturnType} {\n  ${body}\n}'),
      snippet('class', 'Declare a class', 'class ${Name} implements ${Interface} {\n  constructor(${params}) {\n    ${body}\n  }\n}'),
      snippet('async function', 'Declare an async function', 'async function ${name}(${params}): Promise<${Type}> {\n  ${body}\n}'),
      snippet('try/catch', 'Handle errors', 'try {\n  ${body}\n} catch (${error}) {\n  ${handler}\n}'),
    ],
  },
  {
    id: 'jsx',
    label: 'React JavaScript',
    extension: 'jsx',
    keywords: [
      'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'delete',
      'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in',
      'instanceof', 'let', 'new', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw', 'try',
      'typeof', 'var', 'void', 'while', 'yield',
    ],
    builtins: [
      'Array', 'Boolean', 'Date', 'Error', 'JSON', 'Map', 'Math', 'Number', 'Object', 'Promise',
      'React', 'Set', 'String', 'console', 'document', 'fetch', 'useCallback', 'useEffect', 'useMemo',
      'useRef', 'useState', 'window',
    ],
    snippets: [
      snippet('component', 'Declare a component', 'function ${Name}(${props}) {\n  return (\n    <${element} />\n  );\n}'),
      snippet('useState', 'Hold state in a component', 'const [${state}, set${State}] = useState(${initial});'),
      snippet('useEffect', 'React to changes', 'useEffect(() => {\n  ${body}\n}, [${dependencies}]);'),
      snippet('map list', 'Render a list', '${items}.map((${item}) => (\n  <${element} key={${item}.id} />\n))'),
      snippet('conditional', 'Render conditionally', '{${condition} ? (\n  <${element} />\n) : null}'),
      snippet('event handler', 'Handle a click', 'onClick={() => ${handler}}'),
      snippet('fetch', 'Load data', 'const response = await fetch(${url});\nconst data = await response.json();'),
    ],
  },
  {
    id: 'tsx',
    label: 'React TypeScript',
    extension: 'tsx',
    keywords: [
      'abstract', 'any', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const',
      'continue', 'declare', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'finally',
      'for', 'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'keyof', 'let',
      'namespace', 'new', 'of', 'private', 'protected', 'public', 'readonly', 'return', 'static',
      'super', 'switch', 'this', 'throw', 'try', 'type', 'typeof', 'var', 'void', 'while', 'yield',
    ],
    builtins: [
      'Array', 'Boolean', 'Date', 'Error', 'JSON', 'Map', 'Math', 'Number', 'Object', 'Promise',
      'React', 'Record', 'Set', 'String', 'console', 'document', 'fetch', 'useCallback', 'useEffect',
      'useMemo', 'useRef', 'useState', 'window',
    ],
    snippets: [
      snippet('component', 'Declare a typed component', 'function ${Name}({ ${props} }: ${Props}) {\n  return (\n    <${element} />\n  );\n}'),
      snippet('interface', 'Declare props', 'interface ${Props} {\n  ${property}: ${type};\n}'),
      snippet('useState', 'Hold state in a component', 'const [${state}, set${State}] = useState<${Type}>(${initial});'),
      snippet('useEffect', 'React to changes', 'useEffect(() => {\n  ${body}\n}, [${dependencies}]);'),
      snippet('map list', 'Render a list', '${items}.map((${item}) => (\n  <${element} key={${item}.id} />\n))'),
    ],
  },
  {
    id: 'java',
    label: 'Java',
    extension: 'java',
    keywords: [
      'abstract', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue',
      'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'if',
      'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package',
      'private', 'protected', 'public', 'record', 'return', 'sealed', 'short', 'static', 'strictfp',
      'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'var', 'void',
      'volatile', 'while',
    ],
    builtins: [
      'ArrayList', 'Arrays', 'Boolean', 'Collections', 'Double', 'Exception', 'HashMap', 'HashSet',
      'Integer', 'List', 'Long', 'Map', 'Math', 'Objects', 'Optional', 'Scanner', 'Set', 'String',
      'StringBuilder', 'System',
      'IllegalArgumentException', 'NullPointerException', 'RuntimeException',
    ],
    snippets: [
      snippet('class', 'Declare a class', 'public class ${Name} {\n    ${body}\n}'),
      snippet('main', 'Program entry point', 'public static void main(String[] args) {\n    ${body}\n}'),
      snippet('constructor', 'Declare a constructor', 'public ${Name}(${params}) {\n    ${body}\n}'),
      snippet('for', 'Loop with a counter', 'for (int ${index} = 0; ${index} < ${length}; ${index}++) {\n    ${body}\n}'),
      snippet('for each', 'Loop over a collection', 'for (${Type} ${item} : ${items}) {\n    ${body}\n}'),
      snippet('if/else', 'Conditional block', 'if (${condition}) {\n    ${body}\n} else {\n    ${alternative}\n}'),
      snippet('try/catch', 'Handle errors', 'try {\n    ${body}\n} catch (${Error} ${error}) {\n    ${handler}\n}'),
      snippet('print', 'Print to the console', 'System.out.println(${value});'),
    ],
  },
  {
    id: 'cpp',
    label: 'C++',
    extension: 'cpp',
    keywords: [
      'alignas', 'auto', 'break', 'case', 'catch', 'class', 'const', 'constexpr', 'continue', 'default',
      'delete', 'do', 'else', 'enum', 'explicit', 'export', 'extern', 'for', 'friend', 'goto', 'if',
      'inline', 'namespace', 'new', 'noexcept', 'operator', 'private', 'protected', 'public', 'return',
      'sizeof', 'static', 'struct', 'switch', 'template', 'this', 'throw', 'try', 'typedef', 'typename',
      'union', 'using', 'virtual', 'while', 'nullptr', 'true', 'false',
    ],
    builtins: [
      'begin', 'cbegin', 'cout', 'cin', 'cerr', 'endl', 'end', 'find', 'make_shared', 'make_unique',
      'map', 'pair', 'push_back', 'pop_back', 'size', 'sort', 'string', 'substr', 'stoi', 'to_string',
      'unique_ptr', 'shared_ptr', 'vector', 'set', 'unordered_map', 'unordered_set', 'move', 'swap',
    ],
    snippets: [
      snippet('main', 'Program entry point', '#include <iostream>\n\nint main() {\n    ${body}\n    return 0;\n}'),
      snippet('class', 'Declare a class', 'class ${Name} {\npublic:\n    ${body}\n};'),
      snippet('struct', 'Declare a struct', 'struct ${Name} {\n    ${body}\n};'),
      snippet('range for', 'Loop over a container', 'for (auto &${item} : ${items}) {\n    ${body}\n}'),
      snippet('function', 'Declare a function', '${Type} ${name}(${params}) {\n    ${body}\n}'),
      snippet('lambda', 'Write a lambda', 'auto ${name} = [${capture}](${params}) {\n    ${body}\n};'),
    ],
  },
  {
    id: 'go',
    label: 'Go',
    extension: 'go',
    keywords: [
      'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough', 'for',
      'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range', 'return', 'select',
      'struct', 'switch', 'type', 'var', 'nil', 'true', 'false',
    ],
    builtins: [
      'append', 'bytes', 'cap', 'context', 'copy', 'delete', 'errors', 'fmt', 'http', 'io', 'json',
      'len', 'make', 'new', 'os', 'panic', 'print', 'println', 'recover', 'sort', 'strconv', 'strings',
      'sync', 'time',
      'fmt.Errorf', 'fmt.Println', 'fmt.Printf', 'fmt.Sprintf',
    ],
    snippets: [
      snippet('main', 'Program entry point', 'package main\n\nimport "fmt"\n\nfunc main() {\n    ${body}\n}'),
      snippet('func', 'Declare a function', 'func ${name}(${params}) ${returnType} {\n    ${body}\n}'),
      snippet('error handling', 'Return an error', 'if err != nil {\n    return ${err}\n}'),
      snippet('struct', 'Declare a struct', 'type ${Name} struct {\n    ${field} ${Type}\n}'),
      snippet('interface', 'Declare an interface', 'type ${Name} interface {\n    ${Method}(${params}) ${returnType}\n}'),
      snippet('goroutine', 'Run work in the background', 'go ${function}(${args})'),
      snippet('defer cleanup', 'Clean up when the function returns', 'defer ${cleanup}()'),
      snippet('range loop', 'Loop over a collection', 'for ${index}, ${item} := range ${items} {\n    ${body}\n}'),
    ],
  },
  {
    id: 'rust',
    label: 'Rust',
    extension: 'rs',
    keywords: [
      'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern',
      'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref',
      'return', 'self', 'Self', 'static', 'struct', 'super', 'trait', 'type', 'unsafe', 'use', 'where',
      'while', 'true', 'false', 'Ok', 'Err', 'Some', 'None',
    ],
    builtins: [
      'bool', 'char', 'f32', 'f64', 'i32', 'i64', 'i8', 'isize', 'String', 'u32', 'u64', 'u8', 'usize',
      'Box', 'HashMap', 'HashSet', 'Option', 'Result', 'Vec',
      'assert', 'assert_eq', 'clone', 'format', 'into', 'iter', 'len', 'panic', 'print', 'println',
      'push', 'get', 'unwrap', 'write', 'writeln',
    ],
    snippets: [
      snippet('fn', 'Declare a function', 'fn ${name}(${params}) -> ${Type} {\n    ${body}\n}'),
      snippet('main', 'Program entry point', 'fn main() {\n    ${body}\n}'),
      snippet('struct', 'Declare a struct', 'struct ${Name} {\n    ${field}: ${Type},\n}'),
      snippet('enum', 'Declare an enum', 'enum ${Name} {\n    ${Variant},\n}'),
      snippet('impl', 'Implement a trait', 'impl ${Trait} for ${Name} {\n    ${body}\n}'),
      snippet('match', 'Match on a value', 'match ${value} {\n    ${pattern} => ${result},\n}'),
      snippet('if let', 'Match one pattern', 'if let ${Pattern} = ${value} {\n    ${body}\n}'),
      snippet('result handling', 'Propagate an error', 'let ${value} = ${expression}?;'),
      snippet('iterator chain', 'Chain iterator adapters', '${items}\n    .iter()\n    .map(|${item}| ${expression})\n    .collect::<Vec<_>>()'),
    ],
  },
  {
    id: 'sql',
    label: 'SQL',
    extension: 'sql',
    keywords: [
      'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT INTO',
      'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
      'OUTER JOIN', 'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS NULL',
      'IS NOT NULL', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE',
      'END', 'WITH', 'UNION', 'ALL', 'EXISTS', 'CREATE TABLE', 'PRIMARY KEY', 'FOREIGN KEY',
      'REFERENCES', 'DEFAULT', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX',
    ],
    builtins: [
      'coalesce', 'concat', 'curdate', 'date', 'length', 'lower', 'now', 'round', 'substring',
      'trim', 'upper',
    ],
    snippets: [
      snippet('select', 'Read rows', 'SELECT ${columns}\nFROM ${table}\nWHERE ${condition};'),
      snippet('select count', 'Count rows', 'SELECT COUNT(*)\nFROM ${table};'),
      snippet('insert', 'Add a row', 'INSERT INTO ${table} (${columns})\nVALUES (${values});'),
      snippet('update', 'Change rows', 'UPDATE ${table}\nSET ${column} = ${value}\nWHERE ${condition};'),
      snippet('delete', 'Remove rows', 'DELETE FROM ${table}\nWHERE ${condition};'),
      snippet('join', 'Join two tables', 'SELECT ${columns}\nFROM ${left}\nJOIN ${right} ON ${left}.${key} = ${right}.${key};'),
      snippet('group by', 'Summarise rows', 'SELECT ${column}, COUNT(*) AS ${alias}\nFROM ${table}\nGROUP BY ${column};'),
      snippet('create table', 'Create a table', 'CREATE TABLE ${table} (\n    ${column} ${type} PRIMARY KEY\n);'),
    ],
  },
  {
    id: 'html',
    label: 'HTML',
    extension: 'html',
    keywords: [
      'a', 'article', 'aside', 'body', 'br', 'button', 'div', 'footer', 'form', 'h1', 'h2', 'h3',
      'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html', 'img', 'input', 'label', 'li', 'link',
      'main', 'meta', 'nav', 'ol', 'option', 'p', 'section', 'select', 'span', 'strong', 'script',
      'style', 'table', 'tbody', 'td', 'textarea', 'th', 'thead', 'tr', 'ul',
    ],
    builtins: [
      'alt', 'aria-label', 'class', 'disabled', 'href', 'id', 'name', 'placeholder', 'rel', 'role',
      'required', 'src', 'style', 'target', 'title', 'type', 'value', 'width', 'height',
    ],
    snippets: [
      snippet('document', 'A complete HTML document', '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>${title}</title>\n</head>\n<body>\n  ${body}\n</body>\n</html>'),
      snippet('link', 'A hyperlink', '<a href="${url}">${text}</a>'),
      snippet('image', 'An image', '<img src="${url}" alt="${description}">'),
      snippet('list', 'An unordered list', '<ul>\n  <li>${item}</li>\n</ul>'),
      snippet('form field', 'A labelled input', '<label for="${id}">${label}</label>\n<input id="${id}" name="${name}">'),
      snippet('table', 'A simple table', '<table>\n  <thead><tr><th>${heading}</th></tr></thead>\n  <tbody>\n    <tr><td>${cell}</td></tr>\n  </tbody>\n</table>'),
    ],
  },
  {
    id: 'css',
    label: 'CSS',
    extension: 'css',
    keywords: [
      'align-content', 'align-items', 'background', 'background-color', 'border', 'border-radius',
      'bottom', 'box-shadow', 'color', 'cursor', 'display', 'flex', 'flex-direction', 'flex-wrap',
      'font-family', 'font-size', 'font-weight', 'gap', 'grid', 'grid-template-columns',
      'grid-template-rows', 'height', 'justify-content', 'left', 'line-height', 'margin', 'max-width',
      'min-height', 'object-fit', 'opacity', 'overflow', 'padding', 'position', 'right', 'text-align',
      'text-decoration', 'top', 'transform', 'transition', 'width', 'z-index',
    ],
    builtins: [
      'absolute', 'auto', 'block', 'bold', 'center', 'column', 'cover', 'fixed', 'flex', 'grid',
      'hidden', 'inline', 'inline-block', 'none', 'normal', 'pointer', 'relative', 'row', 'space-around',
      'space-between', 'sticky', 'wrap',
    ],
    snippets: [
      snippet('flex centre', 'Centre with flexbox', '.${name} {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}'),
      snippet('grid', 'A grid layout', '.${name} {\n  display: grid;\n  grid-template-columns: repeat(${columns}, 1fr);\n  gap: ${gap};\n}'),
      snippet('card', 'A card surface', '.${name} {\n  padding: ${padding};\n  border-radius: ${radius};\n  background: ${color};\n  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);\n}'),
      snippet('media query', 'Respond to a screen size', '@media (max-width: ${width}px) {\n  .${name} {\n    ${body}\n  }\n}'),
      snippet('reset', 'Reset default spacing', '*, *::before, *::after {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}'),
    ],
  },
  {
    id: 'json',
    label: 'JSON',
    extension: 'json',
    keywords: ['true', 'false', 'null'],
    builtins: [],
    snippets: [
      snippet('object', 'An empty object', '{\n  "${key}": ${value}\n}'),
      snippet('array', 'An empty array', '[\n  ${value}\n]'),
      snippet('string', 'A quoted value', '"${value}"'),
      snippet('number', 'A numeric value', '${value}'),
    ],
  },
  {
    id: 'markdown',
    label: 'Markdown',
    extension: 'md',
    keywords: [
      '#', '##', '###', '####', '#####', '######', '-', '*', '1.', '>', '```', '---', '|',
      '[', ']', '(', ')', '**', '*', '`', '!',
    ],
    builtins: ['**bold**', '*italic*', '`code`', '[text](url)', '![alt](image.png)', '~~strike~~'],
    snippets: [
      snippet('heading', 'A section heading', '## ${title}'),
      snippet('bold', 'Bold text', '**${text}**'),
      snippet('italic', 'Italic text', '*${text}*'),
      snippet('link', 'A hyperlink', '[${text}](${url})'),
      snippet('image', 'An image', '![${alt}](${url})'),
      snippet('code block', 'A fenced code block', '```${language}\n${code}\n```'),
      snippet('list', 'A bulleted list', '- ${item}'),
      snippet('numbered list', 'A numbered list', '1. ${item}'),
      snippet('quote', 'A block quote', '> ${text}'),
      snippet('table', 'A table', '| ${heading} |\n| --- |\n| ${cell} |'),
    ],
  },
];

export const languageById = (id: string): LanguageDefinition =>
  LANGUAGES.find((language) => language.id === id) ?? LANGUAGES[0];

/** Every suggestion for a language: keywords, builtins, then snippets. */
export function suggestionsFor(languageId: string): CodeSuggestion[] {
  const language = languageById(languageId);
  return [
    ...language.keywords.map((label) => ({
      label,
      kind: 'keyword' as const,
      detail: `${language.label} keyword`,
    })),
    ...language.builtins.map((label) => ({
      label,
      kind: 'function' as const,
      detail: `${language.label} builtin`,
    })),
    ...language.snippets,
  ];
}

/** The snippets a learner can insert with one click, in display order. */
export function quickInsertsFor(languageId: string): CodeSuggestion[] {
  return languageById(languageId).snippets;
}
