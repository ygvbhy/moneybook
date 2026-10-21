"use client";

// (app)/layout.tsx(세션 확인 등)에서 난 오류는 같은 폴더의 error.tsx가 잡지 못하므로 루트에서 잡는다
export { default } from "./(app)/error";
