declare const __APP_VERSION__: string;

declare module '*.wasm?url' {
  const content: string;
  export default content;
}