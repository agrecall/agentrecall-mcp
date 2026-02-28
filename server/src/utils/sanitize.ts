/**
 * AgentRecall MCP Server - Sanitization Module
 * 
 * 三层脱敏防护：
 * 1. 正则层：API Key (sk-xxx)、IP 地址、路径中的用户名、邮箱、私钥
 * 2. 结构层：保留 JSON key，替换 value 为类型标签（如 {STRING_LEN_32}）
 * 3. 熵检层：香农熵 > 4.5 的字符串视为密钥，强制替换
 * 
 * 原则：原始数据不出域，上传的是"错误模式"而非"错误实例"。
 */

// ============================================
// 正则表达式模式
// ============================================

// API Key 模式（OpenAI, Anthropic 等）
const API_KEY_PATTERNS = [
  /sk-[a-zA-Z0-9]{48}/g,           // OpenAI
  /sk-[a-zA-Z0-9]{32,64}/g,        // 通用 API Key
  /sk-proj-[a-zA-Z0-9_-]{100,}/g,  // OpenAI Project Key
  /sk-ant-[a-zA-Z0-9]{32,64}/g,    // Anthropic
  /[a-zA-Z0-9]{32,64}-[a-zA-Z0-9]{10,}/g, // 其他格式
];

// IP 地址模式
const IP_ADDRESS_PATTERN = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

// IPv6 地址模式（简化版）
const IPV6_PATTERN = /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g;

// 邮箱模式
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// 私钥模式（各种格式）
const PRIVATE_KEY_PATTERNS = [
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
  /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/g,
  /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/g,
  /-----BEGIN EC PRIVATE KEY-----[\s\S]*?-----END EC PRIVATE KEY-----/g,
  /-----BEGIN DSA PRIVATE KEY-----[\s\S]*?-----END DSA PRIVATE KEY-----/g,
];

// JWT Token 模式
const JWT_PATTERN = /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g;

// 路径中的用户名模式（Unix 路径）
const USERNAME_IN_PATH_PATTERN = /\/home\/[^/\s]+|\/Users\/[^/\s]+/g;

// 密码模式（常见关键词后的值）
const PASSWORD_PATTERNS = [
  /(password|passwd|pwd|secret|token|key)\s*[:=]\s*["']?[^\s"',;]+["']?/gi,
];

// ============================================
// 熵检测
// ============================================

/**
 * 计算字符串的香农熵
 * 
 * @param str - 输入字符串
 * @returns 熵值（bits per character）
 */
