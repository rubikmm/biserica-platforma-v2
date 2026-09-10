// Fisierele din `resurse/` (chenarul, crucea, fonturile foii) intra in Worker ca octeti — regula `Data` din wrangler.jsonc.
declare module '*.png' {
  const octeti: ArrayBuffer
  export default octeti
}
declare module '*.otf' {
  const octeti: ArrayBuffer
  export default octeti
}
declare module '*.ttf' {
  const octeti: ArrayBuffer
  export default octeti
}
