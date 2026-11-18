// Partage d'un fichier : feuille de partage Android (APK, via Filesystem + Share), sinon navigator.share, sinon téléchargement.
// Dans la WebView de l'APK, ni navigator.share ni le téléchargement par lien <a download> ne marchent.
const b64 = async blob => {
  const u = new Uint8Array(await blob.arrayBuffer()); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};

/** @returns {Promise<'shared'|'downloaded'|'cancel'>} */
export async function shareBlob(blob, name, { title = '', text = '' } = {}) {
  const cap = globalThis.Capacitor, P = cap?.isNativePlatform?.() ? cap.Plugins : null;
  if (P?.Filesystem && P?.Share) {
    try {
      const { uri } = await P.Filesystem.writeFile({ path: name, data: await b64(blob), directory: 'CACHE' });
      await P.Share.share({ title, text, files: [uri], dialogTitle: title || name });
      return 'shared';
    } catch (e) { if (/cancel/i.test(String(e?.message || e))) return 'cancel'; throw e; }
  }
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try { await navigator.share({ files: [file], title, text }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'downloaded';
}