function calculateShannonEntropy(str: string): number {
  if (str.length === 0) return 0;
  
  const charCounts: Record<string, number> = {};
  
  for (const char of str) {
    charCounts[char] = (charCounts[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = str.length;
  
  for (const char in charCounts) {
    const frequency = charCounts[char] / len;
    entropy -= frequency * Math.log2(frequency);
  }
  
  return entropy;
}

/**
 * 检测高熵字符串（可能是密钥）
 * 
 * @param str - 输入字符串
 * @param threshold - 熵阈值（默认 4.5 bits）
 * @returns 是否是高熵字符串
 */
function isHighEntropy(str: string, threshold: number = 4.5): boolean {
  // 只检测长度在 16-128 之间的字符串
  if (str.length < 16 || str.length > 128) return false;
  
  // 检测是否包含足够多的不同字符
  const uniqueChars = new Set(str).size;
  if (uniqueChars < 10) return false;
  
  const entropy = calculateShannonEntropy(str);
  return entropy > threshold;
}

// ============================================
// 脱敏函数
// ============================================

/**
 * 第一层：正则替换
 * 使用正则表达式替换敏感信息
 * 
 * @param input - 输入字符串
 * @returns 脱敏后的字符串
 */
function regexSanitize(input: string): string {
  let result = input;
  
  // 替换 API Key
  API_KEY_PATTERNS.forEach(pattern => {
    result = result.replace(pattern, '{API_KEY}');
  });
  
  // 替换 IP 地址
  result = result.replace(IP_ADDRESS_PATTERN, '{IP_ADDRESS}');
  result = result.replace(IPV6_PATTERN, '{IPV6_ADDRESS}');
  
  // 替换邮箱
  result = result.replace(EMAIL_PATTERN, '{EMAIL}');
  
  // 替换私钥
  PRIVATE_KEY_PATTERNS.forEach(pattern => {
    result = result.replace(pattern, '{PRIVATE_KEY}');
  });
  
  // 替换 JWT Token
  result = result.replace(JWT_PATTERN, '{JWT_TOKEN}');
  
  // 替换路径中的用户名
  result = result.replace(USERNAME_IN_PATH_PATTERN, (match) => {
    const parts = match.split('/');
    return parts.slice(0, -1).join('/') + '/{USERNAME}';
  });
  
  // 替换密码
  PASSWORD_PATTERNS.forEach(pattern => {
    result = result.replace(pattern, (match) => {
      const key = match.split(/[:=]/)[0];
      return `${key}={PASSWORD}`;
    });
  });
  
  return result;
}

/**
 * 第二层：结构抽象
 * 保留 JSON key，替换 value 为类型标签
 * 
 * @param input - 输入字符串
 * @returns 脱敏后的字符串
 */
function structureSanitize(input: string): string {
  try {
    // 尝试解析为 JSON
    const obj = JSON.parse(input);
    const sanitized = sanitizeObject(obj);
    return JSON.stringify(sanitized);
  } catch {
    // 不是有效的 JSON，返回原字符串
    return input;
  }
}

/**
 * 递归脱敏对象
 * 
 * @param obj - 输入对象
 * @returns 脱敏后的对象
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    // 对字符串值进行脱敏
    return sanitizeStringValue(obj);
  }
  
  if (typeof obj === 'number') {
    return `{NUMBER}`;
  }
  
  if (typeof obj === 'boolean') {
    return `{BOOLEAN}`;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return [];
    
    // 如果数组元素都是相同类型，只保留一个示例
    const firstItem = obj[0];
    const sanitizedFirst = sanitizeObject(firstItem);
    
    if (obj.length === 1) {
      return [sanitizedFirst];
    }
    
    return [sanitizedFirst, `...(${obj.length - 1} more items)`];
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // 保留 key，脱敏 value
      result[key] = sanitizeObject(value);
    }
    
    return result;
  }
  
  return obj;
}

/**
 * 脱敏字符串值
 * 
 * @param str - 输入字符串
 * @returns 脱敏后的字符串
 */
function sanitizeStringValue(str: string): string {
  // 空字符串
  if (str.length === 0) return '{EMPTY_STRING}';
  
  // 已经脱敏的标记
  if (str.startsWith('{') && str.endsWith('}')) return str;
  
  // 检测高熵字符串
  if (isHighEntropy(str)) {
    return `{HIGH_ENTROPY_STRING_LEN_${str.length}}`;
  }
  
  // 检测可能的密钥
  if (str.length >= 32 && /^[a-zA-Z0-9_-]+$/.test(str)) {
    return `{POTENTIAL_KEY_LEN_${str.length}}`;
  }
  
  // 检测 UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return `{UUID}`;
  }
  
  // 检测时间戳
  if (/^\d{10,13}$/.test(str)) {
    return `{TIMESTAMP}`;
  }
  
  // 检测 Base64
  if (/^[A-Za-z0-9+/]*={0,2}$/.test(str) && str.length % 4 === 0 && str.length >= 16) {
    return `{BASE64_LEN_${str.length}}`;
  }
  
  // 检测 Hex
  if (/^[0-9a-fA-F]+$/.test(str) && str.length >= 32) {
    return `{HEX_LEN_${str.length}}`;
  }
  
  // 长字符串截断
  if (str.length > 200) {
    return str.substring(0, 100) + '...' + str.substring(str.length - 20) + ` (total ${str.length} chars)`;
  }
  
  return str;
}

/**
 * 第三层：熵检测脱敏
 * 检测并替换高熵字符串
 * 
 * @param input - 输入字符串
 * @returns 脱敏后的字符串
 */
function entropySanitize(input: string): string {
  // 分割字符串（保留分隔符）
  const tokens = input.split(/([\s"',;:[\]{}()])/);
  
  return tokens.map(token => {
    // 跳过已经脱敏的标记
    if (token.startsWith('{') && token.endsWith('}')) return token;
    
    // 跳过短字符串
    if (token.length < 16) return token;
    
    // 检测高熵
    if (isHighEntropy(token)) {
      return `{HIGH_ENTROPY_LEN_${token.length}}`;
    }
    
    return token;
  }).join('');
}

// ============================================
// 主脱敏函数
// ============================================

/**
 * 对输入进行三层脱敏处理
 * 
 * @param input - 输入字符串或对象
 * @returns 脱敏后的字符串
 */
export function sanitizeInput(input: string | object): string {
  // 转换为字符串
  let str: string;
  
  if (typeof input === 'string') {
    str = input;
  } else if (typeof input === 'object') {
    str = JSON.stringify(input);
  } else {
    str = String(input);
  }
  
  // 第一层：正则替换
  str = regexSanitize(str);
  
  // 第二层：结构抽象（如果是 JSON）
  str = structureSanitize(str);
  
  // 第三层：熵检测
  str = entropySanitize(str);
  
  return str;
}

/**
 * 对对象进行脱敏处理
 * 
 * @param obj - 输入对象
 * @returns 脱敏后的对象
 */
export function sanitizeObjectInput(obj: Record<string, any>): Record<string, any> {
  return sanitizeObject(obj);
}

/**
 * 对数组进行脱敏处理
 * 
 * @param arr - 输入数组
 * @returns 脱敏后的数组
 */
export function sanitizeArrayInput(arr: any[]): any[] {
  return arr.map(item => {
    if (typeof item === 'string') {
      return sanitizeInput(item);
    }
    if (typeof item === 'object' && item !== null) {
      return sanitizeObject(item);
    }
    return item;
  });
}

// ============================================
// 测试函数
// ============================================

/**
 * 测试脱敏功能
 */
export function testSanitization(): void {
  const testCases = [
    // API Key
    'Error with API key: sk-abcdefghijklmnopqrstuvwxyz123456789012345678901234567890',
    // IP 地址
    'Connection failed to 192.168.1.1:8080',
    // 邮箱
    'Contact admin@example.com for help',
    // 私钥
    '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
    // JWT
    'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    // 路径
    'File not found: /home/john/documents/file.txt',
    // 密码
    'password=secret123, api_key=abc123def456',
    // 高熵字符串
    'Random key: aBc9xYz2LmNqP5vR8sTuW7eFgHjKl4Mn',
    // JSON
    JSON.stringify({
      apiKey: 'sk-abc123def456',
      password: 'secret',
      user: {
        email: 'user@example.com',
        token: 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ',
      },
    }),
  ];
  
  console.log('=== Sanitization Test Results ===\n');
  
  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}:`);
    console.log('Input:', testCase.substring(0, 100) + (testCase.length > 100 ? '...' : ''));
    console.log('Output:', sanitizeInput(testCase).substring(0, 100) + '...');
    console.log('---\n');
  });
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testSanitization();
}
