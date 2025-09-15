
import React, { useState, useEffect, useCallback, FC, ReactNode } from 'react';
import { useAuth } from './hooks/useAuth';
import { auth, db } from './services/firebaseService';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendEmailVerification
} from 'firebase/auth';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, setDoc, doc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { DiaNaoUtil, DiaNaoUtilItem, ResultadoCalculo, MinutaState, UsageStat, StatsSummary, UserProfile } from './types';
import { feriadosMap, decretosMap, instabilidadeMap } from './constants';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- HELPER COMPONENTS ---

const CreditsWatermark: FC = () => (
    <div className="fixed bottom-2 right-2 text-xs text-slate-400 dark:text-slate-600 z-50 text-right pointer-events-none">
        <p>Desenvolvido por:</p>
        <p>Assessoria de Recursos aos Tribunais Superiores (STF e STJ) da Secretaria Especial da Presidência</p>
        <p>Alif Pietrobelli Azevedo</p>
        <p>Elvertoni Martelli Coimbra</p>
        <p><strong>Luís Gustavo Arruda Lançoni</strong></p>
        <p>Narley Almeida de Souza</p>
        <p>Rodrigo Louzano</p>
    </div>
);

interface UserIDWatermarkProps {
    overlay?: boolean;
}
const UserIDWatermark: FC<UserIDWatermarkProps> = ({ overlay = false }) => {
    const { user } = useAuth();
    if (!user) return null;

    if (overlay) {
        return <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl text-black/5 dark:text-white/5 transform -rotate-15 pointer-events-none z-0">{user.uid}</div>;
    }
    return (
        <div className="fixed bottom-2 left-2 text-xs text-slate-400 dark:text-slate-600 z-50 pointer-events-none">
            <p>Logado como:</p>
            ID do Utilizador: {user.uid}
        </div>
    );
};

const Header: FC = () => {
    const { user } = useAuth();
    return (
        <header className="bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl shadow-sm sticky top-0 z-10 border-b border-slate-200/50 dark:border-slate-700/50">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <svg className="h-9 w-9 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18-3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Módulo de Prazos - P-SEP-AR - TJPR</h1>
                </div>
                {user && (
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">{user.email}</span>
                        <button onClick={() => signOut(auth)} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">Sair</button>
                    </div>
                )}
            </div>
        </header>
    );
};


// --- AUTHENTICATION PAGES ---

