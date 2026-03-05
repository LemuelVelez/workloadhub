// ✅ Fix TypeScript error:
// "Cannot find module 'xlsx-js-style' or its corresponding type declarations."
//
// This provides a minimal type shim so TS can compile when using dynamic import("xlsx-js-style").
//
// NOTE:
// - If you have NOT installed the package yet, install it to enable Excel styling:
//   npm i xlsx-js-style
declare module "xlsx-js-style" {
    const XLSX: any
    export default XLSX
}