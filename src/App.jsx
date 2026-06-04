import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, Settings, X, Image as ImageIcon, Mail, Check, ArrowRight, FileWarning, ExternalLink, ChevronLeft, Instagram, ClipboardList, Edit3, Lock, ChevronRight as ChevronRightIcon, ChevronLeft as ChevronLeftIcon, Star } from 'lucide-react';

const firebaseConfig = {"apiKey":"AIzaSyDnSjaTCJ6Up-rrKMrLd-5JBnj5HYZaIpQ","authDomain":"photography-portfolio-38dc2.firebaseapp.com","projectId":"photography-portfolio-38dc2","storageBucket":"photography-portfolio-38dc2.firebasestorage.app","messagingSenderId":"308464683617","appId":"1:308464683617:web:9dc6e34a77b3219b523820"};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'photography-portfolio';

const transformImageUrl = (url) => {
  if (!url) return '';
  const trimmedUrl = String(url).trim();
  if (trimmedUrl.includes('drive.google.com')) {
    const match = trimmedUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmedUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w2000`;
  }
  return trimmedUrl;
};

const ImageItem = ({ img, isEditing, onRemove, onExpand, onMove, isFirst, isLast, onSetCover, isCover }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const displayUrl = transformImageUrl(img?.url);
  return (
    <div className="mb-8 break-inside-avoid group relative bg-zinc-50 overflow-hidden rounded-sm border border-zinc-100 transition-all hover:shadow-xl">
      {!isLoaded && !hasError && (<div className="w-full aspect-[3/2] bg-zinc-50 animate-pulse flex items-center justify-center"><div className="w-6 h-6 border-2 border-zinc-100 border-t-zinc-300 rounded-full animate-spin"></div></div>)}
      {hasError ? (
        <div className="flex flex-col items-center justify-center bg-zinc-50 p-8 text-center min-h-[200px]">
          <FileWarning className="text-zinc-300 mb-3" size={28} />
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">圖片載入失敗</p>
          <a href={img?.url} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 text-[9px] bg-white border border-zinc-200 px-3 py-1.5 rounded-full hover:bg-zinc-100 transition shadow-sm uppercase font-bold"><ExternalLink size={10} /><span>在新視窗開啟</span></a>
        </div>
      ) : (
        <img src={displayUrl} className={`w-full h-auto block transition-all duration-1000 group-hover:scale-105 cursor-pointer ${isLoaded ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setIsLoaded(true)} onError={() => setHasError(true)} onClick={() => onExpand()} loading="lazy" alt="" />
      )}
      {isEditing && (
        <div className="absolute top-4 right-4 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-all z-10">
          <button onClick={(e) => { e.stopPropagation(); onSetCover(); }} className={`p-2 rounded-full shadow-md transition-colors ${isCover ? 'bg-zinc-900 text-yellow-400' : 'bg-white/90 text-zinc-400 hover:text-zinc-900'}`} title={isCover ? "目前封面" : "設為封面"}><Star size={16} fill={isCover ? "currentColor" : "none"} /></button>
          {!isFirst && <button onClick={(e) => { e.stopPropagation(); onMove(-1); }} className="bg-white/90 p-2 rounded-full text-zinc-600 hover:text-black shadow-md"><ChevronLeftIcon size={16} /></button>}
          {!isLast && <button onClick={(e) => { e.stopPropagation(); onMove(1); }} className="bg-white/90 p-2 rounded-full text-zinc-600 hover:text-black shadow-md"><ChevronRightIcon size={16} /></button>}
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="bg-white/90 p-2 rounded-full text-red-500 shadow-md hover:bg-red-50"><Trash2 size={16} /></button>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [albums, setAlbums] = useState([]);
  const defaultPages = {
    about: { description: "雙北攝影，希望找到能表現清新、日系氛圍，或有生活情感表現力 Model 一起合作拍出好看的照片。\n有無經驗者皆可。", details: [{ label: "地區", value: "雙北地區，捷運方便抵達的區域" }, { label: "合作對象", value: "男女皆可" }, { label: "時間", value: "週末假日上午或下午" }, { label: "風格", value: "街景時裝" }] },
    contact: { formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfrkIAKa39F0ftGhSYxq02lRHAtAyAJRaV7uAY0bJFWlqR7rw/viewform", instagram: "mumuaci", email: "mumuaci77@gmail.com" }
  };
  const [pages, setPages] = useState(defaultPages);
  const [currentView, setCurrentView] = useState('home');
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [modal, setModal] = useState({ show: false, type: '', title: '', value: '', onConfirm: null, multiline: false, isPassword: false });

  useEffect(() => {
    const init = async () => { try { await signInAnonymously(auth); } catch(err) { setError("驗證失敗: " + err.message); } };
    init();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub1 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'albums'), (snap) => {
      setAlbums(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.createdAt||0) - new Date(a.createdAt||0)));
    });
    const unsub2 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'pages'), (snap) => {
      const pd = {}; snap.docs.forEach(d => { pd[d.id] = d.data(); });
      setPages(prev => { const n = {...prev}; Object.keys(pd).forEach(k => { n[k] = {...prev[k], ...pd[k]}; }); return n; });
      setLoading(false);
    }, (err) => { setError("資料載入失敗"); setLoading(false); });
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const updatePageData = async (pageId, newData) => { try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pages', pageId), newData, { merge: true }); } catch(e) {} };
  const handleMoveImage = async (albumId, idx, dir) => { const album = albums.find(a => a.id === albumId); if (!album) return; const imgs = [...(album.images||[])]; const t = idx+dir; if (t<0||t>=imgs.length) return; [imgs[idx], imgs[t]] = [imgs[t], imgs[idx]]; await updateDoc(doc(db,'artifacts',appId,'public','data','albums',albumId), {images: imgs}); };
  const handleMoveAlbum = async (ci, dir) => { const ti = ci+dir; if (ti<0||ti>=albums.length) return; const ca = albums[ci], ta = albums[ti]; await updateDoc(doc(db,'artifacts',appId,'public','data','albums',ca.id), {createdAt: ta.createdAt}); await updateDoc(doc(db,'artifacts',appId,'public','data','albums',ta.id), {createdAt: ca.createdAt}); };
  const handleSetCover = async (albumId, url) => { await updateDoc(doc(db,'artifacts',appId,'public','data','albums',albumId), {coverUrl: url}); };
  const handleToggleEditMode = () => {
    if (isEditing) { setIsEditing(false); return; }
    setModal({ show: true, type: 'input', isPassword: true, title: '請輸入管理員密碼', value: '', onConfirm: (val) => { if (val === '7777') setIsEditing(true); else setModal({ show: true, type: 'confirm', title: '密碼錯誤', onConfirm: () => {} }); } });
  };

  const activeAlbum = albums.find(a => a.id === selectedAlbumId);
  useEffect(() => {
    const handle = (e) => { if (lightboxIndex === null || !activeAlbum) return; if (e.key==='ArrowRight') setLightboxIndex(p => (p+1)%activeAlbum.images.length); if (e.key==='ArrowLeft') setLightboxIndex(p => (p-1+activeAlbum.images.length)%activeAlbum.images.length); if (e.key==='Escape') setLightboxIndex(null); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [lightboxIndex, activeAlbum]);

  if (error) return <div className="h-screen flex items-center justify-center text-red-500 font-bold p-6">{error}</div>;
  if (loading) return <div className="h-screen flex items-center justify-center"><div className="w-8 h-8 border-t-2 border-black rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-md z-40 border-b border-zinc-50">
        <div className="max-w-6xl mx-auto px-6 h-24 flex justify-between items-center">
          <div className="flex items-center cursor-pointer" onClick={() => { setCurrentView('home'); setSelectedAlbumId(null); setIsEditing(false); }}>
            <span className="text-4xl font-black tracking-tighter uppercase text-black leading-none">Portfolio</span>
          </div>
          <div className="flex items-center space-x-8 text-[10px] font-bold uppercase tracking-[0.2em]">
            <button onClick={() => { setCurrentView('home'); setSelectedAlbumId(null); }} className={currentView==='home' ? 'text-black' : 'text-zinc-400 hover:text-black'}>Works</button>
            <button onClick={() => setCurrentView('about')} className={currentView==='about' ? 'text-black' : 'text-zinc-400 hover:text-black'}>About</button>
            <button onClick={() => setCurrentView('contact')} className={currentView==='contact' ? 'text-black' : 'text-zinc-400 hover:text-black'}>Contact</button>
          </div>
        </div>
      </nav>

      <main className="pt-36 pb-20 max-w-6xl mx-auto px-6">
        {currentView === 'home' && (
          <div>
            {!selectedAlbumId ? (
              <div className="space-y-12">
                <div className="flex justify-between items-end border-b border-zinc-100 pb-8">
                  <h1 className="text-4xl font-light tracking-tighter text-zinc-400 italic uppercase">Collections</h1>
                  {isEditing && <button onClick={() => setModal({ show:true, type:'input', title:'新增相簿名稱', value:'', onConfirm: async(name) => { if(!name) return; const id=Date.now().toString(); await setDoc(doc(db,'artifacts',appId,'public','data','albums',id), {name, images:[], createdAt: new Date().toISOString()}); setSelectedAlbumId(id); }})} className="text-[10px] font-bold uppercase tracking-widest flex items-center space-x-2 bg-black text-white px-5 py-2.5 rounded-full hover:shadow-lg transition"><Plus size={14}/><span>新增相簿</span></button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {albums.map((album, idx) => {
                    const coverImg = album.coverUrl || album.images?.[0]?.url;
                    return (
                      <div key={album.id} className="group cursor-pointer space-y-4 relative" onClick={() => setSelectedAlbumId(album.id)}>
                        <div className="aspect-[4/5] bg-zinc-50 overflow-hidden rounded-sm border border-zinc-100 transition-all group-hover:shadow-2xl relative">
                          {coverImg ? <img src={transformImageUrl(coverImg)} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105" alt="" /> : <div className="w-full h-full flex items-center justify-center text-zinc-200"><ImageIcon size={48}/></div>}
                          {isEditing && (
                            <div className="absolute top-4 left-4 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                              {idx>0 && <button onClick={(e)=>{e.stopPropagation();handleMoveAlbum(idx,-1);}} className="bg-white/90 p-2 rounded-full text-zinc-600 hover:text-black shadow-md"><ChevronLeftIcon size={16}/></button>}
                              {idx<albums.length-1 && <button onClick={(e)=>{e.stopPropagation();handleMoveAlbum(idx,1);}} className="bg-white/90 p-2 rounded-full text-zinc-600 hover:text-black shadow-md"><ChevronRightIcon size={16}/></button>}
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between items-center px-1">
                          <h3 className="text-xs font-bold uppercase tracking-widest">{album.name}</h3>
                          <ArrowRight size={14} className="text-zinc-300 group-hover:text-black group-hover:translate-x-1 transition-all"/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-6">
                  <button onClick={() => setSelectedAlbumId(null)} className="flex items-center space-x-2 text-zinc-400 hover:text-black transition text-[10px] font-bold uppercase tracking-widest"><ChevronLeft size={16}/><span>Back to Collections</span></button>
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em]">{activeAlbum?.name}</h2>
                </div>
                {isEditing && (
                  <div className="flex items-center justify-between bg-zinc-50 p-5 rounded-xl border border-zinc-100">
                    <button onClick={() => setModal({ show:true, type:'confirm', title:`確定要刪除相簿「${activeAlbum?.name}」嗎？`, onConfirm: async() => { if(!activeAlbum?.id) return; await deleteDoc(doc(db,'artifacts',appId,'public','data','albums',activeAlbum.id)); setSelectedAlbumId(null); }})} className="text-zinc-300 hover:text-red-500 transition flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest"><Trash2 size={14}/><span>刪除此相簿</span></button>
                    <button onClick={() => setModal({ show:true, type:'input', title:'請貼上照片連結', value:'', onConfirm: async(url) => { if(!url||!activeAlbum?.id) return; const updated=[...(activeAlbum.images||[]), {id:Date.now().toString(), url:String(url).trim()}]; await updateDoc(doc(db,'artifacts',appId,'public','data','albums',activeAlbum.id), {images:updated}); }})} className="text-[10px] font-bold uppercase tracking-widest flex items-center space-x-2 bg-black text-white px-6 py-3 rounded-full hover:shadow-lg transition"><Plus size={12}/><span>新增照片連結</span></button>
                  </div>
                )}
                <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
                  {(activeAlbum?.images||[]).map((img, idx) => (
                    <ImageItem key={img.id} img={img} isEditing={isEditing} isFirst={idx===0} isLast={idx===(activeAlbum.images.length-1)} isCover={activeAlbum.coverUrl===img.url} onSetCover={() => handleSetCover(activeAlbum.id, img.url)} onMove={(dir) => handleMoveImage(activeAlbum.id, idx, dir)} onRemove={() => { const updated=activeAlbum.images.filter(i=>i.id!==img.id); const updates={images:updated}; if(activeAlbum.coverUrl===img.url) updates.coverUrl=null; updateDoc(doc(db,'artifacts',appId,'public','data','albums',activeAlbum.id), updates); }} onExpand={() => setLightboxIndex(idx)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'about' && (
          <div className="max-w-2xl py-12 space-y-10">
            <div className="space-y-8 relative group">
              <h2 className="text-4xl font-light tracking-tighter text-zinc-400 italic uppercase">About</h2>
              <p className="text-zinc-500 leading-relaxed font-light text-lg whitespace-pre-line">{String(pages.about?.description||"")}</p>
              {isEditing && <button onClick={() => setModal({ show:true, type:'input', multiline:true, title:'編輯描述', value:pages.about?.description, onConfirm:(val)=>updatePageData('about',{description:val}) })} className="absolute -top-2 -right-10 p-2 text-zinc-300 hover:text-black"><Edit3 size={18}/></button>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-zinc-100">
              {(pages.about?.details||[]).map((detail, idx) => (
                <div key={idx} className="space-y-1 relative group">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">{detail.label}</span>
                  <p className="text-sm text-zinc-600">{detail.value}</p>
                  {isEditing && <button onClick={() => setModal({ show:true, type:'input', title:`修改${detail.label}`, value:detail.value, onConfirm: async(val) => { const nd=[...(pages.about?.details||[])]; nd[idx].value=val; await updatePageData('about',{details:nd}); }})} className="absolute top-0 -right-8 opacity-0 group-hover:opacity-100 transition text-zinc-300 hover:text-black"><Edit3 size={14}/></button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'contact' && (
          <div className="max-w-xl py-12 space-y-12">
            <div className="space-y-8">
              <h2 className="text-4xl font-light tracking-tighter text-zinc-400 italic uppercase">Contact</h2>
              <p className="text-zinc-500 font-light text-lg">歡迎透過以下方式與我聯繫，或填寫互惠拍攝意願表單。</p>
            </div>
            <div className="flex flex-col space-y-4">
              <div className="relative group"><a href={pages.contact?.formUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-6 border border-zinc-100 rounded-sm hover:bg-zinc-50 transition-all"><div className="flex items-center space-x-4"><div className="w-10 h-10 bg-zinc-900 text-white rounded-full flex items-center justify-center"><ClipboardList size={20}/></div><div><span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400">Collaboration</span><span className="text-sm font-medium">互惠拍攝意願表單</span></div></div><ArrowRight size={18} className="text-zinc-300 group-hover:text-black"/></a>{isEditing && <button onClick={() => setModal({ show:true, type:'input', title:'修改表單連結', value:pages.contact?.formUrl, onConfirm:(val)=>updatePageData('contact',{formUrl:val}) })} className="absolute top-1/2 -right-12 -translate-y-1/2 text-zinc-300 hover:text-black"><Edit3 size={18}/></button>}</div>
              <div className="relative group"><a href={`https://www.instagram.com/${pages.contact?.instagram}/`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-6 border border-zinc-100 rounded-sm hover:bg-zinc-50 transition-all"><div className="flex items-center space-x-4"><div className="w-10 h-10 border border-zinc-200 rounded-full flex items-center justify-center"><Instagram size={20}/></div><div><span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400">Social</span><span className="text-sm font-medium">@{pages.contact?.instagram}</span></div></div><ArrowRight size={18} className="text-zinc-300 group-hover:text-black"/></a>{isEditing && <button onClick={() => setModal({ show:true, type:'input', title:'修改 IG 帳號', value:pages.contact?.instagram, onConfirm:(val)=>updatePageData('contact',{instagram:val}) })} className="absolute top-1/2 -right-12 -translate-y-1/2 text-zinc-300 hover:text-black"><Edit3 size={18}/></button>}</div>
              <div className="relative group flex items-center space-x-4 p-6 text-zinc-400 italic"><Mail size={16}/><span className="text-xs tracking-widest">{String(pages.contact?.email||"")}</span>{isEditing && <button onClick={() => setModal({ show:true, type:'input', title:'修改 Email', value:pages.contact?.email, onConfirm:(val)=>updatePageData('contact',{email:val}) })} className="ml-2 text-zinc-200 hover:text-black transition"><Edit3 size={14}/></button>}</div>
            </div>
          </div>
        )}
      </main>

      {lightboxIndex !== null && activeAlbum?.images && (
        <div className="fixed inset-0 bg-zinc-900/95 z-[100] flex items-center justify-center select-none" onClick={() => setLightboxIndex(null)}>
          <button className="absolute top-8 right-8 text-white/50 hover:text-white transition z-[110]" onClick={() => setLightboxIndex(null)}><X size={32}/></button>
          <button className="absolute left-0 top-0 bottom-0 w-24 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 transition z-[105]" onClick={(e)=>{e.stopPropagation();setLightboxIndex(p=>(p-1+activeAlbum.images.length)%activeAlbum.images.length);}}><ChevronLeftIcon size={48} strokeWidth={1}/></button>
          <button className="absolute right-0 top-0 bottom-0 w-24 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 transition z-[105]" onClick={(e)=>{e.stopPropagation();setLightboxIndex(p=>(p+1)%activeAlbum.images.length);}}><ChevronRightIcon size={48} strokeWidth={1}/></button>
          <div className="max-w-full max-h-full p-12 flex items-center justify-center"><img src={transformImageUrl(activeAlbum.images[lightboxIndex].url)} className="max-w-full max-h-[90vh] object-contain shadow-2xl pointer-events-none" alt=""/></div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-[10px] tracking-[0.2em] font-bold uppercase">{lightboxIndex+1} / {activeAlbum.images.length}</div>
        </div>
      )}

      <button onClick={handleToggleEditMode} className={`fixed bottom-8 right-8 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all z-40 ${isEditing ? 'bg-black text-white ring-4 ring-black/10' : 'bg-white text-zinc-300 hover:text-black border border-zinc-100'}`}>
        {isEditing ? <Check size={20}/> : <Settings size={20}/>}
      </button>

      {modal.show && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setModal({...modal, show:false})}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl space-y-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center space-x-3 text-zinc-400">{modal.isPassword && <Lock size={16}/>}<h3 className="text-xs font-bold uppercase tracking-[0.2em]">{modal.title}</h3></div>
            {modal.type === 'input' && (modal.multiline ? <textarea autoFocus className="w-full border-b border-zinc-200 py-3 text-sm focus:outline-none focus:border-black min-h-[150px] resize-none" value={modal.value} onChange={(e) => setModal({...modal, value:e.target.value})} /> : <input type={modal.isPassword?"password":"text"} autoFocus className="w-full border-b border-zinc-200 py-3 text-sm focus:outline-none focus:border-black" value={modal.value} onChange={(e) => setModal({...modal, value:e.target.value})} onKeyDown={(e) => { if(e.key==='Enter') { modal.onConfirm(modal.value); setModal({...modal, show:false}); }}} />)}
            <div className="flex justify-end space-x-6 pt-4">
              <button onClick={() => setModal({...modal, show:false})} className="text-[10px] font-bold uppercase text-zinc-300">取消</button>
              <button onClick={() => { modal.onConfirm(modal.value); setModal({...modal, show:false}); }} className="text-[10px] font-bold uppercase bg-black text-white px-8 py-3 rounded-full shadow-md">確定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;