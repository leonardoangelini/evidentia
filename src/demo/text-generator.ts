/** Deterministic pseudo-Italian prose generator for demo datasets. */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUBJECTS = ['la scuola', 'il docente', 'lo studente', 'la classe', 'la valutazione', 'il curricolo', 'la didattica', 'la comunità educante', 'il laboratorio', 'la riflessione pedagogica'];
const VERBS = ['richiede', 'promuove', 'costruisce', 'interroga', 'accompagna', 'trasforma', 'sostiene', 'rende visibile', 'documenta', 'valorizza'];
const OBJECTS = ['un processo di apprendimento graduale', 'la responsabilità condivisa', 'una relazione educativa autentica', 'il pensiero critico', 'la partecipazione attiva', 'strumenti di osservazione', 'il dialogo fra pari', 'una progettazione consapevole', 'la motivazione intrinseca', 'esperienze significative'];
const TAILS = ['nel contesto contemporaneo', 'secondo la letteratura recente', 'come mostrano diverse ricerche', 'in modo progressivo', 'attraverso pratiche riflessive', 'senza ridurre la complessità', 'con attenzione alle differenze', 'nel rispetto dei tempi individuali', 'oltre la semplice trasmissione', 'in una prospettiva inclusiva'];

export class TextGenerator {
  private readonly rnd: () => number;
  constructor(seed = 42) {
    this.rnd = mulberry32(seed);
  }
  private pick<T>(list: T[]): T {
    return list[Math.floor(this.rnd() * list.length)] as T;
  }
  sentence(): string {
    const s = `${this.pick(SUBJECTS)} ${this.pick(VERBS)} ${this.pick(OBJECTS)} ${this.pick(TAILS)}.`;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  paragraph(sentences = 4 + Math.floor(this.rnd() * 4)): string {
    return Array.from({ length: sentences }, () => this.sentence()).join(' ');
  }
  /** Approximately `words` words, as paragraphs. */
  paragraphs(words: number): string[] {
    const out: string[] = [];
    let count = 0;
    while (count < words) {
      const p = this.paragraph();
      out.push(p);
      count += p.split(' ').length;
    }
    return out;
  }
}
