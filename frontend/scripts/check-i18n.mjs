import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const failures = [];
const namespaces = ['common', 'guest', 'reception', 'housekeeping', 'admin'];
const flatten = (object, prefix = '') => Object.fromEntries(Object.entries(object).flatMap(([key, value]) => {
  const name = prefix ? `${prefix}.${key}` : key;
  return typeof value === 'object' && value !== null ? Object.entries(flatten(value, name)) : [[name, value]];
}));
const dictionaries = Object.fromEntries(['vi', 'en'].map(lng => [lng, Object.fromEntries(namespaces.flatMap(ns => {
  const json = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales', lng, ns + '.json'), 'utf8'));
  return Object.entries(flatten(json)).map(([key, value]) => [`${ns}:${key}`, value]);
}))]));
const placeholders = value => [...value.matchAll(/{{\s*([^}]+)\s*}}/g)].map(match => match[1].trim()).sort().join('|');
const tags = value => [...value.matchAll(/<\/?(part\d+)[^>]*>/g)].map(match => match[1]).sort().join('|');
const exists = key => Object.hasOwn(dictionaries.vi, key) || Object.hasOwn(dictionaries.vi, key + '_other');
for (const key of new Set([...Object.keys(dictionaries.vi), ...Object.keys(dictionaries.en)])) {
  const vi = dictionaries.vi[key], en = dictionaries.en[key];
  if (typeof vi !== 'string' || typeof en !== 'string') { failures.push(`Missing key or non-string value: ${key}`); continue; }
  if (!vi.trim() || !en.trim()) failures.push(`Empty value: ${key}`);
  if (placeholders(vi) !== placeholders(en)) failures.push(`Interpolation mismatch: ${key}`);
  if (tags(vi) !== tags(en)) failures.push(`Rich-text component mismatch: ${key}`);
  if (key.endsWith('_one') && !exists(key.replace(/_one$/, '_other'))) failures.push(`Missing plural other: ${key}`);
  if (key.endsWith('_other') && !exists(key.replace(/_other$/, '_one'))) failures.push(`Missing plural one: ${key}`);
  for (const match of en.matchAll(/{{\s*[^},]+,\s*([a-zA-Z]+)\s*}}/g)) {
    if (!exists(`common:counts.${match[1]}_one`) || !exists(`common:counts.${match[1]}_other`)) failures.push(`Unmapped count formatter ${match[1]}: ${key}`);
  }
}

const walkFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walkFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const sourceFiles = walkFiles(path.join(root, 'src')).filter(file => /\.[jt]sx?$/.test(file) && !file.includes('.test.') && !file.endsWith('test-setup.ts'));
const brand = /^(?:AN NHIÊN(?: HOTEL & SUITES)?|An Nhiên(?: Hotel & Suites)?|Nguyễn An Nhiên|Tiếng Việt)$/;
let references = 0;
for (const file of sourceFiles) {
  const code = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const location = node => `${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;
  function visit(node) {
    if (ts.isStringLiteral(node) && /^(common|guest|reception|housekeeping|admin):[a-zA-Z0-9]/.test(node.text)) {
      references++; if (!exists(node.text)) failures.push(`Unknown key ${node.text}: ${location(node)}`);
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'Trans') {
      const attrs = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(attr => [attr.name.getText(source), attr.initializer && ts.isStringLiteral(attr.initializer) ? attr.initializer.text : null]));
      if (attrs.i18nKey) { const key = attrs.i18nKey.includes(':') ? attrs.i18nKey : `${attrs.ns ?? 'common'}:${attrs.i18nKey}`; references++; if (!exists(key)) failures.push(`Unknown Trans key ${key}: ${location(node)}`); }
    }
    // Only bounded canonical catalog/note aliases and classifier keywords are exempt.
    if (!file.includes(path.sep + 'i18n' + path.sep) && (ts.isStringLiteral(node) || ts.isJsxText(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /[\u00c0-\u01ff\u1ea0-\u1ef9]/.test(node.text)) {
      const value = node.text.trim(), parent = node.parent;
      const classifierWords = new Set(['ăn', 'bữa', 'tối', 'sáng', 'trưa', 'cơm', 'mì', 'bánh', 'uống', 'nước', 'cà phê', 'trà', 'rượu', 'sân bay', 'đón', 'tiễn', 'giặt', 'ủi', 'dọn', 'vệ sinh']);
      const classifier = classifierWords.has(value) && ts.isCallExpression(parent) && /\.(includes|replace|startsWith|endsWith)$/.test(parent.expression.getText(source)) && /(?:create-service-order|reception-service-pages)\.tsx$/.test(file);
      const fixedNoteAlias = file.endsWith(path.join('housekeeping', 'contracts.ts')) && ['Dọn phòng sau chuyển phòng gia hạn', 'Vệ sinh phòng trước khi đón khách'].includes(value);
      if (value && !brand.test(value) && !classifier && !fixedNoteAlias) failures.push(`Hard-coded Vietnamese UI text ${JSON.stringify(value)}: ${location(node)}`);
    }
    if (!file.includes(path.sep + 'i18n' + path.sep) && ts.isTemplateExpression(node) && [node.head.text, ...node.templateSpans.map(span => span.literal.text)].some(value => /[\u00c0-\u01ff\u1ea0-\u1ef9]/.test(value))) {
      if (!(file.endsWith('app.tsx') && node.getText(source) === '`${title} · An Nhiên Hotel`')) failures.push(`Hard-coded Vietnamese template: ${location(node)}`);
    }
    if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text) && !/[\u00c0-\u01ff\u1ea0-\u1ef9]/.test(node.text)) {
      const invariant = new Set(['A', 'PMS', 'Hotel & Suites', 'ESC', '(ID:', 'VI', 'EN']);
      if (!invariant.has(node.text.trim())) failures.push(`Hard-coded ASCII UI text ${JSON.stringify(node.text.trim())}: ${location(node)}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

const enumLabels = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/enum-labels.json'), 'utf8'));
const schema = fs.readFileSync(path.join(root, '../prisma/schema.prisma'), 'utf8');
for (const [, domain, body] of schema.matchAll(/enum (\w+)\s*{([^}]+)}/g)) {
  const codes = body.split('\n').map(line => line.trim()).filter(line => /^[A-Z][A-Z_]*$/.test(line));
  for (const code of codes) if (!enumLabels[domain]?.[code] || !exists(enumLabels[domain][code])) failures.push(`Unmapped business enum: ${domain}.${code}`);
}
const errorSource = fs.readFileSync(path.join(root, 'src/i18n/errors.ts'), 'utf8');
for (const file of walkFiles(path.join(root, '../src')).filter(file => file.endsWith('.ts'))) {
  const code = fs.readFileSync(file, 'utf8');
  for (const [, value] of code.matchAll(/\bcode:\s*['"]([A-Z][A-Z_]+)['"]/g)) {
    if (!new RegExp(`\\b${value}:`).test(errorSource)) failures.push(`Unmapped backend business error: ${value}`);
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`i18n validation passed: ${Object.keys(dictionaries.vi).length} keys per language; ${references} static references; ${Object.keys(enumLabels).length} enum domains; no missing/empty keys, placeholder/plural mismatches or unapproved hard-coded Vietnamese UI text.`);
