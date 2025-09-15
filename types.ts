
import { Timestamp } from "firebase/firestore";

export interface DiaNaoUtil {
  data: Date;
  motivo: string;
  tipo: 'feriado' | 'decreto' | 'instabilidade' | 'recesso';
}

// FIX: Change `extends DiaNaoUtil` to `extends Omit<DiaNaoUtil, 'tipo'>`
// to allow redefining the `tipo` property with an additional value.
export interface DiaNaoUtilItem extends Omit<DiaNaoUtil, 'tipo'> {
    id: string | number;
    tipo: DiaNaoUtil['tipo'] | 'recesso_grouped';
}


export interface Alerta {
  tipo: 'info' | 'aviso';
  mensagem: string;
}

export interface PrazoResult {
  prazoFinal: Date;
  diasNaoUteis?: DiaNaoUtil[];
  alertas?: Alerta[];
}

export interface ResultadoCalculo {
  tipo: 'civel' | 'crime';
  prazo: number;
  decretoImpactou: boolean;
  comDecreto: PrazoResult;
  semDecreto: PrazoResult;
  dataPublicacao?: Date;
  inicioPrazo?: Date;
  dataPublicacaoComDecreto?: Date;
  dataPublicacaoSemDecreto?: Date;
  inicioPrazoComDecreto?: Date;
  inicioPrazoSemDecreto?: Date;
}

export interface MinutaState {
  intempestivo: boolean;
  justificativa: string;
  texto: string;
  status?: 'intempestivo' | 'tempestivo';
}

export interface UsageStat {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  materia: 'civel' | 'crime';
  prazo: 5 | 15;
  numeroProcesso: string;
  timestamp: Timestamp;
}

export interface StatsSummary {
  total: number;
  perMateria: { [key: string]: number };
  perPrazo: { [key: string]: number };
  byDay: { [key: string]: number };
}

export interface UserProfile {
    email: string;
    name: string;
    data: UsageStat[];
}