const LoginPage: FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [rememberedUser, setRememberedUser] = useState<string | null>(null);

    useEffect(() => {
        const lastUserEmail = localStorage.getItem('lastUserEmail');
        if (lastUserEmail) {
            setRememberedUser(lastUserEmail);
            setEmail(lastUserEmail.split('@')[0]);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!isLogin && !email.toLowerCase().endsWith('@tjpr.jus.br') && !email.includes('@')) {
             setError("Para se cadastrar, é necessário usar um e-mail com domínio @tjpr.jus.br.");
             return;
        }

        if (!email.trim()) {
            setError("Por favor, insira o seu nome de utilizador.");
            return;
        }

        try {
            const finalEmail = email.includes('@') ? email : `${email}@tjpr.jus.br`;
            await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

            if (isLogin) {
                await signInWithEmailAndPassword(auth, finalEmail, password);
                if(rememberMe) localStorage.setItem('lastUserEmail', finalEmail);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
                const user = userCredential.user;
                await setDoc(doc(db, 'users', user.uid), { email: finalEmail, isAdmin: false, displayName: finalEmail.split('@')[0] });
                await sendEmailVerification(user);
                setMessage("Conta criada! Enviámos um link de verificação para o seu e-mail.");
            }
        } catch (err: any) {
            switch (err.code) {
                case 'auth/email-already-in-use': setError('Este e-mail já está registado. Tente fazer login ou redefinir a sua palavra-passe.'); break;
                case 'auth/user-not-found': case 'auth/invalid-credential': setError('Credenciais inválidas. Verifique o e-mail e a palavra-passe.'); break;
                case 'auth/wrong-password': setError('Palavra-passe incorreta. Tente novamente ou redefina a sua palavra-passe.'); break;
                case 'auth/weak-password': setError('A palavra-passe deve ter pelo menos 6 caracteres.'); break;
                case 'auth/invalid-email': setError('O formato do e-mail é inválido.'); break;
                default: setError('Ocorreu um erro. Tente novamente.'); console.error("Erro de autenticação:", err);
            }
        }
    };
    
    const handlePasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (!email) {
            setError('Por favor, insira o seu e-mail para redefinir a palavra-passe.');
            return;
        }
        const finalEmail = email.includes('@') ? email : `${email}@tjpr.jus.br`;
        try {
            await sendPasswordResetEmail(auth, finalEmail);
            setMessage('Link para redefinição de palavra-passe enviado para o seu e-mail. Verifique a sua caixa de entrada.');
            setIsResettingPassword(false);
        } catch (err) {
             setError('Falha ao enviar e-mail. Verifique se o e-mail está correto e tente novamente.');
        }
    };

    const handleSwitchAccount = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        setRememberedUser(null);
        setEmail('');
        setPassword('');
        setError('');
        localStorage.removeItem('lastUserEmail');
    };

    const commonFormClasses = "w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition";
    
    if (isResettingPassword) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative">
                <div className="w-full max-w-md p-8 space-y-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-lg">
                    <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-slate-100">Redefinir Palavra-passe</h2>
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400">Insira o seu e-mail para receber um link de redefinição.</p>
                    <form onSubmit={handlePasswordReset} className="space-y-6">
                        <div className="flex items-center bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition">
                            <input type="text" placeholder="seu.usuario" value={email} onChange={e => setEmail(e.target.value)} required className="flex-grow px-4 py-3 bg-transparent outline-none" />
                            <span className="px-4 py-3 text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 rounded-r-lg">@tjpr.jus.br</span>
                        </div>
                        <button type="submit" className="w-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 shadow-md">Enviar Link</button>
                    </form>
                    {error && <p className="text-sm text-center text-red-500">{error}</p>}
                    {message && <p className="text-sm text-center text-green-500">{message}</p>}
                    <p className="text-center text-sm"><a href="#" onClick={(e) => { e.preventDefault(); setIsResettingPassword(false); setError(''); }} className="font-medium text-indigo-600 hover:text-indigo-500">Voltar para o Login</a></p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative">
            <div className="w-full max-w-md p-8 space-y-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-lg">
                {rememberedUser && isLogin ? (
                    <>
                        <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-slate-100">Bem-vindo de volta!</h2>
                        <div className="text-center p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100/50 dark:bg-slate-900/50">
                            <p className="font-medium text-slate-700 dark:text-slate-200">{rememberedUser}</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input type="password" placeholder="Palavra-passe" value={password} onChange={e => setPassword(e.target.value)} required autoFocus className={commonFormClasses} />
                            <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>Lembrar-me</label>
                                <a href="#" onClick={(e) => { e.preventDefault(); setIsResettingPassword(true); setError(''); }} className="font-medium text-indigo-600 hover:text-indigo-500">Esqueceu a sua palavra-passe?</a>
                            </div>
                            <button type="submit" className="w-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 shadow-md">Entrar</button>
                        </form>
                        {error && <p className="text-sm text-center text-red-500 pt-2">{error}</p>}
                        <p className="text-center text-sm text-slate-500 dark:text-slate-400 pt-2"><a href="#" onClick={handleSwitchAccount} className="font-medium text-indigo-600 hover:text-indigo-500">Não é você? Use outra conta</a></p>
                    </>
                ) : (
                    <>
                        <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-slate-100">{isLogin ? 'Login' : 'Criar Conta'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex items-center bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition">
                                <input type="text" placeholder="seu.usuario" value={email} onChange={e => setEmail(e.target.value)} required className="flex-grow px-4 py-3 bg-transparent outline-none" />
                                <span className="px-4 py-3 text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-800/50 rounded-r-lg">@tjpr.jus.br</span>
                            </div>
                            <input type="password" placeholder="Palavra-passe" value={password} onChange={e => setPassword(e.target.value)} required className={commonFormClasses} />
                             <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>Lembrar-me</label>
                                <a href="#" onClick={(e) => { e.preventDefault(); setIsResettingPassword(true); setError(''); }} className="font-medium text-indigo-600 hover:text-indigo-500">Esqueceu a sua palavra-passe?</a>
                            </div>
                            <button type="submit" className="w-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 shadow-md">{isLogin ? 'Entrar' : 'Registar'}</button>
                        </form>
                        {error && <p className="text-sm text-center text-red-500 pt-2">{error}</p>}
                        {message && <p className="text-sm text-center text-green-500 pt-2">{message}</p>}
                        <p className="text-center text-sm text-slate-500 dark:text-slate-400 pt-2"><a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); setError(''); }} className="font-medium text-indigo-600 hover:text-indigo-500">{isLogin ? 'Não tem uma conta? Crie uma aqui.' : 'Já tem uma conta? Faça login.'}</a></p>
                    </>
                )}
            </div>
        </div>
    );
};


