/**
 * Import di un file di testo come stringa (`?raw`), risolto da Vite in fase
 * di build. Serve per portare CHANGELOG.md dentro il pacchetto: la scheda
 * Info lo legge senza rete e senza un secondo file da tenere allineato.
 */
declare module '*.md?raw' {
  const content: string;
  export default content;
}
