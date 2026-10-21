import bcrypt from "bcryptjs";

const COST = 12;

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stderr.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          reject(new Error("취소되었습니다"));
          return;
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function readStdin(): Promise<string> {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, "");
}

async function main() {
  const password = process.stdin.isTTY
    ? await readHidden("비밀번호 (입력이 표시되지 않습니다): ")
    : await readStdin();
  if (!password) throw new Error("비밀번호가 비어 있습니다");
  console.log(await bcrypt.hash(password, COST));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "실패했습니다");
  process.exit(1);
});
