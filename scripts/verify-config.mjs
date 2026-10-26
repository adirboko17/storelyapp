import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".expo" || name === "dist") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) files.push(full);
  }
}

walk(path.join(root, "app"));
walk(path.join(root, "src"));
files.push(path.join(root, "index.js"));

const failures = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  const configFile = path.join("src", "lib", "config.ts");
  if (/eyJ[A-Za-z0-9_-]{10,}/.test(text)) failures.push(`${relative} contains a JWT`);
  if (relative !== configFile && /sb_secret_/.test(text)) failures.push(`${relative} contains a secret key`);
  if (/https?:\/\/[a-z0-9-]+\.supabase\.co/i.test(text)) failures.push(`${relative} contains a Supabase URL`);
  if (relative !== configFile && /service_role/.test(text)) failures.push(`${relative} mentions service_role`);
  if (/\.from\(\s*["'](orders|products|customers)["']/.test(text)) failures.push(`${relative} writes or reads a commerce table directly`);
  if (/has_platform_access/.test(text)) failures.push(`${relative} calls platform access`);
}

const client = readFileSync(path.join(root, "src", "lib", "supabase.ts"), "utf8");
const body = client.slice(client.indexOf("export function getSupabase"));
const guard = body.indexOf("readPublicSupabaseConfig");
const created = body.indexOf("createClient");
if (guard < 0 || created < 0 || guard > created) failures.push("supabase client can be created before the public config check");

const { publicConfigProblem } = await import(pathToFileURL(path.join(root, "src", "lib", "config.ts")).href);

function jwt(role) {
  const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");
  return `aaa.${payload}.bbb`;
}

const cases = [
  [{}, "חסרים"],
  [{ EXPO_PUBLIC_SUPABASE_URL: "http://example.supabase.co", EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" }, "https"],
  [{ EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co", EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_test" }, "סודי"],
  [{ EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co", EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("service_role") }, "סודי"],
  [{ EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co", EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("anon") }, "anon"],
  [{ EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co", EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" }, null],
];

for (const [env, expected] of cases) {
  const message = publicConfigProblem(env);
  const ok = expected == null ? message == null : typeof message === "string" && message.includes(expected);
  if (!ok) failures.push(`config case ${JSON.stringify(env)} returned ${message}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("config guard ok");
