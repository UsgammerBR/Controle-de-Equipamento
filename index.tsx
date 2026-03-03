
import React, { useState, useEffect, useReducer, useRef, useMemo, ReactNode, Component, ErrorInfo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { SideMenu } from './components/SideMenu';
import { CameraModal } from './components/CameraModal';
import { 
    CustomMenuIcon, LoadingBoxIcon, IconPlus, IconMinus, IconUndo, IconSearch, IconCamera, IconGallery, IconX, IconShare, IconChevronLeft, IconChevronRight,
    IconFileExcel, IconWhatsapp, IconTelegram, IconEmail, IconStack, IconChevronDown, IconBell, IconCameraLens, IconSettings, IconExport, IconCalendar, IconInfo, IconSun, IconMoon, IconSave, IconDownload,
    IconBox, IconSpeaker, IconRemote, IconChip, IconTrash, IconCloud, IconCopy
} from './components/icons';
import { EquipmentCategory, AppData, DailyData, EquipmentItem, AppNotification, UserProfile } from './types';
import { CATEGORIES, HOLIDAYS_SP } from './constants';

const getFormattedDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const createEmptyDailyData = (): DailyData => {
  const data = {} as Partial<DailyData>;
  CATEGORIES.forEach(category => {
    data[category] = [{ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() }];
  });
  return data as DailyData;
};

const isChristmasPeriod = (): boolean => {
  const now = new Date();
  const month = now.getMonth(); 
  const day = now.getDate();
  return month === 11 && day >= 20 && day <= 25;
};

const generateMonthlyReport = (data: AppData, date: Date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    let report = `Relatório Mensal - ${date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}\n\n`;
    const totals: Record<string, number> = {};
    
    CATEGORIES.forEach(cat => {
        report += `--- ${cat.toUpperCase()} ---\n`;
        let catEntries = 0;
        
        const sortedDates = Object.keys(data).sort();
        
        sortedDates.forEach(dateStr => {
            const d = new Date(dateStr + 'T12:00:00');
            if (d.getMonth() === month && d.getFullYear() === year) {
                const dayData = data[dateStr][cat] || [];
                dayData.filter(isItemActive).forEach(item => {
                    const time = new Date(item.createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    report += `Data: ${d.toLocaleDateString('pt-BR')} | Hora: ${time}\n`;
                    report += `Contrato: ${item.contract || '-'} | Serial: ${item.serial || '-'}\n`;
                    report += `----------------------------\n`;
                    catEntries++;
                });
            }
        });
        
        totals[cat] = catEntries;
        if (catEntries === 0) report += `Nenhum registro.\n`;
        report += `\n`;
    });

    report += `\n============================\n`;
    report += `RESUMO DE TOTAIS DO MÊS\n`;
    report += `============================\n`;
    CATEGORIES.forEach(cat => {
        report += `TOTAL ${cat.toUpperCase()}: ${totals[cat]}\n`;
    });
    report += `============================\n`;
    
    return report;
};

type Action =
  | { type: 'SET_DATA'; payload: AppData }
  | { type: 'ADD_ITEM'; payload: { date: string; category: EquipmentCategory } }
  | { type: 'UPDATE_ITEM'; payload: { date: string; category: EquipmentCategory; item: EquipmentItem } }
  | { type: 'DELETE_SINGLE_ITEM'; payload: { date: string; category: EquipmentCategory; itemId: string } }
  | { type: 'DELETE_MULTIPLE_ITEMS'; payload: { date: string; category: EquipmentCategory; itemIds: string[] } };

const dataReducer = (state: AppData, action: Action): AppData => {
    switch(action.type) {
        case 'SET_DATA': return action.payload;
        case 'ADD_ITEM': {
            const { date, category } = action.payload;
            const newState = JSON.parse(JSON.stringify(state));
            if (!newState[date]) newState[date] = createEmptyDailyData();
            newState[date][category].push({ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() });
            return newState;
        }
        case 'UPDATE_ITEM': {
            const { date, category, item } = action.payload;
            const newState = JSON.parse(JSON.stringify(state));
            if (!newState[date]) newState[date] = createEmptyDailyData();
            const dayData = newState[date][category];
            const itemIndex = dayData.findIndex((i: EquipmentItem) => i.id === item.id);
            if (itemIndex > -1) dayData[itemIndex] = item;
            else dayData.push(item);

            return newState;
        }
        case 'DELETE_SINGLE_ITEM': {
             const { date, category, itemId } = action.payload;
             const newState = JSON.parse(JSON.stringify(state));
             const dayData = newState[date]?.[category];
             if (!dayData) return state;
             newState[date][category] = dayData.filter((item: EquipmentItem) => item.id !== itemId);
             if (newState[date][category].length === 0) {
                 newState[date][category].push({ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() });
             }
             return newState;
        }
        case 'DELETE_MULTIPLE_ITEMS': {
            const { date, category, itemIds } = action.payload;
            if (!itemIds || itemIds.length === 0) return state;
            const newState = JSON.parse(JSON.stringify(state));
            if (!newState[date] || !newState[date][category]) return state;
            
            newState[date][category] = newState[date][category].filter((item: EquipmentItem) => !itemIds.includes(item.id));
            
            if (newState[date][category].length === 0) {
                newState[date][category].push({ id: generateId(), contract: '', serial: '', photos: [], createdAt: Date.now() });
            }
            return newState;
        }
        default: return state;
    }
}

const isItemActive = (item: EquipmentItem): boolean => (item.contract && item.contract.trim() !== '') || (item.serial && item.serial.trim() !== '') || item.photos.length > 0;

// Tipagem correta para o ErrorBoundary
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<any, any> {
  state = { hasError: false };
  props: any;
  
  constructor(props: any) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-red-600 bg-slate-950 min-h-screen flex flex-col items-center justify-center">
          <h1 className="text-2xl font-black mb-4 uppercase tracking-tighter">Erro Crítico</h1>
          <p className="mb-8 opacity-60 text-xs font-bold uppercase tracking-widest">Ocorreu um erro inesperado</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-[3px] text-[10px] active:scale-95 transition-all shadow-xl shadow-red-600/20"
          >
            Recarregar App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const getCategoryIcon = (category: EquipmentCategory) => {
    switch(category) {
        case EquipmentCategory.BOX: return IconBox;
        case EquipmentCategory.BOX_SOUND: return IconSpeaker;
        case EquipmentCategory.CONTROLE: return IconRemote;
        case EquipmentCategory.CAMERA: return IconCameraLens;
        case EquipmentCategory.CHIP: return IconChip;
        default: return IconStack;
    }
};

const AppContent = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  // Carregar notificações do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('equipment_notifications');
    if (saved) setNotifications(JSON.parse(saved));
  }, []);

  // Salvar notificações
  useEffect(() => {
    localStorage.setItem('equipment_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (type: string, details: string) => {
    const newNotif = {
        id: Date.now(),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type,
        details
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50));
    setHasNewNotifications(true);
  };
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appData, dispatch] = useReducer(dataReducer, {} as AppData);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
      const saved = localStorage.getItem('userProfile');
      const defaults = { name: 'Leo Luz', email: 'osgammetbr@gmail.com', cpf: '', profileImage: '' };
      try {
          return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
      } catch (e) {
          return defaults;
      }
  });
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<EquipmentCategory>(CATEGORIES[0]);
  const [cameraTarget, setCameraTarget] = useState<{ category: EquipmentCategory, item: EquipmentItem | 'profile' } | null>(null);
  const [galleryItem, setGalleryItem] = useState<EquipmentItem | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<string[]>([]);
  const [history, setHistory] = useState<AppData[]>([]);
  const [showAllTimeTotals, setShowAllTimeTotals] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    CATEGORIES.forEach(cat => initial[cat] = true);
    return initial;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  const isChristmas = isChristmasPeriod();
  const formattedDate = getFormattedDate(currentDate);
  
  const currentHoliday = useMemo(() => {
    const dayMonth = `${String(currentDate.getDate()).padStart(2, '0')}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    return HOLIDAYS_SP[dayMonth];
  }, [currentDate]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    
    // Load local data first
    const savedData = localStorage.getItem('equipmentData');
    if (savedData) dispatch({ type: 'SET_DATA', payload: JSON.parse(savedData) });
    
    // Then try to fetch from server
    const fetchServerData = async () => {
        try {
            const email = userProfile.email || 'default';
            const response = await fetch(`/api/data?email=${encodeURIComponent(email)}`);
            if (response.ok) {
                const serverData = await response.json();
                if (serverData && Object.keys(serverData).length > 0) {
                    dispatch({ type: 'SET_DATA', payload: serverData });
                    localStorage.setItem('equipmentData', JSON.stringify(serverData));
                }
            }
        } catch (err) {
            console.error("Failed to fetch from server", err);
        }
    };
    
    fetchServerData();
    return () => clearTimeout(timer);
  }, []);

  // Sync with server whenever appData changes
  const syncWithServer = async () => {
      if (!navigator.onLine) {
          setSyncStatus('error');
          return;
      }
      
      setSyncStatus('syncing');
      try {
          const response = await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                email: userProfile.email || 'default',
                data: appData 
              })
          });
          
          if (response.ok) {
              setSyncStatus('success');
              setLastSync(new Date());
          } else {
              setSyncStatus('error');
              addNotification('Erro de Sincronização', 'O servidor recusou a sincronização.');
          }
      } catch (err) {
          console.error("Sync error:", err);
          setSyncStatus('error');
          addNotification('Erro de Sincronização', 'Não foi possível salvar os dados na nuvem.');
      }
  };

  // Sync with server whenever appData changes
  useEffect(() => {
    if (isLoading) return;
    
    localStorage.setItem('equipmentData', JSON.stringify(appData));
    
    const debounceTimer = setTimeout(syncWithServer, 2000);
    return () => clearTimeout(debounceTimer);
  }, [appData, isLoading]);

  useEffect(() => {
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
  }, [userProfile]);

  const currentDayData = useMemo(() => appData[formattedDate] || createEmptyDailyData(), [appData, formattedDate]);

  const handleUndo = () => {
    if (deleteMode) {
        setDeleteMode(false);
        setSelectedForDelete([]);
        return;
    }
    if (history.length > 0) {
        const lastState = history[history.length - 1];
        dispatch({ type: 'SET_DATA', payload: lastState });
        setHistory(prev => prev.slice(0, -1));
    }
  };

  const addToHistory = (state: AppData) => {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(state))]);
  };

  const handleAddItem = () => {
    addToHistory(appData);
    dispatch({ type: 'ADD_ITEM', payload: { date: formattedDate, category: activeCategory } });
    // Não expande mais automaticamente ao adicionar, para permitir que o item "suma" se estiver colapsado
    addNotification('Adição', `Novo item em ${activeCategory}`);
  };

  const handleDeleteSelected = () => {
    if (selectedForDelete.length > 0) {
        addToHistory(appData);
        dispatch({ type: 'DELETE_MULTIPLE_ITEMS', payload: { date: formattedDate, category: activeCategory, itemIds: selectedForDelete } });
        addNotification('Exclusão', `${selectedForDelete.length} itens removidos de ${activeCategory}`);
        setSelectedForDelete([]);
        setDeleteMode(false);
    }
  };

  const somaTotalGeral = useMemo(() => {
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    return Object.entries(appData).reduce((acc: number, [dateStr, day]) => {
        if (!day) return acc;
        const d = new Date(dateStr + 'T12:00:00');
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            const dayTotal = Object.values(day).flat().filter(isItemActive).length;
            return acc + dayTotal;
        }
        return acc;
    }, 0);
  }, [appData, currentDate]);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
        let count = 0;
        Object.values(appData).forEach(day => {
            if (day && day[cat]) {
                count += day[cat].filter(isItemActive).length;
            }
        });
        totals[cat] = count;
    });
    return totals;
  }, [appData]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const results: { date: string; category: EquipmentCategory; item: EquipmentItem }[] = [];
    Object.entries(appData).forEach(([date, dayData]) => {
      if (!dayData) return;
      Object.entries(dayData).forEach(([category, items]) => {
        items.forEach(item => {
          if (
            item.contract.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.serial.toLowerCase().includes(searchQuery.toLowerCase())
          ) {
            results.push({ date, category: category as EquipmentCategory, item });
          }
        });
      });
    });
    return results.sort((a, b) => b.item.createdAt! - a.item.createdAt!);
  }, [appData, searchQuery]);

  const handleCameraCapture = (data: string, type: 'qr' | 'photo') => {
    if (!cameraTarget) return;

    if (cameraTarget.item === 'profile') {
        setUserProfile(prev => ({ ...prev, profileImage: data }));
    } else {
        const item = cameraTarget.item as EquipmentItem;
        if (type === 'qr') {
            if ('vibrate' in navigator) navigator.vibrate(100);
            dispatch({ 
                type: 'UPDATE_ITEM', 
                payload: { 
                    date: formattedDate, 
                    category: cameraTarget.category, 
                    item: { ...item, serial: data } 
                } 
            });
        } else {
            dispatch({ 
                type: 'UPDATE_ITEM', 
                payload: { 
                    date: formattedDate, 
                    category: cameraTarget.category, 
                    item: { ...item, photos: [...item.photos, data] } 
                } 
            });
        }
    }
    setCameraTarget(null);
  };

  const handleImportCloud = async () => {
    if (!userProfile.email) {
      alert("Por favor, configure seu e-mail nas configurações para importar da nuvem.");
      setActiveModal('settings');
      return;
    }

    if (!confirm(`Isso irá substituir seus dados locais pelos dados salvos na nuvem para o e-mail: ${userProfile.email}. Continuar?`)) return;
    
    try {
      const email = userProfile.email || 'default';
      const response = await fetch(`/api/data?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const serverData = await response.json();
        if (serverData && Object.keys(serverData).length > 0) {
          dispatch({ type: 'SET_DATA', payload: serverData });
          localStorage.setItem('equipmentData', JSON.stringify(serverData));
          addNotification('Importação', 'Dados recuperados da nuvem');
          alert("Dados importados com sucesso!");
          setActiveModal(null);
        } else {
          alert(`Nenhum dado encontrado na nuvem para o e-mail: ${email}. Certifique-se de que você já sincronizou dados anteriormente.`);
        }
      } else {
        alert("Erro ao conectar com o servidor de backup. Por favor, tente novamente em instantes.");
      }
    } catch (err) {
      alert("Erro de conexão. Verifique sua internet e tente novamente.");
    }
  };

  if (isLoading) return <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50 z-[100]"><LoadingBoxIcon/><p className="mt-4 font-black uppercase tracking-widest text-[10px] text-slate-400 animate-pulse">Iniciando Controle...</p></div>;

  return (
    <div className="flex flex-col min-h-screen relative w-full overflow-x-hidden bg-slate-50">
      
      <div className="fixed inset-0 pointer-events-none opacity-40">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-slate-50"></div>
      </div>

      <SideMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        onMenuClick={setActiveModal} 
        userProfile={userProfile} 
        isChristmas={isChristmas} 
      />

      {isChristmas && (
          <div className="fixed top-0 left-0 right-0 h-48 pointer-events-none z-[60] overflow-hidden">
                <div className="absolute left-0 top-14 animate-[santaRide_24s_linear_infinite] flex items-center">
                    <div className="relative flex items-end">
                        <span className="text-8xl drop-shadow-[0_10px_20px_rgba(0,0,0,1)]" style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🛷</span>
                        <span className="absolute bottom-6 left-10 text-6xl drop-shadow-lg" style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🎅</span>
                        <div className="absolute bottom-8 left-18 flex items-baseline gap-0.5">
                            <span className="text-3xl drop-shadow-md">🎁</span>
                            <span className="text-2xl drop-shadow-md">📦</span>
                            <span className="text-2xl drop-shadow-md">🎁</span>
                        </div>
                        <svg className="absolute top-0 left-24 w-80 h-20 pointer-events-none overflow-visible">
                            <path d="M 0,14 Q 40,8 80,12" fill="none" stroke="#fcd34d" strokeWidth="1" strokeOpacity="0.4" />
                            <path d="M 0,17 Q 40,11 80,15" fill="none" stroke="#fcd34d" strokeWidth="1" strokeOpacity="0.4" />
                        </svg>
                    </div>
                    <div className="flex -space-x-5 items-center ml-14">
                        <span className="text-5xl drop-shadow-2xl" style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🦌</span>
                        <span className="text-5xl drop-shadow-2xl" style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🦌</span>
                        <span className="text-5xl drop-shadow-2xl" style={{ transform: 'scaleX(-1)', display: 'inline-block' }}>🦌</span>
                    </div>
                </div>
          </div>
      )}

      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-slate-200 px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div onClick={() => setIsMenuOpen(true)} className="active:scale-95 transition-all cursor-pointer">
                    {userProfile.profileImage ? (
                        <div className="w-12 h-12 rounded-full border-2 border-slate-200 overflow-hidden shadow-sm">
                            <img src={userProfile.profileImage} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <CustomMenuIcon className="w-12 h-12 drop-shadow-md" isChristmas={isChristmas}/>
                    )}
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                        <h1 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Controle</h1>
                        {syncStatus === 'syncing' && <IconCloud className="w-2.5 h-2.5 text-blue-500 animate-pulse"/>}
                        {syncStatus === 'success' && <IconCloud className="w-2.5 h-2.5 text-green-500"/>}
                        {syncStatus === 'error' && <IconCloud className="w-2.5 h-2.5 text-red-500"/>}
                    </div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[3px]">Equipamentos</span>
                </div>
            </div>
            
            <div className="flex gap-1 items-center">
                <button 
                    onClick={handleAddItem} 
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-linear-to-r from-blue-600 to-blue-500 text-white border border-blue-500 active:scale-95 shadow-sm transition-all"
                >
                    <IconPlus className="w-3.5 h-3.5"/>
                </button>
                <button 
                    onClick={() => {
                        if (deleteMode) {
                            if (selectedForDelete.length > 0) {
                                handleDeleteSelected();
                            } else {
                                setDeleteMode(false);
                                setSelectedForDelete([]);
                            }
                        } else {
                            setDeleteMode(true);
                        }
                    }} 
                    className={`w-8 h-8 rounded-full flex items-center justify-center border active:scale-95 shadow-sm transition-all ${deleteMode ? 'bg-red-500 text-white border-red-400' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
                >
                    {deleteMode && selectedForDelete.length > 0 ? <IconTrash className="w-3.5 h-3.5"/> : <IconMinus className="w-3.5 h-3.5"/>}
                </button>
                <button 
                    onClick={handleUndo} 
                    disabled={!deleteMode && history.length === 0}
                    className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 border border-slate-200 active:scale-95 shadow-sm transition-all ${(!deleteMode && history.length === 0) ? 'opacity-30' : ''}`}
                >
                    <IconUndo className="w-3.5 h-3.5"/>
                </button>
                <button onClick={() => setActiveModal('search')} className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 border border-slate-200 active:scale-95 shadow-sm transition-all">
                    <IconSearch className="w-3.5 h-3.5"/>
                </button>
                <button 
                    onClick={() => {
                        setActiveModal('notifications');
                        setHasNewNotifications(false);
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 border border-slate-200 active:scale-95 shadow-sm transition-all relative"
                >
                    <IconBell className="w-3.5 h-3.5"/>
                    {hasNewNotifications && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
                    )}
                </button>
            </div>
        </div>

        <div className="flex flex-col items-center mb-6 relative gap-2">
            <div className="flex items-center gap-2">
                <button onClick={() => setActiveModal('calendar')} className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200 active:scale-95 transition-all shadow-sm">
                    <span className="font-black text-[12px] tracking-[2px] text-slate-700">
                        {currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                </button>
                {currentHoliday && (
                    <button 
                        onClick={() => {
                            setSelectedHoliday(currentHoliday);
                            setActiveModal('holiday_info');
                        }}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce-slow active:scale-90 transition-all ${currentHoliday.color}`}
                    >
                        <span className="text-lg">{currentHoliday.icon}</span>
                    </button>
                )}
            </div>

            {currentHoliday && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className={`text-[7px] font-black uppercase tracking-[2px] ${currentHoliday.color.replace('bg-', 'text-')}`}>
                        {currentHoliday.name}
                    </span>
                </div>
            )}
        </div>

        {/* Seletor de Categorias Horizontal */}
        <div className="relative">
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-3 px-2 -mx-2">
                {CATEGORIES.map(cat => {
                    const Icon = getCategoryIcon(cat);
                    return (
                        <button 
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`flex flex-col items-center gap-1.5 min-w-[60px] p-2 rounded-[1.2rem] transition-all active:scale-95 relative ${activeCategory === cat ? 'bg-linear-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-100 text-slate-400'}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${activeCategory === cat ? 'bg-white/20' : 'bg-white/50'}`}>
                                <Icon className="w-4 h-4"/>
                            </div>
                            <span className="text-[6px] font-black uppercase tracking-[1px] whitespace-nowrap">{cat}</span>
                            <CountBadge count={appData[formattedDate]?.[cat]?.filter(isItemActive).length || 0} />
                        </button>
                    );
                })}
            </div>
        </div>
      </header>

      <main className="flex-1 px-4 space-y-4 mt-6 pb-48 relative z-10">
          <div 
            onClick={() => setCollapsedCategories(prev => ({ ...prev, [activeCategory]: !prev[activeCategory] }))}
            className={`flex items-center justify-center px-6 py-3.5 rounded-[1.5rem] shadow-lg transition-all duration-500 cursor-pointer active:scale-[0.98] mb-4 ${
                collapsedCategories[activeCategory] 
                ? 'bg-white border border-slate-100' 
                : 'bg-gradient-to-r from-blue-600 to-blue-400 text-white'
            }`}
          >
              <div className="flex items-center gap-3">
                  <span className={`text-[16px] font-black uppercase tracking-[1px] ${collapsedCategories[activeCategory] ? 'text-slate-800' : 'text-white'}`}>
                      {activeCategory}
                  </span>
              </div>
          </div>

          <div className="mb-4"></div>

          <EquipmentSection 
            category={activeCategory} 
            items={collapsedCategories[activeCategory] 
                ? [currentDayData[activeCategory][currentDayData[activeCategory].length - 1]]
                : currentDayData[activeCategory]
            } 
            onUpdate={(item: any) => {
                addToHistory(appData);
                dispatch({ type: 'UPDATE_ITEM', payload: { date: formattedDate, category: activeCategory, item } });
            }}
            onAddItem={handleAddItem}
            onCollapse={() => setCollapsedCategories(prev => ({ ...prev, [activeCategory]: true }))}
            onDelete={(id: string) => {
                addToHistory(appData);
                dispatch({ type: 'DELETE_SINGLE_ITEM', payload: { date: formattedDate, category: activeCategory, itemId: id } });
            }}
            onGallery={setGalleryItem}
            onCamera={(item: any) => setCameraTarget({ category: activeCategory, item })}
            deleteMode={deleteMode}
            selectedForDelete={selectedForDelete}
            onToggleSelect={(id: string) => setSelectedForDelete(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
            isChristmas={isChristmas}
          />

          {collapsedCategories[activeCategory] && currentDayData[activeCategory].filter(isItemActive).length > 0 && (
              <div className="mt-4 p-4 rounded-[2rem] bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 opacity-60">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-[2px]">
                      {currentDayData[activeCategory].filter(isItemActive).length} itens concluídos ocultos
                  </span>
                  <button 
                    onClick={() => setCollapsedCategories(prev => ({ ...prev, [activeCategory]: false }))}
                    className="text-[7px] font-black text-blue-500 uppercase tracking-widest underline underline-offset-4"
                  >
                      Expandir para ver todos
                  </button>
              </div>
          )}
          
          <div className="flex flex-col items-center justify-center pt-10 pb-20 opacity-20">
              <span className="text-[6px] font-black text-slate-400 uppercase tracking-[4px]">Controle Box v1.0.4</span>
              <span className="text-[5px] font-black text-slate-300 uppercase tracking-[2px] mt-1">Build 20260302-1735</span>
          </div>
      </main>

      {/* Rodapé customizado conforme solicitado */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 border-t border-slate-200 p-4 pb-10 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] backdrop-blur-3xl max-w-[480px] mx-auto w-full">
          <div className="flex items-center justify-between">
              {/* Contagens individuais */}
              <div className="flex gap-3 overflow-x-auto no-scrollbar flex-1 pr-4">
                  {CATEGORIES.map(cat => {
                      const Icon = getCategoryIcon(cat);
                      const count = showAllTimeTotals ? categoryTotals[cat] : (currentDayData[cat] || []).filter(isItemActive).length;
                      return (
                        <div key={cat} className={`flex flex-col items-center min-w-[32px] transition-all ${activeCategory === cat ? 'scale-110' : 'opacity-30'}`}>
                            <Icon className={`w-4 h-4 mb-1 ${activeCategory === cat ? 'text-blue-600' : 'text-slate-400'}`}/>
                            <span className={`text-[10px] font-black ${activeCategory === cat ? 'text-blue-600' : 'text-slate-500'}`}>
                                {count}
                            </span>
                        </div>
                      );
                  })}
              </div>
              
              <div className="h-10 w-px bg-slate-200 shrink-0"></div>

              {/* Totais */}
              <div className="flex items-center gap-4 pl-4 shrink-0">
                <div className="flex flex-col items-center min-w-[40px]">
                    <span className="text-[7px] font-black text-blue-600 uppercase tracking-widest mb-1">Dia</span>
                    <span className="text-xl font-black leading-none text-blue-600">
                        {Object.values(currentDayData).flat().filter(isItemActive).length}
                    </span>
                </div>
                <button 
                    onClick={() => setShowAllTimeTotals(!showAllTimeTotals)}
                    className="flex flex-col items-center active:scale-95 transition-transform"
                >
                    <span className={`text-[7px] font-black uppercase tracking-widest mb-1 transition-colors ${showAllTimeTotals ? 'text-purple-600' : 'text-purple-400'}`}>
                        {showAllTimeTotals ? 'Voltar' : 'Mês'}
                    </span>
                    <div className={`rounded-2xl px-5 py-2.5 border transition-all duration-500 ${showAllTimeTotals ? 'bg-purple-600 text-white border-purple-400 shadow-[0_5px_15px_rgba(168,85,247,0.3)]' : 'bg-purple-50 text-purple-600 border-purple-200 shadow-sm backdrop-blur-xl'}`}>
                        <span className="text-xl font-black leading-none">
                            {somaTotalGeral}
                        </span>
                    </div>
                </button>
              </div>
          </div>
      </footer>

      {galleryItem && <PhotoGalleryModal item={galleryItem} onClose={() => setGalleryItem(null)} />}
      
      {cameraTarget && (
        <CameraModal 
          target={cameraTarget.item} 
          onClose={() => setCameraTarget(null)} 
          onCapture={handleCameraCapture}
        />
      )}

      {/* MODAIS REVERTIDOS PARA O DESIGN ORIGINAL */}
      
      {activeModal === 'search' && (
          <Modal title="Pesquisar" onClose={() => setActiveModal(null)}>
              <div className="space-y-4">
                  <div className="relative">
                      <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                      <input 
                        type="text" 
                        autoFocus
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Contrato ou Serial..."
                        className="w-full py-4 pl-12 pr-6 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-black text-sm text-slate-800 focus:bg-white transition-all shadow-inner"
                      />
                  </div>
                  <div className="max-h-[350px] overflow-y-auto space-y-2 no-scrollbar">
                      {searchResults.length > 0 ? (
                          searchResults.map((res, i) => (
                              <button 
                                key={i} 
                                onClick={() => {
                                    setCurrentDate(new Date(res.date + 'T12:00:00'));
                                    setActiveCategory(res.category);
                                    setActiveModal(null);
                                }}
                                className="w-full text-left p-4 rounded-2xl bg-white border border-slate-100 flex flex-col gap-1 active:scale-[0.98] transition-all hover:bg-slate-50 shadow-sm"
                              >
                                  <div className="flex justify-between items-center">
                                      <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest">{res.category}</span>
                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                          {new Date(res.date + 'T12:00:00').toLocaleDateString('pt-BR')} - {new Date(res.item.createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                  </div>
                                  <p className="text-xs font-black text-slate-800">CTR: {res.item.contract || '---'}</p>
                                  <p className="text-[10px] font-black text-slate-400 truncate">SN: {res.item.serial || '---'}</p>
                              </button>
                          ))
                      ) : searchQuery ? (
                          <p className="text-center py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhum resultado</p>
                      ) : (
                          <p className="text-center py-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">Digite para buscar</p>
                      )}
                  </div>
              </div>
          </Modal>
      )}

      {activeModal === 'calendar' && (
          <Modal title="Selecionar Data" onClose={() => setActiveModal(null)} hideHeader={true} padding="p-6">
              <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                      <button 
                        onClick={() => {
                            const d = new Date(currentDate);
                            d.setMonth(d.getMonth() - 1);
                            setCurrentDate(d);
                        }}
                        className="p-2 rounded-xl bg-slate-100 text-slate-600 active:scale-95 transition-all"
                      >
                          <IconChevronLeft className="w-5 h-5"/>
                      </button>
                      <span className="font-black uppercase text-[10px] tracking-[4px] text-slate-800">
                          {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </span>
                      <button 
                        onClick={() => {
                            const d = new Date(currentDate);
                            d.setMonth(d.getMonth() + 1);
                            setCurrentDate(d);
                        }}
                        className="p-2 rounded-xl bg-slate-100 text-slate-600 active:scale-95 transition-all"
                      >
                          <IconChevronRight className="w-5 h-5"/>
                      </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                          <div key={d} className="h-8 flex items-center justify-center text-[8px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
                      ))}
                      {(() => {
                          const year = currentDate.getFullYear();
                          const month = currentDate.getMonth();
                          const firstDay = new Date(year, month, 1).getDay();
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const days = [];
                          for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} />);
                          for (let day = 1; day <= daysInMonth; day++) {
                              const d = new Date(year, month, day);
                              const dateStr = getFormattedDate(d);
                              const isToday = getFormattedDate(new Date()) === dateStr;
                              const isSelected = getFormattedDate(currentDate) === dateStr;
                              const dayMonth = `${String(day).padStart(2, '0')}-${String(month + 1).padStart(2, '0')}`;
                              const holiday = HOLIDAYS_SP[dayMonth];
                              
                              const hasItems = appData[dateStr] && Object.values(appData[dateStr]).some((catItems: any) => Array.isArray(catItems) && catItems.some(isItemActive));

                              days.push(
                                <button 
                                    key={day} 
                                    onClick={() => { 
                                        setCurrentDate(d);
                                        if (holiday) {
                                            setSelectedHoliday(holiday);
                                            setActiveModal('holiday_info');
                                        } else {
                                            setActiveModal(null);
                                        }
                                    }} 
                                    className={`h-11 rounded-2xl font-black text-[11px] transition-all relative flex flex-col items-center justify-center ${
                                        isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 scale-105 z-20' : 
                                        holiday ? `${holiday.color} text-white shadow-md ${holiday.type === 'holiday' ? 'ring-2 ring-white/40' : 'ring-1 ring-white/20'}` :
                                        isToday ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-100' : 'bg-slate-50 text-slate-500 active:bg-slate-100'
                                    }`}
                                >
                                    <span className="relative z-10">{day}</span>
                                    {holiday && (
                                        <span className={`absolute inset-0 rounded-2xl border-2 ${holiday.type === 'holiday' ? 'border-white/40' : 'border-white/20'}`} />
                                    )}
                                    {holiday && (
                                        <span className="absolute top-1 right-1 text-[10px] leading-none">{holiday.icon}</span>
                                    )}
                                    {hasItems && !isSelected && (
                                        <div className={`absolute bottom-1.5 w-1 h-1 rounded-full ${holiday ? 'bg-white' : 'bg-blue-500'}`} />
                                    )}
                                </button>
                              );
                          }
                          return days;
                      })()}
                  </div>
              </div>
          </Modal>
      )}

      {activeModal === 'settings' && (
          <Modal title="Configurações" onClose={() => setActiveModal(null)}>
              <div className="space-y-6">
                  <div className="flex flex-col items-center mb-4">
                      <div 
                        onClick={() => setCameraTarget({ category: activeCategory, item: 'profile' })}
                        className="relative w-24 h-24 rounded-full bg-white/5 border-2 border-white/10 overflow-hidden cursor-pointer group"
                      >
                          {userProfile.profileImage ? (
                              <img src={userProfile.profileImage} className="w-full h-full object-cover" />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                  <IconCamera className="w-8 h-8 text-slate-600"/>
                              </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <IconCameraLens className="w-6 h-6 text-white"/>
                          </div>
                      </div>
                      <p className="mt-2 text-[8px] font-black text-slate-500 uppercase tracking-widest">Foto de Perfil</p>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-[4px] mb-2 block">Nome de Usuário</label>
                          <input 
                            type="text" 
                            value={userProfile.name} 
                            onChange={e => setUserProfile({...userProfile, name: e.target.value})}
                            className="w-full py-4 px-6 rounded-2xl bg-slate-50 border-none outline-none font-black text-sm text-slate-800 focus:bg-slate-100 transition-all"
                            placeholder="Ex: Leo Luz"
                          />
                      </div>
                      <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-[4px] mb-2 block">CPF</label>
                          <input 
                            type="text" 
                            value={userProfile.cpf || ''} 
                            onChange={e => setUserProfile({...userProfile, cpf: e.target.value})}
                            className="w-full py-4 px-6 rounded-2xl bg-slate-50 border-none outline-none font-black text-sm text-slate-800 focus:bg-slate-100 transition-all"
                            placeholder="000.000.000-00"
                          />
                      </div>
                      <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-[4px] mb-2 block">E-mail para Backup</label>
                          <input 
                            type="email" 
                            value={userProfile.email || ''} 
                            onChange={e => setUserProfile({...userProfile, email: e.target.value})}
                            className="w-full py-4 px-6 rounded-2xl bg-slate-50 border-none outline-none font-black text-sm text-slate-800 focus:bg-slate-100 transition-all"
                            placeholder="seu@email.com"
                          />
                      </div>
                  </div>
                  <div className="pt-4 space-y-3">
                      <button onClick={() => setActiveModal(null)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[3px] text-[10px] active:scale-95 transition-all shadow-xl shadow-blue-600/20">
                          Salvar Perfil
                      </button>
                      <button 
                        onClick={() => {
                            if (confirm("Tem certeza que deseja apagar todos os dados? Esta ação é irreversível.")) {
                                localStorage.removeItem('equipmentData');
                                dispatch({ type: 'SET_DATA', payload: {} });
                                setActiveModal(null);
                            }
                        }}
                        className="w-full py-4 bg-red-600/10 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase tracking-[3px] text-[10px] active:scale-95 transition-all"
                      >
                          Limpar Todos os Dados
                      </button>
                  </div>
              </div>
          </Modal>
      )}

      {activeModal === 'export' && (
          <Modal title="Relatórios e Backup" onClose={() => setActiveModal(null)}>
              <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => {
                          const dataStr = JSON.stringify(appData);
                          const blob = new Blob([dataStr], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `backup_equipamentos_${formattedDate}.json`;
                          link.click();
                      }} className="py-5 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all group">
                          <IconDownload className="w-5 h-5 text-cyan-500 group-hover:scale-110 transition-transform"/>
                          <span className="font-black uppercase text-[8px] tracking-[2px] text-slate-300">Exportar JSON</span>
                      </button>
                      <div className="relative">
                          <button className="w-full h-full py-5 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-95 transition-all group">
                              <IconExport className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform"/>
                              <span className="font-black uppercase text-[8px] tracking-[2px] text-slate-300">Importar JSON</span>
                          </button>
                          <input 
                            type="file" 
                            accept=".json" 
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        try {
                                            const json = JSON.parse(event.target?.result as string);
                                            dispatch({ type: 'SET_DATA', payload: json });
                                            setActiveModal(null);
                                        } catch (err) { alert("Arquivo inválido"); }
                                    };
                                    reader.readAsText(file);
                                }
                            }}
                          />
                      </div>
                  </div>

                  <button 
                    onClick={handleImportCloud}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg shadow-blue-600/20 group"
                  >
                    <IconCloud className="w-5 h-5 text-white group-hover:scale-110 transition-transform"/>
                    <span className="font-black uppercase text-[9px] tracking-[2px]">Puxar Backup da Nuvem</span>
                  </button>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                      <div className="flex justify-between items-center">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-[2px]">Status da Nuvem</span>
                          <div className="flex items-center gap-2">
                              {syncStatus === 'syncing' && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>}
                              {syncStatus === 'success' && <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>}
                              {syncStatus === 'error' && <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>}
                              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                                  {syncStatus === 'idle' && 'Pronto'}
                                  {syncStatus === 'syncing' && 'Sincronizando...'}
                                  {syncStatus === 'success' && 'Sincronizado'}
                                  {syncStatus === 'error' && 'Erro na Sincronização'}
                              </span>
                          </div>
                      </div>
                      {lastSync && (
                          <div className="flex justify-between items-center">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[2px]">Última Sincronização</span>
                              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                                  {lastSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                          </div>
                      )}
                      <button 
                        onClick={syncWithServer}
                        disabled={syncStatus === 'syncing'}
                        className="w-full py-2 bg-white border border-slate-200 rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
                      >
                        Sincronizar Agora
                      </button>
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-[2px] text-center leading-relaxed">
                          Seus dados são salvos automaticamente em nosso servidor seguro vinculado ao seu e-mail.
                      </p>
                  </div>

                  <div className="h-px bg-slate-100 my-2"></div>
                  
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[4px] text-center mb-2">Link de Acesso</p>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-2">
                      <div className="flex flex-col gap-1.5">
                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-[2px]">URL do Aplicativo</span>
                          <div className="flex items-center gap-2">
                              <input 
                                  readOnly 
                                  value={window.location.origin} 
                                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[8px] font-mono text-slate-600 outline-none"
                              />
                              <button 
                                  onClick={() => {
                                      navigator.clipboard.writeText(window.location.origin);
                                      addNotification('Copiado!', 'Link copiado para a área de transferência.');
                                  }}
                                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-blue-500 active:scale-95 transition-all"
                              >
                                  <IconCopy className="w-3 h-3"/>
                              </button>
                          </div>
                          <p className="text-[6px] font-black text-slate-400 uppercase tracking-[1px] leading-tight mt-1">
                              Dica: Se não atualizar no celular, tente fechar a aba e abrir novamente ou limpar o cache do navegador.
                          </p>
                      </div>
                  </div>

                  <div className="flex justify-between items-center px-2 mb-2">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-[2px]">Versão do App</span>
                      <span className="text-[7px] font-black text-slate-500 uppercase tracking-[1px]">v1.0.4 (Build 20260302)</span>
                  </div>

                  <div className="h-px bg-slate-100 my-2"></div>
                  
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[4px] text-center mb-2">Relatórios Mensal</p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-2">
                      <button 
                        onClick={() => {
                            const text = generateMonthlyReport(appData, currentDate);
                            const blob = new Blob([text], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `relatorio_${currentDate.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}.txt`;
                            link.click();
                        }}
                        className="py-3 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                          <IconDownload className="w-4 h-4 text-slate-600"/>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Baixar TXT</span>
                      </button>
                      <button 
                        onClick={() => {
                            const text = generateMonthlyReport(appData, currentDate);
                            const doc = new jsPDF();
                            const lines = doc.splitTextToSize(text, 180);
                            doc.setFontSize(10);
                            doc.text(lines, 10, 10);
                            doc.save(`relatorio_${currentDate.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}.pdf`);
                        }}
                        className="py-3 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                          <IconExport className="w-4 h-4 text-red-500"/>
                          <span className="text-[8px] font-black uppercase tracking-widest text-red-500">Baixar PDF</span>
                      </button>
                  </div>

                  <button 
                    onClick={() => {
                        const text = generateMonthlyReport(appData, currentDate);
                        if (navigator.share) {
                            navigator.share({
                                title: 'Relatório de Equipamentos',
                                text: text
                            }).catch(console.error);
                        } else {
                            alert("Compartilhamento nativo não suportado neste navegador. Use os botões abaixo.");
                        }
                    }}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg mb-2"
                  >
                      <IconShare className="w-4 h-4 text-white"/>
                      <span className="font-black uppercase text-[9px] tracking-[3px]">Compartilhar Relatório</span>
                  </button>

                  <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => {
                            const text = generateMonthlyReport(appData, currentDate);
                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                        }}
                        className="py-4 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                      >
                          <IconWhatsapp className="w-5 h-5 text-emerald-500"/>
                      </button>
                      <button 
                        onClick={() => {
                            const text = generateMonthlyReport(appData, currentDate);
                            window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`);
                        }}
                        className="py-4 bg-sky-600/10 border border-sky-500/20 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                      >
                          <IconTelegram className="w-5 h-5 text-sky-500"/>
                      </button>
                      <button 
                        onClick={() => {
                            const subject = `Relatório de Equipamentos - ${currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
                            const body = generateMonthlyReport(appData, currentDate);
                            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                        }}
                        className="py-4 bg-slate-600/10 border border-slate-500/20 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                      >
                          <IconEmail className="w-5 h-5 text-slate-400"/>
                      </button>
                  </div>
              </div>
          </Modal>
      )}

      {activeModal === 'holiday_info' && selectedHoliday && (
          <Modal title="Informação" onClose={() => setActiveModal(null)} padding="p-6">
              <div className="text-center py-2">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-3xl shadow-lg ${selectedHoliday.color}`}>
                      {selectedHoliday.icon}
                  </div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">{selectedHoliday.name}</h3>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[4px] mb-4">
                      {selectedHoliday.type === 'holiday' ? 'Feriado Oficial' : 'Data Comemorativa'}
                  </p>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-600 leading-relaxed italic">
                          "{selectedHoliday.description}"
                      </p>
                  </div>
                  <button 
                    onClick={() => setActiveModal(null)}
                    className="mt-6 w-full py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all"
                  >
                      Entendi
                  </button>
              </div>
          </Modal>
      )}
      {activeModal === 'notifications' && (
          <Modal title="Atividades do Dia" onClose={() => setActiveModal(null)}>
              <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                  {notifications.length > 0 ? (
                      notifications.map(notif => (
                          <div key={notif.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                              <div className={`w-2 h-2 rounded-full ${notif.type === 'Adição' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <div className="flex-1">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{notif.type}</span>
                                      <span className="text-[8px] font-black text-slate-400">{notif.time}</span>
                                  </div>
                                  <p className="text-[11px] font-black text-slate-500">{notif.details}</p>
                              </div>
                          </div>
                      ))
                  ) : (
                      <div className="text-center py-10">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhuma atividade registrada</p>
                      </div>
                  )}
              </div>
          </Modal>
      )}
      {activeModal === 'about' && (
          <Modal title="Sobre o App" onClose={() => setActiveModal(null)}>
              <div className="text-center py-4">
                  <CustomMenuIcon className="w-24 h-24 mx-auto mb-8 drop-shadow-2xl" isChristmas={isChristmas}/>
                  <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-2">Stream+ Control</h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[6px] mb-10">Versão 1.0.3</p>
                  <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-[4px] mb-2">Desenvolvido por</p>
                      <p className="text-xl font-black text-blue-600 uppercase tracking-tighter">Leo Luz</p>
                  </div>
              </div>
          </Modal>
      )}

    </div>
  );
};

const CountBadge = ({ count }: { count: number }) => {
    const [prevCount, setPrevCount] = useState(count);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (count > prevCount) {
            setIsAnimating(true);
            const timer = setTimeout(() => setIsAnimating(false), 800);
            setPrevCount(count);
            return () => clearTimeout(timer);
        } else if (count < prevCount) {
            setPrevCount(count);
        }
    }, [count, prevCount]);

    if (count === 0) return null;

    return (
        <div className={`absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full flex items-center justify-center font-black text-[7px] transition-all duration-300 ${
            isAnimating 
            ? 'bg-green-400 text-white shadow-[0_0_12px_#4ade80] scale-125 z-10' 
            : 'bg-green-500 text-white shadow-sm'
        }`}>
            {count}
        </div>
    );
};

const EquipmentItemRow = ({ item, onUpdate, onDelete, onGallery, onCamera, deleteMode, selectedForDelete, onToggleSelect, isChristmas, onAddItem, onCollapse }: any) => {
    const serialRef = useRef<HTMLInputElement>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleContractChange = (val: string) => {
        if (val.length <= 10) {
            onUpdate({ ...item, contract: val });
            if (val.length === 10) {
                serialRef.current?.focus();
            }
        }
    };

    const handleContractPaste = (e: React.ClipboardEvent) => {
        const pastedData = e.clipboardData.getData('text');
        onUpdate({ ...item, contract: pastedData });
        // Jump to serial immediately on paste regardless of length
        setTimeout(() => {
            serialRef.current?.focus();
        }, 50);
    };

    const finishItem = () => {
        // Blur keyboard
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Collapse the whole category to show only the new one
        onCollapse();
        // Collapse this item visually
        setIsCollapsed(true);
        // Add new item
        setTimeout(() => {
            onAddItem();
        }, 300);
    };

    const handleSerialChange = (val: string) => {
        if (val.length <= 20) {
            onUpdate({ ...item, serial: val });
            if (val.length === 20) {
                finishItem();
            }
        }
    };

    const handleSerialPaste = (e: React.ClipboardEvent) => {
        const pastedData = e.clipboardData.getData('text');
        onUpdate({ ...item, serial: pastedData });
        // Finish item immediately on paste regardless of length
        setTimeout(() => {
            finishItem();
        }, 50);
    };

    const variants = {
        hidden: { 
            opacity: 0, 
            height: 0,
            y: -20,
            scale: 0.95,
            marginBottom: 0,
            overflow: 'hidden'
        },
        visible: { 
            opacity: isCollapsed ? 0.5 : 1, 
            height: 'auto',
            y: 0,
            scale: isCollapsed ? 0.98 : 1,
            marginBottom: 8,
            transition: {
                height: { type: 'spring', stiffness: 500, damping: 40 },
                opacity: { duration: 0.2 },
                y: { type: 'spring', stiffness: 400, damping: 30 }
            }
        },
        exit: { 
            opacity: 0, 
            height: 0,
            y: -20,
            scale: 0.9,
            marginBottom: 0,
            transition: {
                height: { duration: 0.3 },
                opacity: { duration: 0.2 }
            }
        }
    };

    return (
        <motion.div 
            layout
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex gap-1.5 w-full"
        >
            <div className={`flex-1 p-2 rounded-[1.2rem] border shadow-sm flex flex-col gap-2 transition-all duration-500 ${deleteMode && selectedForDelete?.includes(item.id) ? 'bg-red-50 border-red-100' : 'bg-white/40 border-slate-100/50 backdrop-blur-sm'}`}>
                <div className="flex gap-1.5 items-center">
                    {deleteMode && (
                        <button 
                            onClick={() => onToggleSelect(item.id)}
                            className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${selectedForDelete?.includes(item.id) ? 'bg-red-500 border-red-400 text-white' : 'bg-slate-50 border-slate-200 text-transparent'}`}
                        >
                            <IconTrash className="w-3 h-3"/>
                        </button>
                    )}
                    
                    <div className="min-w-[35px] flex flex-col items-center justify-center opacity-30">
                        <span className="text-[8px] font-black text-slate-500">
                            {new Date(item.createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>

                    <div className="flex-1 flex flex-col gap-1.5">
                        <div className="flex gap-1">
                            <div className="flex flex-col gap-1 flex-[0.35]">
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        placeholder="CONTRATO" 
                                        value={item.contract} 
                                        onChange={e => handleContractChange(e.target.value)}
                                        onPaste={handleContractPaste}
                                        className="w-full py-2 px-1 rounded-lg border border-slate-100 outline-none font-black text-[12px] bg-white text-slate-800 placeholder-slate-300 focus:border-blue-200 transition-all text-center shadow-sm"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-1 flex-[0.65]">
                                <div className="relative">
                                    <input 
                                        ref={serialRef}
                                        type="text" 
                                        placeholder="SERIAL" 
                                        value={item.serial} 
                                        onChange={e => handleSerialChange(e.target.value)}
                                        onPaste={handleSerialPaste}
                                        className="w-full py-2 px-1 rounded-lg border border-slate-100 outline-none font-black text-[12px] bg-white text-slate-800 placeholder-slate-300 focus:border-blue-200 transition-all text-center shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-1">
                                <button onClick={() => onCamera(item)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#111827] text-white active:scale-95 transition-all shadow-md">
                                    <IconCameraLens className="w-4 h-4"/>
                                </button>
                                <button onClick={() => onGallery(item)} className={`w-8 h-8 flex items-center justify-center rounded-lg active:scale-95 transition-all border ${item.photos.length > 0 ? 'bg-green-50 text-green-600 border-green-100' : 'bg-white text-slate-300 border-slate-100 shadow-sm'}`}>
                                    <div className="relative">
                                        <IconGallery className="w-4 h-4"/>
                                        <CountBadge count={item.photos.length} />
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const EquipmentSection = ({ category, items, onUpdate, onDelete, onGallery, onCamera, deleteMode, selectedForDelete, onToggleSelect, isChristmas, onAddItem, onCollapse }: any) => {
    const sortedItems = [...items].sort((a, b) => {
        const aActive = isItemActive(a);
        const bActive = isItemActive(b);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return (a.createdAt || 0) - (b.createdAt || 0);
    });

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.1
            }
        },
        exit: {
            opacity: 0,
            transition: {
                staggerChildren: 0.05,
                staggerDirection: -1,
                when: "afterChildren"
            }
        }
    };

    return (
        <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-2 w-full"
        >
            <AnimatePresence mode="popLayout">
                {sortedItems.map((item: any) => (
                    <EquipmentItemRow 
                        key={item.id}
                        item={item}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                        onGallery={onGallery}
                        onCamera={onCamera}
                        deleteMode={deleteMode}
                        selectedForDelete={selectedForDelete}
                        onToggleSelect={onToggleSelect}
                        isChristmas={isChristmas}
                        onAddItem={onAddItem}
                        onCollapse={onCollapse}
                    />
                ))}
            </AnimatePresence>
        </motion.div>
    );
};

const PhotoGalleryModal = ({ item, onClose }: any) => (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col p-6">
        <div className="flex justify-between items-center mb-10">
            <span className="font-black text-slate-400 text-[10px] uppercase tracking-[12px] opacity-40">GALERIA</span>
            <button onClick={onClose} className="p-4 bg-slate-200 rounded-full text-slate-600 active:scale-95 transition-all"><IconX className="w-7 h-7"/></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar pb-24">
            {item.photos.map((p: any, i: any) => (
                <div key={i} className="aspect-video rounded-[2.5rem] overflow-hidden bg-white border border-slate-100 shadow-xl">
                    <img src={p} className="w-full h-full object-contain" alt={`Equipment ${i}`} />
                </div>
            ))}
        </div>
    </div>
);

const Modal = ({ title, children, onClose, hideHeader = false, padding = "p-5" }: any) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-sm bg-white border border-slate-100 rounded-[3rem] shadow-2xl animate-pop-in overflow-hidden">
            <div className={`${padding}`}>
                {!hideHeader && (
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-black uppercase tracking-[5px] text-[9px] text-slate-400">{title}</h3>
                        <button onClick={onClose} className="p-2 rounded-xl bg-slate-50 active:scale-95 transition-all text-slate-400"><IconX className="w-4 h-4"/></button>
                    </div>
                )}
                {children}
            </div>
        </div>
    </div>
);

const App = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

export default App;
