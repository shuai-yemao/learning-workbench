import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const skillRoot = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, skillRoot), "utf8");
}

test("项目定义先需求对齐，再分片输出草稿", async () => {
  const skill = await read("SKILL.md");
  const openai = await read("agents/openai.yaml");

  assert.match(skill, /每轮只处理一个需求部分/);
  assert.match(skill, /未完成必要的需求对齐前，不输出完整候选比较或项目框架/);
  assert.match(skill, /每轮只输出一个部分，并等待用户审查/);
  assert.match(skill, /完整项目定义/);
  assert.match(skill, /不得一次性发送完整项目定义/);

  assert.match(openai, /逐项对齐需求/);
  assert.match(openai, /未完成对齐前不要输出完整候选比较或框架草稿/);
  assert.match(openai, /一次只展示一个待审查草稿部分/);
});