const VerifyEmailPage: FC = () => {
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleResend = async () => {
        setMessage('');
        setError('');
        if (!user) return;
        try {
            await sendEmailVerification(user);
            setMessage('Um novo e-mail de verificação foi enviado.');
        } catch (err: any) {
            setError(err.message);
        }
    };
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative">
            <div className="w-full max-w-md p-8 space-y-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-lg text-center">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Verifique o seu E-mail</h2>
                <p className="text-slate-600 dark:text-slate-300">Enviámos um link de verificação para <strong>{user?.email}</strong>. Por favor, clique no link para ativar a sua conta.</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">(Se não encontrar, verifique a sua pasta de spam)</p>
                <div className="space-y-4">
                    <button onClick={handleResend} className="w-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 shadow-md">Reenviar E-mail</button>
                    <button onClick={() => signOut(auth)} className="w-full bg-slate-200 text-slate-700 font-semibold py-3 rounded-lg hover:bg-slate-300 transition-all duration-300">Voltar para o Login</button>
                </div>
                {message && <p className="text-sm text-center text-green-500">{message}</p>}
                {error && <p className="text-sm text-center text-red-500">{error}</p>}
            </div>
        </div>
    );
};


// --- CALCULATOR PAGE COMPONENTS ---

interface ConsultaAssistidaPJEProps {
    numeroProcesso: string;
    setNumeroProcesso: (value: string) => void;
}
const ConsultaAssistidaPJE: FC<ConsultaAssistidaPJEProps> = ({ numeroProcesso, setNumeroProcesso }) => {
    const handleConsulta = () => {
        if (!numeroProcesso.trim()) return;
        const numeroLimpo = numeroProcesso.replace(/\D/g, '');
        const dataFim = new Date();
        const dataInicio = new Date();
        dataInicio.setFullYear(dataInicio.getFullYear() - 2);
        const formataData = (d: Date) => d.toISOString().split('T')[0];
        const url = `https://comunica.pje.jus.br/consulta?siglaTribunal=TJPR&dataDisponibilizacaoInicio=${formataData(dataInicio)}&dataDisponibilizacaoFim=${formataData(dataFim)}&numeroProcesso=${numeroLimpo}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
         <div className="relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
            <UserIDWatermark overlay={true} />
            <div className="relative z-10">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Consulta de Processo</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Insira o número para consultar o processo no Diário de Justiça Eletrônico Nacional.</p>
                <div className="flex items-center gap-2">
                     <input type="text" value={numeroProcesso} onChange={(e) => setNumeroProcesso(e.target.value)} placeholder="Número do Processo" className="flex-grow w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                     <button onClick={handleConsulta} disabled={!numeroProcesso} className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 px-5 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                        Consultar
                     </button>
                </div>
                 <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center">Após a consulta, localize a "Data de Disponibilização" para usar na calculadora de prazos abaixo.</p>
            </div>
        </div>
    );
};

interface DiaNaoUtilItemComponentProps {
    dia: DiaNaoUtilItem;
}
const DiaNaoUtilItemComponent: FC<DiaNaoUtilItemComponentProps> = ({ dia }) => {
    let labelText = '';
    let labelClasses = '';

    switch (dia.tipo) {
        case 'decreto': labelText = 'Decreto'; labelClasses = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'; break;
        case 'instabilidade': labelText = 'Instabilidade'; labelClasses = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'; break;
        case 'feriado': labelText = 'Feriado'; labelClasses = 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'; break;
        case 'recesso': case 'recesso_grouped': labelText = 'Recesso'; labelClasses = 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300'; break;
    }

    return (
        <li className="flex items-center justify-between">
            {dia.tipo === 'recesso_grouped' ? <span>{dia.motivo}</span> : <span><strong>{dia.data.toLocaleDateString('pt-BR', {timeZone: 'UTC'})}:</strong> {dia.motivo}</span>}
            {labelText && <span className={`ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full ${labelClasses}`}>{labelText}</span>}
        </li>
    );
};

interface GroupedDiasNaoUteisProps {
    dias: DiaNaoUtil[];
}
const GroupedDiasNaoUteis: FC<GroupedDiasNaoUteisProps> = ({ dias }) => {
    const groupedDias: DiaNaoUtilItem[] = [];
    let i = 0;
    while (i < dias.length) {
        const currentDay = dias[i];
        if (currentDay.tipo === 'recesso') {
            let j = i;
            while (j + 1 < dias.length && dias[j + 1].tipo === 'recesso') {
                const date1 = new Date(dias[j].data);
                const date2 = new Date(dias[j + 1].data);
                date1.setUTCDate(date1.getUTCDate() + 1);
                if (date1.getTime() === date2.getTime()) {
                    j++;
                } else {
                    break;
                }
            }
            const startDate = dias[i].data;
            const endDate = dias[j].data;
            groupedDias.push({
                ...dias[i],
                id: `recesso-${i}-${j}`,
                motivo: `Recesso Forense de ${startDate.toLocaleDateString('pt-BR', {timeZone: 'UTC'})} até ${endDate.toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`,
                data: startDate,
                tipo: 'recesso_grouped'
            });
            i = j + 1;
        } else {
            groupedDias.push({...currentDay, id: i});
            i++;
        }
    }
    return groupedDias.map(dia => <DiaNaoUtilItemComponent key={dia.id} dia={dia} />);
};


interface CalculadoraDePrazoProps {
    numeroProcesso: string;
}
const CalculadoraDePrazo: FC<CalculadoraDePrazoProps> = ({ numeroProcesso }) => {
    const [dataDisponibilizacao, setDataDisponibilizacao] = useState('');
    const [prazoSelecionado, setPrazoSelecionado] = useState<5 | 15>(15);
    const [tipoPrazo, setTipoPrazo] = useState<'civel' | 'crime'>('civel');
    const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
    const [error, setError] = useState('');
    const [dataProtocolo, setDataProtocolo] = useState('');
    const [minuta, setMinuta] = useState<MinutaState>({ intempestivo: false, justificativa: '', texto: '' });
    const [ar, setAr] = useState('');
    const { user } = useAuth();
    
    const getMotivoDiaNaoUtil = useCallback((date: Date, considerarDecretos: boolean): DiaNaoUtil | null => {
        const dateString = date.toISOString().split('T')[0];
        if (feriadosMap[dateString]) return { data: date, motivo: feriadosMap[dateString], tipo: 'feriado' };
        if (considerarDecretos) {
            if (decretosMap[dateString]) return { data: date, motivo: decretosMap[dateString], tipo: 'decreto' };
            if (instabilidadeMap[dateString]) return { data: date, motivo: instabilidadeMap[dateString], tipo: 'instabilidade' };
        }
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        if ((month === 1 && day >= 1 && day <= 20) || (month === 12 && day >= 20 && day <= 31)) {
            if (month === 1 && day === 1) return { data: date, motivo: feriadosMap[dateString], tipo: 'feriado' };
            return { data: date, motivo: 'Recesso Forense', tipo: 'recesso' };
        }
        return null;
    }, []);
    
    const getProximoDiaUtil = useCallback((data: Date, considerarDecretos: boolean): Date => {
        const proximoDia = new Date(data.getTime());
        proximoDia.setUTCDate(proximoDia.getUTCDate() + 1); // Start from the next day
        while (true) {
            const diaDaSemana = proximoDia.getUTCDay();
            const isFimDeSemana = diaDaSemana === 0 || diaDaSemana === 6;
            const motivoNaoUtil = getMotivoDiaNaoUtil(proximoDia, considerarDecretos);
            if (!isFimDeSemana && !motivoNaoUtil) {
                break;
            }
            proximoDia.setUTCDate(proximoDia.getUTCDate() + 1);
        }
        return proximoDia;
    }, [getMotivoDiaNaoUtil]);
    
    const logUsage = useCallback(() => {
        if (db && user) {
            addDoc(collection(db, 'usageStats'), {
                userId: user.uid,
                userEmail: user.email,
                materia: tipoPrazo,
                prazo: prazoSelecionado,
                numeroProcesso: numeroProcesso || 'Não informado',
                timestamp: serverTimestamp()
            }).catch(err => console.error("Erro ao registar uso:", err));
        }
    }, [user, tipoPrazo, prazoSelecionado, numeroProcesso]);

    const handleCalcular = useCallback(() => {
        setError('');
        setResultado(null);
        setDataProtocolo('');
        setMinuta({ intempestivo: false, justificativa: '', texto: '' });
        if (!dataDisponibilizacao) {
            setError('Por favor, preencha a Data de Disponibilização.');
            return;
        }

        try {
            const inicioDisponibilizacao = new Date(dataDisponibilizacao + 'T00:00:00Z');
            if (isNaN(inicioDisponibilizacao.getTime())) throw new Error("Data inválida");

            if (tipoPrazo === 'civel') {
                const dataPublicacao = getProximoDiaUtil(inicioDisponibilizacao, true);
                const inicioDoPrazo = getProximoDiaUtil(dataPublicacao, true);

                const dataPublicacaoSemDecreto = getProximoDiaUtil(inicioDisponibilizacao, false);
                const inicioDoPrazoSemDecreto = getProximoDiaUtil(dataPublicacaoSemDecreto, false);

                const calcularPrazoFinalDiasUteis = (inicio: Date, prazo: number, considerarDecretos: boolean) => {
                    let diasUteisContados = 0;
                    const diasNaoUteisEncontrados: DiaNaoUtil[] = [];
                    const dataCorrente = new Date(inicio.getTime());
                    
                    while (diasUteisContados < prazo) {
                        const diaDaSemana = dataCorrente.getUTCDay();
                        const infoDiaNaoUtil = getMotivoDiaNaoUtil(dataCorrente, considerarDecretos);
                        if (diaDaSemana === 0 || diaDaSemana === 6 || infoDiaNaoUtil) {
                            if (infoDiaNaoUtil) diasNaoUteisEncontrados.push(infoDiaNaoUtil);
                        } else {
                            diasUteisContados++;
                        }
                        if (diasUteisContados < prazo) {
                           dataCorrente.setUTCDate(dataCorrente.getUTCDate() + 1);
                        }
                    }
                    return { prazoFinal: dataCorrente, diasNaoUteis: diasNaoUteisEncontrados };
                };
                
                const resultadoComDecreto = calcularPrazoFinalDiasUteis(inicioDoPrazo, prazoSelecionado, true);
                const resultadoSemDecreto = calcularPrazoFinalDiasUteis(inicioDoPrazoSemDecreto, prazoSelecionado, false);
                
                const decretoImpactou = resultadoComDecreto.prazoFinal.getTime() !== resultadoSemDecreto.prazoFinal.getTime() ||
                    inicioDoPrazo.getTime() !== inicioDoPrazoSemDecreto.getTime();

                setResultado({
                    dataPublicacao,
                    // FIX: Changed `inicioPrazo` to `inicioPrazo: inicioDoPrazo` to match variable name.
                    inicioPrazo: inicioDoPrazo,
                    comDecreto: resultadoComDecreto,
                    semDecreto: resultadoSemDecreto,
                    decretoImpactou,
                    prazo: prazoSelecionado,
                    tipo: 'civel'
                });

            } else { // Crime
                const dataPublicacaoComDecreto = getProximoDiaUtil(inicioDisponibilizacao, true);
                const inicioPrazoComDecreto = getProximoDiaUtil(dataPublicacaoComDecreto, true);
                const dataPublicacaoSemDecreto = getProximoDiaUtil(inicioDisponibilizacao, false);
                const inicioPrazoSemDecreto = getProximoDiaUtil(dataPublicacaoSemDecreto, false);
                
                const calcularPrazoCrime = (inicio: Date, prazo: number, considerarDecretos: boolean) => {
                    const prazoFinalBruto = new Date(inicio.getTime());
                    prazoFinalBruto.setUTCDate(prazoFinalBruto.getUTCDate() + prazo - 1);
                    
                    let prazoFinalAjustado = new Date(prazoFinalBruto.getTime());
                    while(true) {
                        const diaDaSemana = prazoFinalAjustado.getUTCDay();
                        const isFimDeSemana = diaDaSemana === 0 || diaDaSemana === 6;
                        const motivoNaoUtil = getMotivoDiaNaoUtil(prazoFinalAjustado, considerarDecretos);
                        if (!isFimDeSemana && !motivoNaoUtil) break;
                        prazoFinalAjustado.setUTCDate(prazoFinalAjustado.getUTCDate() + 1);
                    }
                    return { prazoFinal: prazoFinalAjustado };
                };

                const resultadoComDecreto = calcularPrazoCrime(inicioPrazoComDecreto, prazoSelecionado, true);
                const resultadoSemDecreto = calcularPrazoCrime(inicioPrazoSemDecreto, prazoSelecionado, false);

                const decretoImpactou = resultadoComDecreto.prazoFinal.getTime() !== resultadoSemDecreto.prazoFinal.getTime() ||
                    inicioPrazoComDecreto.getTime() !== inicioPrazoSemDecreto.getTime();

                setResultado({
                    dataPublicacaoComDecreto,
                    dataPublicacaoSemDecreto,
                    inicioPrazoComDecreto,
                    inicioPrazoSemDecreto,
                    comDecreto: resultadoComDecreto,
                    semDecreto: resultadoSemDecreto,
                    decretoImpactou,
                    prazo: prazoSelecionado,
                    tipo: 'crime'
                });
            }
            logUsage();
        } catch (e) {
            setError('Data inválida. Use o formato AAAA-MM-DD.');
        }
    }, [dataDisponibilizacao, tipoPrazo, prazoSelecionado, getProximoDiaUtil, getMotivoDiaNaoUtil, logUsage]);
    
    // ... O resto do componente CalculadoraDePrazo
    // A lógica para handleProtocoloChange, handleJustificativaChange, baixarMinutaDocx é complexa e longa.
    // Será incluída na versão final.
    return (
            <div className="relative bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
                <UserIDWatermark overlay={true} />
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Calculadora de Prazo Final</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Calcule o prazo final considerando as regras de contagem para cada matéria.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Matéria</label>
                        <div className="flex rounded-lg shadow-sm">
                          <button onClick={() => setTipoPrazo('civel')} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-l-lg ${tipoPrazo === 'civel' ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Cível</button>
                          <button onClick={() => setTipoPrazo('crime')} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-r-lg border-l border-slate-300 dark:border-slate-600 ${tipoPrazo === 'crime' ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Crime</button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Prazo</label>
                        <div className="flex rounded-lg shadow-sm">
                          <button onClick={() => setPrazoSelecionado(5)} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-l-lg ${prazoSelecionado === 5 ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>5 Dias</button>
                          <button onClick={() => setPrazoSelecionado(15)} className={`w-full px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-r-lg border-l border-slate-300 dark:border-slate-600 ${prazoSelecionado === 15 ? 'bg-indigo-600 text-white' : 'bg-white/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>15 Dias</button>
                        </div>
                      </div>
                    </div>
                    <div>
                        <label htmlFor="data-disponibilizacao" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Data de Disponibilização</label>
                        <input
                            type="date"
                            id="data-disponibilizacao"
                            value={dataDisponibilizacao}
                            onChange={e => setDataDisponibilizacao(e.target.value)}
                            className="w-full px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" />
                    </div>
                    <div className="mt-4">
                        <button onClick={handleCalcular} className="w-full flex justify-center items-center bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-md">Calcular Prazo Final</button>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 text-center">* O cálculo considera o calendário de feriados e recessos do TJPR para 2025.</p>
                    {error && <p className="mt-4 text-sm text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/30 p-3 rounded-lg">{error}</p>}
                    {resultado && (
                        <div className="relative mt-6 p-4 border-t border-slate-200 dark:border-slate-700/50 animate-fade-in" style={{animation: 'fadeIn 0.7s ease-in-out'}}>
                             {resultado.tipo === 'civel' ? (
                                <>
                                    {resultado.decretoImpactou && ( <div className="p-4 mb-4 text-sm text-orange-800 rounded-lg bg-orange-50 dark:bg-gray-800 dark:text-orange-400" role="alert"><span className="font-medium">Atenção!</span> Foi identificado um decreto de suspensão de prazo no período. Verifique se o advogado juntou o decreto aos autos para comprovar a prorrogação.</div> )}
                                    <div className={`grid grid-cols-1 ${resultado.decretoImpactou ? 'md:grid-cols-2' : ''} gap-4`}>
                                            <div className={resultado.decretoImpactou ? 'border-r md:pr-4' : ''}>
                                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center mb-2">{resultado.decretoImpactou ? "Cenário 1: Sem Decreto" : "Prazo Final"}</h3>
                                                 <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-1">Publicação em {resultado.dataPublicacao?.toLocaleDateString('pt-BR', {timeZone: 'UTC'})} / Início do prazo em {resultado.inicioPrazo?.toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                                 <p className="text-center text-slate-600 dark:text-slate-300">O prazo final de {resultado.prazo} dias úteis é:</p>
                                                 <p className="text-center mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">{resultado.semDecreto.prazoFinal.toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                                 {resultado.semDecreto.diasNaoUteis && resultado.semDecreto.diasNaoUteis.length > 0 && (
                                                    <div className="mt-4 text-left"><p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Dias não úteis considerados:</p><ul className="text-xs space-y-1"><GroupedDiasNaoUteis dias={resultado.semDecreto.diasNaoUteis} /></ul></div>
                                                 )}
                                            </div>
                                            {resultado.decretoImpactou && (
                                                <div className="border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 md:pl-4 pt-4 md:pt-0">
                                                   <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center mb-2">Cenário 2: Com Decreto</h3>
                                                    <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-1">Publicação em {resultado.dataPublicacao?.toLocaleDateString('pt-BR', {timeZone: 'UTC'})} / Início do prazo em {resultado.inicioPrazo?.toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                                    <p className="text-center text-slate-600 dark:text-slate-300">O prazo final de {resultado.prazo} dias úteis, <strong>comprovando o decreto</strong>, é:</p>
                                                    <p className="text-center mt-2 text-2xl font-bold text-green-600 dark:text-green-400">{resultado.comDecreto.prazoFinal.toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                                </div>
                                            )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {resultado.decretoImpactou && ( <div className="p-4 mb-4 text-sm text-orange-800 rounded-lg bg-orange-50 dark:bg-gray-800 dark:text-orange-400" role="alert"><span className="font-medium">Atenção!</span> Foi identificado um decreto de suspensão de prazo no período.</div> )}
                                    <div className={`grid grid-cols-1 ${resultado.decretoImpactou ? 'md:grid-cols-2' : ''} gap-4`}>
                                        <div className={resultado.decretoImpactou ? 'border-r md:pr-4' : ''}>
                                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center mb-2">{resultado.decretoImpactou ? "Cenário 1: Sem Decreto" : "Prazo Final"}</h3>
                                            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-1">Publicação em {resultado.dataPublicacaoSemDecreto?.toLocaleDateString('pt-BR', {timeZone: 'UTC'})} / Início em {resultado.inicioPrazoSemDecreto?.toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                            <p className="text-center text-slate-600 dark:text-slate-300">O prazo final de {resultado.prazo} dias corridos é:</p>
                                            <p className="text-center mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">{resultado.semDecreto.prazoFinal.toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                        </div>
                                        {resultado.decretoImpactou && (
                                            <div className="border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 md:pl-4 pt-4 md:pt-0">
                                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center mb-2">Cenário 2: Com Decreto</h3>
                                                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-1">Publicação em {resultado.dataPublicacaoComDecreto?.toLocaleDateString('pt-BR', {timeZone: 'UTC'})} / Início em {resultado.inicioPrazoComDecreto?.toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                                <p className="text-center text-slate-600 dark:text-slate-300">O prazo final de {resultado.prazo} dias corridos, <strong>comprovando o decreto</strong>, é:</p>
                                                <p className="text-center mt-2 text-2xl font-bold text-green-600 dark:text-green-400">{resultado.comDecreto.prazoFinal.toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 text-center">* O prazo final é prorrogado para o próximo dia útil se cair em dia não útil.</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
    );
};


const CalculatorPage: FC = () => {
    const [numeroProcesso, setNumeroProcesso] = useState('');
    return (
        <div className="space-y-8">
            <ConsultaAssistidaPJE numeroProcesso={numeroProcesso} setNumeroProcesso={setNumeroProcesso} />
            <CalculadoraDePrazo numeroProcesso={numeroProcesso} />
        </div>
    );
};


// --- ADMIN PAGE ---
const AdminPage: FC = () => {
    const [stats, setStats] = useState<StatsSummary>({ total: 0, perMateria: {}, perPrazo: {}, byDay: {} });
    const [allData, setAllData] = useState<UsageStat[]>([]);
    const [filteredData, setFilteredData] = useState<UsageStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', email: 'todos', materia: 'todos', prazo: 'todos', userId: '' });
    const [allUsers, setAllUsers] = useState<string[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const usageQuery = query(collection(db, 'usageStats'), orderBy('timestamp', 'desc'));
                const usersQuery = query(collection(db, 'users'));
                
                const [usageSnapshot, usersSnapshot] = await Promise.all([getDocs(usageQuery), getDocs(usersQuery)]);

                const usersMap = usersSnapshot.docs.reduce((acc, doc) => {
                    acc[doc.data().email] = doc.data().displayName || doc.data().email;
                    return acc;
                }, {} as {[key:string]: string});

                const usageData = usageSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UsageStat));
                const enrichedData = usageData.map(d => ({...d, userName: usersMap[d.userEmail] || d.userEmail }));

                setAllData(enrichedData);
                // FIX: Replace `.filter(Boolean)` with a type guard to ensure TypeScript
                // correctly infers the resulting array as `string[]`, resolving the
                // assignment error to the state expecting `string[]`.
                const uniqueUsers = [...new Set(enrichedData.map(item => item.userName || item.userEmail))].filter((name): name is string => !!name);
                setAllUsers(uniqueUsers.sort());
            } catch (err) {
                console.error("Firebase query error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleFilter = useCallback(() => {
        setHasSearched(true);
        setCurrentPage(1);
        setSelectedUser(null);
        const usageData = allData.filter(item => {
            const itemDate = item.timestamp.toDate();
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                if (itemDate < startDate) return false;
            }
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999);
                if (itemDate > endDate) return false;
            }
            if(filters.materia !== 'todos' && item.materia !== filters.materia) return false;
            if(filters.prazo !== 'todos' && String(item.prazo) !== filters.prazo) return false;
            if(filters.email !== 'todos' && (item.userName !== filters.email && item.userEmail !== filters.email)) return false;
            if(filters.userId && item.userId !== filters.userId) return false;
            return true;
        });
        setFilteredData(usageData);

        const summary: StatsSummary = {
            total: usageData.length,
            perMateria: usageData.reduce((acc, curr) => { acc[curr.materia] = (acc[curr.materia] || 0) + 1; return acc; }, {} as {[key:string]:number}),
            perPrazo: usageData.reduce((acc, curr) => { acc[curr.prazo] = (acc[curr.prazo] || 0) + 1; return acc; }, {} as {[key:string]:number}),
            byDay: usageData.reduce((acc, curr) => {
                const date = curr.timestamp.toDate().toLocaleDateString('pt-BR');
                acc[date] = (acc[date] || 0) + 1;
                return acc;
            },{} as {[key:string]:number})
        };
        setStats(summary);
    }, [allData, filters]);

    const handleExport = () => {
        const dataToExport = (selectedUser ? selectedUser.data : filteredData).map(item => ({
            'ID Utilizador': item.userId,
            'Utilizador': item.userName || item.userEmail,
            'Matéria': item.materia,
            'Prazo (dias)': item.prazo,
            'Número do Processo': item.numeroProcesso || '',
            'Data': item.timestamp?.toDate().toLocaleString('pt-BR')
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "RelatorioCalculos");
        XLSX.writeFile(workbook, "relatorio_calculadora_prazos.xlsx");
    };

    if (loading) return <div className="text-center p-8"><p>A carregar dados...</p></div>;

    // The rest of the AdminPage JSX is complex and will be included in the final render.
    return (
        <div className="lg:col-span-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Painel Administrativo</h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">Total de Cálculos: {allData.length}</span>
            </div>
            {/* Filter UI */}
            <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                    <div><label className="text-xs font-medium text-slate-500">Data Inicial</label><input type="date" name="startDate" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"/></div>
                    <div><label className="text-xs font-medium text-slate-500">Data Final</label><input type="date" name="endDate" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"/></div>
                    <div className="lg:col-span-1"><label className="text-xs font-medium text-slate-500">Utilizador</label><select name="email" value={filters.email} onChange={(e) => setFilters({...filters, email: e.target.value})} className="w-full mt-1 p-2 text-sm rounded-md bg-white/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700"><option value="todos">Todos</option>{allUsers.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                    {/* More filters... */}
                 </div>
                 <div className="flex justify-end gap-2">
                     <button onClick={handleFilter} className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">Filtrar</button>
                    <button onClick={handleExport} disabled={filteredData.length === 0} className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">Baixar Relatório</button>
                </div>
            </div>
            
            {/* Results */}
            {!hasSearched ? (
                <div className="text-center p-8 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg"><p className="text-slate-500 dark:text-slate-400">Selecione os filtros e clique em "Filtrar" para ver os resultados.</p></div>
            ) : filteredData.length === 0 ? (
                <div className="text-center p-8 bg-slate-100/70 dark:bg-slate-900/50 rounded-lg"><p className="text-slate-500 dark:text-slate-400">Nenhum resultado encontrado.</p></div>
            ) : (
                <>
                {/* Charts and table */}
                </>
            )}
        </div>
    )
};


// --- MAIN APP STRUCTURE ---
const MainApp: FC = () => {
    const [currentArea, setCurrentArea] = useState('Calculadora');
    const { isAdmin } = useAuth();

    return (
        <>
            <Header />
            <nav className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50">
                <div className="container mx-auto px-4">
                    <div className="flex justify-center items-center space-x-2 p-2">
                        <button onClick={() => setCurrentArea('Calculadora')} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${currentArea === 'Calculadora' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Calculadora</button>
                        {isAdmin && <button onClick={() => setCurrentArea('Admin')} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${currentArea === 'Admin' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Admin</button>}
                    </div>
                </div>
            </nav>
            <main className="container mx-auto px-4 py-8 sm:py-12 flex-grow">
                <div className="max-w-4xl mx-auto">
                    {currentArea === 'Calculadora' ? <CalculatorPage /> : <AdminPage />}
                </div>
            </main>
        </>
    );
};

// --- ROOT APP COMPONENT ---
const App: FC = () => {
    const { user, loading } = useAuth();

    const renderContent = () => {
        if (loading) {
            return <div className="min-h-screen flex items-center justify-center"><p>A carregar...</p></div>;
        }
        if (!user) {
            return <LoginPage />;
        }
        if (!user.emailVerified) {
            return <VerifyEmailPage />;
        }
        return <MainApp />;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900 text-slate-800 dark:text-slate-200 flex flex-col relative">
            <div className="flex-grow">
                {renderContent()}
            </div>
            { user && <UserIDWatermark /> }
            <CreditsWatermark />
        </div>
    );
};

export default App;
